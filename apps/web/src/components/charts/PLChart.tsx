'use client';

import React, { useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useHasMounted } from '@/hooks/useHasMounted';
import { HelpTooltip } from '@/components/ui';
import { AxisPill, ChartCard, GREEN, RED, compactUsd, fullUsd, longDate, monotonePath, niceTicks, shortDate, useSize } from './chartKit';

interface PLData {
  date: string;
  cumulative: number;
  daily: number;
}

interface PLChartProps {
  data: PLData[];
  type: 'cumulative' | 'daily';
}

export const PLChart: React.FC<PLChartProps> = ({ data }) => {
  const mounted = useHasMounted();
  const uid = useId().replace(/:/g, '');
  const [plotRef, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const pad = { l: 46, r: 14, t: 10, b: 24 };
  const pw = Math.max(0, w - pad.l - pad.r);
  const ph = Math.max(0, h - pad.t - pad.b);

  const { yTicks, yMin, yMax } = useMemo(() => {
    const vals = data.map((d) => d.cumulative);
    const t = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
    return { yTicks: t, yMin: t[0], yMax: t[t.length - 1] };
  }, [data]);

  const sx = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * pw : pw / 2);
  const sy = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * ph;
  const pts = data.map((d, i) => [sx(i), sy(d.cumulative)] as [number, number]);
  const line = monotonePath(pts);
  const zeroY = sy(0);

  const last = data[data.length - 1];
  const shown = hover !== null ? data[hover] : last;
  const first = data[0];
  const change = last && first ? last.cumulative - (first.cumulative - first.daily) : 0;

  // ~5 evenly spaced date labels
  const xLabelIdx = useMemo(() => {
    if (data.length <= 1) return [0];
    const n = Math.min(5, data.length);
    return Array.from({ length: n }, (_, k) => Math.round((k / (n - 1)) * (data.length - 1)));
  }, [data.length]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const i = Math.round(((x - pad.l) / (pw || 1)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <ChartCard>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-zinc-100">Cumulative P&amp;L</h3>
              <HelpTooltip content="Running total of your net P&L, day by day. Hover to scrub through any day." />
            </div>
            {mounted && shown && (
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className={clsx('text-2xl font-semibold tabular-nums tracking-tight', shown.cumulative < 0 ? 'text-tp-red' : 'text-zinc-50')}>{fullUsd(shown.cumulative, false)}</span>
                {hover !== null ? (
                  <span className="text-xs text-zinc-400">
                    <span className={clsx('font-semibold tabular-nums', shown.daily >= 0 ? 'text-tp-green' : 'text-tp-red')}>{fullUsd(shown.daily)}</span> on {longDate(shown.date)}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-400">
                    <span className={clsx('font-semibold tabular-nums', change >= 0 ? 'text-tp-green' : 'text-tp-red')}>{fullUsd(change)}</span> over {data.length} trading day{data.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div ref={plotRef} className="relative mt-2 min-h-[160px] flex-1">
          {mounted && data.length === 0 && <p className="absolute inset-0 grid place-items-center text-xs text-zinc-500">No trades in this range yet.</p>}
          {mounted && data.length > 0 && w > 0 && h > 0 && (
            <svg width={w} height={h} className="absolute inset-0 select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Cumulative P&L chart">
              <defs>
                <linearGradient id={`${uid}-g`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`${uid}-r`} x1="0" x2="0" y1="1" y2="0">
                  <stop offset="0%" stopColor={RED} stopOpacity="0.32" />
                  <stop offset="100%" stopColor={RED} stopOpacity="0" />
                </linearGradient>
                <clipPath id={`${uid}-above`}>
                  <rect x={0} y={0} width={w} height={Math.max(0, zeroY)} />
                </clipPath>
                <clipPath id={`${uid}-below`}>
                  <rect x={0} y={zeroY} width={w} height={Math.max(0, h - zeroY)} />
                </clipPath>
              </defs>

              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'} strokeDasharray={t === 0 ? '4 4' : undefined} />
                  <text x={pad.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize="10" className="fill-zinc-500 tabular-nums">
                    {compactUsd(t)}
                  </text>
                </g>
              ))}
              {xLabelIdx.map((i) => (
                <text key={i} x={sx(i)} y={h - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fontSize="10" className="fill-zinc-500">
                  {shortDate(data[i].date)}
                </text>
              ))}

              {/* Area + line, green above $0 and red below */}
              {line && (
                <>
                  <path d={`${line}L${pts[pts.length - 1][0]},${zeroY}L${pts[0][0]},${zeroY}Z`} fill={`url(#${uid}-g)`} clipPath={`url(#${uid}-above)`} />
                  <path d={`${line}L${pts[pts.length - 1][0]},${zeroY}L${pts[0][0]},${zeroY}Z`} fill={`url(#${uid}-r)`} clipPath={`url(#${uid}-below)`} />
                  <path d={line} fill="none" stroke={GREEN} strokeWidth="2.25" strokeLinecap="round" clipPath={`url(#${uid}-above)`} />
                  <path d={line} fill="none" stroke={RED} strokeWidth="2.25" strokeLinecap="round" clipPath={`url(#${uid}-below)`} />
                </>
              )}

              {/* Latest point */}
              {hover === null && last && (
                <g>
                  <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="7" fill={last.cumulative >= 0 ? GREEN : RED} opacity="0.18" className="animate-pulse" />
                  <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={last.cumulative >= 0 ? GREEN : RED} stroke="#172035" strokeWidth="1.5" />
                </g>
              )}

              {/* Crosshair */}
              {hover !== null && (
                <g pointerEvents="none">
                  <line x1={pts[hover][0]} x2={pts[hover][0]} y1={pad.t} y2={pad.t + ph} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 3" />
                  <line x1={pad.l} x2={w - pad.r} y1={pts[hover][1]} y2={pts[hover][1]} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                  <circle cx={pts[hover][0]} cy={pts[hover][1]} r="8" fill={data[hover].cumulative >= 0 ? GREEN : RED} opacity="0.2" />
                  <circle cx={pts[hover][0]} cy={pts[hover][1]} r="4" fill={data[hover].cumulative >= 0 ? GREEN : RED} stroke="#fff" strokeWidth="1.5" />
                  <AxisPill x={Math.min(Math.max(pts[hover][0], pad.l + 30), w - pad.r - 30)} y={h - 9} text={shortDate(data[hover].date)} />
                  <AxisPill x={pad.l - 3} y={pts[hover][1]} anchor="end" text={compactUsd(data[hover].cumulative)} tone={data[hover].cumulative >= 0 ? 'green' : 'red'} />
                </g>
              )}
            </svg>
          )}
        </div>
      </div>
    </ChartCard>
  );
};
