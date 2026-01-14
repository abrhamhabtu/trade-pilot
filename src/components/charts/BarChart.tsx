import React, { useState } from 'react';
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  // Calculate max value for scaling
  const maxAbsValue = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const hasNegative = data.some(d => d.value < 0);
  
  // Y-axis labels - more labels for bigger chart
  const yAxisLabels = hasNegative 
    ? [maxAbsValue, maxAbsValue/2, 0, -maxAbsValue/2, -maxAbsValue]
    : [maxAbsValue, maxAbsValue * 0.66, maxAbsValue * 0.33, 0];

  const formatYLabel = (val: number) => {
    if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${Math.round(val)}`;
  };

  // Get bar height percentage based on value
  const getBarHeight = (value: number) => {
    const percentage = (Math.abs(value) / maxAbsValue) * 90; // 90% max height
    return Math.max(4, percentage);
  };

  // Show fewer bars for bigger display
  const displayData = data.slice(-10);

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
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-[#E5E7EB] text-base font-semibold">{title}</h3>
            <Tooltip content={tooltipContent} position="top">
              <div className="w-5 h-5 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help hover:bg-[#3BF68A]/20 transition-colors">
                <span className="text-[#8B94A7] text-xs">?</span>
              </div>
            </Tooltip>
          </div>
        </div>
        
        {/* Chart Area - Takes most of the space */}
        <div className="flex-1 px-4 pb-2 flex min-h-0">
          {/* Y-Axis Labels */}
          <div className="flex flex-col justify-between text-right pr-3 py-2" style={{ minWidth: '50px' }}>
            {yAxisLabels.map((label, idx) => (
              <span key={idx} className="text-[11px] text-[#8B94A7] font-medium">
                {formatYLabel(label)}
              </span>
            ))}
          </div>

          {/* Chart Area */}
          <div className="flex-1 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {yAxisLabels.map((_, idx) => (
                <div key={idx} className="border-t border-[#1F2937]/60 w-full" />
              ))}
            </div>

            {/* Zero line (if has negative values) */}
            {hasNegative && (
              <div 
                className="absolute left-0 right-0 border-t-2 border-[#374151]" 
                style={{ top: '50%' }}
              />
            )}

            {/* Bars Container */}
            <div 
              className="absolute inset-0 flex items-center justify-around px-2"
              style={{ 
                alignItems: hasNegative ? 'center' : 'flex-end',
                paddingBottom: hasNegative ? '0' : '8px',
                paddingTop: hasNegative ? '0' : '8px'
              }}
            >
              {displayData.map((item, index) => {
                const isPositive = item.value >= 0;
                const barHeight = getBarHeight(item.value);
                const isHovered = hoveredIndex === index;
                
                return (
                  <div 
                    key={index}
                    className="relative flex flex-col items-center justify-center"
                    style={{ 
                      height: '100%',
                      width: `${100 / displayData.length}%`,
                      maxWidth: '50px'
                    }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Tooltip on hover */}
                    {isHovered && (
                      <div 
                        className="absolute z-50 px-4 py-2.5 rounded-xl shadow-2xl pointer-events-none whitespace-nowrap"
                        style={{
                          background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)',
                          border: `2px solid ${isPositive ? '#3BF68A' : '#F45B69'}`,
                          bottom: hasNegative ? (isPositive ? '60%' : 'auto') : `${barHeight + 12}%`,
                          top: hasNegative && !isPositive ? '60%' : 'auto',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          boxShadow: `0 12px 32px rgba(0, 0, 0, 0.7), 0 0 16px ${isPositive ? 'rgba(59, 246, 138, 0.4)' : 'rgba(244, 91, 105, 0.4)'}`
                        }}
                      >
                        <div className="text-white text-sm font-medium mb-1">{formatDate(item.date)}</div>
                        <div className={`text-lg font-bold ${isPositive ? 'text-[#3BF68A]' : 'text-[#F45B69]'}`}>
                          {formatCurrency(item.value)}
                        </div>
                      </div>
                    )}

                    {/* Bar positioning container */}
                    <div 
                      className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
                      style={{
                        height: hasNegative ? '50%' : '100%',
                        bottom: hasNegative ? (isPositive ? '50%' : '0') : '0',
                        top: hasNegative ? (isPositive ? 'auto' : '50%') : 'auto',
                        width: '100%',
                        alignItems: isPositive ? 'flex-end' : 'flex-start'
                      }}
                    >
                      {/* The Bar - Bigger and bolder */}
                      <div
                        className={`transition-all duration-200 cursor-pointer ${
                          isHovered ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                        }`}
                        style={{
                          width: isHovered ? '70%' : '60%',
                          maxWidth: '36px',
                          minWidth: '18px',
                          height: `${barHeight}%`,
                          minHeight: '6px',
                          backgroundColor: isPositive ? '#3BF68A' : '#F45B69',
                          borderRadius: isPositive ? '4px 4px 0 0' : '0 0 4px 4px',
                          boxShadow: isHovered 
                            ? `0 0 20px ${isPositive ? 'rgba(59, 246, 138, 0.6)' : 'rgba(244, 91, 105, 0.6)'}`
                            : 'none',
                          transform: isHovered ? 'scaleX(1.1)' : 'scaleX(1)'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* X-Axis Date Labels */}
        <div className="px-4 pb-4 flex justify-around" style={{ marginLeft: '50px' }}>
          {displayData.map((item, idx) => (
            <span 
              key={idx} 
              className={`text-[11px] font-medium transition-colors ${
                hoveredIndex === idx ? 'text-[#E5E7EB]' : 'text-[#8B94A7]'
              }`}
              style={{ width: `${100 / displayData.length}%`, textAlign: 'center' }}
            >
              {formatDate(item.date)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
