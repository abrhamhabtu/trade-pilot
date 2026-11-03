// ─── Vision · chart reader ─────────────────────────────────────────────────────
// Reads closed bars the way a discretionary trader would and looks for one
// setup family: a liquidity sweep and reversal.
//
//   Long:  a confirmed swing low (where stops rest) is wicked through, price
//          closes back above it, then confirms by reclaiming the 21 EMA or by
//          turning momentum up.
//   Short: the mirror at a swing high: a rejection wick through resistance,
//          a close back below it, and momentum fading.
//
// Every number shown to the trader is computed here from the bars on screen:
// the "historical matches" are this same detector run over the loaded
// history, each one replayed forward to see whether its target or its stop
// came first (the stop wins a bar that touches both). Nothing is made up; when
// history is too thin to rate a setup, the result says so.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { atr as atrOf, ema as emaOf, pivots as pivotsOf, rsi as rsiOf, type Pivot } from "./indicators";

export type Side = "long" | "short";

export interface Callout {
  n: number;
  title: string;
  detail: string;
  i: number;
  price: number;
}

export interface SetupHistory {
  matches: number;
  wins: number;
  losses: number;
  /** Still open when the replay window ran out. */
  undecided: number;
  /** wins / (wins + losses), or null under MIN_RATED decided matches. */
  hitRate: number | null;
  /** Average R per decided match: a win pays its own reward-to-risk, a loss costs 1R. */
  expectancyR: number | null;
  /** Median bars from entry to the target among wins. */
  medianBarsToTarget: number | null;
  /** Percentile path of later closes, in R from entry, for the projection cone. */
  cone: { k: number; p25: number; p50: number; p75: number }[];
}

export interface Setup {
  id: string;
  side: Side;
  /** The pivot that was swept. */
  level: number;
  levelIndex: number;
  sweepIndex: number;
  /** Bar whose close confirmed the setup; the entry is that close. */
  index: number;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  callouts: Callout[];
  volume: { from: number; to: number; ratio: number };
  history: SetupHistory;
  /** How the setup has played out on the bars since it fired. */
  outcome: "open" | "target" | "stop";
  outcomeIndex: number | null;
  /** Fired on the last closed bar or the one before: still actionable. */
  fresh: boolean;
}

export interface ScanItem {
  key: "structure" | "liquidity" | "flow" | "momentum";
  label: string;
  value: string;
  tone: "up" | "down" | "flat";
}

export interface Scan {
  closed: number;
  ema: number[];
  rsi: number[];
  atr: number[];
  items: ScanItem[];
  /** Unswept pools: the nearest swing low below and high above the last close. */
  pools: { below: Pivot | null; above: Pivot | null };
  setup: Setup | null;
  overview: string;
}

const SPAN = 3;
const LOOKBACK = 60;
const SWEEP_WINDOW = 6;
const REPLAY = 48;
const MIN_RATED = 8;
const MIN_HISTORY = 60;

interface Ctx {
  bars: Bar[];
  ema: number[];
  rsi: number[];
  atr: number[];
  piv: Pivot[];
  volAvg: number[];
}

function context(bars: Bar[]): Ctx {
  const closes = bars.map((b) => b.c);
  const vols = bars.map((b) => b.v);
  const volAvg: number[] = [];
  let sum = 0;
  vols.forEach((v, i) => {
    sum += v;
    if (i >= 20) sum -= vols[i - 20];
    volAvg.push(sum / Math.min(i + 1, 20));
  });
  return { bars, ema: emaOf(closes, 21), rsi: rsiOf(closes, 14), atr: atrOf(bars, 14), piv: pivotsOf(bars, SPAN), volAvg };
}

const pct = (a: number, b: number) => ((a - b) / b) * 100;

/**
 * The setup that fires at bar i, if any, using only bars 0..i. A setup fires
 * once: on the first bar its confirmation is true.
 */
function detectAt(c: Ctx, i: number, wantFirst = true): Omit<Setup, "history" | "outcome" | "outcomeIndex" | "fresh" | "id" | "callouts"> | null {
  const { bars, ema, rsi, atr, piv } = c;
  const a = atr[i];
  if (i < 30 || !a) return null;
  const b = bars[i];
  // Pivots known by bar i: confirmed SPAN bars later.
  const known = piv.filter((p) => p.i + SPAN < i && p.i >= i - LOOKBACK);
  for (const side of ["long", "short"] as const) {
    const pools = known.filter((p) => p.kind === (side === "long" ? "low" : "high")).reverse();
    for (const p of pools) {
      // The sweep: a wick through the pool after the pivot was confirmed, closing back on the right side.
      let sweep = -1;
      for (let s = Math.max(p.i + SPAN + 1, i - SWEEP_WINDOW); s <= i; s++) {
        const x = bars[s];
        const through = side === "long" ? x.l < p.price - 0.05 * a : x.h > p.price + 0.05 * a;
        const back = side === "long" ? x.c > p.price - 0.3 * a : x.c < p.price + 0.3 * a;
        if (through && back) {
          sweep = s;
          break;
        }
      }
      if (sweep < 0) continue;
      // Nothing between the pivot and the sweep may already have taken the pool.
      let taken = false;
      for (let k = p.i + 1; k < sweep; k++) if (side === "long" ? bars[k].l < p.price : bars[k].h > p.price) taken = true;
      if (taken) continue;
      const extreme = side === "long" ? Math.min(...bars.slice(sweep, i + 1).map((x) => x.l)) : Math.max(...bars.slice(sweep, i + 1).map((x) => x.h));
      // No new extreme after the sweep bar: the sweep has to hold.
      if (side === "long" ? extreme < bars[sweep].l : extreme > bars[sweep].h) continue;
      const reclaim = side === "long" ? b.c > p.price : b.c < p.price;
      const emaSide = side === "long" ? b.c > ema[i] : b.c < ema[i];
      const turn = side === "long" ? rsi[i] > rsi[i - 2] && b.c > b.o : rsi[i] < rsi[i - 2] && b.c < b.o;
      const confirmed = (k: number) => {
        const x = bars[k];
        const r = side === "long" ? x.c > p.price : x.c < p.price;
        const e = side === "long" ? x.c > ema[k] : x.c < ema[k];
        const t = side === "long" ? rsi[k] > rsi[k - 2] && x.c > x.o : rsi[k] < rsi[k - 2] && x.c < x.o;
        return r && (e || t);
      };
      if (!(reclaim && (emaSide || turn))) continue;
      if (wantFirst) {
        let earlier = false;
        for (let k = sweep; k < i; k++) if (confirmed(k)) earlier = true;
        if (earlier) continue;
      }
      const entry = b.c;
      const stop = side === "long" ? extreme - 0.15 * a : extreme + 0.15 * a;
      const risk = Math.abs(entry - stop);
      if (risk <= 0 || risk > 4 * a) continue;
      // Target: the next swing the other way, if it pays at least 1.2R; otherwise 2R. Capped at 4R.
      const opposite = known
        .filter((x) => x.kind === (side === "long" ? "high" : "low"))
        .map((x) => x.price)
        .filter((px) => (side === "long" ? px - entry >= 1.2 * risk : entry - px >= 1.2 * risk))
        .sort((x, y) => (side === "long" ? x - y : y - x));
      let target = opposite[0] ?? (side === "long" ? entry + 2 * risk : entry - 2 * risk);
      if (Math.abs(target - entry) > 4 * risk) target = side === "long" ? entry + 4 * risk : entry - 4 * risk;
      const before = c.volAvg[Math.max(0, sweep - 1)] || 1;
      const span = bars.slice(sweep, i + 1);
      const ratio = span.reduce((s2, x) => s2 + x.v, 0) / span.length / before;
      return { side, level: p.price, levelIndex: p.i, sweepIndex: sweep, index: i, entry, stop, target, rr: Math.abs(target - entry) / risk, volume: { from: sweep, to: i, ratio } };
    }
  }
  return null;
}

type Fired = NonNullable<ReturnType<typeof detectAt>>;

/** Walk forward from a setup: target or stop first, with the stop winning a bar that touches both. */
function replay(bars: Bar[], s: Pick<Fired, "side" | "index" | "stop" | "target">, limit = REPLAY) {
  const end = Math.min(bars.length - 1, s.index + limit);
  for (let k = s.index + 1; k <= end; k++) {
    const x = bars[k];
    const stopHit = s.side === "long" ? x.l <= s.stop : x.h >= s.stop;
    const targetHit = s.side === "long" ? x.h >= s.target : x.l <= s.target;
    if (stopHit) return { result: "stop" as const, at: k };
    if (targetHit) return { result: "target" as const, at: k };
  }
  return { result: "open" as const, at: null };
}

function history(c: Ctx, side: Side, upTo: number): SetupHistory {
  const paths: number[][] = [];
  const toTarget: number[] = [];
  let wins = 0;
  let losses = 0;
  let undecided = 0;
  let sumR = 0;
  for (let j = 30; j < upTo; j++) {
    const s = detectAt(c, j);
    if (!s || s.side !== side) continue;
    // Only replay bars that existed before the current setup fired.
    const r = replay(c.bars.slice(0, upTo + 1), s);
    if (r.result === "target") {
      wins++;
      sumR += s.rr;
      toTarget.push(r.at! - j);
    } else if (r.result === "stop") {
      losses++;
      sumR -= 1;
    }
    else undecided++;
    const risk = Math.abs(s.entry - s.stop);
    const dir = side === "long" ? 1 : -1;
    const path: number[] = [];
    for (let k = 1; k <= 24 && j + k <= upTo; k++) path.push(((c.bars[j + k].c - s.entry) * dir) / risk);
    paths.push(path);
  }
  const decided = wins + losses;
  const cone: SetupHistory["cone"] = [];
  for (let k = 1; k <= 24; k++) {
    const vals = paths.map((p) => p[k - 1]).filter((v) => v !== undefined).sort((x, y) => x - y);
    if (vals.length < 5) break;
    const q = (f: number) => vals[Math.min(vals.length - 1, Math.round(f * (vals.length - 1)))];
    cone.push({ k, p25: q(0.25), p50: q(0.5), p75: q(0.75) });
  }
  toTarget.sort((x, y) => x - y);
  return {
    matches: wins + losses + undecided,
    wins,
    losses,
    undecided,
    hitRate: decided >= MIN_RATED ? wins / decided : null,
    expectancyR: decided >= MIN_RATED ? sumR / decided : null,
    medianBarsToTarget: toTarget.length ? toTarget[Math.floor(toTarget.length / 2)] : null,
    cone,
  };
}

function callouts(c: Ctx, s: Fired, fmt: (n: number) => string): Callout[] {
  const { bars } = c;
  const sw = bars[s.sweepIndex];
  const conf = bars[s.index];
  if (s.side === "long")
    return [
      { n: 1, title: "Prior low", detail: `Stop-losses cluster just below ${fmt(s.level)}`, i: s.levelIndex, price: s.level },
      { n: 2, title: "Liquidity sweep", detail: `Wicked ${fmt(s.level - sw.l)} under, then closed back above`, i: s.sweepIndex, price: sw.l },
      {
        n: 3,
        title: "Reversal confirmed",
        detail: conf.c > c.ema[s.index] ? "Closed back above the 21 EMA" : "Momentum turned up on a green close",
        i: s.index,
        price: conf.c,
      },
    ];
  return [
    { n: 1, title: "Resistance", detail: `Sellers defending ${fmt(s.level)}`, i: s.levelIndex, price: s.level },
    { n: 2, title: "Rejection wick", detail: `Pushed ${fmt(sw.h - s.level)} above, got sold off`, i: s.sweepIndex, price: sw.h },
    {
      n: 3,
      title: "Momentum fading",
      detail: s.volume.ratio < 1 ? "Lower close as volume dries up" : conf.c < c.ema[s.index] ? "Closed back below the 21 EMA" : "RSI rolling over on a red close",
      i: s.index,
      price: conf.c,
    },
  ];
}

function scanItems(c: Ctx, last: number, fmt: (n: number) => string, setup: Setup | null): { items: ScanItem[]; pools: Scan["pools"] } {
  const { bars, piv, rsi, ema } = c;
  const known = piv.filter((p) => p.i + SPAN <= last);
  const highs = known.filter((p) => p.kind === "high").slice(-2);
  const lows = known.filter((p) => p.kind === "low").slice(-2);
  let structure: ScanItem = { key: "structure", label: "Market structure", value: "Range", tone: "flat" };
  if (highs.length === 2 && lows.length === 2) {
    const hh = highs[1].price > highs[0].price;
    const hl = lows[1].price > lows[0].price;
    if (hh && hl) structure = { ...structure, value: "Bullish", tone: "up" };
    else if (!hh && !hl) structure = { ...structure, value: "Bearish", tone: "down" };
  }
  const close = bars[last].c;
  const below = [...known].reverse().find((p) => p.kind === "low" && p.price < close && !bars.slice(p.i + 1, last + 1).some((b) => b.l < p.price)) ?? null;
  const above = [...known].reverse().find((p) => p.kind === "high" && p.price > close && !bars.slice(p.i + 1, last + 1).some((b) => b.h > p.price)) ?? null;
  const liquidity: ScanItem = setup
    ? { key: "liquidity", label: "Liquidity zones", value: `Swept ${fmt(setup.level)}`, tone: setup.side === "long" ? "up" : "down" }
    : { key: "liquidity", label: "Liquidity zones", value: below && above ? `${fmt(below.price)} / ${fmt(above.price)}` : below ? `Below ${fmt(below.price)}` : above ? `Above ${fmt(above.price)}` : "None nearby", tone: "flat" };
  const recent = bars.slice(Math.max(0, last - 19), last + 1);
  const buy = recent.filter((b) => b.c > b.o).reduce((s, b) => s + b.v, 0);
  const sell = recent.filter((b) => b.c < b.o).reduce((s, b) => s + b.v, 0);
  const skew = buy + sell ? Math.round(((buy - sell) / (buy + sell)) * 100) : 0;
  const flow: ScanItem = { key: "flow", label: "Order flow & volume", value: Math.abs(skew) < 5 ? "Balanced" : skew > 0 ? `Buyers +${skew}%` : `Sellers +${-skew}%`, tone: skew >= 5 ? "up" : skew <= -5 ? "down" : "flat" };
  // Bearish divergence: a higher price high on a lower RSI; bullish the mirror.
  let div: "bull" | "bear" | null = null;
  if (highs.length === 2 && highs[1].price > highs[0].price && rsi[highs[1].i] < rsi[highs[0].i] - 2) div = "bear";
  if (lows.length === 2 && lows[1].price < lows[0].price && rsi[lows[1].i] > rsi[lows[0].i] + 2) div = "bull";
  const rising = rsi[last] > rsi[Math.max(0, last - 3)] && ema[last] >= ema[Math.max(0, last - 3)];
  const falling = rsi[last] < rsi[Math.max(0, last - 3)] && ema[last] <= ema[Math.max(0, last - 3)];
  const momentum: ScanItem = div
    ? { key: "momentum", label: "Momentum (RSI / EMA)", value: "Divergence", tone: div === "bull" ? "up" : "down" }
    : { key: "momentum", label: "Momentum (RSI / EMA)", value: rising ? "Rising" : falling ? "Falling" : "Flat", tone: rising ? "up" : falling ? "down" : "flat" };
  return { items: [structure, liquidity, flow, momentum], pools: { below, above } };
}

function overview(setup: Setup | null, items: ScanItem[], pools: Scan["pools"], fmt: (n: number) => string, closeIdx: number) {
  if (!setup) {
    const watch = [pools.below && `a sweep of ${fmt(pools.below.price)} below`, pools.above && `a rejection at ${fmt(pools.above.price)} above`].filter(Boolean).join(" or ");
    return `${items[0].value} structure, ${items[2].value.toLowerCase()}, momentum ${items[3].value.toLowerCase()}. No sweep-and-reversal on the last ${SWEEP_WINDOW} bars.${watch ? ` Watching for ${watch}.` : ""}`;
  }
  const h = setup.history;
  const rated =
    h.hitRate !== null
      ? ` The same setup fired ${h.matches} times in the loaded history; the target came before the stop ${Math.round(h.hitRate * 100)}% of the time (${h.wins} of ${h.wins + h.losses} decided), ${h.expectancyR! >= 0 ? "+" : ""}${h.expectancyR!.toFixed(2)}R a trade on average.`
      : ` It has fired only ${h.matches} time${h.matches === 1 ? "" : "s"} in the loaded history, too few to rate.`;
  const age = closeIdx - setup.index;
  const when =
    setup.outcome === "target"
      ? ` It reached its target ${closeIdx - (setup.outcomeIndex ?? closeIdx)} bars ago. Scanning for the next one.`
      : setup.outcome === "stop"
        ? ` It was stopped out ${closeIdx - (setup.outcomeIndex ?? closeIdx)} bars ago. Scanning for the next one.`
        : age <= 1
          ? ""
          : ` It fired ${age} bars ago and is still open.`;
  return setup.side === "long"
    ? `Liquidity swept below ${fmt(setup.level)}, then price reclaimed it${setup.callouts[2].detail.includes("EMA") ? " and the 21 EMA" : " with momentum turning up"}.${rated} Plan: ${fmt(setup.entry)} entry, ${fmt(setup.stop)} stop, ${fmt(setup.target)} target (${setup.rr.toFixed(1)}R).${when}`
    : `Rejection at ${fmt(setup.level)} with a wick through resistance and a close back below.${rated} Plan: ${fmt(setup.entry)} entry, ${fmt(setup.stop)} stop, ${fmt(setup.target)} target (${setup.rr.toFixed(1)}R).${when}`;
}

/**
 * Read the chart. `bars` may include the bar still forming as the last
 * element (`forming = true`); only closed bars are analysed.
 */
export function analyze(all: Bar[], opts: { forming?: boolean; fmt?: (n: number) => string; maxAge?: number } = {}): Scan {
  const fmt = opts.fmt ?? ((n: number) => n.toFixed(2));
  const bars = opts.forming ? all.slice(0, -1) : all;
  const last = bars.length - 1;
  const c = context(bars);
  const empty: Scan = { closed: bars.length, ema: c.ema, rsi: c.rsi, atr: c.atr, items: [], pools: { below: null, above: null }, setup: null, overview: "Waiting for enough bars to read the chart." };
  if (bars.length < MIN_HISTORY) return empty;

  // The most recent setup within the last `maxAge` bars, replayed on what came after.
  let setup: Setup | null = null;
  const maxAge = opts.maxAge ?? 30;
  for (let i = last; i >= Math.max(30, last - maxAge); i--) {
    const s = detectAt(c, i);
    if (!s) continue;
    const r = replay(bars, s, bars.length);
    setup = {
      ...s,
      id: `${s.side}-${bars[s.index].t}`,
      callouts: callouts(c, s, fmt),
      history: history(c, s.side, s.index - 1),
      outcome: r.result,
      outcomeIndex: r.at,
      fresh: last - i <= 1 && r.result === "open",
    };
    break;
  }
  const { items, pools } = scanItems(c, last, fmt, setup && setup.outcome === "open" ? setup : null);
  return { closed: bars.length, ema: c.ema, rsi: c.rsi, atr: c.atr, items, pools, setup, overview: overview(setup, items, pools, fmt, last) };
}

export { pct };
