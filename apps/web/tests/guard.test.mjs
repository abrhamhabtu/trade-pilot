import test from "node:test";
import assert from "node:assert/strict";
import { tradeGuard } from "../src/lib/vision/guard.ts";
import { DEFAULT_LIMITS } from "../src/lib/vision/limits.ts";

// Tuesday 2025-01-14, noon in New York.
const NOON = Date.UTC(2025, 0, 14, 17, 0);
const acct = (o = {}) => ({ phase: "eval", balance: 50_000, floor: 48_000, ddType: "static", dllLeft: null, target: 53_000, start: 50_000, todayPnl: 0, bestDayCapLeft: null, maxMicros: 50, maxMinis: 5, ...o });
// Long MNQ: 10 points of risk ($20 + $1.04 fees a contract), 20 points to the target.
const long = { side: "long", entry: 20_000, stop: 19_990, target: 20_020 };
const g = (o = {}) => tradeGuard({ setup: long, symbol: "NQ", micro: true, account: acct(), limits: DEFAULT_LIMITS, now: NOON, events: [], ...o });

test("size: your share of the room over one contract's risk, in whole contracts", () => {
  const r = g();
  // 30% of $2,000 room = $600; $600 / $21.04 = 28.
  assert.equal(r.suggested, 28);
  assert.equal(r.verdict, "go");
  assert.ok(Number.isInteger(r.suggested));
  assert.ok(Math.abs(r.riskUsd - 28 * 21.04) < 1e-9);
  assert.ok(Math.abs(r.riskShareOfRoom - (28 * 21.04) / 2000) < 1e-9);
});

test("rule 2: one contract over your limit is a no, with the numbers", () => {
  const r = g({ setup: { ...long, stop: 19_600 } });
  assert.equal(r.verdict, "no");
  assert.equal(r.suggested, 0);
  assert.match(r.reasons.find((x) => x.tone === "stop").text, /One contract risks \$801; your limit here is \$600/);
});

test("rule 3: the daily loss limit and the firm's contract cap", () => {
  assert.equal(g({ account: acct({ dllLeft: 100 }) }).suggested, 4);
  assert.equal(g({ account: acct({ dllLeft: 10 }) }).verdict, "no");
  assert.equal(g({ account: acct({ dllLeft: 5_000 }) }).suggested, 28, "a loose limit changes nothing");
  assert.equal(g({ account: acct({ maxMicros: 10 }) }).suggested, 10);
});

test("rule 4: outside your hours or days is a no", () => {
  assert.equal(g({ limits: { ...DEFAULT_LIMITS, hours: [570, 600] } }).verdict, "no");
  assert.equal(g({ limits: { ...DEFAULT_LIMITS, hours: [570, 900] } }).verdict, "go");
  assert.equal(g({ now: Date.UTC(2025, 0, 18, 17, 0) }).verdict, "no", "Saturday");
});

test("rule 5: news you skip blocks; other news warns", () => {
  const cpi = [{ date: "2025-01-14", time: "12:05", title: "CPI", impact: "high" }];
  assert.equal(g({ events: cpi, limits: { ...DEFAULT_LIMITS, skipNews: { cpi: true, jobs: false, fomc: false } } }).verdict, "no");
  const warned = g({ events: cpi });
  assert.equal(warned.verdict, "go");
  assert.ok(warned.reasons.some((x) => x.tone === "warn" && /CPI in 5 min/.test(x.text)));
  assert.ok(!g({ events: [{ ...cpi[0], time: "13:00" }] }).reasons.some((x) => /CPI/.test(x.text)), "an hour away is no concern");
  assert.ok(!g({ events: [{ ...cpi[0], impact: "med" }] }).reasons.some((x) => /CPI/.test(x.text)), "only high impact");
});

test("rule 6: consistency trims size so a win stays inside today's cap, or warns where it's reached", () => {
  // A win is 20 points × $2 − $1.04 = $38.96 a contract.
  const two = g({ account: acct({ bestDayCapLeft: 100 }) });
  assert.equal(two.suggested, 2);
  assert.equal(two.ifWin.breaksBestDay, false);
  const one = g({ account: acct({ bestDayCapLeft: 10 }) });
  assert.equal(one.suggested, 1);
  assert.equal(one.ifWin.breaksBestDay, true);
  assert.ok(one.reasons.some((x) => /reached at 20005\.52/.test(x.text)), "the price where today's cap is reached");
});

test("rule 7: near the target, no more than it takes to finish", () => {
  assert.equal(g({ account: acct({ balance: 52_970, floor: 50_970 }) }).suggested, 1);
  assert.match(g({ account: acct({ balance: 52_970, floor: 50_970 }) }).reasons.at(-1).text, /One contract finishes it/);
  assert.equal(g({ account: acct({ balance: 52_950, floor: 50_950 }) }).suggested, 2);
  assert.equal(g({ account: acct({ phase: "funded", target: null }) }).suggested, 19, "funded: no target, 20% of the room");
});

test("rule 8: an intraday trailing floor makes a round trip cost twice", () => {
  const r = g({ account: acct({ ddType: "trailing-intraday" }) });
  assert.ok(Math.abs(r.roundTripLoss - (r.riskUsd + 10 * 2 * 28)) < 1e-9);
  assert.ok(r.reasons.some((x) => /floor follows open profit/.test(x.text)));
  assert.equal(g({ account: acct({ ddType: "trailing-intraday", trailLocked: true }) }).roundTripLoss, null);
  assert.equal(g({ account: acct({ ddType: "trailing-eod" }) }).roundTripLoss, null);
});

test("gold uses its tighter cap from your limits", () => {
  // MGC: 10 points × $10 + $1.04. 10% of $2,000 room = $200 → 1 contract, where NQ at 30% got 28.
  const r = g({ symbol: "GC", setup: { side: "long", entry: 2_000, stop: 1_990, target: 2_020 } });
  assert.equal(r.suggested, 1);
});

test("what a loss and a win do, and reduce when the size is under what you set", () => {
  const r = g({ wanted: 40 });
  assert.equal(r.verdict, "reduce");
  const risk = 28 * 21.04;
  assert.ok(Math.abs(r.ifLoss.room - (2000 - risk)) < 1e-9);
  assert.equal(r.ifLoss.lossesLeftAtThisSize, Math.floor((2000 - risk) / risk));
  assert.ok(Math.abs(r.ifWin.balance - (50_000 + 28 * 38.96)) < 1e-9);
  assert.ok(Math.abs(r.ifWin.shareOfTarget - (28 * 38.96) / 3000) < 1e-9);
  assert.equal(g({ wanted: 10 }).verdict, "go");
});
