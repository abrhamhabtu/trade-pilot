// ─── Vision · backtest ─────────────────────────────────────────────────────────
// Runs the same readers the live chart uses over history, one position at a
// time, the way a disciplined trader would take them.
//
// Fill rules, stated in the UI:
//   • Entry at the confirming bar's close, plus slippage against you.
//   • Stop and target sit on whole ticks.
//   • A bar that touches the stop exits at the stop, minus slippage; the stop
//     wins a bar that touches both.
//   • The target is a resting limit: filled at the target, no slippage.
//   • No exit within `maxHold` bars: out at that bar's close.
//   • Commission per contract, round trip (per trade when sizing by risk).
// VIX filters use the last close before the trade's date, never that day's.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { sessionOf } from "@/lib/pilot/market";
import { READER_ORDER, _internal, type Anchor, type ReaderChoice, type ReaderId, type Side } from "./analyze";

export interface BacktestContext {
  fomc: string[];
  early: string[];
  vix: Record<string, number>;
}

export interface BacktestOptions {
  reader: ReaderChoice;
  anchor: Anchor;
  side: "both" | Side;
  /** Dollars per 1.0 price move per contract (or per coin for crypto). */
  pointValue: number;
  contracts: number;
  /** Size each trade to risk this many dollars at the stop instead (crypto). */
  riskDollars?: number;
  commission: number;
  slippageTicks: number;
  tick: number;
  maxHold: number;
  skipFomc: boolean;
  skipEarly: boolean;
  vix: "any" | "low" | "mid" | "high";
  /** Only take entries inside these New York minutes of the day, [from, to). */
  hours?: [number, number] | null;
  context: BacktestContext;
}

export interface BacktestTrade {
  n: number;
  reader: ReaderId;
  side: Side;
  entryIndex: number;
  exitIndex: number;
  entryT: number;
  exitT: number;
  entry: number;
  stop: number;
  target: number;
  exit: number;
  outcome: "target" | "stop" | "time";
  r: number;
  pnl: number;
  hold: number;
  date: string;
  hour: number;
  weekday: number;
  vix: number | null;
  fomc: boolean;
}

export interface Group {
  key: string;
  n: number;
  wins: number;
  netR: number;
  pnl: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  bars: number;
  from: number;
  to: number;
  skipped: { fomc: number; early: number; vix: number; side: number; hours: number };
  stats: {
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    netR: number;
    expectancyR: number;
    pnl: number;
    profitFactor: number;
    avgWinR: number;
    avgLossR: number;
    maxDrawdown: number;
    maxDrawdownR: number;
    longestLosing: number;
    avgHold: number;
    best: number;
    worst: number;
  };
  equity: { t: number; pnl: number; r: number }[];
  by: { hour: Group[]; weekday: Group[]; reader: Group[]; side: Group[]; vix: Group[]; fomc: Group[]; month: Group[] };
}

export const VIX_BANDS = { low: [0, 15], mid: [15, 25], high: [25, Infinity] } as const;
const vixBand = (v: number | null) => (v == null ? "No VIX data" : v < 15 ? "VIX under 15" : v < 25 ? "VIX 15–25" : "VIX 25+");
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function lastVixBefore(vix: Record<string, number>, dates: string[], date: string) {
  // dates sorted ascending; binary search for the last date < `date`.
  let lo = 0;
  let hi = dates.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < date) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best >= 0 ? vix[dates[best]] : null;
}

function group(trades: BacktestTrade[], key: (t: BacktestTrade) => string, order?: string[]): Group[] {
  const m = new Map<string, Group>();
  for (const t of trades) {
    const k = key(t);
    const g = m.get(k) ?? { key: k, n: 0, wins: 0, netR: 0, pnl: 0 };
    g.n++;
    if (t.r > 0) g.wins++;
    g.netR += t.r;
    g.pnl += t.pnl;
    m.set(k, g);
  }
  const out = [...m.values()];
  return order ? out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) : out.sort((a, b) => a.key.localeCompare(b.key));
}

export function runBacktest(bars: Bar[], o: BacktestOptions, onProgress?: (done: number, total: number) => void): BacktestResult {
  const ctx = _internal.context(bars, o.anchor);
  const readers = o.reader === "auto" ? READER_ORDER : [o.reader];
  const fomc = new Set(o.context.fomc);
  const early = new Set(o.context.early);
  const vixDates = Object.keys(o.context.vix).sort();
  const slip = o.slippageTicks * o.tick;
  const trades: BacktestTrade[] = [];
  const skipped = { fomc: 0, early: 0, vix: 0, side: 0, hours: 0 };
  // Orders rest on whole ticks: for a long both round down (stop a touch wider,
  // target a touch nearer), for a short both round up.
  const onTick = (p: number, dir: 1 | -1) => +((dir > 0 ? Math.floor(p / o.tick + 1e-9) : Math.ceil(p / o.tick - 1e-9)) * o.tick).toFixed(10);

  let busyUntil = -1;
  const n = bars.length;
  for (let i = 30; i < n - 1; i++) {
    if (onProgress && i % 2000 === 0) onProgress(i, n);
    if (i <= busyUntil) continue;
    const f = _internal.detectAt(ctx, i, readers);
    if (!f) continue;
    if (o.side !== "both" && f.side !== o.side) {
      skipped.side++;
      continue;
    }
    const s = sessionOf(bars[i].t);
    const date = s.date;
    if (o.hours && (s.minute < o.hours[0] || s.minute >= o.hours[1])) {
      skipped.hours++;
      continue;
    }
    if (o.skipFomc && fomc.has(date)) {
      skipped.fomc++;
      continue;
    }
    if (o.skipEarly && early.has(date)) {
      skipped.early++;
      continue;
    }
    const vix = vixDates.length ? lastVixBefore(o.context.vix, vixDates, date) : null;
    if (o.vix !== "any") {
      const [lo, hi] = VIX_BANDS[o.vix];
      if (vix == null || vix < lo || vix >= hi) {
        skipped.vix++;
        continue;
      }
    }
    const dir: 1 | -1 = f.side === "long" ? 1 : -1;
    const entry = f.entry + dir * slip;
    const stop = onTick(f.stop, dir);
    const target = onTick(f.target, dir);
    const risk = Math.abs(f.entry - stop);
    let exit = NaN;
    let exitIndex = -1;
    let outcome: BacktestTrade["outcome"] = "time";
    const end = Math.min(n - 1, i + o.maxHold);
    for (let k = i + 1; k <= end; k++) {
      const x = bars[k];
      if (f.side === "long" ? x.l <= stop : x.h >= stop) {
        exit = stop - dir * slip;
        exitIndex = k;
        outcome = "stop";
        break;
      }
      if (f.side === "long" ? x.h >= target : x.l <= target) {
        exit = target;
        exitIndex = k;
        outcome = "target";
        break;
      }
    }
    if (exitIndex < 0) {
      // Not decided inside the data: a trade still open at the end is not counted.
      if (end === n - 1 && end - i < o.maxHold) break;
      exitIndex = end;
      exit = bars[end].c;
    }
    const units = o.riskDollars ? o.riskDollars / (risk * o.pointValue) : o.contracts;
    const pnl = (exit - entry) * dir * o.pointValue * units - o.commission * (o.riskDollars ? 1 : o.contracts);
    trades.push({
      n: trades.length + 1,
      reader: f.reader,
      side: f.side,
      entryIndex: i,
      exitIndex,
      entryT: bars[i].t,
      exitT: bars[exitIndex].t,
      entry,
      stop,
      target,
      exit,
      outcome,
      r: ((exit - entry) * dir) / risk,
      pnl,
      hold: exitIndex - i,
      date,
      hour: Math.floor(s.minute / 60),
      weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
      vix,
      fomc: fomc.has(date),
    });
    busyUntil = exitIndex;
  }
  onProgress?.(n, n);

  let eq = 0;
  let eqR = 0;
  let peak = 0;
  let peakR = 0;
  let maxDd = 0;
  let maxDdR = 0;
  let streak = 0;
  let longest = 0;
  const equity = trades.map((t) => {
    eq += t.pnl;
    eqR += t.r;
    peak = Math.max(peak, eq);
    peakR = Math.max(peakR, eqR);
    maxDd = Math.max(maxDd, peak - eq);
    maxDdR = Math.max(maxDdR, peakR - eqR);
    streak = t.r <= 0 ? streak + 1 : 0;
    longest = Math.max(longest, streak);
    return { t: t.exitT, pnl: eq, r: eqR };
  });
  const wins = trades.filter((t) => t.r > 0);
  const losses = trades.filter((t) => t.r <= 0);
  const gross = wins.reduce((a, t) => a + t.pnl, 0);
  const lost = -losses.reduce((a, t) => a + t.pnl, 0);
  const netR = trades.reduce((a, t) => a + t.r, 0);
  return {
    trades,
    bars: n,
    from: bars[0]?.t ?? 0,
    to: bars[n - 1]?.t ?? 0,
    skipped,
    stats: {
      trades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: trades.length ? wins.length / trades.length : 0,
      netR,
      expectancyR: trades.length ? netR / trades.length : 0,
      pnl: eq,
      profitFactor: lost ? gross / lost : wins.length ? Infinity : 0,
      avgWinR: wins.length ? wins.reduce((a, t) => a + t.r, 0) / wins.length : 0,
      avgLossR: losses.length ? losses.reduce((a, t) => a + t.r, 0) / losses.length : 0,
      maxDrawdown: maxDd,
      maxDrawdownR: maxDdR,
      longestLosing: longest,
      avgHold: trades.length ? trades.reduce((a, t) => a + t.hold, 0) / trades.length : 0,
      best: trades.length ? Math.max(...trades.map((t) => t.pnl)) : 0,
      worst: trades.length ? Math.min(...trades.map((t) => t.pnl)) : 0,
    },
    equity,
    by: {
      hour: group(trades, (t) => String(t.hour).padStart(2, "0")),
      weekday: group(trades, (t) => WEEKDAYS[t.weekday], WEEKDAYS),
      reader: group(trades, (t) => t.reader),
      side: group(trades, (t) => (t.side === "long" ? "Long" : "Short"), ["Long", "Short"]),
      vix: group(trades, (t) => vixBand(t.vix), ["VIX under 15", "VIX 15–25", "VIX 25+", "No VIX data"]),
      fomc: group(trades, (t) => (t.fomc ? "FOMC days" : "Other days"), ["FOMC days", "Other days"]),
      month: group(trades, (t) => t.date.slice(0, 7)),
    },
  };
}

/** The trades as CSV, for a spreadsheet or another journal. */
export function tradesCsv(r: BacktestResult) {
  const head = "n,strategy,side,entry_time,exit_time,entry,stop,target,exit,outcome,r,pnl,hold_bars,date,vix,fomc";
  const rows = r.trades.map((t) =>
    [t.n, t.reader, t.side, new Date(t.entryT * 1000).toISOString(), new Date(t.exitT * 1000).toISOString(), t.entry, t.stop, t.target, t.exit, t.outcome, t.r.toFixed(3), t.pnl.toFixed(2), t.hold, t.date, t.vix ?? "", t.fomc ? 1 : 0].join(","),
  );
  return [head, ...rows].join("\n");
}
