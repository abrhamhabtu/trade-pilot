import test from "node:test";
import assert from "node:assert/strict";
import { PATTERNS, PATTERN_ORDER, patternContext, patternDetector, patternsFor, P } from "../src/lib/vision/patterns.ts";
import { levelsFor } from "../src/lib/vision/levels.ts";

// ── A day builder on the New York clock (January: UTC = New York + 5h) ─────────

const DAYS = ["2025-01-13", "2025-01-14", "2025-01-15", "2025-01-16", "2025-01-17"];
const utc = (date, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return Date.parse(`${date}T00:00:00Z`) / 1000 + (h + 5) * 3600 + m * 60;
};
const hm = (t) => {
  const d = new Date((t - 5 * 3600) * 1000);
  return { date: d.toISOString().slice(0, 10), m: d.getUTCHours() * 60 + d.getUTCMinutes(), key: `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}` };
};

/**
 * 5-minute bars from `from` to `to` (New York), skipping 17:00–18:00. `shape(date, minute, k)`
 * gives { c, w } for a flat bar (open = previous close); `over` replaces whole bars by "YYYY-MM-DD HH:MM".
 */
function build({ from = ["2025-01-13", "09:30"], to = ["2025-01-14", "15:55"], shape, over = {} }) {
  const bars = [];
  let prev = null;
  let k = 0;
  for (let t = utc(...from); t <= utc(...to); t += 300) {
    const c0 = hm(t);
    if (c0.m >= 17 * 60 && c0.m < 18 * 60) continue;
    const dow = new Date(`${c0.date}T12:00:00Z`).getUTCDay();
    if (dow === 6 || (dow === 0 && c0.m < 18 * 60) || (dow === 5 && c0.m >= 17 * 60)) continue;
    const o = over[c0.key];
    if (o) {
      bars.push({ t, v: 100, ...o });
      prev = o.c;
    } else {
      const s = shape(c0.date, c0.m, k);
      const open = s.o ?? prev ?? s.c;
      bars.push({ t, o: open, h: Math.max(open, s.c) + s.w, l: Math.min(open, s.c) - s.w, c: s.c, v: s.v ?? 100 });
      prev = s.c;
    }
    k++;
  }
  return bars;
}
const at = (bars, date, hhmm) => bars.findIndex((b) => b.t === utc(date, hhmm));

/** Monday's session at 100, the night and Tuesday at 103; Asia, London and pre-market a touch narrower. */
const twoDay = (tueRth = 103) => (date, m) => {
  const night = (date === "2025-01-13" && m >= 18 * 60) || (date === "2025-01-14" && m < 9 * 60 + 30);
  if (date === "2025-01-13" && m < 18 * 60) return { c: 100, w: 0.5, o: 100 };
  if (night) return { c: 103, w: m >= 18 * 60 && m < 19 * 60 ? 0.5 : 0.3, o: 103 };
  return { c: tueRth, w: 0.5, o: tueRth };
};

function fire(id, bars, i, anchor = "rth") {
  const c = patternContext(bars, anchor, anchor === "rth" ? levelsFor(bars) : bars.map(() => null));
  return patternDetector(id).detect(c, i);
}
/** Every bar where the pattern fires. */
function fires(id, bars, anchor = "rth") {
  const c = patternContext(bars, anchor, anchor === "rth" ? levelsFor(bars) : bars.map(() => null));
  const d = patternDetector(id);
  const out = [];
  for (let i = 30; i < bars.length; i++) if (c.atr[i] && d.detect(c, i)) out.push(i);
  return out;
}

// ── Sweeps ─────────────────────────────────────────────────────────────────────

test("Asia range sweep: London runs the Asia low and reclaims it", () => {
  const D = "2025-01-14";
  const sweep = { [`${D} 04:00`]: { o: 103, h: 103.2, l: 101.9, c: 102.8 }, [`${D} 04:05`]: { o: 102.8, h: 103.6, l: 102.7, c: 103.4 } };
  const bars = build({ shape: twoDay(), over: sweep });
  const i = at(bars, D, "04:05");
  const f = fire("asia_sweep", bars, i);
  assert.ok(f, "fires on the reclaim");
  assert.equal(f.side, "long");
  assert.equal(f.level, 102.7);
  assert.ok(f.stop < 101.9, "stop past the sweep");
  assert.deepEqual(fires("asia_sweep", bars), [i], "and only there");
  const c = patternContext(bars, "rth", levelsFor(bars));
  const steps = patternDetector("asia_sweep").callouts(c, f, (n) => n.toFixed(2));
  assert.deepEqual(steps.map((s) => s.title), ["Asia low", "Run and reject", "Reclaimed"]);

  // Near miss: the sweep bar closes outside the range.
  const outside = build({ shape: twoDay(), over: { ...sweep, [`${D} 04:00`]: { o: 103, h: 103.2, l: 101.9, c: 102.5 } } });
  assert.equal(fire("asia_sweep", outside, i), null);
  // Near miss: the low was already probed earlier in London.
  const probed = build({ shape: twoDay(), over: { ...sweep, [`${D} 03:30`]: { o: 103, h: 103.2, l: 102.6, c: 103 } } });
  assert.equal(fire("asia_sweep", probed, i), null);
});

test("Overnight sweep: the open runs the overnight high and closes back under", () => {
  const D = "2025-01-14";
  const sweep = { [`${D} 09:45`]: { o: 103, h: 104.2, l: 102.9, c: 103.3 }, [`${D} 09:50`]: { o: 103.3, h: 103.4, l: 102.6, c: 102.7 } };
  const bars = build({ shape: twoDay(), over: sweep });
  const i = at(bars, D, "09:50");
  const f = fire("on_sweep", bars, i);
  assert.ok(f);
  assert.equal(f.side, "short");
  assert.equal(f.level, 103.5);
  assert.ok(f.stop > 104.2);
  // Near miss: before 09:30 the overnight range isn't final.
  const early = build({ shape: twoDay(), over: { [`${D} 08:45`]: sweep[`${D} 09:45`], [`${D} 08:50`]: sweep[`${D} 09:50`] } });
  assert.equal(fire("on_sweep", early, at(early, D, "08:50")), null);
  // Near miss: the reclaim bar closes green.
  const green = build({ shape: twoDay(), over: { ...sweep, [`${D} 09:50`]: { o: 103.0, h: 103.4, l: 102.6, c: 103.2 } } });
  assert.equal(fire("on_sweep", green, i), null);
});

test("Prior day sweep: yesterday's low is run in the morning and reclaimed", () => {
  const D = "2025-01-14";
  const sweep = { [`${D} 11:00`]: { o: 100, h: 100.1, l: 99.0, c: 99.7 }, [`${D} 11:05`]: { o: 99.7, h: 100.4, l: 99.6, c: 100.3 } };
  const bars = build({ shape: twoDay(100), over: sweep });
  const i = at(bars, D, "11:05");
  const f = fire("pd_sweep", bars, i);
  assert.ok(f);
  assert.equal(f.side, "long");
  assert.equal(f.level, 99.5);
  // Near miss: the sweep bar closes below the level.
  const below = build({ shape: twoDay(100), over: { ...sweep, [`${D} 11:00`]: { o: 100, h: 100.1, l: 99.0, c: 99.4 } } });
  assert.equal(fire("pd_sweep", below, i), null);
  // Near miss: the reclaim comes seven bars after the sweep.
  const late = build({ shape: twoDay(100), over: { [`${D} 11:00`]: sweep[`${D} 11:00`], [`${D} 11:35`]: sweep[`${D} 11:05`] } });
  assert.equal(fire("pd_sweep", late, at(late, D, "11:35")), null);
});

// ── Opening range ──────────────────────────────────────────────────────────────

test("Failed opening range break: the first break up fails back inside, short", () => {
  const D = "2025-01-14";
  const brk = { [`${D} 09:50`]: { o: 103, h: 104, l: 102.9, c: 103.8 } };
  const bars = build({ shape: twoDay(), over: { ...brk, [`${D} 09:55`]: { o: 103.8, h: 103.9, l: 103.0, c: 103.2 } } });
  const i = at(bars, D, "09:55");
  const f = fire("orb_fail", bars, i);
  assert.ok(f);
  assert.equal(f.side, "short");
  assert.ok(f.stop > 104);
  // Near miss: back inside, but not 0.1 ATR past the edge.
  const shy = build({ shape: twoDay(), over: { ...brk, [`${D} 09:55`]: { o: 103.8, h: 103.9, l: 103.4, c: 103.48 } } });
  assert.equal(fire("orb_fail", shy, i), null);
  // Near miss: back inside only on the seventh bar after the break.
  const stay = { ...brk };
  for (const t of ["09:55", "10:00", "10:05", "10:10", "10:15", "10:20"]) stay[`${D} ${t}`] = { o: 103.8, h: 103.95, l: 103.7, c: 103.8 };
  stay[`${D} 10:25`] = { o: 103.8, h: 103.9, l: 103.0, c: 103.2 };
  const slow = build({ shape: twoDay(), over: stay });
  assert.equal(fire("orb_fail", slow, at(slow, D, "10:25")), null);
});

test("Initial balance break: needs ten sessions of history, a narrow first hour and a strong close", () => {
  const flat = () => ({ c: 103, w: 0.5, o: 103 });
  const last = "2025-01-30";
  const brk = { [`${last} 10:45`]: { o: 103, h: 104.0, l: 102.95, c: 103.95 } };
  const range = { from: ["2025-01-13", "09:30"], to: [last, "12:00"], shape: flat };
  const bars = build({ ...range, over: brk });
  const i = at(bars, last, "10:45");
  const f = fire("ib_break", bars, i);
  assert.ok(f, "fires");
  assert.equal(f.side, "long");
  // Near miss: closes mid-bar, not in its outer 30%.
  const mid = build({ ...range, over: { [`${last} 10:45`]: { o: 103.2, h: 104.2, l: 103.0, c: 103.6 } } });
  assert.equal(fire("ib_break", mid, i), null);
  // Near miss: a first hour wider than the usual one.
  const wide = build({ ...range, over: { ...brk, [`${last} 10:00`]: { o: 103, h: 104.6, l: 102.9, c: 103 } } });
  assert.equal(fire("ib_break", wide, at(wide, last, "10:45")), null);
  // And with only a few sessions behind it, never.
  const young = build({ from: ["2025-01-27", "09:30"], to: [last, "12:00"], shape: flat, over: brk });
  assert.deepEqual(fires("ib_break", young), []);
});

// ── VWAP bands ─────────────────────────────────────────────────────────────────

test("VWAP band reversion: a poke past the lower band on a flat day, long to VWAP", () => {
  const D = "2025-01-14";
  // A slow wave around 103 gives VWAP some spread; the trigger bar is fitted to the band it makes.
  const wave = (date, m, k) => (date === D && m >= 9 * 60 + 30 ? { c: 103 + 1.5 * Math.sin(k / 2), w: 0.1 } : twoDay()(date, m));
  // Midday, once the session's VWAP has settled.
  const key = `${D} 13:00`;
  let bars = build({ shape: wave });
  const i = at(bars, D, "13:00");
  let trig = null;
  for (let it = 0; it < 4; it++) {
    const c = patternContext(bars, "rth", levelsFor(bars));
    const lower = c.vwap[i] - 2 * c.rsd[i];
    trig = { o: lower + 0.02, h: lower + 0.15, l: lower - 0.3, c: lower + 0.1 };
    bars = build({ shape: wave, over: { [key]: trig } });
  }
  const f = fire("vwap_band", bars, i);
  assert.ok(f, "fires");
  assert.equal(f.side, "long");
  const c = patternContext(bars, "rth", levelsFor(bars));
  assert.equal(f.target, c.vwap[i], "VWAP is the target");
  // Near miss: closes outside the band.
  const out = build({ shape: wave, over: { [key]: { ...trig, c: trig.l + 0.1, h: trig.o + 0.05 } } });
  assert.equal(fire("vwap_band", out, i), null);
  // Near miss: a trending VWAP.
  const trend = (date, m, k) => (date === D && m >= 9 * 60 + 30 ? { c: 103 + 1.5 * Math.sin(k / 2) + (k % 400) * 0.25, w: 0.1 } : twoDay()(date, m));
  assert.deepEqual(fires("vwap_band", build({ shape: trend })).filter((j) => j === i), []);
});

// ── Gaps, structure and compression ────────────────────────────────────────────

test("Fair value gap continuation: the first return into a gap above VWAP", () => {
  const D = "2025-01-14";
  const base = {
    [`${D} 10:00`]: { o: 103, h: 103.5, l: 102.5, c: 103.2 },
    [`${D} 10:05`]: { o: 103.2, h: 105.2, l: 103.1, c: 105.0 },
    [`${D} 10:10`]: { o: 105, h: 105.6, l: 104.4, c: 105.3 },
    [`${D} 10:15`]: { o: 105.3, h: 105.6, l: 104.9, c: 105.4 },
    [`${D} 10:20`]: { o: 105.4, h: 105.6, l: 104.9, c: 105.3 },
  };
  const trig = { o: 104.35, h: 104.9, l: 104.1, c: 104.8 };
  const bars = build({ shape: twoDay(), over: { ...base, [`${D} 10:25`]: trig } });
  const i = at(bars, D, "10:25");
  const f = fire("fvg_cont", bars, i);
  assert.ok(f);
  assert.equal(f.side, "long");
  assert.deepEqual([f.zone.bottom, f.zone.top], [103.5, 104.4]);
  // Near miss: closes inside the gap.
  assert.equal(fire("fvg_cont", build({ shape: twoDay(), over: { ...base, [`${D} 10:25`]: { ...trig, c: 104.3, h: 104.4 } } }), i), null);
  // Near miss: an earlier bar already went back into the gap.
  const touched = build({ shape: twoDay(), over: { ...base, [`${D} 10:15`]: { o: 105.3, h: 105.6, l: 104.3, c: 105.4 }, [`${D} 10:25`]: trig } });
  assert.equal(fire("fvg_cont", touched, i), null);
});

test("Break of structure and retest: a strong close through the swing high, then a held retest", () => {
  const D = "2025-01-14";
  const base = {
    [`${D} 10:00`]: { o: 103, h: 104, l: 102.9, c: 103.2 },
    [`${D} 10:30`]: { o: 103.2, h: 105, l: 103.1, c: 104.6 },
    [`${D} 10:35`]: { o: 104.6, h: 105.2, l: 104.5, c: 105 },
  };
  const trig = { o: 104.5, h: 104.9, l: 104.1, c: 104.7 };
  const bars = build({ shape: twoDay(), over: { ...base, [`${D} 10:40`]: trig } });
  const i = at(bars, D, "10:40");
  const f = fire("bos_retest", bars, i);
  assert.ok(f);
  assert.equal(f.side, "long");
  assert.equal(f.level, 104);
  // Near miss: the retest closes back under the level.
  assert.equal(fire("bos_retest", build({ shape: twoDay(), over: { ...base, [`${D} 10:40`]: { ...trig, c: 103.95, o: 104.5 } } }), i), null);
  // Near miss: a weak break bar.
  assert.equal(fire("bos_retest", build({ shape: twoDay(), over: { ...base, [`${D} 10:30`]: { o: 104.0, h: 104.4, l: 103.9, c: 104.2 }, [`${D} 10:40`]: trig } }), i), null);
});

test("Compression breakout: a tight range breaks on volume, on futures and on crypto", () => {
  const D = "2025-01-14";
  const tightFrom = 11 * 60;
  const tightTo = 12 * 60;
  const shape = (wide) => (date, m, k) => {
    // Wide bars from 06:00, so the 60-bar lookback sees an ordinary range.
    if (date !== D || m < 6 * 60) return twoDay()(date, m);
    if (m >= tightFrom && m < tightTo) return { c: 103, w: wide ? 0.7 : 0.2, o: 103 };
    return { c: k % 2 ? 104 : 102, w: 0.2 };
  };
  const brk = { [`${D} 12:00`]: { o: 103.1, h: 104.0, l: 103.0, c: 103.9, v: 400 } };
  const bars = build({ shape: shape(false), over: brk });
  const i = at(bars, D, "12:00");
  const f = fire("squeeze", bars, i);
  assert.ok(f);
  assert.equal(f.side, "long");
  assert.ok(fire("squeeze", bars, i, "utc"), "no sessions needed: crypto gets it too");
  // Near miss: ordinary volume.
  assert.equal(fire("squeeze", build({ shape: shape(false), over: { [`${D} 12:00`]: { ...brk[`${D} 12:00`], v: 110 } } }), i), null);
  // Near miss: not compressed.
  assert.equal(fire("squeeze", build({ shape: shape(true), over: brk }), i), null);
});

// ── Lookahead and offering ─────────────────────────────────────────────────────

test("no pattern's decision at bar i changes when later bars change", () => {
  let s = 77;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let px = 103;
  const bars = build({
    from: ["2025-01-13", "09:30"],
    to: ["2025-01-16", "15:55"],
    shape: () => {
      px += (r() - 0.5) * 1.6;
      return { c: px, w: 0.2 + r() * 0.6, v: Math.round(80 + r() * 300) };
    },
  });
  const full = patternContext(bars, "rth", levelsFor(bars));
  let fired = 0;
  for (const id of PATTERN_ORDER) {
    const d = patternDetector(id);
    for (let i = 80; i < bars.length - 1; i += 3) {
      const a = d.detect(full, i);
      const cut = bars.slice(0, i + 1);
      const b = d.detect(patternContext(cut, "rth", levelsFor(cut)), i);
      assert.deepEqual(b, a, `${id} at ${i}`);
      if (a) fired++;
    }
  }
  assert.ok(fired > 5, `the random series should fire something (${fired})`);
});

test("level patterns are futures only; every pattern names its markets and windows", () => {
  assert.deepEqual(patternsFor("BTC", 5, false).sort(), ["bos_retest", "fvg_cont", "squeeze"]);
  assert.ok(patternsFor("GC", 5, true).includes("asia_sweep"));
  assert.ok(!patternsFor("NQ", 60, true).includes("asia_sweep"), "15m and faster only");
  for (const id of PATTERN_ORDER) {
    const p = PATTERNS[id];
    for (const m of ["NQ", "ES", "GC"]) assert.ok(p.markets.includes(m), `${id} offered on ${m}`);
    assert.ok(p.idea.split(". ").length >= 2, `${id} has a two-sentence idea`);
  }
  assert.ok(P.sweep.window === 6 && P.squeeze.vol === 1.3, "thresholds live in P");
});
