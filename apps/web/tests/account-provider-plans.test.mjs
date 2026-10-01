import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const code = ts.transpileModule(readFileSync(new URL('../src/lib/accountProviderPlans.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { TRADOVATE_ACCOUNT_PROVIDERS, FUTURES_ELITE_PLANS, futuresEliteSelection } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('focused providers are available and only valid program sizes can be selected', () => {
  for (const provider of ['Futures Elite', 'Lucid Trading', 'Top One Futures']) assert.ok(TRADOVATE_ACCOUNT_PROVIDERS.includes(provider));
  assert.equal(futuresEliteSelection('missing', 50000), null);
  assert.equal(futuresEliteSelection('futures-elite-elite', 75000), null);
  assert.equal(FUTURES_ELITE_PLANS.length, 4);
  for (const plan of FUTURES_ELITE_PLANS) {
    assert.deepEqual(plan.tiers.map(t => t.size), [25000, 50000, 100000, 150000]);
    for (const tier of plan.tiers) {
      assert.ok(tier.promoPrice <= tier.listPrice);
      assert.ok(tier.maxLoss > 0 && tier.maxLoss < tier.size);
    }
  }
});

test('Instant does not inherit an evaluation target or Prime daily loss rule', () => {
  const instant = futuresEliteSelection('futures-elite-instant', 50000);
  const prime = futuresEliteSelection('futures-elite-prime', 50000);
  assert.equal(instant.plan.instant, true);
  assert.equal(instant.tier.target, null);
  assert.equal(instant.tier.dailyLoss, null);
  assert.equal(instant.tier.maxLoss, 1800);
  assert.equal(prime.plan.instant, false);
  assert.equal(prime.tier.target, 3000);
  assert.equal(prime.tier.dailyLoss, 1200);
  assert.equal(prime.tier.maxLoss, 2000);
});
