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

  // Generous hit areas support mouse, touch and keyboard inspection.
  const CustomDot = (props: any) => {
    const { cx, cy, payload, setTooltipPosition, setHoveredPoint } = props;
    
    const handlePointEnter = (e: React.MouseEvent | React.FocusEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const containerRect = e.currentTarget.closest('.recharts-wrapper')?.getBoundingClientRect();
      
      if (containerRect) {
        setTooltipPosition({
          x: Math.max(90, Math.min(containerRect.width - 90, rect.left - containerRect.left + rect.width / 2)),
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
      <g role="button" tabIndex={0}
        aria-label={`${payload.category}: ${payload.value.toFixed(0)} out of 100`}
        className="cursor-pointer outline-none"
        onMouseEnter={handlePointEnter} onMouseLeave={handleMouseLeave}
        onFocus={handlePointEnter} onBlur={handleMouseLeave} onClick={handlePointEnter}>
        <circle cx={cx} cy={cy} r={12} fill="transparent" />
        <circle cx={cx} cy={cy} r={5} fill="#00D68F" stroke="#0D1628" strokeWidth={2} />
      </g>
    );
  };

export const RadarChartComponent: React.FC<RadarChartComponentProps> = ({ data, score }) => {
  const hasMounted = useHasMounted();
  const [chartWidth, setChartWidth] = useState(320);
  const [hoveredPoint, setHoveredPoint] = useState<{ category: string; value: number } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const tooltipContent = `Comprehensive performance score based on:\n\n• Win rate and consistency\n• Profit factor and risk management\n• Overall trading effectiveness\n\nScores above 80 indicate excellent performance.`;

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
        {/* Compact pill, matching the crosshair labels on the other dashboard charts */}
        <div className="-translate-y-1 whitespace-nowrap rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-lg shadow-black/40">
          {hoveredPoint.category} <span className="text-emerald-700 tabular-nums">{hoveredPoint.value.toFixed(0)}</span>
        </div>
      </div>
    );
  };

  if (!hasMounted) {
    return <div className="h-full min-h-[25rem] lg:min-h-0 rounded-xl border border-white/5 bg-[#0D1628]/40" />;
  }

  return (
    <div 
      className="rounded-xl border border-white/5 hover:border-transparent hover:shadow-lg transition-all duration-200 h-full min-h-[25rem] lg:min-h-0 flex flex-col relative overflow-hidden group p-4 sm:p-5"
      
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
              <div className="w-4 h-4 rounded-full bg-[#172035] flex items-center justify-center cursor-help hover:bg-white/10 transition-all">
                <span className="text-zinc-400 text-xs">?</span>
              </div>
            </Tooltip>
          </div>
        </div>
        
        <div className="relative mb-3 min-h-[14rem] flex-1 lg:min-h-0">
          <ResponsiveContainer width="100%" height="100%" onResize={(width) => setChartWidth(width)}>
            <RadarChart
              data={data}
              margin={{ top: 18, right: chartWidth < 260 ? 40 : 64, bottom: 18, left: chartWidth < 260 ? 40 : 64 }}
              outerRadius="90%"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00D68F" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#71717A" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00D68F" />
                  <stop offset="100%" stopColor="#71717A" />
                </linearGradient>
              </defs>
              <PolarGrid
                gridType="polygon"
                stroke="#1E2F4A"
                strokeWidth={1}
                radialLines={false}
              />
              <PolarAngleAxis
                dataKey="category"
                tick={({ x, y, textAnchor, payload }: any) => {
                  const labels: Record<string, string[]> = {
                    'Drawdown Mgmt': ['Drawdown', 'management'],
                    'Profit factor': ['Profit', 'factor'],
                    'Sharpe Ratio': ['Sharpe', 'ratio'],
                  };
                  const lines = labels[payload.value] ?? [payload.value];
                  const labelX = textAnchor === 'start' ? Math.min(x, chartWidth - 78) : textAnchor === 'end' ? Math.max(x, 78) : x;
                  return <text x={labelX} y={y} textAnchor={textAnchor} fill="#A1B2CC" fontSize={12}>
                    {lines.map((line, index) => <tspan key={line} x={labelX} dy={index === 0 ? (lines.length > 1 ? -3 : 4) : 14}>{line}</tspan>)}
                  </text>;
                }}
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
                fillOpacity={0.8}
                strokeWidth={2}
                dot={<CustomDot setTooltipPosition={setTooltipPosition} setHoveredPoint={setHoveredPoint} />}
              />
            </RadarChart>
          </ResponsiveContainer>

          {/* Point-specific tooltip */}
          <PointTooltip />
        </div>
        
        {/* Score Display */}
        <div className="shrink-0 space-y-1">
          <div className="flex items-center justify-between"><span className="text-[10px] text-zinc-400 sm:text-xs">Your Trading Score</span><span className="text-lg font-bold text-zinc-50">{score.toFixed(1)}</span></div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 sm:text-xs">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#172035]">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${score}%`,
                background: 'linear-gradient(to right, #00D68F, #4F9CF9)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
