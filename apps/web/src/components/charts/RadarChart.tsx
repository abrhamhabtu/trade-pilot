'use client';

import React, { useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Tooltip } from '../Tooltip';

interface PerformanceData {
  category: string;
  value: number;
  fullMark: number;
}

interface RadarChartComponentProps {
  data: PerformanceData[];
  score: number;
}

export const RadarChartComponent: React.FC<RadarChartComponentProps> = ({ data, score }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ category: string; value: number } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const tooltipContent = `Comprehensive performance score based on:\n\n• Win rate and consistency\n• Profit factor and risk management\n• Overall trading effectiveness\n\nScores above 80 indicate excellent performance.`;

  // Custom dot component that handles hover - 50% smaller
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    
    const handleMouseEnter = (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const containerRect = e.currentTarget.closest('.recharts-wrapper')?.getBoundingClientRect();
      
      if (containerRect) {
        setTooltipPosition({
          x: rect.left - containerRect.left + 3, // Adjusted for smaller dot
          y: rect.top - containerRect.top - 10
        });
      }
      
      setHoveredPoint({
        category: payload.category,
        value: payload.value
      });
    };

    const handleMouseLeave = () => {
      // Immediately clear the hovered point to hide tooltip
      setHoveredPoint(null);
    };

    return (
      <circle
        cx={cx}
        cy={cy}
        r={3} // Reduced from 6 to 3 (50% smaller)
        fill="#3BF68A"
        stroke="#1A1D25"
        strokeWidth={1} // Reduced from 2 to 1
        style={{ 
          cursor: 'pointer',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    );
  };

  // Small tooltip for individual points - shows category name above score
  const PointTooltip = () => {
    if (!hoveredPoint) return null;

    return (
      <div 
        className="absolute pointer-events-none z-30 transition-opacity duration-150"
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          transform: 'translate(-50%, -100%)',
          opacity: hoveredPoint ? 1 : 0
        }}
      >
        <div 
          className="bg-[#1F2937] border border-[#3BF68A] rounded-lg shadow-xl backdrop-blur-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(55, 65, 81, 0.95) 100%)',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.6), 0 0 8px rgba(59, 246, 138, 0.2)',
            padding: '6px 10px',
            minWidth: '84px'
          }}
        >
          <div className="text-center">
            <div className="text-[#E5E7EB] font-medium mb-1" style={{ fontSize: '10px' }}>
              {hoveredPoint.category}
            </div>
            <div className="text-[#3BF68A] font-bold" style={{ fontSize: '11px' }}>
              Score: {hoveredPoint.value.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="rounded-xl p-6 border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 h-full relative overflow-hidden group"
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-[#E5E7EB] text-lg font-semibold">Trading score</h3>
            <Tooltip content={tooltipContent} position="top">
              <div className="w-4 h-4 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help hover:bg-gradient-to-r hover:from-[#3BF68A]/20 hover:to-[#A78BFA]/20 transition-all">
                <span className="text-[#8B94A7] text-xs">?</span>
              </div>
            </Tooltip>
          </div>
        </div>
        
        <div className="h-40 mb-4 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart 
              data={data} 
              margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
              onMouseLeave={() => setHoveredPoint(null)} // Additional safety net
            >
              <defs>
                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3BF68A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3BF68A" />
                  <stop offset="100%" stopColor="#A78BFA" />
                </linearGradient>
              </defs>
              <PolarGrid 
                gridType="polygon" 
                stroke="#1F2937"
                strokeWidth={1}
                radialLines={false}
              />
              <PolarAngleAxis 
                dataKey="category" 
                tick={{ fill: '#8B94A7', fontSize: 9 }}
                className="text-xs"
              />
              <PolarRadiusAxis 
                domain={[0, 100]} 
                tick={false}
                tickCount={5}
                axisLine={false}
              />
              <Radar
                name="Performance"
                dataKey="value"
                stroke="url(#radarStroke)"
                fill="url(#radarGradient)"
                fillOpacity={0.4}
                strokeWidth={2}
                dot={<CustomDot />}
              />
            </RadarChart>
          </ResponsiveContainer>
          
          {/* Point-specific tooltip */}
          <PointTooltip />
        </div>
        
        {/* Score Display - More compact */}
        <div className="space-y-2">
          <div>
            <div className="text-[#8B94A7] text-xs mb-1">Your Trading Score</div>
          </div>
          
          {/* Score meter */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[#8B94A7]">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
            <div className="w-full h-2 bg-[#1F2937] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000"
                style={{ 
                  width: `${score}%`,
                  background: 'linear-gradient(to right, #3BF68A, #A78BFA)'
                }}
              />
            </div>
            <div className="text-center mt-1">
              <div 
                className="text-xl font-bold bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent"
              >
                {score.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
