'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp, Route, Calculator, Layers, Building2, ShieldCheck, ShieldAlert, Swords } from 'lucide-react';
import clsx from 'clsx';
import { useAccountStore, Account } from '@/store/accountStore';
import { Trade } from '@/store/tradingStore';
import { calculateTradeSummaryMetrics } from '@/lib/domain/trading';

import { PROP_FIRMS, getFirmById, FirmAccountTier } from './propFirmData';
import {
  simulatePath,
  consistencyDailyCeiling,
  consistencyScore as calcConsistencyScore,
  profitNeededForConsistency,
  riskPerTradeFor,
  buildDailyPnL,
} from './payoutMath';
import { FirmConfigPanel, FirmConfigValues } from './FirmConfigPanel';
import { EdgeTracker, EdgeData } from './EdgeTracker';
import { AccountScaler } from './AccountScaler';
import { MicroSizingPlanner, MicroPlanState } from './MicroSizingPlanner';
import { EvalVsFunded } from './EvalVsFunded';
import { MotivationStrip } from './MotivationStrip';
import { useThemeClasses, SectionHeader, SliderField } from './payoutPrimitives';

const STORAGE_KEY = 'tradepilot_payout_config_v2';

interface StrategyState {
  winRatePercent: number;
  rewardToRisk: number;
  tradesPerDay: number;
}

interface PersistedConfig {
  firmId: string;
  tierId: string;
  overrides: Partial<FirmConfigValues>;
  strategy: StrategyState;
  micro: MicroPlanState;
  pullTarget: number;
  focusCount: number;
}

const DEFAULT_STRATEGY: StrategyState = { winRatePercent: 45, rewardToRisk: 1.5, tradesPerDay: 2 };
const DEFAULT_MICRO: MicroPlanState = { symbol: 'MNQ', contracts: 3, stopPts: 30, dailyAim: 300 };

const tierToValues = (firmId: string, tier: FirmAccountTier): FirmConfigValues => {
  const firm = getFirmById(firmId);
  return {
    profitTarget: tier.profitTarget,
    drawdown: tier.drawdown,
    consistencyPercent: firm.consistencyPercent,
    profitSplit: firm.profitSplit,
    keep100Upto: firm.keep100Upto,
    cost: tier.cost,
    dailyLossLimit: tier.dailyLossLimit,
  };
};

const StrategyPanel: React.FC<{
  strategy: StrategyState;
  onChange: (patch: Partial<StrategyState>) => void;
  fromTrades: number;
}> = ({ strategy, onChange, fromTrades }) => {
  const { card, text, muted } = useThemeClasses();
  return (
    <div className={clsx(card, 'p-5')}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-tp-green" />
          <h2 className={clsx('text-sm font-semibold', text)}>Your assumptions</h2>
        </div>
        <p className={clsx('text-xs', muted)}>
          {fromTrades > 0 ? `Auto-filled from your last ${fromTrades} trades · tune to model scenarios` : 'Tune these to drive every projection above'}
        </p>
      </div>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
        <SliderField
          label="Win rate"
          tip="Percentage of trading days you expect to be green."
          value={strategy.winRatePercent}
          min={20}
          max={80}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => onChange({ winRatePercent: v })}
        />
        <SliderField
          label="Reward : Risk"
          tip="Average winner size vs average loser. 2R means wins are 2× your risk."
          value={strategy.rewardToRisk}
          min={0.5}
          max={4}
          step={0.1}
          format={(v) => `${v.toFixed(1)}R`}
          onChange={(v) => onChange({ rewardToRisk: v })}
        />
        <SliderField
          label="Trades per day"
          tip="How many trades you take per session. Multiplies daily win/loss amounts."
          value={strategy.tradesPerDay}
          min={1}
          max={10}
          step={0.5}
          format={(v) => `${v}`}
          onChange={(v) => onChange({ tradesPerDay: v })}
        />
      </div>
    </div>
  );
};

const getLastPayoutDate = (account?: Account | null): string | null => {
  const payouts = account?.balanceAdjustments?.filter((a) => a.type === 'payout') ?? [];
  if (!payouts.length) return null;
  return [...payouts].sort((a, b) => b.date.localeCompare(a.date))[0].date;
};

const tradesAfterPayout = (account: Account): Trade[] => {
  const last = getLastPayoutDate(account);
  if (!last) return account.trades;
  return account.trades.filter((t) => (t.date ? t.date.split('T')[0] : '') > last);
};

type PayoutTab = 'path' | 'sizing' | 'eval' | 'scale' | 'firm';

const TABS: { id: PayoutTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'path', label: 'Path to Payout', icon: Route },
  { id: 'sizing', label: 'Micro Sizing', icon: Calculator },
  { id: 'eval', label: 'Eval vs Funded', icon: Swords },
  { id: 'scale', label: 'Scale Accounts', icon: Layers },
  { id: 'firm', label: 'Firm & Rules', icon: Building2 },
];

interface PayoutPredictorProps {
  initialFirmId?: string;
}

export const PayoutPredictor: React.FC<PayoutPredictorProps> = ({ initialFirmId }) => {
  const { text, muted, card, dark } = useThemeClasses();
  const [tab, setTab] = useState<PayoutTab>('path');
  const { showAllAccounts, getSelectedAccount, initializeFromIDB } = useAccountStore();
  const selectedAccount = getSelectedAccount();
  const hasLinkedAccount = Boolean(selectedAccount && !showAllAccounts);

  useEffect(() => {
    initializeFromIDB();
  }, [initializeFromIDB]);

  const [firmId, setFirmId] = useState(PROP_FIRMS[0].id);
  const [tierId, setTierId] = useState(PROP_FIRMS[0].tiers[0].id);
  const [overrides, setOverrides] = useState<Partial<FirmConfigValues>>({});
  const [strategy, setStrategy] = useState<StrategyState>(DEFAULT_STRATEGY);
  const [micro, setMicro] = useState<MicroPlanState>(DEFAULT_MICRO);
  const [pullTarget, setPullTarget] = useState(2000);
  const [focusCount, setFocusCount] = useState(3);
  const [loaded, setLoaded] = useState(false);

  // Load persisted config; URL ?firm= overrides saved firm on first load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as PersistedConfig;
        if (c.firmId && getFirmById(c.firmId)) setFirmId(c.firmId);
        if (c.tierId) setTierId(c.tierId);
        if (c.overrides) setOverrides(c.overrides);
        if (c.strategy) setStrategy({ ...DEFAULT_STRATEGY, ...c.strategy });
        if (c.micro) setMicro({ ...DEFAULT_MICRO, ...c.micro });
        if (typeof c.pullTarget === 'number') setPullTarget(c.pullTarget);
        if (typeof c.focusCount === 'number') setFocusCount(c.focusCount);
      }
    } catch {
      /* ignore */
    }

    if (initialFirmId && PROP_FIRMS.some((f) => f.id === initialFirmId)) {
      const firmFromUrl = getFirmById(initialFirmId);
      setFirmId(firmFromUrl.id);
      setTierId(firmFromUrl.tiers[0].id);
      setOverrides({});
    }

    setLoaded(true);
  }, [initialFirmId]);

  const firm = useMemo(() => getFirmById(firmId), [firmId]);
  const tier = useMemo(
    () => firm.tiers.find((t) => t.id === tierId) ?? firm.tiers[0],
    [firm, tierId]
  );

  // Persist config
  useEffect(() => {
    if (!loaded) return;
    const payload: PersistedConfig = { firmId, tierId, overrides, strategy, micro, pullTarget, focusCount };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [loaded, firmId, tierId, overrides, strategy, micro, pullTarget, focusCount]);

  // Effective firm config = seeded values + user overrides
  const values: FirmConfigValues = useMemo(
    () => ({ ...tierToValues(firmId, tier), ...overrides }),
    [firmId, tier, overrides]
  );

  const handleFirmChange = useCallback((id: string) => {
    setFirmId(id);
    const f = getFirmById(id);
    setTierId(f.tiers[0].id);
    setOverrides({});
  }, []);

  const handleTierChange = useCallback((id: string) => {
    setTierId(id);
    setOverrides({});
  }, []);

  // Auto-fill strategy from linked account stats once
  useEffect(() => {
    if (!hasLinkedAccount || !selectedAccount) return;
    const trades = tradesAfterPayout(selectedAccount);
    if (trades.length === 0) return;
    const m = calculateTradeSummaryMetrics(trades);
    const days = new Set(trades.map((t) => (t.date ? t.date.split('T')[0] : 'unknown')));
    const tpd = days.size > 0 ? Math.max(1, Math.round((trades.length / days.size) * 10) / 10) : 0;
    setStrategy((s) => ({
      winRatePercent: m.winRate > 0 ? Math.round(m.winRate) : s.winRatePercent,
      rewardToRisk: m.avgRiskReward > 0 ? Math.round(m.avgRiskReward * 10) / 10 : s.rewardToRisk,
      tradesPerDay: tpd > 0 ? tpd : s.tradesPerDay,
    }));
  }, [hasLinkedAccount, selectedAccount]);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const dailyCap = consistencyDailyCeiling(values.profitTarget, values.consistencyPercent);
  const riskPerTrade = riskPerTradeFor(micro.symbol, micro.contracts, micro.stopPts);

  // Linked-account edge
  const edge: EdgeData = useMemo(() => {
    if (hasLinkedAccount && selectedAccount) {
      const trades = tradesAfterPayout(selectedAccount);
      const dailyPnL = buildDailyPnL(trades);
      const profits = Object.values(dailyPnL);
      const currentProfit = Math.max(0, trades.reduce((s, t) => s + t.netPL, 0));
      const bestDay = profits.length ? Math.max(0, ...profits) : 0;
      const consistencyFloor = profitNeededForConsistency(bestDay, values.consistencyPercent);
      const effectiveTarget = Math.max(values.profitTarget, consistencyFloor);
      const tradingDays = Object.keys(dailyPnL).filter((d) => d !== 'unknown').length;
      return {
        currentProfit,
        bestDay,
        effectiveTarget,
        dailyCeiling: dailyCap,
        drawdownLimit: values.drawdown,
        consistencyScore: calcConsistencyScore(bestDay, currentProfit),
        consistencyRule: values.consistencyPercent,
        tradingDays,
        isLinked: true,
      };
    }
    return {
      currentProfit: 0,
      bestDay: 0,
      effectiveTarget: values.profitTarget,
      dailyCeiling: dailyCap,
      drawdownLimit: values.drawdown,
      consistencyScore: 0,
      consistencyRule: values.consistencyPercent,
      tradingDays: 0,
      isLinked: false,
    };
  }, [hasLinkedAccount, selectedAccount, values, dailyCap]);

  const projection = useMemo(
    () =>
      simulatePath({
        startProfit: edge.currentProfit,
        target: edge.effectiveTarget,
        dailyCap,
        drawdownLimit: values.drawdown,
        riskPerTrade,
        rewardToRisk: strategy.rewardToRisk,
        tradesPerDay: strategy.tradesPerDay,
        winRatePercent: strategy.winRatePercent,
        consistencyPercent: values.consistencyPercent,
        highestDaySoFar: edge.bestDay,
      }),
    [edge, dailyCap, values, riskPerTrade, strategy]
  );

  const gap = Math.max(0, edge.effectiveTarget - edge.currentProfit);
  const idealDays = dailyCap > 0 ? Math.ceil(gap / dailyCap) || Math.ceil(values.profitTarget / dailyCap) : 0;

  // ~21 trading days per month — used to turn a monthly eval fee into an all-in cost.
  const monthsToPass = Math.max(1, Math.ceil((projection.totalDays || idealDays || 21) / 21));

  const linkedTradeCount = useMemo(
    () => (hasLinkedAccount && selectedAccount ? tradesAfterPayout(selectedAccount).length : 0),
    [hasLinkedAccount, selectedAccount]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div>
        <h1 className={clsx('flex items-center gap-2 text-2xl font-bold', text)}>
          <Wallet className="h-6 w-6 text-tp-green" />
          Payout Planner
        </h1>
        <p className={clsx('mt-1 text-sm', muted)}>
          Track your edge against the prop firms, scale accounts, and size micros for a safe path to payout.
        </p>
      </div>

      <MotivationStrip />

      {/* Persistent context strip — switch firm/account from any tab; everything below re-syncs instantly */}
      <div className={clsx(card, 'space-y-3 p-4')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tp-green/10">
            <Building2 className="h-4 w-4 text-tp-green" />
          </span>

          {/* Firm quick-switch */}
          <select
            value={firm.id}
            onChange={(e) => handleFirmChange(e.target.value)}
            aria-label="Prop firm"
            className={clsx(
              'max-w-[16rem] rounded-lg border px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-tp-green/40',
              dark ? 'border-white/[0.08] bg-tp-base text-zinc-100' : 'border-gray-200 bg-gray-50 text-gray-900'
            )}
          >
            {PROP_FIRMS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.program}
              </option>
            ))}
          </select>

          {/* Tier quick-switch */}
          <div className="flex flex-wrap gap-1.5">
            {firm.tiers.map((tr) => (
              <button
                key={tr.id}
                type="button"
                onClick={() => handleTierChange(tr.id)}
                className={clsx(
                  'rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                  tr.id === tier.id
                    ? 'border-tp-green/40 bg-tp-green/15 text-tp-green'
                    : dark
                      ? 'border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                {tr.label}
              </button>
            ))}
          </div>

          {firm.verified ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tp-green/10 px-2 py-0.5 text-[10px] font-semibold text-tp-green">
              <ShieldCheck className="h-3 w-3" /> Verified
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tp-yellow/10 px-2 py-0.5 text-[10px] font-semibold text-tp-yellow">
              <ShieldAlert className="h-3 w-3" /> Unverified
            </span>
          )}
          {hasLinkedAccount && selectedAccount && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-tp-blue/10 px-2 py-0.5 text-[10px] font-medium text-tp-blue">
              {selectedAccount.name}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/[0.06] pt-3 sm:grid-cols-4">
          <CtxStat label="Target" value={`$${values.profitTarget.toLocaleString()}`} dark={dark} muted={muted} text={text} />
          <CtxStat label="Drawdown" value={`$${values.drawdown.toLocaleString()}`} dark={dark} muted={muted} text={text} />
          <CtxStat label="Consistency" value={`${values.consistencyPercent}%`} dark={dark} muted={muted} text={text} />
          <CtxStat label={firm.costCadence === 'monthly' ? 'Cost / mo' : 'Cost (1×)'} value={`$${values.cost.toLocaleString()}`} dark={dark} muted={muted} text={text} />
        </div>
      </div>

      {/* Tab nav */}
      <div className={clsx('flex flex-wrap gap-1 rounded-xl border p-1', dark ? 'border-white/[0.06] bg-tp-card' : 'border-gray-200 bg-white')}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                'inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-tp-green/15 text-tp-green'
                  : dark
                    ? 'text-zinc-400 hover:text-zinc-100'
                    : 'text-gray-500 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'path' && (
        <div className="space-y-5">
          <EdgeTracker edge={edge} projection={projection} winRatePercent={strategy.winRatePercent} idealDays={idealDays} />
          <StrategyPanel
            strategy={strategy}
            onChange={(patch) => setStrategy((s) => ({ ...s, ...patch }))}
            fromTrades={linkedTradeCount}
          />
        </div>
      )}

      {tab === 'sizing' && (
        <MicroSizingPlanner
          plan={micro}
          onChange={(patch) => setMicro((m) => ({ ...m, ...patch }))}
          rewardToRisk={strategy.rewardToRisk}
          tradesPerDay={strategy.tradesPerDay}
          winRatePercent={strategy.winRatePercent}
          dailyCap={dailyCap}
          drawdownLimit={values.drawdown}
          gapToGoal={gap > 0 ? gap : values.profitTarget}
          payoutModel={firm.payoutModel}
          programLabel={firm.program}
        />
      )}

      {tab === 'eval' && <EvalVsFunded />}

      {tab === 'scale' && (
        <AccountScaler
          pullTarget={pullTarget}
          onPullTargetChange={setPullTarget}
          costPerAccount={values.cost}
          onCostChange={(v) => setOverrides((o) => ({ ...o, cost: v }))}
          profitSplit={values.profitSplit}
          keep100Upto={values.keep100Upto}
          costCadence={firm.costCadence}
          monthsToPass={monthsToPass}
          focusCount={focusCount}
          onFocusCountChange={setFocusCount}
          projection={projection}
        />
      )}

      {tab === 'firm' && (
        <FirmConfigPanel
          firm={firm}
          tier={tier}
          values={values}
          onFirmChange={handleFirmChange}
          onTierChange={handleTierChange}
          onValueChange={(patch) => setOverrides((o) => ({ ...o, ...patch }))}
        />
      )}
    </div>
  );
};

const CtxStat: React.FC<{ label: string; value: string; dark: boolean; muted: string; text: string }> = ({ label, value, muted, text }) => (
  <div>
    <div className={clsx('text-[10px] font-medium uppercase tracking-wide', muted)}>{label}</div>
    <div className={clsx('mt-0.5 text-sm font-bold', text)}>{value}</div>
  </div>
);

export default PayoutPredictor;
