'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  Calendar,
  AlertCircle,
  ChevronDown,
  Plus,
  X,
  Copy,
  Check,
  Calculator,
  Target,
  Zap,
} from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore } from '@/store/themeStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PropFirmPreset {
  name: string;
  accountSize: number;
  profitTargetPercent: number;
  consistencyPercent: number;
  firstPayoutPercent: number;
  splitPercent: number;
  dailyLossLimit?: number;
  maxDrawdownPercent: number;
}

interface PayoutScenario {
  id: string;
  name: string;
  accountSize: number;
  profitTarget: number;
  consistencyPercent: number;
  firstPayoutAmount: number;
  splitPercent: number;
  dailyCap: number;
  daysToPayout: number;
  pathToPayout: number[];
  totalProfit: number;
  traderKeeps: number;
}

// ─── Presets ─────────────────────────────────────────────────────────────────

const PROP_FIRM_PRESETS: PropFirmPreset[] = [
  {
    name: 'TopOne Futures - $50K Ignite',
    accountSize: 50000,
    profitTargetPercent: 5,
    consistencyPercent: 15,
    firstPayoutPercent: 2,
    splitPercent: 90,
    maxDrawdownPercent: 6,
  },
  {
    name: 'TopOne Futures - $100K Ignite',
    accountSize: 100000,
    profitTargetPercent: 5,
    consistencyPercent: 15,
    firstPayoutPercent: 2,
    splitPercent: 90,
    maxDrawdownPercent: 6,
  },
  {
    name: 'TopOne Futures - $150K Ignite',
    accountSize: 150000,
    profitTargetPercent: 5,
    consistencyPercent: 15,
    firstPayoutPercent: 2,
    splitPercent: 90,
    maxDrawdownPercent: 6,
  },
  {
    name: 'Lucid Trading - $50K',
    accountSize: 50000,
    profitTargetPercent: 8,
    consistencyPercent: 20,
    firstPayoutPercent: 4,
    splitPercent: 85,
    maxDrawdownPercent: 8,
  },
  {
    name: 'Lucid Trading - $100K',
    accountSize: 100000,
    profitTargetPercent: 8,
    consistencyPercent: 20,
    firstPayoutPercent: 4,
    splitPercent: 85,
    maxDrawdownPercent: 8,
  },
  {
    name: 'Topstep - $50K',
    accountSize: 50000,
    profitTargetPercent: 6,
    consistencyPercent: 20,
    firstPayoutPercent: 3,
    splitPercent: 90,
    maxDrawdownPercent: 5,
  },
  {
    name: 'Topstep - $100K',
    accountSize: 100000,
    profitTargetPercent: 6,
    consistencyPercent: 20,
    firstPayoutPercent: 3,
    splitPercent: 90,
    maxDrawdownPercent: 5,
  },
  {
    name: 'Apex - $50K',
    accountSize: 50000,
    profitTargetPercent: 6,
    consistencyPercent: 30,
    firstPayoutPercent: 3,
    splitPercent: 100,
    maxDrawdownPercent: 5,
  },
  {
    name: 'My Funded Futures - $50K',
    accountSize: 50000,
    profitTargetPercent: 8,
    consistencyPercent: 25,
    firstPayoutPercent: 4,
    splitPercent: 80,
    maxDrawdownPercent: 10,
  },
  {
    name: 'Custom',
    accountSize: 50000,
    profitTargetPercent: 5,
    consistencyPercent: 15,
    firstPayoutPercent: 2,
    splitPercent: 90,
    maxDrawdownPercent: 6,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const calculateScenario = (
  name: string,
  accountSize: number,
  profitTargetPercent: number,
  consistencyPercent: number,
  firstPayoutPercent: number,
  splitPercent: number
): PayoutScenario => {
  const profitTarget = accountSize * (profitTargetPercent / 100);
  const dailyCap = profitTarget * (consistencyPercent / 100);
  const firstPayoutAmount = accountSize * (firstPayoutPercent / 100);
  const daysToPayout = dailyCap > 0 ? Math.ceil(profitTarget / dailyCap) : 0;

  const pathToPayout: number[] = [];
  let remaining = profitTarget;
  for (let i = 0; i < daysToPayout; i++) {
    const dayProfit = Math.min(dailyCap, remaining);
    pathToPayout.push(dayProfit);
    remaining -= dayProfit;
  }

  const totalProfit = firstPayoutAmount;
  const traderKeeps = totalProfit * (splitPercent / 100);

  return {
    id: Math.random().toString(36).slice(2, 9),
    name,
    accountSize,
    profitTarget,
    consistencyPercent,
    firstPayoutAmount,
    splitPercent,
    dailyCap,
    daysToPayout,
    pathToPayout,
    totalProfit,
    traderKeeps,
  };
};

// ─── Components ──────────────────────────────────────────────────────────────

const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}> = ({ children, className, noPadding }) => {
  const { theme } = useThemeStore();
  return (
    <div
      className={clsx(
        'rounded-xl border transition-all',
        theme === 'dark'
          ? 'bg-tp-card border-white/[0.06]'
          : 'bg-white border-gray-200',
        !noPadding && 'p-6',
        className
      )}
    >
      {children}
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useThemeStore();
  return (
    <label
      className={clsx(
        'block text-sm font-medium mb-2',
        theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
      )}
    >
      {children}
    </label>
  );
};

const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { suffix?: string }
> = ({ className, suffix, ...props }) => {
  const { theme } = useThemeStore();
  return (
    <div className="relative">
      <input
        {...props}
        className={clsx(
          'w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-tp-green/40 transition-all text-sm',
          theme === 'dark'
            ? 'bg-tp-base border-white/[0.08] text-zinc-100 placeholder-zinc-500'
            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400',
          className
        )}
      />
      {suffix && (
        <span
          className={clsx(
            'absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium',
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
          )}
        >
          {suffix}
        </span>
      )}
    </div>
  );
};

const MetricBox: React.FC<{
  label: string;
  value: string;
  accent?: 'green' | 'blue' | 'yellow';
  icon?: React.ReactNode;
}> = ({ label, value, accent = 'green', icon }) => {
  const { theme } = useThemeStore();
  const accentMap = {
    green: 'text-tp-green',
    blue: 'text-tp-blue',
    yellow: 'text-tp-yellow',
  };
  return (
    <div
      className={clsx(
        'rounded-xl border p-4 flex flex-col',
        theme === 'dark'
          ? 'bg-tp-base border-white/[0.06]'
          : 'bg-gray-50 border-gray-200'
      )}
    >
      <span
        className={clsx(
          'text-xs font-medium uppercase tracking-wider mb-1',
          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
        )}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        {icon}
        <span className={clsx('text-xl font-bold', accentMap[accent])}>
          {value}
        </span>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const PayoutPredictor: React.FC = () => {
  const { theme } = useThemeStore();

  // Form state
  const [selectedPreset, setSelectedPreset] = useState<PropFirmPreset>(
    PROP_FIRM_PRESETS[0]
  );
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  const [accountSize, setAccountSize] = useState(50000);
  const [profitTargetPercent, setProfitTargetPercent] = useState(5);
  const [consistencyPercent, setConsistencyPercent] = useState(15);
  const [firstPayoutPercent, setFirstPayoutPercent] = useState(2);
  const [splitPercent, setSplitPercent] = useState(90);

  // Comparison state
  const [scenarios, setScenarios] = useState<PayoutScenario[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeScenario = useMemo(
    () =>
      calculateScenario(
        selectedPreset.name === 'Custom' ? 'Custom' : selectedPreset.name,
        accountSize,
        profitTargetPercent,
        consistencyPercent,
        firstPayoutPercent,
        splitPercent
      ),
    [accountSize, profitTargetPercent, consistencyPercent, firstPayoutPercent, splitPercent, selectedPreset.name]
  );

  const handlePresetChange = useCallback((preset: PropFirmPreset) => {
    setSelectedPreset(preset);
    setAccountSize(preset.accountSize);
    setProfitTargetPercent(preset.profitTargetPercent);
    setConsistencyPercent(preset.consistencyPercent);
    setFirstPayoutPercent(preset.firstPayoutPercent);
    setSplitPercent(preset.splitPercent);
    setShowPresetDropdown(false);
  }, []);

  const addToComparison = useCallback(() => {
    setScenarios((prev) => {
      if (prev.find((s) => s.name === activeScenario.name)) return prev;
      return [...prev, activeScenario];
    });
  }, [activeScenario]);

  const removeScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearComparison = useCallback(() => setScenarios([]), []);

  const copyScenario = useCallback(
    (scenario: PayoutScenario) => {
      const text = `${scenario.name}
Account: ${formatCurrency(scenario.accountSize)}
Profit Target: ${formatCurrency(scenario.profitTarget)} (${formatPercent((scenario.profitTarget / scenario.accountSize) * 100)})
Daily Cap: ${formatCurrency(scenario.dailyCap)} (${formatPercent(scenario.consistencyPercent)} consistency)
Days to Payout: ${scenario.daysToPayout}
First Payout: ${formatCurrency(scenario.firstPayoutAmount)}
Split: ${scenario.splitPercent}% / ${100 - scenario.splitPercent}%
Trader Keeps: ${formatCurrency(scenario.traderKeeps)}`;
      navigator.clipboard.writeText(text);
      setCopiedId(scenario.id);
      setTimeout(() => setCopiedId(null), 2000);
    },
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className={clsx(
              'text-2xl font-bold flex items-center gap-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
            )}
          >
            <Wallet className="h-6 w-6 text-tp-green" />
            Payout Predictor
          </h1>
          <p
            className={clsx(
              'text-sm mt-1',
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
            )}
          >
            Calculate your path to prop firm payout based on account size,
            profit target, and consistency rules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left Column - Controls */}
        <div className="space-y-4 xl:col-span-1">
          {/* Preset Selector */}
          <Card>
            <Label>Prop Firm Preset</Label>
            <div className="relative">
              <button
                onClick={() => setShowPresetDropdown(!showPresetDropdown)}
                className={clsx(
                  'w-full px-4 py-2.5 rounded-lg border text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-tp-green/40 transition-all text-sm',
                  theme === 'dark'
                    ? 'bg-tp-base border-white/[0.08] text-zinc-100'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                )}
              >
                <span className="truncate">{selectedPreset.name}</span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </button>

              {showPresetDropdown && (
                <div
                  className={clsx(
                    'absolute z-20 w-full mt-1 rounded-lg border shadow-xl max-h-60 overflow-y-auto',
                    theme === 'dark'
                      ? 'bg-tp-raised border-white/[0.08]'
                      : 'bg-white border-gray-200'
                  )}
                >
                  {PROP_FIRM_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handlePresetChange(preset)}
                      className={clsx(
                        'w-full px-4 py-2.5 text-left text-sm transition-colors',
                        theme === 'dark'
                          ? 'text-zinc-100 hover:bg-tp-card'
                          : 'text-gray-900 hover:bg-gray-100',
                        selectedPreset.name === preset.name &&
                          (theme === 'dark'
                            ? 'bg-tp-green/15 text-tp-green'
                            : 'bg-green-50 text-green-700')
                      )}
                    >
                      <div className="font-medium">{preset.name}</div>
                      <div
                        className={clsx(
                          'text-xs mt-0.5',
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}
                      >
                        {formatCurrency(preset.accountSize)} |{' '}
                        {preset.profitTargetPercent}% target |{' '}
                        {preset.splitPercent}% split
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Inputs */}
          <Card>
            <div className="space-y-4">
              <div>
                <Label>Account Size</Label>
                <Input
                  type="number"
                  value={accountSize}
                  onChange={(e) => setAccountSize(Number(e.target.value))}
                  min={1000}
                  step={1000}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Profit Target</Label>
                  <Input
                    type="number"
                    value={profitTargetPercent}
                    onChange={(e) =>
                      setProfitTargetPercent(Number(e.target.value))
                    }
                    min={0.1}
                    max={50}
                    step={0.5}
                    suffix="%"
                  />
                </div>
                <div>
                  <Label>Consistency</Label>
                  <Input
                    type="number"
                    value={consistencyPercent}
                    onChange={(e) =>
                      setConsistencyPercent(Number(e.target.value))
                    }
                    min={1}
                    max={100}
                    step={1}
                    suffix="%"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Payout</Label>
                  <Input
                    type="number"
                    value={firstPayoutPercent}
                    onChange={(e) =>
                      setFirstPayoutPercent(Number(e.target.value))
                    }
                    min={0.1}
                    max={50}
                    step={0.5}
                    suffix="%"
                  />
                </div>
                <div>
                  <Label>Split (You / Firm)</Label>
                  <Input
                    type="number"
                    value={splitPercent}
                    onChange={(e) => setSplitPercent(Number(e.target.value))}
                    min={50}
                    max={100}
                    step={5}
                    suffix="%"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Info */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-tp-blue/10 flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-tp-blue" />
              </div>
              <div>
                <h4
                  className={clsx(
                    'text-sm font-semibold',
                    theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'
                  )}
                >
                  Consistency Rule Explained
                </h4>
                <p
                  className={clsx(
                    'text-xs mt-1 leading-relaxed',
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                  )}
                >
                  Your best trading day must stay under the consistency
                  percentage of your profit target. This prevents
                  &quot;all-in&quot; gambles and proves sustainable trading.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-4 xl:col-span-2">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricBox
              label="Profit Target"
              value={formatCurrency(activeScenario.profitTarget)}
              accent="blue"
              icon={<Target className="h-4 w-4 text-tp-blue" />}
            />
            <MetricBox
              label="Daily Cap"
              value={formatCurrency(activeScenario.dailyCap)}
              accent="yellow"
              icon={<Zap className="h-4 w-4 text-tp-yellow" />}
            />
            <MetricBox
              label="Days to Payout"
              value={`${activeScenario.daysToPayout}`}
              accent="green"
              icon={<Calendar className="h-4 w-4 text-tp-green" />}
            />
            <MetricBox
              label="You Keep"
              value={formatCurrency(activeScenario.traderKeeps)}
              accent="green"
              icon={<TrendingUp className="h-4 w-4 text-tp-green" />}
            />
          </div>

          {/* Calculation Breakdown */}
          <Card>
            <h3
              className={clsx(
                'text-sm font-semibold mb-4 flex items-center gap-2',
                theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'
              )}
            >
              <Calculator className="h-4 w-4 text-tp-green" />
              Why ${formatCurrency(activeScenario.dailyCap).replace('$', '')}
            </h3>

            <div
              className={clsx(
                'rounded-xl border p-5 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6',
                theme === 'dark'
                  ? 'bg-tp-base border-white/[0.06]'
                  : 'bg-gray-50 border-gray-200'
              )}
            >
              <div className="text-center">
                <div
                  className={clsx(
                    'text-2xl font-bold',
                    theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                  )}
                >
                  {formatCurrency(activeScenario.profitTarget)}
                </div>
                <div
                  className={clsx(
                    'text-xs uppercase tracking-wider mt-1',
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}
                >
                  Target
                </div>
              </div>

              <div
                className={clsx(
                  'text-xl font-bold',
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                )}
              >
                ×
              </div>

              <div className="text-center">
                <div
                  className={clsx(
                    'text-2xl font-bold',
                    theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                  )}
                >
                  {activeScenario.consistencyPercent}%
                </div>
                <div
                  className={clsx(
                    'text-xs uppercase tracking-wider mt-1',
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}
                >
                  Consistency
                </div>
              </div>

              <div
                className={clsx(
                  'text-xl font-bold',
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                )}
              >
                =
              </div>

              <div className="text-center px-5 py-2 rounded-lg bg-tp-green/10 border border-tp-green/20">
                <div className="text-2xl font-bold text-tp-green">
                  {formatCurrency(activeScenario.dailyCap)}
                </div>
                <div className="text-xs uppercase tracking-wider mt-1 text-tp-green/80">
                  Daily Ceiling
                </div>
              </div>
            </div>

            <p
              className={clsx(
                'text-xs text-center mt-3',
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}
            >
              Trade up to {formatCurrency(activeScenario.dailyCap)} per day.
              Your biggest day must equal {activeScenario.consistencyPercent}%
              of the target for the consistency rule to hold.
            </p>
          </Card>

          {/* Path to Payout */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3
                className={clsx(
                  'text-sm font-semibold flex items-center gap-2',
                  theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'
                )}
              >
                <Calendar className="h-4 w-4 text-tp-green" />
                Path to Payout
              </h3>
              <span
                className={clsx(
                  'text-xs px-2 py-1 rounded-full border',
                  theme === 'dark'
                    ? 'bg-tp-green/10 text-tp-green border-tp-green/20'
                    : 'bg-green-50 text-green-700 border-green-200'
                )}
              >
                {activeScenario.daysToPayout} days
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {activeScenario.pathToPayout.map((amount, idx) => {
                const isLast = idx === activeScenario.pathToPayout.length - 1;
                return (
                  <div
                    key={idx}
                    className={clsx(
                      'rounded-lg border p-3 text-center transition-all',
                      isLast
                        ? theme === 'dark'
                          ? 'bg-tp-green/15 border-tp-green/30'
                          : 'bg-green-50 border-green-300'
                        : theme === 'dark'
                          ? 'bg-tp-base border-white/[0.06]'
                          : 'bg-gray-50 border-gray-200'
                    )}
                  >
                    <div
                      className={clsx(
                        'text-[10px] uppercase tracking-wider font-semibold',
                        isLast
                          ? 'text-tp-green'
                          : theme === 'dark'
                            ? 'text-zinc-500'
                            : 'text-gray-500'
                      )}
                    >
                      Day {idx + 1}
                    </div>
                    <div
                      className={clsx(
                        'text-sm font-bold mt-1',
                        isLast
                          ? 'text-tp-green'
                          : theme === 'dark'
                            ? 'text-zinc-200'
                            : 'text-gray-800'
                      )}
                    >
                      +{formatCurrency(amount)}
                    </div>
                    <div
                      className={clsx(
                        'text-[10px] mt-1',
                        theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                      )}
                    >
                      {((amount / activeScenario.profitTarget) * 100).toFixed(
                        0
                      )}
                      %
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Running Total Bar */}
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs">
                <span
                  className={clsx(
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}
                >
                  Progress to{' '}
                  {formatCurrency(activeScenario.profitTarget)}
                </span>
                <span className="text-tp-green font-semibold">100%</span>
              </div>
              <div
                className={clsx(
                  'h-2.5 rounded-full overflow-hidden',
                  theme === 'dark' ? 'bg-tp-base' : 'bg-gray-200'
                )}
              >
                <div className="h-full rounded-full bg-gradient-to-r from-tp-green to-tp-blue w-full" />
              </div>
            </div>
          </Card>

          {/* First Payout Summary */}
          <Card>
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-tp-green/10 border border-tp-green/20">
                  <Wallet className="h-6 w-6 text-tp-green" />
                </div>
                <div>
                  <h3
                    className={clsx(
                      'text-sm font-semibold',
                      theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'
                    )}
                  >
                    First Payout Summary
                  </h3>
                  <p
                    className={clsx(
                      'text-xs',
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}
                  >
                    {activeScenario.splitPercent}% trader /{' '}
                    {100 - activeScenario.splitPercent}% firm
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div
                    className={clsx(
                      'text-xs uppercase tracking-wider',
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}
                  >
                    Total
                  </div>
                  <div
                    className={clsx(
                      'text-lg font-bold',
                      theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                    )}
                  >
                    {formatCurrency(activeScenario.firstPayoutAmount)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase tracking-wider text-tp-green">
                    You Keep
                  </div>
                  <div className="text-lg font-bold text-tp-green">
                    {formatCurrency(activeScenario.traderKeeps)}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Comparison Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={addToComparison}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                theme === 'dark'
                  ? 'bg-tp-green/10 text-tp-green border-tp-green/20 hover:bg-tp-green/20'
                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              )}
            >
              <Plus className="h-4 w-4" />
              Add to Comparison
            </button>
            {scenarios.length > 0 && (
              <button
                onClick={clearComparison}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all border',
                  theme === 'dark'
                    ? 'text-zinc-400 border-white/[0.06] hover:text-zinc-200 hover:bg-white/[0.04]'
                    : 'text-gray-500 border-gray-200 hover:text-gray-700 hover:bg-gray-100'
                )}
              >
                <X className="h-4 w-4" />
                Clear ({scenarios.length})
              </button>
            )}
          </div>

          {/* Comparison Table */}
          {scenarios.length > 0 && (
            <Card className="overflow-x-auto">
              <h3
                className={clsx(
                  'text-sm font-semibold mb-4',
                  theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'
                )}
              >
                Comparison ({scenarios.length} scenarios)
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className={clsx(
                      'border-b',
                      theme === 'dark'
                        ? 'border-white/[0.06]'
                        : 'border-gray-200'
                    )}
                  >
                    <th className="text-left py-2 pr-4 font-medium text-zinc-500">
                      Firm
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-zinc-500">
                      Account
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-zinc-500">
                      Target
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-zinc-500">
                      Daily Cap
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-zinc-500">
                      Days
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-zinc-500">
                      You Keep
                    </th>
                    <th className="py-2 pl-2 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((scenario) => (
                    <tr
                      key={scenario.id}
                      className={clsx(
                        'border-b last:border-b-0 transition-colors',
                        theme === 'dark'
                          ? 'border-white/[0.04] hover:bg-white/[0.02]'
                          : 'border-gray-100 hover:bg-gray-50'
                      )}
                    >
                      <td
                        className={clsx(
                          'py-3 pr-4 font-medium',
                          theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'
                        )}
                      >
                        {scenario.name}
                      </td>
                      <td
                        className={clsx(
                          'py-3 px-2 text-right',
                          theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                        )}
                      >
                        {formatCurrency(scenario.accountSize)}
                      </td>
                      <td
                        className={clsx(
                          'py-3 px-2 text-right',
                          theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                        )}
                      >
                        {formatCurrency(scenario.profitTarget)}
                      </td>
                      <td
                        className={clsx(
                          'py-3 px-2 text-right',
                          theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                        )}
                      >
                        {formatCurrency(scenario.dailyCap)}
                      </td>
                      <td
                        className={clsx(
                          'py-3 px-2 text-right font-semibold',
                          scenario.daysToPayout <= 5
                            ? 'text-tp-green'
                            : theme === 'dark'
                              ? 'text-zinc-300'
                              : 'text-gray-700'
                        )}
                      >
                        {scenario.daysToPayout}
                      </td>
                      <td
                        className={clsx(
                          'py-3 px-2 text-right font-bold text-tp-green'
                        )}
                      >
                        {formatCurrency(scenario.traderKeeps)}
                      </td>
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => copyScenario(scenario)}
                            className={clsx(
                              'p-1.5 rounded-lg transition-colors',
                              theme === 'dark'
                                ? 'text-zinc-500 hover:text-tp-green hover:bg-tp-green/10'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            )}
                            title="Copy details"
                          >
                            {copiedId === scenario.id ? (
                              <Check className="h-3.5 w-3.5 text-tp-green" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => removeScenario(scenario.id)}
                            className={clsx(
                              'p-1.5 rounded-lg transition-colors',
                              theme === 'dark'
                                ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'
                                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                            )}
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
