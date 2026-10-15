// ─── Proving Ground · tournament ───────────────────────────────────────────────
// Every built-in strategy, on its starting rules, against every firm program at
// one account size, over the same sessions. Each pair runs a full account life
// (see career.ts), so the ranking is money paid out against money spent.
//
// "Holds up" asks the question a backtest usually skips: was the strategy
// profitable in both the first and the second half of the window, or did one
// lucky stretch carry it?
// ───────────────────────────────────────────────────────────────────────────────

import { RTH_CLOSE, nyClock } from "@/lib/pilot/market";
import { INSTRUMENTS, STRATEGIES, defaultConfig, runSession, stats, type DaySim, type Instrument, type Session, type StrategyConfig, type StrategyId } from "./engine";
import { career, careerOdds, type Career, type CareerOdds } from "./career";
import { programsAtSize, type FirmProgram } from "./firms";

export const TOURNEY_STRATEGIES = (Object.keys(STRATEGIES) as StrategyId[]).filter((s) => s !== "tv-signals");

export type TourneyMode = "starting" | "tuned";

export interface Entrant {
  id: StrategyId;
  cfg: StrategyConfig;
  /** The sessions its money is scored on. */
  days: DaySim[];
  stats: ReturnType<typeof stats>;
  /** Net on the earlier and later half of the window (tuned: training, then unseen). */
  halves: [number, number];
  /** Profitable in both halves. */
  holds: boolean;
  /** Rule changes from the starting rules, in words. */
  changes: string[];
}

export interface Cell {
  strategy: StrategyId;
  program: FirmProgram;
  /** Contracts this pair trades. Tuned mode picks them per firm on the training half. */
  contracts: number;
  /** The one life the real sessions, in their real order, produced. */
  career: Career;
  /** Many lives dealt from the same sessions. */
  odds: CareerOdds;
}

export interface Tournament {
  mode: TourneyMode;
  entrants: Entrant[];
  programs: FirmProgram[];
  cells: Cell[];
  /** The scored window. */
  from: string;
  to: string;
  sessions: number;
  /** Tuned mode: the window the rules were chosen on. */
  trainFrom?: string;
  trainTo?: string;
}

/** Sessions that have finished: today's is left out while it is still trading. */
export function finishedSessions(sessions: Session[], now = Date.now()) {
  const clock = nyClock(now);
  return sessions.filter((s) => s.rth.length && !(s.date === clock.date && clock.minute < RTH_CLOSE + 5));
}

const refPrice = (sessions: Session[]) => {
  const last = sessions[sessions.length - 1]?.rth;
  return last?.[last.length - 1]?.c;
};

/**
 * The same sessions traded at a different size. The engine's P&L, fees and
 * slippage are all per contract, so scaling is exact, not an estimate.
 */
export function scaleDays(days: DaySim[], from: number, to: number): DaySim[] {
  if (from === to) return days;
  const k = to / from;
  return days.map((d) => ({
    ...d,
    pnl: d.pnl * k,
    path: d.path.map(([lo, hi, c]) => [lo * k, hi * k, c * k] as [number, number, number]),
    trades: d.trades.map((t) => ({ ...t, qty: t.qty * k, pnl: t.pnl * k, mfe: t.mfe * k, mae: t.mae * k })),
  }));
}

const SIZES = [1, 2, 3, 5, 8, 12, 20, 30];

/**
 * How a trader would pick between two pairs: the better chance of coming out
 * ahead first, then the better typical result. The mean is left out on purpose:
 * cheap resets and maximum size buy a long right tail that makes a lottery
 * ticket look like an edge.
 */
export const oddsScore = (o: CareerOdds) => o.pProfit * 1e6 + o.medianNet;

/** The size with the best odds on the training sessions; the smaller size wins a tie. */
export function pickSize(train: DaySim[], base: number, p: FirmProgram, micro: boolean) {
  const cap = micro ? p.maxMicros : p.maxMinis;
  let best = Math.min(base, cap);
  let bestNet = -Infinity;
  for (const n of SIZES.filter((n) => n <= cap)) {
    const net = oddsScore(careerOdds(scaleDays(train, base, n), p, { contracts: n, micro }, { runs: 80, seed: 11 }));
    if (net > bestNet + 0.5) {
      bestNet = net;
      best = n;
    }
  }
  return best;
}

/** The rule variants the tuner tries for one strategy. */
export function variants(base: StrategyConfig): StrategyConfig[] {
  const out: StrategyConfig[] = [];
  for (const targetR of [1, 1.5, 2, 3])
    for (const breakEvenR of [0, 1])
      for (const maxTrades of [1, 2])
        for (const direction of ["both", "long", "short"] as const) out.push({ ...base, targetR, breakEvenR, maxTrades, direction });
  return out;
}

const MIN_TRAIN_TRADES = 6;

/**
 * Pick the variant with the best net on the training sessions, among those
 * that traded often enough to mean something. Profit factor breaks ties.
 */
export function tune(id: StrategyId, train: Session[], instrument: Instrument, ref?: number): StrategyConfig {
  const base = defaultConfig(id, instrument, ref);
  let best = base;
  let bestScore = -Infinity;
  for (const cfg of variants(base)) {
    const st = stats(train.map((s) => runSession(s, cfg, { partial: false })));
    if (st.trades < MIN_TRAIN_TRADES) continue;
    const score = st.net + (Number.isFinite(st.profitFactor) ? st.profitFactor : 3);
    if (score > bestScore) {
      bestScore = score;
      best = cfg;
    }
  }
  return best;
}

export function describeChanges(base: StrategyConfig, cfg: StrategyConfig) {
  const out: string[] = [];
  if (cfg.targetR !== base.targetR) out.push(`target ${cfg.targetR}R`);
  if (cfg.breakEvenR !== base.breakEvenR) out.push(cfg.breakEvenR ? `stop to entry at ${cfg.breakEvenR}R` : "no break-even stop");
  if (cfg.maxTrades !== base.maxTrades) out.push(`${cfg.maxTrades} trade${cfg.maxTrades === 1 ? "" : "s"} a day`);
  if (cfg.direction !== base.direction) out.push(cfg.direction === "both" ? "both directions" : `${cfg.direction}s only`);
  return out;
}

/**
 * Starting mode scores every strategy on its default rules over the whole
 * window. Tuned mode takes rules chosen on the first half (pass them in from
 * `tune`) and scores money only on the second half, which the tuner never saw.
 */
export function runTournament(
  sessions: Session[],
  instrument: Instrument,
  size: number,
  opts: { now?: number; tuned?: Partial<Record<StrategyId, StrategyConfig>> } = {},
): Tournament {
  const done = finishedSessions(sessions, opts.now);
  const ref = refPrice(done);
  const micro = INSTRUMENTS[instrument].micro;
  const programs = programsAtSize(size);
  const mid = Math.floor(done.length / 2);
  const tuned = opts.tuned;
  const scored = tuned ? done.slice(mid) : done;

  const train = new Map<StrategyId, DaySim[]>();
  const entrants: Entrant[] = TOURNEY_STRATEGIES.map((id) => {
    const base = defaultConfig(id, instrument, ref);
    const cfg = tuned?.[id] ?? base;
    const all = done.map((s) => runSession(s, cfg, { partial: false }));
    train.set(id, all.slice(0, mid));
    const halves: [number, number] = [stats(all.slice(0, mid)).net, stats(all.slice(mid)).net];
    const days = tuned ? all.slice(mid) : all;
    return { id, cfg, days, stats: stats(days), halves, holds: halves[0] > 0 && halves[1] > 0, changes: describeChanges(base, cfg) };
  });

  const cells = entrants.flatMap((e) =>
    programs.map((p) => {
      const contracts = tuned ? pickSize(train.get(e.id)!, e.cfg.contracts, p, micro) : e.cfg.contracts;
      const days = scaleDays(e.days, e.cfg.contracts, contracts);
      const size = { contracts, micro };
      return { strategy: e.id, program: p, contracts, career: career(days, p, size), odds: careerOdds(days, p, size) };
    }),
  );

  return {
    mode: tuned ? "tuned" : "starting",
    entrants,
    programs,
    cells,
    from: scored[0]?.date ?? "",
    to: scored[scored.length - 1]?.date ?? "",
    sessions: scored.length,
    ...(tuned ? { trainFrom: done[0]?.date, trainTo: done[mid - 1]?.date } : {}),
  };
}

/** Pairs ranked the way `oddsScore` reads them. */
export function ranked(t: Tournament) {
  return [...t.cells].sort((a, b) => oddsScore(b.odds) - oddsScore(a.odds));
}
