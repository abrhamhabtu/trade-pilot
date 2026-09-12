import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTraderEdits, refreshDemoAccounts, buildDemoAccounts } from '../src/lib/demo/demoData.ts';

const sample = (over = {}) => ({
  id: 'demo-account',
  name: 'Sample',
  broker: 'Topstep',
  balance: 50000,
  lastUpdate: null,
  type: 'demo',
  status: 'active',
  createdAt: '2026-01-01',
  importHistory: [],
  trades: [],
  ...over,
});

test('an untouched sample carries nothing worth keeping', () => {
  assert.equal(hasTraderEdits(sample()), false);
});

test('settings the trader changed count as their own work', () => {
  assert.equal(hasTraderEdits(sample({ personalDailyLimit: 600 })), true);
  assert.equal(hasTraderEdits(sample({ profitTarget: 3000 })), true);
  assert.equal(hasTraderEdits(sample({ accountTier: 'elite' })), true);
  assert.equal(
    hasTraderEdits(sample({ liquidationRules: { drawdown: 2000 } })),
    true,
  );
});

test('work recorded against trades and payouts counts too', () => {
  const withNote = sample({ trades: [{ id: 't', date: '2026-01-02', netPL: 10, notes: 'ugly fill' }] });
  const withTag = sample({ trades: [{ id: 't', date: '2026-01-02', netPL: 10, tags: ['a+'] }] });
  const withReview = sample({ trades: [{ id: 't', date: '2026-01-02', netPL: 10, pilotReview: {} }] });
  const withPayout = sample({
    balanceAdjustments: [{ id: 'p', date: '2026-01-03', amount: -500, type: 'payout', createdAt: '' }],
  });
  for (const a of [withNote, withTag, withReview, withPayout]) {
    assert.equal(hasTraderEdits(a), true);
  }
});

test('an empty trade list is not mistaken for an edit', () => {
  assert.equal(hasTraderEdits(sample({ trades: [], balanceAdjustments: [] })), false);
});

test('refresh keeps the daily stop and drawdown rules on a sample account', () => {
  const current = buildDemoAccounts().map((a) =>
    a.id === 'demo-account'
      ? { ...a, personalDailyLimit: 600, liquidationRules: { drawdown: 2000, drawdownType: 'static' } }
      : a,
  );
  const refreshed = refreshDemoAccounts(current);
  const account = refreshed.find((a) => a.id === 'demo-account');
  assert.equal(account.personalDailyLimit, 600, 'Preflight commits this; it must survive');
  assert.equal(account.liquidationRules.drawdown, 2000);
});
