'use client';

import Image from 'next/image';
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Image as ImageIcon, 
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Save,
  Plus,
  Camera,
  Maximize2,
  Target,
  Bold,
  Italic,
  List,
  DollarSign
} from 'lucide-react';
import clsx from 'clsx';
import { Trade, useTradingStore } from '../store/tradingStore';
import { useDailyNotesStore, NoteImage } from '../store/dailyNotesStore';
import { useAccountStore } from '../store/accountStore';
import { DayReviewModal } from './calendar/DayReviewModal';


interface CalendarData {
  date: string;
  pnl: number;
  trades: number;
}

interface CalendarProps {
  data: CalendarData[];
  trades: Trade[];
  accountId?: string;
}

export const Calendar: React.FC<CalendarProps> = ({ data, trades, accountId }) => {
  const { hasNote } = useDailyNotesStore();
  const { accounts, selectedAccountId } = useAccountStore();
  
  // Get adjustments for the current account
  const adjustments = useMemo(() => {
    const currentAccountId = accountId || selectedAccountId;
    if (!currentAccountId) return [];
    const account = accounts.find(a => a.id === currentAccountId);
    return account?.balanceAdjustments || [];
  }, [accounts, accountId, selectedAccountId]);
  
  // Helper to check if a date has an adjustment
  const hasAdjustment = (dateStr: string) => {
    return adjustments.some(adj => adj.date === dateStr);
  };
  
  // Get adjustment for a specific date
  const getAdjustmentForDate = (dateStr: string) => {
    return adjustments.find(adj => adj.date === dateStr);
  };
  
  // Start with the month that has the most recent trade data
  const getInitialDate = () => {
    if (data.length === 0) {
      return new Date(2025, 5, 1); // Default to June 2025
    }
    
    // Find the most recent trade date
    const sortedDates = data
      .map(d => new Date(d.date))
      .sort((a, b) => b.getTime() - a.getTime());
    
    if (sortedDates.length > 0) {
      const mostRecentDate = sortedDates[0];
      return new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), 1);
    }
    
    return new Date(2025, 5, 1); // Fallback to June 2025
  };

  const [currentDate, setCurrentDate] = useState(getInitialDate());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showTradePreview, setShowTradePreview] = useState(false);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const goToCurrentMonth = () => {
    // Go to the month with the most recent data, or June 2025 if no data
    setCurrentDate(getInitialDate());
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatCurrencyCompact = (value: number) => {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1000) {
      const formatted = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: abs >= 10000 ? 0 : 2,
        minimumFractionDigits: 0
      }).format(abs / 1000);
      return `${sign}$${formatted}K`;
    }
    return formatCurrency(value);
  };
  
  // Helper function to check if a date is a weekend
  const isWeekend = (day: number) => {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  };
  
  // Helper function to check if a date is in the future
  const isFutureDate = (day: number) => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today
    return date > today;
  };
  
  // Get day data from the actual data prop passed from App.tsx
  // Also includes any balance adjustments (payouts/deposits) for the day
  const getDayData = (day: number) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const tradeData = data.find(item => item.date === dateString);
    const adjustment = getAdjustmentForDate(dateString);
    
    // If there's an adjustment, add it to the P&L to show net account change (like TopOne)
    if (tradeData && adjustment) {
      return {
        ...tradeData,
        pnl: tradeData.pnl + adjustment.amount // Include adjustment in daily P&L
      };
    }
    
    // If there's only an adjustment (no trades), still show it as day data
    if (!tradeData && adjustment) {
      return {
        date: dateString,
        pnl: adjustment.amount,
        trades: 0
      };
    }
    
    return tradeData;
  };

  // Get trades for a specific date
  const getTradesForDate = (day: number) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return trades.filter(trade => trade.date === dateString);
  };
  
  // Calculate realistic win rate for a specific day based on actual trades
  const calculateDayWinRate = (dayData: CalendarData | undefined) => {
    if (!dayData || dayData.trades === 0) return 0;
    
    // Get all trades for this specific date from the trades prop
    const dayTrades = trades.filter(trade => trade.date === dayData.date);
    
    if (dayTrades.length === 0) return 0;
    
    // Calculate actual win rate from the trades
    const winningTrades = dayTrades.filter(trade => trade.outcome === 'win').length;
    const winRate = (winningTrades / dayTrades.length) * 100;
    
    return Math.round(winRate);
  };

  // Handle day click
  const handleDayClick = (day: number) => {
    const dayData = getDayData(day);
    if (dayData && dayData.trades > 0 && !isWeekend(day) && !isFutureDate(day)) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setSelectedDate(dateString);
      setShowTradePreview(true);
    }
  };
  
  // Calculate weekly data (only trading days) - Fixed to handle all months properly
  // Now includes balance adjustments (payouts/deposits) in weekly totals to match TopOne
  const getWeeklyData = () => {
    const weeks = [];
    const totalDaysToShow = Math.ceil((daysInMonth + firstDayOfWeek) / 7) * 7;
    
    for (let weekStart = 0; weekStart < totalDaysToShow; weekStart += 7) {
      const weekDays = [];
      let weekPnl = 0;
      let weekTrades = 0;
      let weekTradingDays = 0;
      
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const dayIndex = weekStart + dayOfWeek;
        
        if (dayIndex < firstDayOfWeek) {
          // Empty cell before month starts
          weekDays.push(null);
        } else {
          const day = dayIndex - firstDayOfWeek + 1;
          if (day <= daysInMonth) {
            weekDays.push(day);
            
            // Calculate week totals (now includes adjustments via getDayData)
            const dayData = getDayData(day);
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayAdjustment = getAdjustmentForDate(dateString);
            
            if (!isWeekend(day) && !isFutureDate(day)) {
              // Include trading P&L
              if (dayData && dayData.trades > 0) {
                weekPnl += dayData.pnl; // This now includes adjustments via getDayData
                weekTrades += dayData.trades;
                weekTradingDays++;
              } else if (dayAdjustment) {
                // Include adjustment even on non-trading days
                weekPnl += dayAdjustment.amount;
              }
            }
          } else {
            // Empty cell after month ends
            weekDays.push(null);
          }
        }
      }
      
      weeks.push({
        days: weekDays,
        pnl: weekPnl,
        trades: weekTrades,
        tradingDays: weekTradingDays
      });
    }
    
    return weeks;
  };
  
  const weeklyData = getWeeklyData();
  
  // Calculate monthly totals from actual data for the current viewing month
  // Includes both trading P&L and balance adjustments (payouts/deposits) to match TopOne
  const monthlyTotal = useMemo(() => {
    // Sum of trading P&L
    const tradingPnL = data.reduce((sum, dayData) => {
      const date = new Date(dayData.date);
      if (date.getFullYear() === year && date.getMonth() === month) {
        return sum + dayData.pnl;
      }
      return sum;
    }, 0);
    
    // Sum of adjustments (payouts, deposits)
    const adjustmentTotal = adjustments.reduce((sum, adj) => {
      const adjDate = new Date(adj.date + 'T12:00:00');
      if (adjDate.getFullYear() === year && adjDate.getMonth() === month) {
        return sum + adj.amount;
      }
      return sum;
    }, 0);
    
    return tradingPnL + adjustmentTotal;
  }, [data, adjustments, year, month]);
  
  const tradingDays = data.filter(dayData => {
    const date = new Date(dayData.date);
    return date.getFullYear() === year && date.getMonth() === month && dayData.trades > 0;
  }).length;

  // Check if current viewing month has any data
  const hasDataForMonth = data.some(dayData => {
    const date = new Date(dayData.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });

  // Get the month name for the "This month" button
  const getCurrentMonthLabel = () => {
    const initialDate = getInitialDate();
    if (year === initialDate.getFullYear() && month === initialDate.getMonth()) {
      return 'Current data';
    }
    return 'This month';
  };

  // Get trades for selected date
  const selectedDateTrades = selectedDate ? trades.filter((t) => t.date.slice(0, 10) === selectedDate) : [];
  const tradeDates = useMemo(
    () => [...new Set(trades.map((t) => t.date.slice(0, 10)))].sort(),
    [trades]
  );
  
  return (
    <div 
      className="flex flex-col rounded-xl border border-white/5 hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
      
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl border border-white/0 group-hover:border-white/10 pointer-events-none transition-colors duration-300">
        <div 
          className="w-full h-full rounded-xl"
          
        />
      </div>
      
      <div className="relative z-10 flex flex-col">
        {/* Header */}
        <div className="border-b border-white/5 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={previousMonth}
                className="rounded-lg p-1.5 text-zinc-400 transition-all hover:bg-white/5 hover:text-zinc-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-base font-semibold text-zinc-100 sm:text-lg">
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={nextMonth}
                className="rounded-lg p-1.5 text-zinc-400 transition-all hover:bg-white/5 hover:text-zinc-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={goToCurrentMonth}
                className={clsx(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-all sm:text-sm',
                  hasDataForMonth
                    ? 'border-white/10 bg-white/5 text-zinc-200'
                    : 'border-white/5 bg-[#172035] text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                )}
              >
                {getCurrentMonthLabel()}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span>Monthly stats:</span>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-sm font-semibold text-emerald-400">
                  {formatCurrencyCompact(monthlyTotal)}
                </span>
              </div>
              <span className="text-sm font-medium text-violet-400">{tradingDays} days</span>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          {/* Week day headers */}
          <div className="mb-2 grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(88px,0.75fr)] gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-zinc-400">
                {day}
              </div>
            ))}
            <div className="text-center text-sm font-medium text-zinc-400">Weekly</div>
          </div>

          {/* Calendar weeks — fixed-height cells like reference */}
          <div className="flex flex-col gap-2">
            {weeklyData.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(88px,0.75fr)] gap-2">
                {/* Days of the week */}
                {week.days.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="h-20 rounded-lg sm:h-[5.25rem]" />;
                  }
                    
                    const dayData = getDayData(day);
                    const today = new Date();
                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                    const isWeekendDay = isWeekend(day);
                    const isFuture = isFutureDate(day);
                    const winRate = calculateDayWinRate(dayData);
                    const hasTradesForDay = dayData && dayData.trades > 0;
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayHasNote = hasNote(dateString, accountId);
                    const dayHasAdjustment = hasAdjustment(dateString);
                    const dayAdjustment = getAdjustmentForDate(dateString);
                    
                    return (
                      <div
                        key={`${weekIndex}-${day}`}
                        className={clsx(
                          'relative flex h-20 flex-col rounded-lg border p-2 transition-all duration-200 group sm:h-[5.25rem] sm:p-2.5',
                          isToday 
                            ? 'border-blue-500 bg-blue-500/10' 
                            : isFuture
                              ? 'border-white/5 bg-[#172035]/20 opacity-50' // Future dates styling
                              : isWeekendDay
                                ? 'border-white/5 bg-[#172035]/30' // Weekend styling
                                : dayData && dayData.pnl > 0 
                                  ? 'border-emerald-500/30 bg-emerald-500/10' 
                                  : dayData && dayData.pnl < 0 
                                    ? 'border-rose-500/30 bg-rose-500/10'
                                    : 'border-white/5 hover:border-emerald-500/50',
                          !isWeekendDay && !isFuture && 'hover:bg-white/5',
                          hasTradesForDay && !isWeekendDay && !isFuture && 'cursor-pointer'
                        )}
                        onClick={() => handleDayClick(day)}
                      >
                        {/* Top-right indicators container */}
                        <div className="absolute right-1 top-1 flex items-center space-x-1">
                          {/* Adjustment indicator */}
                          {dayHasAdjustment && (
                            <div 
                              className={clsx(
                                "rounded-full p-1",
                                dayAdjustment?.type === 'payout' 
                                  ? "bg-rose-500/30" 
                                  : dayAdjustment?.type === 'deposit'
                                    ? "bg-emerald-500/30"
                                    : "bg-[#1E2F4A]"
                              )}
                              title={`${dayAdjustment?.type}: ${dayAdjustment?.amount && dayAdjustment.amount < 0 ? '-' : '+'}$${Math.abs(dayAdjustment?.amount || 0).toLocaleString()}`}
                            >
                              <DollarSign className={clsx(
                                "h-3 w-3",
                                dayAdjustment?.type === 'payout' 
                                  ? "text-rose-500" 
                                  : dayAdjustment?.type === 'deposit'
                                    ? "text-emerald-500"
                                    : "text-zinc-400"
                              )} />
                            </div>
                          )}
                          
                          {/* Notes indicator */}
                          {dayHasNote && (
                            <div className="rounded-full bg-[#172035]/80 p-1">
                              <FileText className="h-3 w-3 text-zinc-400" />
                            </div>
                          )}
                        </div>
                        
                        <div className={clsx(
                          'text-right text-xs font-medium',
                          isFuture ? 'text-zinc-400/50' : isWeekendDay ? 'text-zinc-400' : 'text-zinc-300'
                        )}>
                          {day}
                        </div>
                        
                        {isFuture ? null : isWeekendDay ? (
                          <div className="mt-1 text-xs text-zinc-500">Market closed</div>
                        ) : dayData && dayData.trades > 0 ? (
                          <div className="mt-0.5 min-w-0">
                            <div className={clsx(
                              'truncate text-sm font-bold leading-tight',
                              dayData.pnl >= 0 ? 'text-zinc-100' : 'text-rose-400'
                            )}>
                              {formatCurrencyCompact(dayData.pnl)}
                            </div>
                            <div className="truncate text-[11px] leading-tight text-zinc-500">
                              {dayData.trades} trade{dayData.trades !== 1 ? 's' : ''}
                            </div>
                            <div className="truncate text-[11px] leading-tight text-zinc-500">
                              {winRate}% WR
                            </div>
                          </div>
                        ) : dayHasAdjustment && dayAdjustment ? (
                          <div className="min-w-0 space-y-0.5">
                            <div className={clsx(
                              'truncate text-xs font-bold',
                              dayAdjustment.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {dayAdjustment.type === 'payout' ? 'Payout' : dayAdjustment.type === 'deposit' ? 'Deposit' : 'Adj'}
                            </div>
                            <div className={clsx(
                              'truncate text-xs font-semibold',
                              dayAdjustment.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {dayAdjustment.amount >= 0 ? '+' : ''}{formatCurrency(dayAdjustment.amount)}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-xs leading-tight text-zinc-400">0 trades</div>
                            <div className="text-xs leading-tight text-zinc-400">0% WR</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Weekly summary - Updated with gradient theme */}
                  <div className="flex h-20 flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2 sm:h-[5.25rem] sm:p-2.5">
                    <div className="text-xs text-zinc-500">Week {weekIndex + 1}</div>
                    <div className={clsx(
                      'mt-0.5 truncate text-sm font-bold leading-tight',
                      week.pnl > 0 ? 'text-emerald-400' : week.pnl < 0 ? 'text-rose-400' : 'text-zinc-200'
                    )}>
                      {formatCurrencyCompact(week.pnl)}
                    </div>
                    <div className="mt-auto text-xs text-violet-400">
                      {week.tradingDays} days
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Trade Preview Modal */}
      <DayReviewModal
        isOpen={showTradePreview}
        onClose={() => setShowTradePreview(false)}
        date={selectedDate || ''}
        trades={selectedDateTrades}
        accountId={accountId}
        tradingDays={tradeDates}
        onNavigate={(d) => {
          setSelectedDate(d);
          const [y, m] = d.split('-').map(Number);
          setCurrentDate(new Date(y, m - 1, 1));
        }}
      />
    </div>
  );
};
