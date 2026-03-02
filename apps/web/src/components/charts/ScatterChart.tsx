'use client';

import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ScatterData {
  x: number;
  y: number;
  outcome: 'win' | 'loss';
  symbol?: string;
}

interface ScatterChartComponentProps {
  data: ScatterData[];
  title: string;
  xLabel: string;
  yLabel: string;
}

export const ScatterChartComponent: React.FC<ScatterChartComponentProps> = ({ 
  data, 
  title, 
  xLabel, 
  yLabel 
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="bg-[#181B24]/80 backdrop-blur-md rounded-xl p-6 border border-white/5 hover:border-emerald-500/30/20 transition-all duration-200">
      <h3 className="text-zinc-100 text-lg font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2C3148" />
            <XAxis 
              type="number"
              dataKey="x"
              name={xLabel}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8B94A7', fontSize: 12 }}
            />
            <YAxis 
              type="number"
              dataKey="y"
              name={yLabel}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8B94A7', fontSize: 12 }}
              tickFormatter={formatCurrency}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E2130',
                border: '1px solid #2C3148',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#E5E7EB' }}
              formatter={(value: number | string | undefined, name?: string) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                return [
                  name === 'y' ? formatCurrency(numericValue) : numericValue,
                  name === 'y' ? yLabel : xLabel
                ];
              }}
            />
            <Scatter name="Trades" fill="#3BF68A">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.outcome === 'win' ? '#3BF68A' : '#F45B69'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
