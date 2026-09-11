'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Shared pieces for the dashboard's hand-drawn SVG charts, so every chart hovers the same way:
 * a crosshair plus axis "pills" (TradingView-style) instead of a floating box over the data.
 */

export const GREEN = '#00D68F';
export const RED = '#FF4868';

export const compactUsd = (v: number, sign = false) => {
  const a = Math.abs(v);
  const body = a >= 1000 ? `$${(a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : `$${Math.round(a)}`;
  return v < 0 ? `-${body}` : sign && v > 0 ? `+${body}` : body;
};

export const fullUsd = (v: number, sign = true) =>
  `${v < 0 ? '-' : sign && v > 0 ? '+' : ''}${Math.abs(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`;

/** YYYY-MM-DD at local noon, so dates never slip a day. */
export const localDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`);
export const shortDate = (d: string) => localDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const longDate = (d: string) => localDate(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export function niceTicks(min: number, max: number, count = 4) {
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

export function useSize<T extends HTMLElement>() {
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

/** Smooth line through points that never overshoots (monotone cubic). */
export function monotonePath(pts: [number, number][]) {
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  t[n - 1] = m[n - 2];
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + h * t[i]).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - h * t[i + 1]).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

/** Small label pinned to an axis at the crosshair. `x` is the centre for bottom pills, the right edge for left pills. */
export function AxisPill({ x, y, text, tone = 'light', anchor = 'middle' }: { x: number; y: number; text: string; tone?: 'light' | 'green' | 'red'; anchor?: 'middle' | 'end' }) {
  const w = text.length * 6 + 12;
  const h = 17;
  const left = anchor === 'middle' ? x - w / 2 : x - w;
  const fill = tone === 'green' ? GREEN : tone === 'red' ? RED : '#F4F4F5';
  return (
    <g pointerEvents="none">
      <rect x={left} y={y - h / 2} width={w} height={h} rx={5} fill={fill} />
      <text x={left + w / 2} y={y} dy="0.34em" textAnchor="middle" fontSize="10" fontWeight={600} fill={tone === 'light' ? '#09090B' : '#04120C'} className="tabular-nums">
        {text}
      </text>
    </g>
  );
}

/** Card chrome shared by the dashboard charts. */
export function ChartCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/5 transition-all duration-200 hover:border-white/10 hover:shadow-lg hover:shadow-black/20 ${className}`}>
      {children}
    </div>
  );
}
