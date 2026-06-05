'use client';

import React from 'react';
import clsx from 'clsx';
import { Play, Pause, Square, RotateCcw, Shield, FlaskConical, AlertTriangle } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePolymarketStore } from '@/store/polymarketStore';

export const BotStatusBar: React.FC = () => {
  const { theme } = useThemeStore();
  const { state, config, startBot, pauseBot, resumeBot, haltBot, resetBot, canTrade } = usePolymarketStore();
  const isDark = theme === 'dark';

  const runtime = state.startTime
    ? Math.round((Date.now() - state.startTime) / 60000)
    : 0;

  const statusConfig = {
    idle: { label: 'Idle', color: 'bg-white/10 text-white/50', icon: null },
    running: { label: 'Running', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: Play },
    paused: { label: 'Paused', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Pause },
    halted: { label: 'Halted', color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: AlertTriangle },
  };

  const status = statusConfig[state.status];
  const StatusIcon = status.icon;

  return (
    <div
      className={clsx(
        'rounded-2xl border p-5',
        isDark
          ? 'border-white/[0.06] bg-white/[0.02]'
          : 'border-slate-200 bg-white'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Status */}
        <div className="flex items-center gap-4">
          <div
            className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-xl border',
              status.color
            )}
          >
            {StatusIcon && <StatusIcon className="h-5 w-5" />}
            {!StatusIcon && <div className="h-3 w-3 rounded-full bg-white/30" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{status.label}</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  state.mode === 'live'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-blue-500/15 text-blue-400'
                )}
              >
                {state.mode === 'live' ? 'LIVE' : 'DRY RUN'}
              </span>
            </div>
            <p className={clsx('text-sm', isDark ? 'text-white/40' : 'text-slate-500')}>
              {state.startTime ? `${runtime}m runtime` : 'Not started'} ·{' '}
              {state.tradesExecuted} trades
            </p>
          </div>
        </div>

        {/* Center: Quick Stats */}
        <div className="flex gap-6">
          <Stat label="Daily PnL" value={state.dailyPnL} prefix="$" isDark={isDark} />
          <Stat label="Total PnL" value={state.totalPnL} prefix="$" isDark={isDark} />
          <Stat label="Capital" value={state.currentCapital} prefix="$" isDark={isDark} />
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {state.status === 'idle' && (
            <button
              onClick={startBot}
              className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/25"
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          )}

          {state.status === 'running' && (
            <>
              <button
                onClick={() => pauseBot()}
                className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-400 transition-all hover:bg-amber-500/25"
              >
                <Pause className="h-4 w-4" />
                Pause
              </button>
              <button
                onClick={haltBot}
                className="flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/25"
              >
                <Square className="h-4 w-4" />
                Halt
              </button>
            </>
          )}

          {state.status === 'paused' && (
            <>
              <button
                onClick={resumeBot}
                className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/25"
              >
                <Play className="h-4 w-4" />
                Resume
              </button>
              <button
                onClick={haltBot}
                className="flex items-center gap-2 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/25"
              >
                <Square className="h-4 w-4" />
                Halt
              </button>
            </>
          )}

          {state.status === 'halted' && (
            <button
              onClick={resetBot}
              className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/[0.1] hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          )}

          {/* Mode Toggle */}
          <button
            onClick={() =>
              usePolymarketStore.getState().setMode(state.mode === 'live' ? 'dry-run' : 'live')
            }
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
              state.mode === 'live'
                ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
            )}
          >
            {state.mode === 'live' ? <Shield className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
            {state.mode === 'live' ? 'Live' : 'Dry'}
          </button>
        </div>
      </div>

      {!canTrade.allowed && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4" />
          {canTrade.reason}
        </div>
      )}
    </div>
  );
};

function Stat({
  label,
  value,
  prefix,
  isDark,
}: {
  label: string;
  value: number;
  prefix: string;
  isDark: boolean;
}) {
  const isPositive = value >= 0;
  return (
    <div className="text-center">
      <p className={clsx('text-xs', isDark ? 'text-white/30' : 'text-slate-400')}>{label}</p>
      <p
        className={clsx(
          'text-lg font-semibold tabular-nums',
          isPositive ? 'text-emerald-400' : 'text-red-400'
        )}
      >
        {isPositive ? '+' : ''}
        {prefix}
        {Math.abs(value).toFixed(2)}
      </p>
    </div>
  );
}
