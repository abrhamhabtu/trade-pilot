'use client';

import React from 'react';
import clsx from 'clsx';
import { Terminal, Trash2 } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePolymarketStore } from '@/store/polymarketStore';

export const BotLogs: React.FC = () => {
  const { theme } = useThemeStore();
  const { state, clearLogs, addLog } = usePolymarketStore();
  const isDark = theme === 'dark';

  const levelIcons: Record<string, string> = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    trade: '💰',
    signal: '🎯',
  };

  const levelColors: Record<string, string> = {
    info: isDark ? 'text-blue-400' : 'text-blue-600',
    warn: isDark ? 'text-amber-400' : 'text-amber-600',
    error: isDark ? 'text-red-400' : 'text-red-600',
    trade: isDark ? 'text-emerald-400' : 'text-emerald-600',
    signal: isDark ? 'text-purple-400' : 'text-purple-600',
  };

  return (
    <div
      className={clsx(
        'rounded-2xl border p-5',
        isDark
          ? 'border-white/[0.06] bg-white/[0.02]'
          : 'border-slate-200 bg-white'
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className={clsx('h-5 w-5', isDark ? 'text-white/50' : 'text-slate-500')} />
          <h2 className="text-lg font-semibold">Bot Logs</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              addLog({
                level: 'info',
                message: 'Manual log entry test',
              })
            }
            className={clsx(
              'rounded-lg px-2 py-1 text-xs font-medium transition-all',
              isDark
                ? 'bg-white/[0.06] text-white/40 hover:text-white/70'
                : 'bg-slate-100 text-slate-400 hover:text-slate-600'
            )}
          >
            Test
          </button>
          <button
            onClick={clearLogs}
            className="text-white/20 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className={clsx(
          'max-h-80 overflow-y-auto rounded-xl border p-3 font-mono text-xs',
          isDark
            ? 'border-white/[0.04] bg-black/20'
            : 'border-slate-100 bg-slate-50'
        )}
      >
        {state.logs.length === 0 ? (
          <p className={clsx('py-4 text-center', isDark ? 'text-white/20' : 'text-slate-400')}>
            No logs yet. Start the bot to see activity.
          </p>
        ) : (
          <div className="space-y-1.5">
            {state.logs.map((log) => (
              <div key={log.id} className="flex gap-2">
                <span className={clsx('shrink-0', isDark ? 'text-white/20' : 'text-slate-400')}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={levelColors[log.level]}>
                  {levelIcons[log.level] || '•'}
                </span>
                <span className={isDark ? 'text-white/70' : 'text-slate-700'}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
