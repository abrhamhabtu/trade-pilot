'use client';

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lock,
  Skull,
  TrendingUp,
} from 'lucide-react';
import { useAccountStore } from '@/store/accountStore';
import { useCompactSidebar } from '@/hooks/useCompactSidebar';
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
  breached: {
    ring: 'rgba(255,72,104,0.55)',
    text: 'text-tp-red',
    bar: '#FF4868',
    glow: 'rgba(255,72,104,0.22)',
  },
  danger: {
    ring: 'rgba(255,72,104,0.4)',
    text: 'text-tp-red',
    bar: '#FF4868',
    glow: 'rgba(255,72,104,0.16)',
  },
  caution: {
    ring: 'rgba(255,184,0,0.35)',
    text: 'text-tp-yellow',
    bar: '#FFB800',
    glow: 'rgba(255,184,0,0.12)',
  },
  safe: {
    ring: 'rgba(0,214,143,0.28)',
    text: 'text-tp-green',
    bar: '#00D68F',
    glow: 'rgba(0,214,143,0.10)',
  },
} as const;

function Stat({
  label,
  value,
  hint,
  tone,
}: {
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
  const sidebarCollapsed = useCompactSidebar();

  // Account data lives in localStorage, invisible to the server render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [symbol, setSymbol] = useState<InstrumentSymbol>('MNQ');
  const [contracts, setContracts] = useState(1);

  const account = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null,
    [accounts, selectedAccountId],
  );

  const state: LiquidationState | null = useMemo(
    () =>
      account
        ? computeLiquidation(account, {
            personalDailyLimit: account.personalDailyLimit ?? null,
          })
        : null,
    [account],
  );

  if (!mounted || !account || !state || dismissed) return null;
  // An account the trader has marked blown is over, whatever our reconstruction
  // of the threshold says. Show the truth, never a cushion that no longer exists.
  const dead = account.status === 'blown';
  const status = dead ? 'breached' : state.status;
  const roomToStop = dead ? 0 : state.roomToStop;

  const tone = TONES[status];
  const points = dollarsToPoints(roomToStop, symbol, contracts);
  const spec = SESSION_INSTRUMENTS[symbol];
  const ticks = points !== null && spec ? points / spec.tick : null;

  const pct = dead ? 0 : Math.round(state.bufferRemaining * 100);

  return (
    <div
      className={clsx(
        'fixed bottom-0 right-0 z-40 transition-all duration-300',
        sidebarCollapsed ? 'left-20' : 'left-64',
      )}
    >
      <div
        className="border-t backdrop-blur-xl"
        style={{
          background: 'linear-gradient(180deg, rgba(17,31,53,0.92) 0%, rgba(13,22,40,0.97) 100%)',
          borderColor: tone.ring,
          boxShadow: `0 -12px 40px ${tone.glow}`,
        }}
      >
        {/* Buffer bar — the whole width is the buffer, the colored part is what's left */}
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

        <div className="px-5 py-2.5">
          <div className="flex items-center gap-5">
            {/* Headline number */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: tone.glow, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
              >
                {status === 'breached' ? (
                  <Skull className={clsx('h-4 w-4', tone.text)} />
                ) : (
                  <AlertTriangle className={clsx('h-4 w-4', tone.text)} />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={clsx('text-xl font-bold tabular-nums', tone.text)}>
                    {money(roomToStop)}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">
                    {dead ? 'account closed out' : `to ${state.bindingConstraint === 'daily' ? 'daily stop' : 'liquidation'}`}
                  </span>
                </div>
                <div className="text-[11px] text-white/45 truncate">
                  {dead ? 'You marked this account blown. This is what it looked like.' : liquidationHeadline(state)}
                </div>
              </div>
            </div>

            <div className="hidden lg:block h-8 w-px bg-white/[0.07]" />

            {/* Points translation — dollars mean nothing mid-trade, points do */}
            <div className="hidden lg:flex items-center gap-4">
              <Stat
                label="In points"
                value={
                  points === null
                    ? '—'
                    : `${points.toFixed(points < 10 ? 1 : 0)} ${symbol}`
                }
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
                value={
                  state.lossesSurvived === null ? '—' : `${state.lossesSurvived} avg`
                }
                hint={
                  state.worstCaseLossesSurvived === null
                    ? undefined
                    : `${state.worstCaseLossesSurvived} worst-case`
                }
                tone={
                  state.lossesSurvived !== null && state.lossesSurvived <= 2
                    ? 'text-tp-red'
                    : undefined
                }
              />
            </div>

            <div className="ml-auto flex items-center gap-3">
              {state.estimated && (
                <span
                  className="hidden xl:inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-tp-yellow"
                  style={{ background: 'rgba(255,184,0,0.10)' }}
                  title="This firm trails your intraday peak, including unrealized highs. TradePilot only sees closed trades, so your real threshold may be higher than shown."
                >
                  <TrendingUp className="h-3 w-3" />
                  Best case
                </span>
              )}
              {state.locked && (
                <span
                  className="hidden xl:inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-tp-green"
                  style={{ background: 'rgba(0,214,143,0.10)' }}
                  title="The trailing threshold has locked and no longer follows your peak."
                >
                  <Lock className="h-3 w-3" />
                  Locked
                </span>
              )}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white"
              >
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                Details
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 border-t border-white/[0.07] pt-3">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
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
                <Stat
                  label="Buffer left"
                  value={`${pct}%`}
                  hint={`of ${money(state.rules.drawdown)}`}
                />
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
                  hint={state.rules.inferred ? `${state.rules.label} (inferred)` : state.rules.label}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                    Instrument
                  </span>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value as InstrumentSymbol)}
                    className="rounded-md border border-white/[0.08] bg-tp-card px-2 py-1 text-xs text-white/80 outline-none focus:border-tp-blue/50"
                  >
                    {Object.keys(SESSION_INSTRUMENTS).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                    Size
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={contracts}
                    onChange={(e) =>
                      setContracts(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                    }
                    className="w-16 rounded-md border border-white/[0.08] bg-tp-card px-2 py-1 text-xs tabular-nums text-white/80 outline-none focus:border-tp-blue/50"
                  />
                </div>
                <p className="text-[11px] text-white/40">
                  {state.estimated
                    ? 'Intraday trailing: measured from closed-trade highs. Your real threshold can only be higher, never lower.'
                    : state.rules.drawdownType === 'trailing-eod'
                      ? 'End-of-day trailing: the threshold moves only at the close, so intraday wicks cannot raise it.'
                      : 'Static drawdown: this threshold never moves.'}
                </p>
                <button
                  onClick={() => setDismissed(true)}
                  className="ml-auto text-[11px] text-white/35 transition hover:text-white/60"
                >
                  Hide for this session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiquidationClock;
