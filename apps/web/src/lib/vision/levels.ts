// ─── Vision · sessions and day levels ──────────────────────────────────────────
// Where in the futures day a bar sits, and the levels traders watch: prior
// day, overnight, Asia, London, the opening range and the initial balance.
// Every clock decision goes through sessionOf(), which handles daylight saving.
// ───────────────────────────────────────────────────────────────────────────────

import { sessionOf } from "@/lib/pilot/market";

export type Bucket = "asia" | "london" | "pre" | "ny-open" | "ny-mid" | "ny-pm" | "off";

export const BUCKET_LABEL: Record<Bucket, string> = {
  asia: "Asia",
  london: "London",
  pre: "Pre-market",
  "ny-open": "New York open",
  "ny-mid": "New York midday",
  "ny-pm": "New York afternoon",
  off: "Closed hours",
};

const H = 60;

/** Session window for a minute of the New York day. Asia 19:00–02:00, London 03:00–08:00, pre 08:00–09:30, then New York in three parts to 16:00. */
export function bucketOfMinute(m: number): Bucket {
  if (m >= 19 * H || m < 2 * H) return "asia";
  if (m >= 3 * H && m < 8 * H) return "london";
  if (m >= 8 * H && m < 9 * H + 30) return "pre";
  if (m >= 9 * H + 30 && m < 11 * H + 30) return "ny-open";
  if (m >= 11 * H + 30 && m < 14 * H) return "ny-mid";
  if (m >= 14 * H && m < 16 * H) return "ny-pm";
  return "off";
}

export const bucketOf = (t: number): Bucket => bucketOfMinute(sessionOf(t).minute);

/** The three sessions a chart shades, for runs of bars. */
export type Shade = "asia" | "london" | "ny";
export const shadeOf = (b: Bucket): Shade | null => (b === "asia" ? "asia" : b === "london" ? "london" : b === "ny-open" || b === "ny-mid" || b === "ny-pm" ? "ny" : null);

/** Runs of consecutive bars in the same shaded session: [from, to] indexes. */
export function sessionRuns(ts: number[]): { shade: Shade; from: number; to: number }[] {
  const out: { shade: Shade; from: number; to: number }[] = [];
  ts.forEach((t, i) => {
    const s = shadeOf(bucketOf(t));
    const last = out[out.length - 1];
    if (s && last && last.shade === s && last.to === i - 1) last.to = i;
    else if (s) out.push({ shade: s, from: i, to: i });
  });
  return out;
}

// ── Day levels ─────────────────────────────────────────────────────────────────

export interface DayLevels {
  /** The futures trading day this bar belongs to (it starts at 18:00 New York the evening before). */
  session: string;
  /** Prior regular session's high, low and close. */
  pdh: number | null;
  pdl: number | null;
  pdc: number | null;
  /** Overnight, 18:00 to 09:30: the running extreme until 09:30, then frozen. Final only from 09:30. */
  onh: number | null;
  onl: number | null;
  /** Asia 19:00 to 02:00: null until 02:00, then frozen. */
  asiaH: number | null;
  asiaL: number | null;
  /** London 03:00 to 08:00: null until 08:00, then frozen. */
  lonH: number | null;
  lonL: number | null;
  /** Opening range, the first 15 minutes of New York: null until 09:45. */
  orH: number | null;
  orL: number | null;
  /** Initial balance, the first hour of New York: null until 10:30. */
  ibH: number | null;
  ibL: number | null;
  rthOpen: number | null;
  /** This regular session so far: high, low and how many bars. */
  rthHi: number | null;
  rthLo: number | null;
  /** Medians over the prior 20 regular sessions, null under 10 sessions: full range, and first-hour range. */
  rangeMed: number | null;
  ibMed: number | null;
  /** Prior regular sessions the medians stand on. */
  history: number;
}

const OPEN = 9 * H + 30;
const CLOSE = 16 * H;
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

interface Window {
  hi: number;
  lo: number;
  seen: boolean;
}
const empty = (): Window => ({ hi: -Infinity, lo: Infinity, seen: false });
const take = (w: Window, b: { h: number; l: number }) => {
  w.hi = Math.max(w.hi, b.h);
  w.lo = Math.min(w.lo, b.l);
  w.seen = true;
};
const hi = (w: Window) => (w.seen ? w.hi : null);
const lo = (w: Window) => (w.seen ? w.lo : null);

/**
 * One entry per bar, each from bars up to and including that bar only.
 * A window's level appears on the first bar after the window ends, never on
 * a bar inside it, so nothing here can see the future.
 */
export function levelsFor(bars: { t: number; o: number; h: number; l: number; c: number }[]): DayLevels[] {
  const out: DayLevels[] = [];
  let key = "";
  let prior = null as { h: number; l: number; c: number } | null;
  const ranges: number[] = [];
  const ibs: number[] = [];
  let on = empty();
  let asia = empty();
  let lon = empty();
  let or = empty();
  let ib = empty();
  let rth = empty();
  let rthClose: number | null = null;
  let rthOpen: number | null = null;
  const close = () => {
    // The day that just ended becomes "prior", and feeds the medians.
    if (rth.seen && rthClose != null) {
      prior = { h: rth.hi, l: rth.lo, c: rthClose };
      ranges.push(rth.hi - rth.lo);
      if (ib.seen) ibs.push(ib.hi - ib.lo);
      if (ranges.length > 20) ranges.shift();
      if (ibs.length > 20) ibs.shift();
    }
    on = empty();
    asia = empty();
    lon = empty();
    or = empty();
    ib = empty();
    rth = empty();
    rthClose = null;
    rthOpen = null;
  };
  let meds = { rangeMed: null as number | null, ibMed: null as number | null, history: 0 };
  for (const b of bars) {
    const s = sessionOf(b.t);
    if (s.session !== key) {
      if (key) close();
      key = s.session;
      meds = { rangeMed: ranges.length >= 10 ? median(ranges) : null, ibMed: ibs.length >= 10 ? median(ibs) : null, history: ranges.length };
    }
    const m = s.minute;
    // Into this bar's windows first, so a bar inside a window counts toward it.
    if (m >= 18 * H || m < OPEN) take(on, b);
    if (m >= 19 * H || m < 2 * H) take(asia, b);
    if (m >= 3 * H && m < 8 * H) take(lon, b);
    if (m >= OPEN && m < OPEN + 15) take(or, b);
    if (m >= OPEN && m < OPEN + 60) take(ib, b);
    if (m >= OPEN && m < CLOSE) {
      if (rthOpen == null) rthOpen = b.o;
      take(rth, b);
      rthClose = b.c;
    }
    const day = m < 18 * H; // after midnight or the day session: the windows that end today can have ended
    out.push({
      session: key,
      pdh: prior?.h ?? null,
      pdl: prior?.l ?? null,
      pdc: prior?.c ?? null,
      onh: hi(on),
      onl: lo(on),
      asiaH: day && m >= 2 * H ? hi(asia) : null,
      asiaL: day && m >= 2 * H ? lo(asia) : null,
      lonH: day && m >= 8 * H ? hi(lon) : null,
      lonL: day && m >= 8 * H ? lo(lon) : null,
      orH: day && m >= OPEN + 15 ? hi(or) : null,
      orL: day && m >= OPEN + 15 ? lo(or) : null,
      ibH: day && m >= OPEN + 60 ? hi(ib) : null,
      ibL: day && m >= OPEN + 60 ? lo(ib) : null,
      rthOpen,
      rthHi: hi(rth),
      rthLo: lo(rth),
      ...meds,
    });
  }
  return out;
}

/** True once the overnight range is final for the day (09:30 New York). */
export const overnightFinal = (t: number) => {
  const m = sessionOf(t).minute;
  return m >= OPEN && m < 18 * H;
};

/** VWAP anchored at the Globex open (18:00 New York) with a running standard deviation, defined around the clock. */
export function globexVwap(bars: { t: number; h: number; l: number; c: number; v: number }[]): { vwap: number[]; sd: number[] } {
  const vwap: number[] = [];
  const sd: number[] = [];
  let key = "";
  let pv = 0;
  let pv2 = 0;
  let vv = 0;
  for (const b of bars) {
    const k = sessionOf(b.t).session;
    if (k !== key) {
      key = k;
      pv = 0;
      pv2 = 0;
      vv = 0;
    }
    const tp = (b.h + b.l + b.c) / 3;
    const w = b.v || 1;
    pv += tp * w;
    pv2 += tp * tp * w;
    vv += w;
    const mean = pv / vv;
    vwap.push(mean);
    sd.push(Math.sqrt(Math.max(0, pv2 / vv - mean * mean)));
  }
  return { vwap, sd };
}

/**
 * Levels for each chart bar, read from a separate (usually 5m) history: the
 * latest history bar that had closed by the time the chart bar closed. A 15m
 * bar sees the three 5m bars inside it and nothing after.
 */
export function alignLevels(bars: { t: number }[], chartStepSec: number, hist: { t: number }[], levels: DayLevels[], histStepSec: number): (DayLevels | null)[] {
  const out: (DayLevels | null)[] = [];
  let k = -1;
  for (const b of bars) {
    while (k + 1 < hist.length && hist[k + 1].t + histStepSec <= b.t + chartStepSec) k++;
    out.push(k >= 0 ? levels[k] : null);
  }
  return out;
}
