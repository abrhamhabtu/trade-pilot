'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAccountStore } from '../../store/accountStore';
import { useThemeStore } from '../../store/themeStore';
import { ConsistencyGuardian } from './ConsistencyGuardian';
import {
  Trophy,
  TrendingUp,
  Shield,
  Zap,
  Flame,
  AlertCircle,
  Mountain,
  Quote,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Compass,
  ShieldCheck,
  RefreshCw
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

const TRADING_QUOTES = [
  "The goal of a successful trader is to make the best trades. Money is secondary.",
  "In trading, the impossible happens about every 48 hours.",
  "The market is a device for transferring money from the impatient to the patient.",
  "Risk comes from not knowing what you're doing.",
  "Don't focus on the money; focus on the execution.",
  "Your stops are your insurance. Don't trade without them.",
  "The trend is your friend until the end when it bends.",
  "A loss is only a mistake if you don't learn from it.",
  "Discipline is the bridge between goals and accomplishment."
];

// Daily target configuration
const PACE_CONFIG = {
  conservative: { label: 'Conservative', dailyTarget: 150, color: '#3BF68A', icon: Shield },
  moderate: { label: 'Moderate', dailyTarget: 300, color: '#A78BFA', icon: Zap },
  aggressive: { label: 'Aggressive', dailyTarget: 600, color: '#F45B69', icon: Flame }
};

export const JourneyPage: React.FC = () => {
  const { accounts, selectedAccountId, updateAccount } = useAccountStore();
  const { theme } = useThemeStore();
  const account = accounts.find(a => a.id === selectedAccountId) || null;

  const [target, setTarget] = useState(account?.profitTarget || 3000);
  const [isFunded, setIsFunded] = useState(account?.isFunded || false);
  const [pace, setPace] = useState<'conservative' | 'moderate' | 'aggressive'>(account?.pacingPreference || 'moderate');
  const [quote, setQuote] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'consistency'>('overview');

  useEffect(() => {
    setQuote(TRADING_QUOTES[Math.floor(Math.random() * TRADING_QUOTES.length)]);
  }, []);

  // Update store when local funded state changes
  useEffect(() => {
    if (account && isFunded !== account.isFunded) {
      updateAccount(account.id, { isFunded });
    }
  }, [isFunded, account, updateAccount]);

  // Update target, isFunded, and pace when account changes
  useEffect(() => {
    if (account) {
      setTarget(account.profitTarget || 3000);
      setIsFunded(account.isFunded || false);
      setPace(account.pacingPreference || 'moderate');
    }
  }, [account]);

  // Group existing trades by date
  const [consistencyRule, setConsistencyRule] = useState(account?.consistencyRulePercentage || 30);

  // Update consistency rule state when account changes
  useEffect(() => {
    if (account) {
      setConsistencyRule(account.consistencyRulePercentage || 30);
    }
  }, [account]);

  // Find the most recent payout date - consistency resets after a payout
  const lastPayoutDate = useMemo(() => {
    if (!account?.balanceAdjustments) return null;
    
    const payouts = account.balanceAdjustments
      .filter(adj => adj.type === 'payout')
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending
    
    return payouts.length > 0 ? payouts[0].date : null;
  }, [account?.balanceAdjustments]);

  // Filter trades to only include those AFTER the last payout (for consistency calculation)
  const tradesAfterPayout = useMemo(() => {
    if (!account) return [];
    if (!lastPayoutDate) return account.trades;
    
    return account.trades.filter(trade => {
      const tradeDate = trade.date ? trade.date.split('T')[0] : '';
      return tradeDate > lastPayoutDate; // Only trades after the payout
    });
  }, [account, lastPayoutDate]);

  // Daily P&L from ALL trades (for calendar display)
  const actualDailyPnL = useMemo(() => {
    if (!account) return {};
    return account.trades.reduce((acc, trade) => {
      // Ensure we only look at the date part, ignoring time
      const date = trade.date ? trade.date.split('T')[0] : 'unknown';
      acc[date] = (acc[date] || 0) + trade.netPL;
      return acc;
    }, {} as Record<string, number>);
  }, [account]);

  // Daily P&L from trades AFTER the last payout (for consistency calculation)
  const dailyPnLAfterPayout = useMemo(() => {
    if (!tradesAfterPayout.length) return {};
    return tradesAfterPayout.reduce((acc, trade) => {
      const date = trade.date ? trade.date.split('T')[0] : 'unknown';
      acc[date] = (acc[date] || 0) + trade.netPL;
      return acc;
    }, {} as Record<string, number>);
  }, [tradesAfterPayout]);

  // Total P&L from trades after the last payout (for consistency)
  const pnlAfterPayout = useMemo(() => {
    return tradesAfterPayout.reduce((sum, t) => sum + t.netPL, 0);
  }, [tradesAfterPayout]);

  // Use account balance which includes adjustments (payouts, deposits)
  // This ensures Journey matches the Accounts page and Dashboard
  const calculatedTotalPnL = useMemo(() => {
    if (!account) return 0;
    // Use account.balance which already includes trades + adjustments
    return account.balance;
  }, [account]);

  // Consistency Calculations - ONLY uses trades AFTER the last payout
  // Formula: Minimum Required Profit = Highest Day / Consistency Rule %
  // Current Consistency % = (Highest Day / Current Total Profit) * 100
  // Qualified when Current Consistency % <= Consistency Rule %
  const consistencyMetrics = useMemo(() => {
    // Use dailyPnLAfterPayout for consistency - this resets after each payout
    const dailyProfits = Object.values(dailyPnLAfterPayout);
    const highestDay = dailyProfits.length > 0 ? Math.max(0, ...dailyProfits) : 0;

    // Current Total Profit = P&L since last payout (not all-time)
    // This ensures consistency resets after a payout
    const currentTotalProfit = Math.max(0, pnlAfterPayout);

    // Minimum Required Profit to Qualify = Highest Day / (Rule% / 100)
    const minimumRequiredProfit = highestDay / (consistencyRule / 100);

    // Current Consistency % = (Highest Day / Current Total Profit) * 100
    const currentConsistencyPercent = currentTotalProfit > 0
      ? (highestDay / currentTotalProfit) * 100
      : 0;

    // Qualified if current consistency % is at or below the rule threshold
    const isQualified = currentConsistencyPercent <= consistencyRule;

    // Count trading days since payout
    const tradingDaysSincePayout = Object.keys(dailyPnLAfterPayout).length;

    return {
      highestDay,
      currentTotalProfit,
      minimumRequiredProfit,
      currentConsistencyPercent,
      isQualified,
      consistencyRule,
      lastPayoutDate,
      tradingDaysSincePayout
    };
  }, [dailyPnLAfterPayout, consistencyRule, pnlAfterPayout, lastPayoutDate]);

  const handleConsistencyChange = (rule: number) => {
    setConsistencyRule(rule);
    if (account) {
      updateAccount(account.id, { consistencyRulePercentage: rule });
    }
  };

  const currentPnL = calculatedTotalPnL;
  const isGoalHit = currentPnL >= target;

  // If goal is hit, project a stretch goal
  const projectionTarget = isGoalHit ? currentPnL + (target > 0 ? target : 2000) : target;

  // Generate calendar data based on currentMonth
  const calendarData = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate the start of the grid (always start from Monday of the first week of currentMonth)
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const firstDayOfWeek = monthStart.getDay(); // 0 is Sunday, 1 is Monday
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Days to subtract to get to Monday

    const startDate = new Date(monthStart);
    startDate.setDate(monthStart.getDate() - startOffset);

    // Fixed 42 days (6 weeks) to maintain consistent grid height
    const dailyTarget = PACE_CONFIG[pace].dailyTarget;

    // Find the last trade date (most recent day with actual trades)
    const tradeDates = Object.keys(actualDailyPnL).filter(d => d !== 'unknown').sort();
    const lastTradeDate = tradeDates.length > 0
      ? new Date(tradeDates[tradeDates.length - 1] + 'T12:00:00')
      : new Date(today);
    lastTradeDate.setHours(0, 0, 0, 0);

    // Calculate Goal Date Projection — BOTH conditions must be met
    // Condition 1: Balance must reach profit target
    const balanceRemaining = Math.max(0, projectionTarget - currentPnL);
    const balanceDaysNeeded = balanceRemaining > 0 ? Math.ceil(balanceRemaining / dailyTarget) : 0;

    // Condition 2: Total profit must reach consistency minimum required profit
    const cMinRequired = consistencyMetrics.minimumRequiredProfit;
    const cCurrentProfit = consistencyMetrics.currentTotalProfit;
    const consistencyRemaining = Math.max(0, cMinRequired - cCurrentProfit);
    const consistencyDaysNeeded = consistencyRemaining > 0 ? Math.ceil(consistencyRemaining / dailyTarget) : 0;

    // Goal needs the LATER of both conditions (since both must be met)
    const tradingDaysNeeded = Math.max(balanceDaysNeeded, consistencyDaysNeeded);

    // Both conditions currently met?
    const bothConditionsMet = currentPnL >= projectionTarget &&
      consistencyMetrics.isQualified && cCurrentProfit >= cMinRequired;

    let calculatedGoalDate: Date | null = null;
    if (bothConditionsMet) {
      // Goal already hit - find the date when we crossed the target
      // Walk through trades chronologically to find when balance target was reached
      let runningTotal = 0;
      for (const dateStr of tradeDates) {
        runningTotal += actualDailyPnL[dateStr] || 0;
        if (runningTotal >= target) {
          calculatedGoalDate = new Date(dateStr + 'T12:00:00');
          calculatedGoalDate.setHours(0, 0, 0, 0);
          break;
        }
      }
      // Fallback to last trade date if not found
      if (!calculatedGoalDate) {
        calculatedGoalDate = new Date(lastTradeDate);
      }
    } else if (tradingDaysNeeded > 0) {
      // Project future goal date starting from last trade date (or today if no trades)
      const startFrom = lastTradeDate > today ? lastTradeDate : today;
      let daysAdded = 0;
      const checkDate = new Date(startFrom);
      // Safety cap at 365 days to prevent infinite loops
      while (daysAdded < tradingDaysNeeded && daysAdded < 365) {
        checkDate.setDate(checkDate.getDate() + 1);
        const day = checkDate.getDay();
        if (day !== 0 && day !== 6) { // Skip weekends (Sat=6, Sun=0)
          daysAdded++;
        }
      }
      calculatedGoalDate = checkDate;
    }

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      const isPast = currentDate < today;
      const isToday = currentDate.getTime() === today.getTime();
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const isCurrentMonth = currentDate.getMonth() === currentMonth.getMonth();

      let pnl = 0;
      let isProjected = false;

      // Handle P&L and Projections
      if (isPast || isToday) {
        pnl = actualDailyPnL[dateStr] || 0;
      } else if (!isWeekend) {
        pnl = dailyTarget;
        isProjected = true;
      }

      // Check if this date matches our calculated goal date
      const isGoalDay = calculatedGoalDate &&
        currentDate.getDate() === calculatedGoalDate.getDate() &&
        currentDate.getMonth() === calculatedGoalDate.getMonth() &&
        currentDate.getFullYear() === calculatedGoalDate.getFullYear();

      days.push({
        date: currentDate,
        dateStr,
        pnl,
        isPast,
        isToday,
        isProjected,
        isWeekend,
        isCurrentMonth,
        isGoalDay
      });
    }
    return { days, goalReachedDay: calculatedGoalDate };
  }, [actualDailyPnL, pace, projectionTarget, currentPnL, currentMonth, target, consistencyMetrics]);

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#242838] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No Account Selected</h2>
      </div>
    );
  }

  // === DUAL-CONDITION PAYOUT QUALIFICATION ===
  // Condition 1: Balance Target — account balance must reach the payout target level
  const balanceProgress = Math.min(100, Math.max(0, (currentPnL / target) * 100));
  const remainingPnL = Math.max(0, target - currentPnL);
  const balanceTargetMet = currentPnL >= target;

  // Condition 2: Consistency / Minimum Profit — total profit must reach minimum required
  const consistencyProgress = consistencyMetrics.minimumRequiredProfit > 0
    ? Math.min(100, Math.max(0, (consistencyMetrics.currentTotalProfit / consistencyMetrics.minimumRequiredProfit) * 100))
    : 0;
  const consistencyGap = Math.max(0, consistencyMetrics.minimumRequiredProfit - consistencyMetrics.currentTotalProfit);
  const consistencyMet = consistencyMetrics.isQualified && consistencyMetrics.currentTotalProfit >= consistencyMetrics.minimumRequiredProfit;

  // Combined: BOTH conditions must be met for payout qualification
  const isPayoutReady = balanceTargetMet && consistencyMet;
  // Progress ring shows minimum of both (since both must reach 100%)
  const progressPercent = Math.min(balanceProgress, consistencyProgress);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* 1. HERO HEADER - REDESIGNED WITH INLINE CONTROLS */}
      <div className="relative p-6 rounded-[2rem] overflow-hidden border border-white/5 bg-gradient-to-br from-[#1E2130] to-[#1E2130] shadow-xl">
        <div className={clsx(
          "absolute -right-20 -top-20 w-64 h-64 blur-[100px] rounded-full opacity-10 transition-all duration-1000",
          isFunded ? "bg-emerald-500" : "bg-zinc-200"
        )} />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

          {/* LEFT: Dual Progress Ring */}
          <div className="lg:col-span-3 flex items-center justify-center lg:justify-start pl-8">
            <div className="relative w-32 h-32 flex items-center justify-center group">
              {/* Glow Effect */}
              <div className={clsx(
                "absolute inset-0 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500",
                isPayoutReady ? "bg-emerald-500" : "bg-zinc-200"
              )} />

              <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 100 100">
                {/* Outer Ring Background */}
                <circle
                  cx="50" cy="50" r="42"
                  stroke="currentColor" strokeWidth="6"
                  fill="transparent"
                  className="text-[#2C3148]"
                />
                {/* Outer Ring: Balance Progress */}
                <circle
                  cx="50" cy="50" r="42"
                  stroke="currentColor" strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * balanceProgress) / 100}
                  className={clsx(
                    "transition-all duration-1000 ease-out",
                    balanceTargetMet ? "text-emerald-500" : "text-zinc-400"
                  )}
                  strokeLinecap="round"
                />
                {/* Inner Ring Background */}
                <circle
                  cx="50" cy="50" r="33"
                  stroke="currentColor" strokeWidth="5"
                  fill="transparent"
                  className="text-[#2C3148]"
                />
                {/* Inner Ring: Consistency Progress */}
                <circle
                  cx="50" cy="50" r="33"
                  stroke="currentColor" strokeWidth="5"
                  fill="transparent"
                  strokeDasharray={207}
                  strokeDashoffset={207 - (207 * consistencyProgress) / 100}
                  className={clsx(
                    "transition-all duration-1000 ease-out",
                    consistencyMet ? "text-emerald-500" : "text-[#F59E0B]"
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {isPayoutReady ? (
                  <>
                    <span className="text-lg font-black text-emerald-500 tracking-tighter">Ready</span>
                    <span className="text-[8px] font-bold text-emerald-500/60 uppercase tracking-widest mt-0.5">Payout</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black text-white tracking-tighter">{Math.min(balanceProgress, consistencyProgress).toFixed(0)}%</span>
                    <span className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-0.5">Both Req.</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: Account Info */}
          <div className="lg:col-span-5 space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-none italic">
              {account.name}
            </h1>
            <div className="flex items-center space-x-6 text-white">
              <div>
                <div className="text-[9px] font-black text-[#6B7280] uppercase tracking-[0.2em] mb-1">Balance</div>
                <div className="text-2xl font-black tabular-nums tracking-tight">${currentPnL.toLocaleString()}</div>
              </div>
              <div className="w-px h-8 bg-[#242838]" />
              <div>
                <div className="text-[9px] font-black text-[#6B7280] uppercase tracking-[0.2em] mb-1">Target</div>
                <div className="relative group flex items-center">
                  <span className="text-2xl font-black text-emerald-500 mr-1">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={target.toString()}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9]/g, '');
                      const val = parseInt(cleaned, 10) || 0;
                      setTarget(val);
                      updateAccount(account.id, { profitTarget: val });
                    }}
                    className="w-32 bg-transparent text-2xl font-black text-emerald-500 tabular-nums focus:outline-none placeholder-[#3BF68A]/50"
                  />
                  {/* Invisible overlay to hint editability on hover */}
                  <div className="absolute inset-0 border-b-2 border-emerald-500/30/0 group-hover:border-emerald-500/30/20 transition-colors pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Inline Controls */}
          <div className="lg:col-span-4 space-y-5">
            {/* Account Type Toggle */}
            <div className="space-y-2">
              <label className="text-[8px] font-black text-[#4B5563] uppercase tracking-[0.2em] ml-1">Account Status</label>
              <div className="flex bg-[#181B24] p-1.5 rounded-2xl border border-white/5">
                <button
                  onClick={() => {
                    setIsFunded(false);
                    updateAccount(account.id, { isFunded: false });
                  }}
                  className={clsx(
                    "flex-1 py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2",
                    !isFunded ? "bg-zinc-200 text-white shadow-lg scale-[1.02]" : "text-[#6B7280] hover:text-[#9CA3AF]"
                  )}
                >
                  <Mountain className="w-3.5 h-3.5" />
                  Challenge
                </button>
                <button
                  onClick={() => {
                    setIsFunded(true);
                    updateAccount(account.id, { isFunded: true });
                  }}
                  className={clsx(
                    "flex-1 py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2",
                    isFunded ? "bg-emerald-500 text-black shadow-lg scale-[1.02]" : "text-[#6B7280] hover:text-[#9CA3AF]"
                  )}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Funded
                </button>
              </div>
            </div>

            {/* Pacing Strategy */}
            <div className="space-y-2">
              <label className="text-[8px] font-black text-[#4B5563] uppercase tracking-[0.2em] ml-1">Trading Pace</label>
              <div className="flex bg-[#181B24] p-1.5 rounded-2xl border border-white/5">
                {(['conservative', 'moderate', 'aggressive'] as const).map((p) => {
                  const Icon = PACE_CONFIG[p].icon;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setPace(p);
                        updateAccount(account.id, { pacingPreference: p });
                      }}
                      className={clsx(
                        "flex-1 py-3 rounded-xl text-[8px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5",
                        pace === p ? "bg-white text-zinc-950 shadow-lg scale-[1.02]" : "text-[#6B7280] hover:text-[#9CA3AF]"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: pace === p ? 'black' : PACE_CONFIG[p].color }} />
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className={clsx(
        "flex p-1.5 rounded-2xl border",
        theme === 'dark' ? "bg-[#181B24] border-white/5" : "bg-gray-100 border-gray-200"
      )}>
        <button
          onClick={() => setActiveTab('overview')}
          className={clsx(
            "flex-1 py-3 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2",
            activeTab === 'overview'
              ? (theme === 'dark' ? "bg-[#242838] text-white shadow-lg" : "bg-white text-gray-900 shadow-sm")
              : (theme === 'dark' ? "text-[#6B7280] hover:text-[#9CA3AF]" : "text-gray-500 hover:text-gray-700")
          )}
        >
          <Compass className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('consistency')}
          className={clsx(
            "flex-1 py-3 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2",
            activeTab === 'consistency'
              ? (theme === 'dark' ? "bg-[#242838] text-white shadow-lg" : "bg-white text-gray-900 shadow-sm")
              : (theme === 'dark' ? "text-[#6B7280] hover:text-[#9CA3AF]" : "text-gray-500 hover:text-gray-700")
          )}
        >
          <ShieldCheck className="w-4 h-4" />
          Consistency Guardian
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'overview' ? (
        <>
          {/* 2. CALENDAR & WIDGETS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* PROGRESSIVE ROADMAP CALENDAR */}
            <div className="lg:col-span-8 space-y-6 bg-[#1E2130]/60 p-8 rounded-[2.5rem] border border-white/5/50 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center space-x-6">
                  <div className="flex flex-col">
                    <h2 className="text-3xl font-bold text-white tracking-tighter uppercase italic leading-none">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long' })}
                    </h2>
                    <span className="text-[10px] font-mono text-[#4B5563] tracking-[0.4em] uppercase mt-1">
                      {currentMonth.getFullYear()} Roadmap
                    </span>
                  </div>

                  <div className="flex items-center bg-white/5 rounded-2xl border border-white/10 p-1 backdrop-blur-md">
                    <button
                      onClick={() => navigateMonth(-1)}
                      className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button
                      onClick={() => setCurrentMonth(new Date())}
                      className="px-4 text-[10px] font-bold uppercase text-white/40 hover:text-zinc-400 transition-colors tracking-widest"
                    >
                      Current
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button
                      onClick={() => navigateMonth(1)}
                      className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {calendarData.goalReachedDay && (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center space-x-2 text-emerald-500">
                      <Trophy className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Target Reach</span>
                    </div>
                    <div className="text-xl font-bold text-white tracking-tighter">
                      {calendarData.goalReachedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-7 gap-4">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-center text-[10px] font-bold text-[#4B5563] uppercase tracking-[0.3em] pb-2">
                    {day}
                  </div>
                ))}

                {calendarData.days.map((day, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "relative aspect-square rounded-[1.25rem] transition-all duration-500 group overflow-hidden",
                      day.isWeekend ? "bg-transparent opacity-30" :
                        day.isGoalDay ? "bg-white shadow-[0_0_40px_rgba(255,255,255,0.15)] scale-105 z-10" :
                          day.isToday ? "bg-white/5 border border-zinc-500" :
                            day.isProjected ? "bg-white/[0.02] border border-dashed border-white/10" :
                              !day.isCurrentMonth ? "opacity-10" :
                                "bg-white/[0.03] border border-white/[0.05] hover:border-slate-300 dark:border-white/20"
                    )}
                  >
                    {/* Background Pattern for Weekends */}
                    {day.isWeekend && (
                      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #fff, #fff 1px, transparent 1px, transparent 10px)' }} />
                    )}

                    <div className="absolute inset-0 p-3 flex flex-col justify-between z-10">
                      <div className="flex justify-between items-start">
                        <span className={clsx(
                          "text-[10px] font-medium tracking-tight",
                          day.isGoalDay ? "text-black" :
                            day.isToday ? "text-zinc-400 font-bold" :
                              "text-white/40"
                        )}>
                          {day.date.getDate().toString().padStart(2, '0')}
                        </span>
                        {day.isToday && (
                          <div className="w-1 h-1 rounded-full bg-zinc-200 shadow-[0_0_10px_#A78BFA]" />
                        )}
                      </div>

                      {!day.isWeekend && (
                        <div className="flex flex-col">
                          {day.isGoalDay ? (
                            <div className="flex flex-col items-center pb-1">
                              <Trophy className="w-4 h-4 text-black mb-1" />
                              <span className="text-[8px] font-black text-black uppercase tracking-tighter">Goal</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {day.pnl !== 0 ? (
                                <div className={clsx(
                                  "text-[11px] font-bold tabular-nums tracking-tighter",
                                  day.isProjected ? "text-white/20" :
                                    day.pnl > 0 ? "text-emerald-500" : "text-rose-500"
                                )}>
                                  {formatCurrency(day.pnl)}
                                </div>
                              ) : day.isPast && day.isCurrentMonth ? (
                                <div className="w-1 h-1 rounded-full bg-white/10 mx-auto" />
                              ) : null}

                              {day.isProjected && !day.isGoalDay && day.pnl !== 0 && (
                                <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#242838]/80 w-full" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hover Glow Effect */}
                    {!day.isWeekend && day.isCurrentMonth && !day.isGoalDay && (
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SIDE WIDGETS: QUOTES & TASKS */}
            <div className="lg:col-span-4 space-y-6">

              {/* TRADING QUOTE WIDGET */}
              <div className="p-6 rounded-[2.5rem] bg-[#181B24]/80 backdrop-blur-md border border-white/5 shadow-xl relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-zinc-200/5 rounded-full blur-xl" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-2">
                    <Quote className="w-4 h-4 text-zinc-400" />
                    <span className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em]">Daily Wisdom</span>
                  </div>
                  <p className="text-sm text-white font-medium italic leading-relaxed">
                    "{quote}"
                  </p>
                </div>
              </div>

              {/* FOCUS TASKS WIDGET */}
              <div className="p-6 rounded-[2.5rem] bg-[#1E2130] border border-white/5 shadow-xl relative overflow-hidden group">
                <div className="absolute -left-4 -top-4 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    <span className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em]">Focus Points</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      "Wait for your setup - No FOMO",
                      "Respect the hard stop loss",
                      "Check daily economic news"
                    ].map((task, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs text-zinc-400 font-medium border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {task}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* PAYOUT READINESS - Dual Condition Qualification */}
              <div className={clsx(
                "p-6 rounded-[2.5rem] border shadow-xl overflow-hidden relative transition-colors",
                theme === 'dark' ? "bg-[#181B24]/80 backdrop-blur-md border-white/5" : "bg-[#F8F9FB] border-gray-100"
              )}>
                {/* Overall Status Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={clsx(
                      "p-1.5 rounded-lg",
                      isPayoutReady ? "bg-emerald-500/10" : "bg-[#F59E0B]/10"
                    )}>
                      <Shield className={clsx("w-4 h-4", isPayoutReady ? "text-emerald-500" : "text-[#F59E0B]")} />
                    </div>
                    <span className={clsx(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-zinc-100" : "text-gray-900"
                    )}>Payout Readiness</span>
                  </div>
                  <div className={clsx(
                    "px-3 py-1 rounded-full text-xs font-bold text-white",
                    isPayoutReady ? "bg-emerald-500" : "bg-rose-500"
                  )}>
                    {isPayoutReady ? "Ready" : "Not Ready"}
                  </div>
                </div>

                {/* Payout Reset Notice */}
                {lastPayoutDate && (
                  <div className={clsx(
                    "flex items-center gap-2 p-2 rounded-lg text-xs mb-4",
                    theme === 'dark' ? "bg-[#242838] text-zinc-400" : "bg-purple-50 text-purple-600"
                  )}>
                    <RefreshCw className="w-3 h-3" />
                    <span>
                      Reset on {new Date(lastPayoutDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {consistencyMetrics.tradingDaysSincePayout} day{consistencyMetrics.tradingDaysSincePayout !== 1 ? 's' : ''} since payout
                    </span>
                  </div>
                )}

                {/* CONDITION 1: Balance Target */}
                <div className={clsx(
                  "p-4 rounded-2xl border mb-3",
                  balanceTargetMet
                    ? (theme === 'dark' ? "bg-emerald-500/5 border-emerald-500/30/20" : "bg-green-50 border-green-200")
                    : (theme === 'dark' ? "bg-zinc-200/5 border-white/5" : "bg-gray-50 border-gray-200")
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Mountain className={clsx("w-3.5 h-3.5", balanceTargetMet ? "text-emerald-500" : "text-zinc-400")} />
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                        ① Balance Target
                      </span>
                    </div>
                    <div className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold",
                      balanceTargetMet ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                    )}>
                      {balanceTargetMet ? "Met" : "Not Met"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Balance</span>
                      <span className={clsx("font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {formatCurrency(currentPnL)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Payout Target</span>
                      <span className={clsx("font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {formatCurrency(target)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Gap to Summit</span>
                      <span className={clsx("font-bold", balanceTargetMet ? "text-emerald-500" : "text-[#F59E0B]")}>
                        {balanceTargetMet ? "Target reached!" : formatCurrency(remainingPnL)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-[#242838] rounded-full overflow-hidden mt-1">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all duration-1000",
                          balanceTargetMet ? "bg-emerald-500" : "bg-zinc-200"
                        )}
                        style={{ width: `${balanceProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* CONDITION 2: Consistency / Minimum Profit */}
                <div className={clsx(
                  "p-4 rounded-2xl border mb-3",
                  consistencyMet
                    ? (theme === 'dark' ? "bg-emerald-500/5 border-emerald-500/30/20" : "bg-green-50 border-green-200")
                    : (theme === 'dark' ? "bg-[#F59E0B]/5 border-white/5" : "bg-amber-50 border-amber-200")
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={clsx("w-3.5 h-3.5", consistencyMet ? "text-emerald-500" : "text-[#F59E0B]")} />
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">
                        ② Consistency Rule ({consistencyRule}%)
                      </span>
                    </div>
                    <div className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold",
                      consistencyMet ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                    )}>
                      {consistencyMet ? "Qualified" : "Not Yet"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Highest Profit Day</span>
                      <span className="font-semibold text-[#F59E0B]">
                        {formatCurrency(consistencyMetrics.highestDay)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Current Total Profit</span>
                      <span className={clsx("font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {formatCurrency(consistencyMetrics.currentTotalProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Min. Required Profit</span>
                      <span className={clsx("font-semibold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {formatCurrency(consistencyMetrics.minimumRequiredProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-400">Consistency</span>
                      <span className={clsx(
                        "font-bold",
                        consistencyMetrics.currentConsistencyPercent <= consistencyRule ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {consistencyMetrics.currentConsistencyPercent.toFixed(1)}% / {consistencyRule}%
                      </span>
                    </div>

                    {/* Profit still needed — the key "how much more" metric */}
                    <div className={clsx(
                      "flex justify-between items-center text-xs mt-1 pt-2 border-t",
                      theme === 'dark' ? "border-white/5" : "border-gray-200"
                    )}>
                      <span className={clsx(
                        "font-semibold flex items-center gap-1.5",
                        consistencyMet ? "text-emerald-500" : "text-[#F59E0B]"
                      )}>
                        <Zap className="w-3 h-3" />
                        Profit Still Needed
                      </span>
                      <span className={clsx(
                        "font-black text-sm",
                        consistencyMet ? "text-emerald-500" : "text-[#F59E0B]"
                      )}>
                        {consistencyMet ? "Qualified!" : formatCurrency(consistencyGap)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-[#242838] rounded-full overflow-hidden mt-1">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all duration-1000",
                          consistencyMet ? "bg-emerald-500" : "bg-[#F59E0B]"
                        )}
                        style={{ width: `${consistencyProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Consistency Rule Selector */}
                <div className="pt-1">
                  <label className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em] mb-2 block">
                    Consistency Rule
                  </label>
                  <div className={clsx(
                    "flex p-1 rounded-xl border",
                    theme === 'dark' ? "bg-[#181B24] border-white/5" : "bg-gray-50 border-gray-200"
                  )}>
                    {[15, 20, 30, 40, 50].map((rule) => (
                      <button
                        key={rule}
                        onClick={() => handleConsistencyChange(rule)}
                        className={clsx(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                          consistencyRule === rule
                            ? (theme === 'dark' ? "bg-[#242838] text-white shadow-lg" : "bg-white text-gray-900 shadow-sm border border-gray-100")
                            : (theme === 'dark' ? "text-zinc-400 hover:text-zinc-100" : "text-gray-500 hover:text-gray-900")
                        )}
                      >
                        {rule}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* FOOTER METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-[2.5rem] bg-[#181B24]/80 backdrop-blur-md border border-white/5 shadow-xl">
              <div className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.3em] mb-4">Pacing Analysis</div>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-white">${PACE_CONFIG[pace].dailyTarget}</div>
                  <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Daily Pace Target</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-white">
                    {remainingPnL > 0 ? Math.ceil(remainingPnL / PACE_CONFIG[pace].dailyTarget) : 0}
                  </div>
                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Trading Days Left</div>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-[#181B24]/80 backdrop-blur-md border border-white/5 shadow-xl">
              <div className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.3em] mb-4">Gap to Payout</div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Balance Gap</span>
                  <span className={clsx("text-lg font-black", balanceTargetMet ? "text-emerald-500" : "text-white")}>
                    {balanceTargetMet ? "Met" : formatCurrency(remainingPnL)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Consistency Gap</span>
                  <span className={clsx("text-lg font-black", consistencyMet ? "text-emerald-500" : "text-white")}>
                    {consistencyMet ? "Met" : formatCurrency(consistencyGap)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-[#1E2130] to-[#242838] border border-white/5 shadow-xl flex items-center justify-between">
              <div className="space-y-4">
                <div className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.3em]">Execution Insight</div>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-[300px] font-medium italic">
                  "The {pace} approach is about precision over volume. Every single trade should move you closer to the {target.toLocaleString()} target with maximum discipline."
                </p>
              </div>
              <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center border border-white/10">
                <TrendingUp className="w-8 h-8 text-emerald-500" />
              </div>
            </div>
          </div>
        </>
      ) : (
        <ConsistencyGuardian
          account={account}
          actualDailyPnL={dailyPnLAfterPayout}
          lastPayoutDate={lastPayoutDate}
          tradingDaysSincePayout={consistencyMetrics.tradingDaysSincePayout}
        />
      )}
    </div>
  );
};
