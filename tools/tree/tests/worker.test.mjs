import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { DatabaseSync } from "node:sqlite";

let server, worker, GenerationBudget;
const originalFetch = globalThis.fetch;
const origin = "https://jiezhao2002.github.io";
const contract = { seedTopic: "World models", branchWidth: 3, ghostLeafLimit: 2, abstractionLevel: "balanced" };
const body = { contract, nodePacket: {
  title: "World models", summaryShort: "", parentTitle: null, siblingTitles: [], existingChildTitles: [],
} };
const output = { children: ["Predictive coding", "Object permanence", "Latent dynamics"].map((title) => ({
  title, summaryShort: "A specific related concept.", relationType: "mechanism",
})), ghostLeaves: [] };

before(async () => {
  server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), configFile: false,
    logLevel: "silent", server: { middlewareMode: true, hmr: false, watch: null } });
  const module = await server.ssrLoadModule("/worker/index.ts");
  worker = module.default;
  GenerationBudget = module.GenerationBudget;
});
after(async () => { globalThis.fetch = originalFetch; await server?.close(); });

function environment(overrides = {}) {
  return { GROQ_API_KEY: "fake-test-key", GROQ_MODEL: "openai/gpt-oss-20b", ALLOWED_ORIGINS: origin,
    DAILY_REQUEST_LIMIT: "100", GLOBAL_MINUTE_LIMIT: "4",
    VISITOR_RATE_LIMITER: { limit: async () => ({ success: true }) },
    BUDGET: { idFromName: () => "budget", get: () => ({ fetch: async () => Response.json({ ok: true }) }) },
    ...overrides };
}
function request(data = body, extra = {}) {
  return new Request("https://worker/expand-node", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...extra }, body: JSON.stringify(data) });
}
function mockModel(data = output, status = 200, finish = "stop") {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    const payload = JSON.parse(options.body);
    assert.equal(payload.response_format.json_schema.strict, true);
    assert.equal(payload.messages.length, 2);
    return status === 200 ? Response.json({ choices: [{ finish_reason: finish, message: { content: JSON.stringify(data) } }] })
      : Response.json({ error: "secret-test-key must never be exposed" }, { status, headers: { "Retry-After": "42" } });
  };
}

test("returns three model candidates and exposes model provenance without secrets", async () => {
  mockModel();
  const response = await worker.fetch(request(), environment());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("X-Tree-Generation-Source"), "groq");
  assert.deepEqual(await response.json(), output);
});

test("rejects unapproved or missing origins and malformed requests before model calls", async () => {
  globalThis.fetch = () => { throw new Error("Must not call model"); };
  for (const headers of [{ Origin: "https://attacker.example" }, { Origin: "" }]) {
    assert.equal((await worker.fetch(request(body, headers), environment())).status, 403);
  }
  assert.equal((await worker.fetch(request({ ...body, contract: { ...contract, branchWidth: 10 } }), environment())).status, 400);
  assert.equal((await worker.fetch(request({ ...body, nodePacket: { ...body.nodePacket, title: "x".repeat(181) } }), environment())).status, 400);
  assert.equal((await worker.fetch(request(body, { "Content-Type": "text/plain" }), environment())).status, 415);
  assert.equal((await worker.fetch(request({ huge: "x".repeat(20_000) }), environment())).status, 413);
  assert.equal((await worker.fetch(new Request("https://worker/health", { method: "POST", headers: { Origin: origin } }), environment())).status, 405);
});

test("preflight is narrowly scoped and missing configuration is honest", async () => {
  const response = await worker.fetch(new Request("https://worker/expand-node", { method: "OPTIONS", headers: {
    Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type",
  } }), environment());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  const health = await worker.fetch(new Request("https://worker/health"), environment({ GROQ_API_KEY: undefined }));
  assert.equal(health.status, 503);
  assert.equal((await health.json()).modelVerified, false);
  assert.equal((await worker.fetch(request(), environment({ GROQ_API_KEY: undefined }))).status, 503);
});

test("visitor and shared limits prevent upstream inference", async () => {
  globalThis.fetch = () => { throw new Error("Must not call model"); };
  const response = await worker.fetch(request(), environment({ VISITOR_RATE_LIMITER: { limit: async () => ({ success: false }) } }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  const limited = await worker.fetch(request(), environment({ BUDGET: { idFromName: () => "budget", get: () => ({
    fetch: async () => Response.json({ detail: "Daily allowance reached" }, { status: 429, headers: { "Retry-After": "3600" } }),
  }) } }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "3600");
});

test("provider errors, truncation and invalid output never become fake branches", async () => {
  for (const [status, expected] of [[401, 503], [403, 503], [429, 429], [500, 502]]) {
    mockModel(output, status);
    const response = await worker.fetch(request(), environment());
    assert.equal(response.status, expected);
    assert(!JSON.stringify(await response.json()).includes("secret-test-key"));
  }
  for (const invalid of [{ ...output, children: output.children.slice(0, 2) }, { ...output, children: [output.children[0], output.children[0], output.children[2]] }, { ...output, ghostLeaves: [{ title: "extra" }] }]) {
    mockModel(invalid);
    assert.equal((await worker.fetch(request(), environment())).status, 502);
  }
  mockModel(output, 200, "length");
  assert.equal((await worker.fetch(request(), environment())).status, 502);
});

test("bridges must be bounded and connected from source to target", async () => {
  const data = { contract, sourceTitle: "World models", targetTitle: "Robotics", sourceSummaryShort: "", targetSummaryShort: "", maxBricks: 4 };
  const bridge = { turningBricks: [{ title: "Model-based control", fromTitle: "World models", toTitle: "Robotics", explanation: "Prediction guides action.", relationType: "application" }] };
  const makeRequest = (value) => new Request("https://worker/bridge-path", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(value) });
  mockModel(bridge);
  assert.deepEqual(await (await worker.fetch(makeRequest(data), environment())).json(), bridge);
  assert.equal((await worker.fetch(makeRequest({ ...data, maxBricks: 8 }), environment())).status, 400);
  mockModel({ turningBricks: [{ ...bridge.turningBricks[0], toTitle: "Wrong endpoint" }] });
  assert.equal((await worker.fetch(makeRequest(data), environment())).status, 502);
});

test("SQLite budget atomically enforces global minute and UTC daily limits across instances", async () => {
  const db = new DatabaseSync(":memory:");
  const storage = {
    sql: { exec(sql, ...params) {
      const statement = db.prepare(sql);
      if (sql.startsWith("SELECT")) return { toArray: () => statement.all(...params) };
      statement.run(...params);
      return { toArray: () => [] };
    } },
    transactionSync(callback) { db.exec("BEGIN"); try { const result = callback(); db.exec("COMMIT"); return result; } catch (error) { db.exec("ROLLBACK"); throw error; } },
  };
  const now = Date.now;
  let time = Date.parse("2026-10-04T12:00:00Z");
  Date.now = () => time;
  try {
    const env = environment({ DAILY_REQUEST_LIMIT: "3", GLOBAL_MINUTE_LIMIT: "2" });
    const first = new GenerationBudget({ storage }, env), second = new GenerationBudget({ storage }, env);
    assert.equal((await first.fetch()).status, 200);
    assert.equal((await second.fetch()).status, 200);
    assert.equal((await first.fetch()).status, 429);
    time += 60_000;
    assert.equal((await second.fetch()).status, 200);
    const exhausted = await first.fetch();
    assert.equal(exhausted.status, 429);
    assert.match((await exhausted.json()).detail, /Today's/);
    time += 86_400_000;
    assert.equal((await first.fetch()).status, 200);
  } finally { Date.now = now; db.close(); }
});
