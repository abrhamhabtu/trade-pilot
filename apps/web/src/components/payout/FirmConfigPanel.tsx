'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Building2, ChevronDown, ShieldCheck, ShieldAlert, ExternalLink, Settings2 } from 'lucide-react';
import { PROP_FIRMS, PropFirm, FirmAccountTier } from './propFirmData';
import { useThemeClasses, SectionHeader, NumberInput } from './payoutPrimitives';

export interface FirmConfigValues {
  profitTarget: number;
  drawdown: number;
  consistencyPercent: number;
  profitSplit: number;
  keep100Upto: number;
  cost: number;
  dailyLossLimit: number | null;
}

interface FirmConfigPanelProps {
  firm: PropFirm;
  tier: FirmAccountTier;
  values: FirmConfigValues;
  onFirmChange: (firmId: string) => void;
  onTierChange: (tierId: string) => void;
  onValueChange: (patch: Partial<FirmConfigValues>) => void;
}

export const FirmConfigPanel: React.FC<FirmConfigPanelProps> = ({
  firm,
  tier,
  values,
  onFirmChange,
  onTierChange,
  onValueChange,
}) => {
  const { card, inset, muted, dark } = useThemeClasses();
  const [firmOpen, setFirmOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);

  return (
    <div className={clsx(card, 'p-5 sm:p-6')}>
      <SectionHeader
        icon={<Building2 className="h-4 w-4 text-tp-green" />}
        title="Prop firm & account"
        subtitle="Pick the firm and size. Rules are seeded from real specs — edit anything to match your exact account."
        action={
          firm.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-tp-green/10 px-2.5 py-1 text-[10px] font-semibold text-tp-green">
              <ShieldCheck className="h-3 w-3" /> Verified {firm.rulesUpdated}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-tp-yellow/10 px-2.5 py-1 text-[10px] font-semibold text-tp-yellow">
              <ShieldAlert className="h-3 w-3" /> Verify before buying
            </span>
          )
        }
      />

      {/* Firm dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setFirmOpen((o) => !o)}
          className={clsx(
            'flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm',
            dark ? 'border-white/[0.08] bg-tp-base text-zinc-100' : 'border-gray-200 bg-gray-50 text-gray-900'
          )}
        >
          <span className="truncate">
            {firm.name} <span className={muted}>· {firm.program}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
        {firmOpen && (
          <div
            className={clsx(
              'absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border shadow-xl',
              dark ? 'border-white/[0.08] bg-tp-raised' : 'border-gray-200 bg-white'
            )}
          >
            {PROP_FIRMS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onFirmChange(f.id);
                  setFirmOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-white/[0.04]',
                  f.id === firm.id && 'text-tp-green'
                )}
              >
                <span>
                  {f.name} <span className="opacity-60">· {f.program}</span>
                </span>
                {f.verified ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-tp-green/70" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 text-tp-yellow/70" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tier selector */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {firm.tiers.map((tr) => (
          <button
            key={tr.id}
            type="button"
            onClick={() => onTierChange(tr.id)}
            className={clsx(
              'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
              tr.id === tier.id
                ? 'border-tp-green/40 bg-tp-green/15 text-tp-green'
                : dark
                  ? 'border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
            )}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {/* Key facts */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Consistency" value={`${values.consistencyPercent}%`} sub={firm.consistencyBasis === 'totalProfit' ? 'of total profit' : 'of target'} />
        <Fact label="Profit split" value={`${values.profitSplit}%`} sub={values.keep100Upto > 0 ? `100% to $${(values.keep100Upto / 1000).toFixed(0)}K` : 'on every payout'} />
        <Fact label="Drawdown" value={`$${values.drawdown.toLocaleString()}`} sub={firm.drawdownType.replace('-', ' ')} />
        <Fact label="Min days" value={`${firm.minTradingDays}`} sub="before payout" />
      </div>

      <p className={clsx('mt-4 text-xs leading-relaxed', muted)}>
        <span className="font-medium">{firm.drawdownType.replace('-', ' ')}:</span> {firm.drawdownNote}
      </p>

      {/* Notes + source */}
      <div className={clsx(inset, 'mt-3 p-3')}>
        <p className={clsx('text-xs leading-relaxed', dark ? 'text-zinc-400' : 'text-gray-600')}>{firm.notes}</p>
        {firm.sourceUrl && (
          <a
            href={firm.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-tp-blue hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Official rules
          </a>
        )}
      </div>

      {/* Editable rules */}
      <button
        type="button"
        onClick={() => setShowRules((s) => !s)}
        className={clsx('mt-4 flex w-full items-center gap-2 text-sm font-medium', muted)}
      >
        <Settings2 className="h-4 w-4" />
        Override rules
        <ChevronDown className={clsx('ml-auto h-4 w-4 transition-transform', showRules && 'rotate-180')} />
      </button>

      {showRules && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
          <NumberInput label="Profit target" prefix="$" value={values.profitTarget} onChange={(v) => onValueChange({ profitTarget: Number(v) || 0 })} />
          <NumberInput label="Drawdown" prefix="$" value={values.drawdown} onChange={(v) => onValueChange({ drawdown: Number(v) || 0 })} />
          <NumberInput label="Consistency %" suffix="%" value={values.consistencyPercent} onChange={(v) => onValueChange({ consistencyPercent: Number(v) || 0 })} />
          <NumberInput label="Profit split %" suffix="%" value={values.profitSplit} onChange={(v) => onValueChange({ profitSplit: Number(v) || 0 })} />
          <NumberInput label="100% up to" prefix="$" value={values.keep100Upto} onChange={(v) => onValueChange({ keep100Upto: Number(v) || 0 })} />
          <NumberInput label="Account cost" prefix="$" value={values.cost} onChange={(v) => onValueChange({ cost: Number(v) || 0 })} />
        </div>
      )}
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => {
  const { text, muted, inset, dark } = useThemeClasses();
  return (
    <div className={clsx(inset, 'p-3')}>
      <div className={clsx('text-[10px] font-medium uppercase tracking-wide', muted)}>{label}</div>
      <div className={clsx('mt-0.5 text-base font-bold', text)}>{value}</div>
      {sub && <div className={clsx('text-[10px]', dark ? 'text-zinc-600' : 'text-gray-400')}>{sub}</div>}
    </div>
  );
};
