'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, ArrowUpRight, Lock, TrendingUp } from 'lucide-react';
import { accountsInScope, useAccountStore, type Account } from '@/store/accountStore';
import { accountPulse, type AccountPulse as Pulse } from '@/lib/accountPulse';
import { useDailyStop } from '@/hooks/useDailyStop';
import { useHasMounted } from '@/hooks/useHasMounted';
import { APP_ROUTES } from '@/lib/navigation';
import { BrokerBadge, stageLabel } from '@/components/accounts/accountUi';
import { TickMeter, TONE, ToneBadge, signedUsd, usd, type MeterTone } from '@/components/risk/pulseUi';

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const DRAWDOWN_WORD = { 'trailing-eod': 'End-of-day trailing', 'trailing-intraday': 'Intraday trailing', static: 'Static' } as const;

function Tile({
  label,
  value,
  unit,
  meter,
  left,
  right,
  chip,
}: {
  label: string;
  value: React.ReactNode;
  unit: React.ReactNode;
  meter: React.ReactNode;
  left: React.ReactNode;
  right?: React.ReactNode;
  chip?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col bg-tp-card px-5 pb-5 pt-[18px] sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{label}</span>
        {chip}
      </div>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[34px] font-bold leading-none tracking-[-0.035em] tabular-nums text-white">{value}</span>
        <span className="text-[13px] leading-snug text-zinc-400">{unit}</span>
      </div>
      <div className="mt-auto pt-5">{meter}</div>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] tabular-nums text-zinc-500">
        <span className="min-w-0 truncate">{left}</span>
        {right && <span className="shrink-0">{right}</span>}
      </div>
    </div>
  );
}

function PulseCard({ pulse, account }: { pulse: Pulse; account: Account }) {
  const stop = useDailyStop(account);
  const { liq, consistency, payout, target, verdict, firm, tier } = pulse;
  const tone = TONE[verdict.tone];
  const VerdictIcon = tone.icon;

  // The day's loss budget: the tightest of Preflight, the trader's own stop and the firm's.
  const dayLimit = stop?.lossLimit ?? null;
  const todayPnL = stop?.todayPnL ?? liq?.todayPnL ?? 0;
  const dayLeft = dayLimit !== null ? Math.max(0, dayLimit + Math.min(0, todayPnL)) : null;
  const dayRatio = dayLimit ? (dayLeft ?? 0) / dayLimit : 0;
  const dayTone: MeterTone = dayLimit === null ? 'idle' : dayRatio <= 0 ? 'bad' : dayRatio <= 0.35 ? 'warn' : 'good';

  const liqTone: MeterTone = !liq || pulse.closed ? 'idle' : liq.status === 'safe' ? 'good' : liq.status === 'caution' ? 'warn' : 'bad';
  const room = pulse.closed ? 0 : liq ? (dayLeft !== null ? Math.min(dayLeft, Math.max(0, liq.cushion)) : liq.roomToStop) : 0;
  const dayBinds = !!liq && dayLeft !== null && dayLeft < Math.max(0, liq.cushion);

  const conTone: MeterTone = !consistency ? 'idle' : !consistency.ok ? 'bad' : consistency.sharePct >= 0.8 * consistency.limitPct ? 'warn' : 'good';

  return (
    <section
      aria-label={`Account pulse for ${account.name}`}
      className="tp-rise relative mb-6 overflow-hidden rounded-3xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.07]"
    >
      {/* A wash of the verdict's colour, so the state is felt before it is read. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ background: `radial-gradient(70% 100% at 0% 0%, rgb(${tone.rgb} / 0.13), transparent 70%)` }}
      />

      <header className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pb-5 pt-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ring-inset ring-white/[0.08]', tone.text)}
            style={{ background: `rgb(${tone.rgb} / 0.14)` }}
          >
            <VerdictIcon className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[22px] font-bold leading-tight tracking-[-0.03em] text-white">{verdict.title}</h2>
            <p className="mt-0.5 text-[14px] leading-snug text-zinc-400">{verdict.detail}</p>
          </div>
        </div>
        {/* The top bar already names the account; here, just what kind of account it is. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 text-[12px] font-semibold text-zinc-300">
          <span className="rounded-full bg-tp-fill px-2.5 py-1">{stageLabel(account)}</span>
          {liq && <span className="rounded-full bg-tp-fill px-2.5 py-1">{DRAWDOWN_WORD[liq.rules.drawdownType]}</span>}
        </div>
      </header>

      <div className="relative grid grid-cols-1 gap-px border-y border-white/[0.06] bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
        {/* 1 · the number that ends accounts */}
        <Tile
          label="Room to lose"
          value={liq ? usd(room) : '—'}
          unit={!liq ? 'no drawdown rule set' : pulse.closed ? 'account is over' : dayBinds ? 'before today’s stop' : 'before the account closes'}
          chip={
            liq?.estimated ? (
              <span
                title="Intraday trailing is measured from closed trades only. Your real line can only be higher."
                className="inline-flex items-center gap-1 rounded-full bg-tp-yellow/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-tp-yellow"
              >
                <TrendingUp className="h-3 w-3" /> Best case
              </span>
            ) : liq?.locked && liq.rules.drawdownType !== 'static' ? (
              <span
                title="The trailing line has reached its lock and no longer moves."
                className="inline-flex items-center gap-1 rounded-full bg-tp-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-tp-green"
              >
                <Lock className="h-3 w-3" /> Locked
              </span>
            ) : undefined
          }
          meter={
            <TickMeter
              ratio={pulse.closed ? 0 : liq?.bufferRemaining ?? 0}
              tone={liqTone}
              label={liq ? `${Math.round(liq.bufferRemaining * 100)}% of the drawdown buffer left` : 'No drawdown rule'}
            />
          }
          left={liq ? `Line at ${usd(liq.threshold)}` : <Link href={APP_ROUTES.accounts} className="text-tp-blue hover:underline">Set the rules</Link>}
          right={liq && liq.lossesSurvived !== null ? `${liq.lossesSurvived} avg loser${liq.lossesSurvived === 1 ? '' : 's'}` : undefined}
        />

        {/* 2 · today */}
        <Tile
          label="Today"
          value={dayLeft !== null ? usd(dayLeft) : signedUsd(todayPnL)}
          unit={dayLimit !== null ? `left of a ${usd(dayLimit)} stop` : 'so far, no daily stop set'}
          meter={
            <TickMeter
              ratio={dayRatio}
              tone={dayTone}
              label={dayLimit !== null ? `${Math.round(dayRatio * 100)}% of today's loss budget left` : 'No daily stop set'}
            />
          }
          left={
            dayLimit !== null ? (
              `Today ${signedUsd(todayPnL)}`
            ) : (
              <Link href={APP_ROUTES.routine} className="text-tp-blue hover:underline">
                Set one in Preflight
              </Link>
            )
          }
          right={stop ? `${stop.tradesToday} trade${stop.tradesToday === 1 ? '' : 's'}` : undefined}
        />

        {/* 3 · the rule that holds payouts */}
        <Tile
          label="Consistency"
          value={consistency ? `${Math.round(consistency.sharePct)}%` : '—'}
          unit={consistency ? `best day, cap ${consistency.limitPct}%` : firm && firm.consistencyPercent >= 100 ? 'no rule on this program' : 'nothing to measure yet'}
          meter={
            // The cap sits three-quarters along, so a breach has somewhere to go.
            <TickMeter
              ratio={consistency ? (consistency.sharePct / consistency.limitPct) * 0.75 : 0}
              marker={consistency ? 0.75 : undefined}
              tone={conTone}
              label={consistency ? `Best day is ${Math.round(consistency.sharePct)}% of ${consistency.basis === 'profitTarget' ? 'the profit target' : 'cycle profit'}; the cap is ${consistency.limitPct}%` : 'No consistency rule in force'}
            />
          }
          left={consistency ? `Best ${usd(consistency.bestDay)}` : 'Of ' + (firm?.consistencyBasis === 'profitTarget' ? 'the profit target' : 'cycle profit')}
          right={consistency ? `Cap ${usd(consistency.cap)}` : undefined}
        />

        {/* 4 · the way out: a payout when funded, the target when not */}
        {payout ? (
          <Tile
            label="Next payout"
            value={
              payout.status === 'ready' ? usd(payout.afterSplit) : payout.status === 'held' ? 'Held' : payout.status === 'maxed' ? 'Maxed' : `${payout.days.have}/${payout.days.need}`
            }
            unit={
              payout.status === 'ready'
                ? 'to you, after the split'
                : payout.status === 'held'
                  ? 'by the consistency rule'
                  : payout.status === 'maxed'
                    ? `all ${payout.payoutsTaken} payouts taken`
                    : payout.days.have >= payout.days.need
                      ? 'days done'
                      : `${payout.days.qualifyingProfit ? 'winning' : 'trading'} days this cycle`
            }
            chip={payout.status === 'ready' ? <ToneBadge tone="good" className="!px-2 !py-0.5 !text-[10px] uppercase tracking-wide">Open</ToneBadge> : undefined}
            meter={
              <TickMeter
                ratio={payout.status === 'ready' ? 1 : payout.days.need ? payout.days.have / payout.days.need : 0}
                tone={payout.status === 'ready' ? 'good' : payout.status === 'held' ? 'warn' : payout.status === 'maxed' ? 'idle' : 'info'}
                label={`${payout.days.have} of ${payout.days.need} days toward the next payout`}
              />
            }
            left={
              payout.status === 'ready' ? (
                `${usd(payout.requestable)} before split`
              ) : payout.earliestDate ? (
                `Earliest ${shortDay(payout.earliestDate)}`
              ) : (
                <span title={payout.blockers[0]?.text}>{payout.blockers[0]?.text ?? 'Waiting'}</span>
              )
            }
            right={payout.status === 'maxed' ? undefined : `Payout ${payout.payoutsTaken + 1}`}
          />
        ) : target ? (
          <Tile
            label="Profit target"
            value={target.toGo > 0 ? usd(target.toGo) : 'Hit'}
            unit={target.toGo > 0 ? 'to go' : 'target reached'}
            meter={<TickMeter ratio={target.progress} tone={target.toGo > 0 ? 'info' : 'good'} label={`${Math.round(target.progress * 100)}% of the profit target`} />}
            left={`${signedUsd(target.profit)} of ${usd(target.target)}`}
            right={`${Math.round(target.progress * 100)}%`}
          />
        ) : (
          <Tile
            label="Next payout"
            value="—"
            unit={pulse.closed ? 'account closed' : 'stage not set'}
            meter={<TickMeter ratio={0} tone="idle" label="Not tracked" />}
            left={
              pulse.closed ? (
                'Nothing left to request'
              ) : (
                <Link href={APP_ROUTES.accounts} className="text-tp-blue hover:underline">
                  Mark it evaluation or funded
                </Link>
              )
            }
          />
        )}
      </div>

      <footer className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5 text-[13px] sm:px-6">
        {pulse.warnings[0] ? (
          <p className="flex min-w-0 flex-1 items-start gap-2 leading-snug text-zinc-300">
            <ToneBadge tone="warn" className="!px-1.5 !py-0.5 shrink-0">Today</ToneBadge>
            <span className="min-w-0">
              {pulse.warnings[0].text}
              {pulse.warnings.length > 1 && <span className="text-zinc-500"> +{pulse.warnings.length - 1} more</span>}
            </span>
          </p>
        ) : (
          <p className="min-w-0 flex-1 truncate text-zinc-500">
            {firm ? `${firm.name} · ${firm.program}${tier ? ` · ${tier.label}` : ''}` : 'No firm matched to this account'}
            {liq?.rules.inferred && <span className="text-zinc-600"> · rules matched from the firm name</span>}
          </p>
        )}
        <Link
          href={APP_ROUTES.rules}
          className="tp-press group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tp-fill px-3.5 py-1.5 font-semibold text-zinc-100 hover:bg-white/[0.14]"
        >
          Rulebook
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </footer>
    </section>
  );
}

/** Every account at a glance when no single one is selected: which is closest to the line, which can be paid. */
function Fleet({ pulses }: { pulses: Pulse[] }) {
  const selectAccount = useAccountStore((s) => s.selectAccount);
  return (
    <section
      aria-label="Account pulse for all accounts"
      className="tp-rise mb-6 overflow-hidden rounded-3xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.07]"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-4 pt-5 sm:px-6">
        <h2 className="text-[22px] font-bold tracking-[-0.03em] text-white">Account pulse</h2>
        <p className="text-[13px] text-zinc-500">Closest to the line first. Pick one to open it.</p>
      </header>
      <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {pulses.map((p) => {
          const { liq } = p;
          const tone: MeterTone = p.verdict.tone;
          return (
            <li key={p.account.id}>
              <button
                type="button"
                onClick={() => selectAccount(p.account.id)}
                className="group grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-x-5 gap-y-2 px-5 py-3.5 text-left hover:bg-white/[0.03] sm:px-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <BrokerBadge broker={p.account.broker} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-white">{p.account.name}</span>
                    <span className="block truncate text-[12px] text-zinc-500">{stageLabel(p.account)}</span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[18px] font-bold leading-none tracking-tight tabular-nums text-white">{liq && !p.closed ? usd(liq.roomToStop) : '—'}</span>
                  <TickMeter
                    className="mt-2 !h-2"
                    ticks={18}
                    ratio={p.closed ? 0 : liq?.bufferRemaining ?? 0}
                    tone={!liq || p.closed ? 'idle' : liq.status === 'safe' ? 'good' : liq.status === 'caution' ? 'warn' : 'bad'}
                    label={liq ? `${Math.round(liq.bufferRemaining * 100)}% of the buffer left` : 'No drawdown rule'}
                  />
                </span>
                <span className="col-span-2 flex min-w-0 items-center gap-2 lg:col-span-1">
                  <ToneBadge tone={p.closed ? 'idle' : tone} className="shrink-0">{p.closed ? 'Closed' : undefined}</ToneBadge>
                  <span className="min-w-0 truncate text-[13px] text-zinc-300">{p.verdict.title}</span>
                </span>
                <ArrowUpRight className="hidden h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-200 lg:block" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const TONE_ORDER = { bad: 0, warn: 1, good: 2, idle: 3 } as const;

/** The top of the dashboard: how close to losing the account, how close to being paid. */
export function AccountPulse() {
  const mounted = useHasMounted();
  const accounts = useAccountStore((s) => s.accounts);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const showAll = useAccountStore((s) => s.showAllAccounts);

  const account = useMemo(() => accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null, [accounts, selectedAccountId]);
  const pulse = useMemo(() => (account ? accountPulse(account) : null), [account]);
  const fleet = useMemo(
    () =>
      showAll
        ? accountsInScope(accounts)
            .map((a) => accountPulse(a))
            .filter((p) => p.liq || p.closed)
            .sort((a, b) => Number(a.closed) - Number(b.closed) || TONE_ORDER[a.verdict.tone] - TONE_ORDER[b.verdict.tone] || (a.liq?.bufferRemaining ?? 1) - (b.liq?.bufferRemaining ?? 1))
        : [],
    [accounts, showAll],
  );

  // Accounts live in browser storage, so the server render has nothing true to show.
  if (!mounted) return null;
  if (showAll) return fleet.length ? <Fleet pulses={fleet} /> : null;
  if (!account || !pulse) return null;
  // A cash account with no firm behind it has no line to track; stay out of the way.
  if (!pulse.liq && !pulse.firm && !pulse.closed) return null;
  return <PulseCard pulse={pulse} account={account} />;
}

export default AccountPulse;
