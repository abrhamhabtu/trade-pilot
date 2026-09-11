'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, Check, CircleDot, FileText, Scale, SlidersHorizontal, Trash2, Upload, Wallet, X, History } from 'lucide-react';
import { useAccountStore, type Account, type AccountStatus, type BalanceAdjustment } from '@/store/accountStore';
import { toast } from '@/store/toastStore';
import { Segmented } from '@/components/routine/journeyUi';
import { BrokerPicker } from './AccountModals';
import { BrokerBadge, Drawer, Field, STATUS_META, STATUS_ORDER, StatusBadge, accountStats, btn, inputCls, shortDate, signedUsd, stageLabel } from './accountUi';
import type { DrawerTab } from './AccountCard';

interface AccountDrawerProps {
  account: Account;
  tab: DrawerTab;
  setTab: (t: DrawerTab) => void;
  current: boolean;
  onMakeCurrent: () => void;
  onClose: () => void;
  onImport: () => void;
  onDelete: () => void;
}

export function AccountDrawer({ account, tab, setTab, current, onMakeCurrent, onClose, onImport, onDelete }: AccountDrawerProps) {
  const s = accountStats(account);
  const adjustments = account.balanceAdjustments ?? [];
  const imports = account.importHistory ?? [];

  return (
    <Drawer onClose={onClose} label={`${account.name} details`}>
      {/* Header */}
      <div className="border-b border-white/[0.06] px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-start gap-3">
          <BrokerBadge broker={account.broker} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-50">{account.name}</h2>
              <StatusBadge status={account.status || 'active'} />
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {account.broker} · {account.type === 'demo' ? 'Sample data' : stageLabel(account)}
            </p>
          </div>
          <button onClick={onClose} className="-mr-1.5 rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl bg-black/20 py-3 ring-1 ring-inset ring-white/[0.04]">
          {[
            ['Net P&L', signedUsd(account.balance, true), account.balance < 0 ? 'text-tp-red' : 'text-zinc-50'],
            ['Trades', s.trades.toLocaleString(), 'text-zinc-50'],
            ['Paid out', signedUsd(s.paidOut), s.paidOut ? 'text-tp-yellow' : 'text-zinc-50'],
          ].map(([k, v, c]) => (
            <div key={k} className="px-4">
              <div className="text-[11px] text-zinc-500">{k}</div>
              <div className={clsx('mt-0.5 font-semibold tabular-nums', c)}>{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'details', label: <><SlidersHorizontal className="h-3.5 w-3.5" /> Details</> },
              { value: 'money', label: <><Wallet className="h-3.5 w-3.5" /> Payouts{adjustments.length ? ` · ${adjustments.length}` : ''}</> },
              { value: 'imports', label: <><History className="h-3.5 w-3.5" /> Imports{imports.length ? ` · ${imports.length}` : ''}</> },
            ]}
          />
          {current ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-tp-green">
              <Check className="h-3.5 w-3.5" /> Current account
            </span>
          ) : (
            <button onClick={onMakeCurrent} className={clsx(btn.ghost, 'text-xs')}>
              <CircleDot className="h-3.5 w-3.5" /> Make current
            </button>
          )}
        </div>
      </div>

      {tab === 'details' && <DetailsTab key={account.id} account={account} onDelete={onDelete} />}
      {tab === 'money' && (
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <MoneyTab account={account} />
        </div>
      )}
      {tab === 'imports' && (
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <ImportsTab account={account} onImport={onImport} />
        </div>
      )}
    </Drawer>
  );
}

// ─── Details ─────────────────────────────────────────────────────────────────

type Stage = 'evaluation' | 'funded' | 'unset';
const toStage = (a: Account): Stage => (a.isFunded === undefined ? 'unset' : a.isFunded ? 'funded' : 'evaluation');

function DetailsTab({ account, onDelete }: { account: Account; onDelete: () => void }) {
  const { updateAccount, clearAccountTrades } = useAccountStore();
  const [name, setName] = useState(account.name);
  const [broker, setBroker] = useState(account.broker);
  const [status, setStatus] = useState<AccountStatus>(account.status || 'active');
  const [stage, setStage] = useState<Stage>(toStage(account));
  const [confirmClear, setConfirmClear] = useState(false);

  const dirty = name.trim() !== account.name || broker.trim() !== account.broker || status !== (account.status || 'active') || stage !== toStage(account);
  const valid = name.trim() && broker.trim();

  const save = () => {
    if (!valid) return;
    updateAccount(account.id, { name: name.trim(), broker: broker.trim(), status, isFunded: stage === 'unset' ? undefined : stage === 'funded' });
    toast.success('Account updated');
  };

  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
        <Field label="Account name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>

        <Field label="Firm or broker">
          <BrokerPicker collapsed value={broker} onChange={setBroker} />
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">Where is this account at?</span>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_ORDER.map((st) => {
              const m = STATUS_META[st];
              const on = status === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  aria-pressed={on}
                  className={clsx(
                    'rounded-xl p-3 text-left transition-colors ring-1 ring-inset',
                    on ? 'bg-white/[0.06] ring-white/20' : 'ring-white/[0.06] hover:bg-white/[0.03]',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                    <span className={clsx('h-2 w-2 rounded-full', m.dot)} />
                    {m.label}
                    {on && <Check className="ml-auto h-4 w-4 text-zinc-300" />}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">{m.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Stage" hint="Journey and payout tools use this to pick the right rules.">
          <Segmented
            value={stage}
            onChange={setStage}
            options={[
              { value: 'evaluation', label: 'Evaluation' },
              { value: 'funded', label: 'Funded' },
              { value: 'unset', label: 'Not set' },
            ]}
          />
        </Field>

        {/* Danger zone */}
        <section className="rounded-2xl p-4 ring-1 ring-inset ring-tp-red/15">
          <h3 className="text-sm font-semibold text-zinc-100">Danger zone</h3>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
            <div className="min-w-0">
              <p className="text-sm text-zinc-200">Clear all trades</p>
              <p className="text-xs text-zinc-500">Keeps the account and its payouts. Removes {account.trades.length} trades and import records.</p>
            </div>
            {confirmClear ? (
              <div className="flex gap-1.5">
                <button onClick={() => setConfirmClear(false)} className={btn.ghost}>
                  Keep
                </button>
                <button
                  onClick={() => {
                    clearAccountTrades(account.id);
                    setConfirmClear(false);
                    toast.success(`Cleared trades from ${account.name}`);
                  }}
                  className={clsx(btn.danger, 'py-1.5')}
                >
                  Yes, clear {account.trades.length}
                </button>
              </div>
            ) : (
              <button disabled={!account.trades.length} onClick={() => setConfirmClear(true)} className={clsx(btn.dangerOutline, 'py-1.5 disabled:opacity-30')}>
                Clear trades
              </button>
            )}
          </div>
          {account.type !== 'demo' && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">Delete account</p>
                <p className="text-xs text-zinc-500">Permanently removes the account and everything in it.</p>
              </div>
              <button onClick={onDelete} className={clsx(btn.dangerOutline, 'py-1.5')}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] bg-tp-panel px-5 py-3.5 sm:px-6">
        <span className="text-xs text-zinc-500">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <div className="flex gap-2">
          {dirty && (
            <button
              onClick={() => {
                setName(account.name);
                setBroker(account.broker);
                setStatus(account.status || 'active');
                setStage(toStage(account));
              }}
              className={btn.ghost}
            >
              Discard
            </button>
          )}
          <button onClick={save} disabled={!dirty || !valid} className={btn.primary}>
            Save changes
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Money ───────────────────────────────────────────────────────────────────

type AdjType = BalanceAdjustment['type'];
const ADJ_META: Record<AdjType, { label: string; icon: React.ElementType; tone: string; verb: string; help: string }> = {
  payout: { label: 'Payout', icon: ArrowUpRight, tone: 'text-tp-yellow bg-tp-yellow/10', verb: 'Record payout', help: 'Money you withdrew. Lowers the balance.' },
  deposit: { label: 'Deposit', icon: ArrowDownLeft, tone: 'text-tp-green bg-tp-green/10', verb: 'Record deposit', help: 'Money you added. Raises the balance.' },
  adjustment: { label: 'Correction', icon: Scale, tone: 'text-tp-blue bg-tp-blue/10', verb: 'Save correction', help: 'Fix the balance to match your platform (fees, resets).' },
};

function MoneyTab({ account }: { account: Account }) {
  const { addBalanceAdjustment, deleteBalanceAdjustment } = useAccountStore();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [type, setType] = useState<AdjType>('payout');
  const [amount, setAmount] = useState('');
  const [negative, setNegative] = useState(false);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => setNegative(false), [type]);

  const list = [...(account.balanceAdjustments ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const paid = list.filter((v) => v.type === 'payout').reduce((n, v) => n + Math.abs(v.amount), 0);
  const deposited = list.filter((v) => v.type === 'deposit').reduce((n, v) => n + v.amount, 0);
  const net = list.reduce((n, v) => n + v.amount, 0);

  const value = parseFloat(amount);
  const signed = !value || value <= 0 ? 0 : type === 'payout' ? -value : type === 'deposit' ? value : negative ? -value : value;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signed) return toast.error('Enter an amount above zero');
    addBalanceAdjustment(account.id, { date, amount: signed, type, description: note.trim() || undefined });
    toast.success(`${ADJ_META[type].label} recorded`);
    setAmount('');
    setNote('');
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Paid out', signedUsd(paid), 'text-tp-yellow'],
          ['Deposited', signedUsd(deposited), 'text-zinc-100'],
          ['Balance effect', `${net > 0 ? '+' : ''}${signedUsd(net)}`, net < 0 ? 'text-tp-red' : 'text-tp-green'],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-xl bg-black/20 p-3 ring-1 ring-inset ring-white/[0.04]">
            <div className="text-[11px] text-zinc-500">{k}</div>
            <div className={clsx('mt-0.5 font-semibold tabular-nums', c)}>{v}</div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="rounded-2xl bg-tp-card p-4 ring-1 ring-inset ring-white/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">Record money in or out</h3>
          <Segmented
            size="sm"
            value={type}
            onChange={setType}
            options={(Object.keys(ADJ_META) as AdjType[]).map((t) => ({ value: t, label: ADJ_META[t].label }))}
          />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">{ADJ_META[type].help}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Amount">
            <div className="flex items-center rounded-xl bg-black/25 ring-1 ring-inset ring-white/[0.09] focus-within:ring-tp-green/50">
              {type === 'adjustment' ? (
                <button
                  type="button"
                  onClick={() => setNegative((v) => !v)}
                  className="ml-1.5 rounded-lg bg-white/[0.06] px-2 py-1 text-xs font-semibold text-zinc-200"
                  title="Switch between adding and subtracting"
                >
                  {negative ? '−' : '+'}
                </button>
              ) : (
                <span className={clsx('pl-3.5 text-sm font-semibold', type === 'payout' ? 'text-tp-yellow' : 'text-tp-green')}>{type === 'payout' ? '−' : '+'}</span>
              )}
              <span className="pl-1.5 text-sm text-zinc-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-w-0 bg-transparent py-2.5 pl-1 pr-3 text-sm font-semibold tabular-nums text-zinc-50 focus:outline-none"
                aria-label="Amount"
              />
            </div>
          </Field>
          <Field label="Date">
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Note (optional)" className="sm:col-span-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. First payout — 80% split" className={inputCls} maxLength={120} />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">
            Balance {signed < 0 || (!signed && (type === 'payout' || negative)) ? 'drops' : 'rises'} by{' '}
            <strong className={clsx('tabular-nums', signed < 0 ? 'text-tp-red' : signed > 0 ? 'text-tp-green' : 'text-zinc-400')}>{signedUsd(Math.abs(signed), true)}</strong>
          </span>
          <button type="submit" disabled={!signed} className={btn.primary}>
            {ADJ_META[type].verb}
          </button>
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">History</h3>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.08] p-6 text-center text-sm text-zinc-500">
            Nothing recorded yet. Log your first payout above — it counts toward “money taken home”.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05] rounded-xl ring-1 ring-inset ring-white/[0.06]">
            {list.map((a) => {
              const m = ADJ_META[a.type];
              return (
                <li key={a.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', m.tone)}>
                    <m.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200">
                      {m.label}
                      {a.description && <span className="text-zinc-500"> · {a.description}</span>}
                    </p>
                    <p className="text-xs text-zinc-500">{shortDate(a.date)}</p>
                  </div>
                  <span className={clsx('text-sm font-semibold tabular-nums', a.amount < 0 ? 'text-zinc-300' : 'text-tp-green')}>
                    {a.amount > 0 ? '+' : ''}
                    {signedUsd(a.amount, true)}
                  </span>
                  {confirmId === a.id ? (
                    <span className="flex gap-1">
                      <button onClick={() => setConfirmId(null)} className={clsx(btn.ghost, 'px-2 py-1 text-xs')}>
                        Keep
                      </button>
                      <button
                        onClick={() => {
                          deleteBalanceAdjustment(account.id, a.id);
                          setConfirmId(null);
                          toast.success('Entry removed');
                        }}
                        className="rounded-lg bg-tp-red px-2 py-1 text-xs font-semibold text-white"
                      >
                        Remove
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmId(a.id)} className="rounded-lg p-1.5 text-zinc-600 hover:bg-tp-red/10 hover:text-tp-red" aria-label="Remove entry">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Imports ─────────────────────────────────────────────────────────────────

function ImportsTab({ account, onImport }: { account: Account; onImport: () => void }) {
  const deleteImportHistoryEntry = useAccountStore((s) => s.deleteImportHistoryEntry);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const list = [...(account.importHistory ?? [])].reverse();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-tp-card p-4 ring-1 ring-inset ring-white/[0.06]">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Bring in more trades</p>
          <p className="text-xs text-zinc-500">CSV from Tradovate, NinjaTrader, TopstepX, TradingView and more. Duplicates are skipped.</p>
        </div>
        <button onClick={onImport} className={btn.primary}>
          <Upload className="h-4 w-4" /> Import trades
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-300">No file imports yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-zinc-500">Each import shows up here with its file, trades and P&amp;L, so you can undo one cleanly.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="rounded-xl p-3.5 ring-1 ring-inset ring-white/[0.06]">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-400">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200" title={e.fileName}>
                    {e.fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {e.tradesImported} trades
                    {e.dateRange && ` · ${shortDate(e.dateRange.from).replace(/, \d{4}$/, '')} – ${shortDate(e.dateRange.to)}`}
                    {' · '}imported {e.importedAt}
                  </p>
                </div>
                <span className={clsx('text-sm font-semibold tabular-nums', e.totalPnL < 0 ? 'text-tp-red' : 'text-tp-green')}>{signedUsd(e.totalPnL, true)}</span>
              </div>
              {confirmId === e.id ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-tp-red/[0.07] px-3 py-2 ring-1 ring-inset ring-tp-red/15">
                  <span className="text-xs text-zinc-300">Undo this import? Its {e.tradesImported} trades are removed too.</span>
                  <span className="flex gap-1">
                    <button onClick={() => setConfirmId(null)} className={clsx(btn.ghost, 'px-2 py-1 text-xs')}>
                      Keep
                    </button>
                    <button
                      onClick={() => {
                        deleteImportHistoryEntry(account.id, e.id);
                        setConfirmId(null);
                        toast.success('Import undone');
                      }}
                      className="rounded-lg bg-tp-red px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      Undo import
                    </button>
                  </span>
                </div>
              ) : (
                <div className="mt-2 flex justify-end">
                  <button onClick={() => setConfirmId(e.id)} className={clsx(btn.ghost, 'px-2 py-1 text-xs hover:text-tp-red')}>
                    <Trash2 className="h-3.5 w-3.5" /> Undo import
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
