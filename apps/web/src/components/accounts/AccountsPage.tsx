'use client';

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ArrowRight, Check, FlaskConical, HardDrive, Layers, Plus, PlugZap, Search, ShieldCheck, Upload, Wallet } from 'lucide-react';
import { useAccountStore, type Account, type AccountStatus } from '@/store/accountStore';
import { toast } from '@/store/toastStore';
import { snapshotFresh } from '@/lib/sessionRisk';
import { Segmented } from '@/components/routine/journeyUi';
import { AccountCard, type DrawerTab } from './AccountCard';
import { AccountDrawer } from './AccountDrawer';
import { AddAccountModal, DeleteAccountModal } from './AccountModals';
import { ConnectionsPanel } from './ConnectionsPanel';
import { AccountHealthBoard } from './AccountHealthBoard';
import { DataPanel } from './DataPanel';
import { STATUS_META, STATUS_ORDER, btn, signedUsd } from './accountUi';

type PageTab = 'accounts' | 'connections' | 'health' | 'data';
type Filter = AccountStatus | 'all';

interface AccountsPageProps {
  onImportForAccount: (accountId: string) => void;
  initialBroker?: string;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({ onImportForAccount, initialBroker }) => {
  const { accounts, addAccount, updateAccount, deleteAccount, selectAccount, selectedAccountId } = useAccountStore();
  const [tab, setTab] = useState<PageTab>('accounts');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [drawer, setDrawer] = useState<{ id: string; tab: DrawerTab } | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);

  useEffect(() => {
    if (initialBroker) setAdding(true);
  }, [initialBroker]);

  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '');
    if (fromHash === 'account-health') setTab('health');
    else if (['connections', 'data'].includes(fromHash)) setTab(fromHash as PageTab);
  }, []);

  const real = accounts.filter((a) => a.type !== 'demo');
  const sample = real.length === 0;
  const pool = sample ? accounts : real;
  const drawerAccount = drawer ? accounts.find((a) => a.id === drawer.id) ?? null : null;

  const summary = useMemo(() => {
    const now = Date.now();
    const live = pool.filter((a) => a.status === 'active' || a.status === 'passed_eval');
    return {
      net: pool.reduce((n, a) => n + a.balance, 0),
      active: pool.filter((a) => a.status === 'active').length,
      funded: pool.filter((a) => a.status === 'active' && a.isFunded).length,
      paidOut: pool.reduce((n, a) => n + (a.balanceAdjustments ?? []).filter((v) => v.type === 'payout').reduce((m, v) => m + Math.abs(v.amount), 0), 0),
      attention: real.filter((a) => (a.status === 'active' || a.status === 'passed_eval') && !snapshotFresh(a.riskSnapshot, now)).length,
      liveCount: live.length,
      linked: accounts.filter((a) => a.syncSource).length,
    };
  }, [pool, real, accounts]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: accounts.length, active: 0, passed_eval: 0, inactive: 0, blown: 0 };
    accounts.forEach((a) => (c[a.status || 'active'] += 1));
    return c;
  }, [accounts]);

  const q = query.trim().toLowerCase();
  const visible = accounts
    .filter((a) => filter === 'all' || (a.status || 'active') === filter)
    .filter((a) => !q || a.name.toLowerCase().includes(q) || a.broker.toLowerCase().includes(q))
    .sort((a, b) => Number(b.id === selectedAccountId) - Number(a.id === selectedAccountId) || STATUS_ORDER.indexOf(a.status || 'active') - STATUS_ORDER.indexOf(b.status || 'active'));
  const visibleMine = visible.filter((a) => a.type !== 'demo');
  const visibleSamples = visible.filter((a) => a.type === 'demo');

  const importFor = (id: string) => {
    setDrawer(null);
    onImportForAccount(id);
  };
  const makeCurrent = (a: Account) => {
    selectAccount(a.id);
    toast.success(`${a.name} is now your current account`);
  };
  const changeStatus = (a: Account, status: AccountStatus) => {
    updateAccount(a.id, { status });
    toast.success(`${a.name} marked ${STATUS_META[status].label.toLowerCase()}`);
  };

  const samples = accounts.length - real.length;
  const card = (a: Account) => (
    <AccountCard
      key={a.id}
      account={a}
      current={a.id === selectedAccountId}
      onMakeCurrent={() => makeCurrent(a)}
      onOpen={(t) => setDrawer({ id: a.id, tab: t })}
      onImport={() => importFor(a.id)}
      onStatus={(st) => changeStatus(a, st)}
      onDelete={() => setDeleting(a)}
    />
  );

  const tabs: { id: PageTab; label: string; icon: React.ElementType; badge?: React.ReactNode }[] = [
    { id: 'accounts', label: 'Accounts', icon: Layers, badge: accounts.length },
    { id: 'connections', label: 'Connections', icon: PlugZap, badge: summary.linked || undefined },
    {
      id: 'health',
      label: 'Risk check',
      icon: ShieldCheck,
      badge: summary.attention ? <span className="rounded-full bg-tp-yellow/15 px-1.5 text-[11px] font-semibold text-tp-yellow">{summary.attention}</span> : undefined,
    },
    { id: 'data', label: 'Backup & data', icon: HardDrive },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
            <Wallet className="h-5 w-5 text-tp-green" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight text-zinc-50">Accounts</h1>
            <p className="text-xs text-zinc-500">Every account you trade, how it’s doing, and what you’ve taken home.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedAccountId && (
            <button onClick={() => importFor(selectedAccountId)} className={btn.secondary}>
              <Upload className="h-4 w-4" /> Import trades
            </button>
          )}
          <button onClick={() => setAdding(true)} className={btn.primary}>
            <Plus className="h-4 w-4" /> Add account
          </button>
        </div>
      </header>

      {/* Overview */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-tp-card">
        <div className="grid grid-cols-2 divide-white/[0.06] lg:grid-cols-4 lg:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-white/[0.06] lg:[&>*:nth-child(-n+2)]:border-b-0 [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-white/[0.06] lg:[&>*:nth-child(odd)]:border-r-0">
          <OverviewStat label="Combined net P&L" value={signedUsd(summary.net)} tone={summary.net < 0 ? 'text-tp-red' : 'text-zinc-50'} sub={`across ${pool.length} ${sample ? 'sample ' : ''}account${pool.length === 1 ? '' : 's'}`} />
          <OverviewStat label="Active now" value={String(summary.active)} sub={summary.funded ? `${summary.funded} funded` : sample ? 'Add yours to start' : 'none funded yet'} />
          <OverviewStat label="Taken home" value={signedUsd(summary.paidOut)} tone={summary.paidOut ? 'text-tp-yellow' : 'text-zinc-50'} sub="recorded payouts" />
          <button onClick={() => setTab('health')} className="group p-5 text-left transition-colors hover:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              Risk check
              <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            {sample || !summary.liveCount ? (
              <div className="mt-1 text-[26px] font-semibold leading-tight text-zinc-600">—</div>
            ) : summary.attention ? (
              <div className="mt-1 flex items-center gap-2 text-[26px] font-semibold leading-tight text-tp-yellow">
                <AlertTriangle className="h-5 w-5" /> {summary.attention}
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 text-[26px] font-semibold leading-tight text-tp-green">
                <Check className="h-6 w-6" /> All set
              </div>
            )}
            <div className="mt-1 text-xs text-zinc-500">
              {sample || !summary.liveCount ? 'No live accounts yet' : summary.attention ? `need${summary.attention === 1 ? 's' : ''} fresh limits before trading` : 'limits confirmed'}
            </div>
          </button>
        </div>
      </section>

      {/* Tabs */}
      <nav aria-label="Account sections" className="flex gap-1 overflow-x-auto [scrollbar-width:none] border-b border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={clsx(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors',
              tab === t.id ? 'border-tp-green text-zinc-50' : 'border-transparent text-zinc-500 hover:text-zinc-200',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {typeof t.badge === 'number' ? <span className="rounded-full bg-white/[0.07] px-1.5 text-[11px] font-semibold tabular-nums text-zinc-400">{t.badge}</span> : t.badge}
          </button>
        ))}
      </nav>

      {tab === 'accounts' && (
        <div className="space-y-5">
          {sample && <GetStarted onAdd={() => setAdding(true)} onConnect={() => setTab('connections')} />}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={(['active', 'passed_eval', 'inactive', 'blown', 'all'] as Filter[]).map((f) => ({
                value: f,
                label: (
                  <>
                    {f !== 'all' && <span className={clsx('h-1.5 w-1.5 rounded-full', STATUS_META[f].dot)} />}
                    {f === 'all' ? 'All' : STATUS_META[f].label}
                    <span className="tabular-nums text-zinc-500">{counts[f]}</span>
                  </>
                ),
              }))}
            />
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search accounts"
                aria-label="Search accounts"
                className="w-full rounded-xl bg-black/25 py-2 pl-9 pr-3 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.07] placeholder:text-zinc-600 focus:outline-none focus:ring-tp-green/40"
              />
            </div>
          </div>

          {/* Your accounts */}
          <div>
            {samples > 0 && <SectionLabel title="Your accounts" note={real.length ? `${real.length} account${real.length === 1 ? '' : 's'}` : 'Nothing added yet'} />}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleMine.map(card)}
              <button
                onClick={() => setAdding(true)}
                className={clsx(
                  'group flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.1] p-6 text-center transition-colors hover:border-tp-green/40 hover:bg-tp-green/[0.03]',
                  visibleMine.length ? 'min-h-[248px]' : 'min-h-[140px]',
                )}
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.05] text-zinc-400 ring-1 ring-inset ring-white/10 transition-colors group-hover:bg-tp-green/10 group-hover:text-tp-green">
                  <Plus className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-zinc-200">Add {real.length ? 'an' : 'your first'} account</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">Evaluation, funded or personal</span>
                </span>
              </button>
            </div>
          </div>

          {/* Sample accounts, kept apart from the trader's own */}
          {visibleSamples.length > 0 && (
            <div>
              <SectionLabel
                title={
                  <span className="inline-flex items-center gap-1.5 text-tp-blue">
                    <FlaskConical className="h-3.5 w-3.5" /> Sample accounts
                  </span>
                }
                note="Demo data that keeps trading through today · never counted in your totals"
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleSamples.map(card)}</div>
            </div>
          )}

          {visible.length === 0 && (
            <p className="text-center text-sm text-zinc-500">
              {q ? `No accounts match “${query}”.` : `No ${filter === 'all' ? '' : STATUS_META[filter as AccountStatus].label.toLowerCase() + ' '}accounts.`}{' '}
              {filter !== 'all' && (
                <button onClick={() => setFilter('all')} className="text-tp-green hover:underline">
                  Show all
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {tab === 'connections' && <ConnectionsPanel onImport={() => (selectedAccountId ? importFor(selectedAccountId) : setAdding(true))} />}
      {tab === 'health' && <AccountHealthBoard onAdd={() => setAdding(true)} />}
      {tab === 'data' && <DataPanel />}

      {adding && (
        <AddAccountModal
          defaultBroker={initialBroker}
          onClose={() => setAdding(false)}
          onCreate={({ name, broker, isFunded }, thenImport) => {
            const id = addAccount({ name, broker, type: 'file_upload', isFunded });
            selectAccount(id);
            setAdding(false);
            setFilter('active');
            setTab('accounts');
            toast.success(`${name} added`);
            if (thenImport) onImportForAccount(id);
          }}
        />
      )}

      {drawerAccount && drawer && (
        <AccountDrawer
          account={drawerAccount}
          tab={drawer.tab}
          setTab={(t) => setDrawer({ id: drawerAccount.id, tab: t })}
          current={drawerAccount.id === selectedAccountId}
          onMakeCurrent={() => makeCurrent(drawerAccount)}
          onClose={() => setDrawer(null)}
          onImport={() => importFor(drawerAccount.id)}
          onDelete={() => setDeleting(drawerAccount)}
        />
      )}

      {deleting && (
        <DeleteAccountModal
          account={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            deleteAccount(deleting.id);
            toast.success(`${deleting.name} deleted`);
            setDeleting(null);
            setDrawer(null);
          }}
        />
      )}
    </div>
  );
};

function SectionLabel({ title, note }: { title: React.ReactNode; note: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      <span className="text-xs text-zinc-600">{note}</span>
    </div>
  );
}

function OverviewStat({ label, value, sub, tone = 'text-zinc-50' }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="p-5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={clsx('mt-1 text-[26px] font-semibold leading-tight tracking-tight tabular-nums', tone)}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{sub}</div>
    </div>
  );
}

function GetStarted({ onAdd, onConnect }: { onAdd: () => void; onConnect: () => void }) {
  const steps = [
    { n: 1, title: 'Add your account', body: 'Pick your firm and name it. Takes ten seconds.', cta: 'Add account', onClick: onAdd, primary: true },
    { n: 2, title: 'Bring in your trades', body: 'Drop in a CSV export, or connect Tradovate / TopstepX to sync.', cta: 'See connections', onClick: onConnect },
    { n: 3, title: 'Set your risk limits', body: 'Tell TradePilot how much room you have left so it can protect it.', cta: null },
  ];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-tp-green/15 bg-gradient-to-br from-tp-green/[0.07] via-tp-card to-tp-card p-5 sm:p-6">
      <div className="text-xs font-semibold uppercase tracking-wider text-tp-green">You’re looking at sample data</div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-50">Set up your real account in three steps</h2>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-col rounded-xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.05]">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-xs font-semibold text-zinc-200">{s.n}</span>
            <p className="mt-3 text-sm font-semibold text-zinc-100">{s.title}</p>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-zinc-400">{s.body}</p>
            {s.cta && (
              <button onClick={s.onClick} className={clsx(s.primary ? btn.primary : btn.secondary, 'mt-4 self-start py-1.5 text-xs')}>
                {s.cta}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
