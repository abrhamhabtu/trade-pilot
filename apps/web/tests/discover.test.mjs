import test from "node:test";
import assert from "node:assert/strict";
import { DISCOVER_DEFAULTS, SHRINK, fitOf, ideasFor, judgeStudy, rankIdeas, scenarioAt, scenarioSeries, summarize, tNeeded, sideOf } from "../src/lib/vision/discover.ts";
import { patternContext } from "../src/lib/vision/patterns.ts";
import { levelsFor } from "../src/lib/vision/levels.ts";
import { analyze, readerDetector, SPECIFICITY } from "../src/lib/vision/analyze.ts";

// ── Built days on the New York clock (January: UTC = New York + 5h) ────────────

const utc = (date, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Date.parse(`${date}T00:00:00Z`) / 1000 + (h + 5) * 3600 + m * 60;
};
const ny = (t) => {
  const d = new Date((t - 5 * 3600) * 1000);
  return { date: d.toISOString().slice(0, 10), m: d.getUTCHours() * 60 + d.getUTCMinutes() };
};

/** Weekdays of 5m bars; regular hours swing ±2 around 100, the night is calm. `last(m, k, prev)` shapes the final day's New York session. */
function days(n, last) {
  const bars = [];
  let prev = 100;
  let k = 0;
  const start = utc("2025-01-02", "09:30");
  let sessionsDone = 0;
  let lastDate = "";
  for (let t = start; ; t += 300) {
    const c = ny(t);
    const dow = new Date(`${c.date}T12:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6 || (c.m >= 16 * 60 && c.m < 18 * 60) || (dow === 5 && c.m >= 16 * 60)) continue;
    if (c.m >= 9 * 60 + 30 && c.m < 16 * 60) {
      if (c.date !== lastDate) {
        sessionsDone++;
        lastDate = c.date;
        k = 0;
      }
      const isLast = sessionsDone === n;
      const o = prev;
      const close = isLast && last ? last(c.m, k, prev) : 100 + 2 * Math.sin(k / 3);
      bars.push({ t, o: k === 0 && isLast && last?.open ? last.open : o, h: Math.max(o, close) + 0.2, l: Math.min(o, close) - 0.2, c: close, v: 100 });
      prev = close;
      k++;
      if (isLast && c.m >= 13 * 60) break;
    } else {
      const close = 100 + 0.1 * Math.sin(t / 900);
      bars.push({ t, o: prev, h: Math.max(prev, close) + 0.1, l: Math.min(prev, close) - 0.1, c: close, v: 50 });
      prev = close;
    }
  }
  return bars;
}

const read = (bars, at, cal = { cpi: [], jobs: [], fomc: [] }) => {
  const c = patternContext(bars, "rth", levelsFor(bars));
  const i = bars.findIndex((b) => ny(b.t).m === at && ny(b.t).date === ny(bars.at(-1).t).date);
  return scenarioAt(c, i, cal, scenarioSeries(c), "NQ");
};

test("a day that climbs from the open, above VWAP, is a trend day", () => {
  const s = read(days(22, (m, k) => 100 + 0.2 * k), 11 * 60);
  assert.equal(s.dayType, "trend");
  assert.equal(s.side, "above-vwap");
  assert.equal(s.bucket, "ny-open");
});

test("a tight day that keeps crossing VWAP is a range day, and quiet", () => {
  const s = read(days(22, (m, k) => 100 + (k % 2 ? 0.1 : -0.1)), 11 * 60);
  assert.equal(s.dayType, "range");
  assert.equal(s.vol, "quiet");
  assert.match(s.text, /^NQ, New York open, a quiet range day so far/);
});

test("before 10:00 the day has no type yet; the gap is known from the open", () => {
  const last = (m, k) => 106 + 2 * Math.sin(k / 3);
  last.open = 106;
  const bars = days(22, last);
  const early = read(bars, 9 * 60 + 45);
  assert.equal(early.dayType, "none");
  assert.equal(early.gap, "up");
  assert.equal(early.inPriorRange, false);
});

test("news days are named, from the calendar given", () => {
  const bars = days(22);
  const date = ny(bars.at(-1).t).date;
  const s = read(bars, 10 * 60 + 30, { cpi: [date], jobs: [], fomc: [date] });
  assert.deepEqual(s.news, ["cpi", "fomc"]);
  assert.match(s.text, /CPI and FOMC today\.$/);
});

// ── Studies and scoring ───────────────────────────────────────────────────────

/** Rows over several years: `r(k)` for each, all in one scenario cell unless told otherwise. */
function rows(n, r, cell = () => ({})) {
  const t0 = Date.UTC(2018, 0, 2) / 1000;
  return Array.from({ length: n }, (_, k) => ({ t: t0 + k * 86_400 * 2, side: k % 2, r: r(k), bucket: "ny-open", dayType: "mixed", vol: "normal", gap: "flat", ...cell(k) }));
}
const scen = { bucket: "ny-open", dayType: "range", vol: "normal", gap: "flat" };

test("a scenario with three trades barely moves the score; one with three hundred does", () => {
  // Overall +0.1R. Range days are +2R a trade: three of them in one study, three hundred in the other.
  const thin = summarize("pd_sweep", "5m", rows(1000, (k) => (k < 3 ? 2 : 0.1 - (3 * 1.9) / 997), (k) => (k < 3 ? { dayType: "range" } : {})), "library");
  const thick = summarize("pd_sweep", "5m", rows(1000, (k) => (k < 300 ? 0.3 : 0.1 - (300 * 0.2) / 700), (k) => (k < 300 ? { dayType: "range" } : {})), "library");
  const a = fitOf(thin, scen);
  const b = fitOf(thick, scen);
  const liftThin = a.best.lift;
  // (3·2 + 30·0.1)/(33) − 0.1 ≈ 0.17 over one dimension, averaged with three near-zero ones.
  assert.ok(Math.abs(a.fit) < 0.06, `thin: ${a.fit}`);
  assert.ok(b.fit > a.fit, "the thick cell counts for more");
  assert.equal(b.best.dim, "dayType");
  assert.ok(Math.abs(liftThin - ((3 * 2 + SHRINK * thin.meanR) / (3 + SHRINK) - thin.meanR)) < 1e-9);
});

test("verdicts: too few, losing, a recent fluke, not past luck, a few good years, and the bar for many ideas", () => {
  const d = DISCOVER_DEFAULTS;
  const j = (rs, m = 1) => judgeStudy(summarize("fvg_cont", "5m", rows(rs.length, (k) => rs[k]), "library"), d, m).verdict;
  const noisy = (mean, n, sd = 1, seed = 3) => {
    let s = seed;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    return Array.from({ length: n }, () => mean + (r() - 0.5) * sd * 3.46);
  };
  assert.equal(j(noisy(0.3, 150)), "unproven", "under 200 trades");
  assert.equal(j([...noisy(0.2, 700), ...noisy(-0.1, 300, 1, 9)]), "losing", "the newest 30% loses");
  assert.equal(j([...noisy(-0.2, 700), ...noisy(0.3, 300, 1, 9)]), "unproven", "positive only lately");
  // +0.05R a trade, alternating: positive on both halves, t near 0.9 on the newest 300.
  assert.equal(j(Array.from({ length: 1000 }, (_, k) => (k % 2 ? 1.05 : -0.95))), "promising", "positive but not clearly luck-free");
  // Strong and steady: proven with one idea tested, but not past the bar for a thousand.
  const strong = noisy(0.2, 1000, 1, 11);
  const st = summarize("fvg_cont", "5m", rows(1000, (k) => strong[k]), "library");
  assert.ok(st.newer.t > tNeeded(1) && st.newer.t < tNeeded(1e6), `t ${st.newer.t}`);
  assert.equal(judgeStudy(st, d, 1).verdict, "proven");
  assert.equal(judgeStudy(st, d, 1e6).verdict, "promising");
  assert.match(judgeStudy(st, d, 1e6).reason, /needs \d\.\d with 1000000 ideas tested/);
  // Only recent bars: never proven.
  assert.equal(judgeStudy({ ...st, source: "recent" }, d, 1).verdict, "unproven");
});

test("scout ideas follow the scout's verdict, and the corrected bar can only make them stricter", () => {
  const st = summarize("scout:nr7-orb", "5m", rows(400, () => 0.2), "library");
  const m = 30;
  const need = tNeeded(m);
  assert.equal(judgeStudy({ ...st, scout: { verdict: "recommended", reason: "Held up.", newerT: need + 0.5 } }, DISCOVER_DEFAULTS, m).verdict, "proven");
  assert.equal(judgeStudy({ ...st, scout: { verdict: "recommended", reason: "Held up.", newerT: need - 0.5 } }, DISCOVER_DEFAULTS, m).verdict, "promising");
  assert.equal(judgeStudy({ ...st, scout: { verdict: "watch", reason: "Too bumpy.", newerT: 3 } }, DISCOVER_DEFAULTS, m).verdict, "promising");
  assert.equal(judgeStudy({ ...st, scout: { verdict: "rejected", reason: "Too few.", newerT: 0 } }, DISCOVER_DEFAULTS, m).verdict, "unproven");
  const losing = summarize("scout:x", "5m", rows(400, () => -0.1), "library");
  assert.equal(judgeStudy({ ...losing, scout: { verdict: "rejected", reason: "Loses.", newerT: -2 } }, DISCOVER_DEFAULTS, m).verdict, "losing");
});

test("ranking puts losing ideas below every other, and unstudied ones last", () => {
  const ideas = ideasFor("NQ", "5m", true).filter((x) => ["pd_sweep", "squeeze", "fvg_cont", "dbvwap"].includes(x.id));
  const studies = new Map([
    ["pd_sweep", summarize("pd_sweep", "5m", rows(500, () => -0.05), "library")],
    ["squeeze", summarize("squeeze", "5m", rows(500, (k) => (k % 3 ? 0.4 : -0.5)), "library")],
    ["fvg_cont", summarize("fvg_cont", "5m", rows(500, (k) => (k % 2 ? 0.3 : -0.2)), "library")],
  ]);
  const ranked = rankIdeas(ideas, studies, scen, DISCOVER_DEFAULTS, 20);
  assert.deepEqual(ranked.map((r) => r.idea.id), ["squeeze", "fvg_cont", "pd_sweep", "dbvwap"]);
  assert.equal(ranked[2].judged.verdict, "losing");
  assert.equal(ranked[3].study, null);
});

test("the ideas offered: readers, the patterns that fit, scout ideas for the timeframe, never the coin flip", () => {
  const nq5 = ideasFor("NQ", "5m", true).map((x) => x.id);
  assert.ok(nq5.includes("dbvwap") && nq5.includes("asia_sweep") && nq5.includes("scout:nr7-orb"));
  assert.ok(!nq5.includes("scout:coin-flip"));
  assert.ok(!nq5.includes("scout:nr4-orb"), "a 15m idea is not offered on 5m");
  const btc = ideasFor("BTC", "15m", false).map((x) => x.id);
  assert.ok(!btc.some((x) => x.startsWith("scout:")) && !btc.includes("asia_sweep") && btc.includes("squeeze"));
});

test("when two reads fire on the same bar and side, the more specific one leads and the other is listed under also", () => {
  // Two copies of the same reader under different ids fire together.
  const bars = [];
  for (let i = 0; i < 120; i++) bars.push({ t: 1_700_000_000 + i * 900, o: 100, h: 100.5, l: 99.5, c: 100 + (i % 2 ? 0.1 : -0.1), v: 100 });
  const fire = (id) => ({ id, info: { id, label: id, short: id, blurb: "", line: "ema" }, detect: (c, i) => (i === 110 ? { reader: id, side: "long", level: 99.5, levelIndex: 100, sweepIndex: 105, index: 110, entry: c.bars[110].c, stop: 99, target: 103, rr: 3, zone: null, marks: [100, 105, 110], volume: { from: 105, to: 110, ratio: 1 } } : null) });
  const scan = analyze(bars, { detectors: [fire("squeeze"), fire("asia_sweep"), fire("bos_retest")], maxAge: 30 });
  assert.equal(scan.setup.reader, "asia_sweep");
  assert.deepEqual(scan.setup.also, ["bos_retest", "squeeze"]);
  assert.ok(SPECIFICITY.indexOf("asia_sweep") < SPECIFICITY.indexOf("bos_retest"));
});

test("reading with the readers as detectors gives the same setup as reading with the readers", () => {
  // A long random walk: whatever the readers find, the detector path finds too.
  let s = 5;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const bars = [];
  let px = 100;
  for (let i = 0; i < 1500; i++) {
    const o = px;
    px += (r() - 0.5) * 2;
    bars.push({ t: 1_700_000_000 + i * 900, o, h: Math.max(o, px) + r(), l: Math.min(o, px) - r(), c: px, v: 100 + r() * 200 });
  }
  for (const reader of ["sweep", "dbvwap", "sd", "vwappb"]) {
    const a = analyze(bars, { reader, anchor: "utc", maxAge: 400 }).setup;
    const b = analyze(bars, { detectors: [readerDetector(reader)], anchor: "utc", maxAge: 400 }).setup;
    if (!a) continue;
    // The detector path prefers a setup still open; compare like with like.
    if (a.outcome === "open") {
      assert.equal(b.id, a.id, reader);
      assert.deepEqual([b.entry, b.stop, b.target, b.history.matches], [a.entry, a.stop, a.target, a.history.matches]);
    }
  }
});

test("sideOf matches the scout's arithmetic", () => {
  const s = sideOf([1, -1, 2, -1, 0.5]);
  assert.equal(s.trades, 5);
  assert.ok(Math.abs(s.avgR - 0.3) < 1e-12);
  assert.equal(s.winRate, 0.6);
});
