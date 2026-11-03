// ─── Vision · prop firm mode ───────────────────────────────────────────────────
// Grades a backtest against a firm's rules with the same evaluator Proving
// Ground uses: trailing or static drawdown walked bar by bar, the daily loss
// limit, the consistency rule and minimum days.
//
// One pass/fail from the first day says little, so the run is also started on
// every trading day in the history ("rolling starts"): the share that passed,
// how fast, and how many were blown. The same is done for each firm at the
// account size and for each contract count, to find the size that passes most.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { careerOdds, type CareerOdds } from "@/lib/proving/career";
import type { DaySim, SimTrade } from "@/lib/proving/engine";
import { FIRM_PROGRAMS, evaluate, programByKey, type Evaluation, type FirmProgram } from "@/lib/proving/firms";
import type { BacktestTrade } from "./backtest";

export interface RollingOdds {
  starts: number;
  passed: number;
  failed: number;
  open: number;
  passRate: number;
  failRate: number;
  /** Median trading days to pass, among the starts that passed. */
  medianDays: number | null;
  /** Expected evaluation fees per funded account, at this pass rate. */
  costPerPass: number | null;
}

export interface PropReport {
  program: FirmProgram;
  contracts: number;
  micro: boolean;
  first: Evaluation;
  rolling: RollingOdds;
  funded: CareerOdds;
  firms: { key: string; firm: string; program: string; rolling: RollingOdds; overSize: boolean }[];
  sizes: { contracts: number; rolling: RollingOdds }[];
  bestSize: number | null;
}

/**
 * The backtest's trades as Proving Ground sessions: one entry per bar from the
 * first entry to the last exit of each day, with open P&L at the bar's low and
 * high. Prices past the stop or target never count, since the trade was out there.
 */
export function toDays(trades: BacktestTrade[], bars: Bar[], pointValue: number, stepSeconds: number): DaySim[] {
  const bySession = new Map<string, BacktestTrade[]>();
  for (const t of trades) bySession.set(t.session, [...(bySession.get(t.session) ?? []), t]);
  const days: DaySim[] = [];
  for (const [date, ts] of bySession) {
    const path: [number, number, number][] = [];
    let realized = 0;
    const first = ts[0].entryIndex;
    const last = ts[ts.length - 1].exitIndex;
    let k = 0;
    for (let i = first; i <= last; i++) {
      while (k < ts.length && ts[k].exitIndex < i) k++;
      const t = ts[k];
      if (t && i > t.entryIndex && i <= t.exitIndex) {
        const dir = t.side === "long" ? 1 : -1;
        const lo = dir > 0 ? Math.max(bars[i].l, t.stop) : Math.min(bars[i].h, t.stop);
        const hi = dir > 0 ? Math.min(bars[i].h, t.target) : Math.max(bars[i].l, t.target);
        const v = (px: number) => (px - t.entry) * dir * pointValue * t.units;
        if (i === t.exitIndex) {
          const open = realized;
          realized += t.pnl;
          path.push([Math.min(open + v(lo), realized), Math.max(open + v(hi), realized), realized]);
        } else path.push([realized + v(lo), realized + v(hi), realized + v(bars[i].c)]);
      } else path.push([realized, realized, realized]);
    }
    days.push({
      date,
      trades: ts.map((t) => ({ id: String(t.n), date, side: t.side, entryT: t.entryT, entryPx: t.entry, exitT: t.exitT, exitPx: t.exit, stopPx: t.stop, targetPx: t.target, qty: t.units, pnl: t.pnl, r: t.r, exit: t.outcome, why: "", mfe: 0, mae: 0 }) as SimTrade),
      pnl: realized,
      path,
      t0: bars[first].t,
      step: stepSeconds,
      partial: false,
    });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

const scale = (days: DaySim[], f: number): DaySim[] => (f === 1 ? days : days.map((d) => ({ ...d, pnl: d.pnl * f, path: d.path.map(([a, b, c]) => [a * f, b * f, c * f] as [number, number, number]) })));

/** Start the evaluation on every trading day (sampled to at most `cap` starts) and count the outcomes. */
export function rolling(days: DaySim[], p: FirmProgram, size: { contracts: number; micro: boolean }, cap = 400, horizon = 120): RollingOdds {
  const starts = days.length;
  const step = Math.max(1, Math.ceil(starts / cap));
  let passed = 0;
  let failed = 0;
  let open = 0;
  const toPass: number[] = [];
  for (let k = 0; k < starts; k += step) {
    const e = evaluate(days.slice(k, k + horizon), p, size);
    if (e.verdict === "passed") {
      passed++;
      toPass.push(e.daysTraded);
    } else if (e.verdict === "failed") failed++;
    else open++;
  }
  const total = passed + failed + open;
  toPass.sort((a, b) => a - b);
  const passRate = total ? passed / total : 0;
  return { starts: total, passed, failed, open, passRate, failRate: total ? failed / total : 0, medianDays: toPass.length ? toPass[Math.floor(toPass.length / 2)] : null, costPerPass: passRate > 0 ? p.cost / passRate : null };
}

export function propReport(trades: BacktestTrade[], bars: Bar[], o: { programKey: string; contracts: number; micro: boolean; pointValue: number; stepSeconds: number; fixedSize: boolean }): PropReport | null {
  const program = programByKey(o.programKey);
  if (!program) return null;
  const days = toDays(trades, bars, o.pointValue, o.stepSeconds);
  const size = { contracts: o.contracts, micro: o.micro };
  const first = evaluate(days, program, size);
  const roll = rolling(days, program, size);
  const funded = careerOdds(days, program, size, { runs: 200 });
  // Instant-funded programs have no evaluation to pass, so they are compared only when that is what was picked.
  const firms = FIRM_PROGRAMS.filter((p) => p.size === program.size && (p.model === program.model || p.key === program.key)).map((p) => {
    const limit = o.micro ? p.maxMicros : p.maxMinis;
    return { key: p.key, firm: p.firm, program: p.program, rolling: rolling(days, p, size, 250), overSize: o.contracts > limit };
  });
  // Contract counts only scale cleanly when every trade used the same size.
  const sizes: PropReport["sizes"] = [];
  if (o.fixedSize && o.contracts > 0) {
    const limit = Math.min(o.micro ? program.maxMicros : program.maxMinis, 20);
    for (let c = 1; c <= limit; c++) sizes.push({ contracts: c, rolling: rolling(scale(days, c / o.contracts), program, { contracts: c, micro: o.micro }, 200) });
  }
  const best = sizes.reduce<(typeof sizes)[number] | null>((a, s) => (!a || s.rolling.passRate > a.rolling.passRate + 0.005 ? s : a), null);
  return { program, contracts: o.contracts, micro: o.micro, first, rolling: roll, funded, firms: firms.sort((a, b) => b.rolling.passRate - a.rolling.passRate), sizes, bestSize: best && best.rolling.passRate > 0 ? best.contracts : null };
}
