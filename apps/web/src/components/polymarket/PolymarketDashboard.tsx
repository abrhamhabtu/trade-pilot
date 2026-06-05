'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { useThemeStore } from '@/store/themeStore';
import { usePolymarketStore } from '@/store/polymarketStore';
import { BotStatusBar } from './BotStatusBar';
import { RiskPanel } from './RiskPanel';
import { StrategyPanel } from './StrategyPanel';
import { MarketScanner } from './MarketScanner';
import { SmartMoneyPanel } from './SmartMoneyPanel';
import { BotLogs } from './BotLogs';
import { ConfigModal } from './ConfigModal';

export const PolymarketDashboard: React.FC = () => {
  const { theme } = useThemeStore();
  const { state, config } = usePolymarketStore();
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'markets' | 'wallets'>('overview');

  const isDark = theme === 'dark';

  return (
    <div className={clsx('min-h-full p-4 sm:p-6', isDark ? 'text-white' : 'text-slate-800')}>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Polymarket Bot</h1>
          <p className={clsx('mt-1 text-sm', isDark ? 'text-white/40' : 'text-slate-500')}>
            Automated prediction market trading with risk management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(true)}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              isDark
                ? 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <BotStatusBar />

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {(['overview', 'markets', 'wallets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all capitalize',
              activeTab === tab
                ? isDark
                  ? 'bg-white/[0.08] text-white shadow-sm'
                  : 'bg-white text-slate-800 shadow-sm'
                : isDark
                  ? 'text-white/40 hover:text-white/70'
                  : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6 space-y-6">
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <RiskPanel />
              <StrategyPanel />
            </div>
            <BotLogs />
          </>
        )}

        {activeTab === 'markets' && <MarketScanner />}

        {activeTab === 'wallets' && <SmartMoneyPanel />}
      </div>

      {/* Config Modal */}
      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
    </div>
  );
};
