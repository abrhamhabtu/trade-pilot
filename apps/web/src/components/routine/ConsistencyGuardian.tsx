'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Info,
  RefreshCw,
  Route,
  Settings2,
  Shield,
  XCircle,
} from 'lucide-react';
import { useAccountStore, type Account } from '../../store/accountStore';
import { Bar, Card, CardTitle, MoneyInput, Segmented, StatusPill, usd } from './journeyUi';

const TIER_CONFIG = {
  instant: { label: 'Instant Funded', defaultRule: 20 },
  elite: { label: 'Elite Funded', defaultRule: 25 },
};

interface ConsistencyGuardianProps {
  account: Account;
  actualDailyPnL: Record<string, number>;
  lastPayoutDate?: string | null;
  tradingDaysSincePayout?: number;
  /** Rule in effect on the Overview tab, so both tabs always agree. */
  rule?: number;
}

export const ConsistencyGuardian: React.FC<ConsistencyGuardianProps> = ({ account, actualDailyPnL, lastPayoutDate, tradingDaysSincePayout = 0, rule }) => {
  const { updateAccount } = useAccountStore();
  const [whatIf, setWhatIf] = useState(500);
  const [dailyRate, setDailyRate] = useState(300);
  const [showSettings, setShowSettings] = useState(false);
  const [showEducation, setShowEducation] = useState(false);

  const consistencyRule = rule ?? account.consistencyRulePercentage ?? 30;
  const originalTarget = account.originalProfitTarget || account.profitTarget || 3000;
  const accountTier = account.accountTier || 'instant';
  const profitTarget = account.profitTarget || 3000;

  // Core consistency calculations — same formulas as the Overview tab.
  const metrics = useMemo(() => {
    const dailyProfits = Object.values(actualDailyPnL);
    const highestDay = dailyProfits.length > 0 ? Math.max(0, ...dailyProfits) : 0;
    let highestDayDate = '';
    Object.entries(actualDailyPnL).forEach(([date, pnl]) => {
      if (pnl === highestDay) highestDayDate = date;
    });
    const currentTradingProfit = Math.max(0, dailyProfits.reduce((s, p) => s + p, 0));
    const currentTotalProfit = Math.max(0, account.balance);
    const currentConsistencyPercent = currentTradingProfit > 0 ? (highestDay / currentTradingProfit) * 100 : 0;
    const requiredProfitTarget = highestDay / (consistencyRule / 100);
    const effectiveTarget = Math.max(originalTarget, requiredProfitTarget);
    const gapToPayout = Math.max(0, effectiveTarget - currentTotalProfit);
    const isQualified = currentConsistencyPercent <= consistencyRule;
    const safeMaxToday = highestDay > 0 ? highestDay - 0.01 : currentTradingProfit * (consistencyRule / 100);
    return {
      currentTotalProfit,
      currentTradingProfit,
      highestDay,
      highestDayDate,
      currentConsistencyPercent,
      requiredProfitTarget,
      effectiveTarget,
      gapToPayout,
      isQualified,
      safeMaxToday,
      warningThreshold: highestDay * 0.8,
    };
  }, [actualDailyPnL, consistencyRule, originalTarget, account.balance]);

  // What-if: "if I make $X tomorrow…"
  const sim = useMemo(() => {
    const newTradingProfit = metrics.currentTradingProfit + whatIf;
    const newTotalProfit = metrics.currentTotalProfit + whatIf;
    const wouldBecomeHighestDay = whatIf > metrics.highestDay;
    const newHighestDay = wouldBecomeHighestDay ? whatIf : metrics.highestDay;
    const newConsistencyPercent = newTradingProfit > 0 ? (newHighestDay / newTradingProfit) * 100 : 0;
    const newConsistencyRequired = newHighestDay / (consistencyRule / 100);
    const consistencyRequiredIncreased = newConsistencyRequired > metrics.requiredProfitTarget;
    const newEffectiveTarget = Math.max(originalTarget, newConsistencyRequired);
    const wouldIncreaseTarget = newEffectiveTarget > metrics.effectiveTarget;
    const newBalance = account.balance + whatIf;
    const newBalanceTargetMet = newBalance >= profitTarget;
    const newConsistencyMet = newConsistencyPercent <= consistencyRule && newTradingProfit >= newConsistencyRequired;
    return {
      wouldBecomeHighestDay,
      newHighestDay,
      newConsistencyPercent,
      newConsistencyRequired,
      consistencyRequiredIncreased,
      newEffectiveTarget,
      wouldIncreaseTarget,
      newGapToPayout: Math.max(0, newEffectiveTarget - newTotalProfit),
      targetIncrease: wouldIncreaseTarget ? newEffectiveTarget - metrics.effectiveTarget : 0,
      newBalanceTargetMet,
      newBalanceGap: Math.max(0, profitTarget - newBalance),
      newConsistencyMet,
      newConsistencyGap: Math.max(0, newConsistencyRequired - newTradingProfit),
      newPayoutReady: newBalanceTargetMet && newConsistencyMet,
    };
  }, [whatIf, metrics, consistencyRule, originalTarget, account.balance, profitTarget]);

  const balanceTargetMet = account.balance >= profitTarget;
  const balanceGap = Math.max(0, profitTarget - account.balance);
  const consistencyMet = metrics.isQualified && metrics.currentTradingProfit >= metrics.requiredProfitTarget;
  const isPayoutReady = balanceTargetMet && consistencyMet;

  const usage = Math.min(100, (metrics.currentConsistencyPercent / consistencyRule) * 100);
  const gaugeColor = usage <= 70 ? '#00D68F' : usage <= 90 ? '#FFB800' : '#FF4868';

  const verdict = sim.wouldIncreaseTarget
    ? { tone: 'red' as const, icon: XCircle, text: `New best day — your payout target jumps by ${usd(sim.targetIncrease)}` }
    : sim.wouldBecomeHighestDay
      ? { tone: 'yellow' as const, icon: AlertTriangle, text: 'New best day — the consistency minimum goes up' }
      : whatIf > metrics.warningThreshold && metrics.highestDay > 0
        ? { tone: 'yellow' as const, icon: AlertTriangle, text: 'Close to your best day — consider stopping here' }
        : { tone: 'green' as const, icon: CheckCircle2, text: 'Safe — no impact on your consistency target' };

  const rateRisk = (rate: number) => {
    const ratio = rate / (metrics.highestDay || 1000);
    if (ratio <= 0.25) return { label: 'Safe', cls: 'text-tp-green bg-tp-green/10' };
    if (ratio <= 0.5) return { label: 'Moderate', cls: 'text-tp-blue bg-tp-blue/10' };
    if (ratio <= 0.75) return { label: 'Caution', cls: 'text-tp-yellow bg-tp-yellow/10' };
    if (ratio < 1) return { label: 'Risky', cls: 'text-orange-400 bg-orange-400/10' };
    return { label: 'Raises target', cls: 'text-tp-red bg-tp-red/10' };
  };
  const daysAt = (rate: number) => (metrics.gapToPayout > 0 ? Math.ceil(metrics.gapToPayout / rate) : 0);
  const sliderMax = Math.max(3000, Math.ceil((metrics.highestDay * 1.6) / 100) * 100);

  return (
    <div className="space-y-6">
      {/* Status strip */}
      <div className={clsx('flex flex-wrap items-center gap-4 rounded-2xl border p-4', isPayoutReady ? 'border-tp-green/25 bg-tp-green/[0.05]' : 'border-white/[0.07] bg-tp-card')}>
        <div className={clsx('grid h-10 w-10 place-items-center rounded-xl', isPayoutReady ? 'bg-tp-green/15' : 'bg-tp-yellow/10')}>
          <Shield className={clsx('h-5 w-5', isPayoutReady ? 'text-tp-green' : 'text-tp-yellow')} />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-zinc-50">{isPayoutReady ? 'Ready for payout' : 'Not payout-ready yet'}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
            <span>Balance: {balanceTargetMet ? <span className="text-tp-green">met</span> : `${usd(balanceGap)} to go`}</span>
            <span>Consistency: {consistencyMet ? <span className="text-tp-green">qualified</span> : 'not yet'}</span>
            {lastPayoutDate && (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3.5 w-3.5" /> reset {new Date(`${lastPayoutDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                {tradingDaysSincePayout} days since
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 hover:text-zinc-50"
        >
          <Settings2 className="h-4 w-4" /> {TIER_CONFIG[accountTier].label} · {consistencyRule}%
          <ChevronDown className={clsx('h-4 w-4 transition-transform', showSettings && 'rotate-180')} />
        </button>
        {showSettings && (
          <div className="grid w-full gap-4 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium text-zinc-300">Account tier</div>
              <Segmented
                value={accountTier}
                onChange={(tier) => updateAccount(account.id, { accountTier: tier, consistencyRulePercentage: TIER_CONFIG[tier].defaultRule })}
                options={(['instant', 'elite'] as const).map((t) => ({ value: t, label: `${TIER_CONFIG[t].label} (${TIER_CONFIG[t].defaultRule}%)` }))}
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-zinc-300">Original profit target</div>
              <MoneyInput value={originalTarget} onChange={(v) => updateAccount(account.id, { originalProfitTarget: v })} className="max-w-xs" />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gauge */}
        <Card className="lg:col-span-5">
          <CardTitle
            icon={Shield}
            title="Consistency score"
            subtitle="How big your best day is compared with all your profit."
            action={<StatusPill ok={metrics.isQualified} okLabel="Within limit" noLabel="Over limit" />}
          />
          <div className="relative mx-auto w-full max-w-[300px]">
            <svg viewBox="0 0 200 120" className="w-full">
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round" />
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="14"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${usage} 100`}
                className="transition-all duration-700"
              />
              <text x="20" y="116" fill="#71717a" fontSize="9" textAnchor="middle">0%</text>
              <text x="180" y="116" fill="#71717a" fontSize="9" textAnchor="middle">{consistencyRule}%</text>
            </svg>
            <div className="absolute inset-x-0 bottom-3 text-center">
              <div className="text-4xl font-semibold tabular-nums" style={{ color: gaugeColor }}>
                {metrics.currentConsistencyPercent.toFixed(1)}%
              </div>
              <div className="text-sm text-zinc-500">of a {consistencyRule}% limit</div>
            </div>
          </div>
          <p className="mt-4 text-center text-[15px] leading-relaxed text-zinc-300">
            Your best day{metrics.highestDayDate && ` (${new Date(`${metrics.highestDayDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`} is{' '}
            <strong className="text-zinc-50">{metrics.currentConsistencyPercent.toFixed(1)}%</strong> of your profit since payout.
          </p>
          <dl className="mt-5 divide-y divide-white/[0.05] text-sm">
            {[
              ['Profit since payout', usd(metrics.currentTradingProfit, true), 'text-tp-green'],
              ['Best day', usd(metrics.highestDay, true), 'text-tp-yellow'],
              ['Payout target (with rule)', usd(metrics.effectiveTarget, true), metrics.effectiveTarget > originalTarget ? 'text-tp-red' : 'text-zinc-100'],
              ['Gap to payout', usd(metrics.gapToPayout, true), 'text-zinc-100'],
            ].map(([k, v, cls]) => (
              <div key={k} className="flex justify-between py-2.5">
                <dt className="text-zinc-400">{k}</dt>
                <dd className={clsx('font-semibold tabular-nums', cls)}>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Tomorrow simulator */}
        <Card className="lg:col-span-7">
          <CardTitle icon={FlaskConical} title="Tomorrow simulator" subtitle="Drag to see what a day like that does to your payout." tone="blue" />

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[15px] text-zinc-300">If I make</span>
            <MoneyInput value={whatIf} onChange={setWhatIf} className="w-32" />
            <span className="text-[15px] text-zinc-300">tomorrow…</span>
          </div>
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={25}
            value={Math.min(whatIf, sliderMax)}
            onChange={(e) => setWhatIf(Number(e.target.value))}
            aria-label="Tomorrow's profit"
            className="mt-4 w-full accent-[#4F9CF9]"
          />
          <ZoneBar value={whatIf} max={sliderMax} warn={metrics.warningThreshold} best={metrics.highestDay} />

          <div
            className={clsx(
              'mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-[15px] font-semibold',
              verdict.tone === 'red' ? 'bg-tp-red/10 text-tp-red' : verdict.tone === 'yellow' ? 'bg-tp-yellow/10 text-tp-yellow' : 'bg-tp-green/10 text-tp-green',
            )}
          >
            <verdict.icon className="h-5 w-5 shrink-0" />
            {verdict.text}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="pb-2 font-medium"></th>
                  <th className="pb-2 text-right font-medium">Now</th>
                  <th className="pb-2 text-right font-medium">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                <SimRow label="Best day" now={usd(metrics.highestDay, true)} after={usd(sim.newHighestDay, true)} bad={sim.wouldBecomeHighestDay} />
                <SimRow
                  label="Best day share"
                  now={`${metrics.currentConsistencyPercent.toFixed(1)}%`}
                  after={`${sim.newConsistencyPercent.toFixed(1)}%`}
                  bad={sim.newConsistencyPercent > consistencyRule}
                />
                <SimRow label="Consistency minimum" now={usd(metrics.requiredProfitTarget, true)} after={usd(sim.newConsistencyRequired, true)} bad={sim.consistencyRequiredIncreased} />
                <SimRow label="Payout target" now={usd(metrics.effectiveTarget, true)} after={usd(sim.newEffectiveTarget, true)} bad={sim.wouldIncreaseTarget} />
                <SimRow label="Gap to payout" now={usd(metrics.gapToPayout, true)} after={usd(sim.newGapToPayout, true)} />
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-zinc-500">After that day:</span>
            <StatusPill ok={sim.newBalanceTargetMet} okLabel="Balance met" noLabel={`${usd(sim.newBalanceGap)} balance to go`} />
            <StatusPill ok={sim.newConsistencyMet} okLabel="Consistency met" noLabel={`${usd(sim.newConsistencyGap)} for consistency`} />
            {sim.newPayoutReady && <span className="font-semibold text-tp-green">→ payout-ready</span>}
          </div>
          {sim.consistencyRequiredIncreased && !sim.wouldIncreaseTarget && (
            <p className="mt-3 flex gap-2 text-sm text-zinc-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-tp-yellow" />
              The consistency minimum rises to {usd(sim.newConsistencyRequired)}, but your profit target ({usd(originalTarget)}) is still higher — so the payout
              target doesn’t move.
            </p>
          )}
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardTitle
          icon={BarChart3}
          title="Your days vs the rule"
          subtitle={`The dashed line is ${consistencyRule}% of your profit since payout. A green bar above it means one day is doing too much of the work.`}
        />
        <DailyChart daily={actualDailyPnL} cap={metrics.currentTradingProfit * (consistencyRule / 100)} best={metrics.highestDay} />
      </Card>

      {/* Path to payout */}
      <Card>
        <CardTitle icon={Route} title="Path to payout" subtitle="Pick a daily pace — see how long it takes and how risky that pace is against your best day." />
        <div className="mb-2 flex justify-between text-sm text-zinc-400">
          <span>{usd(metrics.currentTotalProfit)} now</span>
          <span>{usd(metrics.effectiveTarget)} payout target</span>
        </div>
        <div className="relative">
          <Bar value={(metrics.currentTotalProfit / Math.max(1, metrics.effectiveTarget)) * 100} tone="green" className="h-3" />
          {metrics.effectiveTarget > originalTarget && (
            <div className="absolute -top-1 h-5 w-0.5 bg-zinc-300" style={{ left: `${(originalTarget / metrics.effectiveTarget) * 100}%` }} title="Original target" />
          )}
        </div>
        {metrics.effectiveTarget > originalTarget && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-tp-yellow">
            <AlertTriangle className="h-3.5 w-3.5" /> Target raised from {usd(originalTarget)} by the consistency rule (white tick).
          </p>
        )}

        <div className="mt-6 grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300">Daily pace</span>
              <span className="font-semibold tabular-nums text-zinc-50">{usd(dailyRate)}/day</span>
            </div>
            <input
              type="range"
              min={50}
              max={1500}
              step={50}
              value={dailyRate}
              onChange={(e) => setDailyRate(Number(e.target.value))}
              aria-label="Daily pace"
              className="mt-2 w-full accent-[#00D68F]"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[100, 200, 300, 500, 750, 1000].map((r) => {
                const risk = rateRisk(r);
                return (
                  <button
                    key={r}
                    onClick={() => setDailyRate(r)}
                    className={clsx('rounded-lg px-2.5 py-1.5 text-xs font-medium tabular-nums', dailyRate === r ? 'bg-white/[0.12] text-zinc-50' : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-100')}
                  >
                    ${r} · {daysAt(r)}d · <span className={risk.cls.split(' ')[0]}>{risk.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-6 py-4 text-center">
            <div className="text-4xl font-semibold tabular-nums text-zinc-50">{daysAt(dailyRate)}</div>
            <div className="text-sm text-zinc-500">trading days</div>
            <span className={clsx('mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold', rateRisk(dailyRate).cls)}>{rateRisk(dailyRate).label}</span>
          </div>
        </div>
      </Card>

      {/* Education */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-tp-card">
        <button onClick={() => setShowEducation(!showEducation)} className="flex w-full items-center justify-between p-5 text-left hover:bg-white/[0.02]">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-zinc-100">
            <Info className="h-5 w-5 text-tp-blue" /> How the consistency rule works — with your numbers
          </span>
          <ChevronDown className={clsx('h-5 w-5 text-zinc-500 transition-transform', showEducation && 'rotate-180')} />
        </button>
        {showEducation && (
          <div className="space-y-5 border-t border-white/[0.06] p-5 text-[15px] leading-relaxed text-zinc-300">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-black/25 p-4 font-mono text-sm">
                <div className="text-zinc-500">Best day share</div>
                <div className="mt-1 text-zinc-100">
                  {usd(metrics.highestDay)} ÷ {usd(metrics.currentTradingProfit)} = <span style={{ color: gaugeColor }}>{metrics.currentConsistencyPercent.toFixed(1)}%</span>
                </div>
              </div>
              <div className="rounded-xl bg-black/25 p-4 font-mono text-sm">
                <div className="text-zinc-500">Minimum profit the rule needs</div>
                <div className="mt-1 text-zinc-100">
                  {usd(metrics.highestDay)} ÷ {consistencyRule}% = {usd(metrics.requiredProfitTarget)}
                </div>
              </div>
            </div>
            <p>
              No single day can be more than <strong className="text-zinc-50">{consistencyRule}%</strong> of your total profit. A huge day doesn’t fail you — it
              just raises how much total profit you need before a payout. That’s why the best play near payout is <em>smaller, steady days</em>.
            </p>
            <ul className="space-y-2">
              {[
                `Treat ${usd(metrics.safeMaxToday)} as your stop-at-profit for the day.`,
                'Keep size the same every day — consistency in size makes consistency in P&L.',
                'Close to payout? Protect it: fewer trades, same setup, no heroics.',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-tp-green" /> {t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};

// ─── Pieces ──────────────────────────────────────────────────────────────────

function SimRow({ label, now, after, bad }: { label: string; now: string; after: string; bad?: boolean }) {
  return (
    <tr>
      <td className="py-2 text-zinc-400">{label}</td>
      <td className="py-2 text-right tabular-nums text-zinc-300">{now}</td>
      <td className={clsx('py-2 text-right font-semibold tabular-nums', bad ? 'text-tp-red' : 'text-zinc-50')}>
        {after}
        {bad && ' ↑'}
      </td>
    </tr>
  );
}

/** Safe / warning / danger zones with a marker for the simulated day. */
function ZoneBar({ value, max, warn, best }: { value: number; max: number; warn: number; best: number }) {
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="mt-3">
      <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
        {best > 0 ? (
          <>
            <div className="absolute inset-y-0 left-0 bg-tp-green/60" style={{ width: pct(warn) }} />
            <div className="absolute inset-y-0 bg-tp-yellow/60" style={{ left: pct(warn), width: `calc(${pct(best)} - ${pct(warn)})` }} />
            <div className="absolute inset-y-0 right-0 bg-tp-red/50" style={{ left: pct(best) }} />
          </>
        ) : (
          <div className="absolute inset-0 bg-tp-green/50" />
        )}
      </div>
      <div className="relative h-8">
        <div className="absolute -top-5 -translate-x-1/2 transition-all" style={{ left: pct(value) }}>
          <div className="mx-auto h-7 w-1 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
        </div>
        {best > 0 && (
          <span className="absolute top-2 -translate-x-1/2 whitespace-nowrap text-xs text-zinc-500" style={{ left: pct(best) }}>
            best day {usd(best)}
          </span>
        )}
      </div>
      <div className="flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-tp-green" /> Safe</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-tp-yellow" /> Near best day</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-tp-red" /> Raises target</span>
      </div>
    </div>
  );
}

function DailyChart({ daily, cap, best }: { daily: Record<string, number>; cap: number; best: number }) {
  const rows = Object.entries(daily)
    .filter(([d]) => d !== 'unknown')
    .sort(([a], [b]) => a.localeCompare(b));
  if (!rows.length) return <p className="py-8 text-center text-sm text-zinc-500">No trading days since your last payout yet.</p>;

  const W = 800;
  const H = 220;
  const pad = { l: 8, r: 8, t: 16, b: 28 };
  const maxV = Math.max(cap, ...rows.map(([, v]) => v), 1);
  const minV = Math.min(0, ...rows.map(([, v]) => v));
  const y = (v: number) => pad.t + ((maxV - v) / (maxV - minV)) * (H - pad.t - pad.b);
  const slot = (W - pad.l - pad.r) / rows.length;
  const bw = Math.min(36, slot * 0.7);
  const over = rows.filter(([, v]) => v > cap).length;

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label="Daily profit and loss since payout">
          <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.12)" />
          {rows.map(([d, v], i) => {
            const x = pad.l + i * slot + (slot - bw) / 2;
            const color = v === best && v > 0 ? '#FFB800' : v > cap ? '#FF4868' : v >= 0 ? '#00D68F' : '#FF4868';
            const top = Math.min(y(v), y(0));
            return (
              <g key={d}>
                <rect x={x} y={top} width={bw} height={Math.max(2, Math.abs(y(v) - y(0)))} rx="3" fill={color} fillOpacity={v < 0 ? 0.45 : 0.85}>
                  <title>{`${d}: ${usd(v, true)}`}</title>
                </rect>
                {rows.length <= 24 && (
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#71717a">
                    {new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                  </text>
                )}
              </g>
            );
          })}
          {cap > 0 && (
            <>
              <line x1={pad.l} x2={W - pad.r} y1={y(cap)} y2={y(cap)} stroke="#e4e9f0" strokeDasharray="6 5" strokeOpacity=".7" />
              <text x={W - pad.r} y={y(cap) - 6} textAnchor="end" fontSize="11" fill="#e4e9f0">
                max per day {usd(cap)}
              </text>
            </>
          )}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-tp-green" /> Within the rule</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-tp-yellow" /> Best day</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-tp-red" /> Over the line / red day</span>
        <span className="ml-auto text-zinc-400">
          {over === 0 ? 'Every day is within the rule.' : `${over} day${over === 1 ? '' : 's'} above the line.`}
        </span>
      </div>
    </div>
  );
}
