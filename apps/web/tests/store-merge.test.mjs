import test from "node:test";
import assert from "node:assert/strict";

// The store reads localStorage lazily; Node has none, which the persist layer tolerates.
const { useVisionStore, mergeVision, readOf } = await import("../src/store/visionStore.ts");

test("a save from before Discover loads with every new default", () => {
  const current = useVisionStore.getState();
  const old = {
    kind: "futures",
    charts: [{ symbol: "NQ", tf: "5m", reader: "dbvwap" }],
    bt: { symbol: "ES", session: "rth" },
    autoExecute: true,
  };
  const s = mergeVision(old, current);
  assert.deepEqual(s.pinned, []);
  assert.deepEqual(s.discover, current.discover);
  assert.equal(s.discover.minTrades, 200);
  assert.deepEqual(s.presets, []);
  assert.equal(s.guardAccount, null);
  assert.equal(s.btRunNonce, 0);
  assert.equal(s.bt.symbol, "ES");
  assert.equal(s.bt.session, "ny", "the old 'rth' session becomes New York");
  assert.equal(s.bt.tf, current.bt.tf, "missing backtest settings get defaults");
  assert.equal(s.autoExecute, true);
  // A chart saved with only a reader still reads with it; nothing about its view was saved.
  assert.equal(readOf(s.charts[0]), "dbvwap");
  assert.equal(s.charts[0].view, undefined);
  assert.equal(readOf({ symbol: "GC", tf: "5m" }), "auto");
});

test("saved dials merge over the defaults, and a pending run never restarts on load", () => {
  const current = useVisionStore.getState();
  const s = mergeVision({ discover: { minTrades: 300 }, pinned: ["asia_sweep"], btRunNonce: 7 }, current);
  assert.equal(s.discover.minTrades, 300);
  assert.equal(s.discover.minT, 2, "the rest keep their defaults");
  assert.deepEqual(s.pinned, ["asia_sweep"]);
  assert.equal(s.btRunNonce, 0);
});

test("openBacktest switches to Strategy test with the patch, and only a run request bumps the nonce", () => {
  const st = useVisionStore.getState();
  const n = st.btRunNonce;
  st.openBacktest({ symbol: "GC", tf: "15m" });
  let s = useVisionStore.getState();
  assert.equal(s.mode, "backtest");
  assert.equal(s.btTab, "test");
  assert.equal(s.bt.symbol, "GC");
  assert.equal(s.btRunNonce, n);
  st.openBacktest({ symbol: "NQ" }, { run: true, tab: "replay" });
  s = useVisionStore.getState();
  assert.equal(s.btTab, "replay");
  assert.equal(s.btRunNonce, n + 1);
  st.togglePin("squeeze");
  assert.deepEqual(useVisionStore.getState().pinned, ["squeeze"]);
  st.togglePin("squeeze");
  assert.deepEqual(useVisionStore.getState().pinned, []);
});
