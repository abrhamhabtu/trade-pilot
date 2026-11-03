// ─── Vision · your own rules ───────────────────────────────────────────────────
// A strategy written the way a trader says it ("break and retest of the prior
// day's high, stop 1.5× ATR, 2:1") becomes named rules the backtest can run.
//
// The parser is deterministic: it recognises the phrases below and reports the
// ones it could not use, so the rules on screen are always the rules that run.
// Every entry is decided on a closed bar and only looks backwards.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { sessionOf } from "@/lib/pilot/market";
import { atr as atrOf, ema as emaOf, pivots, rsi as rsiOf } from "./indicators";
import { READERS, _internal, type Anchor, type ReaderId, type Side } from "./analyze";

export type EntryRule =
  | { kind: "pdhl_retest"; bars: number }
  | { kind: "pdhl_sweep" }
  | { kind: "orb"; minutes: number }
  | { kind: "vwap_cross" }
  | { kind: "ema_cross"; fast: number; slow: number }
  | { kind: "fvg" }
  | { kind: "rsi"; len: number; low: number; high: number }
  | { kind: "structure" }
  | { kind: "reader"; reader: ReaderId };

export type StopRule = { kind: "atr"; mult: number; len: number } | { kind: "points"; pts: number } | { kind: "ticks"; n: number } | { kind: "swing"; bars: number } | { kind: "signal" } | { kind: "plan" };
export type TargetRule = { kind: "r"; r: number } | { kind: "points"; pts: number } | { kind: "plan" };
export type SessionKey = "all" | "asia" | "london" | "ny" | "open";

export interface CustomRules {
  entry: EntryRule;
  side: "both" | Side;
  stop: StopRule;
  target: TargetRule;
  trend: "none" | "ema200" | "vwap";
  session: SessionKey | null;
  maxPerDay: number | null;
  breakEvenR: number | null;
}

/** Entry windows in New York minutes of the day; Asia wraps past midnight. */
export const SESSION_WINDOWS: Record<SessionKey, { label: string; hours: [number, number] | null; detail: string }> = {
  all: { label: "Entire day", hours: null, detail: "Around the clock" },
  asia: { label: "Asia", hours: [19 * 60, 2 * 60], detail: "7:00 pm – 2:00 am NY" },
  london: { label: "London", hours: [3 * 60, 8 * 60], detail: "3:00 – 8:00 am NY" },
  ny: { label: "New York", hours: [9 * 60 + 30, 16 * 60], detail: "9:30 am – 4:00 pm" },
  open: { label: "NY open", hours: [9 * 60 + 30, 11 * 60 + 30], detail: "9:30 – 11:30 am" },
};

export const DEFAULT_RULES: CustomRules = { entry: { kind: "pdhl_retest", bars: 12 }, side: "both", stop: { kind: "atr", mult: 1.5, len: 14 }, target: { kind: "r", r: 2 }, trend: "none", session: null, maxPerDay: null, breakEvenR: null };

export const ENTRY_LABEL: Record<EntryRule["kind"], string> = {
  pdhl_retest: "Break & retest of prior day high/low",
  pdhl_sweep: "Sweep of prior day high/low",
  orb: "Opening range breakout",
  vwap_cross: "VWAP cross",
  ema_cross: "EMA cross",
  fvg: "Fair value gap retest",
  rsi: "RSI reversal",
  structure: "Break of structure (CHoCH / BOS)",
  reader: "One of your Vision strategies",
};

export interface Template {
  id: string;
  name: string;
  text: string;
}

export const TEMPLATES: Template[] = [
  { id: "pdhl", name: "Break & retest · PDH/PDL", text: "Trade the break and retest of the previous day's high and low. Go long when price breaks above the prior high, pulls back to retest it, and prints a bullish candle. Mirror for shorts. Stop: 1.5x ATR(14). Take profit: 2:1." },
  { id: "orb", name: "Opening range breakout", text: "Opening range breakout on the first 15 minutes of New York. Long on the first close above the range, short below it. Stop at the signal candle. Take profit 2R. One trade per day." },
  { id: "sweep", name: "PDH/PDL liquidity sweep", text: "Fade a sweep of the prior day's high or low: price takes out the level and closes back inside. Stop below the swing low of the last 5 bars. Target 2.5:1. Move stop to break even at 1R." },
  { id: "vwap", name: "VWAP cross with trend", text: "Long when price crosses above VWAP while above the 200 EMA, short when it crosses below VWAP while below the 200 EMA. Stop 1x ATR. Take profit 2:1. Max 2 trades per day." },
  { id: "ema", name: "EMA 9/21 cross", text: "Long when the 9 EMA crosses above the 21 EMA, short when it crosses below. Stop 20 points. Take profit 40 points. New York session only." },
  { id: "fvg", name: "Fair value gap retest", text: "Trade the first retest of a fair value gap in the direction of the gap, with a bullish candle for longs and bearish for shorts. Stop 1.2x ATR(14). Take profit 2:1. NY open only." },
  { id: "choch", name: "Change of character", text: "Long on a change of character: a close above the last swing high. Short on a close below the last swing low. Stop at the swing of the last 8 bars. 2R target. Break even at 1R." },
  { id: "dbvwap", name: "Double-break VWAP (yours)", text: "Use my double-break VWAP strategy on NQ in the New York session with its own stop and target." },
];

const num = (s: string | undefined, d: number) => (s != null && Number.isFinite(Number(s)) ? Number(s) : d);

/** Plain English to rules. `used` lists what was understood; `unknown` the sentences that changed nothing. */
export function parseRules(text: string): { rules: CustomRules; used: string[]; unknown: string[] } {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ")} `;
  const used: string[] = [];
  const r: CustomRules = { ...DEFAULT_RULES, stop: { kind: "plan" }, target: { kind: "plan" } };
  let m: RegExpMatchArray | null;

  // ── Entry ──
  const reader = (Object.keys(READERS) as ReaderId[]).find((id) =>
    ({ dbvwap: /double[- ]?break/, sd: /supply (and|&) demand|octavia|demand zone|supply zone/, sweep: /liquidity sweep strategy|my sweep/, orb: /my orb|my opening range/, vwappb: /vwap (trend )?pull ?back/ })[id].test(t),
  );
  const prevDay = /(previous|prior|yesterday's|yesterdays) day'?s? (high|low)|\bpd[hl]\b|prior (high|low)|previous (high|low)/.test(t);
  if (reader) {
    r.entry = { kind: "reader", reader };
    used.push(`Entry: ${READERS[reader].label}`);
  } else if (prevDay && /sweep|take[sn]? out|run|raid|stop hunt|fade/.test(t)) {
    r.entry = { kind: "pdhl_sweep" };
    used.push("Entry: sweep of the prior day's high or low");
  } else if (prevDay || /break (and|&) retest/.test(t)) {
    m = t.match(/retest (?:within|in) (\d+) (?:bars|candles)/);
    r.entry = { kind: "pdhl_retest", bars: num(m?.[1], 12) };
    used.push("Entry: break and retest of the prior day's high or low");
  } else if (/opening range|\borb\b/.test(t)) {
    m = t.match(/(?:first|opening) (\d+)[ -]?(?:min|minute)/) ?? t.match(/(\d+)[ -]?(?:min|minute) (?:opening )?range/);
    r.entry = { kind: "orb", minutes: num(m?.[1], 15) };
    used.push(`Entry: opening range breakout, first ${r.entry.minutes} minutes`);
  } else if (/\bfvg\b|fair value gap|imbalance/.test(t)) {
    r.entry = { kind: "fvg" };
    used.push("Entry: retest of a fair value gap");
  } else if (/choch|change of character|break of structure|\bbos\b|market structure shift|\bmss\b/.test(t)) {
    r.entry = { kind: "structure" };
    used.push("Entry: close through the last swing (structure break)");
  } else if (/cross\w* (?:above |below |over |under |through )?(?:the )?vwap|vwap (?:cross|reclaim)|reclaim\w* (?:the )?vwap/.test(t)) {
    r.entry = { kind: "vwap_cross" };
    used.push("Entry: close across VWAP");
  } else if ((m = t.match(/(\d+) ?(?:ema|ma|moving average)s? (?:crosses|cross|and|\/|over)[^.]*?(\d+) ?(?:ema|ma)/) ?? t.match(/ema (\d+) ?(?:\/|and|x) ?(\d+)/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    r.entry = { kind: "ema_cross", fast: Math.min(a, b), slow: Math.max(a, b) };
    used.push(`Entry: ${r.entry.fast}/${r.entry.slow} EMA cross`);
  } else if (/\bema\b.*cross|cross.*\bema\b/.test(t)) {
    r.entry = { kind: "ema_cross", fast: 9, slow: 21 };
    used.push("Entry: 9/21 EMA cross");
  } else if (/\brsi\b/.test(t)) {
    const lo = t.match(/(?:below|under|oversold (?:at|below)?) ?(\d{1,2})/);
    const hi = t.match(/(?:above|over|overbought (?:at|above)?) ?(\d{2})/);
    const len = t.match(/rsi ?\(?(\d+)\)?/);
    r.entry = { kind: "rsi", len: num(len?.[1], 14), low: num(lo?.[1], 30), high: num(hi?.[1], 70) };
    used.push(`Entry: RSI(${r.entry.len}) back above ${r.entry.low} / below ${r.entry.high}`);
  } else if (/vwap/.test(t)) {
    r.entry = { kind: "vwap_cross" };
    used.push("Entry: close across VWAP");
  } else {
    r.entry = DEFAULT_RULES.entry;
    used.push("Entry: none named, using break and retest of the prior day's high or low");
  }

  // ── Direction ──
  if (/(longs?|buys?) only|only (go )?(long|buy)|no shorts/.test(t)) r.side = "long";
  else if (/(shorts?|sells?) only|only (go )?(short|sell)|no longs/.test(t)) r.side = "short";
  if (r.side !== "both") used.push(`Direction: ${r.side}s only`);

  // ── Stop ──
  if ((m = t.match(/(\d+(?:\.\d+)?) ?[x×]? ?(?:the )?atr ?\(?(\d+)?\)?/))) r.stop = { kind: "atr", mult: Number(m[1]), len: num(m[2], 14) };
  else if ((m = t.match(/atr ?\(?(\d+)?\)? ?[x×] ?(\d+(?:\.\d+)?)/))) r.stop = { kind: "atr", mult: Number(m[2]), len: num(m[1], 14) };
  else if ((m = t.match(/stop[^.]*?(\d+(?:\.\d+)?) ?(?:points|pts|point|handles)/))) r.stop = { kind: "points", pts: Number(m[1]) };
  else if ((m = t.match(/stop[^.]*?(\d+) ?ticks?/))) r.stop = { kind: "ticks", n: Number(m[1]) };
  else if ((m = t.match(/swing (?:low|high)?[^.]*?(?:last|of) (\d+) (?:bars|candles)/) ?? t.match(/(?:last|of) (\d+) (?:bars|candles)[^.]*swing/))) r.stop = { kind: "swing", bars: Number(m[1]) };
  else if (/stop[^.]*swing|swing (low|high) stop/.test(t)) r.stop = { kind: "swing", bars: 8 };
  else if (/stop[^.]*(signal|entry|setup) (candle|bar)|(candle|bar)'?s? (low|high)/.test(t)) r.stop = { kind: "signal" };
  else if (r.entry.kind !== "reader") r.stop = DEFAULT_RULES.stop;
  used.push(`Stop: ${stopText(r.stop)}`);

  // ── Target ──
  // Break-even triggers ("break even at 1R") are not targets.
  const tt = t.replace(/break ?-?even[^.]*?\d+(?:\.\d+)? ?r\b/g, " ");
  if ((m = tt.match(/(?:target|take profit|tp)[^.]*?(\d+(?:\.\d+)?) ?(?:points|pts|handles)/))) r.target = { kind: "points", pts: Number(m[1]) };
  else if ((m = tt.match(/(\d+(?:\.\d+)?) ?: ?1\b/) ?? tt.match(/(\d+(?:\.\d+)?) ?r\b(?! ?(?:isk|eward))/) ?? tt.match(/(\d+(?:\.\d+)?)[ -]?(?:to|:)[ -]?1 (?:reward|rr|r:r)/) ?? tt.match(/(\d+(?:\.\d+)?) ?(?:rr|r:r|reward to risk|risk to reward)/))) r.target = { kind: "r", r: Number(m[1]) };
  else if (r.entry.kind !== "reader") r.target = DEFAULT_RULES.target;
  used.push(`Target: ${targetText(r.target)}`);

  // ── Filters and management ──
  if (/200 ?(ema|ma|sma)|ema ?200/.test(t) || /(with|in) the trend/.test(t)) {
    r.trend = "ema200";
    used.push("Filter: with the 200 EMA");
  } else if (/(above|below) vwap/.test(t) && r.entry.kind !== "vwap_cross") {
    r.trend = "vwap";
    used.push("Filter: on the VWAP side of the trade");
  }
  if (/new york open|ny open|first two hours|opening drive/.test(t) && r.entry.kind !== "orb") r.session = "open";
  else if (/new york|\bny\b|rth|cash session|regular hours/.test(t)) r.session = "ny";
  else if (/london/.test(t)) r.session = "london";
  else if (/\basia|asian|tokyo/.test(t)) r.session = "asia";
  else if (/all day|entire day|24 ?h|around the clock/.test(t)) r.session = "all";
  if (r.session) used.push(`Session: ${SESSION_WINDOWS[r.session].label}`);
  if ((m = t.match(/(?:max(?:imum)?|at most|up to) (\d+) trades? (?:a|per) day/))) r.maxPerDay = Number(m[1]);
  else if (/one trade (a|per) day|1 trade (a|per) day|once (a|per) day/.test(t)) r.maxPerDay = 1;
  if (r.maxPerDay) used.push(`Limit: ${r.maxPerDay} trade${r.maxPerDay > 1 ? "s" : ""} a day`);
  if ((m = t.match(/break ?-?even (?:at|after|once)? ?\+?(\d+(?:\.\d+)?) ?r/))) r.breakEvenR = Number(m[1]);
  else if (/break ?-?even/.test(t)) r.breakEvenR = 1;
  if (r.breakEvenR) used.push(`Manage: stop to break-even at +${r.breakEvenR}R`);

  // Sentences that changed nothing, so the trader can see what was ignored.
  const known = /high|low|retest|break|sweep|take|range|orb|gap|fvg|imbalance|structure|choch|bos|ema|ma\b|rsi|vwap|stop|atr|target|profit|tp|r\b|:1|long|short|buy|sell|mirror|trend|session|york|ny|london|asia|day|even|candle|bar|swing|point|tick|strategy|double|demand|supply|pullback|cross/;
  const unknown = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.trim())
    .filter((x) => x && !known.test(x.toLowerCase()));
  return { rules: r, used, unknown };
}

export function stopText(s: StopRule) {
  return s.kind === "atr" ? `${s.mult}× ATR(${s.len}) from entry` : s.kind === "points" ? `${s.pts} points` : s.kind === "ticks" ? `${s.n} ticks` : s.kind === "swing" ? `beyond the swing of the last ${s.bars} bars` : s.kind === "signal" ? "beyond the signal candle" : "the strategy's own stop";
}
export function targetText(t: TargetRule) {
  return t.kind === "r" ? `${t.r}:1 reward to risk` : t.kind === "points" ? `${t.pts} points` : "the strategy's own target";
}

/** Long, short, stop, target and extras as lines to read back. */
export function describeRules(r: CustomRules) {
  const e = r.entry;
  const long =
    e.kind === "pdhl_retest" ? `Close above the prior day's high, a pullback that tags it within ${e.bars} bars, and a bullish close back above` :
    e.kind === "pdhl_sweep" ? "Price trades below the prior day's low and closes back above it with a bullish candle" :
    e.kind === "orb" ? `First close above the high of New York's first ${e.minutes} minutes` :
    e.kind === "vwap_cross" ? "Close crosses from below VWAP to above it" :
    e.kind === "ema_cross" ? `The ${e.fast} EMA crosses above the ${e.slow} EMA` :
    e.kind === "fvg" ? "Price pulls back into an open bullish fair value gap and closes bullish above its bottom" :
    e.kind === "rsi" ? `RSI(${e.len}) crosses back above ${e.low}` :
    e.kind === "structure" ? "Close above the last confirmed swing high" :
    `${READERS[e.reader].label}: ${READERS[e.reader].blurb.toLowerCase()}`;
  const short =
    e.kind === "reader" ? "The same, mirrored" :
    e.kind === "rsi" ? `RSI(${e.len}) crosses back below ${e.high}` :
    e.kind === "ema_cross" ? `The ${e.fast} EMA crosses below the ${e.slow} EMA` :
    e.kind === "structure" ? "Close below the last confirmed swing low" :
    "Mirror of the long at the low / below";
  const extras = [
    r.trend === "ema200" ? "Only with the 200 EMA: longs above it, shorts below" : r.trend === "vwap" ? "Longs above VWAP, shorts below" : null,
    r.session ? `${SESSION_WINDOWS[r.session].label} entries (${SESSION_WINDOWS[r.session].detail})` : null,
    r.maxPerDay ? `At most ${r.maxPerDay} trade${r.maxPerDay > 1 ? "s" : ""} a day` : null,
    r.breakEvenR ? `Stop to break-even once the trade is +${r.breakEvenR}R` : null,
  ].filter((x): x is string => !!x);
  return { long: r.side === "short" ? null : long, short: r.side === "long" ? null : short, stop: stopText(r.stop), target: targetText(r.target), extras };
}

/** Short chips for the parsed rules. */
export function ruleChips(r: CustomRules) {
  const e = r.entry;
  const entry = e.kind === "orb" ? `ORB ${e.minutes}m` : e.kind === "ema_cross" ? `EMA ${e.fast}/${e.slow}` : e.kind === "rsi" ? `RSI(${e.len})` : e.kind === "reader" ? READERS[e.reader].short : { pdhl_retest: "Prev day H/L · break & retest", pdhl_sweep: "Prev day H/L · sweep", vwap_cross: "VWAP cross", fvg: "FVG retest", structure: "CHoCH / BOS" }[e.kind];
  const stop = r.stop.kind === "atr" ? `${r.stop.mult}× ATR(${r.stop.len})` : r.stop.kind === "points" ? `SL ${r.stop.pts} pts` : r.stop.kind === "ticks" ? `SL ${r.stop.n} ticks` : r.stop.kind === "swing" ? `Swing ${r.stop.bars}` : r.stop.kind === "signal" ? "Signal-bar stop" : "Own stop";
  const tgt = r.target.kind === "r" ? `${r.target.r}:1 R` : r.target.kind === "points" ? `TP ${r.target.pts} pts` : "Own target";
  return [entry, stop, tgt, ...(r.trend !== "none" ? [r.trend === "ema200" ? "200 EMA trend" : "VWAP side"] : []), ...(r.breakEvenR ? [`BE ${r.breakEvenR}R`] : []), ...(r.maxPerDay ? [`${r.maxPerDay}/day`] : [])];
}

export interface CustomFire {
  reader: ReaderId | "custom";
  side: Side;
  entry: number;
  stop: number;
  target: number;
}

/**
 * Precomputes what the rules need and returns a detector for bar i. Signals
 * fire on bar i's close and use only bars up to i.
 */
export function customDetector(bars: Bar[], anchor: Anchor, r: CustomRules, tick: number): (i: number) => CustomFire | null {
  const n = bars.length;
  const closes = bars.map((b) => b.c);
  const atr14 = atrOf(bars, 14);
  const atrN = r.stop.kind === "atr" && r.stop.len !== 14 ? atrOf(bars, r.stop.len) : atr14;
  const ema200 = r.trend === "ema200" ? emaOf(closes, 200) : null;
  const ctx = _internal.context(bars, anchor);
  // A day-long VWAP for hours outside the cash session.
  const sess = bars.map((b) => sessionOf(b.t));
  const vwap: number[] = new Array(n);
  {
    let key = "";
    let pv = 0;
    let vv = 0;
    for (let i = 0; i < n; i++) {
      if (sess[i].session !== key) {
        key = sess[i].session;
        pv = 0;
        vv = 0;
      }
      const w = bars[i].v || 1;
      pv += ((bars[i].h + bars[i].l + bars[i].c) / 3) * w;
      vv += w;
      vwap[i] = Number.isFinite(ctx.vwap[i]) ? ctx.vwap[i] : pv / vv;
    }
  }
  // Prior session's high and low, per bar.
  const pdh: number[] = new Array(n).fill(NaN);
  const pdl: number[] = new Array(n).fill(NaN);
  {
    let key = "";
    let hi = -Infinity;
    let lo = Infinity;
    let prevHi = NaN;
    let prevLo = NaN;
    for (let i = 0; i < n; i++) {
      if (sess[i].session !== key) {
        if (key) {
          prevHi = hi;
          prevLo = lo;
        }
        key = sess[i].session;
        hi = -Infinity;
        lo = Infinity;
      }
      pdh[i] = prevHi;
      pdl[i] = prevLo;
      hi = Math.max(hi, bars[i].h);
      lo = Math.min(lo, bars[i].l);
    }
  }
  const e = r.entry;
  const fast = e.kind === "ema_cross" ? emaOf(closes, e.fast) : null;
  const slow = e.kind === "ema_cross" ? emaOf(closes, e.slow) : null;
  const rsiS = e.kind === "rsi" ? rsiOf(closes, e.len) : null;
  const piv = e.kind === "structure" ? pivots(bars, 3) : null;
  const readers: ReaderId[] = e.kind === "reader" ? [e.reader] : [];
  // Once per session per side for level-based entries.
  const taken = new Set<string>();
  // Opening range per session.
  const orHi = new Map<string, number>();
  const orLo = new Map<string, number>();
  let pivK = 0;
  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  let gapUp: { top: number; bottom: number; at: number } | null = null;
  let gapDn: { top: number; bottom: number; at: number } | null = null;

  const plan = (side: Side, i: number, own?: { stop: number; target: number }): CustomFire | null => {
    if (r.side !== "both" && r.side !== side) return null;
    const c = bars[i].c;
    if (r.trend === "ema200" && ema200 && (side === "long" ? c < ema200[i] : c > ema200[i])) return null;
    if (r.trend === "vwap" && (side === "long" ? c < vwap[i] : c > vwap[i])) return null;
    const dir = side === "long" ? 1 : -1;
    let stop: number;
    const s = r.stop;
    if (s.kind === "plan" && own) stop = own.stop;
    else if (s.kind === "atr") stop = c - dir * s.mult * atrN[i];
    else if (s.kind === "points") stop = c - dir * s.pts;
    else if (s.kind === "ticks") stop = c - dir * s.n * tick;
    else if (s.kind === "swing") {
      let x = side === "long" ? Infinity : -Infinity;
      for (let k = Math.max(0, i - s.bars + 1); k <= i; k++) x = side === "long" ? Math.min(x, bars[k].l) : Math.max(x, bars[k].h);
      stop = x - dir * tick;
    } else if (s.kind === "signal") stop = (side === "long" ? bars[i].l : bars[i].h) - dir * tick;
    else stop = c - dir * 1.5 * atr14[i];
    const risk = (c - stop) * dir;
    if (!(risk > tick / 2)) return null;
    const t = r.target;
    const target = t.kind === "plan" && own ? own.target : t.kind === "points" ? c + dir * t.pts : c + dir * risk * (t.kind === "r" ? t.r : 2);
    if ((target - c) * dir <= 0) return null;
    return { reader: e.kind === "reader" ? e.reader : "custom", side, entry: c, stop, target };
  };

  return (i: number) => {
    if (i < 2 || i >= n) return null;
    const b = bars[i];
    const p = bars[i - 1];
    const bull = b.c > b.o;
    const bear = b.c < b.o;
    const day = sess[i].session;
    const once = (side: Side, f: () => CustomFire | null) => {
      const k = `${day}:${side}`;
      if (taken.has(k)) return null;
      const out = f();
      if (out) taken.add(k);
      return out;
    };
    switch (e.kind) {
      case "reader": {
        const f = _internal.detectAt(ctx, i, readers);
        return f ? plan(f.side, i, { stop: f.stop, target: f.target }) : null;
      }
      case "pdhl_retest": {
        const H = pdh[i];
        const L = pdl[i];
        if (!Number.isFinite(H)) return null;
        const tol = 0.1 * atr14[i];
        // A close beyond the level within the last `bars` bars (and not this bar), then a tag and a close back beyond.
        let brokeUp = false;
        let brokeDn = false;
        for (let k = Math.max(1, i - e.bars); k < i; k++) {
          if (sess[k].session !== day) continue;
          if (bars[k].c > H && bars[k - 1].c <= H) brokeUp = true;
          if (bars[k].c < L && bars[k - 1].c >= L) brokeDn = true;
        }
        if (brokeUp && b.l <= H + tol && b.c > H && bull) return once("long", () => plan("long", i));
        if (brokeDn && b.h >= L - tol && b.c < L && bear) return once("short", () => plan("short", i));
        return null;
      }
      case "pdhl_sweep": {
        const H = pdh[i];
        const L = pdl[i];
        if (!Number.isFinite(H)) return null;
        const lo = Math.min(b.l, p.l, bars[i - 2].l);
        const hi = Math.max(b.h, p.h, bars[i - 2].h);
        if (lo < L && b.c > L && bull) return once("long", () => plan("long", i));
        if (hi > H && b.c < H && bear) return once("short", () => plan("short", i));
        return null;
      }
      case "orb": {
        const m = sess[i].minute;
        const open = 9 * 60 + 30;
        if (m < open || m >= 16 * 60) return null;
        if (m < open + e.minutes) {
          orHi.set(day, Math.max(orHi.get(day) ?? -Infinity, b.h));
          orLo.set(day, Math.min(orLo.get(day) ?? Infinity, b.l));
          return null;
        }
        const H = orHi.get(day);
        const L = orLo.get(day);
        if (H == null || L == null) return null;
        if (b.c > H && p.c <= H) return once("long", () => plan("long", i));
        if (b.c < L && p.c >= L) return once("short", () => plan("short", i));
        return null;
      }
      case "vwap_cross": {
        if (p.c <= vwap[i - 1] && b.c > vwap[i]) return plan("long", i);
        if (p.c >= vwap[i - 1] && b.c < vwap[i]) return plan("short", i);
        return null;
      }
      case "ema_cross": {
        if (i < e.slow) return null;
        if (fast![i - 1] <= slow![i - 1] && fast![i] > slow![i]) return plan("long", i);
        if (fast![i - 1] >= slow![i - 1] && fast![i] < slow![i]) return plan("short", i);
        return null;
      }
      case "rsi": {
        if (rsiS![i - 1] < e.low && rsiS![i] >= e.low) return plan("long", i);
        if (rsiS![i - 1] > e.high && rsiS![i] <= e.high) return plan("short", i);
        return null;
      }
      case "fvg": {
        // A gap made by bars i-2..i is recorded; a later bar that trades back into it can fire.
        const a = bars[i - 2];
        let out: CustomFire | null = null;
        if (gapUp && i - gapUp.at <= 30 && b.l <= gapUp.top && b.c > gapUp.bottom && bull) {
          out = plan("long", i);
          gapUp = null;
        } else if (gapDn && i - gapDn.at <= 30 && b.h >= gapDn.bottom && b.c < gapDn.top && bear) {
          out = plan("short", i);
          gapDn = null;
        }
        if (gapUp && b.c < gapUp.bottom) gapUp = null;
        if (gapDn && b.c > gapDn.top) gapDn = null;
        if (b.l > a.h && b.l - a.h >= 0.15 * atr14[i]) gapUp = { top: b.l, bottom: a.h, at: i };
        if (b.h < a.l && a.l - b.h >= 0.15 * atr14[i]) gapDn = { top: a.l, bottom: b.h, at: i };
        return out;
      }
      case "structure": {
        // Pivots are known three bars after they print.
        while (pivK < piv!.length && piv![pivK].i + 3 <= i) {
          if (piv![pivK].kind === "high") lastHigh = piv![pivK].price;
          else lastLow = piv![pivK].price;
          pivK++;
        }
        if (lastHigh != null && b.c > lastHigh && p.c <= lastHigh) {
          lastHigh = null;
          return plan("long", i);
        }
        if (lastLow != null && b.c < lastLow && p.c >= lastLow) {
          lastLow = null;
          return plan("short", i);
        }
        return null;
      }
    }
  };
}
