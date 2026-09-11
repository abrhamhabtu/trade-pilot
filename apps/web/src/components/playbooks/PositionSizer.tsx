'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Calculator, Crosshair, Flag, Info, Target } from 'lucide-react';
import { FUTURES, sizePosition, specFor } from '@/lib/futuresSpecs';

const RISK_PRESETS = [100, 200, 250, 500];
const STORE_KEY = 'tp_sizer_v1';

type Saved = { symbol?: string; risk?: number; target?: number; drawdown?: number; stops?: Record<string, number> };

function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function save(patch: Saved) {
  try {
    const prev = load();
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...prev, ...patch, stops: { ...prev.stops, ...patch.stops } }));
  } catch {
    /* per-viewer convenience only */
  }
}

const usd = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 ? 2 : 0 });

/**
 * Contracts-per-trade calculator for micros. Pure maths on the trader's own
 * inputs — it never places or suggests trades.
 */
export function PositionSizer({
  strategyId = 'general',
  defaultSymbol = 'MNQ',
  defaultStop = 10,
  defaultR = 2,
  note,
  evalTarget,
  targetLabel = 'Profit target',
}: {
  strategyId?: string;
  defaultSymbol?: string;
  defaultStop?: number;
  defaultR?: number;
  note?: string;
  /** Prefill the eval-maths target (e.g. profit still needed on Journey). */
  evalTarget?: number;
  targetLabel?: string;
}) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [risk, setRisk] = useState(200);
  const [stop, setStop] = useState(defaultStop);
  const [targetR, setTargetR] = useState(defaultR);
  const [target, setTarget] = useState(evalTarget ?? 3000);
  const [drawdown, setDrawdown] = useState(2000);

  useEffect(() => {
    const s = load();
    if (s.symbol) setSymbol(s.symbol);
    if (s.risk) setRisk(s.risk);
    if (s.target && evalTarget === undefined) setTarget(s.target);
    if (s.drawdown) setDrawdown(s.drawdown);
    if (s.stops?.[strategyId]) setStop(s.stops[strategyId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyId]);

  const spec = specFor(symbol);
  const r = sizePosition({ spec, riskDollars: risk, stopPoints: stop, targetR });
  const winsToPass = r.targetDollars > 0 ? Math.ceil(target / r.targetDollars) : null;
  const lossesToFail = r.actualRisk > 0 ? Math.floor(drawdown / r.actualRisk) : null;
  const tooWide = stop > 0 && r.contracts === 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      {/* Inputs */}
      <div className="space-y-5">
        <Field label="Contract">
          <div className="flex flex-wrap gap-1.5">
            {FUTURES.map((f) => (
              <button
                key={f.symbol}
                type="button"
                onClick={() => {
                  setSymbol(f.symbol);
                  save({ symbol: f.symbol });
                }}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  symbol === f.symbol
                    ? 'bg-tp-green text-[#0D1628]'
                    : f.micro
                      ? 'bg-white/[0.05] text-zinc-200 hover:bg-white/[0.09]'
                      : 'bg-white/[0.02] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300',
                )}
              >
                {f.symbol}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            {spec.name} · {usd(r.pv)} per point · {usd(spec.tickValue)} per tick ({spec.tick} pts)
          </p>
        </Field>

        <Field label="Max $ you'll lose on this trade">
          <div className="flex flex-wrap items-center gap-2">
            <NumberInput value={risk} prefix="$" onChange={(v) => { setRisk(v); save({ risk: v }); }} />
            {RISK_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setRisk(p); save({ risk: p }); }}
                className={clsx(
                  'rounded-lg px-2.5 py-1.5 text-sm tabular-nums',
                  risk === p ? 'bg-white/[0.1] text-zinc-50' : 'text-zinc-400 hover:bg-white/[0.05]',
                )}
              >
                ${p}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Stop distance (points)">
            <NumberInput
              value={stop}
              step={spec.tick}
              onChange={(v) => { setStop(v); save({ stops: { [strategyId]: v } }); }}
            />
          </Field>
          <Field label="Target (R multiple)">
            <NumberInput value={targetR} step={0.5} suffix="R" onChange={setTargetR} />
          </Field>
        </div>
        {note && (
          <p className="flex items-start gap-2 text-sm text-zinc-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-tp-blue" />
            {note}
          </p>
        )}
      </div>

      {/* Result */}
      <div className="flex flex-col gap-4">
        <div
          className={clsx(
            'rounded-2xl border p-5',
            tooWide ? 'border-tp-red/30 bg-tp-red/[0.06]' : 'border-tp-green/25 bg-tp-green/[0.06]',
          )}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Trade size</div>
          {tooWide ? (
            <>
              <div className="mt-1 text-3xl font-semibold text-tp-red">0 contracts</div>
              <p className="mt-2 text-sm text-zinc-300">
                One {spec.symbol} with a {stop}-pt stop risks {usd(r.riskPerContract)} — more than your {usd(risk)} limit.
                Tighten the stop, switch to a smaller contract, or skip the trade.
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums text-zinc-50">{r.contracts}</span>
                <span className="text-lg text-zinc-300">{spec.symbol} contract{r.contracts === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Stat icon={Crosshair} label="Real risk" value={`-${usd(r.actualRisk)}`} tone="red" />
                <Stat icon={Target} label={`Target (${targetR}R)`} value={`+${usd(r.targetDollars)}`} tone="green" />
              </div>
            </>
          )}
        </div>

        {/* TradingView bracket */}
        <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Calculator className="h-3.5 w-3.5" />
            Type this into TradingView
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Bracket label="Quantity" value={String(r.contracts)} />
            <Bracket label="Stop loss" value={`${r.stopTicks} ticks`} sub={`${stop} pts`} tone="red" />
            <Bracket label="Take profit" value={`${r.targetTicks} ticks`} sub={`${+r.targetPoints.toFixed(2)} pts`} tone="green" />
          </div>
        </div>

        {/* Eval math */}
        <div className="rounded-2xl border border-white/[0.07] bg-tp-card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Flag className="h-3.5 w-3.5" />
            Prop eval maths
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm text-zinc-400">
              {targetLabel}
              <NumberInput value={target} prefix="$" onChange={(v) => { setTarget(v); if (evalTarget === undefined) save({ target: v }); }} />
            </label>
            <label className="text-sm text-zinc-400">
              Max drawdown
              <NumberInput value={drawdown} prefix="$" onChange={(v) => { setDrawdown(v); save({ drawdown: v }); }} />
            </label>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
            {winsToPass && lossesToFail !== null ? (
              <>
                At this size you need about <strong className="text-tp-green">{winsToPass} full winners</strong> to pass,
                and <strong className="text-tp-red">{lossesToFail} straight losses</strong> would hit the drawdown.
              </>
            ) : (
              'Enter a stop and risk to see how many trades it takes.'
            )}
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          Maths only — check your firm&apos;s contract limits and trailing-drawdown rules. Slippage and fees are not included.
        </p>
      </div>
    </div>
  );
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="mb-2 text-sm font-medium text-zinc-300">{label}</div>
    {children}
  </div>
);

function NumberInput({
  value,
  onChange,
  step = 1,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="mt-1 flex items-center rounded-xl bg-black/25 px-3 ring-1 ring-inset ring-white/[0.09] focus-within:ring-tp-green/40">
      {prefix && <span className="text-zinc-500">{prefix}</span>}
      <input
        type="number"
        min={0}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-full min-w-0 bg-transparent py-2 pl-1 text-base tabular-nums text-zinc-50 focus:outline-none"
      />
      {suffix && <span className="text-zinc-500">{suffix}</span>}
    </div>
  );
}

const Stat: React.FC<{ icon: typeof Target; label: string; value: string; tone: 'red' | 'green' }> = ({ icon: Icon, label, value, tone }) => (
  <div className="rounded-xl bg-black/20 px-3 py-2">
    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className={clsx('mt-0.5 text-lg font-semibold tabular-nums', tone === 'red' ? 'text-tp-red' : 'text-tp-green')}>{value}</div>
  </div>
);

const Bracket: React.FC<{ label: string; value: string; sub?: string; tone?: 'red' | 'green' }> = ({ label, value, sub, tone }) => (
  <div>
    <div className="text-xs text-zinc-500">{label}</div>
    <div
      className={clsx(
        'mt-0.5 text-lg font-semibold tabular-nums',
        tone === 'red' ? 'text-tp-red' : tone === 'green' ? 'text-tp-green' : 'text-zinc-50',
      )}
    >
      {value}
    </div>
    {sub && <div className="text-xs tabular-nums text-zinc-500">{sub}</div>}
  </div>
);
