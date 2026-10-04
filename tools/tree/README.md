# Tree

A minimal, hand-drawn knowledge tree. Start with one leaf, then explore three model-generated directions. The first candidate grows as a real leaf; the other two remain faint, clickable shadows. Choosing a shadow preserves its original shape and position.

## Public Deployment

```text
jiezhao2002.github.io/tree/ -> Cloudflare Worker -> Groq
```

The site entry lives under Experiments. The frontend is React / TypeScript / Vite / Three.js. The public API is `https://jie-tree-api.jiezhao0231.workers.dev`, using `openai/gpt-oss-20b`. Visitors do not need a key or a running local Ollama server. Trees stay in the visitor's browser (IndexedDB, with localStorage fallback); selected concept context is sent to Cloudflare and Groq to generate branches or bridges. No Supabase is used.

The personal-site repository keeps the source in `tools/tree/` and deployable frontend in `tree/`. Its build copies only public files into `_site/`; Worker source, credentials, tests, and dependencies are not copied into that deployment output.

## Develop

```bash
npm ci
npm run dev -- --port 5174 --strictPort
npm test
npm run build
```

`.env.production` contains only the public API address. `VITE_API_BASE_URL` is a build-time public value, never a place for a provider secret. Production builds without a URL show an explicit unavailable-service error rather than trying a visitor's localhost.

To develop the Worker locally, create `.dev.vars` from `.dev.vars.example`, add the Groq key, and start `npm run worker:dev`. Set `VITE_API_BASE_URL=http://localhost:8787` in your local `.env` and restart Vite. Both servers bind to loopback. `.dev.vars` is ignored by Git and denied by Vite; do not serve the source directory with an unrestricted static server.

## Deploy The API

From this project, or `tools/tree/` in the personal-site repository:

```bash
npm ci
npx wrangler login
npm run worker:deploy
npx wrangler secret put GROQ_API_KEY
```

Enter the secret at Wrangler's prompt. It is stored as a Cloudflare Worker secret, not in GitHub or the frontend. To rotate a key, revoke the old one in Groq, then repeat `wrangler secret put GROQ_API_KEY` with the replacement. Never commit `.dev.vars`, dotenv files containing secrets, or a key copied from a chat.

The first deployment creates the SQLite-backed `GenerationBudget` Durable Object. No separate database setup is required. The Worker never falls back to fabricated branches.

## Shared Allowance

Defaults in `wrangler.jsonc`:

- Allowed browser origins: the personal site and local development addresses. Add an exact Cloudflare/custom-domain origin when using another frontend host.
- Visitor limit: six attempts per minute per connecting IP (approximate, datacenter-local).
- Shared limit: four attempts per UTC minute, 100 per UTC day, atomically counted in one Durable Object.
- Payload limit: 16 KiB, plus bounded fields and fixed completion-token limits.

Failed provider requests also consume an attempt. Request counts do not guarantee Groq token allowance: provider limits may be reached earlier and return HTTP 429 with `Retry-After`. Branch and bridge generation share these caps. Edit the config and redeploy to adjust limits; shared counters survive deployments.

CORS is not authentication: scripts can spoof an Origin header. These limits bound abuse but cannot stop a determined visitor from exhausting the daily allowance. No paid plan, Turnstile, or visitor login is enabled.

## Local Ollama Alternative

The Python backend defaults to local Ollama and is optional for the public site:

```bash
ollama serve
ollama pull qwen3:4b
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm run backend
```

Set `VITE_API_BASE_URL=http://localhost:7860` locally. `/health` checks the actual Ollama connection and installed model. Connection failures appear in the inspector; they never silently create demo leaves. GGUF / llama-cpp-python remains supported; see `backend/README.md`.

## API And Tests

- `GET /health`: reports configuration without a model request. `modelVerified: false` means this endpoint does not test key validity.
- `POST /expand-node`: exactly three distinct children and `ghostLeaves: []`; the UI derives two shadows from those candidates.
- `POST /bridge-path`: one to four connected conceptual transitions.
- Generation responses expose `X-Tree-Generation-Source` and `X-Tree-Model`.

`npm test` covers geometry, tip-connected branches, shadow selection, migration, framing, pruning, input validation, CORS, limits, provider failures, and SQLite budget rollover. Worker tests require Node 24 or another version with `node:sqlite`.

Leaf shapes, angles, optional veins, and branches use seeded randomness to stay stable across reloads. Pan, cursor-anchored zoom, pruning, saved leaves, and bridge mode work on desktop and mobile. The inspector stays compact.

## Hosting Notes

Groq's free allowance is shared by the publisher's account, not reserved per visitor. Check [current limits](https://console.groq.com/docs/rate-limits) before increasing caps. Structured output follows [Groq's specification](https://console.groq.com/docs/structured-outputs).

Hugging Face Docker + GGUF is an alternative, not this public deployment. As of October 2026, new Docker/Gradio compute Spaces require a qualifying paid plan; zero hourly CPU pricing does not imply free account eligibility. Check the [Spaces overview](https://huggingface.co/docs/hub/spaces-overview).
