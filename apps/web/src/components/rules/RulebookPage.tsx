'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarClock, ExternalLink, ShieldAlert, Skull } from 'lucide-react';
import { useAccountStore } from '@/store/accountStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { accountPulse } from '@/lib/accountPulse';
import { PROP_FIRMS, type FirmAccountTier, type PropFirm } from '@/components/payout/propFirmData';
import { finePrintFor } from '@/components/payout/firmFinePrint';
import { DRAWDOWN_LABELS, PROP_FIRM_CATALOG, buildPayoutUrl } from '@/lib/propfirms';
import { rowsFor, SourceTag } from '@/components/propfirms/RulesThatBite';
import { BrokerBadge, stageLabel } from '@/components/accounts/accountUi';
import { TickMeter, ToneBadge, signedUsd, usd, type MeterTone } from '@/components/risk/pulseUi';
import { SegmentedControl } from '@/components/ui';
import { APP_ROUTES } from '@/lib/navigation';

const FIRMS = PROP_FIRMS.filter((f) => f.id !== 'custom');

const lockLine = (firm: PropFirm) =>
  firm.drawdownType === 'static'
    ? 'Never moves.'
    : firm.drawdownLockProfit === null
      ? 'Trails your peak for the life of the account.'
      : firm.drawdownLockProfit === 0
        ? 'Stops trailing once it reaches your starting balance.'
        : `Stops trailing at ${usd(firm.drawdownLockProfit)} above your starting balance.`;

/** One core rule: the firm's number, what it means, and where this account stands against it. */
function RuleCard({
  label,
  value,
  unit,
  note,
  you,
  meter,
}: {
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  note: React.ReactNode;
  you?: React.ReactNode;
  meter?: React.ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col bg-tp-card p-5 sm:p-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500">{label}</h3>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[30px] font-bold leading-none tracking-[-0.035em] tabular-nums text-white">{value}</span>
        {unit && <span className="text-[13px] text-zinc-400">{unit}</span>}
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">{note}</p>
      {(you || meter) && (
        <div className="mt-auto pt-5">
          {meter}
          {you && (
            <p className={clsx('flex items-baseline gap-2 text-[13px] tabular-nums text-zinc-200', meter && 'mt-2.5')}>
              <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300">You</span>
              <span className="min-w-0">{you}</span>
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function SectionHead({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: React.ReactNode }) {
  return (
    <header className="mb-5 flex items-start gap-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-zinc-200 ring-1 ring-inset ring-white/[0.08]">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <h2 className="text-[22px] font-bold leading-tight tracking-[-0.03em] text-white">{title}</h2>
        <p className="mt-1 max-w-[78ch] text-[14px] leading-relaxed text-zinc-400">{sub}</p>
      </div>
    </header>
  );
}

export function RulebookPage() {
  const mounted = useHasMounted();
  const accounts = useAccountStore((s) => s.accounts);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const account = useMemo(() => accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null, [accounts, selectedAccountId]);
  const pulse = useMemo(() => (mounted && account ? accountPulse(account) : null), [mounted, account]);

  // The page opens on the firm behind the selected account; any other program is a tap away.
  const [firmId, setFirmId] = useState<string | null>(null);
  const [tierId, setTierId] = useState<string | null>(null);
  useEffect(() => {
    setFirmId(null);
    setTierId(null);
  }, [account?.id]);

  const firm = FIRMS.find((f) => f.id === firmId) ?? pulse?.firm ?? FIRMS[0];
  const own = !!pulse?.firm && pulse.firm.id === firm.id;
  const tier: FirmAccountTier =
    firm.tiers.find((t) => t.id === tierId) ?? (own && pulse?.tier ? firm.tiers.find((t) => t.id === pulse.tier!.id) : undefined) ?? firm.tiers[0];
  const live = own && pulse && tier.id === pulse.tier?.id ? pulse : null;

  const fp = finePrintFor(firm.id);
  const brand = PROP_FIRM_CATALOG.find((b) => b.programIds.includes(firm.id));
  const rows = fp ? rowsFor(firm, fp, tier.id) : [];
  const liq = live?.liq ?? null;
  const liqTone: MeterTone = !liq || live?.closed ? 'idle' : liq.status === 'safe' ? 'good' : liq.status === 'caution' ? 'warn' : 'bad';
  const con = live?.consistency ?? null;
  const consistencyOn = firm.consistencyPercent > 0 && firm.consistencyPercent < 100;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="tp-rise flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pb-8 pt-2">
        <div className="min-w-0 max-w-2xl">
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.28em] text-tp-green">
            Rulebook / {firm.name}
          </p>
          <h1 className="mt-4 text-[40px] font-bold leading-[1.02] tracking-[-0.04em] text-white sm:text-[52px]">
            The rules you signed.
            <span className="block text-zinc-500">And the ones that bite.</span>
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-zinc-400">
            {live
              ? `Every limit on ${live.account.name}, with where you stand against each one right now.`
              : `${firm.name} ${firm.program}, read from the firm’s own pages. Pick your account in the top bar to see it against your numbers.`}
          </p>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex items-center gap-3">
            <BrokerBadge broker={brand?.brokerLabel ?? firm.name} size="lg" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[17px] font-bold tracking-tight text-white">
                {firm.name} <span className="font-medium text-zinc-400">{firm.program}</span>
              </div>
              <div className="mt-0.5 truncate text-[13px] text-zinc-500">
                {tier.label} account{live ? ` · ${stageLabel(live.account)}` : ''} · {DRAWDOWN_LABELS[firm.drawdownType]}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {firm.verified ? (
              <ToneBadge tone="good">
                <span className="normal-case">Core rules verified {firm.rulesUpdated}</span>
              </ToneBadge>
            ) : (
              <ToneBadge tone="warn">Not verified. Confirm before you trade</ToneBadge>
            )}
            <a
              href={firm.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="tp-press inline-flex items-center gap-1.5 rounded-full bg-tp-fill px-3 py-1 text-[12px] font-semibold text-zinc-200 hover:bg-white/[0.14]"
            >
              Firm’s page <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Program + size ───────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Program" className="tp-no-scrollbar -mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 py-1">
          {/* Your own program leads the row, so it is never scrolled out of sight. */}
          {[...FIRMS].sort((a, b) => Number(b.id === pulse?.firm?.id) - Number(a.id === pulse?.firm?.id)).map((f) => {
            const active = f.id === firm.id;
            const mine = pulse?.firm?.id === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFirmId(f.id);
                  setTierId(null);
                }}
                className={clsx(
                  'tp-press flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold',
                  active ? 'bg-white text-zinc-950' : 'bg-tp-fill text-zinc-300 hover:bg-white/[0.14] hover:text-white',
                )}
              >
                {f.name}
                <span className={clsx('font-medium', active ? 'text-zinc-500' : 'text-zinc-500')}>{f.program}</span>
                {mine && <span className={clsx('h-1.5 w-1.5 rounded-full', active ? 'bg-zinc-950' : 'bg-tp-green')} title="Your selected account" />}
              </button>
            );
          })}
        </nav>
        {firm.tiers.length > 1 && (
          <SegmentedControl options={firm.tiers.map((t) => t.label)} value={tier.label} onChange={(l) => setTierId(firm.tiers.find((t) => t.label === l)?.id ?? null)} />
        )}
      </div>

      {/* ── Today ────────────────────────────────────────────────────────── */}
      {live && live.warnings.length > 0 && (
        <section aria-label="Today on this account" className="mb-6 overflow-hidden rounded-3xl bg-tp-yellow/[0.07] ring-1 ring-inset ring-tp-yellow/25">
          <div className="flex items-center gap-2 px-5 pt-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-tp-yellow sm:px-6">
            <CalendarClock className="h-4 w-4" /> Before today’s open
          </div>
          <ul className="divide-y divide-white/[0.06] px-5 pb-2 sm:px-6">
            {live.warnings.map((w) => (
              <li key={w.id} className="py-3.5">
                <p className="text-[15px] leading-relaxed text-zinc-100">{w.text}</p>
                {w.action && <p className="mt-1 text-[13px] text-zinc-400">{w.action}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Core rules ───────────────────────────────────────────────────── */}
      <section aria-label="Core rules" className="overflow-hidden rounded-3xl shadow-lift ring-1 ring-inset ring-white/[0.07]">
        <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-3">
          <RuleCard
            label="Drawdown"
            value={usd(tier.drawdown)}
            unit={DRAWDOWN_LABELS[firm.drawdownType].toLowerCase()}
            note={
              <>
                {firm.drawdownNote} <span className="text-zinc-500">{lockLine(firm)}</span>
              </>
            }
            meter={liq ? <TickMeter ratio={live?.closed ? 0 : liq.bufferRemaining} tone={liqTone} label={`${Math.round(liq.bufferRemaining * 100)}% of the buffer left`} /> : undefined}
            you={
              liq
                ? live?.closed
                  ? 'Account closed out.'
                  : `${usd(Math.max(0, liq.cushion))} above the line at ${usd(liq.threshold)}${liq.estimated ? ' (best case)' : liq.locked && firm.drawdownType !== 'static' ? ' · locked' : ''}`
                : undefined
            }
          />
          <RuleCard
            label="Daily loss limit"
            value={tier.dailyLossLimit !== null ? usd(tier.dailyLossLimit) : 'None'}
            unit={tier.dailyLossLimit !== null ? 'per session' : undefined}
            note={
              tier.dailyLossLimit !== null
                ? 'Lose this much in one session and the firm stops you for the day, or closes the account.'
                : 'The firm sets no daily limit, so the drawdown is the only line. One bad session can spend the whole buffer.'
            }
            you={
              live
                ? live.account.personalDailyLimit
                  ? `Your own stop is ${usd(live.account.personalDailyLimit)}. Today ${signedUsd(liq?.todayPnL ?? 0)}.`
                  : (
                      <>
                        No personal stop set.{' '}
                        <Link href={APP_ROUTES.routine} className="text-tp-blue hover:underline">
                          Set one in Preflight
                        </Link>
                      </>
                    )
                : undefined
            }
          />
          <RuleCard
            label="Consistency"
            value={consistencyOn ? `${firm.consistencyPercent}%` : 'None'}
            unit={consistencyOn ? `of ${firm.consistencyBasis === 'profitTarget' ? 'the profit target' : 'total profit'}` : undefined}
            note={
              consistencyOn
                ? firm.consistencyBasis === 'profitTarget'
                  ? `Your best single day may not pass ${usd((firm.consistencyPercent / 100) * tier.profitTarget)}. One oversized green day holds the payout.`
                  : `Your best single day may not be more than ${firm.consistencyPercent}% of the profit you ask to withdraw. A big day means more days before you can.`
                : 'No best-day cap on this program.'
            }
            meter={con ? <TickMeter ratio={(con.sharePct / con.limitPct) * 0.75} marker={0.75} tone={!con.ok ? 'bad' : con.sharePct >= 0.8 * con.limitPct ? 'warn' : 'good'} label={`Best day is ${Math.round(con.sharePct)}% against a ${con.limitPct}% cap`} /> : undefined}
            you={
              con
                ? `Best day ${usd(con.bestDay)} is ${Math.round(con.sharePct)}%, cap ${con.limitPct}%${con.limitPct !== firm.consistencyPercent ? ' (set on your account)' : ''}.`
                : undefined
            }
          />
          <RuleCard
            label="Profit target"
            value={usd(tier.profitTarget)}
            unit={firm.payoutModel === 'instant' ? 'before the first payout' : 'to pass'}
            note={`At least ${firm.minTradingDays} trading day${firm.minTradingDays === 1 ? '' : 's'} before ${firm.payoutModel === 'instant' ? 'a payout can be requested' : 'the account can pass or pay'}.`}
            meter={live?.target ? <TickMeter ratio={live.target.progress} tone={live.target.toGo > 0 ? 'info' : 'good'} label={`${Math.round(live.target.progress * 100)}% of the target`} /> : undefined}
            you={live?.target ? (live.target.toGo > 0 ? `${usd(live.target.toGo)} to go, ${signedUsd(live.target.profit)} so far.` : 'Target reached.') : live?.stage === 'funded' ? 'Funded: the target is behind you.' : undefined}
          />
          <RuleCard
            label="Position size"
            value={tier.maxContracts}
            unit={`minis, or ${tier.maxMicros} micros`}
            note="The most you may hold at once. Going over, even for a second, is a rule break at most firms."
          />
          <RuleCard
            label="Profit split"
            value={`${firm.profitSplit}%`}
            unit="yours"
            note={
              <>
                {firm.keep100Upto > 0 ? `You keep 100% of the first ${usd(firm.keep100Upto)}, then ${firm.profitSplit}%. ` : ''}
                {usd(tier.cost)} {firm.costCadence === 'monthly' ? 'a month' : 'one time'} at list price.
              </>
            }
            you={
              live?.payout
                ? live.payout.status === 'ready'
                  ? `Payout open: about ${usd(live.payout.afterSplit)} after the split.`
                  : live.payout.blockers[0]?.text
                : undefined
            }
          />
        </div>
      </section>

      {/* ── Fine print ───────────────────────────────────────────────────── */}
      <section aria-label="Fine print" className="mt-10">
        <SectionHead
          icon={ShieldAlert}
          title="The fine print"
          sub={
            fp ? (
              <>
                What holds payouts and closes accounts, for a {tier.label} account. Read {fp.checked}.
              </>
            ) : (
              'We have not read this program’s payout and news rules yet. Nothing is guessed here.'
            )
          }
        />
        {fp ? (
          <div className="overflow-hidden rounded-3xl bg-tp-card shadow-lift ring-1 ring-inset ring-white/[0.07]">
            <dl className="divide-y divide-white/[0.06]">
              {rows.map((row, i) => (
                <div key={`${row.label}-${i}`} className="grid gap-x-8 gap-y-1.5 px-5 py-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:px-6">
                  <dt className="flex items-center gap-2 text-[14px] font-medium text-zinc-400 sm:items-start sm:pt-0.5">{row.label}</dt>
                  <dd className="min-w-0">
                    {/* A number reads as a headline; a sentence reads as a sentence. */}
                    <div
                      className={clsx(
                        'flex flex-wrap items-center gap-y-1 text-white',
                        typeof row.value === 'string' && row.value.length > 48 ? 'text-[15px] leading-relaxed' : 'text-[16px] font-semibold tracking-tight',
                      )}
                    >
                      <span>{row.value}</span>
                      <SourceTag source={row.source} />
                    </div>
                    {row.note && <p className="mt-1.5 max-w-[68ch] text-[14px] leading-relaxed text-zinc-400">{row.note}</p>}
                  </dd>
                </div>
              ))}
            </dl>
            <footer className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/[0.06] bg-white/[0.02] px-5 py-3.5 text-[12px] text-zinc-500 sm:px-6">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-tp-green" /> Official lines were read on the firm’s help center. Reported lines come only from review sites.
              </span>
              <span className="ml-auto flex flex-wrap gap-x-4 gap-y-1">
                {fp.sources.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-tp-blue hover:underline">
                    <ExternalLink className="h-3 w-3" />
                    {new URL(url).hostname.replace(/^www\./, '')}
                  </a>
                ))}
              </span>
            </footer>
          </div>
        ) : (
          <a
            href={firm.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="tp-press inline-flex items-center gap-2 rounded-full bg-tp-fill px-4 py-2 text-[14px] font-semibold text-zinc-100 hover:bg-white/[0.14]"
          >
            Read them on the firm’s page <ArrowUpRight className="h-4 w-4" />
          </a>
        )}
      </section>

      {/* ── How accounts die here ────────────────────────────────────────── */}
      {brand && (
        <section aria-label="How accounts die here" className="mt-10">
          <SectionHead icon={Skull} title={`How ${brand.name} accounts die`} sub={brand.whyHard} />
          <ol className="grid gap-3 lg:grid-cols-3">
            {brand.mistakes.map((m, i) => (
              <li key={m} className="rounded-3xl bg-tp-card p-5 shadow-lift ring-1 ring-inset ring-white/[0.07] sm:p-6">
                <span className="font-mono text-[12px] font-semibold tracking-[0.2em] text-tp-red">{String(i + 1).padStart(2, '0')}</span>
                <p className="mt-3 text-[15px] leading-relaxed text-zinc-200">{m}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Next step ────────────────────────────────────────────────────── */}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-tp-card px-5 py-5 shadow-lift ring-1 ring-inset ring-white/[0.07] sm:px-6">
        <p className="min-w-0 max-w-xl text-[14px] leading-relaxed text-zinc-400">
          Firms change these often and prices move with promotions. {firm.notes}
        </p>
        <Link
          href={buildPayoutUrl(firm.id)}
          className="tp-press group inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-950 hover:bg-zinc-200"
        >
          Plan a payout on these rules
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </footer>
    </div>
  );
}

export default RulebookPage;
