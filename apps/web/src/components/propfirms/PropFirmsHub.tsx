'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Target } from 'lucide-react';
import {
  CATALOG_LAST_UPDATED,
  getLiveBrands,
  getComingSoonBrands,
  PROP_FIRM_CATALOG,
} from '@/lib/propfirms';
import { PropFirmsShell } from './PropFirmsShell';
import { FirmCard } from './FirmCard';

const ALL_ASSETS = Array.from(
  new Set(PROP_FIRM_CATALOG.flatMap((b) => b.assetClasses))
).sort();

export function PropFirmsHub() {
  const [filter, setFilter] = useState<string>('all');
  const live = getLiveBrands();
  const comingSoon = getComingSoonBrands();

  const filtered = useMemo(() => {
    if (filter === 'all') return PROP_FIRM_CATALOG;
    return PROP_FIRM_CATALOG.filter((b) => b.assetClasses.includes(filter));
  }, [filter]);

  return (
    <PropFirmsShell>
      <section className="border-b border-white/[0.06] bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(48, 184, 134,0.12)_0%,transparent_55%)]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-tp-green/20 bg-tp-green/10 px-4 py-1 text-sm text-tp-green">
            <Target className="h-3.5 w-3.5" />
            Prop Firm Hub · {live.length} live · Updated {CATALOG_LAST_UPDATED}
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Trading journal for prop firm traders
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/55">
            Every major prop firm has a different rule set. Your journal needs to understand each of them.
            Browse firm rules, compare programs, then plan your path to payout in TradePilot.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/app/payout"
              className="inline-flex items-center gap-2 rounded-xl bg-tp-green px-5 py-3 text-sm font-semibold text-[#1B1A17] transition hover:bg-tp-green/90"
            >
              Open Payout Planner
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/app/accounts"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/5"
            >
              Manage accounts
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white">Why prop firms need rule-aware journaling</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/50">
            A regular trading journal logs your trades. A prop firm journal tracks your trades against the rules.
            Different firms enforce different drawdown types — some trail intraday, some only at the close. Some have
            daily loss limits, some do not. Miss one rule by $1 and the whole account is gone.
          </p>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Pick your firm</h2>
          <div className="flex flex-wrap gap-2">
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </FilterPill>
            {ALL_ASSETS.map((asset) => (
              <FilterPill key={asset} active={filter === asset} onClick={() => setFilter(asset)}>
                {asset}
              </FilterPill>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((brand) => (
            <FirmCard key={brand.slug} brand={brand} />
          ))}
        </div>

        {comingSoon.length > 0 && filter === 'all' && (
          <p className="mt-8 text-center text-sm text-white/35">
            {comingSoon.length} more firms coming soon — FTMO, FundedNext, Tradeify, and more.
          </p>
        )}
      </section>

      <section className="border-t border-white/[0.06] bg-[#161512]">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold text-white">One journal. Every prop firm.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
            Track Topstep, Apex, Lucid, and more — each with its own drawdown logic. Plan payouts, size micros,
            and journal every trade in TradePilot.
          </p>
          <Link
            href="/app/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1B1A17] transition hover:bg-white/90"
          >
            Start with TradePilot
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PropFirmsShell>
  );
}

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-lg border border-tp-green/30 bg-tp-green/10 px-3 py-1.5 text-xs font-medium capitalize text-tp-green'
          : 'rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium capitalize text-white/45 transition hover:border-white/15 hover:text-white/70'
      }
    >
      {children}
    </button>
  );
}
