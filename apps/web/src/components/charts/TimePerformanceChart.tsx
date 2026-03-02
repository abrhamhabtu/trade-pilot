'use client';

import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tooltip } from '../Tooltip';

interface TimeData {
  time: number; // Hour in 24-hour format
  pnl: number;
  outcome: 'win' | 'loss';
}

interface TimePerformanceChartProps {
  data: TimeData[];
}

export const TimePerformanceChart: React.FC<TimePerformanceChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatTime = (hour: number) => {
    if (hour <= 6) return '6:00 AM';
    if (hour <= 8) return '8:00 AM';
    if (hour <= 10) return '10:00 AM';
    if (hour <= 12) return '12:00 PM';
    if (hour <= 14) return '2:00 PM';
    if (hour <= 16) return '4:00 PM';
    if (hour <= 18) return '6:00 PM';
    return `${hour}:00`;
  };

  // Format time for tooltip display (more precise)
  const formatTooltipTime = (hour: number) => {
    const wholeHour = Math.floor(hour);
    const minutes = Math.round((hour - wholeHour) * 60);
    
    let displayHour = wholeHour;
    let ampm = 'AM';
    
    if (wholeHour === 0) {
      displayHour = 12;
      ampm = 'AM';
    } else if (wholeHour === 12) {
      displayHour = 12;
      ampm = 'PM';
    } else if (wholeHour > 12) {
      displayHour = wholeHour - 12;
      ampm = 'PM';
    }
    
    return `${displayHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const tooltipContent = `Shows profit/loss performance by time of day.\n\nGreen dots = winning trades\nRed dots = losing trades\n\nHelps identify optimal trading hours.`;

  // Calculate data bounds for proper chart sizing
  const minPnL = Math.min(...data.map(d => d.pnl));
  const maxPnL = Math.max(...data.map(d => d.pnl));
  const pnlRange = maxPnL - minPnL;
  const pnlPadding = pnlRange * 0.15; // 15% padding

  const minTime = Math.min(...data.map(d => d.time));
  const maxTime = Math.max(...data.map(d => d.time));
  const timePadding = 0.5; // 30 minutes padding on each side

  // Process data with controlled jitter that stays within bounds
  const processedData = data.map((item, index) => {
    // Reduce jitter to keep points well within bounds
    const timeJitter = (Math.random() - 0.5) * 0.3; // Reduced from 0.8
    const pnlJitter = (Math.random() - 0.5) * (pnlRange * 0.05); // 5% of range
    
    return {
      ...item,
      displayTime: Math.max(minTime - timePadding + 0.2, Math.min(maxTime + timePadding - 0.2, item.time + timeJitter)),
      displayPnl: Math.max(minPnL - pnlPadding + 50, Math.min(maxPnL + pnlPadding - 50, item.pnl + pnlJitter)),
      originalTime: item.time,
      originalPnl: item.pnl
    };
  });

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
          style={{
            background: 'linear-gradient(135deg, #2C3148 0%, #364060 100%)',
            border: '2px solid #3BF68A',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(59, 246, 138, 0.3)',
            padding: '12px 16px',
            backdropFilter: 'blur(10px)',
            minWidth: '140px'
          }}
        >
          <div style={{ 
            color: '#FFFFFF', 
            fontWeight: 'bold',
            fontSize: '14px',
            marginBottom: '6px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
          }}>
            Time: {formatTooltipTime(data.originalTime)}
          </div>
          <div style={{ 
            color: data.originalPnl >= 0 ? '#3BF68A' : '#F45B69', 
            fontWeight: 'bold',
            fontSize: '16px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
          }}>
            {formatCurrency(data.originalPnl)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className="rounded-xl p-4 border border-white/5 hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group h-full"
      
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl border border-white/0 group-hover:border-white/10 pointer-events-none transition-colors duration-300">
        <div 
          className="w-full h-full rounded-xl"
          
        />
      </div>
      
      <div className="relative z-10 h-full flex flex-col">
        {/* Header - Compact */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-zinc-100 text-lg font-semibold">Trade time performance</h3>
            <Tooltip content={tooltipContent} position="top">
              <div className="w-4 h-4 rounded-full bg-[#242838] flex items-center justify-center cursor-help hover:bg-white/10 transition-all">
                <span className="text-zinc-400 text-xs">?</span>
              </div>
            </Tooltip>
          </div>
        </div>
        
        {/* Chart Area - Expanded with proper margins */}
        <div className="flex-1" style={{ minHeight: '240px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart 
              data={processedData} 
              margin={{ top: 20, right: 30, left: 50, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2C3148" opacity={0.3} />
              <XAxis 
                type="number"
                dataKey="displayTime"
                domain={[minTime - timePadding, maxTime + timePadding]}
                axisLine={{ stroke: '#364060', strokeWidth: 1 }}
                tickLine={{ stroke: '#364060', strokeWidth: 1 }}
                tick={{ fill: '#8B94A7', fontSize: 10 }}
                tickFormatter={formatTime}
                ticks={[6, 8, 10, 12, 14, 16, 18]}
                label={{ 
                  value: 'Trading Hours', 
                  position: 'insideBottom', 
                  offset: -5,
                  style: { textAnchor: 'middle', fill: '#8B94A7', fontSize: '11px', fontWeight: '500' }
                }}
              />
              <YAxis 
                type="number"
                dataKey="displayPnl"
                domain={[minPnL - pnlPadding, maxPnL + pnlPadding]}
                axisLine={{ stroke: '#364060', strokeWidth: 1 }}
                tickLine={{ stroke: '#364060', strokeWidth: 1 }}
                tick={{ fill: '#8B94A7', fontSize: 10 }}
                tickFormatter={(value) => `$${Math.round(value)}`}
                label={{ 
                  value: 'Profit & Loss', 
                  angle: -90, 
                  position: 'insideLeft',
                  offset: 10,
                  style: { textAnchor: 'middle', fill: '#8B94A7', fontSize: '11px', fontWeight: '500' }
                }}
              />
              <RechartsTooltip
                content={<CustomTooltip />}
                cursor={{ strokeDasharray: '3 3', stroke: '#3BF68A', strokeWidth: 1 }}
              />
              <Scatter 
                name="Trades" 
                dataKey="displayPnl" 
                r={6}
                strokeWidth={1}
                stroke="#242838"
              >
                {processedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.outcome === 'win' ? '#3BF68A' : '#F45B69'}
                    style={{ 
                      cursor: 'pointer',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
                    }}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend - More padding from bottom */}
        <div className="flex items-center justify-center space-x-6 mt-4 pt-4 pb-3 border-t border-white/5">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-zinc-400 text-xs">Winning Trades</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <span className="text-zinc-400 text-xs">Losing Trades</span>
          </div>
        </div>
      </div>
    </div>
  );
};