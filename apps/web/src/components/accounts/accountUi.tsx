'use client';

import React, { useEffect, useId } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import type { Account, AccountStatus } from '@/store/accountStore';

// ─── Brokers / prop firms ────────────────────────────────────────────────────

export type BrokerOption = {
  label: string;
  abbr: string;
  logoClass?: string;
  logoSrc?: string;
  aliases?: string[];
};

export const BROKER_OPTIONS: BrokerOption[] = [
  { label: 'TopOne Futures', abbr: 'TO', logoSrc: '/logos/topone-futures.png', aliases: ['Topone Futures', 'Top One Futures'] },
  { label: 'Lucid Trading', abbr: 'LT', logoClass: 'bg-gradient-to-br from-[#60A5FA] to-[#3B82F6]', aliases: ['Trading Lucid', 'Lucid'] },
  { label: 'Topstep', abbr: 'TS', logoClass: 'bg-gradient-to-br from-[#F59E0B] to-[#F97316]' },
  { label: 'Apex Trader Funding', abbr: 'AP', logoClass: 'bg-gradient-to-br from-[#F97316] to-[#EA580C]' },
  { label: 'My Funded Futures', abbr: 'MF', logoClass: 'bg-gradient-to-br from-[#00D68F] to-[#059669]' },
  { label: 'ProjectX', abbr: 'PX', logoClass: 'bg-[#26344F]' },
  { label: 'Tradovate', abbr: 'TV', logoClass: 'bg-gradient-to-br from-[#38BDF8] to-[#2563EB]' },
  { label: 'The Trading Pit', abbr: 'TP', logoClass: 'bg-gradient-to-br from-[#34D399] to-[#00D68F]' },
  { label: 'FTMO', abbr: 'FT', logoClass: 'bg-gradient-to-br from-[#0EA5E9] to-[#0284C7]' },
  { label: 'Funded Next', abbr: 'FN', logoClass: 'bg-gradient-to-br from-[#6366F1] to-[#4F46E5]' },
  { label: 'True Forex Funds', abbr: 'TF', logoClass: 'bg-gradient-to-br from-[#14B8A6] to-[#0D9488]' },
  { label: 'E8 Funding', abbr: 'E8', logoClass: 'bg-gradient-to-br from-[#EC4899] to-[#DB2777]' },
  { label: 'The5ers', abbr: '5R', logoClass: 'bg-gradient-to-br from-[#FF4868] to-[#E11D48]' },
  { label: 'Generic Template', abbr: 'GT', logoClass: 'bg-[#334155]' },
  { label: 'Other', abbr: 'OT', logoClass: 'bg-[#475569]' },
];

const norm = (v: string) => v.trim().toLowerCase();

export const getBrokerOption = (broker: string) =>
  BROKER_OPTIONS.find((o) => norm(o.label) === norm(broker) || (o.aliases ?? []).some((a) => norm(a) === norm(broker)));

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export function BrokerBadge({ broker, size = 'md' }: { broker: string; size?: 'sm' | 'md' | 'lg' }) {
  const option = getBrokerOption(broker);
  const box = { sm: 'h-7 w-7 rounded-lg text-[10px]', md: 'h-10 w-10 rounded-xl text-xs', lg: 'h-12 w-12 rounded-2xl text-sm' }[size];
  const img = { sm: 20, md: 28, lg: 34 }[size];
  if (option?.logoSrc) {
    return (
      <div className={clsx('grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-inset ring-white/10', box)}>
        <Image src={option.logoSrc} alt={`${option.label} logo`} width={img} height={img} className="object-contain" />
      </div>
    );
  }
  return (
    <div
      className={clsx(
        'grid shrink-0 place-items-center font-bold text-white ring-1 ring-inset ring-white/10',
        box,
        option?.logoClass ?? 'bg-[#334155]',
      )}
    >
      {option?.abbr ?? initials(broker)}
    </div>
  );
}

// ─── Status ──────────────────────────────────────────────────────────────────

export const STATUS_META: Record<AccountStatus, { label: string; hint: string; dot: string; pill: string }> = {
  active: { label: 'Active', hint: 'Trading it now', dot: 'bg-tp-green', pill: 'bg-tp-green/10 text-tp-green ring-tp-green/20' },
  passed_eval: { label: 'Passed eval', hint: 'Waiting on the funded account', dot: 'bg-tp-blue', pill: 'bg-tp-blue/10 text-tp-blue ring-tp-blue/20' },
  inactive: { label: 'Paid out', hint: 'Finished — money taken home', dot: 'bg-tp-yellow', pill: 'bg-tp-yellow/10 text-tp-yellow ring-tp-yellow/20' },
  blown: { label: 'Blown', hint: 'Hit a rule — kept for the record', dot: 'bg-tp-red', pill: 'bg-tp-red/10 text-tp-red ring-tp-red/20' },
};

export const STATUS_ORDER: AccountStatus[] = ['active', 'passed_eval', 'inactive', 'blown'];

export function StatusBadge({ status }: { status: AccountStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.active;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', m.pill)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

export const stageLabel = (a: Account) => (a.isFunded === undefined ? 'Stage not set' : a.isFunded ? 'Funded' : 'Evaluation');

export const providerLabel = (p: NonNullable<Account['syncSource']>['provider']) =>
  p === 'projectx' ? 'TopstepX' : p === 'tradovate-live' ? 'Tradovate live' : 'Tradovate sim';

// ─── Numbers ─────────────────────────────────────────────────────────────────

export const signedUsd = (n: number, cents = false) => {
  const abs = Math.abs(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  return n < 0 ? `-${abs}` : abs;
};

export const shortDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const timeAgo = (ms: number, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};

export function accountStats(a: Account) {
  const trades = [...a.trades].sort((x, y) => `${x.date} ${x.time ?? ''}`.localeCompare(`${y.date} ${y.time ?? ''}`));
  const wins = trades.filter((t) => t.netPL > 0).length;
  const adjustments = a.balanceAdjustments ?? [];
  const paidOut = adjustments.filter((v) => v.type === 'payout').reduce((n, v) => n + Math.abs(v.amount), 0);
  let run = 0;
  const curve = trades.map((t) => (run += t.netPL));
  return {
    trades: trades.length,
    winRate: trades.length ? (wins / trades.length) * 100 : null,
    tradePnL: run,
    paidOut,
    lastTrade: trades.at(-1)?.date ?? null,
    curve: curve.length > 80 ? curve.filter((_, i) => i % Math.ceil(curve.length / 80) === 0 || i === curve.length - 1) : curve,
  };
}

// ─── Visual bits ─────────────────────────────────────────────────────────────

export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const id = useId().replace(/:/g, '');
  if (points.length < 2) {
    return (
      <div className={clsx('flex items-center', className)}>
        <div className="h-px w-full border-t border-dashed border-white/10" />
      </div>
    );
  }
  const series = [0, ...points];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const w = 120;
  const h = 40;
  const xy = series.map((v, i) => [(i / (series.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const up = series.at(-1)! >= 0;
  const color = up ? '#00D68F' : '#FF4868';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-tp-green' : 'bg-white/[0.12]',
      )}
    >
      <span className={clsx('h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

// ─── Form + buttons ──────────────────────────────────────────────────────────

export const inputCls =
  'w-full rounded-xl bg-black/25 px-3.5 py-2.5 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.09] placeholder:text-zinc-600 focus:outline-none focus:ring-tp-green/50 [color-scheme:dark]';

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-40',
  ghost:
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-tp-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e63d5b] disabled:cursor-not-allowed disabled:bg-tp-red/25 disabled:text-white/40',
  dangerOutline:
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-tp-red ring-1 ring-inset ring-tp-red/30 transition-colors hover:bg-tp-red/10',
};

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500">{hint}</span>}
    </label>
  );
}

// ─── Overlays ────────────────────────────────────────────────────────────────

// Overlays can stack (a confirm opened from the drawer); Escape closes only the top one.
const overlayStack: symbol[] = [];

function useEscape(onClose: () => void) {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const me = Symbol('overlay');
    overlayStack.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayStack.at(-1) === me) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      overlayStack.splice(overlayStack.indexOf(me), 1);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);
}

const OVERLAY_KEYFRAMES =
  '@keyframes tpFadeIn{from{opacity:0}to{opacity:1}}@keyframes tpPopIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}@keyframes tpSlideIn{from{opacity:0;transform:translateX(32px)}to{opacity:1;transform:none}}';

export function Modal({
  title,
  subtitle,
  icon: Icon,
  tone = 'neutral',
  onClose,
  children,
  width = 'max-w-md',
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ElementType;
  tone?: 'neutral' | 'danger';
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEscape(onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <style>{OVERLAY_KEYFRAMES}</style>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm [animation:tpFadeIn_.15s_ease-out]" onClick={onClose} />
      <div
        className={clsx(
          'relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border bg-tp-raised shadow-2xl shadow-black/50 [animation:tpPopIn_.18s_ease-out]',
          tone === 'danger' ? 'border-tp-red/25' : 'border-white/[0.08]',
          width,
        )}
      >
        <div className="flex items-start gap-3 p-5 pb-0">
          {Icon && (
            <div
              className={clsx(
                'grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset',
                tone === 'danger' ? 'bg-tp-red/10 text-tp-red ring-tp-red/20' : 'bg-white/[0.06] text-zinc-200 ring-white/10',
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 -mt-1 rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ onClose, label, children }: { onClose: () => void; label: string; children: React.ReactNode }) {
  useEscape(onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={label}>
      <style>{OVERLAY_KEYFRAMES}</style>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] [animation:tpFadeIn_.15s_ease-out]" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-white/[0.08] bg-tp-panel shadow-2xl shadow-black/60 [animation:tpSlideIn_.22s_cubic-bezier(.2,.8,.2,1)]">
        {children}
      </aside>
    </div>,
    document.body,
  );
}
