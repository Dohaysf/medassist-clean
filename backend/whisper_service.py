# whisper_service/main.py
# ─────────────────────────────────────────────────────────────────────────────
# Lancement : python main.py
# Test      : curl http://localhost:8001/health
# ─────────────────────────────────────────────────────────────────────────────

import os, sys, shutil, tempfile, subprocess, threading
import numpy as np

# ── Détection ffmpeg ──────────────────────────────────────────────────────────
_CHOCO_PATH = r"C:\ProgramData\chocolatey\bin\ffmpeg.exe"
if os.path.exists(_CHOCO_PATH):
    FFMPEG_EXECUTABLE = _CHOCO_PATH
elif shutil.which("ffmpeg"):
    FFMPEG_EXECUTABLE = shutil.which("ffmpeg")
else:
    _local = os.path.join(os.path.dirname(__file__), "ffmpeg.exe")
    if os.path.exists(_local):
        FFMPEG_EXECUTABLE = _local
    else:
        print("❌ ffmpeg introuvable ! installe-le avec: choco install ffmpeg")
        sys.exit(1)

print(f"✅ ffmpeg: {FFMPEG_EXECUTABLE}")
os.environ["PATH"] = os.path.dirname(FFMPEG_EXECUTABLE) + os.pathsep + os.environ.get("PATH", "")

import whisper, torch
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ── Config ────────────────────────────────────────────────────────────────────
# small = meilleur en français/arabe, tiny = plus rapide mais moins précis
MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE     = "cuda" if torch.cuda.is_available() else "cpu"
# Nombre de threads CPU pour accélérer l'inférence
N_THREADS  = min(8, os.cpu_count() or 4)
torch.set_num_threads(N_THREADS)

print(f"🎙️  Chargement Whisper '{MODEL_SIZE}' sur {DEVICE.upper()} ({N_THREADS} threads)...")
model = whisper.load_model(MODEL_SIZE, device=DEVICE)
# Pré-chauffer le modèle avec un audio silencieux pour éviter le lag du 1er appel
_dummy = np.zeros(16000, dtype=np.float32)
model.transcribe(_dummy, language="fr", fp16=False, temperature=0.0)
print(f"✅ Modèle prêt (préchauffé) — port 8001")

# ── Sémaphore : 1 transcription à la fois (évite surcharge CPU) ───────────────
_sem = threading.Semaphore(1)

app = FastAPI(title="Whisper Local", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Conversion vers WAV 16kHz mono ────────────────────────────────────────────
def to_wav(input_path: str) -> str:
    out = input_path + ".wav"
    r = subprocess.run(
        [FFMPEG_EXECUTABLE, "-y", "-i", input_path,
         "-ar", "16000", "-ac", "1", "-f", "wav", out],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {r.stderr.decode()[-200:]}")
    return out

# ── Transcription ─────────────────────────────────────────────────────────────
@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str    = Form("fr"),
):
    # Langues supportées
    lang_map = {"fr": "fr", "ar": "ar", "en": "en"}
    lang = lang_map.get(language, "fr")

    audio_bytes = await file.read()
    print(f"📥 {file.filename} — {len(audio_bytes)} bytes — [{lang}]")

    if len(audio_bytes) < 1000:
        return {"transcript": ""}

    suffix    = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    tmp_input = None
    tmp_wav   = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            f.write(audio_bytes)
            tmp_input = f.name

        # WAV natif → pas de conversion
        if suffix.lower() == ".wav":
            tmp_wav = tmp_input
        else:
            tmp_wav = to_wav(tmp_input)

        print(f"🔄 WAV: {os.path.getsize(tmp_wav)} bytes — transcription...")

        # Acquérir le sémaphore (file d'attente si 2 requêtes simultanées)
        _sem.acquire()
        try:
            result = model.transcribe(
                tmp_wav,
                language=lang,
                fp16=(DEVICE == "cuda"),
                temperature=0.0,
                condition_on_previous_text=False,
                # Optimisations vitesse
                beam_size=1,          # greedy decode = 2-3x plus rapide que beam=5
                best_of=1,
                no_speech_threshold=0.6,
                compression_ratio_threshold=2.4,
            )
        finally:
            _sem.release()

        text = result.get("text", "").strip()
        print(f"✅ [{lang}]: \"{text}\"")
        return {"transcript": text}

    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"❌ {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for p in [tmp_input, tmp_wav]:
            if p and p != tmp_input and os.path.exists(p):
                os.unlink(p)
        if tmp_input and os.path.exists(tmp_input):
            os.unlink(tmp_input)

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE, "threads": N_THREADS}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="warning")