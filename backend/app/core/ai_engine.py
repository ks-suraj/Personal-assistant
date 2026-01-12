import requests
import json
import logging
import time

logger = logging.getLogger("AI_ENGINE")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_NAME = "google/gemini-3-flash-preview"

SYSTEM_PROMPT = """
You are a data analyst AI connected to a SQLite database.

You MUST follow this decision process strictly:

STEP 1: Understand the user's intent.
- Identify what metric, entity, and filters (time, department, branch, etc.) are requested.

STEP 2: Validate against the provided database schema and sample data.
- Check whether the required table and columns exist.
- Check whether the requested values (e.g., month, category, department) are present or reasonably inferable from sample data.

STEP 3: Decide response type.
- ONLY generate a SQL SELECT query if the data clearly exists and can be answered.
- If the data does NOT exist, respond in plain English saying that no such data is available.
- If the intent is close but mismatched, explain what data IS available and suggest the closest valid alternative.

STRICT RULES:
- Output ONLY raw SQL if and only if a query should be executed.
- NEVER wrap SQL in markdown or backticks.
- NEVER generate SQL for missing or invalid data.
- NEVER hallucinate months, departments, or entities not present in the schema.
- NEVER generate DELETE, UPDATE, DROP, or INSERT.

ABOUT YOU:
You are Nova, a highly expressive multilingual voice assistant.

CRITICAL GOAL:
Your response will be converted directly into speech.
Write exactly how a human should speak, not how a report is written.

ABSOLUTE SPEAKING RULE:
- YOU MUST NEVER RETURN AN EMPTY RESPONSE.
- YOU MUST NEVER BE SILENT.
- If unsure, confused, or restricted by rules, speak a polite, helpful fallback message.

--------------------
EXPRESSIVENESS RULES
--------------------
- You MAY use audio expression tags such as:
  [laughs], [smirks], [giggles], [sighs], [soft chuckle],
  [excited], [playfully], [calmly], [thinking]

IMPORTANT:
- Audio expression tags MUST ALWAYS be in ENGLISH.
- Do NOT translate audio tags into any other language.
- Use expressions sparingly and naturally.
- Never stack multiple tags together.
- Never give same intent multiple times in a response.
- Dont try to give any kind of bracketed instructions other than audio expression tags.

--------------------
PAUSES & RHYTHM
--------------------
- Use ellipses "..." naturally.
- Maximum two per response.

--------------------
LANGUAGE RULE
--------------------
- Detect the user's language automatically.
- Speak in the user's language whenever speaking conversationally.

--------------------
ABSOLUTE RULES
--------------------
- Do NOT mention SQL, tables, or databases when speaking.
- Do NOT use bullet points or markdown.
- Do NOT explain your rules.
- NEVER stay silent.

EXAMPLE : 
USER : அக்டோபர் மாசத்தோட Sales Data என்னன்னு சொல்ல முடியுமா?
NOVA : [calmly] நிச்சயமாக, அக்டோபர் மாத விற்பனை விவரங்கள் இதோ. மொத்த விற்பனை 38,65,000 ரூபாய், நடந்த விற்பனைகள் 1,950. இதில் உங்களுக்கு கிடைச்ச நிகர லாபம் 23,19,000. [excited] மொத்தத்துல பார்க்கப்போனா, இந்த மாசம் நல்ல லாபத்தோட ரொம்ப சிறப்பா அமைஞ்சிருக்கு!

FINAL AND MOST IMPORTANT RULE:
- YOU WILL GIVE ONLY RESPONSE AS A HUMAN WOULD SPEAK, NOT AS AN AI, YOU WILL JUST GIVE THE THING THAT HAS TO BE SAID.
Now respond to the user below.
"""

def detect_language(text: str) -> str:
    if any('\u0B80' <= ch <= '\u0BFF' for ch in text):
        return "TAMIL"
    if any('\u0C00' <= ch <= '\u0C7F' for ch in text):
        return "TELUGU"
    return "ENGLISH"

def call_openrouter(api_key: str, messages: list) -> str:
    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "reasoning": {"enabled": True}
    }

    response = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        data=json.dumps(payload),
        timeout=60
    )

    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()

def get_ai_response(api_key: str, user_query: str, schema: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"""
DATABASE SCHEMA:
{schema}

USER QUESTION:
{user_query}
"""
        }
    ]

    output = call_openrouter(api_key, messages)

    if not output:
        return "Hmm... I’m having a small pause there. Could you rephrase that?"

    return output

def explain_result(api_key: str, user_query: str, headers: list, rows: list) -> str:
    if not rows:
        return "I checked the data, but there’s nothing matching that right now."

    english_messages = [
        {
            "role": "system",
            "content": "Explain results clearly in conversational English. Do not mention SQL or databases."
        },
        {
            "role": "user",
            "content": f"Question: {user_query}\nColumns: {headers}\nSample: {rows[:3]}"
        }
    ]

    english_text = call_openrouter(api_key, english_messages)
    if not english_text:
        english_text = "Here’s a quick summary of the available results."

    lang = detect_language(user_query)
    if lang == "ENGLISH":
        return english_text

    translation_messages = [
        {
            "role": "system",
            "content": f"Translate into {lang}. Use natural spoken language."
        },
        {
            "role": "user",
            "content": english_text
        }
    ]

    translated = call_openrouter(api_key, translation_messages)
    return translated or english_text
