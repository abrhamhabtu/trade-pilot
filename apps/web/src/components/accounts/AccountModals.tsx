'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Check, Plus, Search, Trash2, Upload } from 'lucide-react';
import type { Account } from '@/store/accountStore';
import { Segmented } from '@/components/routine/journeyUi';
import { BROKER_OPTIONS, BrokerBadge, Field, Modal, btn, getBrokerOption, inputCls } from './accountUi';

// ─── Broker picker ───────────────────────────────────────────────────────────

export function BrokerPicker({ value, onChange, collapsed: startCollapsed = false }: { value: string; onChange: (v: string) => void; collapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(startCollapsed && !!value);
  const [query, setQuery] = useState('');
  if (collapsed) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-black/25 p-2 pr-3 ring-1 ring-inset ring-white/[0.09]">
        <BrokerBadge broker={value} size="sm" />
        <span className="flex-1 truncate text-sm text-zinc-100">{value}</span>
        <button type="button" onClick={() => setCollapsed(false)} className="text-xs font-medium text-tp-green hover:underline">
          Change
        </button>
      </div>
    );
  }
  const q = query.trim().toLowerCase();
  const matches = BROKER_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || (o.aliases ?? []).some((a) => a.toLowerCase().includes(q)));
  const exact = BROKER_OPTIONS.some((o) => o.label.toLowerCase() === q);
  const selected = getBrokerOption(value)?.label ?? value;

  return (
    <div className="rounded-xl bg-black/20 p-2 ring-1 ring-inset ring-white/[0.07]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search firms or brokers"
          className={clsx(inputCls, 'pl-9')}
          aria-label="Search firms or brokers"
        />
      </div>
      <div className="mt-2 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
        {matches.map((o) => {
          const on = selected === o.label;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onChange(o.label)}
              aria-pressed={on}
              className={clsx(
                'flex items-center gap-2.5 rounded-lg p-2 text-left text-sm transition-colors',
                on ? 'bg-tp-green/10 text-zinc-50 ring-1 ring-inset ring-tp-green/40' : 'text-zinc-300 hover:bg-white/[0.05]',
              )}
            >
              <BrokerBadge broker={o.label} size="sm" />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {on && <Check className="h-4 w-4 shrink-0 text-tp-green" />}
            </button>
          );
        })}
        {q && !exact && (
          <button
            type="button"
            onClick={() => onChange(query.trim())}
            className={clsx(
              'col-span-2 flex items-center gap-2.5 rounded-lg p-2 text-left text-sm',
              selected === query.trim() ? 'bg-tp-green/10 text-zinc-50 ring-1 ring-inset ring-tp-green/40' : 'text-zinc-300 hover:bg-white/[0.05]',
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06]">
              <Plus className="h-3.5 w-3.5" />
            </span>
            Use “{query.trim()}”
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Add account ─────────────────────────────────────────────────────────────

export function AddAccountModal({
  defaultBroker,
  onClose,
  onCreate,
}: {
  defaultBroker?: string;
  onClose: () => void;
  onCreate: (input: { name: string; broker: string; isFunded?: boolean }, thenImport: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [broker, setBroker] = useState(() => (defaultBroker ? getBrokerOption(defaultBroker)?.label ?? defaultBroker : ''));
  const [stage, setStage] = useState<'evaluation' | 'funded' | 'unset'>('evaluation');
  const ready = name.trim() && broker.trim();

  const submit = (thenImport: boolean) => {
    if (!ready) return;
    onCreate({ name: name.trim(), broker: broker.trim(), isFunded: stage === 'unset' ? undefined : stage === 'funded' }, thenImport);
  };

  return (
    <Modal title="Add an account" subtitle="One account per login keeps every stat honest." icon={Plus} onClose={onClose} width="max-w-lg">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <Field label="Firm or broker">
          <BrokerPicker value={broker} onChange={setBroker} />
        </Field>
        <Field label="Account name" hint="Use something you’ll recognise at a glance, like the account number or size.">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={broker ? `e.g. ${broker} 50K #1` : 'e.g. Topstep 50K #1'}
            className={inputCls}
            required
          />
        </Field>
        <Field label="Stage">
          <Segmented
            value={stage}
            onChange={setStage}
            options={[
              { value: 'evaluation', label: 'Evaluation' },
              { value: 'funded', label: 'Funded' },
              { value: 'unset', label: 'Personal / not sure' },
            ]}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={btn.ghost}>
            Cancel
          </button>
          <button type="submit" disabled={!ready} className={btn.secondary}>
            Create account
          </button>
          <button type="button" disabled={!ready} onClick={() => submit(true)} className={btn.primary}>
            <Upload className="h-4 w-4" /> Create & import trades
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete account ──────────────────────────────────────────────────────────

export function DeleteAccountModal({ account, onClose, onConfirm }: { account: Account; onClose: () => void; onConfirm: () => void }) {
  const [text, setText] = useState('');
  const ok = text.trim() === account.name.trim();
  const imports = (account.importHistory ?? []).length;
  return (
    <Modal title="Delete this account?" subtitle="This can’t be undone." icon={AlertTriangle} tone="danger" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onConfirm();
        }}
        className="space-y-4"
      >
        <div className="rounded-xl bg-tp-red/[0.07] p-4 text-sm ring-1 ring-inset ring-tp-red/15">
          <p className="text-zinc-200">
            <strong className="text-zinc-50">{account.name}</strong> and everything in it will be removed:
          </p>
          <ul className="mt-2 space-y-1 text-zinc-400">
            <li>
              {account.trades.length} trade{account.trades.length === 1 ? '' : 's'} and their journal links
            </li>
            <li>
              {imports} import record{imports === 1 ? '' : 's'} and all payouts/deposits
            </li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">Tip: set the status to “Blown” or “Paid out” instead if you want to keep the history.</p>
        </div>
        <Field label={`Type “${account.name}” to confirm`}>
          <input value={text} onChange={(e) => setText(e.target.value)} className={clsx(inputCls, 'font-mono')} autoComplete="off" spellCheck={false} autoFocus />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn.ghost}>
            Cancel
          </button>
          <button type="submit" disabled={!ok} className={btn.danger}>
            <Trash2 className="h-4 w-4" /> Delete forever
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Restore backup ──────────────────────────────────────────────────────────

export function RestoreBackupModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [text, setText] = useState('');
  const ok = text.trim().toUpperCase() === 'RESTORE';
  const items = useMemo(() => ['Every account and trade', 'Journal entries, notes and screenshots', 'Playbooks, rules and settings'], []);
  return (
    <Modal title="Replace everything with a backup?" subtitle="Your current data is overwritten, not merged." icon={AlertTriangle} tone="danger" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-tp-red/[0.07] p-4 text-sm ring-1 ring-inset ring-tp-red/15">
          <p className="font-medium text-zinc-200">These will be replaced by the file’s contents:</p>
          <ul className="mt-2 space-y-1 text-zinc-400">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">Download a fresh backup first if you might want today’s data back.</p>
        </div>
        <Field label="Type RESTORE to continue">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ok && onConfirm()}
            placeholder="RESTORE"
            className={clsx(inputCls, 'font-mono')}
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn.ghost}>
            Cancel
          </button>
          <button type="button" disabled={!ok} onClick={onConfirm} className={btn.danger}>
            Choose backup file
          </button>
        </div>
      </div>
    </Modal>
  );
}
