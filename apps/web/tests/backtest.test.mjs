import test from "node:test";
import assert from "node:assert/strict";
import { runBacktest, tradesCsv } from "../src/lib/vision/backtest.ts";
import { buildDemo } from "../src/lib/vision/demo.ts";
import { sessionOf } from "../src/lib/pilot/market.ts";

const NONE = { fomc: [], early: [], vix: {} };
const base = { reader: "auto", anchor: "utc", side: "both", pointValue: 2, contracts: 1, commission: 0, slippageTicks: 0, tick: 0.25, maxHold: 60, skipFomc: false, skipEarly: false, vix: "any", context: NONE };

// A few staged sessions back to back: enough setups to test the fill rules on.
function sample() {
  const bars = [];
  for (const [k, reader] of ["sweep", "dbvwap", "sd", "sweep", "vwappb"].entries()) {
    const d = buildDemo({ reader, win: k % 2 === 0, price: 20000, tfSeconds: 300, anchor: "utc", seed: 11 + k });
    assert.ok(d, `demo for ${reader}`);
    const shift = bars.length ? bars.at(-1).t + 300 - d.bars[0].t : 0;
    const off = bars.length ? bars.at(-1).c - d.bars[0].o : 0;
    for (const b of d.bars) bars.push({ t: b.t + shift, o: b.o + off, h: b.h + off, l: b.l + off, c: b.c + off, v: b.v });
  }
  return bars;
}

test("a backtest takes one trade at a time, on whole ticks, entering at the signal close", () => {
  const bars = sample();
  const r = runBacktest(bars, { ...base, slippageTicks: 1 });
  assert.ok(r.trades.length >= 3, `trades: ${r.trades.length}`);
  for (const [k, t] of r.trades.entries()) {
    assert.ok(Math.abs(t.stop / 0.25 - Math.round(t.stop / 0.25)) < 1e-9, "stop on a tick");
    assert.ok(Math.abs(t.target / 0.25 - Math.round(t.target / 0.25)) < 1e-9, "target on a tick");
    const dir = t.side === "long" ? 1 : -1;
    assert.equal(t.entry, bars[t.entryIndex].c + dir * 0.25);
    if (k) assert.ok(t.entryIndex > r.trades[k - 1].exitIndex, "no overlapping trades");
    if (t.outcome === "target") assert.equal(t.exit, t.target);
    if (t.outcome === "stop") assert.equal(t.exit, t.stop - dir * 0.25);
  }
  assert.equal(tradesCsv(r).split("\n").length, r.trades.length + 1);
});

test("the stop wins a bar that touches both", () => {
  const bars = sample();
  const first = runBacktest(bars, base).trades[0];
  const k = first.entryIndex + 1;
  bars[k] = { ...bars[k], h: Math.max(first.stop, first.target) + 1, l: Math.min(first.stop, first.target) - 1 };
  const t = runBacktest(bars, base).trades[0];
  assert.equal(t.outcome, "stop");
  assert.equal(t.exitIndex, k);
});

test("sizing by risk loses the risk amount at the stop", () => {
  const r = runBacktest(sample(), { ...base, pointValue: 1, riskDollars: 250, commission: 1 });
  const stops = r.trades.filter((t) => t.outcome === "stop");
  assert.ok(stops.length > 0);
  for (const t of stops) assert.ok(Math.abs(t.pnl + 251) < 1e-6, `pnl ${t.pnl}`);
});

test("entry hours and direction filters skip what they should", () => {
  const bars = sample();
  const all = runBacktest(bars, base);
  const hours = [600, 720];
  const r = runBacktest(bars, { ...base, hours });
  for (const t of r.trades) {
    const m = sessionOf(t.entryT).minute;
    assert.ok(m >= hours[0] && m < hours[1]);
  }
  assert.ok(r.trades.length < all.trades.length || all.trades.every((t) => sessionOf(t.entryT).minute >= 600 && sessionOf(t.entryT).minute < 720));
  const longs = runBacktest(bars, { ...base, side: "long" });
  assert.ok(longs.trades.every((t) => t.side === "long"));
});

test("stats add up", () => {
  const r = runBacktest(sample(), base);
  const s = r.stats;
  assert.equal(s.wins + s.losses, s.trades);
  assert.ok(Math.abs(s.pnl - r.trades.reduce((a, t) => a + t.pnl, 0)) < 1e-6);
  assert.ok(Math.abs(r.equity.at(-1).pnl - s.pnl) < 1e-6);
  assert.equal(r.by.side.reduce((a, g) => a + g.n, 0), s.trades);
});

test("plain English becomes the rules it says", async () => {
  const { parseRules, TEMPLATES } = await import("../src/lib/vision/custom.ts");
  const a = parseRules(TEMPLATES[0].text).rules;
  assert.equal(a.entry.kind, "pdhl_retest");
  assert.deepEqual(a.stop, { kind: "atr", mult: 1.5, len: 14 });
  assert.deepEqual(a.target, { kind: "r", r: 2 });
  const b = parseRules("Long when price crosses above VWAP while above the 200 EMA. Stop 1x ATR. Take profit 2:1. Max 2 trades per day.").rules;
  assert.equal(b.entry.kind, "vwap_cross");
  assert.equal(b.trend, "ema200");
  assert.equal(b.maxPerDay, 2);
  const c = parseRules("Opening range breakout on the first 30 minutes. Longs only. Stop 20 points, take profit 40 points. Break even at 1R. London").rules;
  assert.deepEqual(c.entry, { kind: "orb", minutes: 30 });
  assert.equal(c.side, "long");
  assert.deepEqual(c.stop, { kind: "points", pts: 20 });
  assert.deepEqual(c.target, { kind: "points", pts: 40 });
  assert.equal(c.breakEvenR, 1);
  assert.equal(c.session, "london");
  const d = parseRules("Use my double-break VWAP strategy with its own stop and target.").rules;
  assert.deepEqual(d.entry, { kind: "reader", reader: "dbvwap" });
  assert.equal(d.stop.kind, "plan");
  assert.ok(parseRules("I like coffee. EMA 9/21 cross.").unknown.includes("I like coffee."));
});

test("custom rules run and honour their stop, target and daily limit", async () => {
  const { parseRules } = await import("../src/lib/vision/custom.ts");
  const bars = sample();
  const rules = parseRules("Long when the 9 EMA crosses above the 21 EMA, short below. Stop 8 points. Take profit 3:1. One trade per day.").rules;
  const r = runBacktest(bars, { ...base, custom: rules, maxPerDay: rules.maxPerDay });
  assert.ok(r.trades.length > 0);
  const days = new Map();
  for (const t of r.trades) {
    assert.equal(t.reader, "custom");
    assert.ok(Math.abs(Math.abs(bars[t.entryIndex].c - t.stop) - 8) < 0.26);
    days.set(t.session, (days.get(t.session) ?? 0) + 1);
  }
  assert.ok([...days.values()].every((n) => n === 1));
});

test("break-even turns would-be losers into scratches after the trigger", () => {
  const bars = sample();
  const plain = runBacktest(bars, base);
  const be = runBacktest(bars, { ...base, breakEvenR: 0.5 });
  assert.ok(be.trades.some((t) => t.outcome === "breakeven") || be.trades.every((t) => t.mfe < 0.5 || t.outcome === "target"));
  for (const t of be.trades.filter((x) => x.outcome === "breakeven")) assert.ok(t.mfe >= 0.5 && Math.abs(t.r) < 0.1);
  assert.ok(plain.trades.every((t) => t.mae <= 0 && t.mfe >= 0));
});

test("sessions that wrap midnight keep the overnight hours", async () => {
  const { inHours } = await import("../src/lib/vision/backtest.ts");
  assert.ok(inHours(23 * 60, [19 * 60, 2 * 60]));
  assert.ok(inHours(60, [19 * 60, 2 * 60]));
  assert.ok(!inHours(10 * 60, [19 * 60, 2 * 60]));
  assert.ok(inHours(10 * 60, [9 * 60 + 30, 16 * 60]));
});

test("prop firm grading counts every start and scales by size", async () => {
  const { propReport, toDays } = await import("../src/lib/vision/prop.ts");
  const { FIRM_PROGRAMS } = await import("../src/lib/proving/firms.ts");
  const bars = sample();
  const r = runBacktest(bars, { ...base, contracts: 2 });
  const days = toDays(r.trades, bars, 2, 300);
  assert.ok(Math.abs(days.reduce((a, d) => a + d.pnl, 0) - r.stats.pnl) < 1e-6);
  for (const d of days) assert.ok(d.path.every(([lo, hi, c]) => lo <= c + 1e-9 && c <= hi + 1e-9));
  const p = FIRM_PROGRAMS[0];
  const rep = propReport(r.trades, bars, { programKey: p.key, contracts: 2, micro: true, pointValue: 2, stepSeconds: 300, fixedSize: true });
  assert.equal(rep.rolling.passed + rep.rolling.failed + rep.rolling.open, rep.rolling.starts);
  assert.ok(rep.sizes.length >= 1 && rep.firms.length >= 1);
});

test("the verdict refuses to grade a handful of trades", async () => {
  const { verdict } = await import("../src/lib/vision/verdict.ts");
  const r = runBacktest(sample().slice(0, 200), base);
  const v = verdict({ ...r, trades: r.trades.slice(0, 3), stats: { ...r.stats, trades: 3 } });
  assert.equal(v.grade, "—");
});

test("a pattern run as your rules enters exactly where the chart detector fires", async () => {
  const { patternContext, patternDetector, PATTERN_ORDER } = await import("../src/lib/vision/patterns.ts");
  const { levelsFor } = await import("../src/lib/vision/levels.ts");
  const { DEFAULT_RULES } = await import("../src/lib/vision/custom.ts");
  // Four weekdays of 5-minute futures bars, a seeded walk with a busier New York session.
  let s = 101;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const bars = [];
  let px = 20_000;
  for (let t = Date.UTC(2025, 0, 13, 0, 0) / 1000; t < Date.UTC(2025, 0, 17, 21, 0) / 1000; t += 300) {
    const nyHour = (new Date(t * 1000).getUTCHours() + 19) % 24;
    if (nyHour === 17) continue;
    const busy = nyHour >= 9 && nyHour < 16 ? 2 : 1;
    const o = px;
    const c = o + (r() - 0.5) * 12 * busy;
    bars.push({ t, o, h: Math.max(o, c) + r() * 5 * busy, l: Math.min(o, c) - r() * 5 * busy, c, v: Math.round(100 + r() * 400 * busy) });
    px = c;
  }
  const ctx = patternContext(bars, "rth", levelsFor(bars));
  let total = 0;
  for (const id of PATTERN_ORDER) {
    const rules = { ...DEFAULT_RULES, entry: { kind: "pattern", pattern: id }, stop: { kind: "plan" }, target: { kind: "plan" } };
    const res = runBacktest(bars, { ...base, anchor: "rth", custom: rules });
    const d = patternDetector(id);
    for (const t of res.trades) {
      const f = d.detect(ctx, t.entryIndex);
      assert.ok(f, `${id}: a trade at ${t.entryIndex} where the detector did not fire`);
      assert.equal(t.side, f.side);
      assert.equal(t.entry, f.entry);
      assert.ok(Math.abs(t.stop - f.stop) <= 0.25 && Math.abs(t.target - f.target) <= 0.25, `${id}: stop and target match to the tick`);
      assert.equal(t.reader, "custom", "backtest rows keep their old type");
    }
    total += res.trades.length;
  }
  assert.ok(total > 3, `patterns traded on the sample (${total})`);
});
