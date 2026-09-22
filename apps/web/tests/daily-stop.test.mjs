import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDailyStop, consistencyCeiling } from '../src/lib/dailyStop.ts';

const T = '2026-09-22';
const trade = (date, netPL) => ({ id: `${date}-${netPL}-${Math.random()}`, date, time: '09:45', netPL, symbol: 'MNQ', quantity: 1 });
const acct = (trades, extra = {}) => ({
  id: 'a', name: 'a', broker: 'Custom', balance: 0, lastUpdate: null, type: 'manual', status: 'active',
  createdAt: '2026-01-01', importHistory: [], trades, startingBalance: 50000, ...extra,
});
const morning = new Date(`${T}T09:50:00`);

test('the tightest loss limit stops the day', () => {
  const s = evaluateDailyStop(acct([trade(T, -400)], { personalDailyLimit: 600 }), T, { maxLoss: 400 }, morning);
  assert.equal(s.lossLimit, 400);
  assert.deepEqual(s.reasons.map((r) => r.kind), ['loss']);
});

test('hitting the goal stops the day; nearing it warns', () => {
  assert.ok(evaluateDailyStop(acct([trade(T, 500)]), T, { maxProfit: 500 }, morning).stopped);
  const near = evaluateDailyStop(acct([trade(T, 420)]), T, { maxProfit: 500 }, morning);
  assert.equal(near.stopped, false);
  assert.equal(near.warning?.kind, 'goal');
});

test('trade count and stop time', () => {
  const s = evaluateDailyStop(acct([trade(T, 10), trade(T, -5)]), T, { maxTrades: 2, stopTime: '09:30' }, morning);
  assert.deepEqual(s.reasons.map((r) => r.kind).sort(), ['time', 'trades']);
});

test('Topstep consistency caps a day at half the target', () => {
  const a = acct([trade(T, 1600)], { broker: 'Topstep', profitTarget: 3000 });
  assert.equal(consistencyCeiling(a, T), 1500);
  assert.ok(evaluateDailyStop(a, T, {}, morning).reasons.some((r) => r.kind === 'consistency'));
});

test('total-profit consistency grows with profit banked since the last payout', () => {
  // Lucid Pro 40%: $3,000 prior → today ≤ 0.4 × 3000 / 0.6 = $2,000; planning number 40% × 3,000 = $1,200.
  const a = acct([trade('2026-09-18', 3000)], { broker: 'Lucid Trading', profitTarget: 3000 });
  assert.equal(Math.round(consistencyCeiling(a, T)), 2000);
  // After a payout, only newer profit counts.
  const paid = { ...a, balanceAdjustments: [{ id: 'p', date: '2026-09-19', amount: -1000, type: 'payout', createdAt: '' }] };
  assert.equal(Math.round(consistencyCeiling(paid, T)), 1200);
});

test('no firm, no rule, no stop', () => {
  const s = evaluateDailyStop(acct([trade(T, 5000)]), T, {}, morning);
  assert.equal(s.stopped, false);
  assert.equal(s.consistencyCeiling, null);
});
