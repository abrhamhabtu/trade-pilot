'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, Check, ChevronDown, FlaskConical, Layers, Plus } from 'lucide-react';
import { accountsInScope, useAccountStore, type Account } from '../../store/accountStore';
import { BrokerBadge, STATUS_META, STATUS_ORDER, signedUsd } from './accountUi';

const byStatus = (a: Account, b: Account) => STATUS_ORDER.indexOf(a.status || 'active') - STATUS_ORDER.indexOf(b.status || 'active');

export const AccountSelector: React.FC = () => {
  const { accounts, selectedAccountId, selectAccount, showAllAccounts, setShowAllAccounts } = useAccountStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find((a) => a.id === selectedAccountId);
  const mine = accounts.filter((a) => a.type !== 'demo').sort(byStatus);
  const samples = accounts.filter((a) => a.type === 'demo').sort(byStatus);
  const scope = accountsInScope(accounts);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (id: string) => {
    selectAccount(id);
    setShowAllAccounts(false);
    setOpen(false);
  };

  const row = (a: Account) => {
    const on = !showAllAccounts && selectedAccountId === a.id;
    const status = STATUS_META[a.status || 'active'];
    const retired = a.status === 'inactive' || a.status === 'blown';
    return (
      <button
        key={a.id}
        role="option"
        aria-selected={on}
        onClick={() => choose(a.id)}
        className={clsx('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors', on ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
      >
        <span className={clsx(retired && 'opacity-60 grayscale-[40%]')}>
          <BrokerBadge broker={a.broker} size="sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx('block truncate text-sm font-medium', retired ? 'text-zinc-300' : 'text-zinc-100')}>{a.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className={clsx('h-1.5 w-1.5 rounded-full', status.dot)} />
            {status.label}
            {a.isFunded !== undefined && <> · {a.isFunded ? 'Funded' : 'Evaluation'}</>}
          </span>
        </span>
        <span className={clsx('shrink-0 text-xs font-semibold tabular-nums', a.balance < 0 ? 'text-tp-red' : retired ? 'text-zinc-400' : 'text-zinc-200')}>{signedUsd(a.balance)}</span>
        <Check className={clsx('h-4 w-4 shrink-0 text-tp-green', !on && 'invisible')} />
      </button>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          'flex items-center gap-2.5 rounded-xl border bg-tp-card/80 py-1.5 pl-1.5 pr-3 backdrop-blur-md transition-colors',
          open ? 'border-white/20' : 'border-white/[0.07] hover:border-white/[0.14]',
        )}
      >
        {showAllAccounts ? (
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-tp-green/10 text-tp-green">
            <Layers className="h-4 w-4" />
          </span>
        ) : selected ? (
          <BrokerBadge broker={selected.broker} size="sm" />
        ) : null}
        <span className="max-w-[180px] truncate text-sm font-medium text-zinc-100">
          {showAllAccounts ? (mine.length ? 'All your accounts' : 'All sample accounts') : selected?.name ?? 'Select account'}
        </span>
        {!showAllAccounts && selected?.type === 'demo' && <span className="rounded-md bg-tp-blue/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-tp-blue">Demo</span>}
        <ChevronDown className={clsx('h-4 w-4 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="listbox" aria-label="Accounts" className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-white/[0.08] bg-tp-raised/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {scope.length > 1 && (
            <button
              onClick={() => {
                setShowAllAccounts(true);
                setOpen(false);
              }}
              className={clsx('mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors', showAllAccounts ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-tp-green/10 text-tp-green">
                <Layers className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-100">{mine.length ? 'All your accounts' : 'All sample accounts'}</span>
                <span className="text-[11px] text-zinc-500">{scope.length} accounts combined{mine.length ? ' · samples excluded' : ''}</span>
              </span>
              <Check className={clsx('h-4 w-4 shrink-0 text-tp-green', !showAllAccounts && 'invisible')} />
            </button>
          )}

          {/* The trader's own accounts */}
          <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Your accounts</div>
          {mine.length ? (
            mine.map(row)
          ) : (
            <Link
              href="/app/accounts"
              onClick={() => setOpen(false)}
              className="group flex items-center gap-3 rounded-xl border border-dashed border-white/[0.1] px-2.5 py-2.5 transition-colors hover:border-tp-green/40 hover:bg-tp-green/[0.04]"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.05] text-zinc-400 group-hover:text-tp-green">
                <Plus className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-200">Add your first account</span>
                <span className="text-[11px] text-zinc-500">Import a CSV or connect a platform</span>
              </span>
              <ArrowRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          {/* Sample accounts, kept in their own section */}
          {samples.length > 0 && (
            <div className="mt-2 rounded-xl bg-black/20 p-1 ring-1 ring-inset ring-white/[0.04]">
              <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-tp-blue">
                  <FlaskConical className="h-3.5 w-3.5" /> Sample accounts
                </span>
                <span className="text-[10px] text-zinc-600">Demo data · not in your totals</span>
              </div>
              {samples.map(row)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
