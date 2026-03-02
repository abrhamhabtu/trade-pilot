'use client';

import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tooltip } from '../Tooltip';

interface DurationData {
  duration: number; // Duration in minutes
  pnl: number;
  outcome: 'win' | 'loss';
}

interface DurationPerformanceChartProps {
  data: DurationData[];
}

export const DurationPerformanceChart: React.FC<DurationPerformanceChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Clean duration formatting for X-axis - only show clean hour labels
  const formatDurationAxis = (minutes: number) => {
    if (minutes <= 30) return '30m';
    if (minutes <= 60) return '1h';
    if (minutes <= 120) return '2h';
    if (minutes <= 180) return '3h';
    if (minutes <= 240) return '4h';
    if (minutes <= 300) return '5h';
    if (minutes <= 360) return '6h';
    if (minutes <= 420) return '7h';
    if (minutes <= 480) return '8h';
    
    // For anything longer, round to nearest hour
    const hours = Math.round(minutes / 60);
    return `${hours}h`;
  };

  // Format duration for tooltip display (more precise)
  const formatTooltipDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMins = Math.round(minutes % 60);
    if (remainingMins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMins}m`;
  };

  const tooltipContent = `Shows profit/loss performance by trade duration.\n\nGreen dots = winning trades\nRed dots = losing trades\n\nHelps identify optimal holding periods.`;

  // Calculate data bounds for proper chart sizing
  const minPnL = Math.min(...data.map(d => d.pnl));
  const maxPnL = Math.max(...data.map(d => d.pnl));
  const pnlRange = maxPnL - minPnL;
  const pnlPadding = pnlRange * 0.15; // 15% padding

  const minDuration = Math.min(...data.map(d => d.duration));
  const maxDuration = Math.max(...data.map(d => d.duration));
  const durationPadding = (maxDuration - minDuration) * 0.1; // 10% padding

  // Process data with controlled jitter that stays within bounds
  const processedData = data.map((item, index) => {
    // Reduce jitter to keep points well within bounds
    const durationJitter = (Math.random() - 0.5) * Math.min(15, (maxDuration - minDuration) * 0.05);
    const pnlJitter = (Math.random() - 0.5) * (pnlRange * 0.05); // 5% of range
    
    return {
      ...item,
      displayDuration: Math.max(minDuration - durationPadding + 5, Math.min(maxDuration + durationPadding - 5, item.duration + durationJitter)),
      displayPnl: Math.max(minPnL - pnlPadding + 50, Math.min(maxPnL + pnlPadding - 50, item.pnl + pnlJitter)),
      originalDuration: item.duration,
      originalPnl: item.pnl
    };
  });

  // Generate clean tick values for X-axis
  const generateCleanTicks = () => {
    const ticks = [];
    const maxHours = Math.ceil(maxDuration / 60);
    
    // Always start with 30m if we have short trades
    if (minDuration <= 30) {
      ticks.push(30);
    }
    
    // Add hourly ticks
    for (let hour = 1; hour <= Math.min(maxHours, 8); hour++) {
      ticks.push(hour * 60);
    }
    
    return ticks;
  };

  const cleanTicks = generateCleanTicks();

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
            Duration: {formatTooltipDuration(data.originalDuration)}
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
            <h3 className="text-zinc-100 text-lg font-semibold">Trade duration performance</h3>
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
                dataKey="displayDuration"
                domain={[Math.max(0, minDuration - durationPadding), maxDuration + durationPadding]}
                axisLine={{ stroke: '#364060', strokeWidth: 1 }}
                tickLine={{ stroke: '#364060', strokeWidth: 1 }}
                tick={{ fill: '#8B94A7', fontSize: 10 }}
                tickFormatter={formatDurationAxis}
                ticks={cleanTicks}
                label={{ 
                  value: 'Trade Duration', 
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