import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateOdds, compareFirms, riskSweep, bestRiskScale, dailySamples, accountPassOdds } from '../src/lib/passOdds.ts';

const RULES = {
  startingBalance: 50000, drawdown: 2000, drawdownType: 'trailing-eod', lockProfit: 0,
  dailyLossLimit: null, profitTarget: 3000, consistencyPercent: 100, minTradingDays: 1,
};

test('a trader who only wins always passes; one who only loses always blows', () => {
  assert.equal(simulateOdds([500], RULES).pass, 1);
  assert.equal(simulateOdds([-500], RULES).blow, 1);
});

test('same inputs, same odds', () => {
  const s = [400, -300, 250, -200, 600, -450, 100];
  assert.deepEqual(simulateOdds(s, RULES, { seed: 3 }), simulateOdds(s, RULES, { seed: 3 }));
});

test('minimum days holds a pass back', () => {
  const r = simulateOdds([3000], { ...RULES, minTradingDays: 5 });
  assert.equal(r.pass, 1);
  assert.equal(r.medianDays, 5);
});

test('consistency raises the bar after a big day', () => {
  // One $1,500 day at a 40% rule needs $3,750 total, not $3,000.
  const r = simulateOdds([1500], { ...RULES, consistencyPercent: 40 });
  assert.equal(r.medianDays, 3); // 1,500 → 3,000 (not enough) → 4,500
});

test('a daily loss limit caps the worst day', () => {
  const s = [-2500, 800];
  const without = simulateOdds(s, RULES, { seed: 1 });
  const withDll = simulateOdds(s, { ...RULES, dailyLossLimit: 1000 }, { seed: 1 });
  assert.ok(withDll.pass > without.pass);
});

test('trailing threshold follows the peak until it locks', () => {
  const once = (day, rules, start) => simulateOdds([day], { ...RULES, ...rules }, { start, maxDays: 1 }).blow;
  const up1k = { profit: 1000, peakProfit: 1000, days: 1, bestDay: 1000 };
  // +1,000 then −2,500 = −1,500: inside a static −2,000 floor, below a trailed −1,000 one.
  assert.equal(once(-2500, { drawdownType: 'static' }, up1k), 0);
  assert.equal(once(-2500, { lockProfit: null }, up1k), 1);
  // A peak of +3,000 trails the line to +1,000; a lock at 0 holds it at 0.
  const up3k = { profit: 3000, peakProfit: 3000, days: 3, bestDay: 1000 };
  assert.equal(once(-2900, { lockProfit: 0, profitTarget: 99999 }, up3k), 0);
  assert.equal(once(-2900, { lockProfit: null, profitTarget: 99999 }, up3k), 1);
});

test('comparison ranks by cost per pass and skips instant programs', () => {
  const rows = compareFirms([450, -300, 380, -250, 500, -350, 200, 300, -150, 420]);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.firm.payoutModel === 'eval'));
  const priced = rows.filter((r) => r.costPerPass !== null).map((r) => r.costPerPass);
  assert.deepEqual(priced, [...priced].sort((a, b) => a - b));
});

test('risk sweep finds a size, and oversizing blows more', () => {
  const s = [450, -300, 380, -250, 500, -350, 200, 300, -150, 420, -500];
  const sweep = riskSweep(s, RULES);
  assert.ok(sweep.at(-1).odds.blow >= sweep[0].odds.blow);
  assert.ok([0.5, 0.75, 1, 1.25, 1.5, 2].includes(bestRiskScale(sweep)));
  // A sweep where nothing clearly beats 1× keeps 1×.
  const flat = [0.5, 1, 2].map((riskScale) => ({ riskScale, odds: { pass: riskScale === 0.5 ? 0.81 : 0.8 } }));
  assert.equal(bestRiskScale(flat), 1);
});

test('samples are per account per day, never summed across accounts', () => {
  const t = (date, netPL) => ({ date, netPL });
  const s = dailySamples([{ trades: [t('2026-01-02', 100), t('2026-01-02', 50)] }, { trades: [t('2026-01-02', -70)] }]);
  assert.deepEqual(s.sort(), [-70, 150].sort());
});

test('funded accounts get no pass odds', () => {
  assert.equal(accountPassOdds({ isFunded: true, status: 'active', trades: [] }, [100]), null);
});
