import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tooltip } from '../Tooltip';

interface BarData {
  date: string;
  value: number;
}

interface BarChartComponentProps {
  data: BarData[];
  title: string;
}

export const BarChartComponent: React.FC<BarChartComponentProps> = ({ data, title }) => {
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

  const tooltipContent = `Shows daily profit and loss for each trading day.\n\nGreen bars = profitable days\nRed bars = losing days\n\nHelps identify patterns in daily performance.`;

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
        {/* Header - Very compact like screenshot */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center space-x-2">
            <h3 className="text-[#E5E7EB] text-base font-medium">{title}</h3>
            <Tooltip content={tooltipContent} position="top">
              <div className="w-4 h-4 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help hover:bg-[#3BF68A]/20 transition-colors">
                <span className="text-[#8B94A7] text-xs">?</span>
              </div>
            </Tooltip>
          </div>
        </div>
        
        {/* Chart Area - Takes up almost all remaining space like screenshot */}
        <div className="flex-1 px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data} 
              margin={{ top: 5, right: 10, left: 10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.2} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8B94A7', fontSize: 10 }}
                tickFormatter={formatDate}
                height={25}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8B94A7', fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                  if (value <= -1000) return `-$${Math.abs(value / 1000).toFixed(0)}k`;
                  return `$${value}`;
                }}
                width={45}
              />
              <RechartsTooltip
                contentStyle={{
                  background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)',
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
                formatter={(value: number) => [
                  <span style={{ 
                    color: value >= 0 ? '#3BF68A' : '#F45B69', 
                    fontWeight: 'bold',
                    fontSize: '14px',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                  }}>
                    {formatCurrency(value)}
                  </span>, 
                  <span style={{ 
                    color: '#E5E7EB', 
                    fontWeight: '500',
                    fontSize: '13px'
                  }}>
                    P&L
                  </span>
                ]}
                labelFormatter={(label) => (
                  <span style={{ 
                    color: '#FFFFFF', 
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    {formatDate(label)}
                  </span>
                )}
                cursor={{ fill: 'rgba(59, 246, 138, 0.1)' }}
              />
              <Bar 
                dataKey="value" 
                radius={[2, 2, 0, 0]}
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.value >= 0 ? '#3BF68A' : '#F45B69'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};