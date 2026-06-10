'use client';

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Swords, Repeat, Zap, TrendingDown, CheckCircle2 } from 'lucide-react';
import { PROP_FIRMS, getFirmById } from './propFirmData';
import { formatCurrency } from './payoutMath';
import { useThemeClasses, SectionHeader, SliderField, NumberInput, MiniStat, PillToggle } from './payoutPrimitives';

const EVAL_FIRMS = PROP_FIRMS.filter((f) => f.payoutModel === 'eval' && f.id !== 'custom');
const FUNDED_FIRMS = PROP_FIRMS.filter((f) => f.payoutModel === 'instant');

const DEFAULT_EVAL = EVAL_FIRMS.find((f) => f.id === 'lucid-pro') ?? EVAL_FIRMS[0];
const DEFAULT_FUNDED = FUNDED_FIRMS.find((f) => f.id === 'lucid-direct') ?? FUNDED_FIRMS[0];

export const EvalVsFunded: React.FC = () => {
  const { card, inset, text, muted, dark } = useThemeClasses();

  const [evalId, setEvalId] = useState(DEFAULT_EVAL.id);
  const [evalTierIdx, setEvalTierIdx] = useState(0);
  const [fundedId, setFundedId] = useState(DEFAULT_FUNDED.id);
  const [fundedTierIdx, setFundedTierIdx] = useState(0);

  const evalFirm = getFirmById(evalId);
  const fundedFirm = getFirmById(fundedId);
  const evalTier = evalFirm.tiers[Math.min(evalTierIdx, evalFirm.tiers.length - 1)];
  const fundedTier = fundedFirm.tiers[Math.min(fundedTierIdx, fundedFirm.tiers.length - 1)];

  const [evalFee, setEvalFee] = useState(evalTier.cost);
  const [fundedFee, setFundedFee] = useState(fundedTier.cost);
  const [evalsToRun, setEvalsToRun] = useState(4);
  const [passRate, setPassRate] = useState(50);
  const [daysToPass, setDaysToPass] = useState(4);

  // Re-seed fees when program/tier changes.
  useEffect(() => setEvalFee(evalTier.cost), [evalTier.cost]);
  useEffect(() => setFundedFee(fundedTier.cost), [fundedTier.cost]);

  const m = useMemo(() => {
    const p = Math.min(Math.max(passRate, 1), 99) / 100;
    const N = Math.max(1, evalsToRun);
    const passes = Math.round(N * p);
    const fails = N - passes;
    const evalBatchCost = N * evalFee;
    const sunkOnFails = fails * evalFee;
    // Long-run cost to actually land one funded account via the eval grind.
    const evalCostPerFunded = p > 0 ? evalFee / p : Infinity;
    // Straight-to-funded buys the same number of funded outright.
    const matchFunded = Math.max(1, passes);
    const fundedRouteCost = matchFunded * fundedFee;
    // Break-even: above this pass rate, grinding evals is cheaper per funded.
    const breakEvenP = fundedFee > 0 ? Math.min(1, evalFee / fundedFee) : 1;
    const evalCheaper = evalCostPerFunded < fundedFee;
    const savingsPerFunded = fundedFee - evalCostPerFunded;
    return {
      p,
      N,
      passes,
      fails,
      evalBatchCost,
      sunkOnFails,
      evalCostPerFunded,
      matchFunded,
      fundedRouteCost,
      breakEvenP,
      evalCheaper,
      savingsPerFunded,
    };
  }, [passRate, evalsToRun, evalFee, fundedFee]);

  // Cost-per-funded comparison bar scaling.
  const maxCPF = Math.max(m.evalCostPerFunded === Infinity ? fundedFee : m.evalCostPerFunded, fundedFee, 1);

  const cells = Array.from({ length: Math.min(m.N, 30) }, (_, i) => (i < m.passes ? 'pass' : 'fail'));

  return (
    <div className={clsx(card, 'p-6 sm:p-8')}>
      <SectionHeader
        icon={<Swords className="h-4 w-4 text-tp-blue" />}
        title="Eval grind vs. straight-to-funded"
        subtitle="Evals are cheap to retry, so it can pay to buy several, push hard, and pass fast. This shows whether that gamble beats just buying funded — and the pass rate where the math flips."
      />

      {/* Pickers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={clsx(inset, 'p-4')}>
          <div className="mb-2 flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-tp-green" />
            <span className={clsx('text-xs font-semibold uppercase tracking-wide', muted)}>Eval program</span>
          </div>
          <select
            value={evalId}
            onChange={(e) => {
              setEvalId(e.target.value);
              setEvalTierIdx(0);
            }}
            className={selectCls(dark)}
          >
            {EVAL_FIRMS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.program}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {evalFirm.tiers.map((tr, i) => (
              <button key={tr.id} type="button" onClick={() => setEvalTierIdx(i)} className={tierCls(i === evalTierIdx, dark, 'green')}>
                {tr.label}
              </button>
            ))}
          </div>
          <div className="mt-3 w-32">
            <NumberInput label="Fee each / mo" prefix="$" value={evalFee} min={0} step={5} onChange={(v) => setEvalFee(Number(v) || 0)} />
          </div>
        </div>

        <div className={clsx(inset, 'p-4')}>
          <div className="mb-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-tp-blue" />
            <span className={clsx('text-xs font-semibold uppercase tracking-wide', muted)}>Straight-to-funded</span>
          </div>
          <select
            value={fundedId}
            onChange={(e) => {
              setFundedId(e.target.value);
              setFundedTierIdx(0);
            }}
            className={selectCls(dark)}
          >
            {FUNDED_FIRMS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.program}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {fundedFirm.tiers.map((tr, i) => (
              <button key={tr.id} type="button" onClick={() => setFundedTierIdx(i)} className={tierCls(i === fundedTierIdx, dark, 'blue')}>
                {tr.label}
              </button>
            ))}
          </div>
          <div className="mt-3 w-32">
            <NumberInput label="Price each (1×)" prefix="$" value={fundedFee} min={0} step={5} onChange={(v) => setFundedFee(Number(v) || 0)} />
          </div>
        </div>
      </div>

      {/* Plan sliders */}
      <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-3">
        <SliderField label="Evals you'll run" tip="How many eval accounts you buy in one push." value={evalsToRun} min={1} max={10} step={1} format={(v) => `${v}`} onChange={setEvalsToRun} />
        <SliderField label="Your pass rate" tip="How often you actually pass when pushing for a fast finish. Aggressive sizing usually lowers this." value={passRate} min={10} max={90} step={5} format={(v) => `${v}%`} onChange={setPassRate} />
        <SliderField label="Days to pass" tip="Target days to clear each eval on an aggressive push." value={daysToPass} min={1} max={15} step={1} format={(v) => `${v}d`} onChange={setDaysToPass} />
      </div>

      {/* Expected outcome of the eval batch */}
      <div className={clsx(inset, 'mt-6 p-4')}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className={clsx('text-xs font-semibold uppercase tracking-wide', muted)}>
            Run {m.N} evals at {passRate}% — expected outcome
          </span>
          <span className={clsx('text-xs', muted)}>
            ≈ <span className="font-semibold text-tp-green">{m.passes} pass</span> · <span className="font-semibold text-tp-red">{m.fails} fail</span> in ~{daysToPass} days
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cells.map((c, i) => (
            <div
              key={i}
              className={clsx(
                'flex h-9 w-9 items-center justify-center rounded-lg border text-[10px] font-bold',
                c === 'pass' ? 'border-tp-green/30 bg-tp-green/15 text-tp-green' : 'border-tp-red/25 bg-tp-red/10 text-tp-red'
              )}
            >
              {c === 'pass' ? '✓' : '✕'}
            </div>
          ))}
        </div>
      </div>

      {/* Route comparison */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <RouteCard
          tone="green"
          title="Eval grind"
          headline={formatCurrency(m.evalBatchCost)}
          headlineSub={`for ${m.N} evals → ≈${m.passes} funded`}
          dark={dark}
          rows={[
            ['Cost per funded (long run)', m.evalCostPerFunded === Infinity ? '—' : formatCurrency(m.evalCostPerFunded)],
            ['Sunk on the fails', formatCurrency(m.sunkOnFails)],
            ['Time to funded', `~${daysToPass} days`],
          ]}
        />
        <RouteCard
          tone="blue"
          title="Straight to funded"
          headline={formatCurrency(m.fundedRouteCost)}
          headlineSub={`for ${m.matchFunded} funded, guaranteed`}
          dark={dark}
          rows={[
            ['Cost per funded', formatCurrency(fundedFee)],
            ['Sunk on the fails', formatCurrency(0)],
            ['Time to funded', 'Day one'],
          ]}
        />
      </div>

      {/* Cost-per-funded comparison */}
      <div className={clsx(inset, 'mt-5 p-4')}>
        <span className={clsx('text-xs font-semibold uppercase tracking-wide', muted)}>Cost per funded account</span>
        <div className="mt-3 space-y-3">
          <CompareBar label="Eval grind" value={m.evalCostPerFunded === Infinity ? fundedFee : m.evalCostPerFunded} max={maxCPF} color="#30B886" best={m.evalCheaper} muted={muted} text={text} />
          <CompareBar label="Straight to funded" value={fundedFee} max={maxCPF} color="#6E9BD1" best={!m.evalCheaper} muted={muted} text={text} />
        </div>
      </div>

      {/* Verdict */}
      <div
        className={clsx(
          'mt-5 flex items-start gap-3 rounded-xl border p-4',
          m.evalCheaper ? (dark ? 'border-tp-green/25 bg-tp-green/[0.06]' : 'border-green-200 bg-green-50') : (dark ? 'border-tp-blue/25 bg-tp-blue/[0.06]' : 'border-blue-200 bg-blue-50')
        )}
      >
        <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', m.evalCheaper ? 'bg-tp-green/15' : 'bg-tp-blue/15')}>
          {m.evalCheaper ? <CheckCircle2 className="h-4 w-4 text-tp-green" /> : <TrendingDown className="h-4 w-4 text-tp-blue" />}
        </span>
        <div>
          <p className={clsx('text-sm font-semibold', text)}>
            {m.evalCheaper
              ? `Grind the evals — you're above the break-even pass rate.`
              : `Buy funded — your pass rate is too low to make the grind worth it.`}
          </p>
          <p className={clsx('mt-1 text-xs leading-relaxed', muted)}>
            Break-even is a <span className="font-semibold text-tp-yellow">{Math.round(m.breakEvenP * 100)}%</span> pass rate (eval fee ÷ funded price). You&apos;re at{' '}
            <span className={clsx('font-semibold', m.evalCheaper ? 'text-tp-green' : 'text-tp-red')}>{passRate}%</span>.{' '}
            {m.evalCheaper
              ? `Each funded account costs ~${formatCurrency(Math.max(0, m.savingsPerFunded))} less via evals than buying it outright.`
              : `Below ${Math.round(m.breakEvenP * 100)}%, the failed evals cost more than just paying for funded. Either tighten up to lift your pass rate, or buy funded.`}
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Bits ────────────────────────────────────────────────────────────────────

const selectCls = (dark: boolean) =>
  clsx('w-full rounded-lg border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-tp-green/40', dark ? 'border-white/[0.08] bg-tp-base text-zinc-100' : 'border-gray-200 bg-gray-50 text-gray-900');

const tierCls = (active: boolean, dark: boolean, accent: 'green' | 'blue') =>
  clsx(
    'rounded-md border px-2 py-1 text-xs font-bold transition-colors',
    active
      ? accent === 'green'
        ? 'border-tp-green/40 bg-tp-green/15 text-tp-green'
        : 'border-tp-blue/40 bg-tp-blue/15 text-tp-blue'
      : dark
        ? 'border-white/[0.08] text-zinc-400 hover:text-zinc-200'
        : 'border-gray-200 text-gray-600 hover:border-gray-300'
  );

const RouteCard: React.FC<{
  tone: 'green' | 'blue';
  title: string;
  headline: string;
  headlineSub: string;
  rows: [string, string][];
  dark: boolean;
}> = ({ tone, title, headline, headlineSub, rows, dark }) => {
  const { text, muted } = useThemeClasses();
  return (
    <div className={clsx('rounded-2xl border p-5', dark ? 'border-white/[0.06] bg-tp-base/40' : 'border-gray-100 bg-gray-50')}>
      <span className={clsx('text-xs font-semibold uppercase tracking-wide', tone === 'green' ? 'text-tp-green' : 'text-tp-blue')}>{title}</span>
      <p className={clsx('mt-1 text-3xl font-bold tracking-tight', text)}>{headline}</p>
      <p className={clsx('text-xs', muted)}>{headlineSub}</p>
      <div className="mt-3 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className={muted}>{k}</span>
            <span className={clsx('font-medium', text)}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CompareBar: React.FC<{ label: string; value: number; max: number; color: string; best: boolean; muted: string; text: string }> = ({
  label,
  value,
  max,
  color,
  best,
  muted,
  text,
}) => (
  <div>
    <div className="mb-1 flex items-center justify-between text-xs">
      <span className={clsx('inline-flex items-center gap-1.5', muted)}>
        {label}
        {best && <span className="rounded-full bg-tp-green/15 px-1.5 py-0.5 text-[10px] font-bold text-tp-green">CHEAPER</span>}
      </span>
      <span className={clsx('font-semibold', text)}>{formatCurrency(value)}/funded</span>
    </div>
    <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full" style={{ width: `${Math.max(3, (value / max) * 100)}%`, background: color }} />
    </div>
  </div>
);
