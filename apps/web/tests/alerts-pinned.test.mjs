import test from "node:test";
import assert from "node:assert/strict";
import { scanLatest, setupLabel } from "../src/lib/vision/alerts.ts";
import { PATTERN_ORDER, patternContext, patternDetector } from "../src/lib/vision/patterns.ts";
import { levelsFor } from "../src/lib/vision/levels.ts";

// Four weekdays of 5m futures bars, then the watcher looks at the last closed bar of each prefix.
function walk(seed = 21) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const bars = [];
  let px = 20_000;
  for (let t = Date.UTC(2025, 0, 13, 0, 0) / 1000; t < Date.UTC(2025, 0, 16, 21, 0) / 1000; t += 300) {
    const nyHour = (new Date(t * 1000).getUTCHours() + 19) % 24;
    if (nyHour === 17) continue;
    const busy = nyHour >= 9 && nyHour < 16 ? 2 : 1;
    const o = px;
    px = o + (r() - 0.5) * 12 * busy;
    bars.push({ t, o, h: Math.max(o, px) + r() * 5 * busy, l: Math.min(o, px) - r() * 5 * busy, c: px, v: Math.round(100 + r() * 400 * busy) });
  }
  return bars;
}

test("a pinned pattern alerts on exactly the bars where the chart detector fires", () => {
  const bars = walk();
  let fired = 0;
  for (const id of PATTERN_ORDER) {
    const d = patternDetector(id);
    for (let i = 200; i < bars.length - 1; i += 7) {
      const seen = bars.slice(0, i + 2); // bar i+1 is still forming
      const now = (bars[i + 1].t + 60) * 1000;
      const got = scanLatest(seen, id, 300, now);
      const closed = bars.slice(0, i + 1);
      const want = d.detect(patternContext(closed, "rth", levelsFor(closed)), i);
      assert.equal(!!got, !!want, `${id} at ${i}`);
      if (got && want) {
        fired++;
        assert.deepEqual([got.side, got.price, got.stop, got.target], [want.side, want.entry, want.stop, want.target]);
      }
    }
  }
  assert.ok(fired > 0, "something fired");
});

test("alerts name pinned setups in plain words", () => {
  assert.equal(setupLabel("asia_sweep"), "Asia range sweep");
  assert.equal(setupLabel("dbvwap"), "Double-break VWAP");
  assert.equal(setupLabel("vwap_touch"), "VWAP touched");
});
