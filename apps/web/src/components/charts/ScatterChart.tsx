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
    <div className="bg-[#15181F] rounded-xl p-6 border border-[#1F2937] hover:border-[#3BF68A]/20 transition-all duration-200">
      <h3 className="text-[#E5E7EB] text-lg font-semibold mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
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
                backgroundColor: '#15181F',
                border: '1px solid #1F2937',
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
