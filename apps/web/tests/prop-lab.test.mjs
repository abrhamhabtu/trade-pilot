import test from "node:test";
import assert from "node:assert/strict";
import { FIRM_PROGRAMS, evaluate, programByKey } from "../src/lib/proving/firms.ts";
import { accountState, newAccount } from "../src/lib/vision/account.ts";
import { attemptToSims, autopsy, coinFlipOdds, dayLedger, firmShootout, firmTraps, goNoGo, planGrid, rollingOdds, simulate, sizingStudy, toUnitDays, walkForward, wilson } from "../src/lib/vision/lab.ts";

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
  for (const r of a.rescues) assert.notEqual(simulate(days, p, r.plan, price, { from: 0, horizon: 200 }).end, "floor", r.change);
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
