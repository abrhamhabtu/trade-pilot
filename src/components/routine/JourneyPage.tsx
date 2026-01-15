import React, { useState, useMemo, useEffect } from 'react';
import { useAccountStore } from '../../store/accountStore';
import { 
  Trophy, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  Shield, 
  Zap, 
  Flame,
  AlertCircle,
  Mountain,
  Quote,
  CheckSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
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
  const { getSelectedAccount, updateAccount } = useAccountStore();
  const account = getSelectedAccount();
  
  const [target, setTarget] = useState(account?.profitTarget || 3000);
  const [isFunded, setIsFunded] = useState(account?.isFunded || false);
  const [pace, setPace] = useState<'conservative' | 'moderate' | 'aggressive'>(account?.pacingPreference || 'moderate');
  const [quote, setQuote] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    setQuote(TRADING_QUOTES[Math.floor(Math.random() * TRADING_QUOTES.length)]);
  }, []);

  // Update store when local funded state changes
  useEffect(() => {
    if (account && isFunded !== account.isFunded) {
      updateAccount(account.id, { isFunded });
    }
  }, [isFunded, account, updateAccount]);

  // Group existing trades by date
  const actualDailyPnL = useMemo(() => {
    if (!account) return {};
    return account.trades.reduce((acc, trade) => {
      const date = trade.date;
      acc[date] = (acc[date] || 0) + trade.netPL;
      return acc;
    }, {} as Record<string, number>);
  }, [account]);

  const currentPnL = account?.balance || 0;
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

    let runningTotalPnLForProjection = currentPnL;
    let goalReachedDay: Date | null = null;
    const dailyTarget = PACE_CONFIG[pace].dailyTarget;

    // Fixed 42 days (6 weeks) to maintain consistent grid height
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
        
        // Only track goalReachedDay if we haven't hit it yet and it's in the future
        if (!goalReachedDay && runningTotalPnLForProjection < projectionTarget) {
          runningTotalPnLForProjection += pnl;
          if (runningTotalPnLForProjection >= projectionTarget) {
            goalReachedDay = new Date(currentDate);
          }
        }
      }

      days.push({
        date: currentDate,
        dateStr,
        pnl,
        isPast,
        isToday,
        isProjected,
        isWeekend,
        isCurrentMonth,
        isGoalDay: goalReachedDay?.getTime() === currentDate.getTime()
      });
    }
    return { days, goalReachedDay };
  }, [actualDailyPnL, pace, projectionTarget, currentPnL, currentMonth]);

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
        
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* LEFT: Account Info */}
          <div className="lg:col-span-4 space-y-4">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none italic">
              {account.name}
            </h1>
            <div className="flex items-center space-x-4 text-white">
              <div>
                <div className="text-[8px] font-black text-[#4B5563] uppercase tracking-widest">Balance</div>
                <div className="text-xl font-black tabular-nums">${currentPnL.toLocaleString()}</div>
              </div>
              <div className="w-px h-6 bg-[#1F2937]" />
              <div>
                <div className="text-[8px] font-black text-[#4B5563] uppercase tracking-widest">Target</div>
                <div className="text-xl font-black text-[#3BF68A] tabular-nums">${target.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* CENTER: Inline Controls */}
          <div className="lg:col-span-5 space-y-4">
            {/* Account Type Toggle */}
            <div className="space-y-2">
              <label className="text-[8px] font-black text-[#4B5563] uppercase tracking-[0.2em]">Account Status</label>
              <div className="flex bg-[#0B0D10] p-1 rounded-2xl border border-[#1F2937]">
                <button
                  onClick={() => {
                    setIsFunded(false);
                    updateAccount(account.id, { isFunded: false });
                  }}
                  className={clsx(
                    "flex-1 py-2.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2",
                    !isFunded ? "bg-[#A78BFA] text-white shadow-lg" : "text-[#4B5563] hover:text-[#8B94A7]"
                  )}
                >
                  <Mountain className="w-3 h-3" />
                  Challenge
                </button>
                <button
                  onClick={() => {
                    setIsFunded(true);
                    updateAccount(account.id, { isFunded: true });
                  }}
                  className={clsx(
                    "flex-1 py-2.5 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2",
                    isFunded ? "bg-[#3BF68A] text-black shadow-lg" : "text-[#4B5563] hover:text-[#8B94A7]"
                  )}
                >
                  <Trophy className="w-3 h-3" />
                  Funded
                </button>
              </div>
            </div>

            {/* Pacing Strategy */}
            <div className="space-y-2">
              <label className="text-[8px] font-black text-[#4B5563] uppercase tracking-[0.2em]">Trading Pace</label>
              <div className="flex bg-[#0B0D10] p-1 rounded-2xl border border-[#1F2937]">
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
                        "flex-1 py-2.5 rounded-xl text-[8px] font-black tracking-wider uppercase transition-all flex items-center justify-center gap-1.5",
                        pace === p ? "bg-white text-black shadow-lg" : "text-[#4B5563] hover:text-[#8B94A7]"
                      )}
                    >
                      <Icon className="w-3 h-3" style={{ color: pace === p ? 'black' : PACE_CONFIG[p].color }} />
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Progress Ring & Target Input */}
          <div className="lg:col-span-3 flex items-center justify-end gap-4">
            {/* Target Input */}
            <div className="space-y-2">
              <label className="text-[8px] font-black text-[#4B5563] uppercase tracking-[0.2em]">Goal</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563] text-xs font-black">$</span>
                <input 
                  type="number" 
                  value={target}
                  onChange={(e) => {
                    setTarget(Number(e.target.value));
                    updateAccount(account.id, { profitTarget: Number(e.target.value) });
                  }}
                  className="w-28 bg-[#0B0D10] border border-[#1F2937] rounded-xl pl-6 pr-2 py-2.5 text-white font-black text-sm focus:outline-none focus:border-[#A78BFA] tabular-nums text-right"
                />
              </div>
            </div>

            {/* Progress Ring */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                <circle 
                  cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" 
                  strokeDasharray={214} 
                  strokeDashoffset={214 - (214 * progressPercent) / 100}
                  className={clsx("transition-all duration-1000 ease-out", isFunded ? "text-[#3BF68A]" : "text-[#A78BFA]")}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-black text-white">{progressPercent.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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

        </div>
      </div>

      {/* FOOTER METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-8 rounded-[2.5rem] bg-[#15181F] border border-[#1F2937] shadow-xl">
          <div className="text-[9px] font-black text-[#4B5563] uppercase tracking-[0.3em] mb-4">Pacing Analysis</div>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-3xl font-black text-white">${PACE_CONFIG[pace].dailyTarget}</div>
              <div className="text-[9px] font-bold text-[#3BF68A] uppercase tracking-widest">Required Daily Average</div>
            </div>
            <div className="text-right space-y-2">
              <div className="text-3xl font-black text-white">{Math.ceil(remainingPnL / PACE_CONFIG[pace].dailyTarget)}</div>
              <div className="text-[9px] font-bold text-[#A78BFA] uppercase tracking-widest">Est. Trading Days Left</div>
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
    </div>
  );
};
