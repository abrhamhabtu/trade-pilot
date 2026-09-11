'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useHasMounted } from '@/hooks/useHasMounted';
import { AxisPill, GREEN, RED, compactUsd, fullUsd, niceTicks, useSize } from './chartKit';

export { compactUsd };

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
  /** Short label for the crosshair pill on the x-axis. */
  pillX: (x: number) => string;
  xNoun: string;
  bandLabel: string;
  bestPhrase: (bucket: Bucket) => string;
  emptyText: string;
}

const BAND = 78;
const AXIS = 22;

export function TradeScatterCard({ title, icon: Icon, points, buckets, scale = 'linear', domain, ticks, formatX, pillX, xNoun, bandLabel, bestPhrase, emptyText }: TradeScatterCardProps) {
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
    return { rows, best, worst: worst && worst.net < 0 && worst.label !== best?.label ? worst : null, maxAbs: Math.max(1, ...traded.map((r) => Math.abs(r.net))) };
  }, [buckets, points]);

  const wins = points.filter((p) => p.pnl > 0).length;
  const losses = points.length - wins;

  // Geometry: scatter on top, x-axis labels, then the net band.
  const pad = { l: 46, r: 12, t: 8 };
  const pw = Math.max(0, w - pad.l - pad.r);
  const scatterBottom = Math.max(pad.t + 40, h - BAND - AXIS);
  const ph = scatterBottom - pad.t;
  const bandTop = scatterBottom + AXIS;
  const baseline = bandTop + BAND / 2;
  const barMax = BAND / 2 - 15;

  const yTicks = useMemo(() => {
    if (!points.length) return [0];
    return niceTicks(Math.min(0, ...points.map((p) => p.pnl)), Math.max(0, ...points.map((p) => p.pnl)), 3);
  }, [points]);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const [dMin, dMax] = [tx(domain[0]), tx(domain[1])];
  const sx = (x: number) => pad.l + ((tx(Math.min(Math.max(x, domain[0]), domain[1])) - dMin) / (dMax - dMin || 1)) * pw;
  const sy = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * ph;
  const bucketX = (b: Bucket) => [sx(b.from), sx(Math.min(b.to, domain[1]))] as const;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    if (my > scatterBottom + 4) {
      setHover(null);
      const i = stats.rows.findIndex((b) => {
        const [a, z] = bucketX(b);
        return mx >= a && mx < z;
      });
      setActiveBucket(i >= 0 && stats.rows[i].count ? i : null);
      return;
    }
    setActiveBucket(null);
    let bestI: number | null = null;
    let bestD = 24 ** 2;
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
  const bucket = activeBucket !== null ? stats.rows[activeBucket] : null;
  const inBucket = (p: ScatterPoint) => !bucket || (p.x >= bucket.from && p.x < bucket.to);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/5 transition-all duration-200 hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div className="relative z-10 flex h-full min-h-[23rem] flex-col p-4">
        {/* Header with live readout */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-tp-blue" />
              <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">
              {hovered ? (
                <>
                  <span className="text-zinc-300">{formatX(hovered.x)}</span> ·{' '}
                  <span className={clsx('font-semibold tabular-nums', hovered.pnl > 0 ? 'text-tp-green' : 'text-tp-red')}>{fullUsd(hovered.pnl)}</span>
                </>
              ) : bucket ? (
                <>
                  <span className="text-zinc-300">{bucket.label}</span> · {bucket.count} trade{bucket.count === 1 ? '' : 's'} ·{' '}
                  <span className={clsx('font-semibold tabular-nums', bucket.net >= 0 ? 'text-tp-green' : 'text-tp-red')}>{fullUsd(bucket.net)}</span> · {Math.round(bucket.winRate)}% win rate
                </>
              ) : stats.best && stats.best.net > 0 ? (
                <>
                  Best: <span className="text-tp-green">{bestPhrase(stats.best)}</span> · {compactUsd(stats.best.net, true)} over {stats.best.count} trade{stats.best.count === 1 ? '' : 's'}
                </>
              ) : (
                `Each dot is one trade, placed by ${xNoun} and P&L.`
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 pt-0.5 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-tp-green" /> {wins}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-tp-red" /> {losses}
            </span>
          </div>
        </div>

        <div ref={plotRef} className="relative mt-3 min-h-[260px] flex-1">
          {mounted && points.length === 0 && <p className="absolute inset-0 grid place-items-center text-center text-xs text-zinc-500">{emptyText}</p>}
          {mounted && points.length > 0 && w > 0 && h > 0 && (
            <svg
              width={w}
              height={h}
              className="absolute inset-0 select-none"
              onMouseMove={onMove}
              onMouseLeave={() => {
                setHover(null);
                setActiveBucket(null);
              }}
              role="img"
              aria-label={`${title}: scatter of trades with net P&L by bucket`}
            >
              {/* Bucket highlight spans the dots and the band */}
              {bucket &&
                (() => {
                  const [a, z] = bucketX(bucket);
                  return <rect x={a + 1} y={pad.t} width={Math.max(0, z - a - 2)} height={h - pad.t} rx={8} fill="rgba(255,255,255,0.035)" />;
                })()}

              {/* Y grid */}
              {yTicks.map((t) => (
                <g key={t}>
                  <line x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'} strokeDasharray={t === 0 ? '4 4' : undefined} />
                  <text x={pad.l - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize="10" className="fill-zinc-500 tabular-nums">
                    {compactUsd(t)}
                  </text>
                </g>
              ))}

              {/* X axis labels */}
              {ticks
                .filter((t) => tx(t.value) >= dMin && tx(t.value) <= dMax)
                .map((t) => (
                  <g key={t.value}>
                    <line x1={sx(t.value)} x2={sx(t.value)} y1={pad.t} y2={scatterBottom} stroke="rgba(255,255,255,0.03)" />
                    {!(hovered && Math.abs(sx(t.value) - sx(hovered.x)) < 30) && (
                      <text x={sx(t.value)} y={scatterBottom + 14} textAnchor="middle" fontSize="10" className="fill-zinc-500">
                        {t.label}
                      </text>
                    )}
                  </g>
                ))}

              {/* Crosshair */}
              {hovered && (
                <g pointerEvents="none">
                  <line x1={sx(hovered.x)} x2={sx(hovered.x)} y1={pad.t} y2={scatterBottom} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                  <line x1={pad.l} x2={w - pad.r} y1={sy(hovered.pnl)} y2={sy(hovered.pnl)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
                </g>
              )}

              {/* Dots */}
              {points.map((p, i) => {
                const on = hover === i;
                const dim = (hover !== null && !on) || !inBucket(p);
                const color = p.pnl > 0 ? GREEN : RED;
                return (
                  <g key={i} pointerEvents="none">
                    {on && <circle cx={sx(p.x)} cy={sy(p.pnl)} r={11} fill={color} opacity={0.2} />}
                    <circle cx={sx(p.x)} cy={sy(p.pnl)} r={on ? 6 : 4.5} fill={color} fillOpacity={dim ? 0.16 : 0.92} stroke={on ? '#fff' : '#172035'} strokeWidth={1.5} style={{ transition: 'fill-opacity .15s' }} />
                  </g>
                );
              })}

              {hovered && (
                <>
                  <AxisPill x={Math.min(Math.max(sx(hovered.x), pad.l + 30), w - pad.r - 30)} y={scatterBottom + 11} text={pillX(hovered.x)} />
                  <AxisPill x={pad.l - 3} y={sy(hovered.pnl)} anchor="end" text={compactUsd(hovered.pnl, true)} tone={hovered.pnl > 0 ? 'green' : 'red'} />
                </>
              )}

              {/* Net band */}
              <line x1={pad.l} x2={w - pad.r} y1={bandTop - 4} y2={bandTop - 4} stroke="rgba(255,255,255,0.05)" />
              <text x={pad.l - 8} y={baseline} dy="0.32em" textAnchor="end" fontSize="9" fontWeight={600} letterSpacing="0.06em" className="fill-zinc-600 uppercase">
                {bandLabel}
              </text>
              <line x1={pad.l} x2={w - pad.r} y1={baseline} y2={baseline} stroke="rgba(255,255,255,0.1)" />
              {stats.rows.map((b, i) => {
                const [a, z] = bucketX(b);
                const colW = z - a;
                const bw = Math.max(6, Math.min(colW - 14, 40));
                const x = a + (colW - bw) / 2;
                const hgt = b.count ? Math.max(3, (Math.abs(b.net) / stats.maxAbs) * barMax) : 0;
                const pos = b.net >= 0;
                const isBest = b.label === stats.best?.label && b.net > 0;
                const isWorst = b.label === stats.worst?.label;
                const faded = activeBucket !== null && activeBucket !== i;
                const mid = a + colW / 2;
                return (
                  <g key={b.label} opacity={faded ? 0.35 : 1} style={{ transition: 'opacity .15s' }}>
                    {b.count > 0 ? (
                      <>
                        <rect x={x} y={pos ? baseline - hgt : baseline} width={bw} height={hgt} rx={3} fill={pos ? GREEN : RED} fillOpacity={isBest || isWorst || activeBucket === i ? 0.9 : 0.45} />
                        <text x={mid} y={pos ? baseline - hgt - 5 : baseline + hgt + 11} textAnchor="middle" fontSize="10" fontWeight={600} className="tabular-nums" fill={pos ? (isBest ? GREEN : '#D4D4D8') : RED}>
                          {compactUsd(b.net, true)}
                        </text>
                      </>
                    ) : (
                      <text x={mid} y={baseline - 5} textAnchor="middle" fontSize="10" className="fill-zinc-700">
                        —
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
