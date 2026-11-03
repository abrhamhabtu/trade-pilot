import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/lib/vision/analyze.ts";
import { aggregate } from "../src/lib/vision/markets.ts";
import { applyTick } from "../src/lib/vision/feed.ts";
import { visionPine } from "../src/lib/vision/pine.ts";

/** Bars from closes: each opens at the previous close, with a small wick either side. */
const fromCloses = (closes, { start = 1_700_000_000, step = 900, wick = 0.3 } = {}) =>
  closes.map((c, i) => {
    const o = i ? closes[i - 1] : c;
    return { t: start + i * step, o, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, c, v: 100 };
  });

// A drift, a clear swing low at 100, a bounce, a wick through 100 that closes back above, then a reclaim.
function sweepLong() {
  const closes = [];
  for (let i = 0; i < 70; i++) closes.push(110 + Math.sin(i / 3) * 2);
  closes.push(106, 104, 102, 100.5, 102, 104, 106, 107, 106, 105, 104, 103);
  const bars = fromCloses(closes);
  // Make the swing low exact.
  bars[73].l = 100;
  // The sweep: wick to 98.8, close back at 101.
  bars.push({ t: bars.at(-1).t + 900, o: 102.5, h: 102.6, l: 98.8, c: 101, v: 300 });
  // Reclaim: a green close back above the 21 EMA (~105.9), with the stop inside 4 ATR.
  bars.push({ t: bars.at(-1).t + 900, o: 101, h: 106.7, l: 100.9, c: 106.5, v: 250 });
  // The forming bar.
  bars.push({ t: bars.at(-1).t + 900, o: 106.5, h: 106.6, l: 106.4, c: 106.5, v: 10 });
  return bars;
}

test("a swept swing low that reclaims is a fresh long with the stop under the sweep", () => {
  const scan = analyze(sweepLong(), { forming: true });
  const s = scan.setup;
  assert.ok(s, "expected a setup");
  assert.equal(s.side, "long");
  assert.equal(s.level, 100);
  assert.ok(s.stop < 98.8, "stop goes below the sweep wick");
  assert.ok(s.target > s.entry);
  assert.equal(s.fresh, true);
  assert.equal(s.outcome, "open");
  assert.deepEqual(s.callouts.map((c) => c.n), [1, 2, 3]);
});

test("the forming bar is never analysed", () => {
  const bars = sweepLong();
  const a = analyze(bars, { forming: true });
  const b = analyze([...bars.slice(0, -1), { ...bars.at(-1), h: 200, c: 200 }], { forming: true });
  assert.equal(a.setup?.id, b.setup?.id);
  assert.equal(a.overview, b.overview);
});

test("a later bar through the stop marks the setup stopped, and the stop wins a bar that touches both", () => {
  const bars = sweepLong().slice(0, -1);
  const s = analyze([...bars, bars.at(-1)], { forming: true }).setup;
  const both = { t: bars.at(-1).t + 900, o: s.entry, h: s.target + 1, l: s.stop - 1, c: s.entry, v: 100 };
  const forming = { ...both, t: both.t + 900, h: both.c, l: both.c };
  const after = analyze([...bars, both, forming], { forming: true }).setup;
  assert.equal(after.id, s.id);
  assert.equal(after.outcome, "stop");
});

test("history is too thin to rate on a short chart, and says so", () => {
  const s = analyze(sweepLong(), { forming: true }).setup;
  assert.equal(s.history.hitRate, null);
  assert.match(analyze(sweepLong(), { forming: true }).overview, /too few to rate/);
});

test("too few bars means no read at all", () => {
  const scan = analyze(fromCloses([1, 2, 3, 4, 5]), { forming: true });
  assert.equal(scan.setup, null);
  assert.equal(scan.items.length, 0);
});

test("ticks extend the forming bar and roll into a new one on the boundary", () => {
  const bars = [{ t: 900, o: 10, h: 11, l: 9, c: 10, v: 5 }];
  const a = applyTick(bars, { price: 12, size: 2, time: 1_000_000 }, 900);
  assert.deepEqual(a.at(-1), { t: 900, o: 10, h: 12, l: 9, c: 12, v: 7 });
  const b = applyTick(a, { price: 8, size: 1, time: 1_800_000 }, 900);
  assert.equal(b.length, 2);
  assert.deepEqual(b.at(-1), { t: 1800, o: 12, h: 12, l: 8, c: 8, v: 1 });
});

test("hourly bars aggregate into 4-hour bars on UTC boundaries", () => {
  const h = [0, 1, 2, 3, 4].map((k) => ({ t: k * 3600, o: k, h: k + 1, l: k - 1, c: k + 0.5, v: 1 }));
  const four = aggregate(h, 14400);
  assert.equal(four.length, 2);
  assert.deepEqual(four[0], { t: 0, o: 0, h: 4, l: -1, c: 3.5, v: 4 });
});

test("the Pine script carries only a safe webhook key", () => {
  const code = visionPine({ key: 'abc"); alert("x' });
  assert.match(code, /KEY\s+= input\.string\("abcalertx"/);
  assert.match(code, /^\/\/@version=6/);
});
