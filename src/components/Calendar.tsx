import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import { useAccountStore } from '../store/accountStore';

interface CalendarData {
  date: string;
  pnl: number;
  trades: number;
}

interface CalendarProps {
  data: CalendarData[];
}

interface TradePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  trades: any[];
}

const TradePreviewModal: React.FC<TradePreviewModalProps> = ({ isOpen, onClose, date, trades }) => {
  if (!isOpen) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const totalPnL = trades.reduce((sum, trade) => sum + trade.netPL, 0);
  const winningTrades = trades.filter(trade => trade.outcome === 'win').length;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="rounded-xl border border-[#1F2937] max-w-2xl w-full max-h-[80vh] overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
        }}
        onClick={(e) => e.stopPropagation()} // Prevent modal content clicks from closing
      >
        {/* Header */}
        <div className="p-6 border-b border-[#1F2937] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#E5E7EB] mb-1">
              Trades on {formatDate(date)}
            </h2>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-[#8B94A7]">{trades.length} trade{trades.length !== 1 ? 's' : ''}</span>
              <span className={clsx(
                'font-semibold',
                totalPnL >= 0 ? 'text-[#3BF68A]' : 'text-[#F45B69]'
              )}>
                {formatCurrency(totalPnL)}
              </span>
              <span className="text-[#8B94A7]">{winRate.toFixed(0)}% WR</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937] rounded-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Trades List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            {trades.map((trade, index) => (
              <div
                key={trade.id}
                className="p-4 rounded-lg border border-[#1F2937] hover:border-[#3BF68A]/30 transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #1A1D25 0%, #1F2937 100%)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-[#E5E7EB] font-medium text-lg">{trade.symbol}</span>
                      <span className={clsx(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        trade.outcome === 'win' 
                          ? 'bg-[#3BF68A]/20 text-[#3BF68A] border border-[#3BF68A]/30'
                          : 'bg-[#F45B69]/20 text-[#F45B69] border border-[#F45B69]/30'
                      )}>
                        {trade.outcome.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3 text-sm text-[#8B94A7]">
                      {trade.time && <span>{trade.time}</span>}
                      {trade.side && (
                        <span className={clsx(
                          'px-2 py-1 rounded text-xs',
                          trade.side === 'Long' 
                            ? 'bg-[#3BF68A]/10 text-[#3BF68A]'
                            : 'bg-[#F45B69]/10 text-[#F45B69]'
                        )}>
                          {trade.side}
                        </span>
                      )}
                      <span>{trade.quantity} shares</span>
                      <span>{Math.floor(trade.duration / 60)}h {trade.duration % 60}m</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={clsx(
                      'text-lg font-bold',
                      trade.netPL >= 0 ? 'text-[#3BF68A]' : 'text-[#F45B69]'
                    )}>
                      {formatCurrency(trade.netPL)}
                    </div>
                    <div className="text-sm text-[#8B94A7]">
                      ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                
                {trade.notes && (
                  <div className="mt-3 pt-3 border-t border-[#1F2937]">
                    <p className="text-sm text-[#8B94A7]">{trade.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Calendar: React.FC<CalendarProps> = ({ data }) => {
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
  
  // Helper function to check if we're viewing the current month
  const isCurrentMonth = () => {
    const today = new Date();
    return year === today.getFullYear() && month === today.getMonth();
  };
  
  // Get day data from the actual data prop passed from App.tsx
  const getDayData = (day: number) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return data.find(item => item.date === dateString);
  };

  // Get trades for a specific date
  const getTradesForDate = (day: number) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const trades = useAccountStore.getState().getAllTrades();
    return trades.filter(trade => trade.date === dateString);
  };
  
  // Calculate realistic win rate for a specific day based on actual trades
  const calculateDayWinRate = (dayData: CalendarData | undefined) => {
    if (!dayData || dayData.trades === 0) return 0;
    
    // Get trades from the account store
    const trades = useAccountStore.getState().getAllTrades();
    
    // Get all trades for this specific date
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
            
            // Calculate week totals
            const dayData = getDayData(day);
            if (dayData && !isWeekend(day) && !isFutureDate(day) && dayData.trades > 0) {
              weekPnl += dayData.pnl;
              weekTrades += dayData.trades;
              weekTradingDays++;
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
  const monthlyTotal = data.reduce((sum, dayData) => {
    const date = new Date(dayData.date);
    if (date.getFullYear() === year && date.getMonth() === month) {
      return sum + dayData.pnl;
    }
    return sum;
  }, 0);
  
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
  const selectedDateTrades = selectedDate ? getTradesForDate(parseInt(selectedDate.split('-')[2])) : [];
  
  return (
    <div 
      className="rounded-xl border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
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
      
      <div className="relative z-10">
        {/* Header */}
        <div className="p-6 border-b border-[#1F2937]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={previousMonth}
                className="p-2 text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10 rounded-lg transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-[#E5E7EB] text-xl font-semibold">
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={nextMonth}
                className="p-2 text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10 rounded-lg transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={goToCurrentMonth}
                className={clsx(
                  'px-3 py-1 rounded-full text-sm font-medium border transition-all duration-200',
                  hasDataForMonth
                    ? 'bg-gradient-to-r from-[#3BF68A]/20 to-[#A78BFA]/20 text-[#3BF68A] border-[#3BF68A]/30'
                    : 'bg-[#1F2937] text-[#8B94A7] border-[#1F2937] hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10 hover:text-[#E5E7EB] hover:border-[#3BF68A]/30'
                )}
              >
                {getCurrentMonthLabel()}
              </button>
            </div>
            
            <div className="flex items-center space-x-8">
              <div className="text-right">
                <div className="text-sm text-[#8B94A7] mb-1">Monthly stats:</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent">
                  {formatCurrency(monthlyTotal)}
                </div>
              </div>
              <div className="text-right">
                {/* Removed the duplicate "11 days" text that was above the highlighted badge */}
                <div className="flex items-center space-x-2">
                  {/* Updated trading days indicator with gradient theme - this is the only one now */}
                  <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[#3BF68A]/20 to-[#A78BFA]/20 border border-[#3BF68A]/30 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#3BF68A] to-[#A78BFA]"></div>
                    <span className="text-[#3BF68A] text-sm font-medium">{tradingDays} days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {/* Week day headers */}
          <div className="grid grid-cols-8 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-[#8B94A7]">
                {day}
              </div>
            ))}
            <div className="p-3 text-center text-sm font-medium text-[#8B94A7]">
              Weekly
            </div>
          </div>
          
          {/* Calendar weeks */}
          {weeklyData.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-8 gap-2 mb-2">
              {/* Days of the week */}
              {week.days.map((day, dayIndex) => {
                if (!day) {
                  return <div key={`empty-${weekIndex}-${dayIndex}`} className="p-3 h-24" />;
                }
                
                const dayData = getDayData(day);
                const today = new Date();
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isWeekendDay = isWeekend(day);
                const isFuture = isFutureDate(day);
                const winRate = calculateDayWinRate(dayData);
                const hasTradesForDay = dayData && dayData.trades > 0;
                
                return (
                  <div
                    key={`${weekIndex}-${day}`}
                    className={clsx(
                      'p-3 h-24 rounded-lg transition-all duration-200 relative group border-2',
                      isToday 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : isFuture
                          ? 'border-[#1F2937] bg-[#1F2937]/20 opacity-50' // Future dates styling
                          : isWeekendDay
                            ? 'border-[#1F2937] bg-[#1F2937]/30' // Weekend styling
                            : dayData && dayData.pnl > 0 
                              ? 'border-[#3BF68A] bg-[#3BF68A]/10' 
                              : dayData && dayData.pnl < 0 
                                ? 'border-[#F45B69] bg-[#F45B69]/10'
                                : 'border-[#1F2937] hover:border-[#3BF68A]/50',
                      !isWeekendDay && !isFuture && 'hover:bg-gradient-to-r hover:from-[#3BF68A]/10 hover:to-[#A78BFA]/10',
                      hasTradesForDay && !isWeekendDay && !isFuture && 'cursor-pointer'
                    )}
                    onClick={() => handleDayClick(day)}
                  >
                    <div className={clsx(
                      'text-sm font-medium mb-1',
                      isFuture ? 'text-[#8B94A7]/50' : isWeekendDay ? 'text-[#8B94A7]' : 'text-[#E5E7EB]'
                    )}>
                      {day}
                    </div>
                    
                    {isFuture ? (
                      <div className="space-y-1">
                        {/* Empty space for future dates */}
                      </div>
                    ) : isWeekendDay ? (
                      <div className="space-y-1">
                        <div className="text-xs text-[#8B94A7]">Market closed</div>
                      </div>
                    ) : dayData && dayData.trades > 0 ? (
                      <div className="space-y-1">
                        <div className={clsx(
                          'text-xs font-bold',
                          dayData.pnl >= 0 ? 'text-[#3BF68A]' : 'text-[#F45B69]'
                        )}>
                          {formatCurrency(dayData.pnl)}
                        </div>
                        <div className="text-xs text-[#8B94A7]">
                          {dayData.trades} trade{dayData.trades !== 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-[#8B94A7]">
                          {winRate}% WR
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-xs text-[#8B94A7]">0 trades</div>
                        <div className="text-xs text-[#8B94A7]">0% WR</div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Weekly summary - Updated with gradient theme */}
              <div className="p-3 h-24 rounded-lg bg-gradient-to-r from-[#3BF68A]/10 to-[#A78BFA]/10 border border-[#3BF68A]/30">
                <div className="text-xs text-[#8B94A7] mb-1">Week {weekIndex + 1}</div>
                <div className={clsx(
                  'text-sm font-bold mb-1',
                  week.pnl >= 0 ? 'bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent' : 'text-[#F45B69]'
                )}>
                  {formatCurrency(week.pnl)}
                </div>
                <div className="text-xs text-[#8B94A7] mb-1">
                  {week.tradingDays} days
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trade Preview Modal */}
      <TradePreviewModal
        isOpen={showTradePreview}
        onClose={() => setShowTradePreview(false)}
        date={selectedDate || ''}
        trades={selectedDateTrades}
      />
    </div>
  );
};