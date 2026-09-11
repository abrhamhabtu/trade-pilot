import test from "node:test";
import assert from "node:assert/strict";
import { tradovateTrades } from "../src/lib/tradovate.ts";

const pair = {
  id: 10,
  positionId: 1,
  buyFillId: 1,
  sellFillId: 2,
  qty: 1,
  buyPrice: 20000,
  sellPrice: 20010,
  active: true,
};
const buy = {
  id: 1,
  contractId: 5,
  timestamp: "2026-09-01T14:00:00Z",
  qty: 2,
  active: true,
};
const sell = {
  id: 2,
  contractId: 5,
  timestamp: "2026-09-01T14:05:00Z",
  qty: 1,
  active: true,
};
const contracts = new Map([[5, { name: "MNQU6", valuePerPoint: 2 }]]);
const fees = new Map([
  [1, 2],
  [2, 1],
]);

test("Tradovate uses authoritative point value and prorates partial-close fees", () => {
  const [t] = tradovateTrades(
    [pair],
    [buy, sell],
    contracts,
    fees,
    42,
    "demo",
    0,
  );
  assert.equal(t.netPL, 18);
  assert.equal(t.commission, 2);
  assert.equal(t.duration, 5);
  assert.equal(t.symbol, "MNQU6");
  assert.equal(t.side, "Long");
});
test("live and simulation account IDs cannot collide", () => {
  const args = [[pair], [buy, sell], contracts, fees, 42];
  const [demo] = tradovateTrades(...args, "demo", 0);
  const [live] = tradovateTrades(...args, "live", 0);
  assert.notEqual(demo.id, live.id);
});
test("missing fees or contract metadata rejects the import", () => {
  assert.throws(
    () =>
      tradovateTrades([pair], [buy, sell], contracts, new Map(), 42, "demo", 0),
    /fees/,
  );
  assert.throws(
    () => tradovateTrades([pair], [buy, sell], new Map(), fees, 42, "demo", 0),
    /Contract/,
  );
});
test("inactive pairs, duplicates, and out-of-range trades are not imported", () => {
  assert.equal(
    tradovateTrades(
      [pair, pair, { ...pair, id: 11, active: false }],
      [buy, sell],
      contracts,
      fees,
      42,
      "demo",
      0,
    ).length,
    1,
  );
  assert.equal(
    tradovateTrades(
      [pair],
      [buy, sell],
      contracts,
      fees,
      42,
      "demo",
      Date.parse("2026-09-02"),
    ).length,
    0,
  );
});
test("short trade side and entry/exit prices follow execution order", () => {
  const [t] = tradovateTrades(
    [pair],
    [{ ...buy, timestamp: "2026-09-01T14:10:00Z" }, sell],
    contracts,
    fees,
    42,
    "demo",
    0,
  );
  assert.equal(t.side, "Short");
  assert.equal(t.entryPrice, 20010);
  assert.equal(t.exitPrice, 20000);
  assert.equal(t.netPL, 18);
});
