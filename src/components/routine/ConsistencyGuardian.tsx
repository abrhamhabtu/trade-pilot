import React, { useState, useMemo } from 'react';
import { useAccountStore, Account } from '../../store/accountStore';
import { useThemeStore } from '../../store/themeStore';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  Target,
  Calculator,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import clsx from 'clsx';

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Account tier configurations
const TIER_CONFIG = {
  instant: { label: 'Instant Funded', defaultRule: 20, color: '#3BF68A' },
  elite: { label: 'Elite Funded', defaultRule: 25, color: '#A78BFA' }
};

interface ConsistencyGuardianProps {
  account: Account;
  actualDailyPnL: Record<string, number>;
  lastPayoutDate?: string | null;
  tradingDaysSincePayout?: number;
}

export const ConsistencyGuardian: React.FC<ConsistencyGuardianProps> = ({
  account,
  actualDailyPnL,
  lastPayoutDate,
  tradingDaysSincePayout = 0
}) => {
  const { updateAccount } = useAccountStore();
  const { theme } = useThemeStore();

  // Local state
  const [whatIfAmount, setWhatIfAmount] = useState(500);
  const [showEducation, setShowEducation] = useState(false);

  // Get account settings with defaults
  const consistencyRule = account.consistencyRulePercentage || 20;
  const originalTarget = account.originalProfitTarget || account.profitTarget || 3000;
  const accountTier = account.accountTier || 'instant';

  // Core consistency calculations - matches Overview tab logic
  const metrics = useMemo(() => {
    const dailyProfits = Object.values(actualDailyPnL);

    // Highest day from ALL days (same as Overview)
    const highestDay = dailyProfits.length > 0 ? Math.max(0, ...dailyProfits) : 0;

    // Find the date of highest day
    let highestDayDate = '';
    Object.entries(actualDailyPnL).forEach(([date, pnl]) => {
      if (pnl === highestDay) {
        highestDayDate = date;
      }
    });

    // Total profit = sum of ALL trades (same as Overview uses calculatedTotalPnL)
    const totalProfit = dailyProfits.reduce((sum, pnl) => sum + pnl, 0);
    const currentTotalProfit = Math.max(0, totalProfit);

    // Current consistency percentage (same formula as Overview)
    const currentConsistencyPercent = currentTotalProfit > 0
      ? (highestDay / currentTotalProfit) * 100
      : 0;

    // Required profit target based on highest day (same as Overview: minimumRequiredProfit)
    const requiredProfitTarget = highestDay / (consistencyRule / 100);

    // Effective target (max of original and required)
    const effectiveTarget = Math.max(originalTarget, requiredProfitTarget);

    // Gap to payout
    const gapToPayout = Math.max(0, effectiveTarget - currentTotalProfit);

    // Is qualified? (same logic as Overview)
    const isQualified = currentConsistencyPercent <= consistencyRule;

    // Safe daily max - max profit today without increasing target
    // This is the amount that would keep highest day as is
    const safeMaxToday = highestDay > 0 ? highestDay - 0.01 : currentTotalProfit * (consistencyRule / 100);

    // Warning threshold (80% of highest day)
    const warningThreshold = highestDay * 0.8;

    return {
      currentTotalProfit,
      highestDay,
      highestDayDate,
      currentConsistencyPercent,
      requiredProfitTarget,
      effectiveTarget,
      gapToPayout,
      isQualified,
      safeMaxToday,
      warningThreshold,
      profitableDaysCount: Object.values(actualDailyPnL).filter(pnl => pnl > 0).length
    };
  }, [actualDailyPnL, consistencyRule, originalTarget]);

  // What-if scenario calculations
  const whatIfScenario = useMemo(() => {
    const newTotalProfit = metrics.currentTotalProfit + whatIfAmount;
    const wouldBecomeHighestDay = whatIfAmount > metrics.highestDay;
    const newHighestDay = wouldBecomeHighestDay ? whatIfAmount : metrics.highestDay;
    const newConsistencyPercent = newTotalProfit > 0 ? (newHighestDay / newTotalProfit) * 100 : 0;
    const newRequiredTarget = newHighestDay / (consistencyRule / 100);
    const wouldIncreaseTarget = newRequiredTarget > metrics.effectiveTarget;
    const newEffectiveTarget = Math.max(originalTarget, newRequiredTarget);
    const newGapToPayout = Math.max(0, newEffectiveTarget - newTotalProfit);

    return {
      newTotalProfit,
      wouldBecomeHighestDay,
      newHighestDay,
      newConsistencyPercent,
      newRequiredTarget,
      wouldIncreaseTarget,
      newEffectiveTarget,
      newGapToPayout,
      targetIncrease: wouldIncreaseTarget ? newEffectiveTarget - metrics.effectiveTarget : 0
    };
  }, [whatIfAmount, metrics, consistencyRule, originalTarget]);

  // Path to payout projections
  const projections = useMemo(() => {
    const rates = [100, 200, 300, 500, 750, 1000];
    return rates.map(dailyRate => {
      const isSafe = dailyRate <= metrics.safeMaxToday;
      const daysNeeded = metrics.gapToPayout > 0 ? Math.ceil(metrics.gapToPayout / dailyRate) : 0;
      return { dailyRate, daysNeeded, isSafe };
    });
  }, [metrics]);

  // Handle account tier change
  const handleTierChange = (tier: 'instant' | 'elite') => {
    const newRule = TIER_CONFIG[tier].defaultRule;
    updateAccount(account.id, {
      accountTier: tier,
      consistencyRulePercentage: newRule
    });
  };

  // Handle original target change
  const handleOriginalTargetChange = (value: number) => {
    updateAccount(account.id, { originalProfitTarget: value });
  };

  // Gauge percentage for visualization
  const gaugePercent = Math.min(100, (metrics.currentConsistencyPercent / consistencyRule) * 100);
  const gaugeColor = gaugePercent <= 70 ? '#3BF68A' : gaugePercent <= 90 ? '#F59E0B' : '#F45B69';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* ACCOUNT CONFIGURATION */}
      <div className={clsx(
        "p-6 rounded-[2rem] border",
        theme === 'dark' ? "bg-[#0D0F12] border-[#1F2937]" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-[#A78BFA]" />
          <h3 className={clsx(
            "text-sm font-bold uppercase tracking-wider",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>Account Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Tier */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em]">
              Account Tier
            </label>
            <div className={clsx(
              "flex p-1.5 rounded-2xl border",
              theme === 'dark' ? "bg-[#0B0D10] border-[#1F2937]" : "bg-gray-50 border-gray-200"
            )}>
              {(['instant', 'elite'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => handleTierChange(tier)}
                  className={clsx(
                    "flex-1 py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all",
                    accountTier === tier
                      ? `text-black shadow-lg scale-[1.02]`
                      : "text-[#6B7280] hover:text-[#9CA3AF]"
                  )}
                  style={{
                    backgroundColor: accountTier === tier ? TIER_CONFIG[tier].color : 'transparent'
                  }}
                >
                  {TIER_CONFIG[tier].label} ({TIER_CONFIG[tier].defaultRule}%)
                </button>
              ))}
            </div>
          </div>

          {/* Original Profit Target */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em]">
              Original Profit Target
            </label>
            <div className="relative">
              <span className={clsx(
                "absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold",
                theme === 'dark' ? "text-[#3BF68A]" : "text-green-600"
              )}>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={originalTarget.toString()}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, '');
                  const value = parseInt(cleaned, 10) || 0;
                  handleOriginalTargetChange(value);
                }}
                className={clsx(
                  "w-full pl-10 pr-4 py-3 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50",
                  theme === 'dark'
                    ? "bg-[#1F2937] text-white border border-[#374151]"
                    : "bg-gray-100 text-gray-900 border border-gray-200"
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* PAYOUT RESET NOTICE */}
      {lastPayoutDate && (
        <div className={clsx(
          "p-4 rounded-2xl border flex items-center gap-4",
          theme === 'dark'
            ? "bg-[#A78BFA]/10 border-[#A78BFA]/30"
            : "bg-purple-50 border-purple-200"
        )}>
          <div className={clsx(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            theme === 'dark' ? "bg-[#A78BFA]/20" : "bg-purple-100"
          )}>
            <RefreshCw className="w-6 h-6 text-[#A78BFA]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-[#A78BFA]" />
              <span className={clsx(
                "text-sm font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Consistency Reset After Payout
              </span>
            </div>
            <p className={clsx(
              "text-xs",
              theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600"
            )}>
              Last payout on {new Date(lastPayoutDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. 
              Consistency tracking restarted with {tradingDaysSincePayout} trading day{tradingDaysSincePayout !== 1 ? 's' : ''} since then.
            </p>
          </div>
        </div>
      )}

      {/* MAIN STATS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: Consistency Gauge & Key Metrics */}
        <div className="lg:col-span-5 space-y-6">

          {/* Consistency Gauge */}
          <div className={clsx(
            "p-8 rounded-[2rem] border relative overflow-hidden",
            theme === 'dark' ? "bg-[#15181F] border-[#1F2937]" : "bg-white border-gray-200"
          )}>
            <div className="absolute -right-10 -top-10 w-40 h-40 blur-[80px] rounded-full opacity-20"
              style={{ backgroundColor: gaugeColor }} />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className={clsx(
                  "text-sm font-bold uppercase tracking-wider",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>Consistency Status</h3>
                <div className={clsx(
                  "px-3 py-1 rounded-full text-xs font-bold",
                  metrics.isQualified
                    ? "bg-[#3BF68A]/20 text-[#3BF68A]"
                    : "bg-[#F45B69]/20 text-[#F45B69]"
                )}>
                  {metrics.isQualified ? 'Qualified' : 'Not Yet'}
                </div>
              </div>

              {/* Arc Gauge */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-48 h-28">
                  <svg className="w-48 h-28" viewBox="0 0 100 60">
                    {/* Background arc */}
                    <path
                      d="M 10 50 A 40 40 0 0 1 90 50"
                      fill="none"
                      stroke={theme === 'dark' ? '#1F2937' : '#E5E7EB'}
                      strokeWidth="8"
                      strokeLinecap="round"
                    />
                    {/* Progress arc */}
                    <path
                      d="M 10 50 A 40 40 0 0 1 90 50"
                      fill="none"
                      stroke={gaugeColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${gaugePercent * 1.26} 126`}
                      className="transition-all duration-1000"
                    />
                    {/* Threshold marker */}
                    <circle cx="90" cy="50" r="3" fill={theme === 'dark' ? '#6B7280' : '#9CA3AF'} />
                  </svg>
                </div>
                {/* Text below the arc */}
                <div className="flex flex-col items-center -mt-8">
                  <span className="text-3xl font-black" style={{ color: gaugeColor }}>
                    {metrics.currentConsistencyPercent.toFixed(1)}%
                  </span>
                  <span className={clsx(
                    "text-[10px] font-bold uppercase tracking-wider",
                    theme === 'dark' ? "text-[#6B7280]" : "text-gray-500"
                  )}>of {consistencyRule}% limit</span>
                </div>
              </div>

              {/* Key Stats */}
              <div className="space-y-3">
                <div className={clsx(
                  "flex justify-between py-2 border-b",
                  theme === 'dark' ? "border-[#1F2937]" : "border-gray-100"
                )}>
                  <span className={clsx("text-sm", theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                    Current Total Profit
                  </span>
                  <span className="text-sm font-bold text-[#3BF68A]">
                    {formatCurrency(metrics.currentTotalProfit)}
                  </span>
                </div>
                <div className={clsx(
                  "flex justify-between py-2 border-b",
                  theme === 'dark' ? "border-[#1F2937]" : "border-gray-100"
                )}>
                  <span className={clsx("text-sm", theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                    Highest Profit Day
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#F59E0B]">
                      {formatCurrency(metrics.highestDay)}
                    </span>
                    {metrics.highestDayDate && (
                      <span className={clsx(
                        "text-[10px] ml-2",
                        theme === 'dark' ? "text-[#6B7280]" : "text-gray-400"
                      )}>
                        ({new Date(metrics.highestDayDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                      </span>
                    )}
                  </div>
                </div>
                <div className={clsx(
                  "flex justify-between py-2 border-b",
                  theme === 'dark' ? "border-[#1F2937]" : "border-gray-100"
                )}>
                  <span className={clsx("text-sm", theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                    Required Profit Target
                  </span>
                  <span className={clsx(
                    "text-sm font-bold",
                    metrics.effectiveTarget > originalTarget ? "text-[#F45B69]" : "text-white"
                  )}>
                    {formatCurrency(metrics.effectiveTarget)}
                    {metrics.effectiveTarget > originalTarget && (
                      <span className="text-[10px] ml-1">↑</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className={clsx("text-sm", theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                    Gap to Payout
                  </span>
                  <span className={clsx(
                    "text-sm font-bold",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {formatCurrency(metrics.gapToPayout)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Daily Guardrails & What-If */}
        <div className="lg:col-span-7 space-y-6">

          {/* DAILY GUARDRAILS - Most Important */}
          <div className={clsx(
            "p-6 rounded-[2rem] border relative overflow-hidden",
            theme === 'dark'
              ? "bg-gradient-to-br from-[#0D0F12] to-[#15181F] border-[#1F2937]"
              : "bg-gradient-to-br from-white to-gray-50 border-gray-200"
          )}>
            <div className="absolute -left-10 -bottom-10 w-40 h-40 blur-[80px] rounded-full opacity-10 bg-[#3BF68A]" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-[#3BF68A]" />
                <h3 className={clsx(
                  "text-sm font-bold uppercase tracking-wider",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>Daily Guardrails</h3>
              </div>

              {/* Safe Daily Max - HERO */}
              <div className={clsx(
                "p-6 rounded-2xl mb-4",
                theme === 'dark' ? "bg-[#3BF68A]/10 border border-[#3BF68A]/20" : "bg-green-50 border border-green-200"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black text-[#3BF68A] uppercase tracking-[0.2em] mb-1">
                      Safe Daily Max
                    </div>
                    <div className="text-3xl font-black text-[#3BF68A]">
                      {formatCurrency(metrics.safeMaxToday)}
                    </div>
                    <div className={clsx(
                      "text-xs mt-1",
                      theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600"
                    )}>
                      Max profit today without increasing your target
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-[#3BF68A]/20 flex items-center justify-center">
                    <Shield className="w-8 h-8 text-[#3BF68A]" />
                  </div>
                </div>
              </div>

              {/* Warning & Danger Zones */}
              <div className="grid grid-cols-2 gap-4">
                <div className={clsx(
                  "p-4 rounded-xl",
                  theme === 'dark' ? "bg-[#F59E0B]/10 border border-[#F59E0B]/20" : "bg-amber-50 border border-amber-200"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    <span className="text-[9px] font-black text-[#F59E0B] uppercase tracking-wider">Warning Zone</span>
                  </div>
                  <div className="text-lg font-bold text-[#F59E0B]">
                    {formatCurrency(metrics.warningThreshold)} - {formatCurrency(metrics.highestDay)}
                  </div>
                  <div className={clsx(
                    "text-[10px] mt-1",
                    theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600"
                  )}>Approaching your highest day</div>
                </div>

                <div className={clsx(
                  "p-4 rounded-xl",
                  theme === 'dark' ? "bg-[#F45B69]/10 border border-[#F45B69]/20" : "bg-red-50 border border-red-200"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-[#F45B69]" />
                    <span className="text-[9px] font-black text-[#F45B69] uppercase tracking-wider">Danger Zone</span>
                  </div>
                  <div className="text-lg font-bold text-[#F45B69]">
                    &gt; {formatCurrency(metrics.highestDay)}
                  </div>
                  <div className={clsx(
                    "text-[10px] mt-1",
                    theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600"
                  )}>Would increase your target</div>
                </div>
              </div>
            </div>
          </div>

          {/* WHAT-IF SCENARIO PLANNER */}
          <div className={clsx(
            "p-6 rounded-[2rem] border",
            theme === 'dark' ? "bg-[#15181F] border-[#1F2937]" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-[#A78BFA]" />
              <h3 className={clsx(
                "text-sm font-bold uppercase tracking-wider",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>What-If Scenario</h3>
            </div>

            {/* Input */}
            <div className="mb-4">
              <label className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em] mb-2 block">
                If I profit tomorrow...
              </label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <span className={clsx(
                    "absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold",
                    theme === 'dark' ? "text-[#A78BFA]" : "text-purple-600"
                  )}>$</span>
                  <input
                    type="number"
                    value={whatIfAmount}
                    onChange={(e) => setWhatIfAmount(Number(e.target.value))}
                    className={clsx(
                      "w-full pl-10 pr-4 py-3 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/50",
                      theme === 'dark'
                        ? "bg-[#0B0D10] text-white border border-[#1F2937]"
                        : "bg-gray-100 text-gray-900 border border-gray-200"
                    )}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="50"
                  value={whatIfAmount}
                  onChange={(e) => setWhatIfAmount(Number(e.target.value))}
                  className="flex-1 h-2 bg-[#1F2937] rounded-lg appearance-none cursor-pointer accent-[#A78BFA]"
                />
              </div>
            </div>

            {/* Result */}
            <div className={clsx(
              "p-4 rounded-xl",
              whatIfScenario.wouldIncreaseTarget
                ? (theme === 'dark' ? "bg-[#F45B69]/10 border border-[#F45B69]/20" : "bg-red-50 border border-red-200")
                : (theme === 'dark' ? "bg-[#3BF68A]/10 border border-[#3BF68A]/20" : "bg-green-50 border border-green-200")
            )}>
              <div className="flex items-center gap-3 mb-3">
                {whatIfScenario.wouldIncreaseTarget ? (
                  <>
                    <XCircle className="w-5 h-5 text-[#F45B69]" />
                    <span className="text-sm font-bold text-[#F45B69]">Would Increase Target</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-[#3BF68A]" />
                    <span className="text-sm font-bold text-[#3BF68A]">Safe - No Target Increase</span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className={clsx(theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>New Consistency:</span>
                  <span className={clsx(
                    "ml-2 font-bold",
                    whatIfScenario.newConsistencyPercent > consistencyRule ? "text-[#F45B69]" : "text-[#3BF68A]"
                  )}>
                    {whatIfScenario.newConsistencyPercent.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className={clsx(theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>New Target:</span>
                  <span className={clsx(
                    "ml-2 font-bold",
                    whatIfScenario.wouldIncreaseTarget ? "text-[#F45B69]" : "text-white"
                  )}>
                    {formatCurrency(whatIfScenario.newEffectiveTarget)}
                  </span>
                </div>
                <div>
                  <span className={clsx(theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>New Gap:</span>
                  <span className={clsx("ml-2 font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    {formatCurrency(whatIfScenario.newGapToPayout)}
                  </span>
                </div>
                {whatIfScenario.wouldIncreaseTarget && (
                  <div>
                    <span className={clsx(theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>Target Increase:</span>
                    <span className="ml-2 font-bold text-[#F45B69]">
                      +{formatCurrency(whatIfScenario.targetIncrease)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PATH TO PAYOUT */}
      <div className={clsx(
        "p-6 rounded-[2rem] border",
        theme === 'dark' ? "bg-[#0D0F12] border-[#1F2937]" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#3BF68A]" />
          <h3 className={clsx(
            "text-sm font-bold uppercase tracking-wider",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>Path to Payout</h3>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs mb-2">
            <span className={clsx(theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
              Progress: {formatCurrency(metrics.currentTotalProfit)}
            </span>
            <span className={clsx(theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
              Target: {formatCurrency(metrics.effectiveTarget)}
            </span>
          </div>
          <div className={clsx(
            "h-4 rounded-full overflow-hidden relative",
            theme === 'dark' ? "bg-[#1F2937]" : "bg-gray-200"
          )}>
            {/* Original target marker */}
            {metrics.effectiveTarget > originalTarget && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#6B7280] z-10"
                style={{ left: `${(originalTarget / metrics.effectiveTarget) * 100}%` }}
              />
            )}
            {/* Progress */}
            <div
              className="h-full bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] transition-all duration-1000"
              style={{ width: `${Math.min(100, (metrics.currentTotalProfit / metrics.effectiveTarget) * 100)}%` }}
            />
          </div>
          {metrics.effectiveTarget > originalTarget && (
            <div className="flex items-center gap-2 mt-2 text-[10px] text-[#F59E0B]">
              <AlertTriangle className="w-3 h-3" />
              Original target was {formatCurrency(originalTarget)} - increased due to consistency rule
            </div>
          )}
        </div>

        {/* Projections Grid - Sorted by days (most to least), colored by risk based on daily rate */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {projections
            .slice()
            .sort((a, b) => b.daysNeeded - a.daysNeeded) // Most days first (safest)
            .map(({ dailyRate, daysNeeded }) => {
              // Risk is based on how close the daily rate is to the highest day
              // Higher daily rate = more aggressive = more dangerous
              const highestDay = metrics.highestDay || 1000;
              const riskRatio = dailyRate / highestDay; // 0 to 1+ (can exceed if rate > highest day)

              // Color gradient based on how aggressive the daily rate is
              const getCardStyle = () => {
                if (riskRatio <= 0.25) {
                  // Very conservative - green
                  return {
                    bg: theme === 'dark' ? 'bg-[#3BF68A]/10' : 'bg-green-50',
                    border: theme === 'dark' ? 'border-[#3BF68A]/30' : 'border-green-300',
                    text: 'text-[#3BF68A]',
                    label: 'Safe',
                    labelBg: 'bg-[#3BF68A]/20 text-[#3BF68A]'
                  };
                }
                if (riskRatio <= 0.5) {
                  // Moderate - teal/cyan
                  return {
                    bg: theme === 'dark' ? 'bg-[#22D3EE]/10' : 'bg-cyan-50',
                    border: theme === 'dark' ? 'border-[#22D3EE]/30' : 'border-cyan-300',
                    text: 'text-[#22D3EE]',
                    label: 'Moderate',
                    labelBg: 'bg-[#22D3EE]/20 text-[#22D3EE]'
                  };
                }
                if (riskRatio <= 0.75) {
                  // Caution - yellow/amber
                  return {
                    bg: theme === 'dark' ? 'bg-[#F59E0B]/10' : 'bg-amber-50',
                    border: theme === 'dark' ? 'border-[#F59E0B]/30' : 'border-amber-300',
                    text: 'text-[#F59E0B]',
                    label: 'Caution',
                    labelBg: 'bg-[#F59E0B]/20 text-[#F59E0B]'
                  };
                }
                if (riskRatio < 1) {
                  // High risk - orange
                  return {
                    bg: theme === 'dark' ? 'bg-[#F97316]/10' : 'bg-orange-50',
                    border: theme === 'dark' ? 'border-[#F97316]/30' : 'border-orange-300',
                    text: 'text-[#F97316]',
                    label: 'Risky',
                    labelBg: 'bg-[#F97316]/20 text-[#F97316]'
                  };
                }
                // Danger - exceeds or equals highest day (would increase target)
                return {
                  bg: theme === 'dark' ? 'bg-[#F45B69]/10' : 'bg-red-50',
                  border: theme === 'dark' ? 'border-[#F45B69]/30' : 'border-red-300',
                  text: 'text-[#F45B69]',
                  label: 'Danger',
                  labelBg: 'bg-[#F45B69]/20 text-[#F45B69]'
                };
              };

              const style = getCardStyle();

              return (
                <div
                  key={dailyRate}
                  className={clsx(
                    "p-3 rounded-xl text-center transition-all border-2 hover:scale-105",
                    style.bg,
                    style.border
                  )}
                >
                  <div className={clsx("text-2xl font-black", style.text)}>
                    {daysNeeded}
                  </div>
                  <div className={clsx(
                    "text-[9px] uppercase tracking-wider mb-2",
                    theme === 'dark' ? "text-[#8B94A7]" : "text-gray-500"
                  )}>
                    days @ ${dailyRate}/day
                  </div>
                  <span className={clsx(
                    "text-[8px] px-2 py-1 rounded-full font-bold uppercase",
                    style.labelBg
                  )}>
                    {style.label}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* EDUCATION SECTION */}
      <div className={clsx(
        "rounded-[2rem] border overflow-hidden",
        theme === 'dark' ? "bg-[#15181F] border-[#1F2937]" : "bg-white border-gray-200"
      )}>
        <button
          onClick={() => setShowEducation(!showEducation)}
          className={clsx(
            "w-full p-4 flex items-center justify-between transition-colors",
            theme === 'dark' ? "hover:bg-[#1F2937]/50" : "hover:bg-gray-50"
          )}
        >
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-[#A78BFA]" />
            <span className={clsx(
              "text-sm font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>Understanding the Consistency Rule</span>
          </div>
          {showEducation ? (
            <ChevronUp className="w-5 h-5 text-[#6B7280]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#6B7280]" />
          )}
        </button>

        {showEducation && (
          <div className={clsx(
            "p-6 border-t space-y-4",
            theme === 'dark' ? "border-[#1F2937]" : "border-gray-200"
          )}>
            <div>
              <h4 className={clsx(
                "text-sm font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>The Formula</h4>
              <div className={clsx(
                "p-4 rounded-xl font-mono text-sm",
                theme === 'dark' ? "bg-[#0B0D10]" : "bg-gray-100"
              )}>
                <div className={clsx(theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                  Consistency % = (Highest Profit Day / Total Profit) × 100
                </div>
                <div className={clsx("mt-2", theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                  Required Target = Highest Day / (Consistency Rule % / 100)
                </div>
              </div>
            </div>

            <div>
              <h4 className={clsx(
                "text-sm font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>Why Your Target Might Increase</h4>
              <p className={clsx(
                "text-sm",
                theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600"
              )}>
                If your highest profit day exceeds the consistency threshold relative to your total profits,
                your required profit target increases. This ensures no single day represents more than
                {consistencyRule}% of your total profits.
              </p>
            </div>

            <div>
              <h4 className={clsx(
                "text-sm font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>Strategy Tips</h4>
              <ul className={clsx(
                "text-sm space-y-2",
                theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600"
              )}>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#3BF68A] mt-0.5 flex-shrink-0" />
                  <span>Keep daily profits consistent - avoid one massive day that skews your ratio</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#3BF68A] mt-0.5 flex-shrink-0" />
                  <span>Use the "Safe Daily Max" as your profit target for the day</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#3BF68A] mt-0.5 flex-shrink-0" />
                  <span>If you're close to payout, be extra careful not to exceed your highest day</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
