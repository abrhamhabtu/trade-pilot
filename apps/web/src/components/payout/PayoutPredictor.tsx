'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Wallet, ChevronDown, TrendingUp, Shield, Settings2, Calendar, Target, ArrowRight, Copy } from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore } from '@/store/themeStore';
import { useAccountStore, Account } from '@/store/accountStore';
import { Trade } from '@/store/tradingStore';
import { calculateTradeSummaryMetrics } from '@/lib/domain/trading';
import { HelpTooltip } from '@/components/ui/feedback';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropFirmPreset {
  name: string;
  accountSize: number;
  profitTargetPercent: number;
  consistencyPercent: number;
  firstPayoutPercent: number;
  splitPercent: number;
  maxDrawdownPercent: number;
  defaultAccountCost: number;
}

interface SimulatedDay {
  day: number;
  result: 'win' | 'loss';
  pnl: number;
  cumulative: number;
  cushionLeft: number;
  highWaterMark: number;
}

interface RealisticProjection {
  days: SimulatedDay[];
  totalDays: number;
  winDays: number;
  lossDays: number;
  reachedTarget: boolean;
  blownAccount: boolean;
  expectedDailyPnL: number;
  calendarWeeks: number;
  lossStreakToFail: number;
  usedExpectancyEstimate: boolean;
}

interface AccountProgress {
  currentProfit: number;
  effectiveTarget: number;
  gapRemaining: number;
  progressPercent: number;
  highestDay: number;
  tradingDays: number;
  isConsistencyQualified: boolean;
  currentConsistencyPercent: number;
  actualPath: { date: string; amount: number; cumulative: number }[];
}

type NumericValue = number | '';

const COPY_COUNT_KEY = 'tradepilot_payout_copy_count';
const PULL_TARGET_KEY = 'tradepilot_payout_pull_target';
const ACCOUNT_COSTS_KEY = 'tradepilot_payout_account_costs';

// ─── Presets ─────────────────────────────────────────────────────────────────

const PROP_FIRM_PRESETS: PropFirmPreset[] = [
  { name: 'TopOne Futures - $50K Ignite', accountSize: 50000, profitTargetPercent: 5, consistencyPercent: 15, firstPayoutPercent: 2, splitPercent: 90, maxDrawdownPercent: 4, defaultAccountCost: 55 },
  { name: 'TopOne Futures - $100K Ignite', accountSize: 100000, profitTargetPercent: 5, consistencyPercent: 15, firstPayoutPercent: 2, splitPercent: 90, maxDrawdownPercent: 4, defaultAccountCost: 110 },
  { name: 'TopOne Futures - $150K Ignite', accountSize: 150000, profitTargetPercent: 5, consistencyPercent: 15, firstPayoutPercent: 2, splitPercent: 90, maxDrawdownPercent: 4, defaultAccountCost: 165 },
  { name: 'Lucid Trading - $50K', accountSize: 50000, profitTargetPercent: 8, consistencyPercent: 20, firstPayoutPercent: 4, splitPercent: 85, maxDrawdownPercent: 8, defaultAccountCost: 110 },
  { name: 'Lucid Trading - $100K', accountSize: 100000, profitTargetPercent: 8, consistencyPercent: 20, firstPayoutPercent: 4, splitPercent: 85, maxDrawdownPercent: 8, defaultAccountCost: 220 },
  { name: 'Topstep - $50K', accountSize: 50000, profitTargetPercent: 6, consistencyPercent: 20, firstPayoutPercent: 3, splitPercent: 90, maxDrawdownPercent: 5, defaultAccountCost: 165 },
  { name: 'Topstep - $100K', accountSize: 100000, profitTargetPercent: 6, consistencyPercent: 20, firstPayoutPercent: 3, splitPercent: 90, maxDrawdownPercent: 5, defaultAccountCost: 325 },
  { name: 'Apex - $50K', accountSize: 50000, profitTargetPercent: 6, consistencyPercent: 30, firstPayoutPercent: 3, splitPercent: 100, maxDrawdownPercent: 5, defaultAccountCost: 85 },
  { name: 'My Funded Futures - $50K', accountSize: 50000, profitTargetPercent: 8, consistencyPercent: 25, firstPayoutPercent: 4, splitPercent: 80, maxDrawdownPercent: 10, defaultAccountCost: 100 },
  { name: 'Custom', accountSize: 50000, profitTargetPercent: 5, consistencyPercent: 15, firstPayoutPercent: 2, splitPercent: 90, maxDrawdownPercent: 4, defaultAccountCost: 0 },
];

const TRADING_DAYS_PER_WEEK = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const parseNumberInput = (value: string): NumericValue =>
  value === '' ? '' : Number(value);

const numericValue = (value: NumericValue, fallback = 0) =>
  value === '' || Number.isNaN(Number(value)) ? fallback : Number(value);

const buildDailyPnL = (trades: Trade[]): Record<string, number> =>
  trades.reduce((acc, trade) => {
    const date = trade.date ? trade.date.split('T')[0] : 'unknown';
    acc[date] = (acc[date] || 0) + trade.netPL;
    return acc;
  }, {} as Record<string, number>);

const getLastPayoutDate = (account?: Account | null): string | null => {
  if (!account?.balanceAdjustments?.length) return null;
  const payouts = account.balanceAdjustments
    .filter((adj) => adj.type === 'payout')
    .sort((a, b) => b.date.localeCompare(a.date));
  return payouts.length > 0 ? payouts[0].date : null;
};

const getTradesAfterPayout = (account: Account): Trade[] => {
  const lastPayoutDate = getLastPayoutDate(account);
  if (!lastPayoutDate) return account.trades;
  return account.trades.filter((trade) => {
    const tradeDate = trade.date ? trade.date.split('T')[0] : '';
    return tradeDate > lastPayoutDate;
  });
};

const findPresetForAccount = (account: Account): PropFirmPreset | null =>
  PROP_FIRM_PRESETS.find(
    (preset) =>
      preset.name !== 'Custom' &&
      (account.broker.toLowerCase().includes(preset.name.split(' - ')[0].toLowerCase()) ||
        account.name.toLowerCase().includes(preset.name.toLowerCase()))
  ) ?? null;

const computeDrawdownFromPreset = (accountSize: number, preset: PropFirmPreset) =>
  Math.round(accountSize * (preset.maxDrawdownPercent / 100));

const computeAccountProgress = (
  currentProfit: number,
  profitTargetDollars: number,
  consistencyPercent: number,
  dailyPnL: Record<string, number>
): AccountProgress => {
  const dailyProfits = Object.values(dailyPnL);
  const highestDay = dailyProfits.length > 0 ? Math.max(0, ...dailyProfits) : 0;
  const tradingDays = Object.keys(dailyPnL).filter((date) => date !== 'unknown').length;
  const requiredFromConsistency =
    highestDay > 0 ? highestDay / (consistencyPercent / 100) : 0;
  const effectiveTarget = Math.max(profitTargetDollars, requiredFromConsistency);
  const currentConsistencyPercent =
    currentProfit > 0 ? (highestDay / currentProfit) * 100 : 0;

  const actualPath = Object.entries(dailyPnL)
    .filter(([date]) => date !== 'unknown')
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<{ date: string; amount: number; cumulative: number }[]>((path, [date, amount]) => {
      const prev = path.length > 0 ? path[path.length - 1].cumulative : 0;
      path.push({ date, amount, cumulative: prev + amount });
      return path;
    }, []);

  return {
    currentProfit,
    effectiveTarget,
    gapRemaining: Math.max(0, effectiveTarget - currentProfit),
    progressPercent:
      effectiveTarget > 0 ? Math.min(100, (currentProfit / effectiveTarget) * 100) : 0,
    highestDay,
    tradingDays,
    isConsistencyQualified:
      currentProfit === 0 || currentConsistencyPercent <= consistencyPercent,
    currentConsistencyPercent,
    actualPath,
  };
};

/** Simulate trading days with wins/losses spread by win rate until payout or blow-up. */
const simulateRealisticPath = (params: {
  startProfit: number;
  target: number;
  dailyCap: number;
  drawdownLimit: number;
  riskPerTrade: number;
  rewardToRisk: number;
  tradesPerDay: number;
  winRatePercent: number;
  consistencyPercent: number;
  highestDaySoFar: number;
  maxDays?: number;
}): RealisticProjection => {
  const {
    startProfit,
    target: initialTarget,
    dailyCap,
    drawdownLimit,
    riskPerTrade,
    rewardToRisk,
    tradesPerDay,
    winRatePercent,
    consistencyPercent,
    highestDaySoFar,
    maxDays = 120,
  } = params;

  const winRate = Math.min(Math.max(winRatePercent, 1), 99) / 100;
  const winDayPnL = Math.min(riskPerTrade * rewardToRisk * tradesPerDay, dailyCap);
  const lossDayPnL = -riskPerTrade * tradesPerDay;
  const expectedDailyPnL = winRate * winDayPnL + (1 - winRate) * lossDayPnL;
  const lossStreakToFail =
    lossDayPnL < 0 ? Math.ceil(drawdownLimit / Math.abs(lossDayPnL)) : maxDays;

  let cumulative = startProfit;
  let highWaterMark = startProfit;
  let highestDay = highestDaySoFar;
  let effectiveTarget = initialTarget;
  const days: SimulatedDay[] = [];

  const pushDay = (day: number, isWin: boolean, pnl: number) => {
    cumulative += pnl;
    if (cumulative > highWaterMark) highWaterMark = cumulative;

    if (isWin && pnl > highestDay) {
      highestDay = pnl;
      const consistencyFloor = highestDay / (consistencyPercent / 100);
      effectiveTarget = Math.max(initialTarget, consistencyFloor);
    }

    const drawdownFloor = highWaterMark - drawdownLimit;
    const cushionLeft = cumulative - drawdownFloor;

    days.push({
      day,
      result: isWin ? 'win' : 'loss',
      pnl,
      cumulative,
      cushionLeft,
      highWaterMark,
    });

    return cushionLeft;
  };

  for (let day = 1; day <= maxDays; day++) {
    const winsSoFar = Math.floor(day * winRate);
    const winsBefore = Math.floor((day - 1) * winRate);
    const isWin = winsSoFar > winsBefore;
    const pnl = isWin ? winDayPnL : lossDayPnL;
    const cushionLeft = pushDay(day, isWin, pnl);

    // Trailing drawdown: fail only when profit falls $drawdownLimit below peak
    if (cushionLeft < 0) {
      const winDays = days.filter((d) => d.result === 'win').length;
      const lossDays = days.filter((d) => d.result === 'loss').length;
      return {
        days,
        totalDays: day,
        winDays,
        lossDays,
        reachedTarget: false,
        blownAccount: true,
        expectedDailyPnL,
        calendarWeeks: Math.ceil((day / TRADING_DAYS_PER_WEEK) * 10) / 10,
        lossStreakToFail,
        usedExpectancyEstimate: false,
      };
    }

    if (cumulative >= effectiveTarget) {
      const winDays = days.filter((d) => d.result === 'win').length;
      const lossDays = days.filter((d) => d.result === 'loss').length;
      return {
        days,
        totalDays: day,
        winDays,
        lossDays,
        reachedTarget: true,
        blownAccount: false,
        expectedDailyPnL,
        calendarWeeks: Math.ceil((day / TRADING_DAYS_PER_WEEK) * 10) / 10,
        lossStreakToFail,
        usedExpectancyEstimate: false,
      };
    }
  }

  const winDays = days.filter((d) => d.result === 'win').length;
  const lossDays = days.filter((d) => d.result === 'loss').length;
  const remaining = Math.max(0, effectiveTarget - cumulative);
  const estimatedDays =
    expectedDailyPnL > 0
      ? Math.ceil(remaining / expectedDailyPnL) + days.length
      : maxDays;

  return {
    days,
    totalDays: estimatedDays,
    winDays,
    lossDays,
    reachedTarget: false,
    blownAccount: false,
    expectedDailyPnL,
    calendarWeeks: Math.ceil((estimatedDays / TRADING_DAYS_PER_WEEK) * 10) / 10,
    lossStreakToFail,
    usedExpectancyEstimate: expectedDailyPnL > 0,
  };
};

const loadStoredNumber = (key: string, fallback: number) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
  } catch {
    // ignore
  }
  return fallback;
};

const loadAccountCosts = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACCOUNT_COSTS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
    // ignore
  }
  return {};
};

const getAccountCostForPreset = (preset: PropFirmPreset): number => {
  const stored = loadAccountCosts()[preset.name];
  return stored ?? preset.defaultAccountCost;
};

const clampCopyAccountCount = (value: number) =>
  Math.min(50, Math.max(1, Math.round(value) || 1));

// ─── UI primitives ───────────────────────────────────────────────────────────

const LabelWithTip: React.FC<{ label: string; tip?: string; className?: string }> = ({
  label,
  tip,
  className,
}) => (
  <span className={clsx('inline-flex items-center gap-1', className)}>
    {label}
    {tip && <HelpTooltip content={tip} />}
  </span>
);

const SliderField: React.FC<{
  label: string;
  tip?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}> = ({ label, tip, value, min, max, step, format, onChange }) => {
  const { theme } = useThemeStore();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <LabelWithTip
          label={label}
          tip={tip}
          className={clsx(
            'text-sm font-medium',
            theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
          )}
        />
        <span className="text-sm font-semibold text-tp-green">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-tp-green"
      />
    </div>
  );
};

const Stat: React.FC<{
  label: string;
  tip?: string;
  value: string;
  hint?: string;
  accent?: 'green' | 'red' | 'blue' | 'yellow';
}> = ({ label, tip, value, hint, accent }) => {
  const { theme } = useThemeStore();
  const accentClass = {
    green: 'text-tp-green',
    red: 'text-tp-red',
    blue: 'text-tp-blue',
    yellow: 'text-tp-yellow',
  }[accent ?? 'green'];

  return (
    <div>
      <LabelWithTip
        label={label}
        tip={tip}
        className={clsx('text-xs', theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}
      />
      <div className={clsx('mt-0.5 text-lg font-semibold', accent ? accentClass : theme === 'dark' ? 'text-zinc-100' : 'text-gray-900')}>
        {value}
      </div>
      {hint && (
        <div className={clsx('mt-0.5 text-xs', theme === 'dark' ? 'text-zinc-600' : 'text-gray-400')}>
          {hint}
        </div>
      )}
    </div>
  );
};

const MiniStat: React.FC<{ label: string; tip?: string; value: string; sub?: string }> = ({
  label,
  tip,
  value,
  sub,
}) => {
  const { theme } = useThemeStore();
  return (
    <div className={clsx('rounded-xl border p-3', theme === 'dark' ? 'border-white/[0.06] bg-tp-base/50' : 'border-gray-100 bg-gray-50')}>
      <LabelWithTip
        label={label}
        tip={tip}
        className={clsx('text-[10px] font-medium uppercase tracking-wide', theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}
      />
      <div className={clsx('mt-1 text-base font-semibold', theme === 'dark' ? 'text-zinc-100' : 'text-gray-900')}>
        {value}
      </div>
      {sub && <div className={clsx('mt-0.5 text-xs', theme === 'dark' ? 'text-zinc-600' : 'text-gray-400')}>{sub}</div>}
    </div>
  );
};

// ─── Main ────────────────────────────────────────────────────────────────────

export const PayoutPredictor: React.FC = () => {
  const { theme } = useThemeStore();
  const { showAllAccounts, getSelectedAccount, initializeFromIDB } = useAccountStore();
  const selectedAccount = getSelectedAccount();
  const hasLinkedAccount = Boolean(selectedAccount && !showAllAccounts);

  useEffect(() => {
    initializeFromIDB();
  }, [initializeFromIDB]);

  const [selectedPreset, setSelectedPreset] = useState(PROP_FIRM_PRESETS[0]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showFirmRules, setShowFirmRules] = useState(false);
  const [copyAccountCount, setCopyAccountCount] = useState(3);
  const [pullTarget, setPullTarget] = useState<NumericValue>(2000);
  const [accountCost, setAccountCost] = useState<NumericValue>(55);
  const [copyPrefsLoaded, setCopyPrefsLoaded] = useState(false);

  const [accountSize, setAccountSize] = useState<NumericValue>(50000);
  const [profitTargetPercent, setProfitTargetPercent] = useState<NumericValue>(5);
  const [consistencyPercent, setConsistencyPercent] = useState<NumericValue>(15);
  const [firstPayoutPercent, setFirstPayoutPercent] = useState<NumericValue>(2);
  const [splitPercent, setSplitPercent] = useState<NumericValue>(90);
  const [drawdownLimit, setDrawdownLimit] = useState<NumericValue>(() =>
    computeDrawdownFromPreset(PROP_FIRM_PRESETS[0].accountSize, PROP_FIRM_PRESETS[0])
  );
  const [riskPerTrade, setRiskPerTrade] = useState<NumericValue>(250);
  const [tradesPerDay, setTradesPerDay] = useState<NumericValue>(2);
  const [winRatePercent, setWinRatePercent] = useState<NumericValue>(45);
  const [rewardToRisk, setRewardToRisk] = useState<NumericValue>(1.5);

  useEffect(() => {
    setCopyAccountCount(clampCopyAccountCount(loadStoredNumber(COPY_COUNT_KEY, 3)));
    setPullTarget(loadStoredNumber(PULL_TARGET_KEY, 2000));
    setAccountCost(getAccountCostForPreset(PROP_FIRM_PRESETS[0]));
    setCopyPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!copyPrefsLoaded) return;
    localStorage.setItem(COPY_COUNT_KEY, String(copyAccountCount));
    localStorage.setItem(PULL_TARGET_KEY, String(numericValue(pullTarget, 2000)));
    const costs = loadAccountCosts();
    costs[selectedPreset.name] = numericValue(accountCost, 0);
    localStorage.setItem(ACCOUNT_COSTS_KEY, JSON.stringify(costs));
  }, [copyAccountCount, pullTarget, accountCost, selectedPreset.name, copyPrefsLoaded]);

  const setCopyCount = useCallback((value: number) => {
    setCopyAccountCount(clampCopyAccountCount(value));
  }, []);

  const accountTrades = useMemo(
    () => (hasLinkedAccount && selectedAccount ? getTradesAfterPayout(selectedAccount) : []),
    [hasLinkedAccount, selectedAccount]
  );

  const tradeMetrics = useMemo(
    () => calculateTradeSummaryMetrics(accountTrades),
    [accountTrades]
  );

  useEffect(() => {
    if (!hasLinkedAccount || !selectedAccount) return;

    const matchedPreset = findPresetForAccount(selectedAccount) ?? PROP_FIRM_PRESETS[0];
    const accountSizeValue =
      selectedAccount.startingBalance && selectedAccount.startingBalance > 0
        ? selectedAccount.startingBalance
        : matchedPreset.accountSize;
    const profitTargetDollars =
      selectedAccount.originalProfitTarget || selectedAccount.profitTarget;
    const profitTargetPercentValue = profitTargetDollars
      ? Math.round((profitTargetDollars / accountSizeValue) * 1000) / 10
      : matchedPreset.profitTargetPercent;

    setSelectedPreset(matchedPreset);
    setAccountSize(accountSizeValue);
    setProfitTargetPercent(profitTargetPercentValue);
    setConsistencyPercent(
      selectedAccount.consistencyRulePercentage ?? matchedPreset.consistencyPercent
    );
    setFirstPayoutPercent(matchedPreset.firstPayoutPercent);
    setSplitPercent(matchedPreset.splitPercent);
    setDrawdownLimit(computeDrawdownFromPreset(accountSizeValue, matchedPreset));
    setAccountCost(getAccountCostForPreset(matchedPreset));

    if (accountTrades.length > 0) {
      const metrics = calculateTradeSummaryMetrics(accountTrades);
      const tradingDays = new Set(
        accountTrades.map((t) => (t.date ? t.date.split('T')[0] : 'unknown'))
      );
      const tpd =
        tradingDays.size > 0
          ? Math.max(1, Math.round((accountTrades.length / tradingDays.size) * 10) / 10)
          : 0;

      if (metrics.winRate > 0) setWinRatePercent(Math.round(metrics.winRate));
      if (metrics.avgRiskReward > 0) setRewardToRisk(Math.round(metrics.avgRiskReward * 10) / 10);
      if (metrics.avgLoss > 0) setRiskPerTrade(Math.round(metrics.avgLoss));
      if (tpd > 0) setTradesPerDay(tpd);
    }
  }, [hasLinkedAccount, selectedAccount, accountTrades]);

  const accountSizeValue = numericValue(accountSize);
  const profitTargetPercentValue = numericValue(profitTargetPercent);
  const consistencyPercentValue = numericValue(consistencyPercent);
  const firstPayoutPercentValue = numericValue(firstPayoutPercent);
  const splitPercentValue = numericValue(splitPercent);
  const drawdownLimitValue = numericValue(drawdownLimit);
  const riskPerTradeValue = numericValue(riskPerTrade);
  const tradesPerDayValue = numericValue(tradesPerDay, 1);
  const winRatePercentValue = numericValue(winRatePercent);
  const rewardToRiskValue = numericValue(rewardToRisk, 1);
  const pullTargetValue = numericValue(pullTarget, 2000);
  const accountCostValue = numericValue(accountCost, 0);

  const profitTarget = accountSizeValue * (profitTargetPercentValue / 100);
  const dailyCap = profitTarget * (consistencyPercentValue / 100);
  const firstPayoutAmount = accountSizeValue * (firstPayoutPercentValue / 100);
  const traderKeeps = firstPayoutAmount * (splitPercentValue / 100);

  const profitTargetDollars = useMemo(() => {
    if (hasLinkedAccount && selectedAccount?.profitTarget) {
      return selectedAccount.originalProfitTarget || selectedAccount.profitTarget;
    }
    return profitTarget;
  }, [hasLinkedAccount, profitTarget, selectedAccount]);

  const accountProgress = useMemo(() => {
    if (!hasLinkedAccount || !selectedAccount) return null;
    const dailyPnL = buildDailyPnL(accountTrades);
    const currentProfit = Math.max(0, accountTrades.reduce((s, t) => s + t.netPL, 0));
    return computeAccountProgress(
      currentProfit,
      profitTargetDollars,
      consistencyPercentValue,
      dailyPnL
    );
  }, [accountTrades, consistencyPercentValue, hasLinkedAccount, profitTargetDollars, selectedAccount]);

  const startProfit = accountProgress?.currentProfit ?? 0;
  const target = accountProgress?.effectiveTarget ?? profitTarget;
  const highestDaySoFar = accountProgress?.highestDay ?? 0;

  const projection = useMemo(
    () =>
      simulateRealisticPath({
        startProfit,
        target,
        dailyCap,
        drawdownLimit: drawdownLimitValue,
        riskPerTrade: riskPerTradeValue,
        rewardToRisk: rewardToRiskValue,
        tradesPerDay: tradesPerDayValue,
        winRatePercent: winRatePercentValue,
        consistencyPercent: consistencyPercentValue,
        highestDaySoFar,
      }),
    [
      startProfit,
      target,
      dailyCap,
      drawdownLimitValue,
      riskPerTradeValue,
      rewardToRiskValue,
      tradesPerDayValue,
      winRatePercentValue,
      consistencyPercentValue,
      highestDaySoFar,
    ]
  );

  const progressPercent = accountProgress?.progressPercent ?? 0;
  const gapRemaining = accountProgress?.gapRemaining ?? Math.max(0, target - startProfit);
  const previewDays = projection.days.slice(0, 28);
  const detailDays = projection.days.slice(0, 8);

  const winDayPnL = Math.min(
    riskPerTradeValue * rewardToRiskValue * tradesPerDayValue,
    dailyCap
  );
  const lossDayPnL = -riskPerTradeValue * tradesPerDayValue;
  const idealDaysRemaining =
    dailyCap > 0 ? Math.ceil(gapRemaining / dailyCap) : 0;
  const idealDaysTotal =
    dailyCap > 0 ? Math.ceil(profitTarget / dailyCap) : 0;
  const projectedWinDays = projection.reachedTarget || !projection.usedExpectancyEstimate
    ? projection.winDays
    : Math.round(projection.totalDays * (winRatePercentValue / 100));
  const projectedLossDays = projection.reachedTarget || !projection.usedExpectancyEstimate
    ? projection.lossDays
    : projection.totalDays - projectedWinDays;

  /** Fresh mirrored accounts — all start at $0, same trades, hit pull target on each */
  const copyPlan = useMemo(() => {
    const perAccountKeep = pullTargetValue * (splitPercentValue / 100);
    const totalPull = perAccountKeep * copyAccountCount;
    const planProjection = simulateRealisticPath({
      startProfit: 0,
      target: pullTargetValue,
      dailyCap,
      drawdownLimit: drawdownLimitValue,
      riskPerTrade: riskPerTradeValue,
      rewardToRisk: rewardToRiskValue,
      tradesPerDay: tradesPerDayValue,
      winRatePercent: winRatePercentValue,
      consistencyPercent: consistencyPercentValue,
      highestDaySoFar: 0,
    });
    const planWinDays =
      planProjection.reachedTarget || !planProjection.usedExpectancyEstimate
        ? planProjection.winDays
        : Math.round(planProjection.totalDays * (winRatePercentValue / 100));
    const planLossDays =
      planProjection.reachedTarget || !planProjection.usedExpectancyEstimate
        ? planProjection.lossDays
        : planProjection.totalDays - planWinDays;

    const totalCost = accountCostValue * copyAccountCount;
    const netProfit = totalPull - totalCost;
    const roiPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return {
      perAccountKeep,
      totalPull,
      totalCost,
      netProfit,
      roiPercent,
      projection: planProjection,
      planWinDays,
      planLossDays,
    };
  }, [
    copyAccountCount,
    pullTargetValue,
    splitPercentValue,
    accountCostValue,
    dailyCap,
    drawdownLimitValue,
    riskPerTradeValue,
    rewardToRiskValue,
    tradesPerDayValue,
    winRatePercentValue,
    consistencyPercentValue,
  ]);

  const handlePresetChange = useCallback((preset: PropFirmPreset) => {
    setSelectedPreset(preset);
    setAccountSize(preset.accountSize);
    setProfitTargetPercent(preset.profitTargetPercent);
    setConsistencyPercent(preset.consistencyPercent);
    setFirstPayoutPercent(preset.firstPayoutPercent);
    setSplitPercent(preset.splitPercent);
    setDrawdownLimit(computeDrawdownFromPreset(preset.accountSize, preset));
    setAccountCost(getAccountCostForPreset(preset));
    setShowPresetDropdown(false);
  }, []);

  const cardClass = clsx(
    'rounded-2xl border',
    theme === 'dark' ? 'bg-tp-card border-white/[0.06]' : 'bg-white border-gray-200'
  );

  const muted = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';
  const text = theme === 'dark' ? 'text-zinc-100' : 'text-gray-900';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className={clsx('flex items-center gap-2 text-2xl font-bold', text)}>
          <Wallet className="h-6 w-6 text-tp-green" />
          Payout Predictor
        </h1>
        <p className={clsx('mt-1 text-sm', muted)}>
          Plan copy-traded accounts and see when you can pull profit.
        </p>
        {hasLinkedAccount && selectedAccount && (
          <span className="mt-2 inline-block rounded-full bg-tp-green/10 px-3 py-1 text-xs font-medium text-tp-green">
            {selectedAccount.name}
          </span>
        )}
      </div>

      {/* Copy trade planner */}
      <div className={clsx(cardClass, 'overflow-hidden p-6 sm:p-8')}>
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-tp-blue" />
          <h2 className={clsx('text-sm font-semibold', text)}>Copy trade planner</h2>
        </div>
        <p className={clsx('mt-1 text-sm', muted)}>
          {selectedPreset.name} · same trades on {copyAccountCount} account
          {copyAccountCount !== 1 ? 's' : ''} — pull {formatCurrency(pullTargetValue)} each
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div>
            <label className={clsx('mb-2 block text-xs font-medium uppercase tracking-wide', muted)}>
              Accounts copy traded
            </label>
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              value={copyAccountCount}
              onChange={(e) => setCopyCount(Number(e.target.value))}
              className={clsx(
                'w-full rounded-xl border px-4 py-2.5 text-lg font-semibold',
                theme === 'dark'
                  ? 'border-white/[0.08] bg-tp-base text-zinc-100'
                  : 'border-gray-200 bg-gray-50 text-gray-900'
              )}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCopyCount(n)}
                  className={clsx(
                    'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
                    copyAccountCount === n
                      ? 'border-tp-green/40 bg-tp-green/15 text-tp-green'
                      : theme === 'dark'
                        ? 'border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={clsx('mb-2 block text-xs font-medium uppercase tracking-wide', muted)}>
              Profit target to pull (each)
            </label>
            <input
              type="number"
              min={500}
              step={100}
              value={pullTarget}
              onChange={(e) => setPullTarget(parseNumberInput(e.target.value))}
              className={clsx(
                'w-full rounded-xl border px-4 py-2.5 text-lg font-semibold',
                theme === 'dark'
                  ? 'border-white/[0.08] bg-tp-base text-zinc-100'
                  : 'border-gray-200 bg-gray-50 text-gray-900'
              )}
            />
            <p className={clsx('mt-1 text-xs', muted)}>
              Target {formatCurrency(profitTarget)} · DD {formatCurrency(drawdownLimitValue)}
            </p>
          </div>
          <div>
            <label className={clsx('mb-2 block text-xs font-medium uppercase tracking-wide', muted)}>
              Cost per account
            </label>
            <input
              type="number"
              min={0}
              step={5}
              value={accountCost}
              onChange={(e) => setAccountCost(parseNumberInput(e.target.value))}
              className={clsx(
                'w-full rounded-xl border px-4 py-2.5 text-lg font-semibold',
                theme === 'dark'
                  ? 'border-white/[0.08] bg-tp-base text-zinc-100'
                  : 'border-gray-200 bg-gray-50 text-gray-900'
              )}
            />
            <p className={clsx('mt-1 text-xs', muted)}>
              Eval / activation for {selectedPreset.name.split(' - ')[0]}
              {selectedPreset.defaultAccountCost > 0 && (
                <span> · default {formatCurrency(selectedPreset.defaultAccountCost)}</span>
              )}
            </p>
          </div>
        </div>

        {copyPlan.projection.expectedDailyPnL <= 0 ? (
          <p className={clsx('mt-5 text-sm text-tp-red')}>
            Strategy doesn&apos;t have positive expectancy — copy trading {copyAccountCount} accounts
            won&apos;t reach {formatCurrency(pullTargetValue)} reliably.
          </p>
        ) : copyPlan.projection.blownAccount ? (
          <p className={clsx('mt-5 text-sm text-tp-red')}>
            Risk is too high — a mirrored account hits {formatCurrency(drawdownLimitValue)} trailing
            drawdown before reaching {formatCurrency(pullTargetValue)}. Lower risk per trade.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <p className={clsx('text-sm font-medium', muted)}>Time to pull on each account</p>
                <p className={clsx('mt-1 text-4xl font-bold tracking-tight', text)}>
                  ~{copyPlan.projection.totalDays}
                  <span className="ml-2 text-xl font-semibold text-zinc-500">trading days</span>
                </p>
                <p className={clsx('mt-2 text-sm', muted)}>
                  {copyPlan.planWinDays} wins · {copyPlan.planLossDays} losses · ~
                  {copyPlan.projection.calendarWeeks} weeks per account
                </p>
              </div>
              <div
                className={clsx(
                  'rounded-xl border p-4',
                  theme === 'dark'
                    ? 'border-tp-green/25 bg-tp-green/5'
                    : 'border-green-200 bg-green-50'
                )}
              >
                <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>
                  Total you pull
                </p>
                <p className="mt-1 text-3xl font-bold text-tp-green">
                  {formatCurrency(copyPlan.totalPull)}
                </p>
                <p className={clsx('mt-1 text-sm', muted)}>
                  {copyAccountCount} accounts × {formatCurrency(copyPlan.perAccountKeep)} keep
                </p>
                {copyPlan.totalCost > 0 && (
                  <p className={clsx('mt-2 text-sm', muted)}>
                    Spend {formatCurrency(copyPlan.totalCost)} → net{' '}
                    <span className={clsx('font-semibold', copyPlan.netProfit >= 0 ? 'text-tp-green' : 'text-tp-red')}>
                      {formatCurrency(copyPlan.netProfit)}
                    </span>
                    {copyPlan.roiPercent !== 0 && (
                      <span> ({copyPlan.roiPercent >= 0 ? '+' : ''}{copyPlan.roiPercent.toFixed(0)}% ROI)</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <MiniStat
                label="Total spend"
                tip="Upfront eval or activation fees for all accounts.\n\nAccount count × cost per account."
                value={formatCurrency(copyPlan.totalCost)}
                sub={`${copyAccountCount} × ${formatCurrency(accountCostValue)}`}
              />
              <MiniStat
                label="Net profit"
                tip="What you keep after paying for accounts.\n\nGross pull − total spend."
                value={formatCurrency(copyPlan.netProfit)}
                sub="after account costs"
              />
              <MiniStat
                label="Per account"
                tip="Your take from one account after the firm's profit split.\n\nPull target × split %."
                value={formatCurrency(copyPlan.perAccountKeep)}
                sub="after split"
              />
              <MiniStat
                label="Gross pull"
                tip="Total payout across all accounts before subtracting eval costs.\n\nPer-account keep × account count."
                value={formatCurrency(copyPlan.totalPull)}
                sub={`${copyAccountCount}× mirrored`}
              />
              <MiniStat
                label="Expected / day"
                tip="Average profit per trading day on one account.\n\n(win% × win day $) + (loss% × loss day $)\n\nUsed to estimate timeline when wins and losses mix."
                value={formatCurrency(copyPlan.projection.expectedDailyPnL)}
                sub="per account"
              />
              <MiniStat
                label="Calendar"
                tip="Weeks until all accounts finish, assuming ~5 trading days per week.\n\nCopy accounts hit target on the same day."
                value={`~${copyPlan.projection.calendarWeeks} wks`}
                sub="all finish together"
              />
            </div>

            <p className={clsx('mt-4 text-xs leading-relaxed', muted)}>
              Assumes fresh accounts starting at $0, identical copy trades, trailing{' '}
              {formatCurrency(drawdownLimitValue)} drawdown, and {formatCurrency(dailyCap)} daily cap.
              All accounts follow the same win/loss path — you pull once each hits{' '}
              {formatCurrency(pullTargetValue)}.
            </p>
          </>
        )}
      </div>

      {/* Hero — active account detail */}
      <div className={clsx(cardClass, 'p-6 sm:p-8')}>
        {projection.expectedDailyPnL <= 0 ? (
          <div>
            <p className={clsx('text-lg font-semibold text-tp-red')}>
              Negative expectancy at these settings
            </p>
            <p className={clsx('mt-1 text-sm', muted)}>
              Your win rate and R:R don&apos;t cover losses. Adjust risk or improve stats before
              payout is reachable.
            </p>
          </div>
        ) : projection.blownAccount ? (
          <div>
            <p className={clsx('text-lg font-semibold text-tp-red')}>
              Trailing drawdown breached
            </p>
            <p className={clsx('mt-1 text-sm', muted)}>
              Profit fell {formatCurrency(drawdownLimitValue)} below your peak after{' '}
              {projection.totalDays} trading days ({projection.winDays}W / {projection.lossDays}L).
              Lower risk or avoid extended drawdowns from your high.
            </p>
          </div>
        ) : (
          <>
            <p className={clsx('text-sm font-medium', muted)}>Estimated time to payout</p>
            <p className={clsx('mt-1 text-4xl font-bold tracking-tight sm:text-5xl', text)}>
              ~{projection.totalDays}
              <span className="ml-2 text-2xl font-semibold text-zinc-500">trading days</span>
            </p>
            <p className={clsx('mt-2 text-sm', muted)}>
              {projection.reachedTarget
                ? `${projection.winDays} winning · ${projection.lossDays} losing`
                : `${Math.round(winRatePercentValue)}% win rate · ${formatCurrency(projection.expectedDailyPnL)}/day avg`}
              {' · ~'}
              {projection.calendarWeeks} weeks · {formatCurrency(gapRemaining)} still needed
            </p>
            {projection.usedExpectancyEstimate && (
              <p className={clsx('mt-1 text-xs', muted)}>
                Based on expected daily P&L with trailing {formatCurrency(drawdownLimitValue)} drawdown
              </p>
            )}

            {/* Quick economics */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat
                label="Gap left"
                tip="Profit still needed to hit your effective target.\n\nAdjusted for consistency rules on linked accounts."
                value={formatCurrency(gapRemaining)}
              />
              <MiniStat
                label="Win day"
                tip="Expected P&L on a winning day.\n\nCapped by the firm's daily consistency limit."
                value={`+${formatCurrency(winDayPnL)}`}
                sub="capped by consistency"
              />
              <MiniStat
                label="Loss day"
                tip="Expected P&L on a losing day.\n\nAssumes full planned risk × trades per day."
                value={formatCurrency(lossDayPnL)}
                sub="full planned risk"
              />
              <MiniStat
                label="Ideal pace"
                tip="Trading days needed if every day hits the max daily cap.\n\nFastest possible path — rarely happens in practice."
                value={`${idealDaysRemaining} days`}
                sub="if every day hits cap"
              />
            </div>
          </>
        )}

        {/* Progress */}
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className={muted}>
              {formatCurrency(startProfit)} of {formatCurrency(target)}
            </span>
            <span className="font-medium text-tp-green">{progressPercent.toFixed(0)}%</span>
          </div>
          <div
            className={clsx(
              'h-2 overflow-hidden rounded-full',
              theme === 'dark' ? 'bg-white/[0.06]' : 'bg-gray-100'
            )}
          >
            <div
              className="h-full rounded-full bg-tp-green transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Day timeline */}
        {projection.expectedDailyPnL > 0 && previewDays.length > 0 && (
          <div className="mt-6">
            <p className={clsx('mb-3 text-xs font-medium uppercase tracking-wide', muted)}>
              Projected path
            </p>
            <div className="flex flex-wrap gap-1.5">
              {previewDays.map((day) => (
                <div
                  key={day.day}
                  title={`Day ${day.day}: ${day.result} ${formatCurrency(day.pnl)} → ${formatCurrency(day.cumulative)}`}
                  className={clsx(
                    'h-8 w-8 rounded-md transition-transform hover:scale-110',
                    day.result === 'win'
                      ? 'bg-tp-green/25 ring-1 ring-tp-green/40'
                      : 'bg-tp-red/20 ring-1 ring-tp-red/30'
                  )}
                />
              ))}
              {projection.days.length > previewDays.length && (
                <div
                  className={clsx(
                    'flex h-8 items-center px-2 text-xs',
                    muted
                  )}
                >
                  +{projection.days.length - previewDays.length} more
                </div>
              )}
            </div>
            <div className="mt-2 flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-tp-green/40" /> Win day
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-tp-red/30" /> Loss day
              </span>
            </div>

            {/* First week detail */}
            {detailDays.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <p className={clsx('mb-2 text-xs font-medium uppercase tracking-wide', muted)}>
                  Day-by-day (first {detailDays.length})
                </p>
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className={clsx('border-b text-left text-xs', theme === 'dark' ? 'border-white/[0.06] text-zinc-500' : 'border-gray-200 text-gray-500')}>
                      <th className="pb-2 pr-4 font-medium">Day</th>
                      <th className="pb-2 pr-4 font-medium">Result</th>
                      <th className="pb-2 pr-4 font-medium">P&L</th>
                      <th className="pb-2 font-medium">Running total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailDays.map((day) => (
                      <tr key={day.day} className={clsx('border-b last:border-0', theme === 'dark' ? 'border-white/[0.04]' : 'border-gray-100')}>
                        <td className={clsx('py-2 pr-4', muted)}>{day.day}</td>
                        <td className="py-2 pr-4">
                          <span className={clsx('rounded px-1.5 py-0.5 text-xs font-medium', day.result === 'win' ? 'bg-tp-green/15 text-tp-green' : 'bg-tp-red/15 text-tp-red')}>
                            {day.result}
                          </span>
                        </td>
                        <td className={clsx('py-2 pr-4 font-medium', day.pnl >= 0 ? 'text-tp-green' : 'text-tp-red')}>
                          {day.pnl >= 0 ? '+' : ''}{formatCurrency(day.pnl)}
                        </td>
                        <td className={clsx('py-2 font-medium', text)}>{formatCurrency(day.cumulative)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scenario comparison */}
      {projection.expectedDailyPnL > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: 'Best case',
              tip: 'Fastest timeline if every trading day hits the daily consistency cap.\n\nOptimistic upper bound — not typical.',
              days: idealDaysRemaining || idealDaysTotal,
              detail: 'Every day hits the daily cap',
              tone: 'green' as const,
            },
            {
              label: 'Realistic',
              tip: 'Simulated path mixing win and loss days at your win rate.\n\nUses trailing drawdown from your profit peak.',
              days: projection.totalDays,
              detail: `${projectedWinDays}W · ${projectedLossDays}L at ${winRatePercentValue}% win rate`,
              tone: 'blue' as const,
            },
            {
              label: 'Stress test',
              tip: 'Consecutive losing days from your profit peak before trailing drawdown fails you.\n\nShows worst-case streak, not a full mixed path.',
              days: projection.lossStreakToFail,
              detail: `Consecutive loss days from peak to breach ${formatCurrency(drawdownLimitValue)} trail`,
              tone: 'red' as const,
            },
          ].map((scenario) => (
            <div
              key={scenario.label}
              className={clsx(
                cardClass,
                'p-4',
                scenario.tone === 'green' && 'border-tp-green/20',
                scenario.tone === 'blue' && 'border-tp-blue/20',
                scenario.tone === 'red' && 'border-tp-red/20'
              )}
            >
              <LabelWithTip
                label={scenario.label}
                tip={scenario.tip}
                className={clsx('text-xs font-medium uppercase tracking-wide', muted)}
              />
              <div className={clsx('mt-1 text-2xl font-bold', text)}>
                {scenario.days}
                <span className="ml-1 text-sm font-normal text-zinc-500">days</span>
              </div>
              <p className={clsx('mt-1 text-xs leading-relaxed', muted)}>{scenario.detail}</p>
            </div>
          ))}
        </div>
      )}

      {/* Your actual history */}
      {hasLinkedAccount && accountProgress && accountProgress.actualPath.length > 0 && (
        <div className={clsx(cardClass, 'p-5')}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-tp-blue" />
              <h2 className={clsx('text-sm font-semibold', text)}>Your history</h2>
            </div>
            <span className={clsx('text-xs', muted)}>
              {accountProgress.tradingDays} days · {accountProgress.currentConsistencyPercent.toFixed(0)}% consistency
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {accountProgress.actualPath.map((day) => (
              <div
                key={day.date}
                className={clsx(
                  'rounded-lg border px-3 py-2 text-center min-w-[4.5rem]',
                  day.amount >= 0
                    ? 'border-tp-green/20 bg-tp-green/5'
                    : 'border-tp-red/20 bg-tp-red/5'
                )}
              >
                <div className={clsx('text-[10px] font-medium', muted)}>{day.date.slice(5)}</div>
                <div className={clsx('text-sm font-semibold', day.amount >= 0 ? 'text-tp-green' : 'text-tp-red')}>
                  {day.amount >= 0 ? '+' : ''}{formatCurrency(day.amount)}
                </div>
                <div className={clsx('text-[10px]', muted)}>{formatCurrency(day.cumulative)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payout breakdown */}
      <div className={clsx(cardClass, 'p-5')}>
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-tp-green" />
          <h2 className={clsx('text-sm font-semibold', text)}>Payout breakdown</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Profit target"
            tip="Total profit required on the account before you're eligible for payout."
            value={formatCurrency(profitTarget)}
            hint={`${profitTargetPercentValue}% of account`}
          />
          <Stat
            label="Daily cap"
            tip="Max profit allowed in a single day under the consistency rule.\n\nOften = target × consistency %."
            value={formatCurrency(dailyCap)}
            hint={`${consistencyPercentValue}% consistency rule`}
            accent="yellow"
          />
          <Stat
            label="First payout"
            tip="Maximum you can withdraw on your first payout request."
            value={formatCurrency(firstPayoutAmount)}
            hint={`${firstPayoutPercentValue}% withdrawable`}
            accent="blue"
          />
          <Stat
            label="You keep"
            tip="Your share after the firm's profit split."
            value={formatCurrency(traderKeeps)}
            hint={`${splitPercentValue}% profit split`}
            accent="green"
          />
        </div>
        <div className={clsx('mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border p-4 text-sm', theme === 'dark' ? 'border-white/[0.06] bg-tp-base/50' : 'border-gray-100 bg-gray-50')}>
          <span className={muted}>{formatCurrency(profitTarget)} target</span>
          <span className={muted}>×</span>
          <span className={muted}>{consistencyPercentValue}%</span>
          <ArrowRight className={clsx('h-3.5 w-3.5', muted)} />
          <span className="font-semibold text-tp-green">{formatCurrency(dailyCap)} daily max</span>
        </div>
      </div>

      {/* Settings + summary */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Assumptions */}
        <div className={clsx(cardClass, 'space-y-5 p-5 lg:col-span-3')}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-tp-green" />
            <h2 className={clsx('text-sm font-semibold', text)}>Your assumptions</h2>
            {tradeMetrics.totalTrades > 0 && (
              <span className={clsx('text-xs', muted)}>
                · from {tradeMetrics.totalTrades} trades
              </span>
            )}
          </div>

          <div>
            <label className={clsx('mb-2 block text-sm font-medium', muted)}>Prop firm</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                className={clsx(
                  'flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm',
                  theme === 'dark'
                    ? 'border-white/[0.08] bg-tp-base text-zinc-100'
                    : 'border-gray-200 bg-gray-50 text-gray-900'
                )}
              >
                <span className="truncate">{selectedPreset.name}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </button>
              {showPresetDropdown && (
                <div
                  className={clsx(
                    'absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border shadow-xl',
                    theme === 'dark'
                      ? 'border-white/[0.08] bg-tp-raised'
                      : 'border-gray-200 bg-white'
                  )}
                >
                  {PROP_FIRM_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handlePresetChange(preset)}
                      className={clsx(
                        'w-full px-4 py-2.5 text-left text-sm hover:bg-white/[0.04]',
                        selectedPreset.name === preset.name && 'text-tp-green'
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SliderField
            label="Win rate"
            tip="Percentage of trading days you expect to be green."
            value={winRatePercentValue}
            min={20}
            max={80}
            step={1}
            format={(v) => `${v}%`}
            onChange={setWinRatePercent}
          />
          <SliderField
            label="Reward : Risk"
            tip="Average winner size vs average loser.\n\n2R means wins are 2× your risk per trade."
            value={rewardToRiskValue}
            min={0.5}
            max={4}
            step={0.1}
            format={(v) => `${v.toFixed(1)}R`}
            onChange={setRewardToRisk}
          />
          <SliderField
            label="Risk per trade"
            tip="Dollars you risk on each trade.\n\nDrives both win-day and loss-day P&L."
            value={riskPerTradeValue}
            min={25}
            max={Math.max(500, drawdownLimitValue / 2)}
            step={25}
            format={formatCurrency}
            onChange={setRiskPerTrade}
          />
          <SliderField
            label="Trades per day"
            tip="How many trades you take per session.\n\nMultiplies daily win and loss amounts."
            value={tradesPerDayValue}
            min={1}
            max={10}
            step={0.5}
            format={(v) => `${v}`}
            onChange={setTradesPerDay}
          />

          <button
            type="button"
            onClick={() => setShowFirmRules(!showFirmRules)}
            className={clsx(
              'flex w-full items-center gap-2 text-sm font-medium',
              muted
            )}
          >
            <Settings2 className="h-4 w-4" />
            Firm rules
            <ChevronDown
              className={clsx('ml-auto h-4 w-4 transition-transform', showFirmRules && 'rotate-180')}
            />
          </button>

          {showFirmRules && (
            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
              {[
                { label: 'Account', value: accountSize, set: setAccountSize, suffix: '' },
                { label: 'Target %', value: profitTargetPercent, set: setProfitTargetPercent, suffix: '%' },
                { label: 'Consistency', value: consistencyPercent, set: setConsistencyPercent, suffix: '%' },
                { label: 'Drawdown', value: drawdownLimit, set: setDrawdownLimit, suffix: '' },
                { label: 'Split', value: splitPercent, set: setSplitPercent, suffix: '%' },
              ].map(({ label, value, set, suffix }) => (
                <div key={label}>
                  <label className={clsx('mb-1 block text-xs', muted)}>{label}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => set(parseNumberInput(e.target.value))}
                    className={clsx(
                      'w-full rounded-lg border px-3 py-2 text-sm',
                      theme === 'dark'
                        ? 'border-white/[0.08] bg-tp-base text-zinc-100'
                        : 'border-gray-200 bg-gray-50'
                    )}
                  />
                  {suffix && (
                    <span className={clsx('text-xs', muted)}>{suffix}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* At a glance */}
        <div className={clsx(cardClass, 'space-y-5 p-5 lg:col-span-2')}>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-tp-blue" />
            <h2 className={clsx('text-sm font-semibold', text)}>At a glance</h2>
          </div>

          <Stat
            label="Daily cap"
            tip="Max profit allowed in a single day under the consistency rule."
            value={formatCurrency(dailyCap)}
            hint="Max per day for consistency"
            accent="yellow"
          />
          <Stat
            label="Expected / day"
            tip="Average profit per trading day on one account.\n\n(win% × win day $) + (loss% × loss day $)"
            value={formatCurrency(projection.expectedDailyPnL)}
            hint={`${winRatePercentValue}% win · ${100 - winRatePercentValue}% loss`}
            accent="blue"
          />
          <Stat
            label="Drawdown buffer"
            tip="Trailing room below your profit peak.\n\nFall this far from your high and the account fails."
            value={formatCurrency(drawdownLimitValue)}
            hint={`${selectedPreset.maxDrawdownPercent}% of account`}
          />
          <Stat
            label="You keep"
            tip="Your share after the firm's profit split."
            value={formatCurrency(traderKeeps)}
            hint={`${splitPercentValue}% of first payout`}
            accent="green"
          />
          <Stat
            label="Loss streak limit"
            tip="Consecutive losing days from your peak before trailing drawdown is breached.\n\nWins in between push the peak up."
            value={`${projection.lossStreakToFail} days`}
            hint="Consecutive red days from peak"
            accent="red"
          />
          <Stat
            label="Ideal timeline"
            tip="Trading days if every day hits the daily cap.\n\nBest-case scenario."
            value={`${idealDaysRemaining || idealDaysTotal} days`}
            hint="If every day hits the cap"
          />

          {accountProgress && !accountProgress.isConsistencyQualified && (
            <p className="rounded-lg bg-tp-yellow/10 px-3 py-2 text-xs text-tp-yellow">
              Consistency rule is tightening your target. Best day was{' '}
              {formatCurrency(accountProgress.highestDay)}.
            </p>
          )}

          {projection.expectedDailyPnL > 0 && !projection.blownAccount && (
            <p className={clsx('text-xs leading-relaxed', muted)}>
              Uses trailing drawdown: you only fail if profit drops {formatCurrency(drawdownLimitValue)}{' '}
              below your peak. Wins push that floor up — mixed W/L days don&apos;t automatically fail you.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
