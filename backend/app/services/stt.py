import tempfile
import os
from openai import OpenAI

def transcribe_audio(audio_bytes: bytes) -> str:
    client = OpenAI()  # create AFTER env is loaded

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(audio_bytes)
        path = tmp.name

    with open(path, "rb") as f:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=f
        )

    os.remove(path)
    return transcript.text.strip()
