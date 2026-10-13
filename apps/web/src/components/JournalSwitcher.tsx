'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Check, ChevronsUpDown, Plus, Settings, Users } from 'lucide-react';
import { useAccountStore, journalAccountCounts } from '@/store/accountStore';
import { journalInitials, useJournalStore, type Journal } from '@/store/journalStore';
import { createJournal, openJournal } from '@/lib/journalActions';
import { APP_ROUTES } from '@/lib/navigation';

export function JournalTile({ journal, size = 'md' }: { journal: Journal; size?: 'sm' | 'md' | 'lg' }) {
  const box = { sm: 'h-7 w-7 rounded-lg text-[11px]', md: 'h-9 w-9 rounded-xl text-[13px]', lg: 'h-11 w-11 rounded-[14px] text-[15px]' }[size];
  return (
    <span
      className={clsx('grid shrink-0 place-items-center font-bold tracking-tight text-black/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]', box)}
      style={{ background: journal.color }}
      aria-hidden
    >
      {journalInitials(journal.name)}
    </span>
  );
}

export const accountsLabel = (n: number) => (n === 0 ? 'No accounts yet' : `${n} account${n === 1 ? '' : 's'}`);

/** Which journal you are in, at the top of the rail. A journal is yours ("Abe's prop accounts", "Personal", "Options") and holds its own accounts. */
export function JournalSwitcher({ collapsed }: { collapsed: boolean }) {
  const { journals, activeId, hydrate } = useJournalStore();
  const accounts = useAccountStore((s) => s.accounts);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => hydrate(), [hydrate]);

  const current = journals.find((j) => j.id === activeId) ?? journals[0];
  const counts = journalAccountCounts(accounts);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setAdding(false);
      setName('');
    };
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createJournal(name);
    setName('');
    setAdding(false);
    setOpen(false);
  };

  if (collapsed) {
    return (
      <Link href={APP_ROUTES.settings} aria-label={`Journal: ${current.name}`} title={current.name} className="tp-press mx-auto mt-2 block w-fit rounded-xl">
        <JournalTile journal={current} />
      </Link>
    );
  }

  const menuLink = 'tp-press flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[14px] font-medium text-white/85 hover:bg-white/[0.08]';

  return (
    <div ref={ref} className="relative px-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx('tp-press flex w-full items-center gap-3 rounded-2xl p-2 text-left', open ? 'bg-white/[0.1]' : 'bg-white/[0.05] hover:bg-white/[0.08]')}
      >
        <JournalTile journal={current} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold tracking-tight text-white">{current.name}</span>
          <span className="block truncate text-[12px] text-white/45">{accountsLabel(counts[current.id] ?? 0)}</span>
        </span>
        <ChevronsUpDown className="mr-1 h-4 w-4 shrink-0 text-white/35" />
      </button>

      {open && (
        <div role="menu" className="tp-menu-in absolute inset-x-3 top-full z-30 mt-2 overflow-hidden rounded-2xl bg-tp-raised p-1.5 shadow-sheet">
          <Link href={APP_ROUTES.settings} role="menuitem" onClick={() => setOpen(false)} className={menuLink}>
            <Settings className="h-4 w-4 text-white/50" />
            Settings
          </Link>
          <Link href={APP_ROUTES.accounts} role="menuitem" onClick={() => setOpen(false)} className={menuLink}>
            <Users className="h-4 w-4 text-white/50" />
            Accounts in this journal
          </Link>

          <div className="mx-1 my-1.5 h-px bg-white/[0.08]" />
          <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/35">Journals</div>
          <div className="tp-no-scrollbar max-h-[240px] overflow-y-auto">
            {journals.map((j) => {
              const on = j.id === activeId;
              return (
                <button
                  key={j.id}
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => {
                    openJournal(j.id);
                    setOpen(false);
                  }}
                  className={clsx('tp-press flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left', on ? 'bg-white/[0.1]' : 'hover:bg-white/[0.06]')}
                >
                  <JournalTile journal={j} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-white/90">{j.name}</span>
                    <span className="block truncate text-[11px] text-white/40">{accountsLabel(counts[j.id] ?? 0)}</span>
                  </span>
                  <Check className={clsx('h-4 w-4 shrink-0 text-tp-accent', !on && 'invisible')} strokeWidth={2.6} />
                </button>
              );
            })}
          </div>

          <div className="mx-1 my-1.5 h-px bg-white/[0.08]" />
          {adding ? (
            <form onSubmit={submit} className="flex items-center gap-1.5 p-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Journal name"
                maxLength={40}
                aria-label="New journal name"
                className="min-w-0 flex-1 rounded-lg bg-black/30 px-2.5 py-1.5 text-[13px] text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-tp-accent/60"
              />
              <button type="submit" disabled={!name.trim()} className="tp-press rounded-lg bg-tp-accent px-2.5 py-1.5 text-[13px] font-semibold text-tp-ink disabled:opacity-40">
                Add
              </button>
            </form>
          ) : (
            <button type="button" role="menuitem" onClick={() => setAdding(true)} className={menuLink}>
              <Plus className="h-4 w-4 text-white/50" />
              New journal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
