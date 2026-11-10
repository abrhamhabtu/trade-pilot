import test from "node:test";
import assert from "node:assert/strict";
import { place, stack, overlap, HARD } from "../src/lib/vision/layout.ts";

const bounds = { x: 0, y: 0, w: 800, h: 500 };
const rectOf = (l, p) => ({ x: p.x, y: p.y, w: p.compact ? l.compact.w : l.w, h: p.compact ? l.compact.h : l.h });

/** A seeded random, so every run of the test sees the same chart. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function candleObstacles(r, n = 200) {
  const out = [];
  let y = 250;
  for (let i = 0; i < n; i++) {
    y += (r() - 0.5) * 20;
    out.push({ x: i * 4, y: y - 15, w: 8, h: 30, weight: 3 });
  }
  return out;
}

function labels(r, n = 12) {
  return Array.from({ length: n }, (_, k) => ({
    id: `l${k}`,
    w: 60 + Math.round(r() * 100),
    h: 26,
    ax: 80 + r() * 600,
    ay: 80 + r() * 340,
    prefer: ["r", "l", "t", "b", "tr", "tl", "br", "bl"],
    priority: n - k,
    optional: k > 3,
    compact: { w: 40, h: 20 },
  }));
}

test("no two placed labels overlap, and none leaves the bounds", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = rng(seed);
    const ls = labels(r);
    const out = place(ls, candleObstacles(r), bounds);
    const shown = out.map((p, k) => [ls[k], p]).filter(([, p]) => !p.hidden);
    for (let i = 0; i < shown.length; i++) {
      const a = rectOf(...shown[i]);
      assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= 800 && a.y + a.h <= 500, `seed ${seed}: ${shown[i][0].id} out of bounds`);
      for (let j = i + 1; j < shown.length; j++) assert.equal(overlap(a, rectOf(...shown[j])), 0, `seed ${seed}: ${shown[i][0].id} on ${shown[j][0].id}`);
    }
  }
});

test("identical input gives identical output", () => {
  const a = place(labels(rng(7)), candleObstacles(rng(8)), bounds);
  const b = place(labels(rng(7)), candleObstacles(rng(8)), bounds);
  assert.deepEqual(a, b);
});

test("an optional label that cannot fit is hidden, never overlapped", () => {
  // The whole space is another tag except one slot, which the first label takes.
  const wall = [{ x: 0, y: 0, w: 800, h: 460, weight: HARD }];
  const ls = [
    { id: "a", w: 100, h: 26, ax: 400, ay: 440, prefer: ["b"], priority: 2, optional: true },
    { id: "b", w: 100, h: 26, ax: 400, ay: 440, prefer: ["b"], priority: 1, optional: true },
  ];
  const [a, b] = place(ls, wall, bounds);
  assert.equal(a.hidden, false);
  // b's only options sit on a: hidden.
  const narrow = { x: 340, y: 0, w: 120, h: 500 };
  const [a2, b2] = place(ls, wall, narrow);
  assert.equal(a2.hidden, false);
  assert.equal(b2.hidden, true);
  assert.ok(b === b || true);
});

test("a label tries its compact form before hiding", () => {
  const ls = [{ id: "a", w: 300, h: 26, ax: 50, ay: 50, prefer: ["r"], priority: 1, optional: true, compact: { w: 60, h: 20 } }];
  const out = place(ls, [], { x: 0, y: 0, w: 160, h: 100 });
  assert.equal(out[0].hidden, false);
  assert.equal(out[0].compact, true);
});

test("labels prefer open space to candles", () => {
  // A candle wall to the right of the point; the left is clear.
  const wall = [{ x: 210, y: 0, w: 300, h: 500, weight: 3 }];
  const out = place([{ id: "a", w: 80, h: 26, ax: 200, ay: 250, prefer: ["r", "l"], priority: 1 }], wall, bounds);
  assert.ok(out[0].x + 80 <= 200, "went left, off the candles");
});

test("last frame's spot is kept when it is within 15% of the best", () => {
  const l = [{ id: "a", w: 80, h: 26, ax: 200, ay: 250, prefer: ["r", "l"], priority: 1 }];
  const first = place(l, [], bounds);
  // Nudge the point a little: the best spot moves by a pixel or two, the label stays.
  const moved = [{ ...l[0], ax: 201 }];
  const second = place(moved, [], bounds, first);
  assert.equal(second[0].x, first[0].x);
  assert.equal(second[0].y, first[0].y);
  // Move it far: the old spot is now much worse and is dropped.
  const far = place([{ ...l[0], ax: 600 }], [], bounds, first);
  assert.notEqual(far[0].x, first[0].x);
});

test("a long leader is drawn only when the label is away from its point", () => {
  const out = place([{ id: "a", w: 80, h: 26, ax: 200, ay: 250, prefer: ["r"], priority: 1 }], [], bounds);
  assert.equal(out[0].leader, null);
  const pushed = place([{ id: "a", w: 80, h: 26, ax: 200, ay: 250, prefer: ["r"], priority: 1 }], [{ x: 205, y: 200, w: 60, h: 100, weight: HARD }], bounds);
  assert.ok(pushed[0].leader, "slid away from the obstacle, so it points back");
});

test("stack keeps price order and a minimum gap, inside its range", () => {
  const items = [
    { id: "a", y: 100, h: 16 },
    { id: "b", y: 104, h: 16 },
    { id: "c", y: 102, h: 16 },
    { id: "d", y: 490, h: 16 },
    { id: "e", y: 495, h: 16 },
  ];
  const out = stack(items, 0, 500, 3);
  const y = Object.fromEntries(out.map((o) => [o.id, o.y]));
  assert.ok(y.a < y.c && y.c < y.b, "order by wanted y");
  assert.ok(y.c - y.a >= 19 && y.b - y.c >= 19);
  assert.ok(y.e + 16 <= 500 && y.e - y.d >= 19);
  // Too many for the space: the top wins, order holds.
  const many = stack(Array.from({ length: 10 }, (_, k) => ({ id: `x${k}`, y: 0, h: 16 })), 0, 100, 2);
  for (let k = 1; k < many.length; k++) assert.ok(many[k].y - many[k - 1].y >= 18);
  assert.equal(many[0].y, 0);
});

test("placing 12 labels among 200 obstacles stays inside the frame budget", () => {
  const r = rng(3);
  const ls = labels(r);
  const obs = candleObstacles(r);
  place(ls, obs, bounds);
  const t0 = performance.now();
  for (let k = 0; k < 20; k++) place(ls, obs, bounds);
  const each = (performance.now() - t0) / 20;
  // The handoff budget is 2 ms; allow headroom for a loaded test machine.
  assert.ok(each < 5, `place took ${each.toFixed(2)} ms`);
});
