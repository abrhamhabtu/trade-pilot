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
test("accepts the host the request arrived on, not the host in request.url", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ choices: [{ message: { content: "ok" } }] }),
  );
  // The Next dev server reports request.url as localhost whatever Host the
  // browser used, so an app opened on 127.0.0.1 must not reject its own calls.
  const onHost = (origin, host) =>
    new Request("http://localhost:4040/api/pilot/chat", {
      method: "POST",
      headers: { origin, host, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  assert.equal(
    (await post(onHost("http://127.0.0.1:4040", "127.0.0.1:4040"))).status,
    200,
  );
  assert.equal(
    (await post(onHost("https://evil.example", "127.0.0.1:4040"))).status,
    403,
  );
  assert.equal((await post(onHost("", "127.0.0.1:4040"))).status, 403);
});
test("reads completions whatever shape the provider returns", async (t) => {
  const textFor = async (message) => {
    t.mock.restoreAll();
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ choices: [{ message }] }),
    );
    const response = await post(request());
    return response.status === 200
      ? (await response.json()).text
      : (await response.json()).error;
  };
  assert.equal(await textFor({ content: "plain string" }), "plain string");
  assert.equal(
    await textFor({ content: [{ text: "part one " }, { text: "part two" }] }),
    "part one part two",
  );
  // A filled scratchpad with no answer is a failure, not an answer: the
  // trader must never be shown the model thinking out loud.
  const scratchpadOnly = await textFor({
    content: "",
    reasoning_content: "We need answer user asks. Let us enumerate trades.",
  });
  assert.doesNotMatch(scratchpadOnly, /enumerate/);
  assert.match(scratchpadOnly, /never wrote an answer/);
});

test("no token cap is imposed on the provider", async (t) => {
  let sent;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    sent = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: "ok" } }] });
  });
  await post(request());
  // A cap we invent truncates thinking models into an empty answer; the
  // provider's own default is the only one that knows the right size.
  assert.equal("max_tokens" in sent, false);
});

test("an answer truncated by the token budget says so instead of blaming the model", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      choices: [{ message: { content: "" }, finish_reason: "length" }],
    }),
  );
  const response = await post(request());
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /output budget/);
});
