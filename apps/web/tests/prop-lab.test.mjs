import test from "node:test";
import assert from "node:assert/strict";
import { FIRM_PROGRAMS, evaluate, programByKey } from "../src/lib/proving/firms.ts";
import { accountState, newAccount } from "../src/lib/vision/account.ts";
import { bookOdds, dailyCorrelation, gamePlan, healthCheck, life, liveTable, minimumCapital, stressTest, worth, youVsMachine } from "../src/lib/vision/economics.ts";
import { firmRuleCheck, judge } from "../src/lib/vision/scout.ts";
import { accountUnits, attemptToSims, autopsy, coinFlipOdds, dayLedger, firmShootout, firmTraps, goNoGo, planGrid, rollingOdds, simulate, sizingStudy, toUnitDays, walkForward, wilson } from "../src/lib/vision/lab.ts";

const price = { pointValue: 2, fee: 1.04, micro: true };
const flat = (amount) => ({ kind: "fixed", amount, dayStop: 0, dayCap: false, coast: false });

function rng(seed) {
  let a = seed >>> 0;
  return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Random trades, a few a day, from a coin weighted by `edge`. */
function tape({ seed = 3, days = 300, edge = 0.5, perDay = 3, risk = 20, reward = 30 } = {}) {
  const r = rng(seed);
  const out = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(Date.UTC(2020, 0, 1 + d)).toISOString().slice(0, 10);
    for (let k = 0; k < perDay; k++) {
      const win = r() < edge;
      const points = win ? reward : -risk;
      const entryT = Date.parse(`${date}T14:30:00Z`) / 1000 + k * 3600;
      out.push({ entryT, exitT: entryT + 1800, session: date, side: "long", entry: 100, stop: 100 - risk, target: 100 + reward, exit: 100 + points, risk, points, worst: win ? -risk * r() * 0.7 : -risk, best: win ? reward : reward * r() * 0.6, outcome: win ? "target" : "stop", reader: "sweep" });
    }
  }
  return out;
}

const programs = ["apex", "topstep", "lucid-flex", "myfundedfutures"].map((id) => FIRM_PROGRAMS.find((p) => p.firmId === id && p.size === 50_000)).filter(Boolean);

test("the simulator and the firm evaluator agree on every attempt", () => {
  assert.ok(programs.length >= 3);
  const days = toUnitDays(tape({ edge: 0.48, days: 400 }));
  for (const p of programs) {
    for (const q of [2, 5, 10, 20]) {
      if (q > p.maxMicros) continue;
      for (const from of [0, 37, 90, 150, 210]) {
        const att = simulate(days, p, flat(q), price, { from, horizon: 120 });
        const e = evaluate(attemptToSims(att), p, { contracts: q, micro: true });
        const want = att.end === "passed" ? "passed" : att.end === "floor" ? "failed" : "active";
        assert.equal(e.verdict, want, `${p.key} ${q} from ${from}: ${e.headline} vs ${att.end}`);
        assert.ok(Math.abs(e.balance - att.balance) < 0.01, `${p.key} balance ${e.balance} vs ${att.balance}`);
        assert.ok(Math.abs(e.threshold - att.floor) < 0.01, `${p.key} floor ${e.threshold} vs ${att.floor}`);
      }
    }
  }
});

test("plans with day stops also grade the same on the evaluator", () => {
  const days = toUnitDays(tape({ edge: 0.5, days: 300, seed: 9 }));
  const p = programs[0];
  for (const plan of planGrid(p, true)) {
    const att = simulate(days, p, plan, price, { from: 20 });
    const e = evaluate(attemptToSims(att), p, { contracts: 1, micro: true });
    if (att.end === "floor") assert.equal(e.verdict, "failed", `${JSON.stringify(plan)}`);
    if (att.end === "passed") assert.equal(e.verdict, "passed", `${JSON.stringify(plan)}: ${e.detail}`);
  }
});

test("a saved account made from an attempt reads the same as the attempt", () => {
  const days = toUnitDays(tape({ edge: 0.55, days: 200, seed: 21 }));
  const p = programs[1];
  const att = simulate(days, p, flat(3), price, { from: 0 });
  const a = newAccount({ name: "t", color: "#fff", program: p.key, symbol: "NQ", tf: "5m", micro: true, sizing: "fixed", contracts: 3, riskPct: 1, mode: "auto", startDate: days[0].date });
  a.trades = att.days.flatMap((d) => d.trades.map((x, i) => ({ id: `${d.date}${i}`, entryT: x.t.entryT, exitT: x.t.exitT, session: x.t.session, side: x.t.side, qty: x.qty, entry: x.t.entry, exit: x.t.exit, stop: x.t.stop, target: x.t.target, pnl: x.pnl, r: x.t.points / x.t.risk, worst: x.worst, best: x.best, reason: x.t.outcome, source: "auto" })));
  const s = accountState(a);
  assert.ok(Math.abs(s.balance - att.balance) < 0.01);
  assert.equal(s.status, att.end === "passed" ? "passed" : att.end === "floor" ? "blown" : "active");
});

test("room-based sizing shrinks with the room and never passes the firm's cap", () => {
  const days = toUnitDays(tape({ edge: 0.45, days: 120, seed: 5 }));
  const p = programs[0];
  const att = simulate(days, p, { kind: "room", amount: 0.2, dayStop: 0, dayCap: false, coast: false }, price);
  const qs = att.days.flatMap((d) => d.trades.map((x) => x.qty));
  assert.ok(qs.length > 3);
  assert.ok(Math.max(...qs) <= p.maxMicros);
  assert.ok(qs.at(-1) <= qs[0], `size fell from ${qs[0]} to ${qs.at(-1)} as the account lost`);
});

test("a day stop ends the day and a coasting plan trades one contract at the target", () => {
  const p = { ...programs[1], minDays: 40, consistencyPct: 100 };
  const days = toUnitDays(tape({ edge: 0.8, days: 200, seed: 8 }));
  const att = simulate(days, p, { kind: "fixed", amount: 10, dayStop: 0, dayCap: false, coast: true }, price, { horizon: 200 });
  const reached = att.days.findIndex((d) => d.balance - p.size >= p.target);
  assert.ok(reached >= 0 && reached < att.days.length - 1, "reached the target before the day count");
  for (const d of att.days.slice(reached + 1).filter((x) => att.days[att.days.indexOf(x) - 1].balance - p.size >= p.target)) for (const x of d.trades) assert.equal(x.qty, 1);

  const losers = toUnitDays(tape({ edge: 0, days: 4, perDay: 8, risk: 10 }));
  const stopped = simulate(losers, programs[1], { kind: "fixed", amount: 5, dayStop: 0.1, dayCap: false, coast: false }, price);
  assert.equal(stopped.days[0].halted, "day-stop");
  assert.ok(stopped.days[0].trades.length < 8);
});

test("no edge means the rules' odds: at or under the fair number, and intraday trailing hurts most", () => {
  const stat = { ...programs[0], ddType: "static", lock: null, dll: null, consistencyPct: 100, minDays: 1, target: 3000, drawdown: 2000, size: 50_000 };
  const s = coinFlipOdds(stat, { runs: 600 });
  assert.ok(Math.abs(s.rate - s.fair) < 0.08, `static ${s.rate} near fair ${s.fair}`);
  const eod = coinFlipOdds({ ...stat, ddType: "trailing-eod" }, { runs: 600 }).rate;
  const intraday = coinFlipOdds({ ...stat, ddType: "trailing-intraday" }, { runs: 600 }).rate;
  assert.ok(intraday < eod && eod <= s.rate + 0.03, `intraday ${intraday}, eod ${eod}, static ${s.rate}`);
});

test("every firm's traps are real numbers, not canned lines", () => {
  for (const p of FIRM_PROGRAMS) {
    const t = firmTraps(p);
    if (p.ddType === "trailing-intraday") assert.ok(t.some((x) => x.id === "trail"), p.key);
    if (p.dll != null) assert.ok(t.some((x) => x.id === "dll"), p.key);
    if (p.consistencyPct < 100) assert.ok(t.some((x) => x.id === "consistency"), p.key);
    for (const x of t) assert.ok(!/NaN|Infinity|undefined/.test(x.how + x.title + x.answer), `${p.key}: ${x.how}`);
  }
});

test("the odds' range widens when the starts overlap and there are few real tries", () => {
  const w = wilson(5, 10);
  assert.ok(w.low < 0.5 && w.high > 0.5);
  const days = toUnitDays(tape({ edge: 0.52, days: 260 }));
  const o = rollingOdds(days, programs[0], flat(5), price, { cap: 60 });
  assert.ok(o.independent < o.starts, `${o.independent} independent of ${o.starts}`);
  assert.ok(o.high - o.low > 0.05);
});

test("the study picks on old data and reports the new data it never saw", () => {
  const days = toUnitDays(tape({ edge: 0.5, days: 400 }));
  const st = sizingStudy(days, programs[1], price, { cap: 20 });
  assert.ok(st.best && st.splitDate);
  assert.ok(st.rows.every((r, i) => !i || st.rows[i - 1].train.low >= r.train.low));
  assert.ok(st.rows.every((r) => r.test.starts > 0 && r.train.starts > 0));
});

test("an autopsy names the cause and only offers rescues that really change the result", () => {
  const p = programs[0];
  const days = toUnitDays(tape({ edge: 0.45, days: 200, seed: 13 }));
  const plan = flat(Math.min(40, p.maxMicros));
  const att = simulate(days, p, plan, price);
  assert.equal(att.end, "floor");
  const a = autopsy(days, 0, att, p, plan, price, "micros");
  assert.ok(a.causes.length >= 1);
  assert.ok(a.causes.some((c) => c.id === "oversize"), a.causes.map((c) => c.id).join());
  for (const r of a.rescues) assert.notEqual(simulate(days, p, r.plan, price, { from: 0, horizon: Math.max(att.days.length + 40, 120) }).end, "floor", r.change);
});

test("walking forward never lets a choice see its own future", () => {
  // Good for the first half, then it stops working, a change no one could know in advance.
  const good = tape({ edge: 0.62, days: 250, seed: 2 });
  const bad = tape({ edge: 0.3, days: 250, seed: 4 }).map((t) => ({ ...t, session: shift(t.session, 250), entryT: t.entryT + 250 * 86400, exitT: t.exitT + 250 * 86400 }));
  const v = [{ id: "a", label: "A", trades: [...good, ...bad] }];
  const w = walkForward(v, programs[1], price, "micros", { maxAttempts: 40 });
  assert.ok(w.attempts >= 2);
  for (const s of w.steps) assert.ok(s.trainedTo < s.start, `${s.trainedTo} before ${s.start}`);
  for (let i = 1; i < w.steps.length; i++) assert.ok(w.steps[i].start > w.steps[i - 1].end, "attempts do not overlap");
  const early = w.steps.filter((s) => s.start < "2020-09-01");
  const late = w.steps.filter((s) => s.start > "2020-11-01");
  const rate = (xs) => xs.filter((s) => s.result === "passed").length / Math.max(1, xs.length);
  assert.ok(rate(early) >= rate(late), `early ${rate(early)} late ${rate(late)}`);
});
const shift = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

test("the day ledger's floor and balance match the account's own curve", () => {
  const p = programs[0];
  const days = toUnitDays(tape({ edge: 0.5, days: 40, seed: 31 }));
  const att = simulate(days, p, flat(5), price);
  const { rows, summary } = dayLedger(attemptToSims(att), p);
  assert.equal(rows.length, att.days.filter((d) => d.trades.length).length);
  assert.ok(Math.abs(rows.at(-1).balance - att.balance) < 0.01);
  assert.ok(Math.abs(rows.at(-1).floor - att.floor) < 0.01);
  assert.equal(summary.green + summary.red + summary.flat, summary.days);
  assert.ok(programByKey(p.key));
});

test("the shootout ranks firms by edge over no edge, and the signal split counts every attempt once", () => {
  const days = toUnitDays(tape({ edge: 0.55, days: 200 }));
  const rows = firmShootout(days, programs, price);
  assert.equal(rows.length, programs.length);
  assert.ok(rows.every((r, i) => !i || rows[i - 1].edge >= r.edge));
  assert.ok(rows.every((r) => Math.abs(r.edge - (r.odds.passRate - r.coin)) < 1e-9));
  const steps = [{ expectedLow: 0.4, result: "passed" }, { expectedLow: 0.4, result: "floor" }, { expectedLow: 0.1, result: "floor" }, { expectedLow: 0.1, result: "unfinished" }];
  const g = goNoGo(steps, 0.3, 100);
  assert.deepEqual([g.taken.attempts, g.taken.passRate, g.taken.costPerPass, g.skipped.attempts, g.saved], [2, 0.5, 200, 2, 200]);
});

// ── Money, limits and proof ──

test("a risk limit caps every trade, and skips one too big at a single contract", () => {
  const days = toUnitDays(tape({ edge: 0.5, days: 60, risk: 40 }));
  const p = programs[1];
  const att = simulate(days, p, flat(50), { ...price, maxRisk: 0.1 });
  const perContract = 40 * price.pointValue + price.fee;
  for (const d of att.days) for (const x of d.trades) assert.ok(x.qty * perContract <= p.drawdown * 0.1 + 1e-9, `qty ${x.qty}`);
  const none = simulate(days, p, flat(1), { ...price, pointValue: 200, maxRisk: 0.05 });
  assert.equal(none.days.flatMap((d) => d.trades).length, 0);
  assert.ok(planGrid(p, true, 0.1).every((x) => x.kind === "fixed" || x.amount <= 0.1));
});

test("a live account has no target, stops at the loss you set, and margin limits its size", () => {
  const p = programByKey("live:5000:50");
  assert.equal(p.size, 5000);
  assert.equal(p.drawdown, 2500);
  const days = toUnitDays(tape({ edge: 0.7, days: 100, seed: 3 }));
  const att = simulate(days, p, flat(1000), { ...price, margin: 100 });
  assert.notEqual(att.end, "passed");
  const first = att.days[0].trades[0];
  assert.ok(first.qty <= 50, `margin allows 50 at $5,000, got ${first.qty}`);
  const a = newAccount({ name: "live", color: "#fff", program: p.key, symbol: "NQ", tf: "5m", micro: true, sizing: "fixed", contracts: 1, riskPct: 1, mode: "both", startDate: "2020-01-01" });
  a.phase = "live";
  a.trades = [{ id: "1", entryT: 1, exitT: 2, session: "2020-01-02", side: "long", qty: 1, entry: 1, exit: 2, stop: 0, target: 3, pnl: 100, r: 1, worst: 0, best: 100, reason: "target", source: "manual" }];
  const s = accountState(a);
  assert.equal(s.status, "active");
  assert.equal(s.balance, 5100);
  assert.equal(s.fees, 0);
  assert.match(s.headline, /Up \$100/);
});

test("a firm's life adds up: fees, activation and payouts reach the net, and instant accounts need no pass", () => {
  const days = toUnitDays(tape({ edge: 0.62, days: 400, seed: 6 }));
  const p = programByKey("topstep:topstep-50k");
  const plan = { kind: "room", amount: 0.12, dayStop: 0, dayCap: false, coast: true };
  const l = life(days, p, plan, plan, price, price, { from: 0, horizon: 300 });
  assert.ok(l.attempts >= 1 && l.spent >= p.cost);
  assert.ok(Math.abs(l.net - (l.paid - l.spent)) < 1e-9);
  if (l.passes) assert.ok(l.spent >= p.cost + 149, "activation counted");
  assert.ok(l.payouts > 0, "a strong edge reaches a payout");
  assert.ok(l.paid > 0 && l.spentToPayout != null);
  const inst = FIRM_PROGRAMS.find((x) => x.model === "instant" && x.size === 50_000);
  const li = life(days, inst, plan, plan, price, price, { from: 0, horizon: 300 });
  assert.equal(li.passes, 0);
  const w = worth(days, p, plan, plan, price, price, { cap: 6, horizon: 200 });
  assert.ok(w.lives > 0 && w.pPayout >= 0 && w.pPayout <= 1);
  assert.ok(w.p10 <= w.medianNet && w.medianNet <= w.p90);
});

test("the game plan's numbers follow the account", () => {
  const p = programByKey("topstep:topstep-50k");
  const g = gamePlan({ program: p, balance: 50_500, threshold: 48_500, profit: 500, bestDay: 500, daysTraded: 1 }, { cap: 0.2, stopPoints: 25, pointValue: 2, micro: true, fee: 1, phase: "eval" });
  assert.equal(g.room, 2000);
  assert.equal(g.maxRiskUsd, 400);
  assert.equal(g.maxContracts, 7);
  assert.equal(g.lossesLeft, 5);
  assert.equal(g.toTarget, 2500);
  assert.equal(g.bestDayLimit, 1500);
  const tight = gamePlan({ program: p, balance: 50_000, threshold: 48_000, profit: 0, bestDay: 0, daysTraded: 0 }, { cap: 0.01, stopPoints: 25, pointValue: 20, micro: false, fee: 4, phase: "funded", fundedConsistencyPct: 20 });
  assert.equal(tight.maxContracts, 0);
  assert.ok(tight.warning);
});

test("the luck test tells a real edge from none", () => {
  const p = { ...programs[1], consistencyPct: 100 };
  const strong = stressTest(toUnitDays(tape({ edge: 0.68, days: 260, seed: 4 })), p, flat(5), price, 0.25, { runs: 15, cap: 20 });
  const none = stressTest(toUnitDays(tape({ edge: 0.4, days: 260, seed: 4 })), p, flat(5), price, 0.25, { runs: 15, cap: 20 });
  assert.ok(strong.luck < none.luck, `${strong.luck} vs ${none.luck}`);
  assert.ok(strong.slippage[2].passRate <= strong.base + 0.1);
});

test("the health check raises an alarm when results fall outside history", () => {
  const good = Array.from({ length: 300 }, (_, i) => (i % 2 ? 1.5 : -1));
  assert.equal(healthCheck(good).status, "normal");
  const broke = [...good, ...Array.from({ length: 40 }, () => -1)];
  const h = healthCheck(broke);
  assert.equal(h.status, "alarm");
  assert.equal(healthCheck([1, -1]).status, "unknown");
});

test("you vs. the machine prices each habit", () => {
  const entryT = 1_600_000_000;
  const machine = [{ date: "2020-09-13", trades: [{ entryT, exitT: entryT + 600, session: "2020-09-13", side: "long", entry: 100, stop: 90, target: 120, exit: 120, risk: 10, worst: -1, best: 20, points: 20, outcome: "target", reader: "x" }, { entryT: entryT + 7200, exitT: entryT + 7800, session: "2020-09-13", side: "short", entry: 100, stop: 110, target: 80, exit: 110, risk: 10, worst: -10, best: 1, points: -10, outcome: "stop", reader: "x" }] }];
  const mine = (o) => ({ entryT, exitT: entryT + 300, session: "2020-09-13", side: "long", qty: 1, entry: 100, exit: 105, stop: 90, target: 120, pnl: 10, r: 0.5, worst: -2, best: 40, source: "manual", ...o });
  const v = youVsMachine([mine({}), mine({ entryT: entryT + 20000, side: "short", qty: 10, stop: 110, target: 80, exit: 112, pnl: -240, r: -1.2, best: 0 })], machine, price, { contracts: 1, capUsd: 100, machineLabel: "the plan" });
  const of = (id) => v.leaks.find((l) => l.id === id);
  assert.equal(v.days, 1);
  assert.equal(of("offplan").count, 1);
  assert.equal(of("skipped").count, 1);
  assert.equal(of("early").count, 1);
  assert.equal(of("size").count, 1);
  assert.equal(of("stop").count, 1);
  assert.ok(of("early").dollars < 0);
});

test("copies of one strategy fail together; independent markets rarely do", () => {
  const p = programs[1];
  const plan = flat(10);
  const a = toUnitDays(tape({ edge: 0.47, days: 250, seed: 1 }));
  const b = toUnitDays(tape({ edge: 0.47, days: 250, seed: 2 }));
  const c = toUnitDays(tape({ edge: 0.47, days: 250, seed: 3 }));
  const same = bookOdds([a, a, a].map((days) => ({ label: "a", days, plan, price })), p, "same", { cap: 30 });
  const mix = bookOdds([a, b, c].map((days) => ({ label: "x", days, plan, price })), p, "mix", { cap: 30 });
  assert.ok(mix.allFail <= same.allFail, `${mix.allFail} vs ${same.allFail}`);
  assert.ok(mix.anyPass >= same.anyPass);
  assert.ok(dailyCorrelation(a, a) > 0.99);
  assert.ok(Math.abs(dailyCorrelation(a, b)) < 0.3);
});

test("the scout only recommends what holds up on newer data", () => {
  const c = { id: "t", name: "T", idea: "", source: "", tf: "5m", rules: {} };
  const p = programs[1];
  const fading = tape({ edge: 0.62, days: 300, seed: 7 }).concat(tape({ edge: 0.25, days: 150, seed: 8 }).map((t) => ({ ...t, session: shift(t.session, 300), entryT: t.entryT + 300 * 86400, exitT: t.exitT + 300 * 86400 })));
  assert.equal(judge(c, "NQ", fading, p, price, 0.25, "2021-01-01").verdict, "rejected");
  assert.match(judge(c, "NQ", tape({ days: 10 }), p, price, 0.25, "x").reason, /too few/);
  const strong = tape({ edge: 0.62, days: 700, seed: 9 });
  assert.equal(judge(c, "NQ", strong, p, price, 0.25, "x").verdict, "recommended");
});

test("every firm gets a rule check, and unconfirmed ones say so", () => {
  const rows = firmRuleCheck(Date.parse("2026-11-03T12:00:00Z"));
  assert.ok(rows.length > 5);
  for (const r of rows) assert.ok(r.ageDays >= 0 && ["fresh", "aging", "stale", "unverified"].includes(r.status));
  const lucid = rows.find((r) => r.id === "lucid-pro");
  assert.equal(lucid.status, "unverified");
  assert.ok(lucid.issues.length >= 1);
});

test("live compounding sizes down, skips what a small balance can't take, and reports ruin", () => {
  const days = toUnitDays(tape({ edge: 0.55, days: 300, risk: 30 }));
  const rows = liveTable(days, { ...price, margin: 100 }, { capitals: [1000, 50000], risks: [1], cap: 6, horizon: 200 });
  const small = rows.find((r) => r.capital === 1000);
  const big = rows.find((r) => r.capital === 50000);
  assert.ok(small.skipped > big.skipped, `${small.skipped} vs ${big.skipped}`);
  assert.ok(minimumCapital(days, 1, price).capital > 1000);
  assert.ok(big.ruin >= 0 && big.ruin <= 1);
});

test("an account's autopsy reads the sizes really traded, whatever they were", () => {
  const t = (i, qty, points) => ({ entryT: 1_600_000_000 + i * 86400, exitT: 1_600_000_600 + i * 86400, session: shift("2020-09-13", i), side: "long", qty, entry: 100, exit: 100 + points, stop: 90, target: 120, pnl: points * price.pointValue * qty - price.fee * qty, worst: -2 * price.pointValue * qty, best: Math.max(points, 0) * price.pointValue * qty, reason: "target" });
  const trades = [t(0, 20, 20), t(1, 2, -10), t(2, 2, -10), t(3, 2, -10)];
  const days = accountUnits(trades, price);
  const att = simulate(days, programs[1], { kind: "actual", amount: 2, dayStop: 0, dayCap: false, coast: false }, price, { horizon: days.length });
  assert.ok(Math.abs(att.profit - trades.reduce((a, x) => a + x.pnl, 0)) < 1e-6);
});
