import test from "node:test";
import assert from "node:assert/strict";
import { pairConfirmed, divergenceText, PAIR } from "../src/lib/vision/smt.ts";
import { pack, unpack, summarize } from "../src/lib/vision/discover.ts";

const flat = (n, px = 100, t0 = 1_700_000_000) => Array.from({ length: n }, (_, i) => ({ t: t0 + i * 300, o: px, h: px + 1, l: px - 1, c: px, v: 100 }));

test("a sweep the other index joins is confirmed; one it doesn't join is divergence", () => {
  // My swing low forms at bar 20, the sweep runs it at bar 40, the setup fires at 41.
  const mine = flat(50);
  mine[20] = { ...mine[20], l: 95 };
  mine[40] = { ...mine[40], l: 94 };
  const s = { reader: "sweep", side: "long", levelIndex: 20, sweepIndex: 40, index: 41 };
  const joined = flat(50, 200);
  joined[21] = { ...joined[21], l: 190 };
  joined[41] = { ...joined[41], l: 189 };
  assert.equal(pairConfirmed(s, mine, joined), true);
  const held = flat(50, 200);
  held[21] = { ...held[21], l: 190 };
  assert.equal(pairConfirmed(s, mine, held), false, "the other's low held: divergence");
  // A run three bars after the setup's bar is in the future: not read.
  const late = flat(50, 200);
  late[21] = { ...late[21], l: 190 };
  late[44] = { ...late[44], l: 189 };
  assert.equal(pairConfirmed(s, mine, late), false);
  assert.equal(pairConfirmed({ ...s, reader: "squeeze" }, mine, joined), null, "only sweeps are tagged");
});

test("day-level sweeps compare the other's same level", () => {
  const mine = flat(50);
  const other = flat(50, 200);
  other[40] = { ...other[40], l: 194 };
  const levels = other.map(() => ({ pdl: 195, pdh: 205 }));
  const s = { reader: "pd_sweep", side: "long", levelIndex: 10, sweepIndex: 40, index: 41 };
  assert.equal(pairConfirmed(s, mine, other, levels), true);
  assert.equal(pairConfirmed(s, mine, other, other.map(() => ({ pdl: 190, pdh: 205 }))), false);
});

test("gold has no pair; the words; the tag survives the study's storage and is summed apart", () => {
  assert.equal(PAIR.GC, undefined);
  assert.equal(divergenceText("ES", "long"), "ES did not confirm the low");
  const rows = [
    { t: 1, side: 1, r: 1.5, bucket: "ny-open", dayType: "mixed", vol: "normal", gap: "flat", smt: false },
    { t: 2, side: 0, r: -1, bucket: "ny-open", dayType: "mixed", vol: "normal", gap: "flat", smt: true },
    { t: 3, side: 0, r: -1, bucket: "ny-open", dayType: "mixed", vol: "normal", gap: "flat", smt: null },
    { t: 4, side: 0, r: 2, bucket: "ny-open", dayType: "mixed", vol: "normal", gap: "flat" },
  ];
  const back = rows.map((r) => unpack(pack(r)));
  assert.deepEqual(back, rows);
  const st = summarize("sweep", "5m", back, "library");
  assert.deepEqual(st.smt, { confirmed: [1, -1], diverged: [1, 1.5] });
  assert.equal(summarize("squeeze", "5m", [rows[3]], "library").smt, undefined);
});
