"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500", className)}>
      {children}
    </p>
  );
}

export function Card({
  children,
  className,
  title,
  action,
  glow,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  glow?: boolean;
}) {
  return (
    <section
      className={clsx(
        "relative rounded-2xl border bg-tp-card/90 p-5",
        glow ? "tp-flow-glow border-transparent" : "border-white/[0.06]",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {typeof title === "string" ? <Eyebrow>{title}</Eyebrow> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "green" | "red" | "yellow" | "blue";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
        tone === "green" && "bg-tp-green/10 text-tp-green ring-1 ring-inset ring-tp-green/25",
        tone === "red" && "bg-tp-red/10 text-tp-red ring-1 ring-inset ring-tp-red/25",
        tone === "yellow" && "bg-tp-yellow/10 text-tp-yellow ring-1 ring-inset ring-tp-yellow/25",
        tone === "blue" && "bg-tp-blue/10 text-tp-blue ring-1 ring-inset ring-tp-blue/25",
        tone === "muted" && "bg-white/[0.05] text-zinc-400 ring-1 ring-inset ring-white/[0.06]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Evidence({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((e) => (
        <span key={e} className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400 ring-1 ring-inset ring-white/[0.05]">
          {e}
        </span>
      ))}
    </div>
  );
}

/**
 * The "screenshot" Pilot captures with every signal: the closes and VWAP the
 * indicator sent, drawn at the moment it fired.
 */
export function Snapshot({
  closes,
  vwaps,
  level,
  side,
  width = 240,
  height = 72,
  className,
}: {
  closes: number[];
  vwaps?: number[];
  level?: number | null;
  side?: "long" | "short" | null;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (closes.length < 2)
    return (
      <div
        className={clsx("grid place-items-center rounded-lg bg-white/[0.03] text-[10px] text-zinc-600 ring-1 ring-inset ring-white/[0.05]", className)}
        style={{ width, height }}
      >
        No bars sent
      </div>
    );
  const vw = (vwaps || []).slice(-closes.length);
  const all = [...closes, ...vw, ...(level != null ? [level] : [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.12 || 1;
  const y = (v: number) => height - 4 - ((v - (min - pad)) / (max - min + pad * 2)) * (height - 8);
  const x = (i: number, n: number) => 4 + (i / Math.max(n - 1, 1)) * (width - 8);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i, vals.length).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = closes[closes.length - 1];
  const color = side === "short" ? "#FF4868" : "#00D68F";
  const id = `snap-${closes.length}-${Math.round(last * 100)}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={clsx("rounded-lg bg-[#0f182b] ring-1 ring-inset ring-white/[0.06]", className)}
      role="img"
      aria-label="Price and VWAP when the signal fired"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {level != null && (
        <line x1="0" x2={width} y1={y(level)} y2={y(level)} stroke="#FFB800" strokeOpacity="0.7" strokeDasharray="3 3" strokeWidth="1" />
      )}
      <path d={`${path(closes)} L${x(closes.length - 1, closes.length)},${height} L${x(0, closes.length)},${height} Z`} fill={`url(#${id})`} />
      {vw.length > 1 && <path d={path(vw)} fill="none" stroke="#4F9CF9" strokeWidth="1.4" strokeOpacity="0.9" />}
      <path d={path(closes)} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={x(closes.length - 1, closes.length)} cy={y(last)} r="3.2" fill={color} />
      <circle cx={x(closes.length - 1, closes.length)} cy={y(last)} r="6" fill={color} fillOpacity="0.2" className="tp-flow-pulse" />
    </svg>
  );
}

export function ScoreRing({ value, size = 64 }: { value: number | null; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  const color = value == null ? "#52525b" : v >= 80 ? "#00D68F" : v >= 50 ? "#FFB800" : "#FF4868";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`}
        className="transition-[stroke-dasharray] duration-700"
      />
    </svg>
  );
}
