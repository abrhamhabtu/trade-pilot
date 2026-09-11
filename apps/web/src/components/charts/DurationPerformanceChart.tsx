'use client';

import React, { useMemo } from 'react';
import { Timer } from 'lucide-react';
import { TradeScatterCard, type Bucket } from './TradeScatterCard';

interface DurationData {
  duration: number; // Minutes
  pnl: number;
  outcome: 'win' | 'loss';
}

interface DurationPerformanceChartProps {
  data: DurationData[];
}

const RANGES: Bucket[] = [
  { label: '<5m', from: 0, to: 5 },
  { label: '5–15m', from: 5, to: 15 },
  { label: '15–30m', from: 15, to: 30 },
  { label: '30–60m', from: 30, to: 60 },
  { label: '1–2h', from: 60, to: 120 },
  { label: '2h+', from: 120, to: Infinity },
];

const TICKS = [1, 2, 5, 10, 15, 30, 60, 120, 240, 480].map((m) => ({ value: m, label: m < 60 ? `${m}m` : `${m / 60}h` }));

const hold = (m: number) => {
  if (m < 1) return `${Math.round(m * 60)} sec`;
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h}h ${r}m` : `${h}h`;
};

export const DurationPerformanceChart: React.FC<DurationPerformanceChartProps> = ({ data }) => {
  const { points, buckets, domain } = useMemo(() => {
    const points = data.map((d) => ({ x: Math.max(0, d.duration), pnl: d.pnl }));
    if (!points.length) return { points, buckets: RANGES, domain: [1, 120] as [number, number] };
    const xs = points.map((p) => Math.max(p.x, 0.5));
    const used = RANGES.map((r, i) => (points.some((p) => p.x >= r.from && p.x < r.to) ? i : -1)).filter((i) => i >= 0);
    return {
      points,
      buckets: RANGES.slice(used[0], used[used.length - 1] + 1),
      // Log scale: short scalps and long holds both get room.
      domain: [Math.min(...xs) / 1.4, Math.max(...xs) * 1.4] as [number, number],
    };
  }, [data]);

  return (
    <TradeScatterCard
      title="Holding time"
      icon={Timer}
      points={points}
      buckets={buckets}
      scale="log"
      domain={domain}
      ticks={TICKS}
      formatX={(x) => `Held ${hold(x)}`}
      xNoun="holding time"
      bestPhrase={(b) => `${b.label} holds`}
      emptyText="Import trades with durations to see your best holding time."
    />
  );
};
