'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Wallet,
  Users,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { getFirmById, type PropFirm } from '@/components/payout/propFirmData';
import {
  type PropFirmBrand,
  CATALOG_LAST_UPDATED,
  DRAWDOWN_LABELS,
  getRelatedBrands,
  buildPayoutUrl,
  buildAccountsUrl,
} from '@/lib/propfirms';
import { PropFirmsShell } from './PropFirmsShell';
import { FirmCard } from './FirmCard';

interface PropFirmDetailProps {
  brand: PropFirmBrand;
}

export function PropFirmDetail({ brand }: PropFirmDetailProps) {
  const programs = brand.programIds.map((id) => getFirmById(id)).filter((f) => f.id !== 'custom');
  const primary = programs[0];
  const related = getRelatedBrands(brand.slug);

  return (
    <PropFirmsShell>
      <article>
        {/* Hero */}
        <section className="border-b border-white/[0.06] bg-[radial-gradient(ellipse_100%_70%_at_50%_-10%,rgba(79,156,249,0.12)_0%,transparent_55%)]">
          <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
            <nav className="mb-6 flex items-center gap-2 text-xs text-white/35">
              <Link href="/propfirms" className="hover:text-white/60">
                Prop Firms
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-white/60">{brand.name}</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-4xl" aria-hidden>
                {brand.emoji}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/45">
                Updated {CATALOG_LAST_UPDATED}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {brand.name} trading journal
            </h1>
            <p className="mt-3 text-lg text-white/55">{brand.tagline}</p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/45">{brand.summary}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {brand.assetClasses.map((asset) => (
                <span
                  key={asset}
                  className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium capitalize text-white/50"
                >
                  {asset}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {primary && (
                <Link
                  href={buildPayoutUrl(primary.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-tp-green px-5 py-3 text-sm font-semibold text-[#0D1628] transition hover:bg-tp-green/90"
                >
                  <Wallet className="h-4 w-4" />
                  Plan payout
                </Link>
              )}
              <Link
                href={buildAccountsUrl(brand.brokerLabel)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/5"
              >
                <Users className="h-4 w-4" />
                Add account
              </Link>
            </div>
          </div>
        </section>

        {/* Why it's hard */}
        <section className="mx-auto max-w-4xl px-6 py-12">
          <h2 className="text-xl font-semibold text-white">Why {brand.name} is harder than it looks</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/55">{brand.whyHard}</p>

          {primary && (
            <RulesAtAGlance firm={primary} className="mt-8" />
          )}
        </section>

        {/* Programs */}
        {programs.length > 1 && (
          <section className="border-y border-white/[0.06] bg-[#0A1220]">
            <div className="mx-auto max-w-4xl px-6 py-12">
              <h2 className="text-xl font-semibold text-white">Programs</h2>
              <p className="mt-2 text-sm text-white/45">
                {brand.name} offers multiple account types — each with different rules.
              </p>
              <div className="mt-6 space-y-4">
                {programs.map((program) => (
                  <ProgramCard key={program.id} program={program} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Mistakes */}
        {brand.mistakes.length > 0 && (
          <section className="mx-auto max-w-4xl px-6 py-12">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <AlertTriangle className="h-5 w-5 text-tp-yellow" />
              Common mistakes
            </h2>
            <ul className="mt-5 space-y-3">
              {brand.mistakes.map((mistake) => (
                <li
                  key={mistake}
                  className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#111F35] px-4 py-3 text-sm leading-relaxed text-white/55"
                >
                  <span className="mt-0.5 text-tp-yellow">•</span>
                  {mistake}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* How TradePilot helps */}
        <section className="border-y border-white/[0.06] bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(0,214,143,0.06)_0%,transparent_70%)]">
          <div className="mx-auto max-w-4xl px-6 py-12">
            <h2 className="text-xl font-semibold text-white">How TradePilot helps</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/55">{brand.howTradePilotHelps}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <FeatureTile title="Payout Planner" desc="Model consistency, drawdown, and path to first withdrawal." href="/app/payout" />
              <FeatureTile title="Trade journal" desc="Log every session and review performance by setup." href="/app/journal" />
              <FeatureTile title="Dashboard" desc="See cumulative P&L, win rate, and calendar at a glance." href="/app/dashboard" />
            </div>
          </div>
        </section>

        {/* FAQ */}
        {brand.faq.length > 0 && (
          <section className="mx-auto max-w-4xl px-6 py-12">
            <h2 className="text-xl font-semibold text-white">Frequently asked questions</h2>
            <div className="mt-6 space-y-4">
              {brand.faq.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-white/[0.06] bg-[#111F35] open:border-tp-green/20"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
                    {item.question}
                  </summary>
                  <p className="border-t border-white/[0.06] px-5 py-4 text-sm leading-relaxed text-white/50">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Related */}
        {related.length > 0 && (
          <section className="border-t border-white/[0.06] bg-[#0A1220]">
            <div className="mx-auto max-w-6xl px-6 py-12">
              <h2 className="text-lg font-semibold text-white">Also see</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((b) => (
                  <FirmCard key={b.slug} brand={b} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="border-t border-white/[0.06]">
          <div className="mx-auto max-w-4xl px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold text-white">
              Start your {brand.name} challenge with confidence
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-white/50">
              Plan every rule, drawdown buffer, and consistency constraint before you trade — so you never blow an
              account because of a math mistake.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {primary && (
                <Link
                  href={buildPayoutUrl(primary.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-tp-green px-6 py-3 text-sm font-semibold text-[#0D1628] transition hover:bg-tp-green/90"
                >
                  Plan payout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                href="/app/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-white/80 transition hover:border-white/20"
              >
                Open TradePilot
              </Link>
            </div>
          </div>
        </section>
      </article>
    </PropFirmsShell>
  );
}

function RulesAtAGlance({ firm, className }: { firm: PropFirm; className?: string }) {
  const tier = firm.tiers[0];
  const dll = tier.dailyLossLimit;

  const rows: { label: string; value: string }[] = [
    { label: 'Drawdown type', value: DRAWDOWN_LABELS[firm.drawdownType] },
    {
      label: 'Daily loss limit',
      value: dll != null ? `$${dll.toLocaleString()}` : 'None on this tier',
    },
    {
      label: 'Profit target',
      value: `$${tier.profitTarget.toLocaleString()} (${tier.label})`,
    },
    {
      label: 'Consistency rule',
      value: `${firm.consistencyPercent}% max single-day ${firm.consistencyBasis === 'totalProfit' ? 'of total profit' : 'of profit target'}`,
    },
    { label: 'Minimum trading days', value: `${firm.minTradingDays} days` },
    {
      label: 'Profit split',
      value:
        firm.keep100Upto > 0
          ? `100% to $${(firm.keep100Upto / 1000).toFixed(0)}K, then ${firm.profitSplit}%`
          : `${firm.profitSplit}%`,
    },
  ];

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Rules at a glance</h3>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08]">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.label}
                className={clsx(i % 2 === 0 ? 'bg-[#111F35]' : 'bg-[#0D1628]')}
              >
                <td className="px-4 py-3 font-medium text-white/45">{row.label}</td>
                <td className="px-4 py-3 text-right text-white/80">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {firm.sourceUrl && (
        <a
          href={firm.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-tp-blue hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Verify on {firm.name}&apos;s official site
        </a>
      )}
    </div>
  );
}

function ProgramCard({ program }: { program: PropFirm }) {
  const tier = program.tiers[0];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111F35] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{program.program}</h3>
          <p className="mt-1 text-xs text-white/40">
            {program.payoutModel === 'eval' ? 'Evaluation' : 'Instant / funded'} ·{' '}
            {DRAWDOWN_LABELS[program.drawdownType]}
          </p>
        </div>
        {program.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-tp-green/10 px-2 py-0.5 text-[10px] font-semibold text-tp-green">
            <ShieldCheck className="h-3 w-3" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-tp-yellow/10 px-2 py-0.5 text-[10px] font-semibold text-tp-yellow">
            <ShieldAlert className="h-3 w-3" /> Confirm rules
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <MiniStat label="Target" value={`$${tier.profitTarget.toLocaleString()}`} />
        <MiniStat label="Drawdown" value={`$${tier.drawdown.toLocaleString()}`} />
        <MiniStat label="Consistency" value={`${program.consistencyPercent}%`} />
        <MiniStat label="From" value={tier.cost > 0 ? `$${tier.cost}` : '—'} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-white/40">{program.drawdownNote}</p>

      <Link
        href={buildPayoutUrl(program.id)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-tp-green hover:underline"
      >
        Open in Payout Planner
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
      <p className="mt-0.5 font-semibold text-white/80">{value}</p>
    </div>
  );
}

function FeatureTile({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-white/[0.06] bg-[#111F35] p-4 transition hover:border-tp-green/20"
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/40">{desc}</p>
    </Link>
  );
}
