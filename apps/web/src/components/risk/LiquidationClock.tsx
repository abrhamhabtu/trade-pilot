'use client';

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Lock, Skull, TrendingUp, X } from 'lucide-react';
import { useAccountStore } from '@/store/accountStore';
import {
  computeLiquidation,
  dollarsToPoints,
  liquidationHeadline,
  type InstrumentSymbol,
  type LiquidationState,
} from '@/lib/liquidation';
import { SESSION_INSTRUMENTS } from '@/lib/sessionRisk';

const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;

const TONES = {
  breached: { ring: 'rgba(255,72,104,0.55)', text: 'text-tp-red', bar: '#FF4868', glow: 'rgba(255,72,104,0.20)' },
  danger:   { ring: 'rgba(255,72,104,0.40)', text: 'text-tp-red', bar: '#FF4868', glow: 'rgba(255,72,104,0.16)' },
  caution:  { ring: 'rgba(255,184,0,0.35)',  text: 'text-tp-yellow', bar: '#FFB800', glow: 'rgba(255,184,0,0.12)' },
  safe:     { ring: 'rgba(255,255,255,0.10)', text: 'text-tp-green', bar: '#00D68F', glow: 'rgba(0,214,143,0.10)' },
} as const;

const OPEN_KEY = 'tradepilot_clock_open';

function LimitRow({ label, left, of, ratio, color, binds, note }: {
  label: string;
  left: string;
  of: string;
  ratio: number;
  color: string;
  binds: boolean;
  note?: string;
}) {
  return (
    <div className={clsx('rounded-xl px-3 py-2.5', binds ? 'bg-white/[0.05]' : 'bg-white/[0.02]')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
          {label}
          {binds && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
              hits first
            </span>
          )}
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{left}</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%`, background: color }}
        />
      </div>
      <div className="mt-1 text-[10px] text-white/35">{note ?? `of ${of}`}</div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className={clsx('text-sm font-semibold tabular-nums truncate', tone || 'text-white/90')}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-white/35 truncate">{hint}</div>}
    </div>
  );
}

export function LiquidationClock() {
  const accounts = useAccountStore((s) => s.accounts);
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);

  // Account data lives in localStorage, invisible to the server render.
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [symbol, setSymbol] = useState<InstrumentSymbol>('MNQ');
  const [contracts, setContracts] = useState(1);

  useEffect(() => {
    setMounted(true);
    try {
      setOpen(localStorage.getItem(OPEN_KEY) === '1');
    } catch {
      /* private mode or blocked storage: the pill just starts collapsed */
    }
  }, []);

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(OPEN_KEY, v ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  const account = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId],
  );

  const state: LiquidationState | null = useMemo(
    () =>
      account
        ? computeLiquidation(account, { personalDailyLimit: account.personalDailyLimit ?? null })
        : null,
    [account],
  );

  if (!mounted || !account || !state || dismissed) return null;

  // An account the trader has marked blown is over, whatever our reconstruction
  // of the threshold says. Show the truth, never a cushion that no longer exists.
  const dead = account.status === 'blown';
  const status = dead ? 'breached' : state.status;
  const roomToStop = dead ? 0 : state.roomToStop;
  const urgent = status === 'danger' || status === 'breached';

  const tone = TONES[status];
  const points = dollarsToPoints(roomToStop, symbol, contracts);
  const spec = SESSION_INSTRUMENTS[symbol];
  const ticks = points !== null && spec ? points / spec.tick : null;
  const pct = dead ? 0 : Math.round(state.bufferRemaining * 100);

  const firmLimit = state.rules.dailyLossLimit;
  const personalLimit = account.personalDailyLimit ?? null;
  const dayLimit =
    firmLimit !== null && personalLimit !== null
      ? Math.min(firmLimit, personalLimit)
      : firmLimit ?? personalLimit;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {/* Expanded panel: here only when asked for, never occupying the page */}
      {open && (
        <div
          className="pointer-events-auto w-[min(92vw,30rem)] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl"
          style={{
            borderColor: tone.ring,
            background: 'linear-gradient(180deg, rgba(17,31,53,0.96) 0%, rgba(13,22,40,0.98) 100%)',
          }}
        >
          <div className="h-[3px] w-full bg-white/[0.06]">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.max(!dead && state.cushion > 0 ? 1.5 : 0, pct)}%`,
                background: tone.bar,
                boxShadow: `0 0 12px ${tone.bar}`,
              }}
            />
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-white/70">{account.name}</div>
                <div className="truncate text-[11px] text-white/40">
                  {state.rules.inferred ? `${state.rules.label} (inferred)` : state.rules.label}
                </div>
              </div>
              <button
                onClick={() => setDismissed(true)}
                aria-label="Hide the clock for this session"
                className="rounded-md p-1 text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="mb-3 text-[13px] leading-relaxed text-white/70">
              {dead ? (
                'This account is closed out. The numbers below are how it finished.'
              ) : state.cushion <= 0 ? (
                'This account is past the threshold its firm liquidates at.'
              ) : (
                <>
                  You can lose{' '}
                  <span className="font-bold" style={{ color: tone.bar }}>{money(roomToStop)}</span>{' '}
                  more{' '}
                  {state.bindingConstraint === 'daily'
                    ? 'today before you hit the daily stop you set.'
                    : `before ${state.rules.label.split(' · ')[0]} closes this account.`}
                </>
              )}
            </p>

            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <LimitRow
                label="Your daily stop"
                left={dayLimit === null ? 'None set' : money(state.dailyRemaining ?? 0)}
                of={dayLimit === null ? '' : money(dayLimit)}
                ratio={dayLimit ? (state.dailyRemaining ?? 0) / dayLimit : 0}
                color={dayLimit === null ? 'rgba(255,255,255,0.25)' : '#4F9CF9'}
                binds={!dead && state.bindingConstraint === 'daily'}
                note={
                  dayLimit === null
                    ? 'Set one in Preflight'
                    : `of ${money(dayLimit)} · today ${money(state.todayPnL)}`
                }
              />
              <LimitRow
                label="Account threshold"
                left={money(Math.max(0, dead ? 0 : state.cushion))}
                of={money(state.rules.drawdown)}
                ratio={dead ? 0 : state.bufferRemaining}
                color={tone.bar}
                binds={!dead && state.bindingConstraint === 'drawdown'}
                note={`liquidates at ${money(state.threshold)}`}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="In points"
                value={points === null ? '—' : `${points.toFixed(points < 10 ? 1 : 0)} ${symbol}`}
                hint={ticks !== null ? `${Math.round(ticks)} ticks @ ${contracts}x` : undefined}
                tone={tone.text}
              />
              <Stat
                label="Avg loser"
                value={state.avgLoss ? money(state.avgLoss) : '—'}
                hint={state.worstLoss ? `worst ${money(state.worstLoss)}` : undefined}
              />
              <Stat
                label="Survives"
                value={state.lossesSurvived === null ? '—' : `${state.lossesSurvived} avg`}
                hint={
                  state.worstCaseLossesSurvived === null
                    ? undefined
                    : `${state.worstCaseLossesSurvived} worst-case`
                }
                tone={
                  state.lossesSurvived !== null && state.lossesSurvived <= 2 ? 'text-tp-red' : undefined
                }
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-3">
              <Stat label="Equity" value={money(state.balance)} />
              <Stat
                label="Threshold"
                value={money(state.threshold)}
                hint={`started ${money(state.initialThreshold)}`}
                tone="text-tp-red"
              />
              <Stat
                label="Trailed up"
                value={state.trailed > 0 ? `+${money(state.trailed)}` : '—'}
                hint={state.trailed > 0 ? `peak ${money(state.peak)}` : 'never moved'}
                tone={state.trailed > 0 ? 'text-tp-yellow' : undefined}
              />
              <Stat label="Buffer left" value={`${pct}%`} hint={`of ${money(state.rules.drawdown)}`} />
              <Stat
                label="Today"
                value={money(state.todayPnL)}
                tone={state.todayPnL < 0 ? 'text-tp-red' : 'text-tp-green'}
                hint={
                  state.dailyRemaining === null
                    ? 'no daily limit'
                    : `${money(state.dailyRemaining)} left`
                }
              />
              <Stat
                label="Rules"
                value={state.rules.drawdownType.replace('trailing-', '').toUpperCase()}
                hint={state.estimated ? 'closed trades only' : state.locked ? 'locked' : 'trailing'}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-3">
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value as InstrumentSymbol)}
                aria-label="Instrument"
                className="rounded-md border border-white/[0.08] bg-tp-card px-2 py-1 text-xs text-white/80 outline-none focus:border-tp-blue/50"
              >
                {Object.keys(SESSION_INSTRUMENTS).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={50}
                value={contracts}
                aria-label="Contracts"
                onChange={(e) => setContracts(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-16 rounded-md border border-white/[0.08] bg-tp-card px-2 py-1 text-xs tabular-nums text-white/80 outline-none focus:border-tp-blue/50"
              />
              <p className="flex-1 text-[11px] leading-snug text-white/40">
                {state.estimated
                  ? 'Intraday trailing: measured from closed-trade highs. Your real threshold can only be higher.'
                  : state.rules.drawdownType === 'trailing-eod'
                    ? 'End-of-day trailing: the threshold moves only at the close.'
                    : 'Static drawdown: this threshold never moves.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* The pill: small enough to ignore, present enough that the number is never a surprise */}
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${money(roomToStop)} left to lose before your ${state.bindingConstraint === 'daily' ? "daily stop" : 'account is closed'}. ${open ? 'Collapse' : 'Expand'} risk details.`}
        title={dead ? 'Account closed out' : liquidationHeadline(state)}
        className={clsx(
          'pointer-events-auto flex items-center gap-2.5 rounded-full border py-2 pl-3 pr-3.5 shadow-xl backdrop-blur-xl transition hover:brightness-125',
          urgent && 'animate-pulse',
        )}
        style={{
          borderColor: tone.ring,
          background: 'rgba(13,22,40,0.92)',
          boxShadow: urgent ? `0 6px 28px ${tone.glow}` : '0 6px 20px rgba(0,0,0,0.35)',
        }}
      >
        {dead ? (
          <Skull className={clsx('h-3.5 w-3.5', tone.text)} />
        ) : (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: tone.bar, boxShadow: `0 0 8px ${tone.bar}` }}
          />
        )}
        <span className={clsx('text-sm font-bold tabular-nums', tone.text)}>{money(roomToStop)}</span>
        <span className="hidden whitespace-nowrap text-[11px] font-medium text-white/55 sm:inline">
          {dead ? 'account is over' : 'left to lose'}
        </span>
        {!dead && (
          <span className="hidden rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/45 md:inline">
            {state.bindingConstraint === 'daily' ? 'today' : 'account'}
          </span>
        )}
        {state.estimated && !dead && (
          <TrendingUp className="h-3 w-3 text-tp-yellow" aria-label="Best-case estimate" />
        )}
        {state.locked && !dead && <Lock className="h-3 w-3 text-tp-green" aria-label="Threshold locked" />}
        <ChevronDown
          className={clsx('h-3.5 w-3.5 text-white/30 transition-transform', open && 'rotate-180')}
        />
      </button>
    </div>
  );
}

export default LiquidationClock;
