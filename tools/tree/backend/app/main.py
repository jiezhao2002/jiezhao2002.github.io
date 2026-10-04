from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class ExplorationContract(BaseModel):
    id: str
    seedTopic: str
    domain: str | None = None
    style: str = "minimal-hand-drawn"
    branchWidth: int = Field(default=3, ge=1, le=6)
    ghostLeafLimit: int = Field(default=2, ge=0, le=5)
    abstractionLevel: Literal["concrete", "balanced", "abstract"] = "balanced"
    createdAt: str


class NodePacket(BaseModel):
    title: str
    summaryShort: str
    parentTitle: str | None = None
    siblingTitles: list[str] = Field(default_factory=list)
    existingChildTitles: list[str] = Field(default_factory=list)
    domain: str | None = None
    disambiguation: str | None = None


class ExpandNodeRequest(BaseModel):
    contract: ExplorationContract
    nodePacket: NodePacket


class ExpansionChild(BaseModel):
    title: str
    summaryShort: str
    relationType: str


class ExpansionGhostLeaf(BaseModel):
    title: str
    rationale: str


class ExpandNodeResponse(BaseModel):
    children: list[ExpansionChild]
    ghostLeaves: list[ExpansionGhostLeaf]


class BridgePathRequest(BaseModel):
    contract: ExplorationContract
    sourceTitle: str
    targetTitle: str
    sourceSummaryShort: str
    targetSummaryShort: str
    maxBricks: int = Field(default=4, ge=1, le=8)


class TurningBrick(BaseModel):
    title: str
    fromTitle: str
    toTitle: str
    explanation: str
    relationType: str


class BridgePathResponse(BaseModel):
    turningBricks: list[TurningBrick]


logger = logging.getLogger("tree-knowledge-explorer")

app = FastAPI(title="Tree Knowledge Explorer API")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5174,http://localhost:5173,http://127.0.0.1:5174,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

github_pages_origin = os.getenv("GITHUB_PAGES_ORIGIN")
if github_pages_origin:
    allowed_origins.append(github_pages_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["X-Tree-Generation-Source", "X-Tree-Model"],
)

_llm = None
_model_load_error: str | None = None


@app.on_event("startup")
def load_model_on_startup() -> None:
    if os.getenv("TREE_LOAD_MODEL_ON_STARTUP", "1") == "0":
        return
    if get_model_provider() == "llama_cpp":
        try:
            get_llama_cpp()
        except Exception as exc:
            logger.exception("Unable to load llama.cpp model")
            if os.getenv("TREE_STRICT_MODEL_STARTUP", "0") == "1":
                raise exc


@app.get("/health")
def health() -> dict:
    provider = get_model_provider()
    status: dict[str, bool | int | str | None] = {
        "ok": True,
        "provider": provider,
        "model": get_model_name(),
    }
    if provider == "llama_cpp":
        status.update(
            {
                "modelLoaded": _llm is not None,
                "modelRepoId": get_model_repo_id(),
                "modelFilename": get_model_filename(),
                "nCtx": get_int_env("N_CTX", 4096),
                "nThreads": get_int_env("N_THREADS", 2),
                "nGpuLayers": get_int_env("N_GPU_LAYERS", 0),
                "modelError": _model_load_error,
            }
        )
    elif provider == "ollama":
        status.update({"ollamaBaseUrl": get_ollama_base_url(), "ollamaConnected": False, "modelAvailable": False})
        try:
            with urllib.request.urlopen(f"{get_ollama_base_url()}/api/tags", timeout=3) as response:
                models = json.loads(response.read()).get("models", [])
            names = [model.get("name", "") for model in models]
            name = get_model_name()
            available = name in names or f"{name}:latest" in names
            status.update({"ok": available, "ollamaConnected": True, "modelAvailable": available})
            if not available:
                status["modelError"] = f"Model {name} is not installed. Run: ollama pull {name}"
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            status.update({"ok": False, "modelError": "Cannot reach Ollama. Start it with: ollama serve"})
    return status


@app.post("/expand-node", response_model=ExpandNodeResponse)
def expand_node(request: ExpandNodeRequest, http_response: Response) -> ExpandNodeResponse:
    prompt = build_expand_prompt(request)
    schema = ExpandNodeResponse.model_json_schema()
    schema["properties"]["children"].update(minItems=request.contract.branchWidth, maxItems=request.contract.branchWidth)
    schema["properties"]["ghostLeaves"].update(maxItems=0)
    set_generation_headers(http_response)
    raw_output = call_model(prompt, max_tokens=768, temperature=0.3, schema=schema)

    if raw_output is None:
        if os.getenv("TREE_ALLOW_DEMO_FALLBACK", "0") == "1":
            http_response.headers["X-Tree-Generation-Source"] = "demo"
            return fallback_expand(request)
        raise HTTPException(status_code=503, detail="The model is unavailable. Check /health and retry.")

    try:
        parsed = parse_json_response(raw_output)
        response = ExpandNodeResponse.model_validate(parsed)
        validate_expand_response(request.contract, response)
        return response
    except Exception:
        repair_prompt = build_repair_prompt(raw_output, "expand-node")
        repaired_output = call_model(repair_prompt, max_tokens=768, temperature=0.1, schema=schema)

    if repaired_output is None:
        raise HTTPException(status_code=502, detail="The model did not return a valid expansion. Please retry.")

    try:
        parsed = parse_json_response(repaired_output)
        response = ExpandNodeResponse.model_validate(parsed)
        validate_expand_response(request.contract, response)
        return response
    except Exception as exc:
        raise HTTPException(status_code=502, detail="The model did not return three valid candidates. Please retry.") from exc


@app.post("/bridge-path", response_model=BridgePathResponse)
def bridge_path(request: BridgePathRequest, http_response: Response) -> BridgePathResponse:
    prompt = build_bridge_prompt(request)
    schema = BridgePathResponse.model_json_schema()
    schema["properties"]["turningBricks"].update(minItems=1, maxItems=request.maxBricks)
    set_generation_headers(http_response)
    raw_output = call_model(prompt, max_tokens=1024, temperature=0.25, schema=schema)

    if raw_output is None:
        if os.getenv("TREE_ALLOW_DEMO_FALLBACK", "0") == "1":
            http_response.headers["X-Tree-Generation-Source"] = "demo"
            return fallback_bridge(request)
        raise HTTPException(status_code=503, detail="The model is unavailable. Check /health and retry.")

    try:
        parsed = parse_json_response(raw_output)
        response = BridgePathResponse.model_validate(parsed)
        validate_bridge_response(request, response)
        return response
    except Exception:
        repair_prompt = build_repair_prompt(raw_output, "bridge-path")
        repaired_output = call_model(repair_prompt, max_tokens=1024, temperature=0.1, schema=schema)

    if repaired_output is None:
        raise HTTPException(status_code=502, detail="The model did not return a valid bridge. Please retry.")

    try:
        parsed = parse_json_response(repaired_output)
        response = BridgePathResponse.model_validate(parsed)
        validate_bridge_response(request, response)
        return response
    except Exception as exc:
        raise HTTPException(status_code=502, detail="The model did not return a valid bridge. Please retry.") from exc


def set_generation_headers(response: Response) -> None:
    response.headers["X-Tree-Generation-Source"] = get_model_provider()
    response.headers["X-Tree-Model"] = get_model_name()


def get_model_provider() -> str:
    return os.getenv("MODEL_PROVIDER", "ollama").strip().lower()


def get_model_name() -> str:
    if get_model_provider() == "ollama":
        return os.getenv("OLLAMA_MODEL", "qwen3:4b")
    return get_model_filename()


def get_model_repo_id() -> str:
    return os.getenv("MODEL_REPO_ID", "Qwen/Qwen3-4B-GGUF")


def get_model_filename() -> str:
    return os.getenv("MODEL_FILENAME", "Qwen3-4B-Q4_K_M.gguf")


def get_ollama_base_url() -> str:
    return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")


def get_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def get_llama_cpp():
    global _llm, _model_load_error

    if _llm is not None:
        return _llm

    try:
        from huggingface_hub import hf_hub_download
        from llama_cpp import Llama
    except Exception as exc:
        _model_load_error = f"{type(exc).__name__}: {exc}"
        raise RuntimeError(
            "llama-cpp-python and huggingface-hub are required for MODEL_PROVIDER=llama_cpp. "
            "Install backend/requirements.txt before running this provider."
        ) from exc

    repo_id = get_model_repo_id()
    filename = get_model_filename()
    try:
        model_path = hf_hub_download(repo_id=repo_id, filename=filename)
        _llm = Llama(
            model_path=model_path,
            n_ctx=get_int_env("N_CTX", 4096),
            n_threads=get_int_env("N_THREADS", 2),
            n_gpu_layers=get_int_env("N_GPU_LAYERS", 0),
            n_batch=get_int_env("N_BATCH", 256),
            verbose=os.getenv("LLAMA_CPP_VERBOSE", "0") == "1",
        )
        _model_load_error = None
    except Exception as exc:
        _model_load_error = f"{type(exc).__name__}: {exc}"
        raise
    return _llm


def call_model(prompt: str, max_tokens: int, temperature: float, schema: dict | None = None) -> str | None:
    provider = get_model_provider()

    if provider == "ollama":
        return call_ollama(prompt, max_tokens=max_tokens, temperature=temperature, schema=schema)

    if provider != "llama_cpp":
        logger.warning("Unknown model provider: %s", provider)
        return None

    try:
        llm = get_llama_cpp()
    except Exception:
        logger.exception("Unable to call llama.cpp model")
        return None

    if llm is None:
        return None

    result = llm(
        prompt,
        max_tokens=max_tokens,
        temperature=temperature,
        stop=["</json>", "\n\nUser:", "\nUser:"],
    )
    return cleanup_model_text(result["choices"][0]["text"])


def call_ollama(prompt: str, max_tokens: int, temperature: float, schema: dict | None = None) -> str | None:
    payload = {
        "model": get_model_name(),
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "think": False,
        "format": schema or "json",
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    request = urllib.request.Request(
        f"{get_ollama_base_url()}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))) as response:
            body = json.loads(response.read().decode("utf-8"))
            content = body.get("message", {}).get("content", "")
            if body.get("done_reason") == "length":
                raise HTTPException(status_code=502, detail="Model output was truncated. Please retry.")
            return cleanup_model_text(str(content)) or None
    except urllib.error.HTTPError as exc:
        logger.warning("Ollama returned HTTP %s", exc.code)
        if exc.code == 404:
            raise HTTPException(status_code=503, detail=f"Model {get_model_name()} is not installed. Run: ollama pull {get_model_name()}") from exc
        raise HTTPException(status_code=502, detail="Ollama could not generate a response. Check /health and retry.") from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Ollama timed out. Please retry after the model loads.") from exc
    except urllib.error.URLError as exc:
        raise HTTPException(status_code=503, detail="Cannot reach Ollama. Start it with: ollama serve") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Ollama returned an invalid response. Please retry.") from exc


def cleanup_model_text(text: str) -> str:
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    return cleaned.strip()


def build_expand_prompt(request: ExpandNodeRequest) -> str:
    node = request.nodePacket
    contract = request.contract
    return f"""Return JSON only.
No markdown. No chain-of-thought. No essay.
Create exactly {contract.branchWidth} children.
Do not create extra ghost leaves. ghostLeaves must be [].
The frontend treats child #1 as the chosen branch and child #2/#3 as shadow leaves.
summaryShort must be under 40 words.
Use the language of the node title. Use concise, specific concepts rather than generic labels like 'Origins of'.
Give three distinct relevant directions. Avoid repeating the node, siblings, or existing children.
Domain: {node.domain or contract.domain or "unknown"}.
Disambiguation: {node.disambiguation or "none"}.
Seed topic: {contract.seedTopic}.
Abstraction: {contract.abstractionLevel}.
Node: {node.title}
Summary: {node.summaryShort}
Parent: {node.parentTitle or "none"}
Siblings: {", ".join(node.siblingTitles) or "none"}
Existing children: {", ".join(node.existingChildTitles) or "none"}
Schema:
{{"children":[{{"title":"string","summaryShort":"string","relationType":"string"}}],"ghostLeaves":[]}}
JSON:
"""


def build_bridge_prompt(request: BridgePathRequest) -> str:
    return f"""Return JSON only.
No markdown. No chain-of-thought.
Create 1 to {request.maxBricks} turningBricks.
Each turning brick explains why concept A can transition into concept B.
Use the language of the source title. Keep explanations under 40 words.
Source: {request.sourceTitle} -- {request.sourceSummaryShort}
Target: {request.targetTitle} -- {request.targetSummaryShort}
Schema:
{{"turningBricks":[{{"title":"string","fromTitle":"string","toTitle":"string","explanation":"string","relationType":"string"}}]}}
JSON:
"""


def build_repair_prompt(raw_output: str, endpoint: str) -> str:
    return f"""Repair this {endpoint} output into valid JSON only.
No markdown.
Raw output:
{raw_output}
JSON:
"""


def parse_json_response(raw_output: str) -> dict:
    stripped = raw_output.strip()

    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()

    start = stripped.find("{")
    end = stripped.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found")

    return json.loads(stripped[start : end + 1])


def validate_expand_response(contract: ExplorationContract, response: ExpandNodeResponse) -> None:
    if len(response.children) != contract.branchWidth:
        raise ValueError("children length must match branchWidth")
    if len(response.ghostLeaves) != 0:
        raise ValueError("ghostLeaves must be empty; shadow leaves are derived from unchosen children")
    for child in response.children:
        if len(child.summaryShort.split()) > 40:
            raise ValueError("summaryShort exceeds 40 words")


def validate_bridge_response(request: BridgePathRequest, response: BridgePathResponse) -> None:
    if not response.turningBricks:
        raise ValueError("turningBricks cannot be empty")
    if len(response.turningBricks) > request.maxBricks:
        raise ValueError("too many turningBricks")


@lru_cache(maxsize=256)
def fallback_phrase(seed: str, index: int) -> str:
    options = ["origin", "mechanism", "use", "limit", "contrast", "evidence", "analogy", "consequence"]
    return options[(sum(ord(char) for char in seed) + index) % len(options)]


def fallback_expand(request: ExpandNodeRequest) -> ExpandNodeResponse:
    title = request.nodePacket.title
    children = [
        ExpansionChild(
            title=f"{fallback_phrase(title, index).title()} of {title}",
            summaryShort=f"{title} opens a {fallback_phrase(title, index)} route for this branch.",
            relationType=fallback_phrase(title, index),
        )
        for index in range(request.contract.branchWidth)
    ]
    return ExpandNodeResponse(children=children, ghostLeaves=[])


def fallback_bridge(request: BridgePathRequest) -> BridgePathResponse:
    return BridgePathResponse(
        turningBricks=[
            TurningBrick(
                title=f"{request.sourceTitle} to {request.targetTitle}",
                fromTitle=request.sourceTitle,
                toTitle=request.targetTitle,
                explanation=f"{request.sourceTitle} can be read as a condition that makes {request.targetTitle} easier to approach.",
                relationType="conceptual transition",
            )
        ]
    )
