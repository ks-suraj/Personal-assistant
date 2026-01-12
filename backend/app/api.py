from fastapi import APIRouter
from fastapi.responses import JSONResponse
import base64
import os
import json
import traceback
from datetime import datetime

from app.core import ai_engine, database, config
from app.services.tts import speak

router = APIRouter()

# ---------------- PATHS ----------------

SESSIONS_DIR = os.path.join(os.getcwd(), "app", "data", "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

DB_PATH = os.path.join(os.getcwd(), config.DB_NAME)
SCHEMA = database.get_schema_summary(DB_PATH)

# ---------------- HELPERS ----------------

def new_session_path():
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    return os.path.join(SESSIONS_DIR, f"session_{ts}.json")

def load_session(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_session(path: str, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ---------------- SESSIONS API ----------------

@router.get("/sessions")
async def list_sessions():
    out = []
    for f in os.listdir(SESSIONS_DIR):
        if f.endswith(".json"):
            with open(os.path.join(SESSIONS_DIR, f), "r", encoding="utf-8") as fp:
                data = json.load(fp)
                out.append({
                    "id": f,
                    "created_at": data["created_at"]
                })
    out.sort(key=lambda x: x["created_at"], reverse=True)
    return out

@router.get("/sessions/{filename}")
async def get_session(filename: str):
    return load_session(os.path.join(SESSIONS_DIR, filename))

# ---------------- CHAT ----------------

@router.post("/query/text")
async def query_text(payload: dict):
    try:
        user_text = payload.get("text", "").strip()
        session_file = payload.get("session_file")

        if not user_text:
            return JSONResponse({"error": "Empty input"}, status_code=400)

        if not session_file:
            session_file = new_session_path()
            session_data = {
                "session_id": os.path.basename(session_file),
                "created_at": datetime.utcnow().isoformat(),
                "messages": []
            }
        else:
            session_data = load_session(session_file)

        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        response = ai_engine.get_ai_response(
            openrouter_key,
            user_text,
            SCHEMA
        )

        if response.upper().startswith("SELECT"):
            data = database.execute_query(DB_PATH, response)
            if not data:
                final_text = "I tried checking the data, but something went wrong."
            else:
                headers, rows = data[0], data[1:]
                final_text = ai_engine.explain_result(
                    openrouter_key,
                    user_text,
                    headers,
                    rows
                )
        else:
            final_text = response

        # 🔊 AUDIO FIRST (MANDATORY)
        audio_bytes = speak(final_text)
        if not audio_bytes:
            return {
                "text": final_text,
                "audio": None,
                "session_file": session_file
            }

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

        # 💾 SAVE ONLY AFTER AUDIO
        session_data["messages"].append({
            "role": "user",
            "content": user_text
        })
        session_data["messages"].append({
            "role": "assistant",
            "content": final_text
        })

        save_session(session_file, session_data)

        return {
            "text": final_text,
            "audio": audio_b64,
            "session_file": session_file
        }

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(
            {"error": "Internal server error", "details": str(e)},
            status_code=500
        )
