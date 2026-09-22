import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLedger, firmLabel } from '../src/lib/propLedger.ts';
import { buildDemoAccounts } from '../src/lib/demo/demoData.ts';

const acct = (id, extra = {}) => ({
  id, name: id, broker: 'Topstep', balance: 0, lastUpdate: null, type: 'manual', status: 'active',
  createdAt: '2026-01-01', importHistory: [], trades: [], startingBalance: 50000, ...extra,
});
const cost = (date, amount, kind = 'evaluation') => ({ id: `${date}-${amount}`, date, amount, kind, createdAt: '' });
const payout = (date, amount, received) => ({ id: `${date}`, date, amount: -amount, type: 'payout', received, createdAt: '' });

test('net is payouts received minus every fee', () => {
  const l = computeLedger([
    acct('a', { isFunded: true, costs: [cost('2026-01-05', 49), cost('2026-02-05', 149, 'activation')], balanceAdjustments: [payout('2026-03-01', 2000, 1800)] }),
    acct('b', { isFunded: false, status: 'blown', costs: [cost('2026-01-10', 49), cost('2026-01-20', 49, 'reset')] }),
  ]);
  assert.equal(l.spent, 296);
  assert.equal(l.received, 1800);
  assert.equal(l.net, 1504);
  assert.equal(l.byKind.reset, 49);
  assert.equal(l.grossPayouts, 0);
  assert.deepEqual(l.evals, { passed: 1, failed: 1, open: 0, passRate: 0.5 });
  assert.equal(l.funded.payoutRate, 1);
  assert.equal(l.costPerFunded, 296);
});

test('payouts without a received amount count gross and are flagged', () => {
  const l = computeLedger([acct('a', { balanceAdjustments: [payout('2026-03-01', 1000)] })]);
  assert.equal(l.received, 1000);
  assert.equal(l.grossPayouts, 1);
  assert.equal(l.returnOnFees, null);
});

test('months accumulate in order', () => {
  const l = computeLedger([acct('a', { costs: [cost('2026-02-01', 100)], balanceAdjustments: [payout('2026-01-15', 500, 450)] })]);
  assert.deepEqual(l.months.map((m) => [m.month, m.cumulative]), [['2026-01', 450], ['2026-02', 350]]);
});

test('firm label resolves the catalog name, else the typed broker', () => {
  assert.equal(firmLabel({ broker: 'apex trader funding', startingBalance: 50000, balance: 0 }), 'Apex Trader Funding');
  assert.equal(firmLabel({ broker: 'Bulenox', startingBalance: 50000, balance: 0 }), 'Bulenox');
});

test('the sample book is net positive and has a blown evaluation', () => {
  const l = computeLedger(buildDemoAccounts());
  assert.ok(l.spent > 0 && l.received > l.spent);
  assert.equal(l.evals.failed, 1);
});
