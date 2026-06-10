'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { X, Wallet, Shield, Sliders, AlertTriangle } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { usePolymarketStore } from '@/store/polymarketStore';
import { BotConfig } from '@/lib/polymarket';

interface ConfigModalProps {
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ onClose }) => {
  const { theme } = useThemeStore();
  const { config, updateConfig, updateStrategyConfig } = usePolymarketStore();
  const isDark = theme === 'dark';
  const [tab, setTab] = useState<'capital' | 'risk' | 'strategies'>('capital');
  const [localConfig, setLocalConfig] = useState(config);

  const handleSave = () => {
    updateConfig(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full max-w-2xl rounded-2xl border shadow-2xl',
          isDark
            ? 'border-white/[0.06] bg-[#1B1A17]'
            : 'border-slate-200 bg-white'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
          <h2 className="text-lg font-semibold">Bot Configuration</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/30 transition-colors hover:text-white/70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/[0.06] p-2">
          {[
            { key: 'capital' as const, label: 'Capital', icon: Wallet },
            { key: 'risk' as const, label: 'Risk', icon: Shield },
            { key: 'strategies' as const, label: 'Strategies', icon: Sliders },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                tab === t.key
                  ? isDark
                    ? 'bg-white/[0.08] text-white'
                    : 'bg-slate-100 text-slate-800'
                  : isDark
                    ? 'text-white/40 hover:text-white/70'
                    : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {tab === 'capital' && (
            <CapitalTab config={localConfig} setConfig={setLocalConfig} isDark={isDark} />
          )}
          {tab === 'risk' && (
            <RiskTab config={localConfig} setConfig={setLocalConfig} isDark={isDark} />
          )}
          {tab === 'strategies' && (
            <StrategiesTab config={localConfig} setConfig={setLocalConfig} isDark={isDark} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-white/[0.06] p-5">
          <button
            onClick={onClose}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              isDark
                ? 'text-white/50 hover:text-white/80'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/25"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

function CapitalTab({
  config,
  setConfig,
  isDark,
}: {
  config: BotConfig;
  setConfig: (c: BotConfig) => void;
  isDark: boolean;
}) {
  return (
    <div className="space-y-4">
      <InputField
        label="Total Capital (USD)"
        value={config.capital.totalUsd}
        onChange={(v) =>
          setConfig({
            ...config,
            capital: { ...config.capital, totalUsd: Number(v) },
          })
        }
        type="number"
        isDark={isDark}
      />
      <InputField
        label="Max Per Trade (%)"
        value={config.capital.maxPerTradePct * 100}
        onChange={(v) =>
          setConfig({
            ...config,
            capital: { ...config.capital, maxPerTradePct: Number(v) / 100 },
          })
        }
        type="number"
        isDark={isDark}
      />
      <InputField
        label="Max Per Market (%)"
        value={config.capital.maxPerMarketPct * 100}
        onChange={(v) =>
          setConfig({
            ...config,
            capital: { ...config.capital, maxPerMarketPct: Number(v) / 100 },
          })
        }
        type="number"
        isDark={isDark}
      />
      <InputField
        label="Min Order (USD)"
        value={config.capital.minOrderUsd}
        onChange={(v) =>
          setConfig({
            ...config,
            capital: { ...config.capital, minOrderUsd: Number(v) },
          })
        }
        type="number"
        isDark={isDark}
      />
    </div>
  );
}

function RiskTab({
  config,
  setConfig,
  isDark,
}: {
  config: BotConfig;
  setConfig: (c: BotConfig) => void;
  isDark: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Risk Limits</span>
        </div>
        <p className="mt-1 text-xs opacity-80">
          These are safety limits. When breached, trading will pause or halt automatically.
        </p>
      </div>

      <InputField
        label="Daily Max Loss (%)"
        value={config.risk.dailyMaxLossPct * 100}
        onChange={(v) =>
          setConfig({
            ...config,
            risk: { ...config.risk, dailyMaxLossPct: Number(v) / 100 },
          })
        }
        type="number"
        isDark={isDark}
      />
      <InputField
        label="Monthly Max Loss (%)"
        value={config.risk.monthlyMaxLossPct * 100}
        onChange={(v) =>
          setConfig({
            ...config,
            risk: { ...config.risk, monthlyMaxLossPct: Number(v) / 100 },
          })
        }
        type="number"
        isDark={isDark}
      />
      <InputField
        label="Max Drawdown (%)"
        value={config.risk.maxDrawdownPct * 100}
        onChange={(v) =>
          setConfig({
            ...config,
            risk: { ...config.risk, maxDrawdownPct: Number(v) / 100 },
          })
        }
        type="number"
        isDark={isDark}
      />
      <InputField
        label="Total Max Loss (%)"
        value={config.risk.totalMaxLossPct * 100}
        onChange={(v) =>
          setConfig({
            ...config,
            risk: { ...config.risk, totalMaxLossPct: Number(v) / 100 },
          })
        }
        type="number"
        isDark={isDark}
      />

      <div className="border-t border-white/[0.06] pt-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.risk.enableDynamicSizing}
            onChange={(e) =>
              setConfig({
                ...config,
                risk: { ...config.risk, enableDynamicSizing: e.target.checked },
              })
            }
            className="rounded border-white/20"
          />
          <span className="text-sm">Enable Dynamic Position Sizing</span>
        </label>
      </div>
    </div>
  );
}

function StrategiesTab({
  config,
  setConfig,
  isDark,
}: {
  config: BotConfig;
  setConfig: (c: BotConfig) => void;
  isDark: boolean;
}) {
  return (
    <div className="space-y-6">
      {Object.entries(config.strategies).map(([key, strategy]) => (
        <div key={key} className="rounded-xl border border-white/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={strategy.enabled}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    strategies: {
                      ...config.strategies,
                      [key]: { ...strategy, enabled: e.target.checked },
                    },
                  })
                }
                className="rounded"
              />
              <span className="text-xs">Enabled</span>
            </label>
          </div>

          <InputField
            label="Allocation (%)"
            value={strategy.allocationPct * 100}
            onChange={(v) =>
              setConfig({
                ...config,
                strategies: {
                  ...config.strategies,
                  [key]: { ...strategy, allocationPct: Number(v) / 100 },
                },
              })
            }
            type="number"
            isDark={isDark}
          />
        </div>
      ))}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  isDark,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  isDark: boolean;
}) {
  return (
    <div>
      <label className={clsx('mb-1 block text-sm', isDark ? 'text-white/50' : 'text-slate-500')}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm transition-all',
          isDark
            ? 'border-white/[0.06] bg-white/[0.04] text-white placeholder-white/20 focus:border-emerald-500/40 focus:outline-none'
            : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none'
        )}
      />
    </div>
  );
}
