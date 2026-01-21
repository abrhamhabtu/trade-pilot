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
  ShieldCheck
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
  }, [account?.id]);

  // Group existing trades by date
  const [consistencyRule, setConsistencyRule] = useState(account?.consistencyRulePercentage || 30);
  
  // Update consistency rule state when account changes
  useEffect(() => {
    if (account) {
      setConsistencyRule(account.consistencyRulePercentage || 30);
    }
  }, [account]);

  const actualDailyPnL = useMemo(() => {
    if (!account) return {};
    return account.trades.reduce((acc, trade) => {
      // Ensure we only look at the date part, ignoring time
      const date = trade.date ? trade.date.split('T')[0] : 'unknown';
      acc[date] = (acc[date] || 0) + trade.netPL;
      return acc;
    }, {} as Record<string, number>);
  }, [account]);

  // Calculate total PnL from trades directly to ensure accuracy (ignoring starting balance)
  const calculatedTotalPnL = useMemo(() => {
    if (!account) return 0;
    return account.trades.reduce((sum, t) => sum + t.netPL, 0);
  }, [account]);

  // Consistency Calculations
  // Formula: Minimum Required Profit = Highest Day / Consistency Rule %
  // Current Consistency % = (Highest Day / Current Total Profit) * 100
  // Qualified when Current Consistency % <= Consistency Rule %
  const consistencyMetrics = useMemo(() => {
    const dailyProfits = Object.values(actualDailyPnL);
    const highestDay = dailyProfits.length > 0 ? Math.max(0, ...dailyProfits) : 0;
    
    // Current Total Profit = Calculated PnL (Total Profit generated)
    // We use calculatedTotalPnL to ensure we are comparing against actual generated profit, not account equity
    const currentTotalProfit = Math.max(0, calculatedTotalPnL);
    
    // Minimum Required Profit to Qualify = Highest Day / (Rule% / 100)
    const minimumRequiredProfit = highestDay / (consistencyRule / 100);
    
    // Current Consistency % = (Highest Day / Current Total Profit) * 100
    const currentConsistencyPercent = currentTotalProfit > 0 
      ? (highestDay / currentTotalProfit) * 100 
      : 0;
    
    // Qualified if current consistency % is at or below the rule threshold
    const isQualified = currentConsistencyPercent <= consistencyRule;

    return { 
      highestDay, 
      currentTotalProfit,
      minimumRequiredProfit,
      currentConsistencyPercent,
      isQualified,
      consistencyRule
    };
  }, [actualDailyPnL, consistencyRule, calculatedTotalPnL]);

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
    
    // Calculate Goal Date Projection independently of grid
    // Logic: How many trading days (weekdays) needed to reach target?
    const remainingToGoal = Math.max(0, projectionTarget - currentPnL);
    const tradingDaysNeeded = remainingToGoal > 0 ? Math.ceil(remainingToGoal / dailyTarget) : 0;
    
    let calculatedGoalDate: Date | null = null;
    if (currentPnL >= projectionTarget) {
      // Goal already hit - find the date when we crossed the target
      // Walk through trades chronologically to find when target was reached
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
  }, [actualDailyPnL, pace, projectionTarget, currentPnL, currentMonth, target]);

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-[#1F2937] flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-[#8B94A7]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">No Account Selected</h2>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.max(0, (currentPnL / target) * 100));
  const remainingPnL = Math.max(0, target - currentPnL);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* 1. HERO HEADER - REDESIGNED WITH INLINE CONTROLS */}
      <div className="relative p-6 rounded-[2rem] overflow-hidden border border-[#1F2937] bg-gradient-to-br from-[#0D0F12] to-[#15181F] shadow-xl">
        <div className={clsx(
          "absolute -right-20 -top-20 w-64 h-64 blur-[100px] rounded-full opacity-10 transition-all duration-1000",
          isFunded ? "bg-[#3BF68A]" : "bg-[#A78BFA]"
        )} />
        
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* LEFT: Progress Ring (Larger & Moved Left) */}
          <div className="lg:col-span-3 flex items-center justify-center lg:justify-start pl-8">
            <div className="relative w-32 h-32 flex items-center justify-center group">
              {/* Glow Effect */}
              <div className={clsx(
                "absolute inset-0 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500",
                isFunded ? "bg-[#3BF68A]" : "bg-[#A78BFA]"
              )} />
              
              <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 100 100">
                {/* Background Circle */}
                <circle 
                  cx="50" cy="50" r="42" 
                  stroke="currentColor" strokeWidth="8" 
                  fill="transparent" 
                  className="text-[#1F2937]" 
                />
                {/* Progress Circle */}
                <circle 
                  cx="50" cy="50" r="42" 
                  stroke="currentColor" strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={264} 
                  strokeDashoffset={264 - (264 * progressPercent) / 100}
                  className={clsx(
                    "transition-all duration-1000 ease-out", 
                    isFunded ? "text-[#3BF68A]" : "text-[#A78BFA]"
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-white tracking-tighter">{progressPercent.toFixed(0)}%</span>
                <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-widest mt-0.5">Goal</span>
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
              <div className="w-px h-8 bg-[#1F2937]" />
              <div>
                <div className="text-[9px] font-black text-[#6B7280] uppercase tracking-[0.2em] mb-1">Target</div>
                <div className="relative group flex items-center">
                  <span className="text-2xl font-black text-[#3BF68A] mr-1">$</span>
                  <input 
                    type="number"
                    value={target}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTarget(val);
                      updateAccount(account.id, { profitTarget: val });
                    }}
                    className="w-32 bg-transparent text-2xl font-black text-[#3BF68A] tabular-nums focus:outline-none placeholder-[#3BF68A]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {/* Invisible overlay to hint editability on hover */}
                  <div className="absolute inset-0 border-b-2 border-[#3BF68A]/0 group-hover:border-[#3BF68A]/20 transition-colors pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Inline Controls */}
          <div className="lg:col-span-4 space-y-5">
            {/* Account Type Toggle */}
            <div className="space-y-2">
              <label className="text-[8px] font-black text-[#4B5563] uppercase tracking-[0.2em] ml-1">Account Status</label>
              <div className="flex bg-[#0B0D10] p-1.5 rounded-2xl border border-[#1F2937]">
                <button
                  onClick={() => {
                    setIsFunded(false);
                    updateAccount(account.id, { isFunded: false });
                  }}
                  className={clsx(
                    "flex-1 py-3 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2",
                    !isFunded ? "bg-[#A78BFA] text-white shadow-lg scale-[1.02]" : "text-[#6B7280] hover:text-[#9CA3AF]"
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
                    isFunded ? "bg-[#3BF68A] text-black shadow-lg scale-[1.02]" : "text-[#6B7280] hover:text-[#9CA3AF]"
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
              <div className="flex bg-[#0B0D10] p-1.5 rounded-2xl border border-[#1F2937]">
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
                        pace === p ? "bg-white text-black shadow-lg scale-[1.02]" : "text-[#6B7280] hover:text-[#9CA3AF]"
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
        theme === 'dark' ? "bg-[#0B0D10] border-[#1F2937]" : "bg-gray-100 border-gray-200"
      )}>
        <button
          onClick={() => setActiveTab('overview')}
          className={clsx(
            "flex-1 py-3 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center justify-center gap-2",
            activeTab === 'overview' 
              ? (theme === 'dark' ? "bg-[#1F2937] text-white shadow-lg" : "bg-white text-gray-900 shadow-sm")
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
              ? (theme === 'dark' ? "bg-[#1F2937] text-white shadow-lg" : "bg-white text-gray-900 shadow-sm")
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
        <div className="lg:col-span-8 space-y-6 bg-[#0D0F12]/60 p-8 rounded-[2.5rem] border border-[#1F2937]/50 backdrop-blur-xl shadow-2xl">
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
                  className="px-4 text-[10px] font-bold uppercase text-white/40 hover:text-[#A78BFA] transition-colors tracking-widest"
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
                <div className="flex items-center space-x-2 text-[#3BF68A]">
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
                  day.isToday ? "bg-white/5 border border-[#A78BFA]/50" :
                  day.isProjected ? "bg-white/[0.02] border border-dashed border-white/10" :
                  !day.isCurrentMonth ? "opacity-10" :
                  "bg-white/[0.03] border border-white/[0.05] hover:border-white/20"
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
                      day.isToday ? "text-[#A78BFA] font-bold" : 
                      "text-white/40"
                    )}>
                      {day.date.getDate().toString().padStart(2, '0')}
                    </span>
                    {day.isToday && (
                      <div className="w-1 h-1 rounded-full bg-[#A78BFA] shadow-[0_0_10px_#A78BFA]" />
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
                              day.pnl > 0 ? "text-[#3BF68A]" : "text-[#F45B69]"
                            )}>
                              {formatCurrency(day.pnl)}
                            </div>
                          ) : day.isPast && day.isCurrentMonth ? (
                            <div className="w-1 h-1 rounded-full bg-white/10 mx-auto" />
                          ) : null}
                          
                          {day.isProjected && !day.isGoalDay && day.pnl !== 0 && (
                            <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-[#A78BFA]/20 w-full" />
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
          <div className="p-6 rounded-[2.5rem] bg-[#15181F] border border-[#1F2937] shadow-xl relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-[#A78BFA]/5 rounded-full blur-xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <Quote className="w-4 h-4 text-[#A78BFA]" />
                <span className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em]">Daily Wisdom</span>
              </div>
              <p className="text-sm text-white font-medium italic leading-relaxed">
                "{quote}"
              </p>
            </div>
          </div>

          {/* FOCUS TASKS WIDGET */}
          <div className="p-6 rounded-[2.5rem] bg-[#0D0F12] border border-[#1F2937] shadow-xl relative overflow-hidden group">
            <div className="absolute -left-4 -top-4 w-16 h-16 bg-[#3BF68A]/5 rounded-full blur-xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#3BF68A]" />
                <span className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em]">Focus Points</span>
              </div>
              <div className="space-y-3">
                {[
                  "Wait for your setup - No FOMO",
                  "Respect the hard stop loss",
                  "Check daily economic news"
                ].map((task, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-[#8B94A7] font-medium border-b border-[#1F2937] pb-2 last:border-0 last:pb-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3BF68A]" />
                    {task}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* QUICK STATS WIDGET */}
          <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-[#1A1D25] to-[#15181F] border border-[#1F2937] shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em]">Gap to Summit</div>
                <div className="text-2xl font-black text-white tracking-tighter">${remainingPnL.toLocaleString()}</div>
              </div>
              <div className={clsx(
                "w-14 h-14 rounded-2xl flex items-center justify-center border-2",
                isFunded ? "bg-[#3BF68A]/10 border-[#3BF68A]/20 text-[#3BF68A]" : "bg-[#A78BFA]/10 border-[#A78BFA]/20 text-[#A78BFA]"
              )}>
                {isFunded ? <Shield className="w-6 h-6" /> : <Mountain className="w-6 h-6" />}
              </div>
            </div>
          </div>

          {/* CONSISTENCY SCORE WIDGET */}
          <div className={clsx(
            "p-6 rounded-[2.5rem] border shadow-xl overflow-hidden group relative transition-colors",
            theme === 'dark' 
              ? "bg-[#15181F] border-[#1F2937]" 
              : "bg-[#F8F9FB] border-gray-100"
          )}>
            <div className="space-y-4">
              {/* Header with Consistency % Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#10B981]/10">
                    <CheckSquare className="w-4 h-4 text-[#10B981]" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={clsx(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-[#E5E7EB]" : "text-gray-900"
                    )}>Consistency</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Current Consistency % / Rule % Badge */}
                  <div className="px-2.5 py-1 rounded-full bg-[#10B981] text-xs font-bold text-white">
                    {consistencyMetrics.currentConsistencyPercent.toFixed(2)}/{consistencyRule}%
                  </div>
                  {/* Qualified/Not Yet Badge */}
                  <div className={clsx(
                    "px-3 py-1 rounded-full text-xs font-bold text-white",
                    consistencyMetrics.isQualified ? "bg-[#10B981]" : "bg-[#F45B69]"
                  )}>
                    {consistencyMetrics.isQualified ? "Qualified" : "Not Yet"}
                  </div>
                </div>
              </div>

              {/* Metrics List */}
              <div className="space-y-0">
                {/* Highest Profit Day */}
                <div className={clsx(
                  "flex items-center justify-between py-3 border-b",
                  theme === 'dark' ? "border-[#1F2937]" : "border-gray-200"
                )}>
                  <span className={clsx("text-sm", theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                    Highest Profit Day
                  </span>
                  <span className={clsx(
                    "text-sm font-semibold",
                    theme === 'dark' ? "text-[#E5E7EB]" : "text-gray-900"
                  )}>
                    {consistencyMetrics.highestDay.toFixed(2)}
                  </span>
                </div>

                {/* Current Total Profit */}
                <div className={clsx(
                  "flex items-center justify-between py-3 border-b",
                  theme === 'dark' ? "border-[#1F2937]" : "border-gray-200"
                )}>
                  <span className={clsx("text-sm", theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                    Current Total Profit
                  </span>
                  <span className={clsx(
                    "text-sm font-semibold",
                    theme === 'dark' ? "text-[#E5E7EB]" : "text-gray-900"
                  )}>
                    {consistencyMetrics.currentTotalProfit.toFixed(2)}
                  </span>
                </div>

                {/* Minimum Required Profit to Qualify */}
                <div className="flex items-center justify-between py-3">
                  <span className={clsx("text-sm", theme === 'dark' ? "text-[#8B94A7]" : "text-gray-600")}>
                    Minimum Required Profit to Qualify
                  </span>
                  <span className={clsx(
                    "text-sm font-semibold",
                    theme === 'dark' ? "text-[#E5E7EB]" : "text-gray-900"
                  )}>
                    {consistencyMetrics.minimumRequiredProfit.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Rule Selector */}
              <div className="pt-1">
                <label className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.2em] mb-2 block">
                  Consistency Rule
                </label>
                <div className={clsx(
                  "flex p-1 rounded-xl border",
                  theme === 'dark' ? "bg-[#0B0D10] border-[#1F2937]" : "bg-gray-50 border-gray-200"
                )}>
                  {[15, 20, 30, 40, 50].map((rule) => (
                    <button
                      key={rule}
                      onClick={() => handleConsistencyChange(rule)}
                      className={clsx(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                        consistencyRule === rule 
                          ? (theme === 'dark' ? "bg-[#1F2937] text-white shadow-lg" : "bg-white text-gray-900 shadow-sm border border-gray-100")
                          : (theme === 'dark' ? "text-[#8B94A7] hover:text-[#E5E7EB]" : "text-gray-500 hover:text-gray-900")
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
      </div>

      {/* FOOTER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 rounded-[2.5rem] bg-[#15181F] border border-[#1F2937] shadow-xl">
          <div className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.3em] mb-4">Pacing Analysis</div>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-3xl font-black text-white">${PACE_CONFIG[pace].dailyTarget}</div>
              <div className="text-[9px] font-bold text-[#3BF68A] uppercase tracking-widest">Daily Pace Target</div>
            </div>
            
            <div className="flex gap-8">
               <div className="text-right space-y-2">
                <div className="text-3xl font-black text-white">${remainingPnL.toLocaleString()}</div>
                <div className="text-[9px] font-bold text-[#F45B69] uppercase tracking-widest">Gap to Summit</div>
              </div>
              
              <div className="text-right space-y-2">
                <div className="text-3xl font-black text-white">
                  {Math.ceil(remainingPnL / PACE_CONFIG[pace].dailyTarget)}
                </div>
                <div className="text-[9px] font-bold text-[#A78BFA] uppercase tracking-widest">Trading Days Left</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-[#0D0F12] to-[#1A1D25] border border-[#1F2937] shadow-xl flex items-center justify-between">
          <div className="space-y-4">
            <div className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.3em]">Execution Insight</div>
            <p className="text-xs text-[#8B94A7] leading-relaxed max-w-[300px] font-medium italic">
              "The {pace} approach is about precision over volume. Every single trade should move you closer to the {target.toLocaleString()} target with maximum discipline."
            </p>
          </div>
          <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center border border-white/10">
            <TrendingUp className="w-8 h-8 text-[#3BF68A]" />
          </div>
        </div>
      </div>
        </>
      ) : (
        <ConsistencyGuardian 
          account={account} 
          actualDailyPnL={actualDailyPnL}
        />
      )}
    </div>
  );
};
