import test from "node:test";
import assert from "node:assert/strict";
import { defaultConfig, runSession, stats, toSessions } from "../src/lib/proving/engine.ts";
import { FIRM_PROGRAMS, evaluate, programByKey } from "../src/lib/proving/firms.ts";

// Unix seconds for a New York wall-clock time in September (EDT, UTC-4).
const et = (date, hhmm) => Date.parse(`${date}T${hhmm}:00-04:00`) / 1000;
const addMin = (hhmm, m) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + m;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
/** 5-minute RTH bars from closes: each bar opens at the previous close. */
const session = (date, closes, { spread = 1, ctx = {} } = {}) => ({
  date,
  ctx: { pdh: null, pdl: null, pdc: null, onh: null, onl: null, ...ctx },
  rth: closes.map((c, i) => {
    const o = i ? closes[i - 1] : c;
    return { t: et(date, addMin("09:30", i * 5)), o, h: Math.max(o, c) + spread, l: Math.min(o, c) - spread, c, v: 100 };
  }),
});
const cfg = (patch = {}) => ({
  ...defaultConfig("orb", "MNQ", 20000),
  contracts: 1,
  waitMinutes: 15,
  lastEntry: "15:00",
  minStop: 1,
  maxStop: 500,
  stopAfterLosses: 0,
  slippageTicks: 1,
  ...patch,
});

test("ORB: signal on a bar's close, fill on the next bar's open plus slippage, stop at the range middle", () => {
  // 09:30–09:45 range 100–110, then a close above at 09:50 bar, then a run up.
  const s = session("2026-09-24", [105, 110, 100, 112, 114, 116, 118, 120, 122, 124, 126, 128, 130, 140, 150], { spread: 0 });
  const d = runSession(s, cfg({ targetR: 1 }));
  assert.equal(d.trades.length, 1);
  const t = d.trades[0];
  assert.equal(t.side, "long");
  // Signal on the 09:45 bar (close 112), fill at the 09:50 bar's open (112) + 1 tick.
  assert.equal(t.entryPx, 112.25);
  assert.equal(t.stopPx, 105);
  assert.equal(t.targetPx, 112.25 + 7.25);
  assert.equal(t.exit, "target");
  // 7.25 points × $2 × 1 contract, less the round-turn fee.
  assert.equal(t.pnl, Math.round((7.25 * 2 - 1.04) * 100) / 100);
});

test("when one bar touches both the stop and the target, the stop wins", () => {
  const s = session("2026-09-24", [105, 110, 100, 112, 112, 112], { spread: 0 });
  s.rth[4] = { ...s.rth[4], h: 200, l: 50 }; // the bar after the fill spans everything
  const d = runSession(s, cfg());
  assert.equal(d.trades[0].exit, "stop");
  assert.ok(d.trades[0].pnl < 0);
});

test("a still-trading session reports the open position instead of closing it", () => {
  const s = session("2026-09-24", [105, 110, 100, 112, 113, 114], { spread: 0 });
  const d = runSession(s, cfg({ targetR: 5 }), { partial: true });
  assert.equal(d.partial, true);
  assert.equal(d.trades[0].exit, "open");
  assert.equal(d.pnl, 0);
});

test("sessions carry the prior day's and overnight levels into the open", () => {
  const bars = [
    { t: et("2026-09-23", "09:30"), o: 100, h: 120, l: 90, c: 110, v: 1 },
    { t: et("2026-09-23", "15:55"), o: 110, h: 111, l: 95, c: 105, v: 1 },
    { t: et("2026-09-23", "20:00"), o: 105, h: 130, l: 104, c: 125, v: 1 },
    { t: et("2026-09-24", "09:30"), o: 125, h: 126, l: 124, c: 125, v: 1 },
  ];
  const s = toSessions(bars).find((x) => x.date === "2026-09-24");
  assert.deepEqual(s.ctx, { pdh: 120, pdl: 90, pdc: 105, onh: 130, onl: 104 });
});

// ── Firm rules ────────────────────────────────────────────────────────────────
const day = (date, path, pnl = path[path.length - 1][2]) => ({ date, trades: [{ id: date }], pnl, path, t0: et(date, "09:30"), step: 300, partial: false });
const firm = (key, patch = {}) => ({ ...programByKey(key), ...patch });
const small = { contracts: 1, micro: true };

test("intraday trailing fails on a give-back that end-of-day trailing survives", () => {
  // Up $1,900 intraday, then back to -$150 at the close. $2,000 drawdown:
  // intraday trailing has moved to $49,900 by then; end-of-day is still at $48,000.
  const path = [[0, 1900, 1900], [-150, 1900, -150]];
  const intraday = evaluate([day("2026-09-01", path)], firm("tof-s2f:tofs2f-50k", { lock: null }), small);
  const eod = evaluate([day("2026-09-01", path)], firm("topstep:topstep-50k"), small);
  assert.equal(intraday.verdict, "failed");
  assert.equal(eod.verdict, "active");
  assert.equal(eod.threshold, 48000);
  assert.equal(eod.balance, 49850);
});

test("the trailing threshold stops at the lock level", () => {
  const p = firm("apex:apex-50k"); // $2,500 intraday trailing, locks at start + $100
  const e = evaluate([day("2026-09-01", [[0, 2900, 2900]])], p, small);
  assert.equal(e.threshold, 50100);
});

test("consistency holds the pass until the best day is small enough", () => {
  // Topstep: best day ≤ 50% of the $3,000 target, 2-day minimum.
  const p = firm("topstep:topstep-50k");
  const big = evaluate([day("2026-09-01", [[0, 1600, 1600]]), day("2026-09-02", [[0, 1500, 1500]])], p, small);
  assert.equal(big.verdict, "active");
  assert.equal(big.consistencyOk, false);
  const even = evaluate([day("2026-09-01", [[0, 1500, 1500]]), day("2026-09-02", [[0, 1500, 1500]])], p, small);
  assert.equal(even.verdict, "passed");
  assert.equal(even.on, "2026-09-02");
});

test("a size over the firm's cap fails before the first trade", () => {
  const p = firm("topstep:topstep-50k");
  const e = evaluate([day("2026-09-01", [[0, 10, 10]])], p, { contracts: p.maxMicros + 1, micro: true });
  assert.equal(e.verdict, "failed");
  assert.match(e.headline, /size limit/);
});

test("a daily loss limit flattens the day at the limit instead of blowing the account", () => {
  const p = firm("topstep:topstep-50k", { dll: 1000 });
  const e = evaluate([day("2026-09-01", [[0, 0, 0], [-1500, 0, -1500]], -1500)], p, small);
  assert.equal(e.verdict, "active");
  assert.equal(e.balance, 49000);
});

test("every firm program in the app is gradeable", () => {
  assert.ok(FIRM_PROGRAMS.length >= 30);
  for (const p of FIRM_PROGRAMS) {
    const e = evaluate([], p, small);
    assert.equal(e.verdict, "pending", p.key);
  }
  const s = stats([{ ...day("2026-09-01", [[0, 0, 0]], 0), trades: [] }]);
  assert.equal(s.trades, 0);
});
