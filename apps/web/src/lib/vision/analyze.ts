// ─── Vision · chart reader ─────────────────────────────────────────────────────
// Reads closed bars the way a discretionary trader would, with one reader per
// strategy the trader already uses in TradePilot:
//
//   sweep    Liquidity sweep & reversal: a swing is wicked through, price
//            closes back, then reclaims the 21 EMA or turns momentum.
//   dbvwap   Double-break VWAP: close through VWAP, get pushed back, close
//            through again in the same direction. The second break is entry.
//   sd       Supply & demand (Octavia): a tight base that launched an impulse
//            is the zone; the first return that rejects it is entry.
//   orb      Opening range breakout: the first close outside the session's
//            first 15 minutes.
//   vwappb   VWAP trend pullback: in a trend on one side of a sloping VWAP,
//            the first tag back into it that closes in trend direction.
//
// Every number shown to the trader comes from here. "Historical matches" are
// the same reader run over every earlier bar of the loaded history, each one
// replayed forward to see whether its target or its stop came first (the stop
// wins a bar that touches both). Nothing is invented; when history is too
// thin to rate a setup, the result says so.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { RTH_CLOSE, RTH_OPEN, sessionOf } from "@/lib/pilot/market";
import { atr as atrOf, ema as emaOf, pivots as pivotsOf, rsi as rsiOf, type Pivot } from "./indicators";

export type Side = "long" | "short";
export type ReaderId = "sweep" | "dbvwap" | "sd" | "orb" | "vwappb";
export type ReaderChoice = ReaderId | "auto";

export interface ReaderInfo {
  id: ReaderId;
  label: string;
  short: string;
  blurb: string;
  /** Overlay lines this reader is drawn with. */
  line: "ema" | "vwap";
}

export const READERS: Record<ReaderId, ReaderInfo> = {
  dbvwap: { id: "dbvwap", label: "Double-break VWAP", short: "DB-VWAP", blurb: "Close through VWAP, pushed back, close through again", line: "vwap" },
  sd: { id: "sd", label: "Supply & demand (Octavia)", short: "S&D", blurb: "First return to the base that launched an impulse", line: "ema" },
  sweep: { id: "sweep", label: "Liquidity sweep", short: "Sweep", blurb: "Stops taken at a swing, then a reclaim", line: "ema" },
  orb: { id: "orb", label: "Opening range breakout", short: "ORB", blurb: "First close outside the first 15 minutes", line: "vwap" },
  vwappb: { id: "vwappb", label: "VWAP trend pullback", short: "VWAP PB", blurb: "First tag of a sloping VWAP in trend", line: "vwap" },
};
export const READER_ORDER: ReaderId[] = ["dbvwap", "sd", "sweep", "orb", "vwappb"];

export interface Callout {
  n: number;
  title: string;
  detail: string;
  i: number;
  price: number;
  /** level: a dot with a dashed line to the price axis. ring: a circle around a candle. */
  mark: "level" | "ring";
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
  /** Sum of R over decided matches. */
  totalR: number;
  /** Median bars from entry to the target among wins. */
  medianBarsToTarget: number | null;
  /** Percentile path of later closes, in R from entry, for the projection cone. */
  cone: { k: number; p25: number; p50: number; p75: number }[];
}

export interface Setup {
  id: string;
  reader: ReaderId;
  side: Side;
  /** The level the setup turns on (swing, VWAP, zone edge or range edge). */
  level: number;
  levelIndex: number;
  /** First bar of the pattern box. */
  sweepIndex: number;
  /** Bar whose close confirmed the setup; the entry is that close. */
  index: number;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  zone: { top: number; bottom: number; from: number } | null;
  callouts: Callout[];
  volume: { from: number; to: number; ratio: number };
  history: SetupHistory;
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
  reader: ReaderChoice;
  ema: number[];
  /** Session-anchored VWAP; NaN outside a session. */
  vwap: number[];
  rsi: number[];
  atr: number[];
  items: ScanItem[];
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

export type Anchor = "rth" | "utc";

interface Ctx {
  bars: Bar[];
  ema: number[];
  rsi: number[];
  atr: number[];
  piv: Pivot[];
  volAvg: number[];
  vwap: number[];
  /** Index of the bar that opened each bar's session, or -1 outside one. */
  sessionStart: number[];
  /** Minutes since the session's anchor. */
  sessionMinute: number[];
  tfMinutes: number;
}

const sessionCache = new Map<number, { date: string; minute: number }>();
function nyMinute(t: number) {
  let hit = sessionCache.get(t);
  if (!hit) {
    const s = sessionOf(t);
    hit = { date: s.date, minute: s.minute };
    if (sessionCache.size > 20_000) sessionCache.clear();
    sessionCache.set(t, hit);
  }
  return hit;
}

function context(bars: Bar[], anchor: Anchor): Ctx {
  const closes = bars.map((b) => b.c);
  const vols = bars.map((b) => b.v);
  const volAvg: number[] = [];
  let sum = 0;
  vols.forEach((v, i) => {
    sum += v;
    if (i >= 20) sum -= vols[i - 20];
    volAvg.push(sum / Math.min(i + 1, 20));
  });
  // Sessions: the RTH day for futures, the UTC day for crypto.
  const vwap: number[] = [];
  const sessionStart: number[] = [];
  const sessionMinute: number[] = [];
  let start = -1;
  let key = "";
  let pv = 0;
  let vv = 0;
  bars.forEach((b, i) => {
    let inSession: boolean;
    let k: string;
    let minute: number;
    if (anchor === "rth") {
      const s = nyMinute(b.t);
      inSession = s.minute >= RTH_OPEN && s.minute < RTH_CLOSE;
      k = s.date;
      minute = s.minute - RTH_OPEN;
    } else {
      inSession = true;
      k = new Date(b.t * 1000).toISOString().slice(0, 10);
      minute = Math.floor((b.t % 86_400) / 60);
    }
    if (!inSession) {
      vwap.push(NaN);
      sessionStart.push(-1);
      sessionMinute.push(-1);
      return;
    }
    if (k !== key) {
      key = k;
      start = i;
      pv = 0;
      vv = 0;
    }
    const w = b.v || 1;
    pv += ((b.h + b.l + b.c) / 3) * w;
    vv += w;
    vwap.push(pv / vv);
    sessionStart.push(start);
    sessionMinute.push(minute);
  });
  const tfMinutes = bars.length > 1 ? Math.max(1, Math.round((bars[bars.length - 1].t - bars[bars.length - 2].t) / 60)) : 15;
  return { bars, ema: emaOf(closes, 21), rsi: rsiOf(closes, 14), atr: atrOf(bars, 14), piv: pivotsOf(bars, SPAN), volAvg, vwap, sessionStart, sessionMinute, tfMinutes };
}

interface Fired {
  reader: ReaderId;
  side: Side;
  level: number;
  levelIndex: number;
  sweepIndex: number;
  index: number;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  zone: Setup["zone"];
  /** Bars the callouts point at, reader specific. */
  marks: number[];
  volume: Setup["volume"];
}

/** Pivots confirmed before bar i within the lookback. Pivots are in index order, so a binary search finds the start. */
function known(c: Ctx, i: number) {
  const a = c.piv;
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (a[m].i < i - LOOKBACK) lo = m + 1;
    else hi = m;
  }
  const out: Pivot[] = [];
  for (let k = lo; k < a.length && a[k].i + SPAN < i; k++) out.push(a[k]);
  return out;
}

/** Stop, target and the plan's sanity checks, shared by every reader. */
function plan(c: Ctx, i: number, side: Side, stop: number, base: Omit<Fired, "entry" | "stop" | "target" | "rr" | "volume">): Fired | null {
  const a = c.atr[i];
  const entry = c.bars[i].c;
  const risk = side === "long" ? entry - stop : stop - entry;
  if (!(risk > 0.1 * a) || risk > 4 * a) return null;
  const opposite = known(c, i)
    .filter((x) => x.kind === (side === "long" ? "high" : "low"))
    .map((x) => x.price)
    .filter((px) => (side === "long" ? px - entry >= 1.2 * risk : entry - px >= 1.2 * risk))
    .sort((x, y) => (side === "long" ? x - y : y - x));
  let target = opposite[0] ?? (side === "long" ? entry + 2 * risk : entry - 2 * risk);
  if (Math.abs(target - entry) > 4 * risk) target = side === "long" ? entry + 4 * risk : entry - 4 * risk;
  const from = base.sweepIndex;
  const before = c.volAvg[Math.max(0, from - 1)] || 1;
  const span = c.bars.slice(from, i + 1);
  const ratio = span.reduce((s, x) => s + x.v, 0) / span.length / before;
  return { ...base, entry, stop, target, rr: Math.abs(target - entry) / risk, volume: { from, to: i, ratio } };
}

// ── Readers ────────────────────────────────────────────────────────────────────

function sweepAt(c: Ctx, i: number): Fired | null {
  const { bars, ema, rsi, atr } = c;
  const a = atr[i];
  const piv = known(c, i);
  for (const side of ["long", "short"] as const) {
    for (const p of piv.filter((x) => x.kind === (side === "long" ? "low" : "high")).reverse()) {
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
      let taken = false;
      for (let k = p.i + 1; k < sweep; k++) if (side === "long" ? bars[k].l < p.price : bars[k].h > p.price) taken = true;
      if (taken) continue;
      const seg = bars.slice(sweep, i + 1);
      const extreme = side === "long" ? Math.min(...seg.map((x) => x.l)) : Math.max(...seg.map((x) => x.h));
      if (side === "long" ? extreme < bars[sweep].l : extreme > bars[sweep].h) continue;
      const ok = (k: number) => {
        const x = bars[k];
        const reclaim = side === "long" ? x.c > p.price : x.c < p.price;
        const e = side === "long" ? x.c > ema[k] : x.c < ema[k];
        const t = side === "long" ? rsi[k] > rsi[k - 2] && x.c > x.o : rsi[k] < rsi[k - 2] && x.c < x.o;
        return reclaim && (e || t);
      };
      if (!ok(i)) continue;
      let earlier = false;
      for (let k = sweep; k < i; k++) if (ok(k)) earlier = true;
      if (earlier) continue;
      const stop = side === "long" ? extreme - 0.15 * a : extreme + 0.15 * a;
      const f = plan(c, i, side, stop, { reader: "sweep", side, level: p.price, levelIndex: p.i, sweepIndex: sweep, index: i, zone: null, marks: [p.i, sweep, i] });
      if (f) return f;
    }
  }
  return null;
}

function dbvwapAt(c: Ctx, i: number): Fired | null {
  const { bars, vwap, atr, sessionStart } = c;
  const s0 = sessionStart[i];
  if (s0 < 0 || i - s0 < 3 || !Number.isFinite(vwap[i])) return null;
  const a = atr[i];
  const buf = 0.05 * a;
  for (const side of ["long", "short"] as const) {
    const dir = side === "long" ? 1 : -1;
    const above = (k: number) => dir * (bars[k].c - vwap[k]) > buf;
    const back = (k: number) => dir * (bars[k].c - vwap[k]) < 0;
    // The second break: this bar closes through, the bar before did not.
    if (!above(i) || above(i - 1)) continue;
    // Find the push back and, before it, the first break, all inside 20 bars and this session.
    let pushed = -1;
    for (let k = i - 1; k > Math.max(s0, i - 20); k--) {
      if (back(k)) {
        pushed = k;
        break;
      }
      if (!above(k) && !back(k)) continue;
    }
    if (pushed < 0) continue;
    let first = -1;
    for (let k = pushed - 1; k >= Math.max(s0 + 1, i - 20); k--) {
      if (above(k) && !above(k - 1)) {
        first = k;
        break;
      }
    }
    if (first < 0) continue;
    const seg = bars.slice(first, i + 1);
    const extreme = side === "long" ? Math.min(...seg.map((x) => x.l)) : Math.max(...seg.map((x) => x.h));
    const stop = side === "long" ? extreme - 0.1 * a : extreme + 0.1 * a;
    const f = plan(c, i, side, stop, { reader: "dbvwap", side, level: vwap[i], levelIndex: first, sweepIndex: first, index: i, zone: null, marks: [first, pushed, i] });
    if (f) return f;
  }
  return null;
}

function sdAt(c: Ctx, i: number): Fired | null {
  const { bars, atr } = c;
  const a = atr[i];
  for (const side of ["long", "short"] as const) {
    const dir = side === "long" ? 1 : -1;
    // The trigger bar has to close the trade's way; without that no base can fire.
    if (dir * (bars[i].c - bars[i].o) <= 0) continue;
    // A base: one or two small-bodied bars. Then an impulse of 1.5+ ATR within four bars.
    for (let b = i - 6; b >= Math.max(20, i - 80); b--) {
      const ab = atr[b];
      if (Math.abs(bars[b].c - bars[b].o) >= 0.6 * ab) continue;
      const pair = Math.abs(bars[b - 1].c - bars[b - 1].o) < 0.6 * ab;
      const top = pair ? Math.max(bars[b - 1].h, bars[b].h) : bars[b].h;
      const bottom = pair ? Math.min(bars[b - 1].l, bars[b].l) : bars[b].l;
      const end = Math.min(b + 5, i);
      if (end <= b + 1) continue;
      let ext = side === "long" ? -Infinity : Infinity;
      for (let k = b + 1; k < end; k++) ext = side === "long" ? Math.max(ext, bars[k].c) : Math.min(ext, bars[k].c);
      const impulse = side === "long" ? ext - top : bottom - ext;
      if (impulse < 1.5 * ab) continue;
      // The impulse has to leave the zone; the first return after that is the trade.
      let left = -1;
      for (let k = b + 1; k < i; k++)
        if (side === "long" ? bars[k].l > top : bars[k].h < bottom) {
          left = k;
          break;
        }
      if (left < 0 || i - left < 2) continue;
      let touched = false;
      for (let k = left + 1; k < i && !touched; k++) if (side === "long" ? bars[k].l <= top : bars[k].h >= bottom) touched = true;
      if (touched) continue;
      const edge = side === "long" ? top : bottom;
      const far = side === "long" ? bottom : top;
      const x = bars[i];
      const into = side === "long" ? x.l <= top : x.h >= bottom;
      const held = side === "long" ? x.l > far - 0.25 * a : x.h < far + 0.25 * a;
      const rejected = dir * (x.c - edge) > 0 && dir * (x.c - x.o) > 0;
      if (!(into && held && rejected)) continue;
      const stop = side === "long" ? far - 0.15 * a : far + 0.15 * a;
      const f = plan(c, i, side, stop, { reader: "sd", side, level: edge, levelIndex: b, sweepIndex: Math.max(0, i - 2), index: i, zone: { top, bottom, from: pair ? b - 1 : b }, marks: [b, i, i] });
      if (f) return f;
      break;
    }
  }
  return null;
}

function orbAt(c: Ctx, i: number): Fired | null {
  const { bars, sessionStart, sessionMinute, tfMinutes, atr } = c;
  if (tfMinutes > 15) return null;
  const s0 = sessionStart[i];
  if (s0 < 0) return null;
  const rangeEnd = s0 + Math.max(1, Math.round(15 / tfMinutes)) - 1;
  if (i <= rangeEnd || sessionMinute[i] > 150) return null;
  const range = bars.slice(s0, rangeEnd + 1);
  const hi = Math.max(...range.map((x) => x.h));
  const lo = Math.min(...range.map((x) => x.l));
  const mid = (hi + lo) / 2;
  for (const side of ["long", "short"] as const) {
    const out = (k: number) => (side === "long" ? bars[k].c > hi : bars[k].c < lo);
    if (!out(i)) continue;
    let earlier = false;
    for (let k = rangeEnd + 1; k < i; k++) if (out(k)) earlier = true;
    if (earlier) continue;
    const stop = side === "long" ? Math.min(mid, bars[i].c - 0.5 * atr[i]) : Math.max(mid, bars[i].c + 0.5 * atr[i]);
    const f = plan(c, i, side, stop, { reader: "orb", side, level: side === "long" ? hi : lo, levelIndex: s0, sweepIndex: s0, index: i, zone: { top: hi, bottom: lo, from: s0 }, marks: [s0, i, i] });
    if (f) return f;
  }
  return null;
}

function vwappbAt(c: Ctx, i: number): Fired | null {
  const { bars, vwap, atr, sessionStart } = c;
  const s0 = sessionStart[i];
  if (s0 < 0 || i - s0 < 8 || !Number.isFinite(vwap[i - 7])) return null;
  const a = atr[i];
  for (const side of ["long", "short"] as const) {
    const dir = side === "long" ? 1 : -1;
    let trend = true;
    for (let k = i - 5; k < i; k++) if (dir * (bars[k].c - vwap[k]) <= 0) trend = false;
    if (!trend || dir * (vwap[i - 1] - vwap[i - 7]) <= 0) continue;
    const x = bars[i];
    const tag = side === "long" ? x.l <= vwap[i] + 0.2 * a : x.h >= vwap[i] - 0.2 * a;
    const held = dir * (x.c - vwap[i]) > 0 && dir * (x.c - x.o) > 0;
    if (!(tag && held)) continue;
    // One per trend leg: no tag since the trend began.
    let tagged = false;
    for (let k = i - 5; k < i; k++) if (side === "long" ? bars[k].l <= vwap[k] + 0.1 * a : bars[k].h >= vwap[k] - 0.1 * a) tagged = true;
    if (tagged) continue;
    const stop = side === "long" ? Math.min(x.l, vwap[i]) - 0.25 * a : Math.max(x.h, vwap[i]) + 0.25 * a;
    const f = plan(c, i, side, stop, { reader: "vwappb", side, level: vwap[i], levelIndex: i - 6, sweepIndex: i - 6, index: i, zone: null, marks: [i - 6, i, i] });
    if (f) return f;
  }
  return null;
}

const DETECT: Record<ReaderId, (c: Ctx, i: number) => Fired | null> = { sweep: sweepAt, dbvwap: dbvwapAt, sd: sdAt, orb: orbAt, vwappb: vwappbAt };

function detectAt(c: Ctx, i: number, readers: ReaderId[]): Fired | null {
  if (i < 30 || !c.atr[i]) return null;
  for (const r of readers) {
    const f = DETECT[r](c, i);
    if (f) return f;
  }
  return null;
}

// ── Callouts ───────────────────────────────────────────────────────────────────

function callouts(c: Ctx, f: Fired, fmt: (n: number) => string): Callout[] {
  const { bars } = c;
  const [m1, m2, m3] = f.marks;
  const long = f.side === "long";
  const spike = f.volume.ratio > 1.3 ? " + volume spike" : "";
  switch (f.reader) {
    case "sweep": {
      const sw = bars[m2];
      return long
        ? [
            { n: 1, title: "Prior low", detail: `Stop-losses cluster just below ${fmt(f.level)}`, i: m1, price: f.level, mark: "level" },
            { n: 2, title: "Liquidity sweep", detail: `Wick grabs the stops ${fmt(f.level - sw.l)} under, then snaps back`, i: m2, price: sw.l, mark: "ring" },
            { n: 3, title: "Reversal confirmed", detail: `${bars[m3].c > c.ema[m3] ? "Close above EMA 21" : "Momentum turned up"}${spike}`, i: m3, price: bars[m3].c, mark: "ring" },
          ]
        : [
            { n: 1, title: "Resistance", detail: `Sellers keep defending ${fmt(f.level)}`, i: m1, price: f.level, mark: "level" },
            { n: 2, title: "Rejection wick", detail: `Buyers pushed ${fmt(sw.h - f.level)} above, got sold off`, i: m2, price: sw.h, mark: "ring" },
            { n: 3, title: "Momentum fading", detail: f.volume.ratio < 1 ? "Lower close as buy volume dries up" : `${bars[m3].c < c.ema[m3] ? "Close below EMA 21" : "RSI rolling over"}${spike}`, i: m3, price: bars[m3].c, mark: "ring" },
          ];
    }
    case "dbvwap":
      return [
        { n: 1, title: "First break", detail: `Closed ${long ? "above" : "below"} VWAP`, i: m1, price: bars[m1].c, mark: "ring" },
        { n: 2, title: "Pushed back", detail: `Back ${long ? "under" : "over"} VWAP: the test`, i: m2, price: long ? bars[m2].l : bars[m2].h, mark: "ring" },
        { n: 3, title: "Second break", detail: `Closed ${long ? "above" : "below"} VWAP again${spike}`, i: m3, price: bars[m3].c, mark: "ring" },
      ];
    case "sd":
      return [
        { n: 1, title: long ? "Demand zone" : "Supply zone", detail: `The base that launched the ${long ? "rally" : "drop"}`, i: m1, price: f.level, mark: "level" },
        { n: 2, title: "Back into the zone", detail: "First return since the impulse", i: m2, price: long ? bars[m2].l : bars[m2].h, mark: "ring" },
        { n: 3, title: "Rejection confirmed", detail: `${long ? "Green" : "Red"} close back out of the zone${spike}`, i: m3, price: bars[m3].c, mark: "ring" },
      ];
    case "orb":
      return [
        { n: 1, title: "Opening range", detail: `First 15 minutes: ${fmt(f.zone!.bottom)} to ${fmt(f.zone!.top)}`, i: m1, price: f.level, mark: "level" },
        { n: 2, title: "Close outside", detail: `First close ${long ? "above" : "below"} the range${spike}`, i: m2, price: bars[m2].c, mark: "ring" },
      ];
    case "vwappb":
      return [
        { n: 1, title: "Trend leg", detail: `Five closes ${long ? "above a rising" : "below a falling"} VWAP`, i: m1, price: bars[m1].c, mark: "ring" },
        { n: 2, title: "Tag of VWAP", detail: "First pullback into VWAP this leg", i: m2, price: long ? bars[m2].l : bars[m2].h, mark: "ring" },
        { n: 3, title: "Held", detail: `Closed back ${long ? "up" : "down"} in trend${spike}`, i: m3, price: bars[m3].c, mark: "ring" },
      ];
  }
}

// ── History ────────────────────────────────────────────────────────────────────

function replay(bars: Bar[], s: Pick<Fired, "side" | "index" | "stop" | "target">, limit = REPLAY) {
  const end = Math.min(bars.length - 1, s.index + limit);
  for (let k = s.index + 1; k <= end; k++) {
    const x = bars[k];
    if (s.side === "long" ? x.l <= s.stop : x.h >= s.stop) return { result: "stop" as const, at: k };
    if (s.side === "long" ? x.h >= s.target : x.l <= s.target) return { result: "target" as const, at: k };
  }
  return { result: "open" as const, at: null };
}

function history(c: Ctx, reader: ReaderId, side: Side, upTo: number): SetupHistory {
  const paths: number[][] = [];
  const toTarget: number[] = [];
  let wins = 0;
  let losses = 0;
  let undecided = 0;
  let sumR = 0;
  const seen = c.bars.slice(0, upTo + 1);
  for (let j = 30; j < upTo; j++) {
    const s = detectAt(c, j, [reader]);
    if (!s || s.side !== side) continue;
    const r = replay(seen, s);
    if (r.result === "target") {
      wins++;
      sumR += s.rr;
      toTarget.push(r.at! - j);
    } else if (r.result === "stop") {
      losses++;
      sumR -= 1;
    } else undecided++;
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
    matches: decided + undecided,
    wins,
    losses,
    undecided,
    hitRate: decided >= MIN_RATED ? wins / decided : null,
    expectancyR: decided >= MIN_RATED ? sumR / decided : null,
    totalR: sumR,
    medianBarsToTarget: toTarget.length ? toTarget[Math.floor(toTarget.length / 2)] : null,
    cone,
  };
}

// ── Scan ───────────────────────────────────────────────────────────────────────

function scanItems(c: Ctx, last: number, fmt: (n: number) => string, setup: Setup | null) {
  const { bars, piv, rsi, ema } = c;
  const kp = piv.filter((p) => p.i + SPAN <= last);
  const highs = kp.filter((p) => p.kind === "high").slice(-2);
  const lows = kp.filter((p) => p.kind === "low").slice(-2);
  let structure: ScanItem = { key: "structure", label: "Market structure", value: "Range", tone: "flat" };
  if (highs.length === 2 && lows.length === 2) {
    const hh = highs[1].price > highs[0].price;
    const hl = lows[1].price > lows[0].price;
    if (hh && hl) structure = { ...structure, value: "Bullish", tone: "up" };
    else if (!hh && !hl) structure = { ...structure, value: "Bearish", tone: "down" };
  }
  const close = bars[last].c;
  const below = [...kp].reverse().find((p) => p.kind === "low" && p.price < close && !bars.slice(p.i + 1, last + 1).some((b) => b.l < p.price)) ?? null;
  const above = [...kp].reverse().find((p) => p.kind === "high" && p.price > close && !bars.slice(p.i + 1, last + 1).some((b) => b.h > p.price)) ?? null;
  const liquidity: ScanItem =
    setup && setup.reader === "sweep"
      ? { key: "liquidity", label: "Liquidity zones", value: `Swept ${fmt(setup.level)}`, tone: setup.side === "long" ? "up" : "down" }
      : { key: "liquidity", label: "Liquidity zones", value: below && above ? `${fmt(below.price)} / ${fmt(above.price)}` : below ? `Below ${fmt(below.price)}` : above ? `Above ${fmt(above.price)}` : "None nearby", tone: "flat" };
  const recent = bars.slice(Math.max(0, last - 19), last + 1);
  const buy = recent.filter((b) => b.c > b.o).reduce((s, b) => s + b.v, 0);
  const sell = recent.filter((b) => b.c < b.o).reduce((s, b) => s + b.v, 0);
  const skew = buy + sell ? Math.round(((buy - sell) / (buy + sell)) * 100) : 0;
  const flow: ScanItem = { key: "flow", label: "Order flow & volume", value: Math.abs(skew) < 5 ? "Balanced" : skew > 0 ? `Buyers +${skew}%` : `Sellers +${-skew}%`, tone: skew >= 5 ? "up" : skew <= -5 ? "down" : "flat" };
  let div: "bull" | "bear" | null = null;
  if (highs.length === 2 && highs[1].price > highs[0].price && rsi[highs[1].i] < rsi[highs[0].i] - 2) div = "bear";
  if (lows.length === 2 && lows[1].price < lows[0].price && rsi[lows[1].i] > rsi[lows[0].i] + 2) div = "bull";
  const back = Math.max(0, last - 3);
  const rising = rsi[last] > rsi[back] && ema[last] >= ema[back];
  const falling = rsi[last] < rsi[back] && ema[last] <= ema[back];
  const momentum: ScanItem = div
    ? { key: "momentum", label: "Momentum (RSI / EMA)", value: "Divergence", tone: div === "bull" ? "up" : "down" }
    : { key: "momentum", label: "Momentum (RSI / EMA)", value: rising ? "Rising" : falling ? "Falling" : "Flat", tone: rising ? "up" : falling ? "down" : "flat" };
  return { items: [structure, liquidity, flow, momentum], pools: { below, above } };
}

function overview(setup: Setup | null, items: ScanItem[], pools: Scan["pools"], fmt: (n: number) => string, closeIdx: number, choice: ReaderChoice) {
  const name = choice === "auto" ? "any of your strategies" : READERS[choice].label;
  if (!setup) {
    const watch = [pools.below && `${fmt(pools.below.price)} below`, pools.above && `${fmt(pools.above.price)} above`].filter(Boolean).join(" and ");
    return `${items[0].value} structure, ${items[2].value.toLowerCase()}, momentum ${items[3].value.toLowerCase()}. No fresh signal from ${name}.${watch ? ` Liquidity rests at ${watch}.` : ""}`;
  }
  const h = setup.history;
  const what = setup.callouts.map((c) => c.title.toLowerCase()).join(", then ");
  const rated =
    h.hitRate !== null
      ? ` ${READERS[setup.reader].label} fired ${h.matches} times in the loaded history; the target came before the stop ${Math.round(h.hitRate * 100)}% of the time (${h.wins} of ${h.wins + h.losses}), ${h.expectancyR! >= 0 ? "+" : ""}${h.expectancyR!.toFixed(2)}R a trade on average.`
      : ` ${READERS[setup.reader].label} has fired only ${h.matches} time${h.matches === 1 ? "" : "s"} in the loaded history, too few to rate.`;
  const ago = (k: number | null) => closeIdx - (k ?? closeIdx);
  const when =
    setup.outcome === "target"
      ? ` It reached its target ${ago(setup.outcomeIndex)} bars ago. Scanning for the next one.`
      : setup.outcome === "stop"
        ? ` It was stopped out ${ago(setup.outcomeIndex)} bars ago. Scanning for the next one.`
        : closeIdx - setup.index > 1
          ? ` It fired ${closeIdx - setup.index} bars ago and is still open.`
          : "";
  return `${setup.side === "long" ? "Long" : "Short"} ${READERS[setup.reader].label.toLowerCase()}: ${what}.${rated} Plan: ${fmt(setup.entry)} entry, ${fmt(setup.stop)} stop, ${fmt(setup.target)} target (${setup.rr.toFixed(1)}R).${when}`;
}

export interface AnalyzeOptions {
  forming?: boolean;
  fmt?: (n: number) => string;
  /** How far back to look for the latest setup, in bars. */
  maxAge?: number;
  reader?: ReaderChoice;
  anchor?: Anchor;
  /** Score history on these bars instead (used by demo mode, so its odds stay real). */
  historyBars?: Bar[];
  /** Ignore setups that fired before this bar (demo mode: only the staged one). */
  minIndex?: number;
  /** Read only the setup that fired on exactly this bar (backtest trade viewer). */
  atIndex?: number;
}

/**
 * Read the chart. `bars` may include the bar still forming as the last
 * element (`forming = true`); only closed bars are analysed.
 */
export function analyze(all: Bar[], opts: AnalyzeOptions = {}): Scan {
  const fmt = opts.fmt ?? ((n: number) => n.toFixed(2));
  const choice = opts.reader ?? "auto";
  const readers = choice === "auto" ? READER_ORDER : [choice];
  const anchor = opts.anchor ?? "utc";
  const bars = opts.forming ? all.slice(0, -1) : all;
  const last = bars.length - 1;
  const c = context(bars, anchor);
  if (bars.length < MIN_HISTORY)
    return { closed: bars.length, reader: choice, ema: c.ema, vwap: c.vwap, rsi: c.rsi, atr: c.atr, items: [], pools: { below: null, above: null }, setup: null, overview: "Waiting for enough bars to read the chart." };

  let setup: Setup | null = null;
  const maxAge = opts.maxAge ?? 30;
  const hi = opts.atIndex ?? last;
  const lo = opts.atIndex ?? Math.max(30, last - maxAge, opts.minIndex ?? 0);
  for (let i = hi; i >= lo; i--) {
    const f = detectAt(c, i, readers);
    if (!f) continue;
    const r = replay(bars, f, bars.length);
    let h: SetupHistory;
    if (opts.historyBars && opts.historyBars.length >= MIN_HISTORY) {
      const hb = opts.forming ? opts.historyBars.slice(0, -1) : opts.historyBars;
      const hc = context(hb, anchor);
      h = history(hc, f.reader, f.side, hb.length - 1);
    } else h = history(c, f.reader, f.side, f.index - 1);
    setup = {
      ...f,
      id: `${f.reader}-${f.side}-${bars[f.index].t}`,
      callouts: callouts(c, f, fmt),
      history: h,
      outcome: r.result,
      outcomeIndex: r.at,
      fresh: last - i <= 1 && r.result === "open",
    };
    break;
  }
  const { items, pools } = scanItems(c, last, fmt, setup && setup.outcome === "open" ? setup : null);
  return { closed: bars.length, reader: choice, ema: c.ema, vwap: c.vwap, rsi: c.rsi, atr: c.atr, items, pools, setup, overview: overview(setup, items, pools, fmt, last, choice) };
}

/** Every reader on the same bars: how often each fired and how it did. For the strategy picker. */
export function readerStats(all: Bar[], opts: { forming?: boolean; anchor?: Anchor } = {}) {
  const bars = opts.forming ? all.slice(0, -1) : all;
  if (bars.length < MIN_HISTORY) return {} as Partial<Record<ReaderId, SetupHistory>>;
  const c = context(bars, opts.anchor ?? "utc");
  const out: Partial<Record<ReaderId, SetupHistory>> = {};
  for (const r of READER_ORDER) {
    const longs = history(c, r, "long", bars.length - 1);
    const shorts = history(c, r, "short", bars.length - 1);
    const wins = longs.wins + shorts.wins;
    const losses = longs.losses + shorts.losses;
    const decided = wins + losses;
    const sumR = longs.totalR + shorts.totalR;
    out[r] = {
      matches: longs.matches + shorts.matches,
      wins,
      losses,
      undecided: longs.undecided + shorts.undecided,
      hitRate: decided >= MIN_RATED ? wins / decided : null,
      expectancyR: decided >= MIN_RATED ? sumR / decided : null,
      totalR: sumR,
      medianBarsToTarget: null,
      cone: [],
    };
  }
  return out;
}

export const _internal = { context, detectAt };
