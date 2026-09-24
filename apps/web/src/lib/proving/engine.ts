// ─── Proving Ground · strategy engine ──────────────────────────────────────────
// Runs a rule-based intraday strategy over real bars, one session at a time.
//
// Honesty rules the engine is built on:
//   • Decisions use only bars that have closed. A signal on bar i fills at the
//     open of bar i+1, plus slippage.
//   • If a bar touches both the stop and the target, the stop wins.
//   • Every session is independent and deterministic, so a live test and a
//     replay of the same day produce the same trades.
// ───────────────────────────────────────────────────────────────────────────────

import { RTH_CLOSE, RTH_OPEN, hhmmToMinute, sessionOf, type Bar } from "@/lib/pilot/market";

export type StrategyId =
  | "double-break-vwap"
  | "sr-retest"
  | "orb"
  | "vwap-pullback"
  | "failed-breakout"
  | "tv-signals";

export type Instrument = "MNQ" | "MES" | "NQ" | "ES";
export type Timeframe = "1m" | "2m" | "5m";

export const INSTRUMENTS: Record<Instrument, { label: string; pointValue: number; tick: number; feeRT: number; source: string; micro: boolean }> = {
  MNQ: { label: "Micro Nasdaq", pointValue: 2, tick: 0.25, feeRT: 1.04, source: "NQ=F", micro: true },
  MES: { label: "Micro S&P", pointValue: 5, tick: 0.25, feeRT: 1.04, source: "ES=F", micro: true },
  NQ: { label: "E-mini Nasdaq", pointValue: 20, tick: 0.25, feeRT: 4.2, source: "NQ=F", micro: false },
  ES: { label: "E-mini S&P", pointValue: 50, tick: 0.25, feeRT: 4.2, source: "ES=F", micro: false },
};

export const TF_MINUTES: Record<Timeframe, number> = { "1m": 1, "2m": 2, "5m": 5 };
/** How far back the free feed goes for each timeframe. */
export const TF_HISTORY_DAYS: Record<Timeframe, number> = { "1m": 7, "2m": 55, "5m": 55 };

export interface StrategyInfo {
  label: string;
  short: string;
  blurb: string;
  rules: string[];
}

export const STRATEGIES: Record<StrategyId, StrategyInfo> = {
  "double-break-vwap": {
    label: "Double-break VWAP",
    short: "DB-VWAP",
    blurb: "Close through VWAP, get pushed back, close through again. The second break is the entry.",
    rules: [
      "VWAP anchored at 09:30 ET",
      "A close must clear VWAP by 2 ticks to count as a break",
      "The second break in the same direction within 20 bars triggers",
      "Structure stop: the extreme between the two breaks",
    ],
  },
  "sr-retest": {
    label: "S/R break & retest",
    short: "Retest",
    blurb: "Price closes through a key level, comes back to it, holds, and closes away.",
    rules: [
      "Levels: prior-day high/low, overnight high/low",
      "Break = a close through the level",
      "Retest within 12 bars that tags the level and closes back away",
      "Structure stop: beyond the level and the retest bar",
    ],
  },
  orb: {
    label: "Opening range breakout",
    short: "ORB",
    blurb: "The first 15 minutes set the range. The first close outside it is the trade.",
    rules: [
      "Range = 09:30–09:45 ET high and low",
      "Entry on the first close outside the range",
      "One trade per direction per day",
      "Structure stop: the range midpoint",
    ],
  },
  "vwap-pullback": {
    label: "VWAP trend pullback",
    short: "VWAP PB",
    blurb: "In a trend above (or below) a rising VWAP, buy the first tag back into it.",
    rules: [
      "Trend: 6 closes on one side of VWAP, VWAP sloping that way",
      "Entry: a bar tags VWAP and closes back in trend direction",
      "Structure stop: beyond the pullback bar and VWAP",
    ],
  },
  "failed-breakout": {
    label: "Failed breakout (sweep)",
    short: "Sweep",
    blurb: "Price runs a prior-day or overnight extreme, fails, and closes back inside. Fade it.",
    rules: [
      "Levels: prior-day and overnight highs/lows",
      "A wick through the level, then a close back inside within 3 bars",
      "Structure stop: beyond the sweep extreme",
    ],
  },
  "tv-signals": {
    label: "My TradingView signals",
    short: "TV",
    blurb: "Takes every signal your Pilot Signals indicator sends, with your stop and target.",
    rules: [
      "Entry on the bar after the signal arrives",
      "Fixed stop in points, target as a multiple of risk",
      "Only signals received while the test is running",
    ],
  },
};

export interface StrategyConfig {
  strategy: StrategyId;
  instrument: Instrument;
  timeframe: Timeframe;
  contracts: number;
  stopMode: "structure" | "fixed";
  /** Fixed stop, and the fallback size, in points. */
  stopPoints: number;
  minStop: number;
  maxStop: number;
  targetR: number;
  /** Move the stop to entry once the trade is this many R in profit. 0 = off. */
  breakEvenR: number;
  maxTrades: number;
  waitMinutes: number;
  lastEntry: string;
  flatBy: string;
  direction: "both" | "long" | "short";
  /** Stop for the day after this many losses in a row. 0 = never. */
  stopAfterLosses: number;
  /** Stop for the day once realized P&L reaches -this. 0 = off. */
  dailyStop: number;
  slippageTicks: number;
}

/** Rough recent prices, used only when the caller has no live quote. */
const REF_PRICE: Record<Instrument, number> = { MNQ: 30000, NQ: 30000, MES: 7500, ES: 7500 };
const tickRound = (n: number) => Math.max(0.25, Math.round(n * 4) / 4);

/**
 * Sensible starting rules. Stop bounds scale with price, because a 20-point
 * stop meant something very different on NQ at 15,000 than it does at 30,000.
 */
export function defaultConfig(strategy: StrategyId, instrument: Instrument = "MNQ", refPrice?: number): StrategyConfig {
  const px = refPrice && refPrice > 0 ? refPrice : REF_PRICE[instrument];
  return {
    strategy,
    instrument,
    timeframe: "5m",
    contracts: instrument === "MNQ" || instrument === "MES" ? 2 : 1,
    stopMode: strategy === "tv-signals" ? "fixed" : "structure",
    stopPoints: tickRound(Math.round(px * 0.001)),
    minStop: tickRound(Math.round(px * 0.0004)),
    maxStop: tickRound(Math.round(px * 0.0033)),
    targetR: 2,
    breakEvenR: 0,
    maxTrades: 3,
    waitMinutes: 15,
    lastEntry: "11:30",
    flatBy: "15:55",
    direction: "both",
    stopAfterLosses: 2,
    dailyStop: 0,
    slippageTicks: 1,
  };
}

export interface SimTrade {
  id: string;
  date: string;
  side: "long" | "short";
  /** Unix seconds of the fill bar's open. */
  entryT: number;
  entryPx: number;
  exitT: number;
  exitPx: number;
  stopPx: number;
  targetPx: number;
  qty: number;
  pnl: number;
  r: number;
  exit: "target" | "stop" | "breakeven" | "time" | "open";
  why: string;
  /** Best and worst open P&L the trade saw, in dollars. */
  mfe: number;
  mae: number;
}

export interface DaySim {
  date: string;
  trades: SimTrade[];
  pnl: number;
  /** Per-bar equity (realized + open) as [low, high, close], dollars from the day's start. */
  path: [number, number, number][];
  /** Unix seconds of the first bar, and the bar length, to rebuild times. */
  t0: number;
  step: number;
  partial: boolean;
  halted?: string;
}

export interface SessionCtx {
  pdh: number | null;
  pdl: number | null;
  pdc: number | null;
  onh: number | null;
  onl: number | null;
}

export interface Session {
  date: string;
  rth: Bar[];
  ctx: SessionCtx;
}

/** Split a bar series into RTH sessions, each with the levels known before its open. */
export function toSessions(bars: Bar[]): Session[] {
  const tagged = bars.map((b) => ({ b, ...sessionOf(b.t) }));
  const dates = [...new Set(tagged.filter((x) => x.minute >= RTH_OPEN && x.minute < RTH_CLOSE).map((x) => x.date))].sort();
  const out: Session[] = [];
  dates.forEach((date, i) => {
    const rth = tagged.filter((x) => x.date === date && x.minute >= RTH_OPEN && x.minute < RTH_CLOSE).map((x) => x.b);
    const prior = i > 0 ? tagged.filter((x) => x.date === dates[i - 1] && x.minute >= RTH_OPEN && x.minute < RTH_CLOSE).map((x) => x.b) : [];
    const on = tagged.filter((x) => x.session === date && !(x.date === date && x.minute >= RTH_OPEN)).map((x) => x.b);
    out.push({
      date,
      rth,
      ctx: {
        pdh: prior.length ? Math.max(...prior.map((b) => b.h)) : null,
        pdl: prior.length ? Math.min(...prior.map((b) => b.l)) : null,
        pdc: prior.length ? prior[prior.length - 1].c : null,
        onh: on.length ? Math.max(...on.map((b) => b.h)) : null,
        onl: on.length ? Math.min(...on.map((b) => b.l)) : null,
      },
    });
  });
  return out;
}

type Signal = { side: "long" | "short"; stop: number | null; why: string };

interface Position {
  side: "long" | "short";
  entryT: number;
  entryPx: number;
  stopPx: number;
  targetPx: number;
  risk: number;
  why: string;
  mfe: number;
  mae: number;
  be: boolean;
}

const minuteOf = (t: number) => sessionOf(t).minute;

/**
 * Simulate one RTH session. `partial` means the session is still trading: an
 * open position is marked to the last close and reported as open.
 */
export function runSession(
  s: Session,
  cfg: StrategyConfig,
  opts: { partial?: boolean; signals?: { t: number; side: "long" | "short" }[] } = {},
): DaySim {
  const spec = INSTRUMENTS[cfg.instrument];
  const tf = TF_MINUTES[cfg.timeframe];
  const bars = s.rth;
  const slip = cfg.slippageTicks * spec.tick;
  const buf = 2 * spec.tick;
  const pv = spec.pointValue * cfg.contracts;
  const fee = spec.feeRT * cfg.contracts;
  const firstEntry = RTH_OPEN + cfg.waitMinutes;
  const lastEntry = hhmmToMinute(cfg.lastEntry) ?? RTH_CLOSE;
  const flatBy = hhmmToMinute(cfg.flatBy) ?? RTH_CLOSE - 5;

  const trades: SimTrade[] = [];
  const path: DaySim["path"] = [];
  let realized = 0;
  let pos: Position | null = null;
  let pending: Signal | null = null;
  let lossStreak = 0;
  let halted: string | undefined;

  // Strategy state.
  let cumPV = 0;
  let cumV = 0;
  const vw: number[] = [];
  let vSide = 0;
  let lastUp = -1;
  let lastDn = -1;
  const levels = [
    { name: "PDH", px: s.ctx.pdh, dir: 0, at: -1, swept: -1 },
    { name: "PDL", px: s.ctx.pdl, dir: 0, at: -1, swept: -1 },
    { name: "ONH", px: s.ctx.onh, dir: 0, at: -1, swept: -1 },
    { name: "ONL", px: s.ctx.onl, dir: 0, at: -1, swept: -1 },
  ].filter((l): l is { name: string; px: number; dir: number; at: number; swept: number } => l.px != null);
  let orh = -Infinity;
  let orl = Infinity;
  const orbTaken = { long: false, short: false };

  const close = (b: Bar, px: number, exit: SimTrade["exit"]) => {
    if (!pos) return;
    const dir = pos.side === "long" ? 1 : -1;
    const fillPx = exit === "target" ? px : px - dir * slip;
    const pnl = (fillPx - pos.entryPx) * dir * pv - fee;
    realized += pnl;
    trades.push({
      id: `${s.date}-${trades.length + 1}`,
      date: s.date,
      side: pos.side,
      entryT: pos.entryT,
      entryPx: pos.entryPx,
      exitT: b.t,
      exitPx: fillPx,
      stopPx: pos.stopPx,
      targetPx: pos.targetPx,
      qty: cfg.contracts,
      pnl: Math.round(pnl * 100) / 100,
      r: Math.round(((fillPx - pos.entryPx) * dir / pos.risk) * 100) / 100,
      exit,
      why: pos.why,
      mfe: Math.round(pos.mfe * pv),
      mae: Math.round(pos.mae * pv),
    });
    lossStreak = pnl < 0 ? lossStreak + 1 : 0;
    pos = null;
    if (cfg.stopAfterLosses > 0 && lossStreak >= cfg.stopAfterLosses) halted = `${lossStreak} losses in a row`;
    if (cfg.dailyStop > 0 && realized <= -cfg.dailyStop) halted = `Daily stop of $${cfg.dailyStop} reached`;
  };

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const openMin = minuteOf(b.t);
    const closeMin = openMin + tf;

    // 1 · Fill the order the previous bar's close produced.
    if (pending && !pos && !halted) {
      const dir = pending.side === "long" ? 1 : -1;
      const entry = b.o + dir * slip;
      let stop = cfg.stopMode === "structure" && pending.stop != null ? pending.stop : entry - dir * cfg.stopPoints;
      let risk = (entry - stop) * dir;
      if (cfg.stopMode === "structure" && risk < cfg.minStop) {
        stop = entry - dir * cfg.minStop;
        risk = cfg.minStop;
      }
      if (risk > 0 && risk <= cfg.maxStop && openMin < flatBy) {
        pos = {
          side: pending.side,
          entryT: b.t,
          entryPx: entry,
          stopPx: stop,
          targetPx: entry + dir * risk * cfg.targetR,
          risk,
          why: pending.why,
          mfe: 0,
          mae: 0,
          be: false,
        };
      }
      pending = null;
    }

    // 2 · Manage the open position against this bar's range. Stop first.
    if (pos) {
      const dir = pos.side === "long" ? 1 : -1;
      const fav = dir === 1 ? b.h - pos.entryPx : pos.entryPx - b.l;
      const adv = dir === 1 ? b.l - pos.entryPx : pos.entryPx - b.h;
      pos.mfe = Math.max(pos.mfe, fav);
      pos.mae = Math.min(pos.mae, adv);
      const stopHit = dir === 1 ? b.l <= pos.stopPx : b.h >= pos.stopPx;
      const targetHit = dir === 1 ? b.h >= pos.targetPx : b.l <= pos.targetPx;
      if (stopHit) close(b, pos.stopPx, pos.be ? "breakeven" : "stop");
      else if (targetHit) close(b, pos.targetPx, "target");
      else if (closeMin >= flatBy) close(b, b.c, "time");
      else if (cfg.breakEvenR > 0 && !pos.be && fav >= pos.risk * cfg.breakEvenR) {
        pos.stopPx = pos.entryPx;
        pos.be = true;
      }
    }

    // 3 · Indicators, including this bar.
    cumPV += ((b.h + b.l + b.c) / 3) * (b.v || 1);
    cumV += b.v || 1;
    const v = cumPV / cumV;
    vw.push(v);
    if (closeMin <= RTH_OPEN + 15) {
      orh = Math.max(orh, b.h);
      orl = Math.min(orl, b.l);
    }

    // 4 · Look for a new entry on this bar's close.
    let sig: Signal | null = null;
    switch (cfg.strategy) {
      case "double-break-vwap": {
        if (b.c > v + buf && vSide !== 1) {
          if (lastUp >= 0 && i - lastUp <= 20) {
            let lo = Infinity;
            for (let k = lastUp; k <= i; k++) lo = Math.min(lo, bars[k].l);
            sig = { side: "long", stop: lo - spec.tick, why: "Second close above VWAP" };
            lastUp = -1;
          } else lastUp = i;
          vSide = 1;
        } else if (b.c < v - buf && vSide !== -1) {
          if (lastDn >= 0 && i - lastDn <= 20) {
            let hi = -Infinity;
            for (let k = lastDn; k <= i; k++) hi = Math.max(hi, bars[k].h);
            sig = { side: "short", stop: hi + spec.tick, why: "Second close below VWAP" };
            lastDn = -1;
          } else lastDn = i;
          vSide = -1;
        }
        break;
      }
      case "sr-retest": {
        const prev = bars[i - 1];
        for (const L of levels) {
          if (prev && b.c > L.px + buf && prev.c <= L.px + buf) {
            L.dir = 1;
            L.at = i;
          } else if (prev && b.c < L.px - buf && prev.c >= L.px - buf) {
            L.dir = -1;
            L.at = i;
          } else if (L.dir !== 0 && i > L.at && i - L.at <= 12 && !sig) {
            const tol = 4 * spec.tick;
            if (L.dir === 1 && b.l <= L.px + tol && b.c > L.px + buf) {
              sig = { side: "long", stop: Math.min(b.l, L.px) - tol, why: `Retest held above ${L.name}` };
              L.dir = 0;
            } else if (L.dir === -1 && b.h >= L.px - tol && b.c < L.px - buf) {
              sig = { side: "short", stop: Math.max(b.h, L.px) + tol, why: `Retest held below ${L.name}` };
              L.dir = 0;
            }
          }
        }
        break;
      }
      case "orb": {
        if (closeMin > RTH_OPEN + 15 && Number.isFinite(orh)) {
          const mid = (orh + orl) / 2;
          if (!orbTaken.long && b.c > orh + buf) {
            sig = { side: "long", stop: mid, why: "Close above the opening range" };
            orbTaken.long = true;
          } else if (!orbTaken.short && b.c < orl - buf) {
            sig = { side: "short", stop: mid, why: "Close below the opening range" };
            orbTaken.short = true;
          }
        }
        break;
      }
      case "vwap-pullback": {
        if (i >= 7) {
          const tol = 4 * spec.tick;
          const above = bars.slice(i - 6, i).every((x, k) => x.c > vw[i - 6 + k]);
          const below = bars.slice(i - 6, i).every((x, k) => x.c < vw[i - 6 + k]);
          if (above && v > vw[i - 6] && b.l <= v + tol && b.c > v + buf && b.c > b.o)
            sig = { side: "long", stop: Math.min(b.l, v) - tol, why: "Pullback to rising VWAP held" };
          else if (below && v < vw[i - 6] && b.h >= v - tol && b.c < v - buf && b.c < b.o)
            sig = { side: "short", stop: Math.max(b.h, v) + tol, why: "Pullback to falling VWAP held" };
        }
        break;
      }
      case "failed-breakout": {
        for (const L of levels) {
          const res = L.name.endsWith("H");
          if (L.swept < 0 && (res ? b.h > L.px + buf : b.l < L.px - buf)) L.swept = i;
          if (L.swept >= 0 && !sig && i - L.swept <= 3 && (res ? b.c < L.px - buf : b.c > L.px + buf)) {
            let ext = res ? -Infinity : Infinity;
            for (let k = L.swept; k <= i; k++) ext = res ? Math.max(ext, bars[k].h) : Math.min(ext, bars[k].l);
            sig = res
              ? { side: "short", stop: ext + spec.tick, why: `Swept ${L.name} and failed` }
              : { side: "long", stop: ext - spec.tick, why: `Swept ${L.name} and failed` };
            L.swept = Number.MAX_SAFE_INTEGER; // one sweep trade per level per day
          } else if (L.swept >= 0 && L.swept !== Number.MAX_SAFE_INTEGER && i - L.swept > 3) L.swept = -1;
        }
        break;
      }
      case "tv-signals": {
        const end = b.t + tf * 60;
        const hit = opts.signals?.find((x) => x.t >= b.t && x.t < end);
        if (hit) sig = { side: hit.side, stop: null, why: "TradingView signal" };
        break;
      }
    }

    const allowed =
      !pos && !halted && closeMin >= firstEntry && closeMin < lastEntry && trades.length < cfg.maxTrades && i < bars.length - 1 + (opts.partial ? 1 : 0);
    if (sig && allowed && (cfg.direction === "both" || cfg.direction === sig.side)) pending = sig;

    // 5 · Equity for this bar: realized plus the open trade at the bar's low, high and close.
    let lo = realized;
    let hi = realized;
    let cl = realized;
    if (pos) {
      const dir = pos.side === "long" ? 1 : -1;
      const at = (px: number) => realized + (px - pos!.entryPx) * dir * pv;
      lo = Math.min(at(b.l), at(b.h));
      hi = Math.max(at(b.l), at(b.h));
      cl = at(b.c);
    }
    path.push([Math.round(lo), Math.round(hi), Math.round(cl)]);
  }

  // Session over (or data ends): anything still open is closed at the last bar.
  const last = bars[bars.length - 1];
  if (pos && last) {
    if (opts.partial) {
      const p = pos as Position;
      const dir = p.side === "long" ? 1 : -1;
      trades.push({
        id: `${s.date}-${trades.length + 1}`,
        date: s.date,
        side: p.side,
        entryT: p.entryT,
        entryPx: p.entryPx,
        exitT: last.t,
        exitPx: last.c,
        stopPx: p.stopPx,
        targetPx: p.targetPx,
        qty: cfg.contracts,
        pnl: Math.round(((last.c - p.entryPx) * dir * pv - fee) * 100) / 100,
        r: Math.round((((last.c - p.entryPx) * dir) / p.risk) * 100) / 100,
        exit: "open",
        why: p.why,
        mfe: Math.round(p.mfe * pv),
        mae: Math.round(p.mae * pv),
      });
    } else close(last, last.c, "time");
  }

  const closedPnl = trades.filter((t) => t.exit !== "open").reduce((a, t) => a + t.pnl, 0);
  return {
    date: s.date,
    trades,
    pnl: Math.round(closedPnl * 100) / 100,
    path,
    t0: bars[0]?.t ?? 0,
    step: tf * 60,
    partial: !!opts.partial,
    halted,
  };
}

/** Plain numbers for a set of days, the way a trader reads a backtest. */
export function stats(days: DaySim[]) {
  const trades = days.flatMap((d) => d.trades.filter((t) => t.exit !== "open"));
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const gross = wins.reduce((a, t) => a + t.pnl, 0);
  const lost = -losses.reduce((a, t) => a + t.pnl, 0);
  let peak = 0;
  let eq = 0;
  let maxDd = 0;
  for (const d of days) {
    eq += d.pnl;
    peak = Math.max(peak, eq);
    maxDd = Math.max(maxDd, peak - eq);
  }
  return {
    trades: trades.length,
    net: Math.round(trades.reduce((a, t) => a + t.pnl, 0)),
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: lost ? gross / lost : wins.length ? Infinity : 0,
    avgR: trades.length ? trades.reduce((a, t) => a + t.r, 0) / trades.length : 0,
    avgWin: wins.length ? gross / wins.length : 0,
    avgLoss: losses.length ? -lost / losses.length : 0,
    maxDrawdown: Math.round(maxDd),
    days: days.filter((d) => d.trades.length).length,
  };
}
