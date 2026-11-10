import test from "node:test";
import assert from "node:assert/strict";
import { levelsFor, globexVwap, bucketOfMinute, alignLevels } from "../src/lib/vision/levels.ts";

// An independent New York clock, so the module's session maths is checked against Intl, not itself.
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function ny(t) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(t * 1000)).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const minute = Number(p.hour) * 60 + Number(p.minute);
  const next = new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { date, minute, session: minute >= 18 * 60 ? next : date };
}

/** 5-minute bars from a UTC start, skipping the 17:00–18:00 New York break and the weekend, with a seeded walk. */
function week(startUtc, days = 6, seed = 5) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const bars = [];
  let px = 5000;
  for (let t = startUtc; t < startUtc + days * 86_400; t += 300) {
    const k = ny(t);
    const dow = new Date(`${k.date}T12:00:00Z`).getUTCDay();
    if (k.minute >= 17 * 60 && k.minute < 18 * 60) continue;
    if (dow === 6 || (dow === 5 && k.minute >= 17 * 60) || (dow === 0 && k.minute < 18 * 60)) continue;
    const o = px;
    const c = o + (r() - 0.5) * 4;
    bars.push({ t, o, h: Math.max(o, c) + r() * 2, l: Math.min(o, c) - r() * 2, c, v: 100 + Math.round(r() * 100) });
    px = c;
  }
  return bars;
}

/** The levels worked out the slow, obvious way from the independent clock. */
function expected(bars, i) {
  const k = ny(bars[i].t);
  const same = [];
  for (let j = 0; j <= i; j++) if (ny(bars[j].t).session === k.session) same.push({ ...bars[j], ...ny(bars[j].t) });
  const ext = (pred) => {
    const xs = same.filter(pred);
    return xs.length ? [Math.max(...xs.map((b) => b.h)), Math.min(...xs.map((b) => b.l))] : [null, null];
  };
  const m = k.minute;
  const day = m < 18 * 60;
  const asia = ext((b) => b.minute >= 19 * 60 || b.minute < 120);
  const lon = ext((b) => b.minute >= 180 && b.minute < 480);
  const or = ext((b) => b.minute >= 570 && b.minute < 585);
  const ib = ext((b) => b.minute >= 570 && b.minute < 630);
  const on = ext((b) => b.minute >= 18 * 60 || b.minute < 570);
  // Prior RTH: the latest earlier session with regular-hours bars.
  const earlier = [];
  for (let j = 0; j <= i; j++) {
    const x = ny(bars[j].t);
    if (x.session < k.session && x.minute >= 570 && x.minute < 960) earlier.push({ ...bars[j], ...x });
  }
  const lastSession = earlier.length ? earlier[earlier.length - 1].session : null;
  const pd = earlier.filter((b) => b.session === lastSession);
  return {
    pdh: pd.length ? Math.max(...pd.map((b) => b.h)) : null,
    pdl: pd.length ? Math.min(...pd.map((b) => b.l)) : null,
    pdc: pd.length ? pd[pd.length - 1].c : null,
    onh: on[0],
    onl: on[1],
    asiaH: day && m >= 120 ? asia[0] : null,
    asiaL: day && m >= 120 ? asia[1] : null,
    lonH: day && m >= 480 ? lon[0] : null,
    lonL: day && m >= 480 ? lon[1] : null,
    orH: day && m >= 585 ? or[0] : null,
    orL: day && m >= 585 ? or[1] : null,
    ibH: day && m >= 630 ? ib[0] : null,
    ibL: day && m >= 630 ? ib[1] : null,
  };
}

const KEYS = ["pdh", "pdl", "pdc", "onh", "onl", "asiaH", "asiaL", "lonH", "lonL", "orH", "orL", "ibH", "ibL"];

function check(bars, label) {
  const lv = levelsFor(bars);
  // Every 7th bar keeps the brute force quick while still landing in every window.
  for (let i = 0; i < bars.length; i += 7) {
    const want = expected(bars, i);
    for (const k of KEYS) assert.equal(lv[i][k], want[k], `${label}: ${k} at bar ${i} (${JSON.stringify(ny(bars[i].t))})`);
  }
  return lv;
}

test("every level is null until its window ends and right after, in a normal week", () => {
  // Sunday 2025-01-12 23:00 UTC = 18:00 New York: the Globex open.
  const lv = check(week(Date.UTC(2025, 0, 12, 23, 0) / 1000), "January");
  assert.ok(lv.some((x) => x.asiaH != null) && lv.some((x) => x.ibH != null) && lv.some((x) => x.pdh != null));
});

test("the March daylight-saving week keeps every window on New York time", () => {
  // Clocks went forward Sunday 2025-03-09 at 02:00. Start the Friday before.
  check(week(Date.UTC(2025, 2, 6, 23, 0) / 1000, 6), "March DST");
});

test("the November daylight-saving week keeps every window on New York time", () => {
  // Clocks went back Sunday 2025-11-02 at 02:00.
  check(week(Date.UTC(2025, 9, 30, 22, 0) / 1000, 6), "November DST");
});

test("a session that opens Sunday evening belongs to Monday, with Friday as the prior day", () => {
  const bars = week(Date.UTC(2025, 0, 9, 23, 0) / 1000, 5); // Thursday evening through Monday
  const lv = levelsFor(bars);
  const sunday = bars.findIndex((b) => {
    const k = ny(b.t);
    return new Date(`${k.date}T12:00:00Z`).getUTCDay() === 0;
  });
  assert.ok(sunday > 0, "the week has Sunday evening bars");
  assert.equal(lv[sunday].session, "2025-01-13");
  const friday = bars.filter((b) => ny(b.t).date === "2025-01-10" && ny(b.t).minute >= 570 && ny(b.t).minute < 960);
  assert.equal(lv[sunday].pdh, Math.max(...friday.map((b) => b.h)));
});

test("no level at bar i changes when the bars after i change (no lookahead)", () => {
  const bars = week(Date.UTC(2025, 0, 12, 23, 0) / 1000, 4, 9);
  const all = levelsFor(bars);
  const gv = globexVwap(bars);
  for (const i of [5, 60, 200, 333, 480, 700, 900, bars.length - 2]) {
    const cut = bars.slice(0, i + 1);
    const part = levelsFor(cut);
    assert.deepEqual(part[i], all[i], `levels at ${i}`);
    const g = globexVwap(cut);
    assert.equal(g.vwap[i], gv.vwap[i]);
    assert.equal(g.sd[i], gv.sd[i]);
    // And scrambling the future does nothing either.
    const wild = [...cut, ...bars.slice(i + 1).map((b) => ({ ...b, h: b.h + 500, l: b.l - 500 }))];
    assert.deepEqual(levelsFor(wild)[i], all[i]);
  }
});

test("the 20-session medians appear only with 10 prior sessions behind them", () => {
  const bars = week(Date.UTC(2025, 0, 5, 23, 0) / 1000, 22, 3);
  const lv = levelsFor(bars);
  assert.equal(lv[0].rangeMed, null);
  const firstWith = lv.findIndex((x) => x.rangeMed != null);
  assert.ok(firstWith > 0);
  assert.equal(lv[firstWith].history, 10);
});

test("session buckets match the handoff's windows", () => {
  const at = (h, m = 0) => bucketOfMinute(h * 60 + m);
  assert.equal(at(19), "asia");
  assert.equal(at(1, 59), "asia");
  assert.equal(at(2, 30), "off");
  assert.equal(at(3), "london");
  assert.equal(at(8), "pre");
  assert.equal(at(9, 30), "ny-open");
  assert.equal(at(11, 30), "ny-mid");
  assert.equal(at(14), "ny-pm");
  assert.equal(at(16), "off");
});

test("levels aligned onto a 15m chart only use 5m bars that closed inside or before each chart bar", () => {
  const five = week(Date.UTC(2025, 0, 12, 23, 0) / 1000, 2);
  const lv = levelsFor(five);
  const chart = five.filter((b) => b.t % 900 === 0);
  const al = alignLevels(chart, 900, five, lv, 300);
  chart.forEach((b, k) => {
    const j = five.findLastIndex((x) => x.t + 300 <= b.t + 900);
    assert.equal(al[k], j >= 0 ? lv[j] : null);
  });
});
