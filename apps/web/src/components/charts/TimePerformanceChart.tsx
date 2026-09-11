'use client';

import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { TradeScatterCard, type Bucket } from './TradeScatterCard';

interface TimeData {
  time: number; // Decimal hour, 24h clock (9.5 = 9:30 AM)
  pnl: number;
  outcome: 'win' | 'loss';
}

interface TimePerformanceChartProps {
  data: TimeData[];
}

const hourLabel = (h: number) => {
  const hr = ((Math.floor(h) + 11) % 12) + 1;
  return `${hr}${Math.floor(h) % 24 < 12 ? 'a' : 'p'}`;
};

const clock = (h: number) => {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  const hr = ((whole + 11) % 12) + 1;
  return `${hr}:${String(mins).padStart(2, '0')} ${whole % 24 < 12 ? 'AM' : 'PM'}`;
};

export const TimePerformanceChart: React.FC<TimePerformanceChartProps> = ({ data }) => {
  const { points, buckets, domain, ticks } = useMemo(() => {
    const points = data.map((d) => ({ x: d.time, pnl: d.pnl }));
    if (!points.length) return { points, buckets: [] as Bucket[], domain: [9, 16] as [number, number], ticks: [] };
    const lo = Math.floor(Math.min(...points.map((p) => p.x)));
    const hi = Math.floor(Math.max(...points.map((p) => p.x))) + 1;
    // Hourly buckets; widen to 2h when the session spans the whole day.
    const step = hi - lo > 9 ? 2 : 1;
    const buckets: Bucket[] = [];
    for (let h = lo; h < hi; h += step) buckets.push({ label: hourLabel(h), from: h, to: h + step });
    const ticks = buckets.map((b) => ({ value: b.from, label: b.label }));
    ticks.push({ value: hi, label: hourLabel(hi) });
    return { points, buckets, domain: [lo - 0.15, hi + 0.15] as [number, number], ticks };
  }, [data]);

  return (
    <TradeScatterCard
      title="Time of day"
      icon={Clock}
      points={points}
      buckets={buckets}
      domain={domain}
      ticks={ticks}
      formatX={(x) => `Entered ${clock(x)}`}
      xNoun="entry time"
      bestPhrase={(b) => {
        const end = hourLabel(b.to);
        return `${b.label}–${end}`;
      }}
      emptyText="Import trades with times to see your best hours."
    />
  );
};
