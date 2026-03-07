'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Tooltip } from '../Tooltip';
import { useHasMounted } from '@/hooks/useHasMounted';

interface PLData {
  date: string;
  cumulative: number;
  daily: number;
}

interface PLChartProps {
  data: PLData[];
  type: 'cumulative' | 'daily';
}

export const PLChart: React.FC<PLChartProps> = ({ data, type }) => {
  const hasMounted = useHasMounted();
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
  };

  const tooltipContent = `Shows cumulative profit and loss over time.\n\nTracks how your account balance has grown or declined with each trading day.\n\nHelps visualize overall trading trajectory.`;

  if (!hasMounted) {
    return <div className="h-64 rounded-xl border border-white/5 bg-[#181B24]/40" />;
  }

  if (type === 'cumulative') {
    return (
      <div 
        className="rounded-xl p-6 border border-white/5 hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
        
      >
        {/* Gradient border on hover */}
        <div className="absolute inset-0 rounded-xl border border-white/0 group-hover:border-white/10 pointer-events-none transition-colors duration-300">
          <div 
            className="w-full h-full rounded-xl"
            
          />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <h3 className="text-zinc-100 text-lg font-semibold">Daily net cumulative P&L</h3>
              <Tooltip content={tooltipContent} position="top">
                <div className="w-4 h-4 rounded-full bg-[#242838] flex items-center justify-center cursor-help hover:bg-white/10 transition-all">
                  <span className="text-zinc-400 text-xs">?</span>
                </div>
              </Tooltip>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="plGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="50%" stopColor="#71717A" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="plStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#71717A" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2C3148" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8B94A7', fontSize: 12 }}
                  tickFormatter={formatDate}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8B94A7', fontSize: 12 }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  contentStyle={{
                    background: 'linear-gradient(135deg, #2C3148 0%, #364060 100%)',
                    border: '2px solid #3BF68A',
                    borderRadius: '12px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(59, 246, 138, 0.3)',
                    padding: '12px 16px',
                    backdropFilter: 'blur(10px)'
                  }}
                  labelStyle={{ 
                    color: '#FFFFFF', 
                    fontWeight: 'bold', 
                    marginBottom: '6px', 
                    fontSize: '14px',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                  }}
                  formatter={(value: number | string | undefined) => {
                    const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                    return [
                      formatCurrency(numericValue),
                      'P&L'
                    ];
                  }}
                  labelFormatter={(label) => (
                    <span style={{ 
                      color: '#FFFFFF', 
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      {formatDate(label)}
                    </span>
                  )}
                  cursor={{ stroke: '#3BF68A', strokeWidth: 2, strokeDasharray: '5 5' }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="url(#plStroke)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#plGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
