"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Bar } from "@/lib/pilot/market";
import { nyClock } from "@/lib/pilot/market";
import type { SimTrade } from "@/lib/proving/engine";
import type { DayMark } from "@/lib/proving/firms";

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * The account as a firm sees it: balance by session, the intraday range as a
 * whisker, the drawdown threshold as a stepped red line, the target in green.
 */
export function EquityChart({
  marks,
  start,
  target,
  color,
  verdict,
  height = 280,
}: {
  marks: DayMark[];
  start: number;
  target: number;
  color: string;
  verdict: "passed" | "failed" | "active" | "pending";
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [progress, setProgress] = useState(1);
  const pad = { l: 64, r: 16, t: 16, b: 28 };
  const w = Math.max(width, 200);
  const n = Math.max(marks.length, 1);

  const { y, min, max } = useMemo(() => {
    const vals = [start + target, start, ...marks.flatMap((m) => [m.low, m.high, m.threshold, m.balance])];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo || 1;
    const min = lo - span * 0.06;
    const max = hi + span * 0.06;
    return { min, max, y: (v: number) => pad.t + (1 - (v - min) / (max - min)) * (height - pad.t - pad.b) };
  }, [marks, start, target, height, pad.t, pad.b]);
  const x = (i: number) => pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : (i / (n - 1)) * (w - pad.l - pad.r));

  const shown = Math.max(1, Math.ceil(marks.length * progress));
  const vis = marks.slice(0, shown);
  const line = [`M${x(0)},${y(start)}`, ...vis.map((m, i) => `L${x(i)},${y(m.balance)}`)].join(" ");
  const area = `${line} L${x(vis.length - 1)},${height - pad.b} L${x(0)},${height - pad.b} Z`;
  const thr = vis.map((m, i) => `${i ? "L" : "M"}${x(Math.max(0, i - 0.5))},${y(m.threshold)} L${x(i + (i === vis.length - 1 ? 0 : 0.5))},${y(m.threshold)}`).join(" ");
  const ticks = 5;
  const gid = `eq-${color.slice(1)}`;

  const replay = () => {
    const t0 = performance.now();
    const dur = Math.min(4000, 400 + marks.length * 90);
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setProgress(p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const h = hover != null ? marks[hover] : null;
  return (
    <div ref={ref} className="relative select-none">
      <button
        onClick={replay}
        className="absolute right-2 top-0 z-10 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:text-zinc-50"
      >
        ▶ Replay
      </button>
      {width > 0 && (
        <svg width={w} height={height} className="overflow-visible" onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: ticks }, (_, i) => min + ((max - min) * i) / (ticks - 1)).map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.05)" />
              <text x={pad.l - 8} y={y(v) + 3} textAnchor="end" className="fill-zinc-600 font-mono text-[10px]">
                {usd(v)}
              </text>
            </g>
          ))}
          {/* Target and start */}
          <line x1={pad.l} x2={w - pad.r} y1={y(start + target)} y2={y(start + target)} stroke="rgb(var(--tp-green))" strokeOpacity="0.55" strokeDasharray="5 4" />
          <text x={w - pad.r} y={y(start + target) - 5} textAnchor="end" className="fill-tp-green font-mono text-[10px]">
            TARGET {usd(start + target)}
          </text>
          <line x1={pad.l} x2={w - pad.r} y1={y(start)} y2={y(start)} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 4" />
          {/* Whiskers */}
          {vis.map((m, i) => (
            <line key={m.date} x1={x(i)} x2={x(i)} y1={y(m.high)} y2={y(m.low)} stroke={color} strokeOpacity={hover === i ? 0.9 : 0.35} strokeWidth={Math.max(2, Math.min(6, (w - pad.l) / n / 3))} strokeLinecap="round" />
          ))}
          <path d={area} fill={`url(#${gid})`} />
          <path d={thr} fill="none" stroke="rgb(var(--tp-red))" strokeWidth="1.5" strokeDasharray="4 3" />
          {vis.length > 0 && (
            <text x={x(vis.length - 1)} y={y(vis[vis.length - 1].threshold) + 13} textAnchor="end" className="fill-tp-red font-mono text-[10px]">
              DRAWDOWN {usd(vis[vis.length - 1].threshold)}
            </text>
          )}
          <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
          {vis.map((m, i) => (
            <circle key={m.date} cx={x(i)} cy={y(m.balance)} r={hover === i ? 4.5 : m.partial ? 3.5 : 2.2} fill={m.partial ? "rgb(var(--tp-base))" : color} stroke={color} strokeWidth={m.partial ? 2 : 0} className={m.partial ? "tp-flow-pulse" : undefined} />
          ))}
          {progress === 1 && verdict !== "active" && verdict !== "pending" && marks.length > 0 && (
            <g transform={`translate(${x(marks.length - 1)},${y(marks[marks.length - 1].balance)})`}>
              <circle r="9" fill={verdict === "passed" ? "rgb(var(--tp-green))" : "rgb(var(--tp-red))"} fillOpacity="0.2" className="tp-flow-pulse" />
              <circle r="5" fill={verdict === "passed" ? "rgb(var(--tp-green))" : "rgb(var(--tp-red))"} />
            </g>
          )}
          {marks.length > 1 &&
            [0, Math.floor((marks.length - 1) / 2), marks.length - 1].map((i) => (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === marks.length - 1 ? "end" : "middle"} className="fill-zinc-600 font-mono text-[10px]">
                {shortDate(marks[i].date)}
              </text>
            ))}
          {/* Hover targets */}
          {marks.map((m, i) => (
            <rect key={m.date} x={x(i) - (w - pad.l) / n / 2} y={pad.t} width={(w - pad.l) / n} height={height - pad.t - pad.b} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
      )}
      {h && (
        <div
          className="pointer-events-none absolute top-6 z-20 rounded-lg border border-white/[0.1] bg-tp-raised/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur"
          style={{ left: Math.min(Math.max(x(hover!) - 80, 0), w - 180) }}
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{shortDate(h.date)}{h.partial ? " · live" : ""}</p>
          <p className="font-semibold tabular-nums text-zinc-100">{usd(h.balance)}</p>
          <p className={clsx("tabular-nums", h.pnl >= 0 ? "text-tp-green" : "text-tp-red")}>{h.pnl >= 0 ? "+" : ""}{usd(h.pnl)} day</p>
          <p className="tabular-nums text-zinc-500">Buffer {usd(h.balance - h.threshold)}</p>
        </div>
      )}
    </div>
  );
}

export function Sparkline({ marks, start, color, width = 220, height = 54 }: { marks: DayMark[]; start: number; color: string; width?: number; height?: number }) {
  const vals = [start, ...marks.map((m) => m.balance)];
  const thr = marks.map((m) => m.threshold);
  const all = [...vals, ...thr];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const y = (v: number) => height - 3 - ((v - lo) / (hi - lo || 1)) * (height - 6);
  const x = (i: number, n: number) => (i / Math.max(n - 1, 1)) * width;
  const p = vals.map((v, i) => `${i ? "L" : "M"}${x(i, vals.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const t = thr.map((v, i) => `${i ? "L" : "M"}${x(i + 1, vals.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const gid = `sp-${color.slice(1)}-${marks.length}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${p} L${width},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      {thr.length > 0 && <path d={t} fill="none" stroke="rgb(var(--tp-red))" strokeOpacity="0.6" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      <path d={p} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Every test's profit on one axis, by trading day, so strategies race side by side. */
export function CompareChart({ series, height = 220 }: { series: { id: string; name: string; color: string; target: number; points: number[] }[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const pad = { l: 56, r: 12, t: 12, b: 22 };
  const w = Math.max(width, 200);
  const n = Math.max(2, ...series.map((s) => s.points.length + 1));
  const all = series.flatMap((s) => [0, ...s.points, s.target]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (height - pad.t - pad.b);
  const x = (i: number) => pad.l + (i / (n - 1)) * (w - pad.l - pad.r);
  const targets = [...new Set(series.map((s) => s.target))];
  return (
    <div ref={ref}>
      {width > 0 && (
        <svg width={w} height={height}>
          {[lo, 0, hi].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)"} />
              <text x={pad.l - 8} y={y(v) + 3} textAnchor="end" className="fill-zinc-600 font-mono text-[10px]">{usd(v)}</text>
            </g>
          ))}
          {targets.map((t) => (
            <line key={t} x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--tp-green))" strokeOpacity="0.35" strokeDasharray="5 4" />
          ))}
          {series.map((s) => {
            const pts = [0, ...s.points];
            const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
                <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="3.5" fill={s.color} />
              </g>
            );
          })}
          <text x={pad.l} y={height - 6} className="fill-zinc-600 font-mono text-[10px]">Day 1</text>
          <text x={w - pad.r} y={height - 6} textAnchor="end" className="fill-zinc-600 font-mono text-[10px]">Day {n - 1}</text>
        </svg>
      )}
    </div>
  );
}

export const sessionBars = (bars: Bar[], date: string) =>
  bars.filter((b) => {
    const c = nyClock(b.t * 1000);
    return c.date === date && c.minute >= 570 && c.minute < 960;
  });
