import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { PROVIDERS } from "../src/lib/pilot/models.ts";
import { readDelta, toOpenAIMessages } from "../src/lib/pilot/openaiStream.ts";
import { toClaudeMessages, claudeOptions } from "../src/lib/pilot/claude.ts";
import { runPilotTool, validateToolInput } from "../src/lib/pilot/tools.ts";
import { PILOT_TOOLS } from "../src/lib/pilot/toolDefs.ts";
import { buildFactSheet } from "../src/lib/pilot/facts.ts";
import { buildDemoAccounts } from "../src/lib/demo/demoData.ts";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/app/api/pilot/chat/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", compiled)((n) => (n === "@/lib/pilot/models" ? { PROVIDERS } : require(n)), mod, mod.exports);
const post = mod.exports.POST;
const req = (body) =>
  new Request("http://localhost:4040/api/pilot/chat", {
    method: "POST",
    headers: { origin: "http://localhost:4040", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const readEvents = async (res) => (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
const sse = (...payloads) =>
  new Response(new ReadableStream({
    start(c) {
      for (const p of payloads) c.enqueue(new TextEncoder().encode(`data: ${typeof p === "string" ? p : JSON.stringify(p)}\n\n`));
      c.close();
    },
  }), { status: 200 });

const base = { provider: "openrouter", model: "m", apiKey: "k", stream: true, context: { facts: 1 } };

test("streams text and assembles tool calls split across chunks", async (t) => {
  let sent;
  t.mock.method(globalThis, "fetch", async (url, opts) => {
    sent = JSON.parse(opts.body);
    return sse(
      { choices: [{ delta: { content: "Checking " } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "find_", arguments: '{"setup":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "trades", arguments: '"ORB"}' } }] }, finish_reason: "tool_calls" }] },
      "[DONE]",
    );
  });
  const events = await readEvents(await post(req({ ...base, messages: [{ role: "user", content: "ORB?" }] })));
  assert.deepEqual(events[0], { t: "text", v: "Checking " });
  assert.deepEqual(events.at(-1), { t: "done", stop: "tool_use", toolCalls: [{ id: "c1", name: "find_trades", input: { setup: "ORB" } }] });
  assert.equal(sent.stream, true);
  assert.ok(sent.tools.some((x) => x.function.name === "session_detail"));
});

test("a model that rejects tools is retried without them", async (t) => {
  const bodies = [];
  t.mock.method(globalThis, "fetch", async (_u, opts) => {
    bodies.push(JSON.parse(opts.body));
    return bodies.length === 1 ? new Response("no tools", { status: 400 }) : sse({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] });
  });
  const events = await readEvents(await post(req({ ...base, messages: [{ role: "user", content: "hi" }] })));
  assert.equal(bodies.length, 2);
  assert.equal("tools" in bodies[1], false);
  assert.equal(events.at(-1).t, "done");
});

test("rejects tool turns naming unknown tools, and bad Claude requests before any network call", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("must not call upstream"); });
  const bad = [{ role: "user", content: "x" }, { role: "assistant", content: "", toolCalls: [{ id: "1", name: "place_order", input: {} }] }];
  assert.equal((await post(req({ ...base, messages: bad }))).status, 400);
  assert.equal((await post(req({ ...base, provider: "anthropic", apiKey: "", messages: [{ role: "user", content: "x" }] }))).status, 400);
});

test("OpenAI shape: tool calls and results round-trip", () => {
  const m = toOpenAIMessages("sys", [
    { role: "user", content: "q" },
    { role: "assistant", content: "", toolCalls: [{ id: "a", name: "ledger_detail", input: {} }] },
    { role: "tool", toolCallId: "a", name: "ledger_detail", content: "{}" },
  ]);
  assert.equal(m[2].tool_calls[0].function.arguments, "{}");
  assert.deepEqual(m[3], { role: "tool", tool_call_id: "a", content: "{}" });
  assert.equal(readDelta({ choices: [{ delta: { reasoning_content: "…" } }] }, new Map()).thinking, true);
});

test("Claude shape: raw turns echo verbatim and parallel results share one user message", () => {
  const raw = [{ type: "thinking", thinking: "", signature: "sig" }, { type: "tool_use", id: "t1", name: "ledger_detail", input: {} }, { type: "tool_use", id: "t2", name: "payout_status", input: {} }];
  const m = toClaudeMessages([
    { role: "user", content: "q" },
    { role: "assistant", content: "", toolCalls: [], raw, provider: "anthropic" },
    { role: "tool", toolCallId: "t1", name: "ledger_detail", content: "{}" },
    { role: "tool", toolCallId: "t2", name: "payout_status", content: "bad", isError: true },
  ]);
  assert.equal(m[1].content, raw);
  assert.equal(m.length, 3);
  assert.deepEqual(m[2].content.map((b) => [b.tool_use_id, b.is_error]), [["t1", undefined], ["t2", true]]);
  // Another provider's turn is rebuilt from text and calls, never echoed raw.
  const other = toClaudeMessages([{ role: "user", content: "q" }, { role: "assistant", content: "hi", raw: [{ type: "x" }], provider: "openrouter" }]);
  assert.deepEqual(other[1].content, [{ type: "text", text: "hi" }]);
});

test("Claude options: adaptive thinking and fallbacks only where supported", () => {
  assert.deepEqual(claudeOptions("claude-opus-5"), { thinking: { type: "adaptive" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  assert.deepEqual(claudeOptions("claude-sonnet-5"), { thinking: { type: "adaptive" } });
  assert.deepEqual(claudeOptions("claude-haiku-4-5"), {});
});

const demo = buildDemoAccounts();
const ctx = { account: demo[0], accounts: demo, today: "2026-09-10" };

test("lookups validate input before running", () => {
  const find = PILOT_TOOLS.find((t) => t.name === "find_trades");
  assert.equal(validateToolInput(find, { limit: 99 }), '"limit" must be at most 30.');
  assert.equal(validateToolInput(find, { rm: "-rf" }), 'Unknown field "rm".');
  assert.equal(runPilotTool("find_trades", { from: "yesterday" }, ctx).isError, true);
  assert.equal(runPilotTool("delete_account", {}, ctx).isError, true);
});

test("lookups answer from the journal", () => {
  const wins = JSON.parse(runPilotTool("find_trades", { result: "win", limit: 3 }, ctx).content);
  assert.equal(wins.trades.length, 3);
  assert.ok(wins.trades.every((t) => t.netPL > 0));
  const day = JSON.parse(runPilotTool("session_detail", { date: "2026-07-15", account_id: "demo-blown" }, ctx).content);
  assert.equal(day.trades.at(-1).runningPnL, day.net);
  const odds = JSON.parse(runPilotTool("simulate_pass_odds", { firm_id: "topstep", tier_id: "topstep-50k", risk_scale: 0.5 }, ctx).content);
  assert.ok(odds.passPct >= 0 && odds.passPct <= 100);
  assert.ok(Array.isArray(JSON.parse(runPilotTool("payout_status", {}, ctx).content)));
});

test("fact sheet carries the computed numbers and stays compact", () => {
  const facts = buildFactSheet({ ...ctx, plan: { maxProfit: 1 }, notes: ["Tilts after 11am"] });
  assert.equal(facts.account.name, "Topstep 50K Funded");
  assert.equal(typeof facts.risk.roomToLose, "number");
  assert.ok(["ready", "waiting", "held", "maxed"].includes(facts.payout.status));
  assert.ok(facts.allAccounts.ledger.feesPaid > 0);
  assert.deepEqual(facts.traderNotes, ["Tilts after 11am"]);
  assert.ok(JSON.stringify(facts).length < 30000);
});
