'use client';

import React from 'react';
import clsx from 'clsx';
import { Layers, Copy } from 'lucide-react';
import { useThemeClasses, SectionHeader, NumberInput, PillToggle } from './payoutPrimitives';
import { scaleAccounts, formatCurrency, PathProjection } from './payoutMath';

interface AccountScalerProps {
  pullTarget: number;
  onPullTargetChange: (v: number) => void;
  costPerAccount: number;
  onCostChange: (v: number) => void;
  profitSplit: number;
  keep100Upto: number;
  /** Whether the sticker cost recurs monthly or is a one-time fee. */
  costCadence: 'monthly' | 'one-time';
  /** Estimated months to pass/clear one account (for monthly all-in cost). */
  monthsToPass: number;
  /** Highlighted account count (also editable). */
  focusCount: number;
  onFocusCountChange: (n: number) => void;
  /** Single-account projection used to show time-to-pull. */
  projection: PathProjection;
}

const PRESET_COUNTS = [1, 3, 5, 10];

export const AccountScaler: React.FC<AccountScalerProps> = ({
  pullTarget,
  onPullTargetChange,
  costPerAccount,
  onCostChange,
  profitSplit,
  keep100Upto,
  costCadence,
  monthsToPass,
  focusCount,
  onFocusCountChange,
  projection,
}) => {
  const { card, inset, text, muted, dark } = useThemeClasses();

  // Monthly evals keep charging until you pass — the true cost per account is the
  // sticker × the months it takes to clear. One-time/instant fees are paid once.
  const months = costCadence === 'monthly' ? Math.max(1, monthsToPass) : 1;
  const effectiveCost = costCadence === 'monthly' ? costPerAccount * months : costPerAccount;

  const counts = Array.from(new Set([...PRESET_COUNTS, focusCount])).sort((a, b) => a - b);
  const rows = scaleAccounts({ counts, pullTarget, profitSplit, keep100Upto, costPerAccount: effectiveCost });
  const focusRow = rows.find((r) => r.accounts === focusCount) ?? rows[0];

  const viable = projection.expectedDailyPnL > 0 && !projection.blownAccount;

  return (
    <div className={clsx(card, 'p-6 sm:p-8')}>
      <SectionHeader
        icon={<Layers className="h-4 w-4 text-tp-blue" />}
        title="Scale your accounts"
        subtitle="Copy-trade the same plan across multiple accounts. See exactly what it costs and what you could pull."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <label className={clsx('mb-1.5 block text-xs font-medium uppercase tracking-wide', muted)}>
            Accounts (eval or funded)
          </label>
          <PillToggle
            options={PRESET_COUNTS.map((n) => ({ value: n, label: String(n) }))}
            value={focusCount}
            onChange={(v) => onFocusCountChange(Number(v))}
            accent="blue"
          />
          <div className="mt-2">
            <NumberInput value={focusCount} min={1} max={50} step={1} onChange={(v) => onFocusCountChange(Number(v) || 1)} large />
          </div>
        </div>
        <NumberInput label="Pull target (each)" prefix="$" value={pullTarget} min={500} step={100} onChange={(v) => onPullTargetChange(Number(v) || 0)} large />
        <div>
          <NumberInput
            label={costCadence === 'monthly' ? 'Cost per account / mo' : 'Cost per account (one-time)'}
            prefix="$"
            value={costPerAccount}
            min={0}
            step={5}
            onChange={(v) => onCostChange(Number(v) || 0)}
            large
          />
          <p className={clsx('mt-1.5 text-[11px] leading-snug', muted)}>
            {costCadence === 'monthly' ? (
              <>Monthly eval — billed until you pass. ~{months} mo to clear → <span className="font-semibold text-tp-red">{formatCurrency(effectiveCost)}</span> all-in each.</>
            ) : (
              <>One-time fee — paid once per account.</>
            )}
          </p>
        </div>
      </div>

      {!viable ? (
        <p className="mt-5 text-sm text-tp-red">
          {projection.expectedDailyPnL <= 0
            ? `Strategy lacks positive expectancy — scaling won't reliably reach ${formatCurrency(pullTarget)}.`
            : `Risk too high — a mirrored account breaches drawdown before reaching ${formatCurrency(pullTarget)}.`}
        </p>
      ) : (
        <>
          {/* Focus headline */}
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className={clsx(inset, 'p-4')}>
              <div className="flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-tp-blue" />
                <p className={clsx('text-sm font-medium', muted)}>
                  {focusCount} account{focusCount !== 1 ? 's' : ''} · pull {formatCurrency(pullTarget)} each
                </p>
              </div>
              <p className={clsx('mt-2 text-4xl font-bold tracking-tight', text)}>
                {formatCurrency(focusRow.netProfit)}
                <span className="ml-2 text-base font-semibold text-zinc-500">net profit</span>
              </p>
              <p className={clsx('mt-1 text-sm', muted)}>
                {formatCurrency(focusRow.grossPull)} gross − {formatCurrency(focusRow.totalCost)} cost ·{' '}
                <span className={focusRow.roiPercent >= 0 ? 'text-tp-green' : 'text-tp-red'}>
                  {focusRow.roiPercent >= 0 ? '+' : ''}
                  {focusRow.roiPercent.toFixed(0)}% ROI
                </span>
              </p>
            </div>
            <div className={clsx('rounded-xl border p-4', dark ? 'border-tp-green/25 bg-tp-green/5' : 'border-green-200 bg-green-50')}>
              <p className={clsx('text-xs font-medium uppercase tracking-wide', muted)}>Time per account</p>
              <p className="mt-1 text-3xl font-bold text-tp-green">~{projection.totalDays} days</p>
              <p className={clsx('mt-1 text-sm', muted)}>
                ~{projection.calendarWeeks} weeks · you keep {formatCurrency(focusRow.perAccountKeep)} each after split
              </p>
            </div>
          </div>

          {/* Comparison table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className={clsx('border-b text-left text-xs', dark ? 'border-white/[0.06] text-zinc-500' : 'border-gray-200 text-gray-500')}>
                  <th className="pb-2 pr-4 font-medium">Accounts</th>
                  <th className="pb-2 pr-4 font-medium">Total cost</th>
                  <th className="pb-2 pr-4 font-medium">Gross pull</th>
                  <th className="pb-2 pr-4 font-medium">Net profit</th>
                  <th className="pb-2 font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const focused = row.accounts === focusCount;
                  return (
                    <tr
                      key={row.accounts}
                      className={clsx(
                        'border-b last:border-0',
                        dark ? 'border-white/[0.04]' : 'border-gray-100',
                        focused && (dark ? 'bg-tp-blue/[0.06]' : 'bg-blue-50/60')
                      )}
                    >
                      <td className={clsx('py-2.5 pr-4 font-semibold', focused ? 'text-tp-blue' : text)}>
                        {row.accounts}
                      </td>
                      <td className={clsx('py-2.5 pr-4', muted)}>{formatCurrency(row.totalCost)}</td>
                      <td className={clsx('py-2.5 pr-4', text)}>{formatCurrency(row.grossPull)}</td>
                      <td className={clsx('py-2.5 pr-4 font-semibold', row.netProfit >= 0 ? 'text-tp-green' : 'text-tp-red')}>
                        {formatCurrency(row.netProfit)}
                      </td>
                      <td className={clsx('py-2.5 font-medium', row.roiPercent >= 0 ? 'text-tp-green' : 'text-tp-red')}>
                        {row.roiPercent >= 0 ? '+' : ''}
                        {row.roiPercent.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className={clsx('mt-4 text-xs leading-relaxed', muted)}>
            Assumes identical copy trades on fresh accounts, each hitting {formatCurrency(pullTarget)}. Profit split and any
            100%-up-to threshold are applied per account.{' '}
            {costCadence === 'monthly'
              ? `Monthly eval fees are counted for ~${months} month${months !== 1 ? 's' : ''} (your estimated time to pass) — the real drag on scaling many evals at once.`
              : 'One-time activation fees, paid once per account.'}
          </p>
        </>
      )}
    </div>
  );
};
