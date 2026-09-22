'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { BookOpenCheck, Building2, ChevronDown, Info, PiggyBank, Receipt } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { accountsInScope, useAccountStore } from '@/store/accountStore';
import { APP_ROUTES } from '@/lib/navigation';
import { COST_KIND_LABEL, computeLedger, type LedgerMonth, type LedgerRow } from '@/lib/propLedger';
import { AdviceLine, MiniStat, SectionHeader, useThemeClasses } from './payoutPrimitives';

const usd = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${usd(n)}`;
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
const monthLabel = (m: string) =>
  new Date(`${m}-15T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

function NetChart({ months }: { months: LedgerMonth[] }) {
  const { dark, muted } = useThemeClasses();
  const grid = dark ? 'rgba(255,255,255,0.06)' : '#E5E7EB';
  const axis = dark ? '#71717A' : '#6B7280';
  const last = months.at(-1)?.cumulative ?? 0;
  const line = last >= 0 ? '#00D68F' : '#FF4868';

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ledgerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={line} stopOpacity={0.22} />
              <stop offset="100%" stopColor={line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            width={56}
            tickFormatter={(v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v) >= 1000 ? `${Math.round(Math.abs(v) / 1000)}k` : Math.abs(v)}`}
            tick={{ fill: axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke={axis} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: axis, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const m = active && payload?.[0]?.payload as LedgerMonth | undefined;
              if (!m) return null;
              return (
                <div className={clsx('rounded-lg border px-3 py-2 text-xs shadow-xl', dark ? 'border-white/10 bg-[#0D1628] text-zinc-200' : 'border-gray-200 bg-white text-gray-800')}>
                  <div className="font-semibold">{monthLabel(m.month)}</div>
                  <div className={muted}>Received {usd(m.received)} · spent {usd(m.spent)}</div>
                  <div className="mt-0.5 font-semibold">Running net {signed(m.cumulative)}</div>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="cumulative" stroke={line} strokeWidth={2} fill="url(#ledgerFill)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function RowsTable({ rows, first }: { rows: LedgerRow[]; first: string }) {
  const { text, muted, dark } = useThemeClasses();
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className={clsx('text-left text-[11px] uppercase tracking-wide', muted)}>
            <th className="px-1 pb-2 font-medium">{first}</th>
            <th className="px-1 pb-2 text-right font-medium">Spent</th>
            <th className="px-1 pb-2 text-right font-medium">Received</th>
            <th className="px-1 pb-2 text-right font-medium">Net</th>
            <th className="px-1 pb-2 text-right font-medium" title="Dollars received for every dollar of fees">Per $1 of fees</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={clsx('border-t', dark ? 'border-white/[0.06]' : 'border-gray-100')}>
              <td className={clsx('px-1 py-2.5 font-medium', text)}>
                {r.label}
                {r.accounts > 1 && <span className={clsx('ml-1.5 text-xs font-normal', muted)}>{r.accounts} accounts</span>}
              </td>
              <td className={clsx('px-1 py-2.5 text-right tabular-nums', muted)}>{usd(r.spent)}</td>
              <td className={clsx('px-1 py-2.5 text-right tabular-nums', muted)}>{usd(r.received)}</td>
              <td className={clsx('px-1 py-2.5 text-right font-semibold tabular-nums', r.net < 0 ? 'text-tp-red' : 'text-tp-green')}>{signed(r.net)}</td>
              <td className={clsx('px-1 py-2.5 text-right tabular-nums', text)}>{r.spent > 0 ? `$${(r.received / r.spent).toFixed(2)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fees against payouts, across every account the trader runs. */
export function LedgerTab() {
  const { card, text, muted, dark } = useThemeClasses();
  const accounts = useAccountStore((s) => s.accounts);
  const [showAccounts, setShowAccounts] = useState(false);

  const scope = useMemo(() => accountsInScope(accounts), [accounts]);
  const sample = scope.some((a) => a.type === 'demo');
  const l = useMemo(() => computeLedger(scope), [scope]);
  const hasCosts = l.spent > 0;

  const kinds = Object.entries(l.byKind)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a) as [keyof typeof COST_KIND_LABEL, number][];
  const topKind = kinds[0]?.[1] ?? 0;
  const bestFirm = l.byFirm.find((f) => f.spent > 0);
  const worstFirm = [...l.byFirm].reverse().find((f) => f.spent > 0 && f.net < 0);

  return (
    <div className="space-y-5">
      {/* Headline */}
      <section className={clsx(card, 'p-5 sm:p-6')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>
              Prop trading net {sample && <span className="ml-1 normal-case text-tp-blue">· sample accounts</span>}
            </p>
            <p className={clsx('mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl', l.net < 0 ? 'text-tp-red' : 'text-tp-green')}>
              {signed(l.net)}
            </p>
            <p className={clsx('mt-2 text-sm', muted)}>
              {usd(l.received)} received from {l.payoutCount} payout{l.payoutCount === 1 ? '' : 's'}, less {usd(l.spent)} in fees.
            </p>
          </div>
          <div className={clsx('rounded-xl px-4 py-3 text-right', dark ? 'bg-white/[0.03]' : 'bg-gray-50')}>
            <p className={clsx('text-[11px] uppercase tracking-wide', muted)}>Return on fees</p>
            <p className={clsx('text-2xl font-semibold tabular-nums', text)}>{l.returnOnFees === null ? '—' : `${l.returnOnFees >= 0 ? '+' : ''}${Math.round(l.returnOnFees * 100)}%`}</p>
            <p className={clsx('text-[11px]', muted)}>{l.spent > 0 ? `$${(l.received / l.spent).toFixed(2)} back per $1` : 'no fees logged'}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat
            label="Evaluation pass rate"
            tip="Evaluations you passed out of those that finished (passed or blown). Open evaluations are left out."
            value={pct(l.evals.passRate)}
            sub={`${l.evals.passed} passed · ${l.evals.failed} blown${l.evals.open ? ` · ${l.evals.open} open` : ''}`}
          />
          <MiniStat
            label="Funded → paid"
            tip="Share of funded accounts that have paid you at least once."
            value={pct(l.funded.payoutRate)}
            sub={`${l.funded.paid} of ${l.funded.total} funded`}
          />
          <MiniStat
            label="Fees per funded account"
            tip="Everything you have spent, divided by the funded accounts it bought. Resets and failed evaluations are part of the real price."
            value={l.costPerFunded === null ? '—' : usd(l.costPerFunded)}
          />
          <MiniStat label="Average payout" value={l.payoutCount ? usd(l.received / l.payoutCount) : '—'} sub="after split, as recorded" />
        </div>

        {l.grossPayouts > 0 && (
          <p className={clsx('mt-4 flex items-start gap-1.5 text-xs', muted)}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {l.grossPayouts} payout{l.grossPayouts === 1 ? ' is' : 's are'} counted at the gross withdrawal. Add what reached your bank on each
            one for an exact net.
          </p>
        )}
      </section>

      {!hasCosts && (
        <section className={clsx(card, 'flex flex-wrap items-center justify-between gap-4 p-5')}>
          <div className="flex items-start gap-3">
            <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-tp-yellow" />
            <div>
              <p className={clsx('text-sm font-semibold', text)}>No fees logged yet</p>
              <p className={clsx('mt-0.5 text-xs', muted)}>
                Log evaluation fees, resets and activations on each account so this shows what prop trading actually pays you.
              </p>
            </div>
          </div>
          <Link href={APP_ROUTES.accounts} className="rounded-lg bg-tp-green px-3 py-2 text-xs font-semibold text-[#0D1628] hover:bg-tp-green/90">
            Log fees in Accounts
          </Link>
        </section>
      )}

      {l.months.length > 1 && (
        <section className={clsx(card, 'p-5')}>
          <SectionHeader
            icon={<PiggyBank className="h-4 w-4 text-tp-green" />}
            title="Running net, month by month"
            subtitle="Payouts received minus fees paid, added up over time. Where it crosses zero is when prop trading started paying for itself."
          />
          <NetChart months={l.months} />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <section className={clsx(card, 'p-5 lg:col-span-3')}>
          <SectionHeader
            icon={<Building2 className="h-4 w-4 text-tp-blue" />}
            title="By firm"
            subtitle="Which firm is paying you, and which one you are paying."
          />
          {l.byFirm.length ? <RowsTable rows={l.byFirm} first="Firm" /> : <p className={clsx('text-sm', muted)}>No accounts yet.</p>}
          <div className="mt-4 space-y-2">
            {bestFirm && bestFirm.net > 0 && (
              <AdviceLine tone="good">
                {bestFirm.label} has paid ${(bestFirm.received / bestFirm.spent).toFixed(2)} for every $1 of fees.
              </AdviceLine>
            )}
            {worstFirm && (
              <AdviceLine tone="warn">
                {worstFirm.label} is {usd(-worstFirm.net)} in the hole. Look at why before you buy another account there.
              </AdviceLine>
            )}
          </div>
        </section>

        <section className={clsx(card, 'p-5 lg:col-span-2')}>
          <SectionHeader icon={<Receipt className="h-4 w-4 text-tp-yellow" />} title="Where the fees went" />
          {kinds.length ? (
            <ul className="space-y-3">
              {kinds.map(([kind, v]) => (
                <li key={kind}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={text}>{COST_KIND_LABEL[kind]}</span>
                    <span className={clsx('tabular-nums', muted)}>
                      {usd(v)} · {Math.round((v / l.spent) * 100)}%
                    </span>
                  </div>
                  <div className={clsx('mt-1.5 h-1.5 overflow-hidden rounded-full', dark ? 'bg-white/[0.06]' : 'bg-gray-100')}>
                    <div className="h-full rounded-full bg-tp-yellow" style={{ width: `${(v / topKind) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={clsx('text-sm', muted)}>Nothing logged.</p>
          )}
          {l.byKind.reset > 0 && (
            <p className={clsx('mt-4 text-xs', muted)}>
              Resets are {Math.round((l.byKind.reset / l.spent) * 100)}% of your spend. Each one is a day the plan did not hold.
            </p>
          )}
        </section>
      </div>

      <section className={clsx(card, 'p-5')}>
        <button
          type="button"
          onClick={() => setShowAccounts((v) => !v)}
          aria-expanded={showAccounts}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-tp-green" />
            <span className={clsx('text-sm font-semibold', text)}>Every account</span>
            <span className={clsx('text-xs', muted)}>{l.byAccount.length}</span>
          </span>
          <ChevronDown className={clsx('h-4 w-4 transition-transform', muted, showAccounts && 'rotate-180')} />
        </button>
        {showAccounts && (
          <div className="mt-4">
            <RowsTable rows={l.byAccount} first="Account" />
          </div>
        )}
      </section>
    </div>
  );
}

export default LedgerTab;
