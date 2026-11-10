// ─── Vision · native patterns ──────────────────────────────────────────────────
// Setups beyond the five readers, built on the day's levels: sweeps of the
// prior day, overnight and Asia ranges, failed opening-range breaks, initial
// balance breaks, VWAP band reversion, fair value gaps, structure retests and
// compression breakouts.
//
// Every detector decides on bar i's close from bars 0..i only, and hands its
// stop to the readers' shared plan(), so stops, targets and sanity checks are
// the same as the five readers'. The thresholds in P are starting values: the
// statistics, not these numbers, decide what is shown as proven.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { sessionOf } from "@/lib/pilot/market";
import { _internal, registerInfo, type Anchor, type Callout, type Ctx, type Detector, type Fired, type PatternId, type ReaderInfo, type Side } from "./analyze";
import { bucketOfMinute, globexVwap, overnightFinal, type Bucket, type DayLevels } from "./levels";
import type { VisionSymbolId } from "./markets";

export type { PatternId } from "./analyze";

const { plan, known } = _internal;

export const P = {
  sweep: { window: 6, through: 0.05, stop: 0.15 },
  orbFail: { bars: 6, back: 0.1, stop: 0.15, minR: 1.2 },
  ib: { outer: 0.3, from: 10 * 60 + 30, until: 14 * 60 + 30, minHistory: 10 },
  band: { sd: 2, flatBars: 12, flat: 0.5, minR: 1.2, stop: 0.15, from: 10 * 60 },
  fvg: { look: 30, body: 1.2, gap: 0.3, stop: 0.15, held: 0.1 },
  bos: { look: 20, body: 0.8, tag: 0.2, stop: 0.15 },
  squeeze: { bars: 12, look: 60, ratio: 0.5, beyond: 0.2, vol: 1.3, cap: 1.5 },
};

export type Family = "reversal" | "breakout" | "continuation" | "mean-reversion";

export interface PatternInfo extends ReaderInfo {
  id: PatternId;
  family: Family;
  /** Two sentences: what it is, and why it might work. */
  idea: string;
  /** Where it is offered. */
  markets: VisionSymbolId[];
  /** Session windows it may fire in. */
  buckets: Bucket[];
  /** Largest timeframe in minutes. */
  maxTf: number;
  /** Needs day levels, so futures only. */
  levels: boolean;
  /** Playbooks in TradePilot that teach this, for "Open playbook". */
  playbooks?: string[];
}

const FUT: VisionSymbolId[] = ["NQ", "ES", "GC", "CL"];
const ALL: VisionSymbolId[] = ["NQ", "ES", "GC", "CL", "BTC", "ETH", "SOL", "XRP"];
const DAY: Bucket[] = ["asia", "london", "pre", "ny-open", "ny-mid", "ny-pm"];

export const PATTERNS: Record<PatternId, PatternInfo> = {
  asia_sweep: {
    id: "asia_sweep",
    label: "Asia range sweep",
    short: "Asia sweep",
    blurb: "London or New York runs the Asia high or low, then reclaims it",
    line: "vwap",
    family: "reversal",
    idea: "Asia's range collects resting stops on both sides; London and the New York open often run one side before turning. The trade is the reclaim after the run, with the stop past the sweep.",
    markets: FUT,
    buckets: ["london", "pre", "ny-open"],
    maxTf: 15,
    levels: true,
    playbooks: ["asia-session-gold-popoff", "asia-session-topdown", "liquidity-sweep"],
  },
  on_sweep: {
    id: "on_sweep",
    label: "Overnight high/low sweep",
    short: "ON sweep",
    blurb: "The open runs the overnight extreme, then reclaims it",
    line: "vwap",
    family: "reversal",
    idea: "The overnight high and low hold stops from everyone who traded the night. A New York open that takes one out and closes back inside has often found its turn.",
    markets: FUT,
    buckets: ["ny-open"],
    maxTf: 15,
    levels: true,
    playbooks: ["liquidity-sweep"],
  },
  pd_sweep: {
    id: "pd_sweep",
    label: "Prior day sweep and reclaim",
    short: "PD sweep",
    blurb: "Yesterday's high or low is run, then reclaimed",
    line: "vwap",
    family: "reversal",
    idea: "Yesterday's high and low are the most watched levels on the chart, so stops pile up just past them. A run through that closes back inside traps the breakout traders.",
    markets: FUT,
    buckets: ["london", "pre", "ny-open", "ny-mid", "ny-pm"],
    maxTf: 30,
    levels: true,
    playbooks: ["london-prev-day-levels", "liquidity-sweep"],
  },
  orb_fail: {
    id: "orb_fail",
    label: "Failed opening range break",
    short: "ORB fail",
    blurb: "The first break of the opening range fails back inside",
    line: "vwap",
    family: "reversal",
    idea: "When the first break of the opening 15 minutes can't hold, the traders who chased it are wrong at once. The trade goes the other way, toward the far side of the range.",
    markets: FUT,
    buckets: ["ny-open"],
    maxTf: 15,
    levels: true,
    playbooks: ["failed-breakout", "orb"],
  },
  ib_break: {
    id: "ib_break",
    label: "Initial balance break",
    short: "IB break",
    blurb: "First close outside a narrow first hour",
    line: "vwap",
    family: "breakout",
    idea: "A first hour narrower than usual leaves the day's range unfinished. The first strong close outside it often starts the extension.",
    markets: FUT,
    buckets: ["ny-open", "ny-mid"],
    maxTf: 30,
    levels: true,
    playbooks: ["breakout"],
  },
  vwap_band: {
    id: "vwap_band",
    label: "VWAP band reversion",
    short: "VWAP band",
    blurb: "A stretch past 2 standard deviations snaps back toward a flat VWAP",
    line: "vwap",
    family: "mean-reversion",
    idea: "On a balanced day VWAP is fair value and its outer bands are stretched. A bar that pokes past the band and closes back inside often reverts toward VWAP.",
    markets: FUT,
    buckets: ["asia", "london", "ny-open", "ny-mid", "ny-pm"],
    maxTf: 15,
    levels: true,
    playbooks: ["mean-reversion", "vwap"],
  },
  fvg_cont: {
    id: "fvg_cont",
    label: "Fair value gap continuation",
    short: "FVG",
    blurb: "First return into a gap left by a strong bar, on the VWAP side",
    line: "vwap",
    family: "continuation",
    idea: "A strong bar that leaves a gap between its neighbours shows one side in control. The first return into that gap, holding on the trend's side of VWAP, is a continuation entry.",
    markets: ALL,
    buckets: DAY,
    maxTf: 60,
    levels: false,
    playbooks: ["order-blocks"],
  },
  bos_retest: {
    id: "bos_retest",
    label: "Break of structure and retest",
    short: "BOS retest",
    blurb: "A strong close through a swing, then the first retest that holds",
    line: "ema",
    family: "continuation",
    idea: "A strong close through the last swing changes the structure; the level that was resistance often becomes support. The first retest that holds is the entry.",
    markets: ALL,
    buckets: DAY,
    maxTf: 60,
    levels: false,
    playbooks: ["support-resistance", "breakout"],
  },
  squeeze: {
    id: "squeeze",
    label: "Compression breakout",
    short: "Squeeze",
    blurb: "A range half its usual size breaks on volume",
    line: "ema",
    family: "breakout",
    idea: "Ranges contract before they expand. A break of a tight 12-bar range on above-average volume catches the start of the expansion.",
    markets: ALL,
    buckets: DAY,
    maxTf: 60,
    levels: false,
    playbooks: ["breakout"],
  },
};
export const PATTERN_ORDER = Object.keys(PATTERNS) as PatternId[];
for (const id of PATTERN_ORDER) registerInfo(PATTERNS[id]);

// ── Context ────────────────────────────────────────────────────────────────────

export interface PCtx extends Ctx {
  /** Day levels per bar, or null where none are known (crypto, or no history yet). */
  levels: (DayLevels | null)[];
  gvwap: number[];
  gsd: number[];
  /** Standard deviation around the regular-session VWAP; NaN outside it. */
  rsd: number[];
  bucket: Bucket[];
  minute: number[];
  session: string[];
  /** Futures: sessions and levels apply. Crypto reads around the clock. */
  sessions: boolean;
  /** Memo for per-session scans, keyed by pattern and session. */
  memo: Map<string, number>;
  /** Rolling 12-bar range ending at each bar. */
  r12: number[];
}

/** Add what the patterns need to a reader context: levels, Globex VWAP, buckets. */
export function enrich(c: Ctx, anchor: Anchor, levels: (DayLevels | null)[]): PCtx {
  const bars = c.bars;
  const g = globexVwap(bars);
  const sessions = anchor === "rth";
  const clock = bars.map((b) => sessionOf(b.t));
  const rsd: number[] = [];
  let start = -2;
  let pv2 = 0;
  let vv = 0;
  bars.forEach((b, i) => {
    const s0 = c.sessionStart[i];
    if (s0 < 0) {
      rsd.push(NaN);
      return;
    }
    if (s0 !== start) {
      start = s0;
      pv2 = 0;
      vv = 0;
    }
    const tp = (b.h + b.l + b.c) / 3;
    const w = b.v || 1;
    pv2 += tp * tp * w;
    vv += w;
    rsd.push(Math.sqrt(Math.max(0, pv2 / vv - c.vwap[i] * c.vwap[i])));
  });
  const n = P.squeeze.bars;
  const r12 = bars.map((_, i) => {
    if (i < n - 1) return NaN;
    let hi = -Infinity;
    let lo = Infinity;
    for (let k = i - n + 1; k <= i; k++) {
      hi = Math.max(hi, bars[k].h);
      lo = Math.min(lo, bars[k].l);
    }
    return hi - lo;
  });
  return {
    ...c,
    levels: sessions ? levels : bars.map(() => null),
    gvwap: g.vwap,
    gsd: g.sd,
    rsd,
    bucket: sessions ? clock.map((s) => bucketOfMinute(s.minute)) : bars.map(() => "ny-open" as Bucket),
    minute: clock.map((s) => s.minute),
    session: clock.map((s) => s.session),
    sessions,
    memo: new Map(),
    r12,
  };
}
/** The patterns' context straight from bars: what backtests and tests use. */
export function patternContext(bars: Bar[], anchor: Anchor, levels: (DayLevels | null)[]): PCtx {
  return enrich(_internal.context(bars, anchor), anchor, levels);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const allowed = (c: PCtx, i: number, info: PatternInfo) => {
  if (c.tfMinutes > info.maxTf) return false;
  if (!c.sessions) return !info.levels;
  return info.buckets.includes(c.bucket[i]);
};
const body = (b: Bar) => Math.abs(b.c - b.o);
/** First index from `from` on, in the same session as `from`, where `hit` holds; -1 if none. Memoised per key. */
function firstIn(c: PCtx, key: string, from: number, hit: (k: number) => boolean) {
  const memoKey = `${key}|${c.session[from]}|${from}`;
  const was = c.memo.get(memoKey);
  if (was !== undefined) return was;
  let out = -1;
  for (let k = from; k < c.bars.length && c.session[k] === c.session[from]; k++)
    if (hit(k)) {
      out = k;
      break;
    }
  c.memo.set(memoKey, out);
  return out;
}
/** First bar of this session at which a level field holds today's value. */
function since(c: PCtx, i: number, get: (l: DayLevels) => number | null) {
  const v = get(c.levels[i]!);
  let k = i;
  while (k > 0 && c.session[k - 1] === c.session[i] && c.levels[k - 1] && get(c.levels[k - 1]!) === v) k--;
  return k;
}
/** VWAP for a bar: the regular session's in New York hours, the Globex one otherwise. */
const vwapAt = (c: PCtx, i: number) => (Number.isFinite(c.vwap[i]) ? c.vwap[i] : c.gvwap[i]);

// ── Detectors ──────────────────────────────────────────────────────────────────

type Which = "pd" | "on" | "asia";
const LEVELS: Record<Which, (l: DayLevels) => [number | null, number | null]> = {
  pd: (l) => [l.pdh, l.pdl],
  on: (l) => [l.onh, l.onl],
  asia: (l) => [l.asiaH, l.asiaL],
};

/** Sweep and reclaim of a day level. Shared by the prior-day, overnight and Asia sweeps. */
function levelSweep(id: PatternId, which: Which) {
  return (c: PCtx, i: number): Fired | null => {
    const info = PATTERNS[id];
    const lv = c.levels[i];
    if (!lv || !allowed(c, i, info)) return null;
    if (which === "on" && !overnightFinal(c.bars[i].t)) return null;
    const [H, L] = LEVELS[which](lv);
    const a = c.atr[i];
    const { bars } = c;
    for (const side of ["long", "short"] as const) {
      const level = side === "long" ? L : H;
      if (level == null) continue;
      const get = (l: DayLevels) => LEVELS[which](l)[side === "long" ? 1 : 0];
      const from = since(c, i, get);
      // The first time today's session trades through the level: earlier probes spoil it.
      const s = firstIn(c, `${id}:${side}:${level}`, from, (k) => (side === "long" ? bars[k].l < level : bars[k].h > level));
      if (s < 0 || s > i || i - s >= P.sweep.window) continue;
      const x = bars[s];
      const through = side === "long" ? x.l < level - P.sweep.through * a : x.h > level + P.sweep.through * a;
      const back = side === "long" ? x.c > level : x.c < level;
      if (!through || !back) continue;
      const trigger = (k: number) => (side === "long" ? bars[k].c > level && bars[k].c > bars[k].o : bars[k].c < level && bars[k].c < bars[k].o);
      if (!trigger(i)) continue;
      let earlier = false;
      for (let k = s; k < i; k++) if (trigger(k)) earlier = true;
      if (earlier) continue;
      let extreme = side === "long" ? Infinity : -Infinity;
      for (let k = s; k <= i; k++) extreme = side === "long" ? Math.min(extreme, bars[k].l) : Math.max(extreme, bars[k].h);
      const stop = side === "long" ? extreme - P.sweep.stop * a : extreme + P.sweep.stop * a;
      const shown = Math.max(from, i - 40);
      const f = plan(c, i, side, stop, { reader: id, side, level, levelIndex: shown, sweepIndex: s, index: i, zone: null, marks: [shown, s, i] });
      if (f) return f;
    }
    return null;
  };
}

function orbFail(c: PCtx, i: number): Fired | null {
  const lv = c.levels[i];
  if (!lv || lv.orH == null || lv.orL == null || !allowed(c, i, PATTERNS.orb_fail)) return null;
  const { bars } = c;
  const a = c.atr[i];
  const H = lv.orH;
  const L = lv.orL;
  const from = since(c, i, (l) => l.orH);
  const open = c.sessionStart[i] >= 0 ? c.sessionStart[i] : from;
  const k = firstIn(c, `orb_fail:${H}:${L}`, from, (j) => bars[j].c > H || bars[j].c < L);
  if (k < 0 || k >= i || i - k > P.orbFail.bars) return null;
  const up = bars[k].c > H;
  const side: Side = up ? "short" : "long";
  const back = (j: number) => (up ? bars[j].c < H - P.orbFail.back * a : bars[j].c > L + P.orbFail.back * a);
  if (!back(i)) return null;
  for (let j = k + 1; j < i; j++) if (back(j)) return null;
  let extreme = up ? -Infinity : Infinity;
  for (let j = k; j <= i; j++) extreme = up ? Math.max(extreme, bars[j].h) : Math.min(extreme, bars[j].l);
  const stop = up ? extreme + P.orbFail.stop * a : extreme - P.orbFail.stop * a;
  const f = plan(c, i, side, stop, { reader: "orb_fail", side, level: up ? H : L, levelIndex: open, sweepIndex: k, index: i, zone: { top: H, bottom: L, from: open }, marks: [open, k, i] });
  if (!f) return null;
  // The far side of the range is the natural target when it pays at least 1.2R.
  const edge = up ? L : H;
  const risk = Math.abs(f.entry - f.stop);
  if (Math.abs(edge - f.entry) >= P.orbFail.minR * risk) return { ...f, target: edge, rr: Math.abs(edge - f.entry) / risk };
  return f;
}

function ibBreak(c: PCtx, i: number): Fired | null {
  const lv = c.levels[i];
  if (!lv || lv.ibH == null || lv.ibL == null || lv.ibMed == null || lv.history < P.ib.minHistory || !allowed(c, i, PATTERNS.ib_break)) return null;
  const m = c.minute[i];
  if (m < P.ib.from || m >= P.ib.until) return null;
  if (lv.ibH - lv.ibL > lv.ibMed) return null;
  const { bars } = c;
  const H = lv.ibH;
  const L = lv.ibL;
  const from = since(c, i, (l) => l.ibH);
  const k = firstIn(c, `ib:${H}:${L}`, from, (j) => bars[j].c > H || bars[j].c < L);
  if (k !== i) return null;
  const x = bars[i];
  const span = x.h - x.l;
  if (!(span > 0)) return null;
  const up = x.c > H;
  const outer = up ? (x.c - x.l) / span >= 1 - P.ib.outer : (x.h - x.c) / span >= 1 - P.ib.outer;
  if (!outer) return null;
  const a = c.atr[i];
  const mid = (H + L) / 2;
  // Same form as the ORB reader's stop.
  const stop = up ? Math.min(mid, x.c - 0.5 * a) : Math.max(mid, x.c + 0.5 * a);
  const ibStart = c.sessionStart[i] >= 0 ? c.sessionStart[i] : from;
  return plan(c, i, up ? "long" : "short", stop, { reader: "ib_break", side: up ? "long" : "short", level: up ? H : L, levelIndex: ibStart, sweepIndex: ibStart, index: i, zone: { top: H, bottom: L, from: ibStart }, marks: [ibStart, i, i] });
}

function vwapBand(c: PCtx, i: number): Fired | null {
  if (!allowed(c, i, PATTERNS.vwap_band)) return null;
  const b = c.bucket[i];
  const rth = b === "ny-open" || b === "ny-mid" || b === "ny-pm";
  if (rth && c.minute[i] < P.band.from) return null;
  const vw = rth ? c.vwap : c.gvwap;
  const sd = rth ? c.rsd : c.gsd;
  const j = i - P.band.flatBars;
  if (j < 0 || !Number.isFinite(vw[i]) || !Number.isFinite(vw[j]) || c.session[j] !== c.session[i] || !(sd[i] > 0)) return null;
  const a = c.atr[i];
  if (Math.abs(vw[i] - vw[j]) >= P.band.flat * a) return null;
  const x = c.bars[i];
  const lower = vw[i] - P.band.sd * sd[i];
  const upper = vw[i] + P.band.sd * sd[i];
  let side: Side | null = null;
  if (x.l < lower && x.c > lower && x.c > x.o) side = "long";
  else if (x.h > upper && x.c < upper && x.c < x.o) side = "short";
  if (!side) return null;
  const stop = side === "long" ? x.l - P.band.stop * a : x.h + P.band.stop * a;
  const f = plan(c, i, side, stop, { reader: "vwap_band", side, level: side === "long" ? lower : upper, levelIndex: Math.max(0, i - 12), sweepIndex: i, index: i, zone: null, marks: [Math.max(0, i - 12), i, i] });
  if (!f) return null;
  // VWAP is the target; worth taking only at 1.2R or more.
  const risk = Math.abs(f.entry - f.stop);
  const reward = (vw[i] - f.entry) * (side === "long" ? 1 : -1);
  if (reward < P.band.minR * risk) return null;
  return { ...f, target: vw[i], rr: reward / risk };
}

function fvgCont(c: PCtx, i: number): Fired | null {
  if (!allowed(c, i, PATTERNS.fvg_cont)) return null;
  const { bars, atr } = c;
  const x = bars[i];
  const v = vwapAt(c, i);
  if (!Number.isFinite(v)) return null;
  for (const side of ["long", "short"] as const) {
    if (side === "long" ? x.c <= v : x.c >= v) continue;
    // Newest gap first.
    for (let d = i - 2; d >= Math.max(1, i - P.fvg.look); d--) {
      if (body(bars[d]) < P.fvg.body * atr[d]) continue;
      const top = side === "long" ? bars[d + 1].l : bars[d - 1].l;
      const bottom = side === "long" ? bars[d - 1].h : bars[d + 1].h;
      if (top - bottom < P.fvg.gap * atr[d]) continue;
      if (side === "long" ? bars[d].c <= bars[d].o : bars[d].c >= bars[d].o) continue;
      // The first bar back into the gap is this one.
      let earlier = false;
      for (let k = d + 2; k < i && !earlier; k++) if (side === "long" ? bars[k].l <= top : bars[k].h >= bottom) earlier = true;
      if (earlier) break;
      const into = side === "long" ? x.l <= top : x.h >= bottom;
      const held = side === "long" ? x.l >= bottom - P.fvg.held * atr[i] : x.h <= top + P.fvg.held * atr[i];
      const out = side === "long" ? x.c > top && x.c > x.o : x.c < bottom && x.c < x.o;
      if (!(into && held && out)) break;
      const stop = side === "long" ? bottom - P.fvg.stop * atr[i] : top + P.fvg.stop * atr[i];
      const f = plan(c, i, side, stop, { reader: "fvg_cont", side, level: side === "long" ? top : bottom, levelIndex: d, sweepIndex: d - 1, index: i, zone: { top, bottom, from: d - 1 }, marks: [d, i, i] });
      if (f) return f;
      break;
    }
  }
  return null;
}

function bosRetest(c: PCtx, i: number): Fired | null {
  if (!allowed(c, i, PATTERNS.bos_retest)) return null;
  const { bars, atr } = c;
  const x = bars[i];
  const a = atr[i];
  for (const side of ["long", "short"] as const) {
    for (let k = i - 1; k >= Math.max(1, i - P.bos.look); k--) {
      // The swing that was the latest confirmed one when bar k closed.
      const piv = known(c, k).filter((p) => p.kind === (side === "long" ? "high" : "low"));
      const p = piv[piv.length - 1];
      if (!p) continue;
      const broke = side === "long" ? bars[k].c > p.price && bars[k - 1].c <= p.price : bars[k].c < p.price && bars[k - 1].c >= p.price;
      if (!broke || body(bars[k]) < P.bos.body * atr[k]) continue;
      const tag = (j: number) => (side === "long" ? bars[j].l <= p.price + P.bos.tag * a : bars[j].h >= p.price - P.bos.tag * a);
      let earlier = false;
      for (let j = k + 1; j < i && !earlier; j++) if (tag(j)) earlier = true;
      if (earlier || !tag(i)) break;
      if (side === "long" ? x.c <= p.price : x.c >= p.price) break;
      const stop = side === "long" ? x.l - P.bos.stop * a : x.h + P.bos.stop * a;
      const f = plan(c, i, side, stop, { reader: "bos_retest", side, level: p.price, levelIndex: p.i, sweepIndex: k, index: i, zone: null, marks: [p.i, k, i] });
      if (f) return f;
      break;
    }
  }
  return null;
}

function squeeze(c: PCtx, i: number): Fired | null {
  if (!allowed(c, i, PATTERNS.squeeze)) return null;
  const { bars, atr, r12 } = c;
  const n = P.squeeze.bars;
  if (i < P.squeeze.look + n) return null;
  const range = r12[i - 1];
  const past: number[] = [];
  for (let j = i - P.squeeze.look; j < i; j++) if (Number.isFinite(r12[j])) past.push(r12[j]);
  past.sort((p, q) => p - q);
  const med = past[past.length >> 1];
  if (!(range <= P.squeeze.ratio * med)) return null;
  let hi = -Infinity;
  let lo = Infinity;
  for (let k = i - n; k < i; k++) {
    hi = Math.max(hi, bars[k].h);
    lo = Math.min(lo, bars[k].l);
  }
  const x = bars[i];
  const a = atr[i];
  const vol = c.volAvg[i - 1] || 1;
  if (x.v < P.squeeze.vol * vol) return null;
  const side: Side | null = x.c > hi + P.squeeze.beyond * a ? "long" : x.c < lo - P.squeeze.beyond * a ? "short" : null;
  if (!side) return null;
  const stop = side === "long" ? Math.max(lo, x.c - P.squeeze.cap * a) : Math.min(hi, x.c + P.squeeze.cap * a);
  return plan(c, i, side, stop, { reader: "squeeze", side, level: side === "long" ? hi : lo, levelIndex: i - n, sweepIndex: i - n, index: i, zone: { top: hi, bottom: lo, from: i - n }, marks: [i - n, i, i] });
}

const DETECT: Record<PatternId, (c: PCtx, i: number) => Fired | null> = {
  asia_sweep: levelSweep("asia_sweep", "asia"),
  on_sweep: levelSweep("on_sweep", "on"),
  pd_sweep: levelSweep("pd_sweep", "pd"),
  orb_fail: orbFail,
  ib_break: ibBreak,
  vwap_band: vwapBand,
  fvg_cont: fvgCont,
  bos_retest: bosRetest,
  squeeze,
};

// ── Callouts ───────────────────────────────────────────────────────────────────

export function patternCallouts(c: PCtx, f: Fired, fmt: (n: number) => string): Callout[] {
  const { bars } = c;
  const [m1, m2, m3] = f.marks;
  const long = f.side === "long";
  const lv = c.levels[f.index];
  const sweepStory = (name: string, short: string) => [
    { n: 1, title: `${name} ${long ? "low" : "high"}`, detail: `${short} ${long ? "low" : "high"} at ${fmt(f.level)}: stops rest just ${long ? "below" : "above"}`, i: m1, price: f.level, mark: "level" as const },
    { n: 2, title: "Run and reject", detail: `Traded ${fmt(Math.abs((long ? bars[m2].l : bars[m2].h) - f.level))} through, closed back inside`, i: m2, price: long ? bars[m2].l : bars[m2].h, mark: "ring" as const },
    { n: 3, title: "Reclaimed", detail: `${long ? "Green" : "Red"} close back ${long ? "above" : "below"} the level`, i: m3, price: bars[m3].c, mark: "ring" as const },
  ];
  switch (f.reader as PatternId) {
    case "asia_sweep":
      return sweepStory("Asia", "Asia's");
    case "on_sweep":
      return sweepStory("Overnight", "The overnight");
    case "pd_sweep":
      return sweepStory("Prior day", "Yesterday's");
    case "orb_fail":
      return [
        { n: 1, title: "Opening range", detail: `First 15 minutes: ${fmt(lv?.orL ?? f.zone!.bottom)} to ${fmt(lv?.orH ?? f.zone!.top)}`, i: m1, price: f.level, mark: "level" },
        { n: 2, title: "Break", detail: `First close ${long ? "below" : "above"} the range`, i: m2, price: bars[m2].c, mark: "ring" },
        { n: 3, title: "Failed", detail: `Back inside: the ${long ? "sellers" : "buyers"} who chased are trapped`, i: m3, price: bars[m3].c, mark: "ring" },
      ];
    case "ib_break":
      return [
        { n: 1, title: "Narrow first hour", detail: `First hour ${fmt(f.zone!.bottom)} to ${fmt(f.zone!.top)}, narrower than the usual day`, i: m1, price: f.level, mark: "level" },
        { n: 2, title: "Strong close outside", detail: `Closed near its ${long ? "high" : "low"}, ${long ? "above" : "below"} the first hour`, i: m2, price: bars[m2].c, mark: "ring" },
      ];
    case "vwap_band":
      return [
        { n: 1, title: "Flat VWAP", detail: "VWAP barely moved in 12 bars: a balanced day", i: m1, price: vwapAt(c, m1), mark: "level" },
        { n: 2, title: "Stretched", detail: `Traded past the ${long ? "lower" : "upper"} 2-deviation band, then closed back inside`, i: m2, price: long ? bars[m2].l : bars[m2].h, mark: "ring" },
      ];
    case "fvg_cont":
      return [
        { n: 1, title: "Displacement", detail: `A strong ${long ? "up" : "down"} bar left a gap of ${fmt(f.zone!.top - f.zone!.bottom)}`, i: m1, price: long ? bars[m1].c : bars[m1].c, mark: "ring" },
        { n: 2, title: "First return", detail: `Back into the gap, then a ${long ? "green" : "red"} close out of it`, i: m2, price: long ? bars[m2].l : bars[m2].h, mark: "ring" },
      ];
    case "bos_retest":
      return [
        { n: 1, title: long ? "Swing high" : "Swing low", detail: `The last confirmed ${long ? "high" : "low"}, ${fmt(f.level)}`, i: m1, price: f.level, mark: "level" },
        { n: 2, title: "Broken", detail: `A strong close ${long ? "above" : "below"} it`, i: m2, price: bars[m2].c, mark: "ring" },
        { n: 3, title: "Retest held", detail: `First tag back, closed ${long ? "above" : "below"}`, i: m3, price: long ? bars[m3].l : bars[m3].h, mark: "ring" },
      ];
    case "squeeze":
      return [
        { n: 1, title: "Compression", detail: `12 bars in ${fmt(f.zone!.top - f.zone!.bottom)}, half the usual range`, i: m1, price: f.level, mark: "level" },
        { n: 2, title: "Break on volume", detail: `Closed ${long ? "above" : "below"} on ${Math.round((bars[m2].v / (c.volAvg[m2 - 1] || 1)) * 10) / 10}× the usual volume`, i: m2, price: bars[m2].c, mark: "ring" },
      ];
  }
}

/** One pattern as a chart detector. Its detect expects a context made by enrich() or patternContext(). */
export function patternDetector(id: PatternId): Detector {
  return {
    id,
    info: PATTERNS[id],
    detect: (c, i) => DETECT[id](c as PCtx, i),
    callouts: (c, f, fmt) => patternCallouts(c as PCtx, f, fmt),
  };
}

/** Which patterns apply to a chart: its market, its timeframe, and whether it has sessions. */
export function patternsFor(symbol: VisionSymbolId, tfMinutes: number, futures: boolean): PatternId[] {
  return PATTERN_ORDER.filter((id) => {
    const p = PATTERNS[id];
    return p.markets.includes(symbol) && tfMinutes <= p.maxTf && (futures || !p.levels);
  });
}
