'use client';

import React, { useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useHasMounted } from '@/hooks/useHasMounted';
import { HelpTooltip } from '@/components/ui';
import { AxisPill, ChartCard, GREEN, RED, compactUsd, fullUsd, longDate, niceTicks, useSize } from './chartKit';

interface BarData {
  date: string;
  value: number;
}

interface BarChartComponentProps {
  data: BarData[];
  title: string;
}

/** Bar with only its outer end rounded. */
function barPath(x: number, y0: number, y1: number, w: number, r: number) {
  const up = y1 < y0;
  const hgt = Math.abs(y1 - y0);
  const rr = Math.min(r, hgt, w / 2);
  if (up) return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`;
  return `M${x},${y0}V${y1 - rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 - rr}V${y0}Z`;
}

export const BarChartComponent: React.FC<BarChartComponentProps> = ({ data, title }) => {
  const mounted = useHasMounted();
  const uid = useId().replace(/:/g, '');
  const [plotRef, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const pad = { l: 46, r: 8, t: 14, b: 24 };
  const pw = Math.max(0, w - pad.l - pad.r);
  const ph = Math.max(0, h - pad.t - pad.b);

  // As many recent days as fit comfortably.
  const days = useMemo(() => data.slice(-Math.max(5, Math.min(30, Math.floor(pw / 24) || 10))), [data, pw]);

  const { yTicks, yMin, yMax } = useMemo(() => {
    const vals = days.map((d) => d.value);
    const t = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
    return { yTicks: t, yMin: t[0], yMax: t[t.length - 1] };
  }, [days]);

  const slot = days.length ? pw / days.length : 0;
  const bw = Math.max(6, Math.min(26, slot * 0.58));
  const sy = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * ph;
  const zeroY = sy(0);
  const cx = (i: number) => pad.l + slot * i + slot / 2;
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(pw / 48))));

  const total = days.reduce((n, d) => n + d.value, 0);
  const green = days.filter((d) => d.value > 0).length;
  const red = days.filter((d) => d.value < 0).length;
  const shown = hover !== null ? days[hover] : null;

  return (
    <ChartCard>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <HelpTooltip content="Net profit or loss for each trading day. Hover a bar for the day." />
        </div>
        {mounted && days.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            {shown ? (
              <>
                <span className={clsx('text-2xl font-semibold tabular-nums tracking-tight', shown.value >= 0 ? 'text-tp-green' : 'text-tp-red')}>{fullUsd(shown.value)}</span>
                <span className="text-xs text-zinc-400">on {longDate(shown.date)}</span>
              </>
            ) : (
              <>
                <span className={clsx('text-2xl font-semibold tabular-nums tracking-tight', total >= 0 ? 'text-zinc-50' : 'text-tp-red')}>{fullUsd(total)}</span>
                <span className="text-xs text-zinc-400">
                  last {days.length} days · <span className="text-tp-green">{green} green</span> · <span className="text-tp-red">{red} red</span>
                </span>
              </>
            )}
          </div>
        )}

        <div ref={plotRef} className="relative mt-2 min-h-[160px] flex-1">
          {mounted && days.length === 0 && <p className="absolute inset-0 grid place-items-center text-xs text-zinc-500">No trading days in this range yet.</p>}
          {mounted && days.length > 0 && w > 0 && h > 0 && (
            <svg
              width={w}
              height={h}
              className="absolute inset-0 select-none"
              onMouseMove={(e) => {
                const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
                const i = Math.floor((x - pad.l) / (slot || 1));
                setHover(i >= 0 && i < days.length ? i : null);
              }}
              onMouseLeave={() => setHover(null)}
              role="img"
              aria-label={`${title} bar chart`}
            >
              <defs>
                <linearGradient id={`${uid}-g`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={GREEN} />
                  <stop offset="100%" stopColor={GREEN} stopOpacity="0.55" />
                </linearGradient>
                <linearGradient id={`${uid}-r`} x1="0" x2="0" y1="1" y2="0">
                  <stop offset="0%" stopColor={RED} />
                  <stop offset="100%" stopColor={RED} stopOpacity="0.55" />
                </linearGradient>
              </defs>

              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)'} />
                  <text x={pad.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize="10" className="fill-zinc-500 tabular-nums">
                    {compactUsd(t)}
                  </text>
                </g>
              ))}

              {hover !== null && <rect x={pad.l + slot * hover + 2} y={pad.t} width={slot - 4} height={ph} rx={6} fill="rgba(255,255,255,0.035)" />}

              {days.map((d, i) => {
                const y1 = sy(d.value);
                const tiny = Math.abs(y1 - zeroY) < 3;
                const pos = d.value >= 0;
                const dim = hover !== null && hover !== i;
                return (
                  <g key={d.date} opacity={dim ? 0.35 : 1} style={{ transition: 'opacity .15s' }}>
                    <path d={barPath(cx(i) - bw / 2, zeroY, tiny ? zeroY + (pos ? -3 : 3) : y1, bw, 5)} fill={`url(#${uid}-${pos ? 'g' : 'r'})`} />
                    {hover === i && (
                      <text x={cx(i)} y={pos ? y1 - 6 : y1 + 13} textAnchor="middle" fontSize="10" fontWeight={600} fill={pos ? GREEN : RED} className="tabular-nums">
                        {compactUsd(d.value, true)}
                      </text>
                    )}
                    {i % labelEvery === 0 && hover !== i && (
                      <text x={cx(i)} y={h - 6} textAnchor="middle" fontSize="10" className="fill-zinc-500">
                        {`${+d.date.slice(5, 7)}/${+d.date.slice(8, 10)}`}
                      </text>
                    )}
                  </g>
                );
              })}

              {hover !== null && <AxisPill x={Math.min(Math.max(cx(hover), pad.l + 26), w - pad.r - 26)} y={h - 9} text={longDate(days[hover].date).replace(/^\w+, /, '')} />}
            </svg>
          )}
        </div>
      </div>
    </ChartCard>
  );
};
