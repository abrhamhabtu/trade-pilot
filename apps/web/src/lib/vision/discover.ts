// ─── Vision · Discover ─────────────────────────────────────────────────────────
// Finds what fits a chart right now, including setups the trader doesn't trade
// yet. Three steps, all honest about their samples:
//
//   1. Describe today in a few plain facts (the scenario): session window,
//      trend or range day, quiet or wild, the gap, the news.
//   2. Rate every idea on deep history: the five readers, Vision's patterns
//      and the scout's research ideas, each trade tagged with the scenario it
//      fired in, after fees and a tick of slippage.
//   3. Rank by how each did lately, nudged by how it did in days like today,
//      with thin samples shrunk toward the overall result so they can't shout.
//
// Testing many ideas on the same data manufactures winners by luck. The Proven
// badge allows for that: a pattern must clear a t-stat bar raised for the
// number of ideas tested (Bonferroni), on data newer than everything else.
// ───────────────────────────────────────────────────────────────────────────────

import type { Bar } from "@/lib/pilot/market";
import { READERS, READER_ORDER, infoOf, isReader, readerDetector, registerInfo, type Anchor, type Detector, type Fired, type PatternId, type ReaderChoice, type SetupSource } from "./analyze";
import { runBacktest, type BacktestContext } from "./backtest";
import { DEFAULT_RULES, SESSION_WINDOWS, customDetector, type CustomRules } from "./custom";
import { ECON_CALENDAR } from "./econ-calendar";
import { BUCKET_LABEL, type Bucket } from "./levels";
import { TF_SECONDS, type Timeframe, type VisionSymbolId } from "./markets";
import { PATTERNS, patternDetector, patternsFor, type Family, type PCtx } from "./patterns";
import { SCOUT_CATALOG, type ScoutCandidate } from "./scout-catalog";

// ── Your dials ─────────────────────────────────────────────────────────────────

/**
 * What Discover may show and how hard a pattern must work to be called proven.
 * Deliberately strict; the panel's settings can change them for display, but
 * real orders always use these.
 */
export const DISCOVER_DEFAULTS = {
  /** Only these get deep studies. */
  markets: ["NQ", "ES", "GC"] as string[],
  /** Sessions you will actually trade. */
  buckets: ["asia", "london", "ny-open", "ny-mid", "ny-pm"] as Bucket[],
  /** Fewer trades than this in the deep history: "unproven". */
  minTrades: 200,
  /** t-stat needed on the newest 30% of trades. */
  minT: 2.0,
  /** Share of calendar years that made money. */
  minGreenYears: 0.6,
  /** true hides patterns that lose on your markets instead of showing them greyed. */
  hideLosing: false,
};
export type Dials = typeof DISCOVER_DEFAULTS;

// ── The scenario ───────────────────────────────────────────────────────────────

export type DayType = "trend" | "range" | "mixed" | "none";
export type Vol = "quiet" | "normal" | "wild";
export type Gap = "up" | "flat" | "down" | "none";
export type News = "cpi" | "jobs" | "fomc";

export interface Scenario {
  bucket: Bucket;
  dayType: DayType;
  vol: Vol;
  gap: Gap;
  side: "above-vwap" | "below-vwap" | "none";
  inPriorRange: boolean | null;
  news: News[];
  text: string;
}

export interface Calendar {
  cpi: string[];
  jobs: string[];
  fomc: string[];
}
export const calendarOf = (fomc: string[] = []): Calendar => ({ cpi: ECON_CALENDAR.cpi, jobs: ECON_CALENDAR.jobs, fomc });

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The scenario's slow facts for every bar, worked out once and causally: each bar sees only its own session so far and the 20 before it. */
export interface ScenarioSeries {
  dayType: DayType[];
  vol: Vol[];
  gap: Gap[];
}

export function scenarioSeries(c: PCtx): ScenarioSeries {
  const { bars } = c;
  const dayType: DayType[] = [];
  const vol: Vol[] = [];
  const gap: Gap[] = [];
  type Day = { trAt: number[]; rangeAt: number[]; range: number | null };
  const prior: Day[] = [];
  let key = "";
  let cur: Day = { trAt: [], rangeAt: [], range: null };
  let tr = 0;
  let open: number | null = null;
  let hi = -Infinity;
  let lo = Infinity;
  let above = 0;
  let below = 0;
  let crosses = 0;
  let lastSide = 0;
  let medRange: number | null = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (c.session[i] !== key) {
      if (key) {
        if (open != null) cur.range = hi - lo;
        prior.push(cur);
        if (prior.length > 20) prior.shift();
      }
      key = c.session[i];
      cur = { trAt: [], rangeAt: [], range: null };
      tr = 0;
      open = null;
      hi = -Infinity;
      lo = Infinity;
      above = below = crosses = lastSide = 0;
      const full = prior.map((d) => d.range).filter((x): x is number => x != null);
      medRange = full.length >= 10 ? median(full) : null;
    }
    const prev = i ? bars[i - 1].c : b.o;
    tr += Math.max(b.h - b.l, Math.abs(b.h - prev), Math.abs(b.l - prev));
    const k = cur.trAt.length;
    cur.trAt.push(tr / (k + 1));
    // Volatility: this session's average true range so far against the same stretch of the 20 before.
    const peers = prior.filter((d) => d.trAt.length > k).map((d) => d.trAt[k]);
    if (peers.length >= 10) {
      const share = peers.filter((p) => p < tr / (k + 1)).length / peers.length;
      vol.push(share < 1 / 3 ? "quiet" : share > 2 / 3 ? "wild" : "normal");
    } else vol.push("normal");

    const inRth = c.sessions && c.sessionStart[i] >= 0;
    if (inRth) {
      if (open == null) open = b.o;
      hi = Math.max(hi, b.h);
      lo = Math.min(lo, b.l);
      const r = cur.rangeAt.length;
      cur.rangeAt.push(hi - lo);
      const side = b.c > c.vwap[i] ? 1 : b.c < c.vwap[i] ? -1 : 0;
      if (side > 0) above++;
      if (side < 0) below++;
      if (side && lastSide && side !== lastSide) crosses++;
      if (side) lastSide = side;
      if (c.minute[i] >= 10 * 60 && medRange != null) {
        const share = Math.max(above, below) / Math.max(1, above + below);
        const peersAt = prior.filter((d) => d.rangeAt.length > r).map((d) => d.rangeAt[r]);
        const usual = peersAt.length >= 10 ? median(peersAt) : null;
        if (Math.abs(b.c - open) >= 0.5 * medRange && share >= 0.7) dayType.push("trend");
        else if (usual != null && hi - lo < 0.6 * usual && crosses >= 4) dayType.push("range");
        else dayType.push("mixed");
      } else dayType.push("none");
    } else dayType.push("none");
    const pdc = c.levels[i]?.pdc;
    if (open != null && pdc != null && medRange) {
      const g = (open - pdc) / medRange;
      gap.push(g > 0.25 ? "up" : g < -0.25 ? "down" : "flat");
    } else gap.push("none");
  }
  return { dayType, vol, gap };
}

const vwapOf = (c: PCtx, i: number) => (Number.isFinite(c.vwap[i]) ? c.vwap[i] : c.gvwap[i]);

export function scenarioAt(c: PCtx, i: number, cal: Calendar, series: ScenarioSeries = scenarioSeries(c), name = ""): Scenario {
  const b = c.bars[i];
  const v = vwapOf(c, i);
  const lv = c.levels[i];
  const date = c.session[i];
  const news: News[] = [];
  if (cal.cpi.includes(date)) news.push("cpi");
  if (cal.jobs.includes(date)) news.push("jobs");
  if (cal.fomc.includes(date)) news.push("fomc");
  const s: Omit<Scenario, "text"> = {
    bucket: c.sessions ? c.bucket[i] : "off",
    dayType: series.dayType[i],
    vol: series.vol[i],
    gap: series.gap[i],
    side: !Number.isFinite(v) ? "none" : b.c >= v ? "above-vwap" : "below-vwap",
    inPriorRange: lv && lv.pdh != null && lv.pdl != null ? b.c <= lv.pdh && b.c >= lv.pdl : null,
    news,
  };
  return { ...s, text: scenarioText(name, s, c.sessions) };
}

export function scenarioText(name: string, s: Omit<Scenario, "text">, sessions = true): string {
  const parts: string[] = [];
  if (name) parts.push(name);
  if (sessions) parts.push(BUCKET_LABEL[s.bucket]);
  const day = s.dayType === "trend" ? "trend day" : s.dayType === "range" ? "range day" : s.dayType === "mixed" ? "two-sided day" : null;
  const tone = s.vol === "quiet" ? "quiet" : s.vol === "wild" ? "volatile" : "";
  if (day) parts.push(`a ${tone ? `${tone} ` : ""}${day} so far`);
  else if (tone) parts.push(`${tone} so far`);
  if (s.gap !== "none") {
    const where = s.inPriorRange === true ? " inside yesterday's range" : s.inPriorRange === false ? " outside yesterday's range" : "";
    parts.push(`${s.gap === "flat" ? "opened flat" : `gapped ${s.gap}`}${where ? `, now${where}` : ""}`);
  } else if (s.inPriorRange != null) parts.push(s.inPriorRange ? "inside yesterday's range" : "outside yesterday's range");
  const news = s.news.map((n) => (n === "cpi" ? "CPI" : n === "jobs" ? "jobs report" : "FOMC"));
  if (news.length) parts.push(`${news.join(" and ")} today`);
  const t = parts.join(", ");
  return t ? `${t[0].toUpperCase()}${t.slice(1)}.` : "";
}

// ── Ideas ──────────────────────────────────────────────────────────────────────

export type IdeaKind = "reader" | "pattern" | "scout";

export interface Idea {
  id: SetupSource;
  kind: IdeaKind;
  label: string;
  short: string;
  /** What it is and why it might work. */
  idea: string;
  family?: Family;
  rules: CustomRules;
  playbooks?: string[];
  scout?: ScoutCandidate;
}

const ownRules = (entry: CustomRules["entry"]): CustomRules => ({ ...DEFAULT_RULES, entry, stop: { kind: "plan" }, target: { kind: "plan" }, session: null, maxPerDay: null });

/** Everything Discover may read this chart with: the readers, the patterns that fit it, and the scout's ideas made for its timeframe (never the coin flip, which is the baseline). */
export function ideasFor(symbol: VisionSymbolId, tf: Timeframe, futures: boolean, extra: ScoutCandidate[] = []): Idea[] {
  const tfMin = TF_SECONDS[tf] / 60;
  const out: Idea[] = [];
  for (const r of READER_ORDER) {
    if (r === "orb" && tfMin > 15) continue;
    out.push({ id: r, kind: "reader", label: READERS[r].label, short: READERS[r].short, idea: READERS[r].blurb, rules: ownRules({ kind: "reader", reader: r }) });
  }
  for (const p of patternsFor(symbol, tfMin, futures)) {
    const info = PATTERNS[p];
    out.push({ id: p, kind: "pattern", label: info.label, short: info.short, idea: info.idea, family: info.family, rules: ownRules({ kind: "pattern", pattern: p }), playbooks: info.playbooks });
  }
  if (futures)
    for (const c of [...SCOUT_CATALOG, ...extra]) {
      if (c.id === "coin-flip" || c.tf !== tf) continue;
      const id = `scout:${c.id}` as const;
      registerInfo({ id, label: c.name, short: c.name, blurb: c.idea, line: "vwap" });
      out.push({ id, kind: "scout", label: c.name, short: c.name, idea: c.idea, rules: c.rules, scout: c });
    }
  return out;
}

/** "NEW" means not one of the trader's five readers and not pinned. */
export const isNew = (id: SetupSource, pinned: SetupSource[]) => !isReader(id) && !pinned.includes(id);

/** A scout idea as a chart detector. Its rules run once over the bars, in order, since some of them keep state through the day. */
export function scoutDetector(c: ScoutCandidate, bars: Bar[], anchor: Anchor, tick: number): Detector {
  const fn = customDetector(bars, anchor, c.rules, tick);
  const fires = bars.map((_, i) => fn(i));
  const id = `scout:${c.id}` as const;
  registerInfo({ id, label: c.name, short: c.name, blurb: c.idea, line: "vwap" });
  return {
    id,
    info: infoOf(id),
    detect: (_ctx, i) => {
      const f = fires[i];
      if (!f) return null;
      const risk = Math.abs(f.entry - f.stop);
      const out: Fired = { reader: id, side: f.side, level: f.entry, levelIndex: i, sweepIndex: i, index: i, entry: f.entry, stop: f.stop, target: f.target, rr: risk ? Math.abs(f.target - f.entry) / risk : 0, zone: null, marks: [i, i, i], volume: { from: i, to: i, ratio: 1 } };
      return out;
    },
  };
}

/** The detector for one idea on these (closed) bars. */
export function detectorFor(idea: Idea, bars: Bar[], anchor: Anchor, tick: number): Detector {
  if (idea.kind === "reader") return readerDetector(idea.id as Parameters<typeof readerDetector>[0]);
  if (idea.kind === "pattern") return patternDetector(idea.id as PatternId);
  return scoutDetector(idea.scout!, bars, anchor, tick);
}

/** What a chart is read with: a reader, all of them, Discover, or one pattern or scout idea. */
export type ChartRead = ReaderChoice | "discover" | PatternId | `scout:${string}`;

// ── Rows: every trade an idea took, tagged with its scenario ──────────────────

export interface Row {
  t: number;
  side: 0 | 1;
  /** After fees and a tick of slippage. */
  r: number;
  bucket: Bucket;
  dayType: DayType;
  vol: Vol;
  gap: Gap;
}
export type PackedRow = [number, 0 | 1, number, number, number, number, number];
const BUCKETS: Bucket[] = ["asia", "london", "pre", "ny-open", "ny-mid", "ny-pm", "off"];
const DAYTYPES: DayType[] = ["trend", "range", "mixed", "none"];
const VOLS: Vol[] = ["quiet", "normal", "wild"];
const GAPS: Gap[] = ["up", "flat", "down", "none"];
export const pack = (r: Row): PackedRow => [r.t, r.side, Math.round(r.r * 1e4) / 1e4, BUCKETS.indexOf(r.bucket), DAYTYPES.indexOf(r.dayType), VOLS.indexOf(r.vol), GAPS.indexOf(r.gap)];
export const unpack = (p: PackedRow): Row => ({ t: p[0], side: p[1], r: p[2], bucket: BUCKETS[p[3]], dayType: DAYTYPES[p[4]], vol: VOLS[p[5]], gap: GAPS[p[6]] });

export interface StudyEnv {
  anchor: Anchor;
  tick: number;
  /** Dollars per point for one contract, and the round-trip fee for it. */
  pointValue: number;
  fee: number;
  maxHold: number;
  context: BacktestContext;
}

/** Each idea's trades on these bars, tagged. Only trades entered in [from, to) are kept. */
export function studyRows(bars: Bar[], ideas: Idea[], env: StudyEnv, scen: { ctx: PCtx; series: ScenarioSeries }, window: { from: number; to: number } = { from: -Infinity, to: Infinity }, tick?: (done: number) => void): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  ideas.forEach((idea, k) => {
    const r = runBacktest(bars, {
      reader: "auto",
      custom: idea.rules,
      anchor: env.anchor,
      side: idea.rules.side,
      pointValue: env.pointValue,
      contracts: 1,
      commission: env.fee,
      slippageTicks: 1,
      tick: env.tick,
      maxHold: env.maxHold,
      breakEvenR: idea.rules.breakEvenR,
      maxPerDay: idea.rules.maxPerDay,
      skipFomc: false,
      skipEarly: true,
      vix: "any",
      hours: idea.rules.session ? SESSION_WINDOWS[idea.rules.session].hours : null,
      context: env.context,
    });
    out[idea.id] = r.trades
      .filter((t) => t.entryT >= window.from && t.entryT < window.to && t.riskUsd > 0)
      .map((t) => ({ t: t.entryT, side: t.side === "long" ? 1 : 0, r: t.pnl / t.riskUsd, bucket: scen.ctx.sessions ? scen.ctx.bucket[t.entryIndex] : "off", dayType: scen.series.dayType[t.entryIndex], vol: scen.series.vol[t.entryIndex], gap: scen.series.gap[t.entryIndex] }));
    tick?.(k + 1);
  });
  return out;
}

// ── Studies, verdicts and the score ────────────────────────────────────────────

export interface Side3 {
  trades: number;
  avgR: number;
  winRate: number;
  t: number;
}
export type Dim = "bucket" | "dayType" | "vol" | "gap";
export const DIMS: Dim[] = ["bucket", "dayType", "vol", "gap"];

export interface DetectorStudy {
  id: SetupSource;
  tf: Timeframe;
  trades: number;
  meanR: number;
  winRate: number;
  older: Side3;
  newer: Side3;
  greenYears: number;
  /** First and last trade, unix seconds. */
  span: [number, number];
  /** Count and sum of R for each value of each scenario fact. */
  dims: Record<Dim, Record<string, [number, number]>>;
  /** Cumulative R at 60 even steps, for the sparkline. */
  spark: number[];
  /** Deep library history, or only the recent bars the browser could fetch. */
  source: "library" | "recent";
  /** For scout ideas: the scout's own verdict, which Discover follows. */
  scout?: { verdict: "recommended" | "watch" | "rejected"; reason: string; newerT: number };
}

/** Same arithmetic as the scout's sideOf(), so the two agree on every number. */
export function sideOf(rs: number[]): Side3 {
  const n = Math.max(1, rs.length);
  const avg = rs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, n - 1)) || 1;
  return { trades: rs.length, avgR: avg, winRate: rs.filter((r) => r > 0).length / n, t: (avg / sd) * Math.sqrt(n) };
}

const yearOf = (t: number) => new Date((t - 5 * 3600) * 1000).getUTCFullYear();

export function summarize(id: SetupSource, tf: Timeframe, rows: Row[], source: DetectorStudy["source"]): DetectorStudy {
  const sorted = [...rows].sort((a, b) => a.t - b.t);
  const cut = Math.floor(sorted.length * 0.7);
  const rs = sorted.map((x) => x.r);
  const all = sideOf(rs);
  const years = new Map<number, number>();
  for (const x of sorted) years.set(yearOf(x.t), (years.get(yearOf(x.t)) ?? 0) + x.r);
  const dims = { bucket: {}, dayType: {}, vol: {}, gap: {} } as DetectorStudy["dims"];
  for (const x of sorted)
    for (const d of DIMS) {
      const cell = (dims[d][x[d]] ??= [0, 0]);
      cell[0]++;
      cell[1] += x.r;
    }
  const spark: number[] = [];
  let run = 0;
  const step = Math.max(1, sorted.length / 60);
  let next = step;
  sorted.forEach((x, k) => {
    run += x.r;
    if (k + 1 >= next || k === sorted.length - 1) {
      spark.push(Math.round(run * 100) / 100);
      next += step;
    }
  });
  return {
    id,
    tf,
    trades: sorted.length,
    meanR: all.avgR,
    winRate: all.winRate,
    older: sideOf(rs.slice(0, cut)),
    newer: sideOf(rs.slice(cut)),
    greenYears: years.size ? [...years.values()].filter((v) => v > 0).length / years.size : 0,
    span: sorted.length ? [sorted[0].t, sorted[sorted.length - 1].t] : [0, 0],
    dims,
    spark: spark.slice(0, 60),
    source,
  };
}

/** Inverse of the standard normal distribution (Acklam's approximation, plenty for a threshold). */
export function probit(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -probit(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** The t-stat a pattern needs when `m` ideas were tested on the same market: the two-sided 5% bar, split m ways. */
export const tNeeded = (m: number) => probit(1 - 0.025 / Math.max(1, m));

export type Verdict = "proven" | "promising" | "unproven" | "losing";
export interface Judged {
  verdict: Verdict;
  reason: string;
  /** The corrected bar this pattern had to clear. */
  need: number;
}

/**
 * The badge, in the scout's order of tests so the two never disagree on a
 * pattern both judge. Discover adds one more test, never fewer: the bar raised
 * for how many ideas were tested.
 */
export function judgeStudy(st: DetectorStudy, dials: Dials, m: number): Judged {
  const need = tNeeded(m);
  const tLine = `t ${st.newer.t.toFixed(1)}; needs ${need.toFixed(1)} with ${m} ideas tested`;
  if (st.source === "recent") return st.trades && st.newer.trades >= 5 && st.newer.avgR <= 0 ? { verdict: "losing", reason: `Loses on the recent bars loaded here (${st.trades} trades). Only recent history: nothing here can be rated proven.`, need } : { verdict: "unproven", reason: `Only recent history (${st.trades} trades): nothing here can be rated proven.`, need };
  if (st.scout) {
    // The scout already judged this idea on the same years; follow it.
    const s = st.scout;
    if (s.verdict === "recommended") return s.newerT >= need ? { verdict: "proven", reason: `${s.reason} Clears the ${need.toFixed(1)} bar for ${m} ideas.`, need } : { verdict: "promising", reason: `The scout recommends it, but t ${s.newerT.toFixed(1)} needs ${need.toFixed(1)} with ${m} ideas tested.`, need };
    if (s.verdict === "watch") return { verdict: "promising", reason: s.reason, need };
    return { verdict: st.newer.avgR <= 0 ? "losing" : "unproven", reason: s.reason, need };
  }
  if (st.trades < dials.minTrades) return { verdict: "unproven", reason: `Only ${st.trades} trades in the history, too few to judge (needs ${dials.minTrades}).`, need };
  if (st.newer.avgR <= 0) return { verdict: "losing", reason: `Loses on the newest data: ${st.newer.avgR.toFixed(3)}R a trade over ${st.newer.trades} trades.`, need };
  if (st.older.avgR <= 0) return { verdict: "unproven", reason: `Positive lately, but negative in the ${st.older.trades} trades before that. Likely a recent fluke.`, need };
  if (st.newer.t < dials.minT) return { verdict: "promising", reason: `Positive on old and new data, but not clearly different from luck (t-stat ${st.newer.t.toFixed(1)} on the newest trades; it needs ${dials.minT}).`, need };
  if (st.greenYears < dials.minGreenYears) return { verdict: "promising", reason: `Only ${Math.round(st.greenYears * 100)}% of years were green. It depends on a few good stretches.`, need };
  if (st.newer.t < need) return { verdict: "promising", reason: `Holds up on new data, but ${tLine}.`, need };
  return { verdict: "proven", reason: `Held up on data it never saw: ${st.newer.avgR >= 0 ? "+" : ""}${st.newer.avgR.toFixed(3)}R a trade, ${tLine.replace("needs", "clears")}, ${Math.round(st.greenYears * 100)}% of years green.`, need };
}

/** How hard a thin sample is pulled toward the overall result. */
export const SHRINK = 30;

export interface Fit {
  /** Mean R on the newest 30% plus the fit: what ranks. */
  score: number;
  fit: number;
  /** The scenario fact that moves this idea most, for the tooltip. */
  best: { dim: Dim; value: string; meanR: number; trades: number; lift: number } | null;
}

export function fitOf(st: DetectorStudy, s: Pick<Scenario, Dim>): Fit {
  const overall = st.meanR;
  const lifts: Fit["best"][] = [];
  for (const d of DIMS) {
    const v = s[d];
    if (v === "none") continue;
    const [n, sum] = st.dims[d][v] ?? [0, 0];
    const r = n ? sum / n : 0;
    const lift = (n * r + SHRINK * overall) / (n + SHRINK) - overall;
    lifts.push({ dim: d, value: v, meanR: r, trades: n, lift });
  }
  const fit = lifts.length ? lifts.reduce((a, l) => a + l!.lift, 0) / lifts.length : 0;
  const best = lifts.reduce<Fit["best"]>((b, l) => (!b || Math.abs(l!.lift) > Math.abs(b.lift) ? l : b), null);
  return { score: st.newer.avgR + fit, fit, best };
}

export const DIM_LABEL = (d: Dim, v: string) =>
  d === "bucket" ? BUCKET_LABEL[v as Bucket] : d === "dayType" ? `${v[0].toUpperCase()}${v.slice(1)} days` : d === "vol" ? `${v[0].toUpperCase()}${v.slice(1)} sessions` : v === "flat" ? "Flat opens" : `Gap ${v} days`;

export interface Ranked {
  idea: Idea;
  study: DetectorStudy | null;
  judged: Judged | null;
  fit: Fit | null;
}

/** Best fit first; anything losing lately goes below everything else, and ideas with no study go last. */
export function rankIdeas(ideas: Idea[], studies: Map<string, DetectorStudy>, s: Pick<Scenario, Dim>, dials: Dials, m: number): Ranked[] {
  const rows: Ranked[] = ideas.map((idea) => {
    const study = studies.get(idea.id) ?? null;
    return { idea, study, judged: study ? judgeStudy(study, dials, m) : null, fit: study ? fitOf(study, s) : null };
  });
  const tier = (r: Ranked) => (!r.study ? 2 : r.judged!.verdict === "losing" ? 1 : 0);
  return rows.sort((a, b) => tier(a) - tier(b) || (b.fit?.score ?? 0) - (a.fit?.score ?? 0) || (a.idea.id < b.idea.id ? -1 : 1));
}

/** The line under a fit chip: the fact that moves it most, with its sample. */
export function fitLine(f: Fit, st: DetectorStudy) {
  if (!f.best) return "";
  const sign = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}R`;
  return `${DIM_LABEL(f.best.dim, f.best.value)}: ${sign(f.best.meanR)} over ${f.best.trades.toLocaleString("en-US")} trades, against ${sign(st.meanR)} overall`;
}

/** Where a study's numbers come from, said every time they are shown. */
export function sourceLine(st: DetectorStudy) {
  const y = (t: number) => new Date(t * 1000).getUTCFullYear();
  return `${st.tf} · ${st.source === "library" ? `${y(st.span[0])} to ${y(st.span[1])}` : "recent bars only"} · ${st.trades.toLocaleString("en-US")} trades · after costs`;
}
