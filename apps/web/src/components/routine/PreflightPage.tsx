'use client';

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BatteryLow,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Gauge,
  Lock,
  Moon,
  Plus,
  ShieldCheck,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useRoutineStore, type TradingRule } from '@/store/routineStore';
import { useAccountStore } from '@/store/accountStore';
import { computeLiquidation } from '@/lib/liquidation';
import {
  evaluatePreflight,
  redDayStreak,
  type PreflightCondition,
  type PreflightVerdict,
} from '@/lib/preflight';

const today = () => new Date().toISOString().split('T')[0];
const money = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString()}`;

const DEFAULT_CONDITION: PreflightCondition = {
  sleep: 7,
  stress: 2,
  focus: 4,
  lifeNoise: false,
};

const STAGES = [
  { id: 'condition', label: 'Condition', icon: Gauge },
  { id: 'market', label: 'Market', icon: Target },
  { id: 'limits', label: 'Limits', icon: ShieldCheck },
  { id: 'rules', label: 'Rules', icon: Check },
  { id: 'clearance', label: 'Clearance', icon: Zap },
] as const;

type StageId = (typeof STAGES)[number]['id'];

const CLEARANCE_TONE = {
  cleared: { color: '#00D68F', label: 'Cleared', icon: CheckCircle2 },
  restricted: { color: '#FFB800', label: 'Restricted', icon: AlertTriangle },
  grounded: { color: '#FF4868', label: 'Grounded', icon: Ban },
  incomplete: { color: '#4F9CF9', label: 'Preflight incomplete', icon: Lock },
} as const;

const RULE_COLORS: Record<TradingRule['category'], string> = {
  entry: '#00D68F',
  exit: '#4F9CF9',
  risk: '#FF4868',
  mindset: '#60A5FA',
  time: '#FBBF24',
};

// ── Small building blocks ─────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-tp-card/60 p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white/90">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Dial({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  hint,
  danger,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  danger?: boolean;
  onChange: (n: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium text-white/70">{label}</span>
        <span
          className={clsx(
            'text-lg font-bold tabular-nums',
            danger ? 'text-tp-red' : 'text-white/90',
          )}
        >
          {value}
          {suffix && <span className="ml-0.5 text-xs font-normal text-white/40">{suffix}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="preflight-range w-full"
        style={{
          background: `linear-gradient(90deg, ${danger ? '#FF4868' : '#00D68F'} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
        }}
      />
      {hint && <p className="mt-1.5 text-[11px] text-white/35">{hint}</p>}
    </div>
  );
}

function ReasonRow({
  severity,
  text,
  action,
}: {
  severity: string;
  text: string;
  action?: string;
}) {
  const tone =
    severity === 'gate'
      ? { c: '#4F9CF9', Icon: Lock }
      : severity === 'stop'
        ? { c: '#FF4868', Icon: Ban }
        : severity === 'warn'
          ? { c: '#FFB800', Icon: AlertTriangle }
          : { c: '#00D68F', Icon: CheckCircle2 };
  const { c, Icon } = tone;
  return (
    <li className="flex gap-3 rounded-xl px-3 py-2.5" style={{ background: `${c}0F` }}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: c }} />
      <div className="min-w-0">
        <p className="text-[13px] text-white/85">{text}</p>
        {action && <p className="mt-0.5 text-[11px] text-white/45">{action}</p>}
      </div>
    </li>
  );
}

// ── The page ──────────────────────────────────────────────────────────────────

export const PreflightPage: React.FC = () => {
  // Every input below is restored from localStorage, which the server cannot see.
  // Rendering the real verdict before mount produces a hydration mismatch, so the
  // first client paint deliberately matches the server's empty one.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [date, setDate] = useState(today());
  const [stage, setStage] = useState<StageId>('condition');
  const [newItem, setNewItem] = useState('');
  const [newLevel, setNewLevel] = useState({ support: '', resistance: '' });
  const [newSymbol, setNewSymbol] = useState('');

  const {
    checklistItems,
    toggleChecklistItem,
    addChecklistItem,
    removeChecklistItem,
    resetChecklist,
    getGamePlan,
    updateGamePlan,
    addKeyLevel,
    removeKeyLevel,
    addToWatchlist,
    removeFromWatchlist,
    tradingRules,
    updateRuleCompliance,
  } = useRoutineStore();

  const accounts = useAccountStore((s) => s.accounts);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const updateAccount = useAccountStore((s) => s.updateAccount);

  const account = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId],
  );

  const plan = getGamePlan(date);
  const condition: PreflightCondition = plan.condition ?? DEFAULT_CONDITION;
  const isToday = date === today();
  const activeRules = tradingRules.filter((r) => r.isActive);

  const liquidation = useMemo(
    () =>
      account
        ? computeLiquidation(account, {
            today: date,
            personalDailyLimit: plan.maxLoss ?? null,
          })
        : null,
    [account, date, plan.maxLoss],
  );

  const signals = useMemo(() => {
    const checked = checklistItems.filter((i) => i.checked).length;
    const ratedRules = plan.ruleCompliance ?? [];
    return {
      bufferRemaining: liquidation ? liquidation.bufferRemaining : null,
      redDayStreak: account ? redDayStreak(account.trades, date) : 0,
      brokeRulesLastSession: ratedRules.some((r) => r.followed === false),
      checklistComplete: checklistItems.length ? checked / checklistItems.length : 0,
      hasDailyStop: !!plan.maxLoss && plan.maxLoss > 0,
      hasStopTime: !!plan.stopTime,
      hasMarketPlan: !!plan.marketBias &&
        (plan.keyLevels.support.length > 0 || plan.keyLevels.resistance.length > 0),
    };
  }, [checklistItems, plan, liquidation, account, date]);

  const verdict: PreflightVerdict = useMemo(
    () => evaluatePreflight(condition, signals),
    [condition, signals],
  );

  const tone = CLEARANCE_TONE[verdict.clearance];
  const ToneIcon = tone.icon;
  const committed = !!plan.committedAt;

  const setCondition = (patch: Partial<PreflightCondition>) =>
    updateGamePlan(date, { condition: { ...condition, ...patch } });

  const commit = () => {
    updateGamePlan(date, {
      committedAt: new Date().toISOString(),
      committedSize: verdict.sizeMultiplier,
      completed: true,
    });
    // The daily stop the trader just committed to becomes the clock's limit.
    if (account && plan.maxLoss) {
      updateAccount(account.id, { personalDailyLimit: plan.maxLoss });
    }
  };

  const submitLevel = (kind: 'support' | 'resistance') => {
    const value = newLevel[kind].trim();
    if (!value) return;
    addKeyLevel(date, kind, value);
    setNewLevel({ ...newLevel, [kind]: '' });
  };

  const submitSymbol = () => {
    const value = newSymbol.trim();
    if (!value) return;
    addToWatchlist(date, value);
    setNewSymbol('');
  };

  const submitChecklistItem = () => {
    const value = newItem.trim();
    if (!value) return;
    addChecklistItem(value);
    setNewItem('');
  };

  const shiftDate = (days: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="h-44 animate-pulse rounded-2xl border border-white/[0.07] bg-tp-card/40" />
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
          <div className="h-72 animate-pulse rounded-2xl border border-white/[0.07] bg-tp-card/40" />
          <div className="h-72 animate-pulse rounded-2xl border border-white/[0.07] bg-tp-card/40" />
        </div>
      </div>
    );
  }

  const stageComplete: Record<StageId, boolean> = {
    condition: !!plan.condition,
    market: signals.hasMarketPlan,
    limits: signals.hasDailyStop && signals.hasStopTime,
    rules: signals.checklistComplete >= 1,
    clearance: committed,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <style>{`
        .preflight-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; outline: none; }
        .preflight-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
        .preflight-range::-moz-range-thumb { width: 18px; height: 18px; border: none; border-radius: 50%; background: #fff; cursor: pointer; }
      `}</style>

      {/* ── Header: the verdict, always first ─────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl border p-6"
        style={{
          borderColor: `${tone.color}40`,
          background: `linear-gradient(135deg, ${tone.color}14 0%, rgba(23,32,53,0.6) 55%)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
              Preflight
              <span className="text-white/20">·</span>
              <button onClick={() => shiftDate(-1)} className="hover:text-white/70">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-white/60">
                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <button onClick={() => shiftDate(1)} className="hover:text-white/70">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {!isToday && (
                <button
                  onClick={() => setDate(today())}
                  className="rounded px-1.5 py-0.5 text-[10px] text-tp-blue hover:bg-tp-blue/10"
                >
                  Today
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center gap-3">
              <ToneIcon className="h-7 w-7" style={{ color: tone.color }} />
              <h1 className="text-3xl font-bold text-white">{verdict.headline}</h1>
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-white/50">
              {verdict.clearance === 'incomplete'
                ? 'Finish every stage below. The checklist is a gate, not a suggestion.'
                : verdict.clearance === 'grounded'
                  ? 'The signals say the cost of trading today is higher than the opportunity.'
                  : verdict.clearance === 'restricted'
                    ? 'You can trade. You have not earned full size.'
                    : 'Everything checks out. Now go execute the plan you wrote.'}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                Size today
              </div>
              <div className="text-3xl font-bold tabular-nums" style={{ color: tone.color }}>
                {Math.round(verdict.sizeMultiplier * 100)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                Readiness
              </div>
              <div className="text-3xl font-bold tabular-nums text-white/85">
                {verdict.readiness}
              </div>
            </div>
          </div>
        </div>

        {/* Stage rail */}
        <div className="mt-6 flex items-center gap-1.5">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const done = stageComplete[s.id];
            const active = s.id === stage;
            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStage(s.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition',
                    active
                      ? 'bg-white/[0.10] text-white'
                      : 'text-white/45 hover:bg-white/[0.05] hover:text-white/70',
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-tp-green" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  {s.label}
                </button>
                {i < STAGES.length - 1 && (
                  <div
                    className="h-px w-4 shrink-0"
                    style={{ background: done ? '#00D68F55' : 'rgba(255,255,255,0.08)' }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          {/* ── Condition ─────────────────────────────────────────────────── */}
          {stage === 'condition' && (
            <Panel
              title="How are you actually arriving?"
              subtitle="Answer before the open, while you have nothing to defend."
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <Dial
                  label="Sleep last night"
                  value={condition.sleep}
                  min={0}
                  max={10}
                  step={0.5}
                  suffix="h"
                  danger={condition.sleep < 5.5}
                  hint={
                    condition.sleep < 4
                      ? 'Below 4h your impulse control is not yours to command.'
                      : condition.sleep < 5.5
                        ? 'Under 5.5h costs you half your size today.'
                        : 'Enough to trade on.'
                  }
                  onChange={(n) => setCondition({ sleep: n })}
                />
                <Dial
                  label="Stress"
                  value={condition.stress}
                  min={1}
                  max={5}
                  danger={condition.stress >= 4}
                  hint={['Calm', 'Settled', 'Normal', 'Elevated', 'Wired'][condition.stress - 1]}
                  onChange={(n) => setCondition({ stress: n })}
                />
                <Dial
                  label="Focus"
                  value={condition.focus}
                  min={1}
                  max={5}
                  danger={condition.focus <= 2}
                  hint={['Scattered', 'Foggy', 'Okay', 'Sharp', 'Locked in'][condition.focus - 1]}
                  onChange={(n) => setCondition({ focus: n })}
                />
                <div>
                  <span className="mb-2 block text-xs font-medium text-white/70">
                    Anything outside trading on your mind?
                  </span>
                  <button
                    onClick={() => setCondition({ lifeNoise: !condition.lifeNoise })}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition',
                      condition.lifeNoise
                        ? 'border-tp-yellow/40 bg-tp-yellow/10 text-white'
                        : 'border-white/[0.08] text-white/50 hover:bg-white/[0.04]',
                    )}
                  >
                    {condition.lifeNoise ? (
                      <BatteryLow className="h-4 w-4 text-tp-yellow" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    {condition.lifeNoise
                      ? 'Yes — something is taking up room'
                      : 'No — head is clear'}
                  </button>
                  <p className="mt-1.5 text-[11px] text-white/35">
                    Money worries, a fight, a deadline. It follows you onto the chart.
                  </p>
                </div>
              </div>
            </Panel>
          )}

          {/* ── Market ────────────────────────────────────────────────────── */}
          {stage === 'market' && (
            <Panel title="What is your read?" subtitle="Written before the open, or it is improvisation.">
              <div className="mb-5">
                <span className="mb-2 block text-xs font-medium text-white/70">Bias</span>
                <div className="flex gap-2">
                  {(['bullish', 'neutral', 'bearish'] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => updateGamePlan(date, { marketBias: b })}
                      className={clsx(
                        'flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition',
                        plan.marketBias === b
                          ? b === 'bullish'
                            ? 'border-tp-green/50 bg-tp-green/12 text-tp-green'
                            : b === 'bearish'
                              ? 'border-tp-red/50 bg-tp-red/12 text-tp-red'
                              : 'border-white/25 bg-white/[0.07] text-white'
                          : 'border-white/[0.08] text-white/45 hover:bg-white/[0.04]',
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {(['support', 'resistance'] as const).map((kind) => (
                  <div key={kind}>
                    <span
                      className="mb-2 block text-xs font-medium capitalize"
                      style={{ color: kind === 'support' ? '#00D68F' : '#FF4868' }}
                    >
                      {kind}
                    </span>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {plan.keyLevels[kind].map((lvl, i) => (
                        <span
                          key={`${lvl}-${i}`}
                          className="group flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs tabular-nums text-white/80"
                        >
                          {lvl}
                          <button
                            onClick={() => removeKeyLevel(date, kind, i)}
                            className="text-white/25 group-hover:text-tp-red"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {!plan.keyLevels[kind].length && (
                        <span className="text-xs text-white/25">None yet</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newLevel[kind]}
                        onChange={(e) => setNewLevel({ ...newLevel, [kind]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitLevel(kind);
                        }}
                        placeholder="Add level"
                        className="w-full rounded-lg border border-white/[0.08] bg-tp-base/60 px-3 py-2 text-sm text-white/85 outline-none placeholder:text-white/25 focus:border-tp-blue/50"
                      />
                      <button
                        onClick={() => submitLevel(kind)}
                        aria-label={`Add ${kind} level`}
                        className="rounded-lg border border-white/[0.08] px-3 text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <span className="mb-2 block text-xs font-medium text-white/70">Watchlist</span>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {plan.watchlist.map((sym, i) => (
                    <span
                      key={`${sym}-${i}`}
                      className="group flex items-center gap-1.5 rounded-lg bg-tp-blue/12 px-2.5 py-1 text-xs font-medium text-tp-blue"
                    >
                      {sym}
                      <button
                        onClick={() => removeFromWatchlist(date, i)}
                        className="text-tp-blue/40 group-hover:text-tp-red"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {!plan.watchlist.length && (
                    <span className="text-xs text-white/25">Nothing on watch</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitSymbol();
                    }}
                    placeholder="MNQ, ES…"
                    className="w-full rounded-lg border border-white/[0.08] bg-tp-base/60 px-3 py-2 text-sm text-white/85 outline-none placeholder:text-white/25 focus:border-tp-blue/50"
                  />
                  <button
                    onClick={submitSymbol}
                    aria-label="Add symbol to watchlist"
                    className="rounded-lg border border-white/[0.08] px-3 text-white/50 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Panel>
          )}

          {/* ── Limits ────────────────────────────────────────────────────── */}
          {stage === 'limits' && (
            <Panel
              title="Commit your limits"
              subtitle="Set now, while nothing is at stake. Your daily stop feeds the Liquidation Clock."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { key: 'maxLoss' as const, label: 'Max loss', prefix: '$', tone: '#FF4868' },
                  { key: 'maxProfit' as const, label: 'Target', prefix: '$', tone: '#00D68F' },
                  { key: 'maxTrades' as const, label: 'Max trades', prefix: '', tone: '#4F9CF9' },
                ].map((f) => (
                  <div key={f.key}>
                    <span className="mb-2 block text-xs font-medium text-white/70">{f.label}</span>
                    <div className="flex items-center rounded-xl border border-white/[0.08] bg-tp-base/60 px-3 py-2.5 focus-within:border-tp-blue/50">
                      {f.prefix && <span className="mr-1 text-sm text-white/35">{f.prefix}</span>}
                      <input
                        type="number"
                        value={plan[f.key] ?? ''}
                        onChange={(e) =>
                          updateGamePlan(date, {
                            [f.key]: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        placeholder="0"
                        className="w-full bg-transparent text-lg font-semibold tabular-nums outline-none placeholder:text-white/20"
                        style={{ color: f.tone }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <span className="mb-2 block text-xs font-medium text-white/70">
                  Stop time — you walk away regardless
                </span>
                <div className="flex flex-wrap gap-2">
                  {['11:00', '11:30', '12:00', '13:00', '16:00'].map((t) => (
                    <button
                      key={t}
                      onClick={() => updateGamePlan(date, { stopTime: t })}
                      className={clsx(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition',
                        plan.stopTime === t
                          ? 'border-tp-blue/50 bg-tp-blue/12 text-tp-blue'
                          : 'border-white/[0.08] text-white/50 hover:bg-white/[0.04]',
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {liquidation && plan.maxLoss ? (
                <div className="mt-5 rounded-xl border border-white/[0.07] bg-tp-base/40 p-4">
                  <p className="text-xs text-white/45">
                    Your stop of{' '}
                    <span className="font-semibold text-tp-red">{money(plan.maxLoss)}</span> against{' '}
                    <span className="font-semibold text-white/80">
                      {money(Math.max(0, liquidation.cushion))}
                    </span>{' '}
                    of buffer.{' '}
                    {plan.maxLoss >= liquidation.cushion
                      ? 'Your daily stop is larger than your remaining buffer — hitting it ends the account.'
                      : `You could hit this stop ${Math.floor(liquidation.cushion / plan.maxLoss)}× before the account is gone.`}
                  </p>
                </div>
              ) : null}
            </Panel>
          )}

          {/* ── Rules ─────────────────────────────────────────────────────── */}
          {stage === 'rules' && (
            <>
              <Panel
                title="Prep checklist"
                subtitle={`${checklistItems.filter((i) => i.checked).length} of ${checklistItems.length} done`}
                action={
                  <button
                    onClick={resetChecklist}
                    className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-white/50 hover:bg-white/[0.05] hover:text-white"
                  >
                    Reset
                  </button>
                }
              >
                <div className="space-y-1.5">
                  {checklistItems.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]"
                    >
                      <button onClick={() => toggleChecklistItem(item.id)} className="shrink-0">
                        {item.checked ? (
                          <CheckCircle2 className="h-5 w-5 text-tp-green" />
                        ) : (
                          <Circle className="h-5 w-5 text-white/20" />
                        )}
                      </button>
                      <span
                        className={clsx(
                          'flex-1 text-sm',
                          item.checked ? 'text-white/35 line-through' : 'text-white/80',
                        )}
                      >
                        {item.text}
                      </span>
                      {!item.isDefault && (
                        <button
                          onClick={() => removeChecklistItem(item.id)}
                          className="text-white/15 opacity-0 transition group-hover:opacity-100 hover:text-tp-red"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitChecklistItem();
                    }}
                    placeholder="Add your own step"
                    className="flex-1 rounded-lg border border-white/[0.08] bg-tp-base/60 px-3 py-2 text-sm text-white/85 outline-none placeholder:text-white/25 focus:border-tp-blue/50"
                  />
                  <button
                    onClick={submitChecklistItem}
                    aria-label="Add checklist step"
                    className="rounded-lg border border-white/[0.08] px-3 text-white/50 hover:bg-white/[0.05] hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </Panel>

              <Panel
                title="Yesterday's rules"
                subtitle="Rate them honestly — breaking form costs you size today."
              >
                <div className="space-y-1.5">
                  {activeRules.slice(0, 8).map((rule) => {
                    const state =
                      plan.ruleCompliance?.find((c) => c.ruleId === rule.id)?.followed ?? null;
                    return (
                      <div
                        key={rule.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.03]"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: RULE_COLORS[rule.category] }}
                        />
                        <span className="flex-1 text-sm text-white/75">{rule.text}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateRuleCompliance(date, rule.id, true)}
                            className={clsx(
                              'rounded-md px-2 py-1 text-[11px] font-medium transition',
                              state === true
                                ? 'bg-tp-green/15 text-tp-green'
                                : 'text-white/30 hover:bg-white/[0.06]',
                            )}
                          >
                            Kept
                          </button>
                          <button
                            onClick={() => updateRuleCompliance(date, rule.id, false)}
                            className={clsx(
                              'rounded-md px-2 py-1 text-[11px] font-medium transition',
                              state === false
                                ? 'bg-tp-red/15 text-tp-red'
                                : 'text-white/30 hover:bg-white/[0.06]',
                            )}
                          >
                            Broke
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!activeRules.length && (
                    <p className="text-sm text-white/30">No active rules yet.</p>
                  )}
                </div>
              </Panel>
            </>
          )}

          {/* ── Clearance ─────────────────────────────────────────────────── */}
          {stage === 'clearance' && (
            <Panel
              title="Sign off"
              subtitle="Committing locks today's size and sends your stop to the Liquidation Clock."
            >
              <ul className="space-y-2">
                {verdict.reasons.map((r) => (
                  <ReasonRow key={r.id} severity={r.severity} text={r.text} action={r.action} />
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={commit}
                  disabled={verdict.clearance === 'incomplete' || committed}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition',
                    verdict.clearance === 'incomplete'
                      ? 'cursor-not-allowed bg-white/[0.05] text-white/25'
                      : committed
                        ? 'bg-tp-green/15 text-tp-green'
                        : 'text-tp-base hover:brightness-110',
                  )}
                  style={
                    verdict.clearance !== 'incomplete' && !committed
                      ? { background: tone.color }
                      : undefined
                  }
                >
                  {committed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Committed at {Math.round((plan.committedSize ?? 1) * 100)}% size
                    </>
                  ) : verdict.clearance === 'incomplete' ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Finish preflight first
                    </>
                  ) : (
                    <>
                      Commit to {Math.round(verdict.sizeMultiplier * 100)}% size
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                {committed && (
                  <button
                    onClick={() =>
                      updateGamePlan(date, { committedAt: null, committedSize: undefined })
                    }
                    className="text-xs text-white/35 hover:text-white/60"
                  >
                    Undo
                  </button>
                )}
              </div>
            </Panel>
          )}

          {/* Stage navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStage(STAGES[Math.max(0, stageIndex - 1)].id)}
              disabled={stageIndex === 0}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/45 transition hover:text-white disabled:opacity-25"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() =>
                setStage(STAGES[Math.min(STAGES.length - 1, stageIndex + 1)].id)
              }
              disabled={stageIndex === STAGES.length - 1}
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-25"
            >
              Next: {STAGES[Math.min(STAGES.length - 1, stageIndex + 1)].label}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Live sidebar: what the verdict is reading ──────────────────── */}
        <aside className="space-y-5">
          <Panel title="What preflight is reading" subtitle="Live inputs behind the verdict">
            <ul className="space-y-2">
              {verdict.reasons.slice(0, 6).map((r) => (
                <ReasonRow key={r.id} severity={r.severity} text={r.text} action={r.action} />
              ))}
            </ul>
          </Panel>

          {liquidation && (
            <Panel title="Account context" subtitle={liquidation.rules.label}>
              <div className="space-y-3">
                {[
                  {
                    label: 'Buffer left',
                    value: `${Math.round(liquidation.bufferRemaining * 100)}%`,
                    tone:
                      liquidation.bufferRemaining <= 0.2
                        ? 'text-tp-red'
                        : liquidation.bufferRemaining <= 0.45
                          ? 'text-tp-yellow'
                          : 'text-tp-green',
                  },
                  {
                    label: 'Room to liquidation',
                    value: money(Math.max(0, liquidation.cushion)),
                    tone: 'text-white/85',
                  },
                  {
                    label: 'Average loser',
                    value: liquidation.avgLoss ? money(liquidation.avgLoss) : '—',
                    tone: 'text-white/85',
                  },
                  {
                    label: 'Red days running',
                    value: String(signals.redDayStreak),
                    tone: signals.redDayStreak >= 2 ? 'text-tp-red' : 'text-white/85',
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between">
                    <span className="text-xs text-white/45">{row.label}</span>
                    <span className={clsx('text-sm font-semibold tabular-nums', row.tone)}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
};

export default PreflightPage;
