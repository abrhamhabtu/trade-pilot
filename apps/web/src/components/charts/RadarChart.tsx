'use client';

import React, { useEffect, useRef, useState } from 'react';
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

const SHORT_LABEL: Record<string, string> = {
  'Drawdown Mgmt': 'Drawdown',
  'Sharpe Ratio': 'Sharpe',
};

const SPECTRUM = 'linear-gradient(90deg, rgb(var(--tp-red)) 0%, #FF9F0A 38%, rgb(var(--tp-yellow)) 62%, rgb(var(--tp-green)) 100%)';

function gradeFor(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Strong';
  if (score >= 50) return 'Building';
  return 'Needs work';
}

/** The radar is drawn in real pixels so labels stay crisp at any card size. */
function ScoreRadar({ data, width, height }: { data: PerformanceData[]; width: number; height: number }) {
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const cx = width / 2;
  const cy = height / 2;
  // Narrow cards trade label room for radar size.
  const narrow = width < 300;
  const R = Math.max(24, Math.min(height / 2 - 22, width / 2 - (narrow ? 60 : 92)));
  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const point = (i: number, r: number) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r] as const;
  const ring = (f: number) => data.map((_, i) => point(i, R * f).map((v) => v.toFixed(1)).join(',')).join(' ');
  const shape = data
    .map((d, i) => point(i, R * Math.max(0.06, Math.min(1, d.value / 100))).map((v) => v.toFixed(1)).join(','))
    .join(' ');

  return (
    <svg width={width} height={height} role="img" aria-label="Trading score by category" className="block overflow-visible">
      <defs>
        <radialGradient id="tpRadarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgb(var(--tp-green))" stopOpacity="0.1" />
          <stop offset="100%" stopColor="rgb(var(--tp-green))" stopOpacity="0.42" />
        </radialGradient>
      </defs>

      {/* Rings step up in brightness toward the edge, so "further out is better" reads at a glance */}
      {[1, 0.75, 0.5, 0.25].map((f, i) => (
        <polygon
          key={f}
          points={ring(f)}
          fill={i % 2 === 0 ? 'rgba(255,255,255,0.028)' : 'rgb(var(--tp-card))'}
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" />;
      })}

      <g className="tp-radar-in" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <polygon points={shape} fill="url(#tpRadarFill)" stroke="rgb(var(--tp-green))" strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => {
          const [x, y] = point(i, R * Math.max(0.06, Math.min(1, d.value / 100)));
          const on = active === i;
          return (
            <g
              key={d.category}
              role="button"
              tabIndex={0}
              aria-label={`${d.category}: ${d.value.toFixed(0)} out of 100`}
              className="cursor-pointer outline-none"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <circle cx={x} cy={y} r={12} fill="transparent" />
              {on && <circle cx={x} cy={y} r={9} fill="rgb(var(--tp-green))" fillOpacity="0.25" />}
              <circle cx={x} cy={y} r={on ? 5 : 3.5} fill="rgb(var(--tp-green))" stroke="rgb(var(--tp-card))" strokeWidth="2" />
            </g>
          );
        })}
      </g>

      {/* Every axis carries its own number: no hovering needed to read the card */}
      {data.map((d, i) => {
        const cos = Math.cos(angle(i));
        const sin = Math.sin(angle(i));
        const [x, y] = point(i, R + (narrow ? 7 : 10));
        const side = Math.abs(cos) > 0.3;
        const anchor = !side ? 'middle' : cos > 0 ? 'start' : 'end';
        const on = active === i;
        const label = SHORT_LABEL[d.category] ?? d.category;
        const value = d.value.toFixed(0);
        const dim = active !== null && !on;
        return (
          <text
            key={d.category}
            x={x}
            y={side ? y - 3 : sin < 0 ? y - 2 : y + 11}
            textAnchor={anchor}
            fontSize={narrow ? 11 : 12}
            style={{ opacity: dim ? 0.45 : 1, transition: 'opacity 0.2s ease' }}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <tspan fill={on ? '#F2F4F8' : '#98A1B3'}>{label}</tspan>
            <tspan
              x={side ? x : undefined}
              dx={side ? undefined : 6}
              dy={side ? 15 : undefined}
              fill="#F2F4F8"
              fontSize={narrow ? 12 : 13}
              fontWeight="700"
              style={{ fontFamily: "ui-rounded, 'SF Pro Rounded', -apple-system, system-ui, sans-serif" }}
            >
              {value}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

export const RadarChartComponent: React.FC<RadarChartComponentProps> = ({ data, score }) => {
  const hasMounted = useHasMounted();
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasMounted]);

  const tooltipContent = `Comprehensive performance score based on:\n\n• Win rate and consistency\n• Profit factor and risk management\n• Overall trading effectiveness\n\nScores above 80 indicate excellent performance.`;

  if (!hasMounted) {
    return <div className="h-full min-h-[25rem] rounded-xl border border-white/5 bg-tp-base/40 lg:min-h-0" />;
  }

  const pct = Math.max(0, Math.min(100, score));

  return (
    <div className="relative flex h-full min-h-[25rem] flex-col overflow-hidden rounded-xl border border-white/5 p-4 sm:p-5 lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-semibold text-zinc-100 sm:text-base">Trading score</h3>
          <Tooltip content={tooltipContent} position="top">
            <div className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-tp-card transition-all hover:bg-white/10">
              <span className="text-xs text-zinc-400">?</span>
            </div>
          </Tooltip>
        </div>
        <span className="rounded-full bg-tp-fill px-2.5 py-0.5 text-xs font-semibold text-zinc-200">{gradeFor(pct)}</span>
      </div>

      <div ref={boxRef} className="relative mb-3 mt-2 min-h-[14rem] flex-1 lg:min-h-0">
        {size.width > 0 && size.height > 0 && <ScoreRadar data={data} width={size.width} height={size.height} />}
      </div>

      {/* Score + where it sits on the scale */}
      <div className="flex shrink-0 items-center gap-4" aria-label={`Trading score ${pct.toFixed(0)} out of 100`}>
        <div className="flex items-baseline gap-1">
          <span className="text-[30px] font-bold leading-none tracking-tight tabular-nums text-white">{pct.toFixed(0)}</span>
          <span className="text-xs font-medium tabular-nums text-zinc-500">/ 100</span>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <div className="relative h-1.5">
            <div className="absolute inset-0 rounded-full opacity-25" style={{ background: SPECTRUM }} />
            <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full transition-[width] duration-1000 ease-spring" style={{ width: `${pct}%` }}>
              <div className="h-full" style={{ background: SPECTRUM, width: `${pct ? 10000 / pct : 100}%` }} />
            </div>
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgb(var(--tp-base)),0_2px_6px_rgba(0,0,0,0.5)] transition-[left] duration-1000 ease-spring"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-zinc-500">
            {[0, 20, 40, 60, 80, 100].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
