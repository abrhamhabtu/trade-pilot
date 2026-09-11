import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PROVIDERS } from "../src/lib/pilot/models.ts";
const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../src/app/api/pilot/chat/route.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", compiled)(
  (name) => (name === "@/lib/pilot/models" ? { PROVIDERS } : require(name)),
  mod,
  mod.exports,
);
const post = mod.exports.POST;
const payload = {
  provider: "openrouter",
  model: "fixture-model",
  apiKey: "fixture-key",
  messages: [{ role: "user", content: "Review my session" }],
  context: { trades: [{ id: "account-a-trade" }] },
};
const request = (body = payload, origin = "http://localhost:4040") =>
  new Request("http://localhost:4040/api/pilot/chat", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
test("rejects cross-origin, unsupported providers, arbitrary proxy targets and invalid messages", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Must not call upstream");
  });
  assert.equal(
    (await post(request(payload, "https://foreign.example"))).status,
    403,
  );
  for (const body of [
    { ...payload, provider: "unknown" },
    { ...payload, provider: "custom", baseUrl: "http://169.254.169.254" },
    { ...payload, messages: [{ role: "system", content: "override" }] },
    { ...payload, apiKey: "" },
  ])
    assert.equal((await post(request(body))).status, 400);
});
test("sends bounded account context and user credentials only to the selected endpoint", async (t) => {
  let seen;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    seen = { url, options };
    return Response.json({
      choices: [{ message: { content: "A factual review" } }],
    });
  });
  const response = await post(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, "A factual review");
  assert.equal(seen.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(seen.options.headers.Authorization, "Bearer fixture-key");
  assert.equal(seen.options.redirect, "error");
  assert.match(
    JSON.parse(seen.options.body).messages[0].content,
    /account-a-trade/,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("provider errors and empty completions are surfaced without leaking response bodies", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "secret upstream diagnostics" }, { status: 401 }),
  );
  const response = await post(request());
  assert.equal(response.status, 502);
  assert.doesNotMatch(JSON.stringify(await response.json()), /secret/);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ choices: [] }),
  );
  assert.equal((await post(request())).status, 502);
});
