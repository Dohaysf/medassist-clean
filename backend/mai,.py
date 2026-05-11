# tts_service/main.py
# ─────────────────────────────────────────────────────────────────────────────
# Installation :
#   pip install fastapi uvicorn gtts
#
# Lancement :
#   python main.py
#
# Test :
#   curl http://localhost:8002/health
# ─────────────────────────────────────────────────────────────────────────────

import os
import io
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from gtts import gTTS

app = FastAPI(title="gTTS Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# Cache simple en mémoire
_cache = {}
MAX_CACHE = 50

class TTSRequest(BaseModel):
    text: str
    lang: str = "fr"  # "fr" ou "ar"

@app.post("/speak")
async def speak(req: TTSRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texte vide")
    if len(text) > 500:
        text = text[:500]

    lang_map = {"fr": "fr", "ar": "ar", "en": "en"}
    lang = lang_map.get(req.lang, "fr")

    cache_key = hashlib.md5(f"{text}{lang}".encode()).hexdigest()

    if cache_key in _cache:
        print(f"🎵 Cache hit [{lang}]: {text[:40]}...")
        audio_data = _cache[cache_key]
    else:
        print(f"🔊 gTTS [{lang}]: {text[:60]}...")
        try:
            tts = gTTS(text=text, lang=lang, slow=False)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            buf.seek(0)
            audio_data = buf.read()
            if len(_cache) >= MAX_CACHE:
                del _cache[next(iter(_cache))]
            _cache[cache_key] = audio_data
            print(f"✅ {len(audio_data)} bytes générés")
        except Exception as e:
            print(f"❌ Erreur gTTS: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return StreamingResponse(
        io.BytesIO(audio_data),
        media_type="audio/mpeg",
        headers={"Content-Length": str(len(audio_data))}
    )

@app.get("/health")
def health():
    return {"status": "ok", "service": "gTTS"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002, log_level="info")