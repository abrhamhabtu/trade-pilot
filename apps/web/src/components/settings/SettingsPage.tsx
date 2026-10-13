'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowUpRight, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAccountStore, journalAccountCounts, type Account } from '@/store/accountStore';
import { DEFAULT_JOURNAL_ID, useJournalStore } from '@/store/journalStore';
import { createJournal, deleteJournal, openJournal } from '@/lib/journalActions';
import { JournalTile, accountsLabel } from '@/components/JournalSwitcher';
import { BrokerBadge, STATUS_META, STATUS_ORDER, signedUsd } from '@/components/accounts/accountUi';
import { APP_ROUTES } from '@/lib/navigation';
import {
  BACKDROPS,
  PALETTES,
  applyBackdrop,
  applyPalette,
  loadBackdrop,
  loadPalette,
  type BackdropId,
  type PaletteId,
} from '@/lib/palette';

const byStatus = (a: Account, b: Account) => STATUS_ORDER.indexOf(a.status || 'active') - STATUS_ORDER.indexOf(b.status || 'active');

const BARS = [38, 62, -30, 48, 74, -22, 56, 90];

/** A tiny dashboard drawn in real tokens, scoped to one palette. What you see is what you get. */
function ThemePreview({ id, backdrop }: { id: PaletteId; backdrop: BackdropId }) {
  return (
    <div data-palette={id} data-backdrop={backdrop} className="tp-backdrop flex h-[132px] gap-2 overflow-hidden rounded-2xl p-2.5" aria-hidden>
      <div className="flex w-[30%] flex-col gap-1.5 rounded-xl bg-tp-panel p-2 ring-1 ring-inset ring-white/[0.07]">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-tp-accent" />
          <span className="h-1.5 w-8 rounded-full bg-white/40" />
        </div>
        <span className="mt-1 h-3.5 rounded-full bg-tp-accent" />
        <span className="mx-1.5 h-1.5 w-3/4 rounded-full bg-white/20" />
        <span className="mx-1.5 h-1.5 w-2/3 rounded-full bg-white/20" />
        <span className="mx-1.5 h-1.5 w-3/5 rounded-full bg-white/20" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-tp-card p-2 ring-1 ring-inset ring-white/[0.06]">
            <span className="block h-1 w-6 rounded-full bg-white/25" />
            <span className="mt-1.5 block h-2 w-10 rounded-full bg-tp-green" />
          </div>
          <div className="rounded-lg bg-tp-card p-2 ring-1 ring-inset ring-white/[0.06]">
            <span className="block h-1 w-6 rounded-full bg-white/25" />
            <span className="mt-1.5 block h-2 w-8 rounded-full bg-tp-blue" />
          </div>
        </div>
        <div className="flex flex-1 items-center gap-[5px] rounded-lg bg-tp-card px-2.5 ring-1 ring-inset ring-white/[0.06]">
          {BARS.map((v, i) => (
            <span key={i} className="flex h-[52px] flex-1 flex-col">
              <span className="flex flex-1 items-end">{v > 0 && <span className="w-full rounded-t-[3px] bg-tp-green" style={{ height: `${v}%` }} />}</span>
              <span className="flex flex-1 items-start">{v < 0 && <span className="w-full rounded-b-[3px] bg-tp-red" style={{ height: `${-v * 2}%` }} />}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const Group: React.FC<{ title: string; blurb?: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, blurb, action, children }) => (
  <section>
    <div className="mb-3 flex items-end justify-between gap-4 px-1">
      <div>
        <h2 className="text-[22px] font-bold tracking-tight text-white">{title}</h2>
        {blurb && <p className="mt-0.5 text-[15px] text-zinc-400">{blurb}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/** Journals belong to the trader. Each holds its own accounts; the app shows one at a time. */
function JournalsSection() {
  const { journals, activeId, hydrate, renameJournal } = useJournalStore();
  const { accounts, moveAccountToJournal } = useAccountStore();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => hydrate(), [hydrate]);

  const counts = journalAccountCounts(accounts);
  const active = journals.find((j) => j.id === activeId) ?? journals[0];
  const sorted = [...accounts].sort(byStatus);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createJournal(name);
    setName('');
  };
  const saveName = (id: string) => {
    renameJournal(id, draft);
    setEditing(null);
  };

  return (
    <Group title="Journals" blurb="A journal is yours: your prop accounts, your personal account, your options trading. Each keeps its own accounts and numbers.">
      <div className="overflow-hidden rounded-3xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.07]">
        {journals.map((j, i) => {
          const on = j.id === activeId;
          const n = counts[j.id] ?? 0;
          return (
            <div key={j.id} className={clsx('relative flex items-center gap-4 px-5 py-3.5', on && 'bg-white/[0.035]')}>
              {i > 0 && <span className="absolute left-[5rem] right-0 top-0 h-px bg-white/[0.06]" aria-hidden />}
              <JournalTile journal={j} size="lg" />
              {editing === j.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveName(j.id);
                  }}
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => saveName(j.id)}
                    maxLength={40}
                    aria-label="Journal name"
                    className="min-w-0 flex-1 rounded-xl bg-black/30 px-3 py-1.5 text-[16px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-tp-accent/60"
                  />
                </form>
              ) : (
                <button onClick={() => openJournal(j.id)} className="min-w-0 flex-1 text-left" aria-pressed={on}>
                  <span className="block truncate text-[16px] font-semibold tracking-tight text-white">{j.name}</span>
                  <span className="mt-0.5 block text-[13px] text-zinc-500">
                    {accountsLabel(n)}
                    {on && ' · Showing now'}
                  </span>
                </button>
              )}
              <button
                onClick={() => {
                  setEditing(j.id);
                  setDraft(j.name);
                }}
                aria-label={`Rename ${j.name}`}
                title="Rename"
                className="tp-press grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-white/[0.08] hover:text-white"
              >
                <Pencil className="h-4 w-4" />
              </button>
              {j.id !== DEFAULT_JOURNAL_ID && (
                <button
                  onClick={() =>
                    window.confirm(`Delete "${j.name}"? ${n ? `Its ${n} account${n === 1 ? '' : 's'} will move to "${journals[0].name}".` : 'It has no accounts.'}`) && deleteJournal(j.id)
                  }
                  aria-label={`Delete ${j.name}`}
                  title="Delete"
                  className="tp-press grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-tp-red/15 hover:text-tp-red"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => openJournal(j.id)}
                aria-label={on ? `${j.name} is showing` : `Switch to ${j.name}`}
                className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full', on ? 'bg-tp-accent text-tp-ink' : 'ring-1 ring-inset ring-white/20 hover:ring-white/50')}
              >
                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
            </div>
          );
        })}
        <form onSubmit={add} className="relative flex items-center gap-4 px-5 py-3.5">
          <span className="absolute left-[5rem] right-0 top-0 h-px bg-white/[0.06]" aria-hidden />
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white/[0.06] text-zinc-400">
            <Plus className="h-5 w-5" />
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New journal, e.g. Options"
            maxLength={40}
            aria-label="New journal name"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-white placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="tp-press shrink-0 rounded-full bg-tp-accent px-4 py-2 text-[15px] font-semibold text-tp-ink hover:brightness-110 disabled:opacity-35"
          >
            Create
          </button>
        </form>
      </div>

      {/* Accounts in the journal on screen */}
      <div className="mb-2 mt-7 flex items-baseline justify-between gap-4 px-1">
        <h3 className="text-[17px] font-bold tracking-tight text-white">
          Accounts in {active.name} <span className="font-normal text-zinc-500">{sorted.length}</span>
        </h3>
        <Link href={APP_ROUTES.accounts} className="inline-flex items-center gap-1 text-[15px] font-medium text-tp-accent hover:brightness-125">
          Add or manage accounts
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-3xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.07]">
        {sorted.length === 0 && (
          <div className="px-6 py-10 text-center text-[15px] text-zinc-400">This journal is empty. Add an account, or move one here from another journal.</div>
        )}
        {sorted.map((a, i) => {
          const status = STATUS_META[a.status || 'active'];
          return (
            <div key={a.id} className="relative flex items-center gap-4 px-5 py-3">
              {i > 0 && <span className="absolute left-[4.75rem] right-0 top-0 h-px bg-white/[0.06]" aria-hidden />}
              <BrokerBadge broker={a.broker} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold tracking-tight text-white">{a.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-zinc-500">
                  <span className={clsx('h-1.5 w-1.5 rounded-full', status.dot)} />
                  {status.label}
                  {a.type === 'demo' && <> · Sample data</>}
                  <> · {a.trades.length} trades</>
                </span>
              </span>
              <span className={clsx('hidden shrink-0 text-[15px] font-semibold tabular-nums sm:block', a.balance < 0 ? 'text-tp-red' : 'text-zinc-200')}>{signedUsd(a.balance)}</span>
              {journals.length > 1 && (
                <label className="shrink-0">
                  <span className="sr-only">Move {a.name} to another journal</span>
                  <select
                    value={activeId}
                    onChange={(e) => moveAccountToJournal(a.id, e.target.value)}
                    className="cursor-pointer appearance-none rounded-full bg-tp-fill px-3.5 py-1.5 text-[13px] font-semibold text-zinc-200 hover:bg-white/[0.14] focus:outline-none focus:ring-2 focus:ring-tp-accent/60"
                  >
                    {journals.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.id === activeId ? 'Move to…' : j.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </Group>
  );
}

export function SettingsPage() {
  const [palette, setPalette] = useState<PaletteId>('graphite');
  const [backdrop, setBackdrop] = useState<BackdropId>('spotlight');
  useEffect(() => {
    setPalette(loadPalette());
    setBackdrop(loadBackdrop());
  }, []);

  const pickPalette = (id: PaletteId) => {
    setPalette(id);
    applyPalette(id);
  };
  const pickBackdrop = (id: BackdropId) => {
    setBackdrop(id);
    applyBackdrop(id);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-12 pb-24">
      <header className="pt-1">
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.035em] text-white sm:text-[40px]">Settings</h1>
        <p className="mt-1.5 text-[17px] text-zinc-400">Make TradePilot look and work the way you trade.</p>
      </header>

      {/* Theme */}
      <Group title="Theme" blurb="Recolours the whole app. Wins stay green and losses stay red in every theme.">
        <div role="radiogroup" aria-label="Colour theme" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PALETTES.map((p, i) => {
            const on = palette === p.id;
            return (
              <button
                key={p.id}
                role="radio"
                aria-checked={on}
                onClick={() => pickPalette(p.id)}
                style={{ animationDelay: `${i * 35}ms` }}
                className={clsx(
                  'tp-press tp-rise group rounded-3xl bg-tp-card p-2 text-left shadow-lift ring-1 ring-inset transition-shadow',
                  on ? 'ring-2 ring-tp-accent' : 'ring-white/[0.07] hover:ring-white/20'
                )}
              >
                <div className="rounded-2xl ring-1 ring-white/[0.08] transition-transform duration-500 ease-spring group-hover:scale-[1.015]">
                  <ThemePreview id={p.id} backdrop={backdrop} />
                </div>
                <div className="flex items-center justify-between gap-3 px-2.5 pb-1.5 pt-3">
                  <span className="min-w-0">
                    <span className="block text-[16px] font-bold tracking-tight text-white">{p.name}</span>
                    <span className="block truncate text-[13px] text-zinc-500">{p.note}</span>
                  </span>
                  <span
                    className={clsx(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors',
                      on ? 'bg-tp-accent text-tp-ink' : 'ring-1 ring-inset ring-white/20'
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Group>

      {/* Backdrop */}
      <Group title="Backdrop" blurb="What sits behind your cards.">
        <div role="radiogroup" aria-label="Backdrop" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {BACKDROPS.map((b) => {
            const on = backdrop === b.id;
            return (
              <button
                key={b.id}
                role="radio"
                aria-checked={on}
                onClick={() => pickBackdrop(b.id)}
                className={clsx(
                  'tp-press rounded-3xl bg-tp-card p-2 text-left shadow-lift ring-1 ring-inset transition-shadow',
                  on ? 'ring-2 ring-tp-accent' : 'ring-white/[0.07] hover:ring-white/20'
                )}
              >
                <div data-backdrop={b.id} className="tp-backdrop grid h-[84px] place-items-center rounded-2xl ring-1 ring-white/[0.08]" aria-hidden>
                  <span className="h-9 w-24 rounded-xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.08]" />
                </div>
                <div className="flex items-center justify-between gap-3 px-2.5 pb-1.5 pt-3">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold tracking-tight text-white">{b.name}</span>
                    <span className="block truncate text-[13px] text-zinc-500">{b.note}</span>
                  </span>
                  <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full', on ? 'bg-tp-accent text-tp-ink' : 'ring-1 ring-inset ring-white/20')}>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </Group>

      <JournalsSection />

      <p className="px-1 text-[13px] text-zinc-600">TradePilot v1.0 · Theme, backdrop and journals are saved on this device.</p>
    </div>
  );
}
