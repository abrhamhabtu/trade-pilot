'use client';

import React from 'react';
import clsx from 'clsx';
import { AlertTriangle, CircleDashed, OctagonAlert, ShieldCheck } from 'lucide-react';
import type { PulseTone } from '@/lib/accountPulse';

export type MeterTone = PulseTone | 'info';

// Status is never colour alone: every tone ships with its own glyph and words.
export const TONE: Record<MeterTone, { rgb: string; text: string; icon: React.ElementType; label: string }> = {
  good: { rgb: 'var(--tp-green)', text: 'text-tp-green', icon: ShieldCheck, label: 'On track' },
  warn: { rgb: 'var(--tp-yellow)', text: 'text-tp-yellow', icon: AlertTriangle, label: 'Watch' },
  bad: { rgb: 'var(--tp-red)', text: 'text-tp-red', icon: OctagonAlert, label: 'Stop' },
  info: { rgb: 'var(--tp-blue)', text: 'text-tp-blue', icon: ShieldCheck, label: 'In progress' },
  idle: { rgb: '148 156 176', text: 'text-zinc-500', icon: CircleDashed, label: 'Not tracked' },
};

export const usd = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
export const signedUsd = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;

/**
 * A fuel gauge in ticks. `ratio` fills from the left; `marker` plants a line at
 * a limit (0–1 along the track) so "how close to the cap" reads without a legend.
 */
export function TickMeter({
  ratio,
  tone,
  marker,
  ticks = 28,
  label,
  className,
}: {
  ratio: number;
  tone: MeterTone;
  marker?: number;
  ticks?: number;
  /** Read out to screen readers in place of the ticks. */
  label: string;
  className?: string;
}) {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  // A sliver of room still shows one tick; an empty tank shows none.
  const lit = r > 0 ? Math.max(1, Math.round(r * ticks)) : 0;
  const { rgb } = TONE[tone];
  return (
    <div role="img" aria-label={label} className={clsx('relative flex h-3 items-stretch gap-[2px]', className)}>
      {Array.from({ length: ticks }, (_, i) => (
        <span
          key={i}
          className={clsx('min-w-0 flex-1 rounded-[2px]', i < lit && 'tp-tick')}
          style={
            i < lit
              ? { background: `rgb(${rgb} / ${0.55 + 0.45 * ((i + 1) / lit)})`, animationDelay: `${i * 14}ms` }
              : { background: 'rgba(255,255,255,0.07)' }
          }
        />
      ))}
      {marker !== undefined && (
        <span
          aria-hidden
          className="absolute -bottom-1 -top-1 w-[2px] rounded-full bg-white shadow-[0_0_0_2px_rgb(var(--tp-card))]"
          style={{ left: `calc(${Math.max(0, Math.min(1, marker)) * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}

/** Icon + words for a verdict. */
export function ToneBadge({ tone, children, className }: { tone: MeterTone; children?: React.ReactNode; className?: string }) {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold', t.text, className)}
      style={{ background: `rgb(${t.rgb} / 0.12)` }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
      {children ?? t.label}
    </span>
  );
}
