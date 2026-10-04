# Optional Local Model Backend

The public app uses `worker/` (Cloudflare + Groq). This FastAPI backend defaults to Ollama for local development without API keys. It also supports GGUF inference using llama-cpp-python.

## Ollama

```bash
ollama serve
ollama pull qwen3:4b
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm run backend
```

Set the frontend's local `VITE_API_BASE_URL=http://localhost:7860`. Health at `/health` checks `/api/tags` and reports whether the model is installed. Override `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, or `OLLAMA_TIMEOUT_SECONDS` as needed. Do not expose an unrestricted Ollama server to public visitors.

## GGUF Alternative

From `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-gguf.txt
MODEL_PROVIDER=llama_cpp \
MODEL_REPO_ID=Qwen/Qwen3-4B-GGUF \
MODEL_FILENAME=Qwen3-4B-Q4_K_M.gguf \
N_CTX=4096 N_THREADS=4 \
uvicorn app.main:app --host 127.0.0.1 --port 7860
```

First use downloads the GGUF file from Hugging Face Hub. Set `N_GPU_LAYERS=0` for CPU, `TREE_LOAD_MODEL_ON_STARTUP=0` for lazy loading, or `TREE_STRICT_MODEL_STARTUP=1` to fail startup if loading fails.

The Dockerfile installs GGUF requirements and can run in a Hugging Face Docker Space. New compute Spaces require a qualifying paid plan as of October 2026; check [current eligibility](https://huggingface.co/docs/hub/spaces-overview). Configure exact `CORS_ORIGINS` and set `VITE_API_BASE_URL=https://YOUR_SPACE.hf.space`. Public hosting needs additional abuse controls; this local backend is not the public gateway.

## Behavior

`/expand-node` returns three candidates and no extra shadows. `/bridge-path` returns conceptual transitions. Errors are explicit HTTP failures. Silent demo fallback is disabled by default (`TREE_ALLOW_DEMO_FALLBACK=1` is a development opt-in). No Supabase or hosted-model token is required for local Ollama.
