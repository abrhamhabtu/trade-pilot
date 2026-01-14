import React, { useMemo } from 'react';
import { Tooltip } from '../Tooltip';
import { useRoutineStore } from '../../store/routineStore';
import { ExternalLink } from 'lucide-react';

interface ProgressTrackerProps {
  onViewMore?: () => void;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ onViewMore }) => {
  const { gamePlans, tradingRules } = useRoutineStore();

  // Generate last 10 weeks of data for the heatmap (wider display)
  const heatmapData = useMemo(() => {
    const weeks: { date: Date; score: number; hasData: boolean }[][] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get the most recent Sunday (start of current week)
    const currentDayOfWeek = today.getDay();
    const mostRecentSunday = new Date(today);
    mostRecentSunday.setDate(today.getDate() - currentDayOfWeek);

    // Go back 9 more weeks (10 weeks total including current)
    const startDate = new Date(mostRecentSunday);
    startDate.setDate(startDate.getDate() - 9 * 7);

    // Build 10 weeks of data
    for (let week = 0; week < 10; week++) {
      const weekData: { date: Date; score: number; hasData: boolean }[] = [];
      
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + week * 7 + day);
        
        const dateStr = currentDate.toISOString().split('T')[0];
        const gamePlan = gamePlans[dateStr];
        
        let score = 0;
        let hasData = false;

        if (gamePlan && gamePlan.ruleCompliance && gamePlan.ruleCompliance.length > 0) {
          const activeRules = tradingRules.filter(r => r.isActive);
          const ratedRules = gamePlan.ruleCompliance.filter(rc => rc.followed !== null);
          
          if (ratedRules.length > 0) {
            hasData = true;
            const followedCount = ratedRules.filter(rc => rc.followed === true).length;
            score = Math.round((followedCount / activeRules.length) * 100);
          }
        } else if (gamePlan && gamePlan.completed) {
          hasData = true;
          score = 50;
        }

        weekData.push({ date: currentDate, score, hasData });
      }
      
      weeks.push(weekData);
    }

    return weeks;
  }, [gamePlans, tradingRules]);

  // Calculate overall stats
  const stats = useMemo(() => {
    let totalDays = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    const allDays = heatmapData.flat().filter(d => d.hasData);
    totalDays = allDays.length;

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

    return { totalDays, currentStreak, maxStreak };
  }, [heatmapData]);

  const getColorForScore = (score: number, hasData: boolean): string => {
    if (!hasData) return '#1F2937';
    if (score >= 80) return '#3BF68A';
    if (score >= 60) return '#86EFAC';
    if (score >= 40) return '#FCD34D';
    if (score >= 20) return '#FB923C';
    return '#F45B69';
  };

  const getMonthLabel = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  // Get unique months for labels
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

  const tooltipContent = `Track your consistency in following your trading rules.\n\n🟢 Green = 80%+ rules followed\n🟡 Yellow = 40-79% rules followed\n🔴 Red = Less than 40%\n⬛ Gray = No trading activity\n\nLog your rule compliance in the Routine page after each trading session.`;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Cell size for bigger display
  const cellSize = 18;
  const cellGap = 4;

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
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-[#E5E7EB] text-base font-semibold">Progress tracker</h3>
            <Tooltip content={tooltipContent} position="top">
              <div className="w-5 h-5 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help hover:bg-[#3BF68A]/20 transition-colors">
                <span className="text-[#8B94A7] text-xs">?</span>
              </div>
            </Tooltip>
          </div>
          {onViewMore && (
            <button 
              onClick={onViewMore}
              className="text-[#A78BFA] text-sm font-medium hover:text-[#C4B5FD] transition-colors flex items-center space-x-1"
            >
              <span>View more</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        {/* Heatmap Grid - Larger cells */}
        <div className="flex-1 px-5 pb-3 flex flex-col justify-center">
          {/* Month labels */}
          <div className="flex mb-2" style={{ marginLeft: '42px' }}>
            {monthLabels.map((month, idx) => (
              <div 
                key={idx}
                className="text-[#8B94A7] text-xs font-medium"
                style={{ 
                  position: 'absolute',
                  left: `${60 + month.weekIndex * (cellSize + cellGap)}px`
                }}
              >
                {month.label}
              </div>
            ))}
          </div>

          {/* Grid with day labels */}
          <div className="flex mt-4">
            {/* Day labels */}
            <div className="flex flex-col mr-3" style={{ gap: `${cellGap}px` }}>
              {dayLabels.map((day, idx) => (
                <div 
                  key={day} 
                  className="text-[#8B94A7] text-xs font-medium flex items-center justify-end"
                  style={{ height: `${cellSize}px`, width: '32px' }}
                >
                  {idx % 2 === 1 ? day : ''}
                </div>
              ))}
            </div>

            {/* Heatmap cells - Bigger */}
            <div className="flex" style={{ gap: `${cellGap}px` }}>
              {heatmapData.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col" style={{ gap: `${cellGap}px` }}>
                  {week.map((day, dayIdx) => {
                    const isToday = day.date.toDateString() === new Date().toDateString();
                    const isFuture = day.date > new Date();
                    
                    return (
                      <div
                        key={dayIdx}
                        className={`rounded transition-all duration-200 ${
                          isToday ? 'ring-2 ring-[#A78BFA] ring-offset-1 ring-offset-[#15181F]' : ''
                        } ${!isFuture ? 'hover:scale-110 cursor-pointer hover:ring-1 hover:ring-white/30' : 'opacity-30'}`}
                        style={{
                          width: `${cellSize}px`,
                          height: `${cellSize}px`,
                          backgroundColor: isFuture ? '#1F2937' : getColorForScore(day.score, day.hasData),
                        }}
                        title={isFuture ? 'Future date' : `${day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.hasData ? `${day.score}% rules followed` : 'No data'}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend - Bigger */}
          <div className="flex items-center justify-end mt-4 space-x-3">
            <span className="text-[#8B94A7] text-xs">Less</span>
            <div className="flex space-x-1.5">
              {['#1F2937', '#F45B69', '#FB923C', '#FCD34D', '#86EFAC', '#3BF68A'].map((color, idx) => (
                <div
                  key={idx}
                  className="rounded"
                  style={{ 
                    width: `${cellSize - 4}px`, 
                    height: `${cellSize - 4}px`,
                    backgroundColor: color 
                  }}
                />
              ))}
            </div>
            <span className="text-[#8B94A7] text-xs">More</span>
          </div>
        </div>

        {/* Stats Footer - Bigger text */}
        <div className="px-5 pb-4 pt-3 border-t border-[#1F2937]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div>
                <div className="text-[#8B94A7] text-xs uppercase tracking-wider font-medium">Today's score</div>
                <div className="text-[#E5E7EB] text-xl font-bold mt-0.5">
                  {heatmapData[9]?.[new Date().getDay()]?.hasData 
                    ? `${heatmapData[9][new Date().getDay()].score}%`
                    : '0/5'}
                </div>
              </div>
              <div className="w-px h-10 bg-[#1F2937]" />
              <div>
                <div className="text-[#8B94A7] text-xs uppercase tracking-wider font-medium">Current streak</div>
                <div className="text-[#3BF68A] text-xl font-bold mt-0.5">
                  {stats.currentStreak} days
                </div>
              </div>
            </div>
            <button 
              className="px-5 py-2.5 bg-[#1F2937] hover:bg-[#374151] rounded-lg text-[#E5E7EB] text-sm font-medium transition-colors"
              onClick={onViewMore}
            >
              Daily checklist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
