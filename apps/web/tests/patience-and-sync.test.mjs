import test from "node:test";
import assert from "node:assert/strict";
import { patienceScenario } from "../src/lib/patience.ts";
import { projectXTrades } from "../src/lib/projectx.ts";

const inputs = {
  risk: 100,
  accounts: 3,
  cushion: 2000,
  winRate: 45,
  reward: 1.5,
  trades: 2,
  split: 90,
  fees: 4,
  goal: 3000,
};
test("negative edge does not promise a goal date; copied accounts amplify a losing model", () => {
  const one = patienceScenario({ ...inputs, accounts: 1, winRate: 20 });
  const three = patienceScenario({ ...inputs, winRate: 20 });
  assert.equal(one.goalSessions, null);
  assert.ok(three.cycle < one.cycle);
});
test("exact drawdown boundary is a breach, not an extra survivable loss", () => {
  assert.equal(
    patienceScenario({ ...inputs, cushion: 1000, fees: 0 }).lossesBeforeLimit,
    9,
  );
  assert.equal(
    patienceScenario({ ...inputs, cushion: 1000, fees: 0 }, 0.5)
      .lossesBeforeLimit,
    19,
  );
});
const fill = (patch = {}) => ({
  id: 1,
  accountId: 42,
  contractId: "CON.F.US.MNQ.U26",
  creationTimestamp: "2026-09-01T14:00:00Z",
  price: 20000,
  profitAndLoss: null,
  fees: 2,
  side: 0,
  size: 2,
  voided: false,
  ...patch,
});
test("partial closes allocate entry fees exactly once, with stable IDs and correct duration", () => {
  const trades = projectXTrades(
    [
      fill(),
      fill({
        id: 2,
        creationTimestamp: "2026-09-01T14:05:00Z",
        side: 1,
        size: 1,
        price: 20010,
        profitAndLoss: 20,
        fees: 1,
      }),
      fill({
        id: 3,
        creationTimestamp: "2026-09-01T14:10:00Z",
        side: 1,
        size: 1,
        price: 20020,
        profitAndLoss: 40,
        fees: 1,
      }),
    ],
    42,
  );
  assert.equal(trades.length, 2);
  assert.equal(
    trades.reduce((n, t) => n + t.netPL, 0),
    56,
  );
  assert.deepEqual(
    trades.map((t) => t.commission),
    [2, 2],
  );
  assert.deepEqual(
    trades.map((t) => t.duration),
    [5, 10],
  );
  assert.equal(trades[0].id, "projectx:42:2");
  assert.equal(trades[0].side, "Long");
});
test("missing opening history fails without inventing entries or P&L", () => {
  assert.throws(
    () => projectXTrades([fill({ profitAndLoss: 100, side: 1 })], 42),
    /matching entry/,
  );
});
test("duplicates, other accounts, and voids do not create extra trades", () => {
  const close = fill({ id: 2, side: 1, profitAndLoss: 40 });
  const trades = projectXTrades(
    [
      fill(),
      close,
      close,
      fill({ id: 3, accountId: 999, profitAndLoss: 500 }),
      fill({ id: 4, voided: true, profitAndLoss: 99 }),
    ],
    42,
  );
  assert.equal(trades.length, 1);
  assert.equal(trades[0].netPL, 36);
});
test("short entries retain direction and provider gross P&L", () => {
  const [trade] = projectXTrades(
    [
      fill({ side: 1 }),
      fill({ id: 2, side: 0, price: 19990, profitAndLoss: 40 }),
    ],
    42,
  );
  assert.equal(trade.side, "Short");
  assert.equal(trade.entryPrice, 20000);
  assert.equal(trade.exitPrice, 19990);
  assert.equal(trade.netPL, 36);
});
