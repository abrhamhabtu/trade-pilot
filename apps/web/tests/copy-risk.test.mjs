import test from 'node:test';
import assert from 'node:assert/strict';
import { correlation, findCopyGroups, copyPlanWarning } from '../src/lib/copyRisk.ts';

const PNL = [300, -250, 420, -180, 510, -600, 150, 275, -90, 330];
const days = PNL.map((_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
const acct = (id, scale, extra = {}) => ({
  id, name: id, broker: 'Custom', balance: 0, lastUpdate: null, type: 'manual', status: 'active', createdAt: '', importHistory: [],
  trades: PNL.map((p, i) => ({ id: `${id}-${i}`, date: days[i], time: '09:45', netPL: p * scale, symbol: 'MNQ', quantity: 1 })),
  startingBalance: 50000,
  liquidationRules: { firmId: null, tierId: null, label: 'x', inferred: false, drawdownType: 'static', drawdown: 2000, lockProfit: null, dailyLossLimit: null, startingBalance: 50000 },
  ...extra,
});

test('correlation ignores size and needs enough shared days', () => {
  const a = new Map(days.map((d, i) => [d, PNL[i]]));
  const b = new Map(days.map((d, i) => [d, PNL[i] * 3]));
  assert.ok(Math.abs(correlation(a, b) - 1) < 1e-9);
  const few = new Map(days.slice(0, 3).map((d, i) => [d, PNL[i]]));
  assert.equal(correlation(a, few), null);
});

test('a 1-lot and a 3-lot copy group together; an unrelated account does not', () => {
  const other = acct('other', 1);
  other.trades = other.trades.map((t, i) => ({ ...t, netPL: [100, 90, -300, 250, -40, 60, -200, 10, 400, -120][i] }));
  const groups = findCopyGroups([acct('one', 1), acct('three', 3), other]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].members.map((m) => m.id).sort(), ['one', 'three']);
});

test('worst day against each cushion decides who would blow', () => {
  // Worst day −600 ×4 = −2,400 against ~2,000 + profit cushion for the 4-lot.
  const [g] = findCopyGroups([acct('one', 1), acct('four', 4)]);
  const four = g.members.find((m) => m.id === 'four');
  assert.equal(four.worstDay, 2400);
  assert.equal(four.wouldBlow, four.cushion <= 2400);
  assert.equal(g.combinedWorstDay, 3000);
});

test('blown or inactive accounts are left out', () => {
  assert.equal(findCopyGroups([acct('one', 1), acct('b', 2, { status: 'blown' })]).length, 0);
});

test('planning warning says when one day ends every copy', () => {
  assert.match(copyPlanWarning(2500, 2000, 4, 150), /ends all 4 at once/);
  assert.match(copyPlanWarning(1000, 2000, 3, 150), /50%/);
  assert.equal(copyPlanWarning(1000, 2000, 1, 150), null);
});
