'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface ScatterPoint {
  x: number;
  pnl: number;
}

export interface Bucket {
  label: string;
  /** Inclusive lower bound, exclusive upper bound, in x units. */
  from: number;
  to: number;
}

interface TradeScatterCardProps {
  title: string;
  icon: React.ElementType;
  points: ScatterPoint[];
  buckets: Bucket[];
  /** 'log' suits skewed data such as hold time. */
  scale?: 'linear' | 'log';
  domain: [number, number];
  ticks: { value: number; label: string }[];
  formatX: (x: number) => string;
  xNoun: string;
  bestPhrase: (bucket: Bucket) => string;
  emptyText: string;
}

const GREEN = '#00D68F';
const RED = '#FF4868';

export const compactUsd = (v: number, sign = false) => {
  const a = Math.abs(v);
  const body = a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : `$${Math.round(a)}`;
  return v < 0 ? `-${body}` : sign && v > 0 ? `+${body}` : body;
};

const fullUsd = (v: number) => `${v < 0 ? '-' : '+'}${Math.abs(v).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function TradeScatterCard({ title, icon: Icon, points, buckets, scale = 'linear', domain, ticks, formatX, xNoun, bestPhrase, emptyText }: TradeScatterCardProps) {
  const mounted = useHasMounted();
  const [plotRef, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [activeBucket, setActiveBucket] = useState<number | null>(null);

  const tx = (x: number) => (scale === 'log' ? Math.log(Math.max(x, 0.5)) : x);

  const stats = useMemo(() => {
    const rows = buckets.map((b) => {
      const inside = points.filter((p) => p.x >= b.from && p.x < b.to);
      const net = inside.reduce((n, p) => n + p.pnl, 0);
      const wins = inside.filter((p) => p.pnl > 0).length;
      return { ...b, count: inside.length, net, winRate: inside.length ? (wins / inside.length) * 100 : 0 };
    });
    const traded = rows.filter((r) => r.count > 0);
    const best = traded.length ? traded.reduce((a, b) => (b.net > a.net ? b : a)) : null;
    const worst = traded.length > 1 ? traded.reduce((a, b) => (b.net < a.net ? b : a)) : null;
    return { rows, best, worst: worst && worst.label !== best?.label && worst.net < 0 ? worst : null, maxAbs: Math.max(1, ...traded.map((r) => Math.abs(r.net))) };
  }, [buckets, points]);

  const wins = points.filter((p) => p.pnl > 0).length;
  const losses = points.length - wins;

  // Plot geometry
  const pad = { l: 44, r: 10, t: 10, b: 22 };
  const pw = Math.max(0, w - pad.l - pad.r);
  const ph = Math.max(0, h - pad.t - pad.b);
  const yTicks = useMemo(() => {
    if (!points.length) return [0];
    const lo = Math.min(0, ...points.map((p) => p.pnl));
    const hi = Math.max(0, ...points.map((p) => p.pnl));
    return niceTicks(lo, hi);
  }, [points]);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const [dMin, dMax] = [tx(domain[0]), tx(domain[1])];
  const sx = (x: number) => pad.l + ((tx(x) - dMin) / (dMax - dMin || 1)) * pw;
  const sy = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * ph;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let bestI: number | null = null;
    let bestD = 22 ** 2;
    points.forEach((p, i) => {
      const d = (sx(p.x) - mx) ** 2 + (sy(p.pnl) - my) ** 2;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    });
    setHover(bestI);
  };

  const hovered = hover !== null ? points[hover] : null;
  const bucketOf = (p: ScatterPoint) => stats.rows.findIndex((b) => p.x >= b.from && p.x < b.to);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/5 transition-all duration-200 hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div className="relative z-10 flex h-full min-h-[22rem] flex-col p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-tp-blue" />
              <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">
              {stats.best && stats.best.net > 0 ? (
                <>
                  Best: <span className="text-tp-green">{bestPhrase(stats.best)}</span> · {compactUsd(stats.best.net, true)} over {stats.best.count} trade{stats.best.count === 1 ? '' : 's'}
                </>
              ) : (
                `Each dot is one trade, placed by ${xNoun} and P&L.`
              )}
            </p>
          </div>
        </div>

        {/* Readout — replaces a floating tooltip so nothing covers the dots */}
        <div className="mt-3 flex h-6 items-center justify-between gap-3 rounded-lg bg-black/20 px-2.5 text-[11px] ring-1 ring-inset ring-white/[0.04]">
          {hovered ? (
            <span className="flex min-w-0 items-center gap-2 truncate">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hovered.pnl > 0 ? GREEN : RED }} />
              <span className="text-zinc-300">{formatX(hovered.x)}</span>
              <span className={clsx('font-semibold tabular-nums', hovered.pnl > 0 ? 'text-tp-green' : 'text-tp-red')}>{fullUsd(hovered.pnl)}</span>
            </span>
          ) : (
            <span className="flex items-center gap-3 text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-tp-green" /> {wins} win{wins === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-tp-red" /> {losses} loss{losses === 1 ? '' : 'es'}
              </span>
            </span>
          )}
          <span className="shrink-0 text-zinc-600">{hovered ? 'trade' : 'hover a dot'}</span>
        </div>

        {/* Plot */}
        <div ref={plotRef} className="relative mt-2 min-h-[140px] flex-1">
          {mounted && points.length === 0 && <p className="absolute inset-0 grid place-items-center text-center text-xs text-zinc-500">{emptyText}</p>}
          {mounted && points.length > 0 && w > 0 && h > 0 && (
            <svg width={w} height={h} className="absolute inset-0 select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`${title} scatter plot`}>
              {/* Y grid + labels */}
              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.05)'} strokeDasharray={t === 0 ? '4 4' : undefined} />
                  <text x={pad.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[10px] tabular-nums">
                    {compactUsd(t)}
                  </text>
                </g>
              ))}
              {/* X labels */}
              {ticks
                .filter((t) => tx(t.value) >= dMin && tx(t.value) <= dMax)
                .map((t) => (
                  <g key={t.value}>
                    <line x1={sx(t.value)} x2={sx(t.value)} y1={pad.t} y2={pad.t + ph} stroke="rgba(255,255,255,0.03)" />
                    <text x={sx(t.value)} y={h - 6} textAnchor="middle" className="fill-zinc-500 text-[10px]">
                      {t.label}
                    </text>
                  </g>
                ))}
              {/* Hover crosshair */}
              {hovered && (
                <g pointerEvents="none">
                  <line x1={sx(hovered.x)} x2={sx(hovered.x)} y1={sy(hovered.pnl)} y2={pad.t + ph} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 3" />
                  <line x1={pad.l} x2={sx(hovered.x)} y1={sy(hovered.pnl)} y2={sy(hovered.pnl)} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 3" />
                </g>
              )}
              {/* Dots */}
              {points.map((p, i) => {
                const dim = (activeBucket !== null && bucketOf(p) !== activeBucket) || (hover !== null && hover !== i);
                const on = hover === i;
                const color = p.pnl > 0 ? GREEN : RED;
                return (
                  <g key={i} pointerEvents="none">
                    {on && <circle cx={sx(p.x)} cy={sy(p.pnl)} r={10} fill={color} opacity={0.18} />}
                    <circle
                      cx={sx(p.x)}
                      cy={sy(p.pnl)}
                      r={on ? 6 : 4.5}
                      fill={color}
                      fillOpacity={dim ? 0.18 : 0.9}
                      stroke="#172035"
                      strokeWidth={1.5}
                      style={{ transition: 'r .15s, fill-opacity .15s' }}
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Bucket summary */}
        {points.length > 0 && (
          <div className="mt-3 border-t border-white/[0.05] pt-3">
            <div className="flex gap-1" onMouseLeave={() => setActiveBucket(null)}>
              {stats.rows.map((b, i) => {
                const isBest = b.label === stats.best?.label && b.net > 0;
                const isWorst = b.label === stats.worst?.label;
                return (
                  <button
                    key={b.label}
                    type="button"
                    onMouseEnter={() => setActiveBucket(b.count ? i : null)}
                    onFocus={() => setActiveBucket(b.count ? i : null)}
                    onBlur={() => setActiveBucket(null)}
                    title={b.count ? `${b.label}: ${b.count} trades · ${compactUsd(b.net, true)} net · ${Math.round(b.winRate)}% win rate` : `${b.label}: no trades`}
                    className={clsx(
                      'min-w-0 flex-1 rounded-lg px-1 py-1.5 text-center transition-colors',
                      activeBucket === i ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                      isBest && 'ring-1 ring-inset ring-tp-green/30',
                      isWorst && 'ring-1 ring-inset ring-tp-red/25',
                    )}
                  >
                    <div className="mx-auto flex h-6 w-full max-w-[28px] flex-col justify-end">
                      {b.count > 0 && (
                        <div className={clsx('w-full rounded-sm', b.net >= 0 ? 'bg-tp-green/70' : 'bg-tp-red/70')} style={{ height: `${Math.max(12, (Math.abs(b.net) / stats.maxAbs) * 100)}%` }} />
                      )}
                    </div>
                    <div className={clsx('mt-1 truncate text-[10px] font-semibold tabular-nums', !b.count ? 'text-zinc-700' : b.net >= 0 ? 'text-zinc-200' : 'text-tp-red')}>{b.count ? compactUsd(b.net, true) : '—'}</div>
                    <div className="truncate text-[10px] text-zinc-500">{b.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
