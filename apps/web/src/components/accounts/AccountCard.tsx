'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ArrowRight, Check, CircleDot, History, MoreHorizontal, PlugZap, Trash2, Upload, Wallet } from 'lucide-react';
import type { Account, AccountStatus } from '@/store/accountStore';
import { BrokerBadge, STATUS_META, STATUS_ORDER, Sparkline, StatusBadge, accountStats, btn, providerLabel, shortDate, signedUsd, stageLabel } from './accountUi';

export type DrawerTab = 'details' | 'money' | 'imports';

interface AccountCardProps {
  account: Account;
  current: boolean;
  onMakeCurrent: () => void;
  onOpen: (tab: DrawerTab) => void;
  onImport: () => void;
  onStatus: (s: AccountStatus) => void;
  onDelete: () => void;
}

export function AccountCard({ account, current, onMakeCurrent, onOpen, onImport, onStatus, onDelete }: AccountCardProps) {
  const s = accountStats(account);
  const demo = account.type === 'demo';

  return (
    <article
      className={clsx(
        'group relative flex flex-col rounded-2xl border bg-tp-card p-5 transition-all duration-200',
        current
          ? 'border-tp-green/30 shadow-[0_0_0_1px_rgba(0,214,143,0.12),0_12px_40px_-20px_rgba(0,214,143,0.35)]'
          : 'border-white/[0.06] hover:border-white/[0.12] hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.8)]',
      )}
    >
      {/* Whole-card hit area opens the account; inner controls sit above it. */}
      <button type="button" onClick={() => onOpen('details')} className="absolute inset-0 rounded-2xl" aria-label={`Open ${account.name}`} />

      <header className="pointer-events-none relative flex items-start gap-3">
        <BrokerBadge broker={account.broker} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-zinc-50">{account.name}</h3>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {account.broker} · {demo ? 'Sample data' : stageLabel(account)}
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-1">
          <StatusBadge status={account.status || 'active'} />
          <CardMenu account={account} onOpen={onOpen} onImport={onImport} onStatus={onStatus} onDelete={onDelete} />
        </div>
      </header>

      <div className="pointer-events-none relative mt-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-500">Net P&amp;L</div>
          <div className={clsx('mt-0.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums', account.balance >= 0 ? 'text-zinc-50' : 'text-tp-red')}>
            {signedUsd(account.balance, true)}
          </div>
          {s.paidOut > 0 && <div className="mt-1.5 text-xs text-tp-yellow">{signedUsd(s.paidOut)} paid out</div>}
        </div>
        <Sparkline points={s.curve} className="h-11 w-28 shrink-0" />
      </div>

      <dl className="pointer-events-none relative mt-5 grid grid-cols-3 gap-2 rounded-xl bg-black/20 px-3 py-2.5 ring-1 ring-inset ring-white/[0.04]">
        {[
          ['Trades', s.trades.toLocaleString()],
          ['Win rate', s.winRate === null ? '—' : `${s.winRate.toFixed(0)}%`],
          ['Last trade', s.lastTrade ? shortDate(s.lastTrade).replace(/, \d{4}$/, '') : '—'],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] text-zinc-500">{k}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-zinc-200">{v}</dd>
          </div>
        ))}
      </dl>

      <footer className="pointer-events-none relative mt-4 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs text-zinc-500">
          {account.syncSource ? (
            <>
              <PlugZap className="h-3.5 w-3.5 shrink-0 text-tp-green" /> Linked · {providerLabel(account.syncSource.provider)}
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 shrink-0" /> {(account.importHistory ?? []).length ? `${account.importHistory.length} imports` : 'No imports yet'}
            </>
          )}
        </span>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1">
          {current ? (
            <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-tp-green">
              <Check className="h-3.5 w-3.5" /> Current
            </span>
          ) : (
            <button type="button" onClick={onMakeCurrent} className={clsx(btn.ghost, 'text-xs')} title="Make this the account shown across TradePilot">
              <CircleDot className="h-3.5 w-3.5" /> Use
            </button>
          )}
          <button type="button" onClick={onImport} className={clsx(btn.ghost, 'px-2 text-xs')} title="Import trades" aria-label={`Import trades into ${account.name}`}>
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onOpen('details')} className={clsx(btn.ghost, 'text-xs text-zinc-300')}>
            Manage <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </footer>
    </article>
  );
}

function CardMenu({
  account,
  onOpen,
  onImport,
  onStatus,
  onDelete,
}: Pick<AccountCardProps, 'account' | 'onOpen' | 'onImport' | 'onStatus' | 'onDelete'>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const menuH = 330;
      const top = r.bottom + 6 + menuH > window.innerHeight ? Math.max(8, r.top - menuH - 6) : r.bottom + 6;
      setPos({ top, left: Math.max(8, r.right - 224) });
    }
    setOpen((v) => !v);
  };

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50';
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${account.name}`}
        className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
            <div
              role="menu"
              className="fixed z-[81] w-56 rounded-xl border border-white/[0.08] bg-tp-raised p-1.5 shadow-2xl shadow-black/60"
              style={{ top: pos.top, left: pos.left }}
            >
              <button role="menuitem" className={item} onClick={run(onImport)}>
                <Upload className="h-4 w-4" /> Import trades
              </button>
              <button role="menuitem" className={item} onClick={run(() => onOpen('money'))}>
                <Wallet className="h-4 w-4" /> Record payout or deposit
              </button>
              <button role="menuitem" className={item} onClick={run(() => onOpen('imports'))}>
                <History className="h-4 w-4" /> Import history
              </button>
              <div className="my-1.5 border-t border-white/[0.06]" />
              <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</p>
              {STATUS_ORDER.map((st) => (
                <button key={st} role="menuitemradio" aria-checked={account.status === st} className={item} onClick={run(() => onStatus(st))}>
                  <span className={clsx('h-2 w-2 rounded-full', STATUS_META[st].dot)} />
                  <span className="flex-1">{STATUS_META[st].label}</span>
                  {account.status === st && <Check className="h-4 w-4 text-tp-green" />}
                </button>
              ))}
              {account.type !== 'demo' && (
                <>
                  <div className="my-1.5 border-t border-white/[0.06]" />
                  <button role="menuitem" className={clsx(item, 'text-tp-red hover:bg-tp-red/10 hover:text-tp-red')} onClick={run(onDelete)}>
                    <Trash2 className="h-4 w-4" /> Delete account
                  </button>
                </>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
