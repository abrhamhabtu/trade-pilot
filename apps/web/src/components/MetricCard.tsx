'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from './Tooltip';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  format?: 'currency' | 'percentage' | 'number';
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  tooltip?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-zinc-400',
  format = 'number',
  trend = 'neutral',
  subtitle,
  tooltip
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'number':
        if (val >= 1000) {
          return val.toFixed(2);
        }
        return val.toLocaleString();
      default:
        return val.toLocaleString();
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-zinc-50';
      case 'down':
        return 'text-rose-500';
      default:
        return 'text-zinc-100';
    }
  };

  const getTooltipContent = (title: string) => {
    switch (title) {
      case 'Net P&L':
        return 'Total profit and loss from all closed trades.\n\nThis represents your overall trading performance in dollar terms.';
      case 'Profit Factor':
        return 'Ratio of gross profit to gross loss.\n\nValues above 1.0 = profitable\nValues above 2.0 = excellent';
      case 'Trade Win %':
        return 'Percentage of trades that were profitable.\n\nHigher win rate indicates more consistent trading.';
      case 'Trade Expectancy':
        return 'Average amount expected per trade.\n\nPositive expectancy means profitable strategy over time.';
      case 'Current Streak':
        return 'Number of consecutive wins or losses.\n\nHelps track momentum and psychological state.';
      case 'Total Trades':
        return 'Total number of completed trades.\n\nLarger sample size = more reliable statistics.';
      default:
        return tooltip || '';
    }
  };

  return (
    <div 
      className="rounded-lg p-4 border border-white/5 hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
      
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
        <div 
          className="w-full h-full rounded-lg"
          
        />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-zinc-400 text-xs font-medium">{title}</span>
            <Tooltip content={getTooltipContent(title)} position="top">
              <div className="w-3 h-3 rounded-full bg-[#242838] flex items-center justify-center cursor-help hover:bg-white/10 transition-all">
                <span className="text-zinc-400 text-xs">?</span>
              </div>
            </Tooltip>
          </div>
          {Icon && <Icon className={clsx('h-4 w-4', iconColor)} />}
        </div>
        
        <div className="space-y-1">
          <div className={clsx('text-xl font-bold', getTrendColor())}>
            {formatValue(value)}
          </div>
          
          {subtitle && (
            <div className="text-zinc-400 text-xs font-medium">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
