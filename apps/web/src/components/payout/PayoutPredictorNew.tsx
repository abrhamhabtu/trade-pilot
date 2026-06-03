'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp } from 'lucide-react';
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
  const { card } = useThemeClasses();
  return (
    <div className={clsx(card, 'space-y-5 p-6 sm:p-8')}>
      <SectionHeader
        icon={<TrendingUp className="h-4 w-4 text-tp-green" />}
        title="Your trading assumptions"
        subtitle={
          fromTrades > 0
            ? `Auto-filled from your last ${fromTrades} trades. Adjust to model different scenarios.`
            : 'Set your edge. These drive every projection below.'
        }
      />
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

export const PayoutPredictor: React.FC = () => {
  const { text, muted } = useThemeClasses();
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

  // Load persisted config
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
    setLoaded(true);
  }, []);

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

  const linkedTradeCount = useMemo(
    () => (hasLinkedAccount && selectedAccount ? tradesAfterPayout(selectedAccount).length : 0),
    [hasLinkedAccount, selectedAccount]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className={clsx('flex items-center gap-2 text-2xl font-bold', text)}>
          <Wallet className="h-6 w-6 text-tp-green" />
          Payout Planner
        </h1>
        <p className={clsx('mt-1 text-sm', muted)}>
          Track your edge against the prop firms, scale accounts, and size micros for a safe path to payout.
        </p>
        {hasLinkedAccount && selectedAccount && (
          <span className="mt-2 inline-block rounded-full bg-tp-green/10 px-3 py-1 text-xs font-medium text-tp-green">
            {selectedAccount.name}
          </span>
        )}
      </div>

      <FirmConfigPanel
        firm={firm}
        tier={tier}
        values={values}
        onFirmChange={handleFirmChange}
        onTierChange={handleTierChange}
        onValueChange={(patch) => setOverrides((o) => ({ ...o, ...patch }))}
      />

      <StrategyPanel
        strategy={strategy}
        onChange={(patch) => setStrategy((s) => ({ ...s, ...patch }))}
        fromTrades={linkedTradeCount}
      />

      <EdgeTracker edge={edge} projection={projection} winRatePercent={strategy.winRatePercent} idealDays={idealDays} />

      <MicroSizingPlanner
        plan={micro}
        onChange={(patch) => setMicro((m) => ({ ...m, ...patch }))}
        rewardToRisk={strategy.rewardToRisk}
        tradesPerDay={strategy.tradesPerDay}
        winRatePercent={strategy.winRatePercent}
        dailyCap={dailyCap}
        drawdownLimit={values.drawdown}
        gapToGoal={gap > 0 ? gap : values.profitTarget}
      />

      <AccountScaler
        pullTarget={pullTarget}
        onPullTargetChange={setPullTarget}
        costPerAccount={values.cost}
        onCostChange={(v) => setOverrides((o) => ({ ...o, cost: v }))}
        profitSplit={values.profitSplit}
        keep100Upto={values.keep100Upto}
        focusCount={focusCount}
        onFocusCountChange={setFocusCount}
        projection={projection}
      />
    </div>
  );
};

export default PayoutPredictor;
