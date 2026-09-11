'use client';

import React from 'react';
import clsx from 'clsx';

export const usd = (n: number, cents = false) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

export function Card({ className, children, id }: { className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={clsx('rounded-2xl border border-white/[0.06] bg-tp-card p-5 sm:p-6', className)}>
      {children}
    </section>
  );
}

export function CardTitle({
  icon: Icon,
  title,
  subtitle,
  action,
  tone = 'green',
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'green' | 'yellow' | 'blue' | 'red';
}) {
  const tones = {
    green: 'bg-tp-green/10 text-tp-green ring-tp-green/20',
    yellow: 'bg-tp-yellow/10 text-tp-yellow ring-tp-yellow/20',
    blue: 'bg-tp-blue/10 text-tp-blue ring-tp-blue/20',
    red: 'bg-tp-red/10 text-tp-red ring-tp-red/20',
  };
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset', tones[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-black/25 p-1 ring-1 ring-inset ring-white/[0.07]">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-white/[0.1] text-zinc-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Bar({ value, tone = 'green', className }: { value: number; tone?: 'green' | 'yellow' | 'red' | 'blue' | 'white'; className?: string }) {
  const tones = { green: 'bg-tp-green', yellow: 'bg-tp-yellow', red: 'bg-tp-red', blue: 'bg-tp-blue', white: 'bg-zinc-200' };
  return (
    <div className={clsx('h-2 overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <div className={clsx('h-full rounded-full transition-all duration-700', tones[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function StatusPill({ ok, okLabel, noLabel }: { ok: boolean; okLabel: string; noLabel: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        ok ? 'bg-tp-green/15 text-tp-green' : 'bg-tp-yellow/15 text-tp-yellow',
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', ok ? 'bg-tp-green' : 'bg-tp-yellow')} />
      {ok ? okLabel : noLabel}
    </span>
  );
}

export function MoneyInput({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <div className={clsx('flex items-center rounded-xl bg-black/25 px-3 ring-1 ring-inset ring-white/[0.09] focus-within:ring-tp-green/40', className)}>
      <span className="text-zinc-500">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value ? value.toLocaleString('en-US') : ''}
        placeholder="0"
        onChange={(e) => onChange(parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
        className="w-full min-w-0 bg-transparent py-2 pl-1 text-base font-semibold tabular-nums text-zinc-50 focus:outline-none"
      />
    </div>
  );
}
