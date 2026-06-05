'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Brain, Plus, Trash2, Star, TrendingUp, Activity } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePolymarketStore } from '@/store/polymarketStore';

export const SmartMoneyPanel: React.FC = () => {
  const { theme } = useThemeStore();
  const { wallets, setWallets, toggleFollowWallet, config, updateStrategyConfig } = usePolymarketStore();
  const isDark = theme === 'dark';
  const [newWallet, setNewWallet] = useState('');

  const handleAddWallet = () => {
    if (!newWallet.match(/^0x[a-fA-F0-9]{40}$/)) return;
    const custom = config.strategies.smartMoney.customWallets;
    if (custom.includes(newWallet)) return;
    updateStrategyConfig('smartMoney', {
      customWallets: [...custom, newWallet],
    });
    setNewWallet('');
  };

  const handleRemoveWallet = (addr: string) => {
    const custom = config.strategies.smartMoney.customWallets;
    updateStrategyConfig('smartMoney', {
      customWallets: custom.filter((w) => w !== addr),
    });
  };

  const handleScanWallets = async () => {
    // Mock wallet data - in real impl, call Polymarket SDK
    const mockWallets = [
      {
        address: '0xc2e7800b5af46e6093872b177b7a5e7f0563be51',
        rank: 1,
        pnl: 45200,
        volume: 125000,
        winRate: 0.72,
        profitFactor: 2.1,
        consistencyScore: 0.85,
        tradeCount: 145,
        following: true,
      },
      {
        address: '0x58c3f5d66c95d4c41b093fbdd2520e46b6c9de74',
        rank: 3,
        pnl: 28900,
        volume: 98000,
        winRate: 0.68,
        profitFactor: 1.8,
        consistencyScore: 0.78,
        tradeCount: 112,
        following: true,
      },
      {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        rank: 7,
        pnl: 15400,
        volume: 67000,
        winRate: 0.64,
        profitFactor: 1.6,
        consistencyScore: 0.72,
        tradeCount: 89,
        following: false,
      },
    ];
    setWallets(mockWallets);
  };

  const allWallets = [...wallets];

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
          <Brain className={clsx('h-5 w-5', isDark ? 'text-white/50' : 'text-slate-500')} />
          <h2 className="text-lg font-semibold">Smart Money Wallets</h2>
        </div>
        <button
          onClick={handleScanWallets}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
            isDark
              ? 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1]'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          Scan Leaderboard
        </button>
      </div>

      {/* Add Custom Wallet */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newWallet}
          onChange={(e) => setNewWallet(e.target.value)}
          placeholder="0x... wallet address"
          className={clsx(
            'flex-1 rounded-lg border px-3 py-2 text-sm transition-all',
            isDark
              ? 'border-white/[0.06] bg-white/[0.04] text-white placeholder-white/20 focus:border-emerald-500/40 focus:outline-none'
              : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none'
          )}
        />
        <button
          onClick={handleAddWallet}
          className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/25"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {/* Custom Wallets */}
      {config.strategies.smartMoney.customWallets.length > 0 && (
        <div className="mb-4">
          <p className={clsx('mb-2 text-xs font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-slate-400')}>
            Custom Wallets
          </p>
          <div className="space-y-2">
            {config.strategies.smartMoney.customWallets.map((addr) => (
              <div
                key={addr}
                className={clsx(
                  'flex items-center gap-2 rounded-lg border px-3 py-2',
                  isDark
                    ? 'border-white/[0.04] bg-white/[0.02]'
                    : 'border-slate-100 bg-slate-50'
                )}
              >
                <Star className="h-3.5 w-3.5 text-amber-400" />
                <span className="flex-1 font-mono text-xs">{addr.slice(0, 12)}...{addr.slice(-8)}</span>
                <button
                  onClick={() => handleRemoveWallet(addr)}
                  className="text-white/20 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard Wallets */}
      {allWallets.length > 0 && (
        <div>
          <p className={clsx('mb-2 text-xs font-medium uppercase tracking-wider', isDark ? 'text-white/30' : 'text-slate-400')}>
            Leaderboard
          </p>
          <div className="space-y-2">
            {allWallets.map((wallet) => (
              <WalletCard key={wallet.address} wallet={wallet} isDark={isDark} />
            ))}
          </div>
        </div>
      )}

      {allWallets.length === 0 && config.strategies.smartMoney.customWallets.length === 0 && (
        <div className="py-8 text-center">
          <Brain className={clsx('mx-auto mb-3 h-8 w-8', isDark ? 'text-white/10' : 'text-slate-300')} />
          <p className={clsx('text-sm', isDark ? 'text-white/30' : 'text-slate-400')}>
            Add custom wallets or scan the leaderboard
          </p>
        </div>
      )}
    </div>
  );
};

function WalletCard({
  wallet,
  isDark,
}: {
  wallet: {
    address: string;
    rank: number;
    pnl: number;
    volume: number;
    winRate: number;
    profitFactor: number;
    consistencyScore: number;
    tradeCount: number;
    following: boolean;
  };
  isDark: boolean;
}) {
  const { toggleFollowWallet } = usePolymarketStore();

  return (
    <div
      className={clsx(
        'rounded-xl border p-3 transition-all',
        isDark
          ? 'border-white/[0.04] bg-white/[0.02]'
          : 'border-slate-100 bg-slate-50/50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
            wallet.rank <= 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.06] text-white/40'
          )}>
            {wallet.rank}
          </span>
          <span className="font-mono text-xs">
            {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
          </span>
        </div>
        <button
          onClick={() => toggleFollowWallet(wallet.address)}
          className={clsx(
            'rounded-lg px-2 py-1 text-xs font-medium transition-all',
            wallet.following
              ? 'bg-emerald-500/15 text-emerald-400'
              : isDark
                ? 'bg-white/[0.06] text-white/40 hover:text-white/70'
                : 'bg-slate-100 text-slate-400 hover:text-slate-600'
          )}
        >
          {wallet.following ? 'Following' : 'Follow'}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        <Metric label="PnL" value={`$${(wallet.pnl / 1000).toFixed(1)}k`} icon={TrendingUp} isDark={isDark} positive />
        <Metric label="Win Rate" value={`${(wallet.winRate * 100).toFixed(0)}%`} icon={Activity} isDark={isDark} />
        <Metric label="PF" value={wallet.profitFactor.toFixed(1)} icon={TrendingUp} isDark={isDark} />
        <Metric label="Trades" value={wallet.tradeCount.toString()} icon={Activity} isDark={isDark} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  isDark,
  positive,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  isDark: boolean;
  positive?: boolean;
}) {
  return (
    <div className="text-center">
      <p className={clsx('text-xs', isDark ? 'text-white/30' : 'text-slate-400')}>{label}</p>
      <p className={clsx('text-sm font-semibold', positive ? 'text-emerald-400' : '')}>{value}</p>
    </div>
  );
}
