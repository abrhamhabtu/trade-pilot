import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRM_FINE_PRINT, minDayProfitFor, finePrintFor, tierOneReleasesOn } from '../src/components/payout/firmFinePrint.ts';
import { PROP_FIRMS } from '../src/components/payout/propFirmData.ts';
import { firmWarningsFor } from '../src/lib/firmWarnings.ts';

const acct = (extra = {}) => ({
  id: 'a', name: 'MFFU 50K', broker: 'My Funded Futures', balance: 0, lastUpdate: null,
  type: 'manual', status: 'active', createdAt: '2026-01-01', importHistory: [], trades: [],
  startingBalance: 50000, isFunded: true, ...extra,
});

test('every fine print entry belongs to a real program and cites a source', () => {
  const ids = new Set(PROP_FIRMS.map((f) => f.id));
  for (const [id, fp] of Object.entries(FIRM_FINE_PRINT)) {
    assert.ok(ids.has(id), `${id} is not in PROP_FIRMS`);
    if (fp.news.value !== 'unknown') assert.ok(fp.sources.length > 0, `${id} has no sources`);
    const tiers = new Set(PROP_FIRMS.find((f) => f.id === id).tiers.map((t) => t.id));
    for (const t of Object.keys(fp.payoutCaps?.value ?? {})) assert.ok(tiers.has(t), `${id}: unknown tier ${t}`);
  }
});

test('qualifying-day profit resolves flat and per-tier rules', () => {
  assert.equal(minDayProfitFor(finePrintFor('topstep'), 'topstep-50k'), 150);
  assert.equal(minDayProfitFor(finePrintFor('lucid-flex'), 'lucidflex-100k'), 200);
  assert.equal(minDayProfitFor(finePrintFor('apex'), 'apex-50k'), null);
});

test('FOMC day is scheduled, first Friday is only typical, CPI is never guessed', () => {
  assert.deepEqual(tierOneReleasesOn('2026-09-16').map((r) => r.certainty), ['scheduled']);
  assert.deepEqual(tierOneReleasesOn('2026-10-02').map((r) => r.certainty), ['typical']);
  assert.equal(tierOneReleasesOn('2026-10-14').length, 0);
});

test('a funded MFFU account is warned off FOMC; an eval is not', () => {
  const funded = firmWarningsFor(acct(), '2026-09-16');
  assert.ok(funded.some((w) => w.id.startsWith('news-ban-FOMC')));
  const evalAcct = firmWarningsFor(acct({ isFunded: false }), '2026-09-16');
  assert.equal(evalAcct.length, 0);
});

test('Apex warns before its last allowed payout', () => {
  const payouts = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, date: `2026-0${i + 1}-15`, amount: -1000, type: 'payout', createdAt: '' }));
  const w = firmWarningsFor(acct({ broker: 'Apex Trader Funding', balanceAdjustments: payouts }), '2026-09-22');
  assert.ok(w.some((x) => x.id === 'last-payout'));
});
