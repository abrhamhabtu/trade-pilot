import test from "node:test";
import assert from "node:assert/strict";
import { parseQuick } from "../src/lib/vision/quick.ts";

const FIRMS = [
  { key: "lucid-pro:lucidpro-50k", firm: "Lucid Trading", size: 50_000 },
  { key: "lucid-pro:lucidpro-100k", firm: "Lucid Trading", size: 100_000 },
  { key: "topstep:topstep-50k", firm: "Topstep", size: 50_000 },
  { key: "apex:apex-50k", firm: "Apex Trader Funding", size: 50_000 },
];

test("the handoff's example line", () => {
  const q = parseQuick("nq 5m orb ny open 1y 50k lucid 2 micros", FIRMS);
  assert.deepEqual(q.patch, { symbol: "NQ", tf: "5m", logic: "vision", reader: "orb", session: "open", contracts: 2, sizing: "fixed", micro: true, days: 365, balance: 50_000, prop: { on: true, program: "lucid-pro:lucidpro-50k" } });
  assert.deepEqual(q.unknown, []);
});

test("a dozen more", () => {
  const p = (s) => parseQuick(s, FIRMS);
  assert.equal(p("gold 15m asia sweep").patch.rules.entry.pattern, "asia_sweep");
  assert.equal(p("gold 15m asia sweep").patch.symbol, "GC");
  assert.equal(p("es orb fail 30d").patch.rules.entry.pattern, "orb_fail", "orb fail is the pattern, not the reader");
  assert.equal(p("es orb fail 30d").patch.days, 30);
  assert.equal(p("es double break vwap london").patch.reader, "dbvwap");
  assert.equal(p("es double break vwap london").patch.session, "london");
  assert.deepEqual([p("nq 2024").patch.from, p("nq 2024").patch.to], ["2024-01-01", "2024-12-31"]);
  assert.deepEqual([p("nq 2023-03").patch.from, p("nq 2023-03").patch.to], ["2023-03-01", "2023-03-31"]);
  assert.equal(p("nq 6m").patch.days, 182);
  assert.equal(p("nq 5y").patch.days, 1825);
  assert.equal(p("nq all").patch.days, 0);
  assert.equal(p("mnq squeeze").patch.micro, true);
  assert.equal(p("es 1 mini sd").patch.micro, false);
  assert.equal(p("es 1 mini sd").patch.reader, "sd");
  assert.equal(p("nq longs only be 1r max 2/day").patch.side, "long");
  assert.equal(p("nq longs only be 1r max 2/day").patch.breakEvenR, 1);
  assert.equal(p("nq longs only be 1r max 2/day").patch.maxPerDay, 2);
  assert.equal(p("nq 100k lucid").patch.prop.program, "lucid-pro:lucidpro-100k", "firm at the size named");
  assert.equal(p("nq 1h topstep").patch.tf, "1h");
  assert.equal(p("nq 1h topstep").patch.prop.program, "topstep:topstep-50k");
});

test("plain words become your rules, and words that change nothing are listed", () => {
  const q = parseQuick("nq 5m break and retest of the prior day's high, stop 1.5x atr, 2:1", FIRMS);
  assert.equal(q.patch.logic, "custom");
  assert.equal(q.patch.rules.entry.kind, "pdhl_retest");
  const odd = parseQuick("nq 5m flibbertigibbet", FIRMS);
  assert.deepEqual(odd.unknown, ["flibbertigibbet"]);
  assert.equal(odd.patch.symbol, "NQ");
});
