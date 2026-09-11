import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { projectXTrades } from "../src/lib/projectx.ts";
import { tradovateTrades } from "../src/lib/tradovate.ts";
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");

// Execute actual route code with only external provider fetches mocked.
function route(provider) {
  const source = readFileSync(
    new URL(`../src/app/api/connections/${provider}/route.ts`, import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  const resolve = (name) =>
    name === "@/lib/projectx"
      ? { projectXTrades }
      : name === "@/lib/tradovate"
        ? { tradovateTrades }
        : require(name);
  new Function("require", "module", "exports", compiled)(
    resolve,
    module,
    module.exports,
  );
  return module.exports.POST;
}
function request(provider, body, extra = {}) {
  return new NextRequest(`http://localhost:4040/api/connections/${provider}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:4040",
      "content-type": "application/json",
      ...extra,
    },
    body: JSON.stringify(body),
  });
}
test("both connectors reject foreign origins without contacting a provider", async () => {
  for (const provider of ["projectx", "tradovate"])
    assert.equal(
      (
        await route(provider)(
          request(
            provider,
            { action: "accounts" },
            { origin: "https://untrusted.example" },
          ),
        )
      ).status,
      403,
    );
});
test("disconnection clears the scoped cookie and unauthenticated reads fail", async () => {
  for (const provider of ["projectx", "tradovate"]) {
    const post = route(provider);
    assert.equal(
      (await post(request(provider, { action: "accounts" }))).status,
      401,
    );
    const disconnected = await post(
      request(provider, { action: "disconnect" }),
    );
    assert.match(
      disconnected.headers.get("set-cookie"),
      new RegExp(`Path=/api/connections/${provider}`),
    );
    assert.match(disconnected.headers.get("set-cookie"), /Max-Age=0/);
  }
});
test("Topstep login keeps tokens out of JSON and only calls auth/account reads", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push(url);
    return Response.json(
      url.endsWith("/Auth/loginKey")
        ? { success: true, token: "fixture-session" }
        : { success: true, accounts: [{ id: 42, name: "Fixture" }] },
    );
  });
  const response = await route("projectx")(
    request("projectx", {
      action: "connect",
      userName: "fixture",
      apiKey: "fixture-key",
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    accounts: [{ id: 42, name: "Fixture" }],
  });
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=strict/);
  assert.deepEqual(
    calls.map((u) => new URL(u).pathname),
    ["/api/Auth/loginKey", "/api/Account/search"],
  );
});
test("Tradovate login uses selected environment and does not expose credentials", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, method: options.method });
    return Response.json(
      url.endsWith("/auth/accesstokenrequest")
        ? { accessToken: "fixture-session" }
        : [{ id: 42, name: "Fixture" }],
    );
  });
  const response = await route("tradovate")(
    request("tradovate", {
      action: "connect",
      environment: "demo",
      name: "fixture",
      password: "fixture-password",
      appId: "fixture-app",
      cid: 1,
      sec: "fixture-secret",
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    accounts: [{ id: 42, name: "Fixture" }],
  });
  assert.ok(
    calls.every((c) => new URL(c.url).hostname === "demo.tradovateapi.com"),
  );
  assert.deepEqual(
    calls.map((c) => c.method),
    ["POST", "GET"],
  );
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
});
