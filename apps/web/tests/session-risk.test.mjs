import test from "node:test";
import assert from "node:assert/strict";
import {
  sizeSession,
  snapshotFresh,
  localSessionDate,
} from "../src/lib/sessionRisk.ts";

const now = new Date(2026, 8, 8, 9, 0);
const snapshot = {
  cushion: 1000,
  dailyRemaining: 200,
  personalDailyLimit: 300,
  reserve: 500,
  contractCap: 5,
  nextRequirement: "Check qualifying days",
  confirmedAt: now.toISOString(),
};
const account = (patch = {}) => ({
  id: "one",
  name: "One",
  status: "active",
  riskSnapshot: { ...snapshot, ...patch },
});
const plan = {
  symbol: "MNQ",
  stopPoints: 20,
  risk: 100,
  fees: 2,
  slippagePoints: 1,
  maxTrades: 2,
  completedTrades: 0,
  date: localSessionDate(now),
  finishTime: "11:00",
  setup: "Retest",
};

test("costs and slippage included; copied exposure is not diversified", () => {
  const r = sizeSession(
    plan,
    [account(), { ...account(), id: "two", name: "Two" }],
    now,
  );
  assert.equal(r.perContract, 44);
  assert.equal(r.contracts, 2);
  assert.equal(r.perAccountRisk, 88);
  assert.equal(r.totalRisk, 176);
});
test("tightest account budget and contract cap govern every copied account", () => {
  assert.equal(
    sizeSession(plan, [account(), account({ dailyRemaining: 50 })], now)
      .contracts,
    1,
  );
  assert.equal(
    sizeSession(plan, [account({ contractCap: 1 })], now).contracts,
    1,
  );
  assert.equal(
    sizeSession(plan, [account({ personalDailyLimit: 40 })], now).contracts,
    0,
  );
});
test("never invent capacity when one contract cannot fit or cushion boundary would be hit", () => {
  assert.equal(
    sizeSession({ ...plan, risk: 43 }, [account()], now).contracts,
    0,
  );
  assert.equal(
    sizeSession(
      { ...plan, fees: 0, slippagePoints: 0 },
      [account({ cushion: 40, reserve: 0 })],
      now,
    ).contracts,
    0,
  );
  assert.equal(
    sizeSession(plan, [account({ reserve: 1000 })], now).contracts,
    0,
  );
  assert.equal(
    sizeSession(plan, [account({ dailyRemaining: 0 })], now).contracts,
    0,
  );
});
test("unknown, old, future and after-trade snapshots block sizing", () => {
  for (const confirmedAt of [
    "invalid",
    new Date(now.getTime() - 30 * 60_000 - 1).toISOString(),
    new Date(now.getTime() + 1).toISOString(),
  ]) {
    assert.equal(
      snapshotFresh({ ...snapshot, confirmedAt }, now.getTime()),
      false,
    );
    assert.equal(
      sizeSession(plan, [account({ confirmedAt })], now).contracts,
      0,
    );
  }
  assert.equal(
    sizeSession(plan, [{ ...account(), riskSnapshot: undefined }], now)
      .contracts,
    0,
  );
  assert.equal(
    sizeSession({ ...plan, lastTradeAt: now.toISOString() }, [account()], now)
      .contracts,
    0,
  );
});
test("day, time, setup, active status, account selection and trade count are required", () => {
  for (const patch of [
    { date: "2026-09-07" },
    { finishTime: "09:00" },
    { finishTime: "25:00" },
    { setup: " " },
    { completedTrades: 2 },
  ])
    assert.equal(
      sizeSession({ ...plan, ...patch }, [account()], now).contracts,
      0,
    );
  assert.equal(sizeSession(plan, [], now).contracts, 0);
  assert.equal(
    sizeSession(plan, [{ ...account(), status: "blown" }], now).contracts,
    0,
  );
});
test("invalid inputs fail closed and fractional stops round up to valid ticks", () => {
  for (const patch of [
    { stopPoints: 0 },
    { risk: NaN },
    { fees: -1 },
    { maxTrades: 1.5 },
    { completedTrades: -1 },
    { symbol: "UNKNOWN" },
  ])
    assert.equal(
      sizeSession({ ...plan, ...patch }, [account()], now).contracts,
      0,
    );
  assert.equal(
    sizeSession(plan, [account({ contractCap: NaN })], now).contracts,
    0,
  );
  assert.equal(
    sizeSession(plan, [account({ cushion: -10 })], now).contracts,
    0,
  );
  const r = sizeSession(
    { ...plan, stopPoints: 20.01, slippagePoints: 0.01 },
    [account()],
    now,
  );
  assert.equal(r.roundedStop, 20.25);
  assert.equal(r.perContract, 43);
});
