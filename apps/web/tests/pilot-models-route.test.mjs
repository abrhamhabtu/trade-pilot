import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PROVIDERS } from "../src/lib/pilot/models.ts";
const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../src/app/api/pilot/models/route.ts", import.meta.url),
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
  provider: "deepseek",
  apiKey: "fixture-key",
};
const request = (body = payload, origin = "http://localhost:4040") =>
  new Request("http://localhost:4040/api/pilot/models", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("lists the models a key can reach, sorted and deduplicated", async (t) => {
  let seen;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    seen = { url, options };
    return Response.json({
      data: [{ id: "deepseek-reasoner" }, { id: "deepseek-chat" }, { id: "deepseek-chat" }],
    });
  });
  const response = await post(request());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).models, [
    "deepseek-chat",
    "deepseek-reasoner",
  ]);
  assert.equal(seen.url, "https://api.deepseek.com/models");
  assert.equal(seen.options.method, "GET");
  assert.equal(seen.options.headers.Authorization, "Bearer fixture-key");
  assert.equal(seen.options.redirect, "error");
});

test("rejects cross-origin callers, unusable providers and keyless remote providers", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Must not call upstream");
  });
  assert.equal(
    (await post(request(payload, "https://foreign.example"))).status,
    403,
  );
  for (const body of [
    { ...payload, provider: "local" },
    { ...payload, provider: "unknown" },
    { ...payload, provider: "custom", baseUrl: "http://169.254.169.254" },
    { ...payload, apiKey: "" },
  ])
    assert.equal((await post(request(body))).status, 400);
});

test("provider failures are surfaced without leaking the upstream body", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "secret upstream diagnostics" }, { status: 401 }),
  );
  const response = await post(request());
  assert.equal(response.status, 502);
  assert.doesNotMatch(JSON.stringify(await response.json()), /secret/);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: [] }));
  assert.equal((await post(request())).status, 502);
});
