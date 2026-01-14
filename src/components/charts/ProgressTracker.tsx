import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Tooltip } from '../Tooltip';
import { useRoutineStore } from '../../store/routineStore';
import { ExternalLink, X, Check, Flame, Trophy, Zap, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import clsx from 'clsx';

interface ProgressTrackerProps {
  onViewMore?: () => void;
}

interface DayData {
  date: Date;
  score: number;
  hasData: boolean;
  rulesFollowed: number;
  totalRules: number;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ onViewMore }) => {
  const { gamePlans, tradingRules, batchUpdateRuleCompliance, getGamePlan } = useRoutineStore();
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [logDate, setLogDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    return d;
  });
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ weekIdx: number; dayIdx: number } | null>(null);

  // Generate last 8 weeks of data (fits better with larger cells)
  const heatmapData = useMemo(() => {
    const weeks: DayData[][] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentDayOfWeek = today.getDay();
    const mostRecentSunday = new Date(today);
    mostRecentSunday.setDate(today.getDate() - currentDayOfWeek);

    const startDate = new Date(mostRecentSunday);
    startDate.setDate(startDate.getDate() - 7 * 7);

    for (let week = 0; week < 8; week++) {
      const weekData: DayData[] = [];
      
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + week * 7 + day);
        
        // Use LOCAL date to avoid timezone issues
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayNum = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;
        const gamePlan = gamePlans[dateStr];
        
        let score = 0;
        let hasData = false;
        let rulesFollowed = 0;
        const totalRules = tradingRules.filter(r => r.isActive).length;

        if (gamePlan && gamePlan.ruleCompliance && gamePlan.ruleCompliance.length > 0) {
          const ratedRules = gamePlan.ruleCompliance.filter(rc => rc.followed !== null);
          
          if (ratedRules.length > 0) {
            hasData = true;
            rulesFollowed = ratedRules.filter(rc => rc.followed === true).length;
            // Calculate score based on ACTUAL rules answered, not just followed
            score = Math.round((rulesFollowed / totalRules) * 100);
          }
        } else if (gamePlan && gamePlan.completed) {
          hasData = true;
          score = 50;
        }

        weekData.push({ date: currentDate, score, hasData, rulesFollowed, totalRules });
      }
      
      weeks.push(weekData);
    }

    return weeks;
  }, [gamePlans, tradingRules]);

  // Calculate stats
  const stats = useMemo(() => {
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    const allDays = heatmapData.flat().filter(d => d.hasData);

    const sortedDays = [...allDays].sort((a, b) => b.date.getTime() - a.date.getTime());
    
    for (const day of sortedDays) {
      if (day.score >= 80) {
        tempStreak++;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        if (currentStreak === 0 && tempStreak > 0) {
          currentStreak = tempStreak;
        }
        tempStreak = 0;
      }
    }
    
    if (tempStreak > 0 && currentStreak === 0) {
      currentStreak = tempStreak;
    }

    return { currentStreak, maxStreak };
  }, [heatmapData]);

  const getColorForScore = (score: number, hasData: boolean): string => {
    if (!hasData) return '#252A36'; // Slightly visible empty state
    if (score >= 80) return '#22C55E'; // Vibrant green
    if (score >= 60) return '#4ADE80'; // Light green  
    if (score >= 40) return '#FACC15'; // Warm yellow
    if (score >= 20) return '#F97316'; // Orange
    return '#EF4444'; // Clear red
  };

  const getMonthLabel = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const monthLabels = useMemo(() => {
    const months: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    heatmapData.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0].date;
      const month = firstDayOfWeek.getMonth();
      
      if (month !== lastMonth) {
        months.push({ label: getMonthLabel(firstDayOfWeek), weekIndex });
        lastMonth = month;
      }
    });

    return months;
  }, [heatmapData]);

  const tooltipContent = `Track your consistency in following your trading rules.\n\nClick any day to log your progress.\n\n🟢 80%+ · 🟡 40-79% · 🔴 <40%`;

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cellSize = 28;
  const cellGap = 4;

  const activeRules = tradingRules.filter(r => r.isActive);

  // Helper to get today's date string consistently
  const getTodayDateString = useCallback(() => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }, []);

  // Get current today data
  const todayData = useMemo(() => {
    try {
      const todayStr = getTodayDateString();
      if (!todayStr) return undefined;
      
      const allDays = heatmapData.flat();
      return allDays.find(d => {
        if (!d || !d.date) return false;
        try {
          const year = d.date.getFullYear();
          const month = String(d.date.getMonth() + 1).padStart(2, '0');
          const day = String(d.date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}` === todayStr;
        } catch {
          return false;
        }
      });
    } catch (e) {
      console.error('Error calculating todayData:', e);
      return undefined;
    }
  }, [heatmapData, getTodayDateString]);

  // Get date string safely - using LOCAL date to avoid timezone issues
  const getDateString = useCallback((date: Date): string => {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return getTodayDateString();
    }
  }, [getTodayDateString]);

  // Format date for display
  const formatLogDate = useCallback((date: Date): string => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const compareDate = new Date(date);
      compareDate.setHours(0, 0, 0, 0);
      
      if (compareDate.getTime() === today.getTime()) {
        return 'Today';
      }
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (compareDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
      }
      
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return 'Today';
    }
  }, []);

  // Navigate to previous/next day
  const navigateDay = useCallback((direction: 'prev' | 'next') => {
    setLogDate(currentDate => {
      const newDate = new Date(currentDate);
      newDate.setHours(12, 0, 0, 0); // Keep at noon
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      
      // Don't allow future dates
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (newDate <= today) {
        setPendingChanges({}); // Reset pending changes when changing date
        return newDate;
      }
      return currentDate;
    });
  }, []);

  // Check if can go to next day
  const canGoNext = useMemo(() => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const compareDate = new Date(logDate);
      compareDate.setHours(0, 0, 0, 0);
      return compareDate < today;
    } catch {
      return false;
    }
  }, [logDate]);

  // Get current status (pending or saved) for the selected logDate
  const getRuleStatus = useCallback((ruleId: string): boolean | null => {
    if (pendingChanges[ruleId] !== undefined) {
      return pendingChanges[ruleId];
    }
    try {
      const dateStr = getDateString(logDate);
      const gamePlan = getGamePlan(dateStr);
      const compliance = gamePlan.ruleCompliance.find(rc => rc.ruleId === ruleId);
      return compliance?.followed ?? null;
    } catch {
      return null;
    }
  }, [pendingChanges, getGamePlan, logDate, getDateString]);

  // Toggle rule in pending changes
  const handleRuleToggle = (ruleId: string, followed: boolean) => {
    setPendingChanges(prev => {
      const newChanges = { ...prev };
      // If clicking same value, remove from pending (toggle off)
      if (newChanges[ruleId] === followed) {
        delete newChanges[ruleId];
      } else {
        newChanges[ruleId] = followed;
      }
      return newChanges;
    });
  };

  // Handle success state auto-close
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setShowQuickLog(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // Submit all changes for the selected date
  const handleSubmit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isSaving) return;
    
    const changesCount = Object.keys(pendingChanges).length;
    if (changesCount === 0) {
      setShowQuickLog(false);
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Use consistent local date string
      const dateStr = getDateString(logDate);
      
      // Apply all pending changes in one batch
      batchUpdateRuleCompliance(dateStr, pendingChanges);

      // Brief delay for better UX and state synchronization
      setTimeout(() => {
        setPendingChanges({});
        setShowSuccess(true);
        setIsSaving(false);
      }, 400);
    } catch (err) {
      console.error('Submit failed:', err);
      setIsSaving(false);
    }
  }, [pendingChanges, logDate, getDateString, batchUpdateRuleCompliance, isSaving]);

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const rulesAnswered = activeRules.filter(r => getRuleStatus(r.id) !== null).length;

  return (
    <div 
      className="rounded-xl border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group h-full"
      style={{
        background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
      }}
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
        <div 
          className="w-full h-full rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        />
      </div>
      
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="px-3 pt-2 pb-1.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-white text-sm font-bold tracking-tight">Progress Tracker</h3>
            <Tooltip content={tooltipContent} position="top">
              <div className="w-4 h-4 rounded-full bg-[#374151] flex items-center justify-center cursor-help hover:bg-[#A78BFA]/30 transition-colors">
                <span className="text-[#9CA3AF] text-[10px] font-bold">?</span>
              </div>
            </Tooltip>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                if (!showQuickLog) {
                  const today = new Date();
                  today.setHours(12, 0, 0, 0);
                  setLogDate(today);
                }
                setShowQuickLog(!showQuickLog);
                setPendingChanges({});
              }}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1',
                showQuickLog 
                  ? 'bg-[#A78BFA] text-white shadow-lg shadow-[#A78BFA]/30' 
                  : 'bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 border border-[#A78BFA]/30'
              )}
            >
              <Zap className="w-3 h-3" />
              <span>Quick Log</span>
            </button>
            {onViewMore && (
              <button 
                onClick={onViewMore}
                className="w-7 h-7 rounded-lg bg-[#374151]/50 hover:bg-[#374151] flex items-center justify-center text-[#9CA3AF] hover:text-white transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Log Modal - Full Screen Overlay */}
        {showQuickLog && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setShowQuickLog(false)}
            />
            
            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] max-w-[90vw] rounded-2xl overflow-hidden border border-[#A78BFA]/40 bg-[#0D0F12] shadow-2xl shadow-black/80">
              {/* Success Overlay */}
              {showSuccess && (
                <div className="absolute inset-0 bg-[#22C55E]/10 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl">
                  <div className="flex items-center space-x-3 text-[#22C55E] bg-[#22C55E]/20 px-6 py-3 rounded-full">
                    <Check className="w-6 h-6" />
                    <span className="text-lg font-semibold">Saved!</span>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-[#A78BFA]/15 to-[#A78BFA]/5 border-b border-[#374151]/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-[#A78BFA]/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-[#A78BFA]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Log Your Rules</h2>
                      <p className="text-sm text-[#9CA3AF]">Track your trading discipline</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowQuickLog(false)}
                    className="w-10 h-10 rounded-xl bg-[#374151]/50 hover:bg-[#EF4444]/20 flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Date Navigator */}
                <div className="mt-4 flex items-center justify-center">
                  <div className="flex items-center space-x-2 bg-[#1F2937] rounded-xl p-1">
                    <button 
                      onClick={() => navigateDay('prev')}
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-white hover:bg-[#374151] transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-base font-bold text-white min-w-[140px] text-center px-4">
                      {formatLogDate(logDate)}
                    </span>
                    <button 
                      onClick={() => navigateDay('next')}
                      disabled={!canGoNext}
                      className={clsx(
                        'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                        canGoNext 
                          ? 'text-[#9CA3AF] hover:text-white hover:bg-[#374151]' 
                          : 'text-[#374151] cursor-not-allowed'
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Rules List - No scroll needed */}
              <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
                {activeRules.map((rule, index) => {
                  const status = getRuleStatus(rule.id);
                  const isPending = pendingChanges[rule.id] !== undefined;
                  
                  return (
                    <div 
                      key={rule.id}
                      className={clsx(
                        'flex items-center justify-between p-4 rounded-xl transition-all',
                        isPending 
                          ? 'bg-[#A78BFA]/15 border-2 border-[#A78BFA]/40' 
                          : 'bg-[#1F2937]/70 hover:bg-[#1F2937] border-2 border-transparent'
                      )}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-[#374151] flex items-center justify-center text-xs font-bold text-[#9CA3AF]">
                          {index + 1}
                        </span>
                        <span className="text-sm text-[#E5E7EB] font-medium">{rule.text}</span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRuleToggle(rule.id, true);
                          }}
                          className={clsx(
                            'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                            status === true
                              ? 'bg-[#22C55E] text-white shadow-lg shadow-[#22C55E]/40 scale-105'
                              : 'bg-[#374151] text-[#9CA3AF] hover:text-[#22C55E] hover:bg-[#22C55E]/20 hover:scale-105'
                          )}
                        >
                          <Check className="w-6 h-6" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRuleToggle(rule.id, false);
                          }}
                          className={clsx(
                            'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                            status === false
                              ? 'bg-[#EF4444] text-white shadow-lg shadow-[#EF4444]/40 scale-105'
                              : 'bg-[#374151] text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/20 hover:scale-105'
                          )}
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-[#15181F] border-t border-[#374151]/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Progress bar */}
                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-2 bg-[#374151] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#A78BFA] to-[#22C55E] rounded-full transition-all duration-300"
                          style={{ width: `${(rulesAnswered / activeRules.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-[#9CA3AF] font-medium">
                        {rulesAnswered}/{activeRules.length} logged
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmit(e);
                    }}
                    disabled={!hasPendingChanges || isSaving}
                    className={clsx(
                      'px-8 py-3 rounded-xl text-base font-bold transition-all flex items-center space-x-2 min-w-[180px] justify-center',
                      hasPendingChanges && !isSaving
                        ? 'bg-[#22C55E] text-white hover:bg-[#16A34A] shadow-lg shadow-[#22C55E]/40 hover:scale-105 active:scale-95'
                        : isSaving
                          ? 'bg-[#22C55E]/70 text-white cursor-wait'
                          : 'bg-[#374151] text-[#6B7280] cursor-not-allowed'
                    )}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>Save Progress</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Main Content - Side by Side Layout */}
        <div className="flex-1 px-3 pb-2 flex overflow-hidden">
          {/* Left Side - Heatmap */}
          <div className="flex-1 flex flex-col justify-center min-h-0">
            {/* Month labels */}
            <div className="flex mb-1.5 relative" style={{ marginLeft: '20px', height: '14px' }}>
              {monthLabels.map((month, idx) => {
                // Calculate position accounting for month separators
                let position = 0;
                for (let i = 0; i < month.weekIndex; i++) {
                  position += cellSize + cellGap;
                  // Add extra space for month separators
                  if (i > 0 && heatmapData[i] && heatmapData[i-1] && 
                      heatmapData[i][0].date.getMonth() !== heatmapData[i-1][0].date.getMonth()) {
                    position += 21; // 10px margin + 10px padding + 1px border
                  }
                }
                return (
                  <div 
                    key={idx}
                    className="text-[#9CA3AF] text-[10px] font-bold absolute tracking-wide uppercase"
                    style={{ left: `${position}px` }}
                  >
                    {month.label}
                  </div>
                );
              })}
            </div>

            {/* Grid */}
            <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col mr-1.5" style={{ gap: `${cellGap}px` }}>
              {dayLabels.map((day, idx) => (
                <div 
                  key={`${day}-${idx}`}
                  className="text-[#6B7280] text-[10px] font-semibold flex items-center justify-end"
                  style={{ height: `${cellSize}px`, width: '16px' }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Heatmap cells */}
            <div className="flex">
              {heatmapData.map((week, weekIdx) => {
                // Check if this week starts a new month
                const isNewMonth = weekIdx > 0 && 
                  week[0].date.getMonth() !== heatmapData[weekIdx - 1][0].date.getMonth();
                
                return (
                  <div 
                    key={weekIdx} 
                    className="flex flex-col"
                    style={{ 
                      gap: `${cellGap}px`,
                      marginLeft: isNewMonth ? '10px' : weekIdx === 0 ? '0' : `${cellGap}px`,
                      paddingLeft: isNewMonth ? '10px' : '0',
                      borderLeft: isNewMonth ? '1px solid rgba(107, 114, 128, 0.3)' : 'none',
                    }}
                  >
                    {week.map((day, dayIdx) => {
                      let isToday = false;
                      let isFuture = false;
                      let isLogDateCell = false;
                      const isWeekend = dayIdx === 0 || dayIdx === 6; // Sunday or Saturday
                      const isHovered = hoveredCell?.weekIdx === weekIdx && hoveredCell?.dayIdx === dayIdx;
                      
                      try {
                        isToday = day.date.toDateString() === new Date().toDateString();
                        isFuture = day.date > new Date();
                        isLogDateCell = showQuickLog && logDate.toDateString() === day.date.toDateString();
                      } catch {
                        // Ignore date comparison errors
                      }
                      
                      // Weekend cells have a distinct muted style
                      const getBackgroundColor = () => {
                        if (isFuture) return '#1F2937';
                        if (isWeekend && !day.hasData) return '#1a1d24'; // Darker muted for empty weekends
                        return getColorForScore(day.score, day.hasData);
                      };
                      
                      return (
                        <div
                          key={dayIdx}
                          className="relative"
                          onMouseEnter={() => !isFuture && setHoveredCell({ weekIdx, dayIdx })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {/* Hover Tooltip */}
                          {isHovered && !isFuture && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
                              <div className="bg-[#1F2937] border border-[#374151] rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                                <div className="text-[10px] font-bold text-white">
                                  {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </div>
                                <div className={clsx(
                                  'text-[9px] font-medium',
                                  day.hasData 
                                    ? day.score >= 80 ? 'text-[#22C55E]' : day.score >= 40 ? 'text-[#FACC15]' : 'text-[#EF4444]'
                                    : 'text-[#6B7280]'
                                )}>
                                  {day.hasData ? `${day.score}% compliance` : 'Click to log'}
                                </div>
                              </div>
                              {/* Arrow */}
                              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-[#1F2937] border-r border-b border-[#374151] rotate-45" />
                            </div>
                          )}
                          
                          <div
                            onClick={() => {
                              if (isFuture) return;
                              const newDate = new Date(day.date);
                              newDate.setHours(12, 0, 0, 0);
                              setLogDate(newDate);
                              setPendingChanges({});
                              setShowQuickLog(true);
                            }}
                            className={clsx(
                              'rounded-md transition-all duration-200 cursor-pointer',
                              isToday && 'ring-2 ring-[#A78BFA] ring-offset-1 ring-offset-[#15181F]',
                              isLogDateCell && 'ring-2 ring-white scale-105 z-10',
                              !isFuture && !isLogDateCell && 'hover:scale-110 hover:brightness-125',
                              isFuture && 'opacity-20 cursor-not-allowed',
                              isWeekend && !day.hasData && !isFuture && 'border border-dashed border-[#374151]'
                            )}
                            style={{
                              width: `${cellSize}px`,
                              height: `${cellSize}px`,
                              backgroundColor: getBackgroundColor(),
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            </div>

            {/* Legend - Compact */}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center space-x-0.5">
                <span className="text-[#6B7280] text-[8px] font-medium mr-0.5">0%</span>
                {['#252A36', '#EF4444', '#F97316', '#FACC15', '#4ADE80', '#22C55E'].map((color, idx) => (
                  <div key={idx} className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                ))}
                <span className="text-[#6B7280] text-[8px] font-medium ml-0.5">100%</span>
              </div>
              <div className="flex items-center space-x-1 ml-2">
                <div className="w-3 h-3 rounded-sm bg-[#1a1d24] border border-dashed border-[#374151]" />
                <span className="text-[#6B7280] text-[8px] font-medium">Weekend</span>
              </div>
            </div>
          </div>

          {/* Right Side - Today's Score Circle & Stats */}
          <div className="w-[130px] flex flex-col items-center justify-center pl-3 border-l border-[#374151]/30">
            {/* Score Circle */}
            <div className="relative mb-1">
              <svg width="90" height="90" viewBox="0 0 90 90">
                {/* Background circle */}
                <circle
                  cx="45"
                  cy="45"
                  r="38"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="8"
                />
                {/* Progress circle */}
                <circle
                  cx="45"
                  cy="45"
                  r="38"
                  fill="none"
                  stroke={todayData?.hasData ? getColorForScore(todayData.score, true) : '#374151'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(todayData?.hasData ? todayData.score : 0) * 2.39} 239`}
                  transform="rotate(-90 45 45)"
                  className="transition-all duration-500"
                  style={{
                    filter: todayData?.hasData ? `drop-shadow(0 0 6px ${getColorForScore(todayData.score, true)}60)` : 'none'
                  }}
                />
              </svg>
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={clsx(
                  'text-xl font-bold',
                  todayData?.hasData ? 'text-white' : 'text-[#6B7280]'
                )}>
                  {todayData?.hasData ? `${todayData.score}%` : '—'}
                </span>
                <span className="text-[8px] text-[#6B7280] font-semibold tracking-wider">TODAY</span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center space-x-3">
              {/* Streak */}
              <div className="flex flex-col items-center">
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center mb-0.5',
                  stats.currentStreak > 0 ? 'bg-[#F97316]/20' : 'bg-[#374151]/50'
                )}>
                  <Flame className={clsx('w-3.5 h-3.5', stats.currentStreak > 0 ? 'text-[#F97316]' : 'text-[#6B7280]')} />
                </div>
                <span className={clsx(
                  'text-base font-bold leading-tight',
                  stats.currentStreak > 0 ? 'text-[#F97316]' : 'text-[#6B7280]'
                )}>
                  {stats.currentStreak}
                </span>
                <span className="text-[7px] text-[#6B7280] uppercase">Streak</span>
              </div>

              {/* Best */}
              <div className="flex flex-col items-center">
                <div className={clsx(
                  'w-7 h-7 rounded-lg flex items-center justify-center mb-0.5',
                  stats.maxStreak > 0 ? 'bg-[#FACC15]/20' : 'bg-[#374151]/50'
                )}>
                  <Trophy className={clsx('w-3.5 h-3.5', stats.maxStreak > 0 ? 'text-[#FACC15]' : 'text-[#6B7280]')} />
                </div>
                <span className={clsx(
                  'text-base font-bold leading-tight',
                  stats.maxStreak > 0 ? 'text-[#FACC15]' : 'text-[#6B7280]'
                )}>
                  {stats.maxStreak}
                </span>
                <span className="text-[7px] text-[#6B7280] uppercase">Best</span>
              </div>
            </div>

            {/* Full Routine Button */}
            <button 
              className="mt-2 w-full px-2 py-1.5 bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 border border-[#A78BFA]/30 rounded-lg text-[#A78BFA] text-[9px] font-semibold transition-all hover:scale-105"
              onClick={onViewMore}
            >
              Full Routine →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
