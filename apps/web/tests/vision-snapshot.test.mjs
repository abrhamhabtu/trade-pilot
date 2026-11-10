// The five readers' exact output on three fixed synthetic series. Stored
// studies in the library depend on these numbers, so any refactor of
// analyze.ts must leave this file passing unchanged.
//
// Regenerate (only when a reader is meant to change): UPDATE_SNAPSHOT=1 npm test
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { _internal, readerStats, READER_ORDER } from "../src/lib/vision/analyze.ts";

const FILE = new URL("./vision-snapshot.json", import.meta.url);

/** A seeded random walk with a quiet overnight and a busier New York session. */
export function series(seed, stepSec, n = 3000, start = Date.UTC(2025, 2, 3, 0, 0) / 1000) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const bars = [];
  let px = 20_000;
  for (let i = 0; i < n; i++) {
    const t = start + i * stepSec;
    const nyHour = (new Date(t * 1000).getUTCHours() + 24 - 5) % 24;
    const busy = nyHour >= 9 && nyHour < 16 ? 2.2 : 1;
    const drift = Math.sin(i / 97) * 0.6;
    const o = px;
    const c = o + (r() - 0.5 + drift * 0.05) * 14 * busy * Math.sqrt(stepSec / 300);
    const h = Math.max(o, c) + r() * 6 * busy;
    const l = Math.min(o, c) - r() * 6 * busy;
    bars.push({ t, o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2), v: Math.round(100 + r() * 400 * busy) });
    px = c;
  }
  return bars;
}

const CASES = [
  { name: "5m-rth", seed: 11, step: 300, anchor: "rth" },
  { name: "15m-rth", seed: 23, step: 900, anchor: "rth" },
  { name: "15m-utc", seed: 37, step: 900, anchor: "utc" },
];

const round = (x) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : x);

function snapshot() {
  const out = {};
  for (const k of CASES) {
    const bars = series(k.seed, k.step);
    const c = _internal.context(bars, k.anchor);
    const fires = {};
    for (const r of READER_ORDER)
      for (let i = 0; i < bars.length; i++) {
        const f = _internal.detectAt(c, i, [r]);
        if (f) fires[`${r}@${i}`] = [f.side, f.level, f.levelIndex, f.sweepIndex, f.entry, f.stop, f.target, f.rr, ...f.marks].map(round);
      }
    const stats = readerStats(bars, { anchor: k.anchor });
    out[k.name] = { fires, stats: JSON.parse(JSON.stringify(stats, (_, v) => round(v))) };
  }
  return out;
}

test("the five readers fire exactly as before on the fixed series", () => {
  const now = snapshot();
  if (process.env.UPDATE_SNAPSHOT || !existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify(now));
    return;
  }
  const was = JSON.parse(readFileSync(FILE, "utf8"));
  for (const k of CASES) {
    assert.deepEqual(now[k.name].fires, was[k.name].fires, `${k.name}: reader fires changed`);
    assert.deepEqual(now[k.name].stats, was[k.name].stats, `${k.name}: reader stats changed`);
  }
  // A snapshot with nothing in it would pass anything.
  for (const k of CASES) assert.ok(Object.keys(was[k.name].fires).length > 20, `${k.name}: too few fires to mean anything`);
});
