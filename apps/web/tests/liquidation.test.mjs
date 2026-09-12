import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLiquidation,
  resolveFirm,
  dollarsToPoints,
  liquidationHeadline,
} from '../src/lib/liquidation.ts';

const trade = (date, netPL, time = '09:30') => ({
  id: `${date}-${time}-${netPL}`,
  date,
  time,
  symbol: 'MNQ',
  entryPrice: 0,
  exitPrice: 0,
  quantity: 1,
  netPL,
  duration: 60,
  outcome: netPL >= 0 ? 'win' : 'loss',
});

/** Account with hand-set rules, so tests never depend on the firm catalog drifting. */
const acct = (rules, trades, extra = {}) => ({
  id: 'a',
  name: 'test',
  broker: 'Custom',
  balance: 0,
  lastUpdate: null,
  type: 'manual',
  status: 'active',
  createdAt: '2026-01-01',
  importHistory: [],
  trades,
  startingBalance: rules.startingBalance,
  liquidationRules: { firmId: null, tierId: null, label: 'test', inferred: false, ...rules },
  ...extra,
});

const STATIC = {
  drawdownType: 'static',
  drawdown: 2000,
  lockProfit: 0,
  dailyLossLimit: null,
  startingBalance: 50000,
};

test('static drawdown never moves, whatever the peak was', () => {
  const s = computeLiquidation(
    acct(STATIC, [trade('2026-01-02', 5000), trade('2026-01-03', -1000)]),
    { today: '2026-01-03' },
  );
  assert.equal(s.threshold, 48000);
  assert.equal(s.balance, 54000);
  assert.equal(s.cushion, 6000);
  assert.equal(s.trailed, 0);
  assert.equal(s.estimated, false);
});

test('EOD trailing follows daily closes and stops at the lock', () => {
  // Peak close 50800 → trailed threshold 48800, but the lock caps it at 50000+0.
  const locked = computeLiquidation(
    acct({ ...STATIC, drawdownType: 'trailing-eod' }, [
      trade('2026-01-02', 800),
      trade('2026-01-03', 4000),
    ]),
    { today: '2026-01-03' },
  );
  assert.equal(locked.threshold, 50000, 'caps at startingBalance + lockProfit');
  assert.equal(locked.locked, true);

  // Below the lock, the threshold really does trail the best close.
  const trailing = computeLiquidation(
    acct({ ...STATIC, drawdownType: 'trailing-eod' }, [trade('2026-01-02', 500)]),
    { today: '2026-01-02' },
  );
  assert.equal(trailing.threshold, 48500);
  assert.equal(trailing.trailed, 500);
  assert.equal(trailing.locked, false);
});

test('an intraday peak raises the threshold even when the day closes red', () => {
  // Up 1200 mid-session, closes up 200. This is the killer the clock exists for.
  const trades = [trade('2026-01-02', 1200, '09:30'), trade('2026-01-02', -1000, '11:00')];

  const eod = computeLiquidation(
    acct({ ...STATIC, drawdownType: 'trailing-eod', lockProfit: null }, trades),
    { today: '2026-01-02' },
  );
  const intraday = computeLiquidation(
    acct({ ...STATIC, drawdownType: 'trailing-intraday', lockProfit: null }, trades),
    { today: '2026-01-02' },
  );

  assert.equal(eod.threshold, 48200, 'EOD only sees the 50200 close');
  assert.equal(intraday.threshold, 49200, 'intraday sees the 51200 spike');
  assert.equal(intraday.cushion, 1000);
  assert.equal(eod.cushion, 2000);
  assert.ok(intraday.cushion < eod.cushion, 'intraday firms are strictly harsher');
  assert.equal(intraday.estimated, true, 'must be flagged as closed-trade-only');
});

test('trailing threshold never falls back below where it started', () => {
  const s = computeLiquidation(
    acct({ ...STATIC, drawdownType: 'trailing-eod' }, [trade('2026-01-02', -1500)]),
    { today: '2026-01-02' },
  );
  assert.equal(s.threshold, 48000);
  assert.equal(s.trailed, 0);
});

test('losers-survived uses average and worst case, floored', () => {
  const s = computeLiquidation(
    acct(STATIC, [
      trade('2026-01-02', -100),
      trade('2026-01-02', -300, '10:00'),
      trade('2026-01-02', 400, '11:00'),
    ]),
    { today: '2026-01-02' },
  );
  assert.equal(s.cushion, 2000);
  assert.equal(s.avgLoss, 200);
  assert.equal(s.worstLoss, 300);
  assert.equal(s.lossesSurvived, 10);
  assert.equal(s.worstCaseLossesSurvived, 6);
});

test('the tighter of firm and personal daily limit binds', () => {
  const rules = { ...STATIC, dailyLossLimit: 1100 };
  const trades = [trade('2026-01-02', -400)];

  const firmOnly = computeLiquidation(acct(rules, trades), { today: '2026-01-02' });
  assert.equal(firmOnly.dailyRemaining, 700);
  assert.equal(firmOnly.bindingConstraint, 'daily', '700 < 1600 cushion');
  assert.equal(firmOnly.roomToStop, 700);

  const withPersonal = computeLiquidation(
    acct(rules, trades, { personalDailyLimit: 500 }),
    { today: '2026-01-02', personalDailyLimit: 500 },
  );
  assert.equal(withPersonal.dailyRemaining, 100, 'personal stop is tighter');
});

test('a green day does not hand back daily-limit room', () => {
  const s = computeLiquidation(
    acct({ ...STATIC, dailyLossLimit: 1000 }, [trade('2026-01-02', 750)]),
    { today: '2026-01-02' },
  );
  assert.equal(s.todayPnL, 750);
  assert.equal(s.dailyRemaining, 1000, 'never more than the limit itself');
});

test('payouts reduce equity and can put a trailing account at risk', () => {
  const s = computeLiquidation(
    acct({ ...STATIC, drawdownType: 'trailing-eod', lockProfit: null }, [
      trade('2026-01-02', 3000),
    ], {
      balanceAdjustments: [
        { id: 'p1', date: '2026-01-03', amount: -2500, type: 'payout', createdAt: '' },
      ],
    }),
    { today: '2026-01-03' },
  );
  assert.equal(s.balance, 50500);
  assert.equal(s.threshold, 51000, 'threshold followed the pre-payout peak');
  assert.ok(s.cushion < 0, 'withdrawing into the buffer kills the account');
  assert.equal(s.status, 'breached');
});

test('status thresholds track the share of buffer left', () => {
  const at = (pnl) =>
    computeLiquidation(acct(STATIC, [trade('2026-01-02', pnl)]), { today: '2026-01-02' })
      .status;
  assert.equal(at(0), 'safe');
  assert.equal(at(-1200), 'caution');
  assert.equal(at(-1700), 'danger');
  assert.equal(at(-2000), 'breached');
});

test('roomToStop is clamped at zero once breached', () => {
  const s = computeLiquidation(acct(STATIC, [trade('2026-01-02', -3000)]), {
    today: '2026-01-02',
  });
  assert.ok(s.cushion < 0);
  assert.equal(s.roomToStop, 0);
  assert.equal(s.lossesSurvived, 0);
  assert.equal(liquidationHeadline(s), 'Account is past its threshold.');
});

test('broker names resolve to real firms with the right drawdown style', () => {
  const apex = resolveFirm({ broker: 'Apex Trader Funding', startingBalance: 100000, balance: 0 });
  assert.equal(apex.firm.id, 'apex');
  assert.equal(apex.firm.drawdownType, 'trailing-intraday');
  assert.equal(apex.tier.accountSize, 100000, 'tier picked by account size');

  const top = resolveFirm({ broker: 'Topstep', startingBalance: 50000, balance: 0 });
  assert.equal(top.firm.id, 'topstep');
  assert.equal(top.firm.drawdownType, 'trailing-eod');

  assert.equal(resolveFirm({ broker: '', startingBalance: 50000, balance: 0 }), null);
  assert.equal(resolveFirm({ broker: 'Schwab', startingBalance: 50000, balance: 0 }), null);
});

test('no rules means no clock, rather than a confidently wrong one', () => {
  const bare = {
    id: 'b', name: 'x', broker: 'Schwab', balance: 1000, lastUpdate: null,
    type: 'manual', status: 'active', createdAt: '', importHistory: [], trades: [],
  };
  assert.equal(computeLiquidation(bare), null);
});

test('dollars convert to points per contract', () => {
  assert.equal(dollarsToPoints(1000, 'MNQ', 1), 500);
  assert.equal(dollarsToPoints(1000, 'MNQ', 5), 100);
  assert.equal(dollarsToPoints(1000, 'ES', 1), 20);
});
