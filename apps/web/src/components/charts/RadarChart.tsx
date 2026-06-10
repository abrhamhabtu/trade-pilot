'use client';

import React, { useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Tooltip } from '../Tooltip';
import { useHasMounted } from '@/hooks/useHasMounted';

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
  const hasMounted = useHasMounted();
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
        fill="#30B886"
        stroke="#262420"
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
          className="bg-[#262420] border border-emerald-500/30 rounded-lg shadow-xl backdrop-blur-sm"
          style={{
            background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(55, 65, 81, 0.95) 100%)',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.6), 0 0 8px rgba(48, 184, 134, 0.2)',
            padding: '6px 10px',
            minWidth: '84px'
          }}
        >
          <div className="text-center">
            <div className="text-zinc-100 font-medium mb-1" style={{ fontSize: '10px' }}>
              {hoveredPoint.category}
            </div>
            <div className="text-emerald-500 font-bold" style={{ fontSize: '11px' }}>
              Score: {hoveredPoint.value.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!hasMounted) {
    return <div className="h-full min-h-[22rem] rounded-xl border border-white/5 bg-[#1B1A17]/40" />;
  }

  return (
    <div 
      className="rounded-xl border border-white/5 hover:border-transparent hover:shadow-lg transition-all duration-200 h-full flex flex-col relative overflow-hidden group p-4 sm:p-5"
      
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl border border-white/0 group-hover:border-white/10 pointer-events-none transition-colors duration-300">
        <div 
          className="w-full h-full rounded-xl"
          
        />
      </div>
      
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <div className="flex shrink-0 items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <h3 className="text-zinc-100 text-sm font-semibold sm:text-base">Trading score</h3>
            <Tooltip content={tooltipContent} position="top">
              <div className="w-4 h-4 rounded-full bg-[#262420] flex items-center justify-center cursor-help hover:bg-white/10 transition-all">
                <span className="text-zinc-400 text-xs">?</span>
              </div>
            </Tooltip>
          </div>
        </div>
        
        <div className="relative mb-2 min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={data}
              margin={{ top: 14, right: 22, bottom: 14, left: 22 }}
              outerRadius="72%"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#30B886" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#71717A" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#30B886" />
                  <stop offset="100%" stopColor="#71717A" />
                </linearGradient>
              </defs>
              <PolarGrid
                gridType="polygon"
                stroke="#3A362C"
                strokeWidth={1}
                radialLines={false}
              />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fill: '#A8A294', fontSize: 10 }}
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
        
        {/* Score Display */}
        <div className="shrink-0 space-y-1">
          <div className="text-[10px] text-zinc-400 sm:text-xs">Your Trading Score</div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 sm:text-xs">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#262420]">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${score}%`,
                background: 'linear-gradient(to right, #30B886, #6E9BD1)',
              }}
            />
          </div>
          <div className="text-center text-lg font-bold text-zinc-50 sm:text-xl">{score.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
};
