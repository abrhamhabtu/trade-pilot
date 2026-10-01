'use client';

import { FUTURES_ELITE_PLANS, FUTURES_ELITE_SOURCE, FUTURES_ELITE_CHECKED, futuresEliteSelection } from '@/lib/accountProviderPlans';
import { inputCls } from './accountUi';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function FuturesElitePlans({ planId, size, onChange }: {
  planId: string;
  size: number;
  onChange: (planId: string, size: number) => void;
}) {
  const selection = futuresEliteSelection(planId, size);
  return (
    <div className="space-y-3 rounded-xl bg-black/20 p-4 ring-1 ring-inset ring-white/[0.07]">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-300">Futures Elite program
          <select aria-label="Futures Elite program" className={`${inputCls} mt-1`} value={planId} onChange={(e) => onChange(e.target.value, size)}>
            <option value="">Choose later / custom</option>
            {FUTURES_ELITE_PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}{p.instant ? ' · Instant funded' : ' · Evaluation'}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-300">Account size
          <select aria-label="Futures Elite account size" disabled={!planId} className={`${inputCls} mt-1`} value={size} onChange={(e) => onChange(planId, Number(e.target.value))}>
            {[25000, 50000, 100000, 150000].map((s) => <option key={s} value={s}>${s / 1000}K</option>)}
          </select>
        </label>
      </div>
      {selection && <>
        <p className="text-xs leading-relaxed text-zinc-300">{selection.plan.summary}</p>
        <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
          <div><dt>One-time list price</dt><dd className="text-zinc-100">{usd(selection.tier.listPrice)}</dd></div>
          <div><dt>Observed promotional price</dt><dd className="text-zinc-100">{usd(selection.tier.promoPrice)}</dd></div>
          <div><dt>Evaluation profit target</dt><dd className="text-zinc-100">{selection.tier.target === null ? 'No evaluation' : usd(selection.tier.target)}</dd></div>
          <div><dt>Maximum loss limit</dt><dd className="text-zinc-100">{usd(selection.tier.maxLoss)}</dd></div>
          <div><dt>Daily loss limit</dt><dd className="text-zinc-100">{selection.tier.dailyLoss === null ? 'None by default' : usd(selection.tier.dailyLoss)}</dd></div>
          <div><dt>Initial funded payout cap</dt><dd className="text-zinc-100">{usd(selection.tier.payoutCap)}</dd></div>
        </dl>
      </>}
      <p className="text-[11px] leading-relaxed text-zinc-500">Checked {FUTURES_ELITE_CHECKED}. Promotions, optional rules and payout cycles change. This selection identifies your plan; confirm risk rules in account settings before using projections.</p>
      <a className="inline-block text-xs text-tp-green underline" href={FUTURES_ELITE_SOURCE} target="_blank" rel="noreferrer">Official pricing & options ↗</a>
    </div>
  );
}
