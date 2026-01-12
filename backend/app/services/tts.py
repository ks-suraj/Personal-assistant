from elevenlabs.client import ElevenLabs
import os
import traceback

ELEVEN_MODEL_ID = "eleven_v3"
ELEVEN_VOICE_ID = "Nda4CxqYPMJ65wadFnhJ"

def speak(text: str) -> bytes:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ElevenLabs API key not loaded")

    try:
        client = ElevenLabs(api_key=api_key)

        audio = client.text_to_speech.convert(
            text=text,
            voice_id=ELEVEN_VOICE_ID,
            model_id=ELEVEN_MODEL_ID,
            output_format="mp3_44100_128",
        )

        return b"".join(audio)

    except Exception:
        traceback.print_exc()
        return b""
