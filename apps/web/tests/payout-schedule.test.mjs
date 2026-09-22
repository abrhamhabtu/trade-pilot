import test from 'node:test';
import assert from 'node:assert/strict';
import { payoutWindow, payoutSchedule, addTradingDays } from '../src/lib/payoutSchedule.ts';
import { buildDemoAccounts } from '../src/lib/demo/demoData.ts';

const T = '2026-09-22'; // a Tuesday
const trade = (date, netPL) => ({ id: `${date}-${netPL}`, date, time: '09:45', netPL, symbol: 'MNQ', quantity: 1 });
const acct = (trades, extra = {}) => ({
  id: 'a', name: 'Topstep 50K', broker: 'Topstep', balance: 0, lastUpdate: null, type: 'manual', status: 'active',
  createdAt: '2026-01-01', importHistory: [], trades, startingBalance: 50000, isFunded: true, ...extra,
});
const days = (n, pnl, start = 1) => Array.from({ length: n }, (_, i) => trade(`2026-09-${String(start + i).padStart(2, '0')}`, pnl));

test('trading days skip weekends', () => {
  assert.equal(addTradingDays('2026-09-25', 1), '2026-09-28'); // Fri → Mon
  assert.equal(addTradingDays(T, 3), '2026-09-25');
});

test('Topstep: five $150+ days, capped at $2,000, split 90%', () => {
  const w = payoutWindow(acct(days(5, 600)), T);
  assert.equal(w.status, 'ready');
  assert.equal(w.requestable, 2000);
  assert.equal(w.afterSplit, 1800);
});

test('small days do not count, and the earliest date says when they could', () => {
  const w = payoutWindow(acct([...days(3, 400), ...days(2, 100, 10)]), T);
  assert.equal(w.status, 'waiting');
  assert.deepEqual(w.days, { have: 3, need: 5, qualifyingProfit: 150 });
  assert.equal(w.earliestDate, '2026-09-24');
});

test('only profit since the last payout counts', () => {
  const w = payoutWindow(acct(days(5, 600), { balanceAdjustments: [{ id: 'p', date: '2026-09-05', amount: -2000, type: 'payout', createdAt: '' }] }), T);
  assert.equal(w.cycleProfit, 0);
  assert.ok(w.blockers.some((b) => b.kind === 'profit'));
});

test('a big day holds a total-profit consistency payout', () => {
  // Lucid Pro 40%: one $2,000 day in $3,000 of cycle profit is 67%.
  const w = payoutWindow(acct([trade('2026-09-01', 2000), ...days(5, 200, 2)], { broker: 'Lucid Trading', name: 'Lucid Pro 50K' }), T);
  assert.equal(w.status, 'held');
  assert.match(w.blockers.find((b) => b.kind === 'consistency').text, /\$2,000 more profit/);
});

test('Apex keeps drawdown + $100 in the account and stops at six payouts', () => {
  const apex = { broker: 'Apex Trader Funding', name: 'Apex 50K PA', startingBalance: 50000 };
  const thin = payoutWindow(acct(days(10, 250), apex), T); // $2,500 profit, floor $2,600
  assert.ok(thin.blockers.some((b) => b.kind === 'safety-net'));
  const six = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, date: `2026-0${i + 1}-15`, amount: -500, type: 'payout', createdAt: '' }));
  assert.equal(payoutWindow(acct(days(10, 900), { ...apex, balanceAdjustments: six }), T).status, 'maxed');
});

test('evaluations and blown accounts have no window; the sample book lists its funded ones', () => {
  assert.equal(payoutWindow(acct([], { isFunded: false }), T), null);
  const s = payoutSchedule(buildDemoAccounts(), T);
  assert.ok(s.length >= 2);
  assert.ok(s.every((w) => ['ready', 'waiting', 'held', 'maxed'].includes(w.status)));
});
