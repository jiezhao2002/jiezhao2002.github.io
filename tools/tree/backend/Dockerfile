FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/data/.cache/huggingface

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cmake \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/.cache/huggingface \
    && chmod -R 777 /data

COPY requirements*.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-gguf.txt

COPY app ./app

ENV MODEL_PROVIDER=llama_cpp
ENV MODEL_REPO_ID=Qwen/Qwen3-4B-GGUF
ENV MODEL_FILENAME=Qwen3-4B-Q4_K_M.gguf
ENV N_CTX=4096
ENV N_THREADS=2
ENV N_GPU_LAYERS=0
ENV TREE_LOAD_MODEL_ON_STARTUP=1
ENV OLLAMA_BASE_URL=http://localhost:11434
ENV OLLAMA_MODEL=qwen3:4b
ENV PORT=7860

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
