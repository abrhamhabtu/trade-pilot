'use client';

import React, { useState } from 'react';
import { Plus, MoreVertical, Upload, Trash2, Edit2, ChevronDown, FileText, AlertTriangle, History, X, Download, HardDrive, DollarSign, ArrowDownLeft, ArrowUpRight, Calendar } from 'lucide-react';
import { useAccountStore, Account, AccountStatus, BalanceAdjustment } from '../../store/accountStore';
import { useThemeStore } from '../../store/themeStore';
import { toast } from '../../store/toastStore';
import { exportAllData, importBackupData, getStorageUsage, exportTradesToCSV, setLastBackupTime } from '../../hooks/useLocalStorage';
import clsx from 'clsx';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, broker: string) => void;
}

type BrokerOption = {
  label: string;
  abbr: string;
  logoClass?: string;
  logoTextClass?: string;
  logoSrc?: string;
  logoAlt?: string;
  logoBgClass?: string;
  aliases?: string[];
};

const BROKER_OPTIONS: BrokerOption[] = [
  {
    label: 'TopOne Futures',
    abbr: 'TO',
    logoSrc: '/logos/topone-futures.png',
    logoAlt: 'TopOne Futures logo',
    logoBgClass: 'bg-white',
    aliases: ['Topone Futures', 'Top One Futures']
  },
  {
    label: 'Lucid Trading',
    abbr: 'LT',
    logoClass: 'bg-gradient-to-br from-[#60A5FA] to-[#3B82F6]',
    aliases: ['Trading Lucid', 'Lucid']
  },
  {
    label: 'Topstep',
    abbr: 'TS',
    logoClass: 'bg-gradient-to-br from-[#F59E0B] to-[#F97316]'
  },
  { label: 'ProjectX', abbr: 'PX', logoClass: 'bg-[#242838]' },
  { label: 'Apex Trader Funding', abbr: 'AP', logoClass: 'bg-gradient-to-br from-[#F97316] to-[#EA580C]' },
  { label: 'My Funded Futures', abbr: 'MF', logoClass: 'bg-gradient-to-br from-[#10B981] to-[#059669]' },
  { label: 'The Trading Pit', abbr: 'TP', logoClass: 'bg-gradient-to-br from-[#34D399] to-[#10B981]' },
  { label: 'FTMO', abbr: 'FT', logoClass: 'bg-gradient-to-br from-[#0EA5E9] to-[#0284C7]' },
  { label: 'Funded Next', abbr: 'FN', logoClass: 'bg-gradient-to-br from-[#6366F1] to-[#4F46E5]' },
  { label: 'True Forex Funds', abbr: 'TF', logoClass: 'bg-gradient-to-br from-[#14B8A6] to-[#0D9488]' },
  { label: 'E8 Funding', abbr: 'E8', logoClass: 'bg-gradient-to-br from-[#EC4899] to-[#DB2777]' },
  { label: 'The5ers', abbr: '5R', logoClass: 'bg-gradient-to-br from-[#F43F5E] to-[#E11D48]' },
  { label: 'Generic Template', abbr: 'GT', logoClass: 'bg-[#334155]', logoTextClass: 'text-zinc-100' },
  { label: 'Other', abbr: 'OT', logoClass: 'bg-[#475569]', logoTextClass: 'text-zinc-100' }
];

const normalizeBrokerName = (value: string) => value.trim().toLowerCase();

const getBrokerOption = (broker: string): BrokerOption | undefined => {
  const normalized = normalizeBrokerName(broker);
  return BROKER_OPTIONS.find(option => {
    if (normalizeBrokerName(option.label) === normalized) return true;
    return (option.aliases || []).some(alias => normalizeBrokerName(alias) === normalized);
  });
};

const renderBrokerBadge = (option?: BrokerOption) => {
  if (!option) return null;

  if (option.logoSrc) {
    return (
      <div
        className={clsx(
          'h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden',
          option.logoBgClass || 'bg-white'
        )}
      >
        <img
          src={option.logoSrc}
          alt={option.logoAlt || `${option.label} logo`}
          className="h-6 w-6 object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold',
        option.logoClass,
        option.logoTextClass || 'text-white'
      )}
    >
      {option.abbr}
    </div>
  );
};

const AddAccountModal: React.FC<AddAccountModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [broker, setBroker] = useState('');
  const [showBrokerDropdown, setShowBrokerDropdown] = useState(false);
  const { theme } = useThemeStore();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && broker.trim()) {
      onAdd(name.trim(), broker.trim());
      setName('');
      setBroker('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={clsx(
          'rounded-xl border max-w-md w-full',
          theme === 'dark'
            ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
            : 'bg-white border-gray-200'
        )}
      >
        <div className={clsx(
          'p-6 border-b',
          theme === 'dark' ? 'border-white/5' : 'border-gray-200'
        )}>
          <h2 className={clsx(
            'text-xl font-bold',
            theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
          )}>Add New Account</h2>
          <p className={clsx(
            'text-sm mt-1',
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>Create a new trading account to track your trades</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Account Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Topstep Account"
              className={clsx(
                'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                theme === 'dark'
                  ? 'bg-[#181B24] border-white/5 text-zinc-100 placeholder-[#8B94A7]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              )}
              required
            />
          </div>

          <div className="relative">
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Broker / Prop Firm
            </label>
            <button
              type="button"
              onClick={() => setShowBrokerDropdown(!showBrokerDropdown)}
              className={clsx(
                'w-full px-4 py-3 rounded-lg border text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                theme === 'dark'
                  ? 'bg-[#181B24] border-white/5 text-zinc-100'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              )}
            >
              <div className="flex items-center space-x-3">
                {broker && renderBrokerBadge(getBrokerOption(broker))}
                <span className={broker ? '' : (theme === 'dark' ? 'text-zinc-400' : 'text-gray-400')}>
                  {broker || 'Select a broker...'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4" />
            </button>

            {showBrokerDropdown && (
              <div className={clsx(
                'absolute z-10 w-full mt-1 rounded-lg border shadow-xl max-h-48 overflow-y-auto',
                theme === 'dark'
                  ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
                  : 'bg-white border-gray-200'
              )}>
                {BROKER_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      setBroker(option.label);
                      setShowBrokerDropdown(false);
                    }}
                    className={clsx(
                      'w-full px-4 py-2 text-left text-sm transition-colors',
                      theme === 'dark'
                        ? 'text-zinc-100 hover:bg-[#242838]'
                        : 'text-gray-900 hover:bg-gray-100',
                      broker === option.label && (theme === 'dark' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-purple-50 text-purple-600')
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      {renderBrokerBadge(option)}
                      <span>{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'flex-1 px-4 py-3 rounded-lg border font-medium transition-all',
                theme === 'dark'
                  ? 'border-white/5 text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50'
                  : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:border-purple-300'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all"
            >
              Add Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// GitHub-style Delete Confirmation Modal
interface DeleteConfirmModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ isOpen, account, onClose, onConfirm }) => {
  const [confirmText, setConfirmText] = useState('');
  const { theme } = useThemeStore();

  if (!isOpen || !account) return null;

  const isConfirmValid = confirmText === account.name;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmValid) {
      onConfirm();
      setConfirmText('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className={clsx(
        'rounded-xl border max-w-lg w-full',
        theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5' : 'bg-white border-gray-200'
      )}>
        {/* Warning Header */}
        <div className={clsx(
          'p-6 border-b',
          theme === 'dark' ? 'border-white/5 bg-red-500/5' : 'border-gray-200 bg-red-50'
        )}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-red-500/20">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className={clsx(
                'text-xl font-bold',
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
              )}>Delete Account</h2>
              <p className={clsx(
                'text-sm',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>This action cannot be undone</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Warning Message */}
          <div className={clsx(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
          )}>
            <p className={clsx('text-sm', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
              This will permanently delete the account <strong>"{account.name}"</strong> including:
            </p>
            <ul className={clsx('mt-2 space-y-1 text-sm', theme === 'dark' ? 'text-red-400/80' : 'text-red-500')}>
              <li>• {account.trades.length} trade{account.trades.length !== 1 ? 's' : ''}</li>
              <li>• {(account.importHistory || []).length} import record{(account.importHistory || []).length !== 1 ? 's' : ''}</li>
              <li>• All account statistics and history</li>
            </ul>
          </div>

          {/* Confirmation Input */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              To confirm, type <span className="font-mono font-bold text-red-500">"{account.name}"</span> below:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type account name to confirm..."
              className={clsx(
                'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all font-mono',
                isConfirmValid
                  ? 'focus:ring-red-500/50 border-red-500'
                  : 'focus:ring-[#3BF68A]/50',
                theme === 'dark'
                  ? 'bg-[#181B24] border-white/5 text-zinc-100 placeholder-[#8B94A7]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              )}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={() => { onClose(); setConfirmText(''); }}
              className={clsx(
                'flex-1 px-4 py-3 rounded-lg border font-medium transition-all',
                theme === 'dark'
                  ? 'border-white/5 text-zinc-400 hover:text-zinc-100'
                  : 'border-gray-300 text-gray-600 hover:text-gray-900'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConfirmValid}
              className={clsx(
                'flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2',
                isConfirmValid
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-red-500/30 text-red-500/50 cursor-not-allowed'
              )}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Forever</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Import History Modal
interface ImportHistoryModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onDeleteEntry: (entryId: string) => void;
}

const ImportHistoryModal: React.FC<ImportHistoryModalProps> = ({ isOpen, account, onClose, onDeleteEntry }) => {
  const { theme } = useThemeStore();
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [confirmInput, setConfirmInput] = React.useState('');

  // Reset confirmation when modal closes or confirmDeleteId changes
  React.useEffect(() => {
    if (!isOpen) {
      setConfirmDeleteId(null);
      setConfirmInput('');
    }
  }, [isOpen]);

  React.useEffect(() => {
    setConfirmInput('');
  }, [confirmDeleteId]);

  if (!isOpen || !account) return null;

  const importHistory = account.importHistory || [];
  const entryToDelete = confirmDeleteId ? importHistory.find(e => e.id === confirmDeleteId) : null;

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(value));
    return value < 0 ? `-${formatted}` : formatted;
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId && entryToDelete && confirmInput.toUpperCase() === 'DELETE') {
      onDeleteEntry(confirmDeleteId);
      setConfirmDeleteId(null);
      setConfirmInput('');
    }
  };

  const isDeleteEnabled = confirmInput.toUpperCase() === 'DELETE';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={clsx(
        'rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-hidden',
        theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5' : 'bg-white border-gray-200'
      )}>
        {/* Header */}
        <div className={clsx(
          'p-6 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-white/5' : 'border-gray-200'
        )}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-[#242838]">
              <History className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <h2 className={clsx(
                'text-xl font-bold',
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
              )}>Import History</h2>
              <p className={clsx(
                'text-sm',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>{account.name} • {importHistory.length} import{importHistory.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              theme === 'dark'
                ? 'text-zinc-400 hover:text-zinc-100 hover:bg-[#242838]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {importHistory.length === 0 ? (
            <div className={clsx(
              'text-center py-12 rounded-lg border',
              theme === 'dark' ? 'bg-[#181B24] border-white/5' : 'bg-gray-50 border-gray-200'
            )}>
              <FileText className={clsx('h-12 w-12 mx-auto mb-3', theme === 'dark' ? 'text-zinc-400' : 'text-gray-400')} />
              <p className={clsx('text-sm font-medium', theme === 'dark' ? 'text-zinc-100' : 'text-gray-700')}>
                No import history recorded
              </p>
              <p className={clsx('text-xs mt-2 max-w-sm mx-auto', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')}>
                Import history tracking was just added. Your next CSV import will be recorded here with file name, date, trades count, and P&L.
              </p>
              <div className={clsx(
                'mt-4 p-3 rounded-lg text-xs text-left max-w-sm mx-auto',
                theme === 'dark' ? 'bg-[#242838]/50' : 'bg-gray-100'
              )}>
                <p className={clsx('font-medium mb-1', theme === 'dark' ? 'text-zinc-400' : 'text-purple-600')}>
                  What gets tracked:
                </p>
                <ul className={clsx('space-y-1', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')}>
                  <li>• File name (e.g., trades_jan2026.csv)</li>
                  <li>• Import date & time</li>
                  <li>• Number of trades imported</li>
                  <li>• Total P&L from those trades</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {importHistory.slice().reverse().map((entry) => (
                <div
                  key={entry.id}
                  className={clsx(
                    'p-4 rounded-lg border transition-all',
                    theme === 'dark'
                      ? 'bg-[#181B24] border-white/5 hover:border-emerald-500/30'
                      : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={clsx(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-[#242838]' : 'bg-gray-200'
                      )}>
                        <FileText className={clsx('h-5 w-5', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')} />
                      </div>
                      <div>
                        <p className={clsx(
                          'font-medium text-sm',
                          theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                        )}>
                          {entry.fileName}
                        </p>
                        <p className={clsx(
                          'text-xs mt-1',
                          theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                        )}>
                          Imported on {entry.importedAt}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDeleteId(entry.id)}
                      className={clsx(
                        'p-1.5 rounded-lg transition-colors',
                        theme === 'dark'
                          ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      )}
                      title="Remove from history"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className={clsx(
                      'p-3 rounded-lg',
                      theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md' : 'bg-white border border-gray-200'
                    )}>
                      <p className={clsx('text-xs', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')}>
                        Trades
                      </p>
                      <p className={clsx(
                        'text-lg font-bold mt-1',
                        theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                      )}>
                        {entry.tradesImported}
                      </p>
                    </div>
                    <div className={clsx(
                      'p-3 rounded-lg',
                      theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md' : 'bg-white border border-gray-200'
                    )}>
                      <p className={clsx('text-xs', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')}>
                        P&L
                      </p>
                      <p className={clsx(
                        'text-lg font-bold mt-1',
                        entry.totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      )}>
                        {formatCurrency(entry.totalPnL)}
                      </p>
                    </div>
                    <div className={clsx(
                      'p-3 rounded-lg',
                      theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md' : 'bg-white border border-gray-200'
                    )}>
                      <p className={clsx('text-xs', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')}>
                        Date Range
                      </p>
                      <p className={clsx(
                        'text-sm font-medium mt-1',
                        theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                      )}>
                        {entry.dateRange
                          ? `${entry.dateRange.from.slice(5)} - ${entry.dateRange.to.slice(5)}`
                          : '—'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Overlay */}
        {confirmDeleteId && entryToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-[60]">
            <div className={clsx(
              'rounded-xl border max-w-md w-full shadow-2xl',
              theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5' : 'bg-white border-gray-200'
            )}>
              {/* Header */}
              <div className={clsx(
                'p-5 border-b',
                theme === 'dark' ? 'border-white/5' : 'border-gray-200'
              )}>
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className={clsx(
                      'text-lg font-bold',
                      theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                    )}>Delete Import Record</h3>
                    <p className={clsx(
                      'text-sm',
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                    )}>This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5">
                <div className={clsx(
                  'p-4 rounded-lg mb-4',
                  theme === 'dark' ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
                )}>
                  <p className={clsx(
                    'text-sm',
                    theme === 'dark' ? 'text-red-400' : 'text-red-700'
                  )}>
                    You are about to delete the import record for:
                  </p>
                  <p className={clsx(
                    'font-mono font-bold mt-2 text-sm break-all',
                    theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                  )}>
                    {entryToDelete.fileName}
                  </p>
                  <p className={clsx(
                    'text-xs mt-2',
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                  )}>
                    {entryToDelete.tradesImported} trades • {formatCurrency(entryToDelete.totalPnL)} P&L
                  </p>
                </div>

                <p className={clsx(
                  'text-sm mb-3',
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                )}>
                  To confirm, type <span className="font-bold text-red-500">DELETE</span> below:
                </p>

                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="DELETE"
                  className={clsx(
                    'w-full px-4 py-3 rounded-lg border text-sm',
                    theme === 'dark'
                      ? 'bg-[#181B24] border-white/5 text-zinc-100 placeholder-[#4B5563]'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-red-500/50'
                  )}
                  autoFocus
                />
              </div>

              {/* Footer */}
              <div className={clsx(
                'p-5 border-t flex justify-end space-x-3',
                theme === 'dark' ? 'border-white/5' : 'border-gray-200'
              )}>
                <button
                  onClick={() => {
                    setConfirmDeleteId(null);
                    setConfirmInput('');
                  }}
                  className={clsx(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    theme === 'dark'
                      ? 'text-zinc-400 hover:text-zinc-100 hover:bg-[#242838]'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={!isDeleteEnabled}
                  className={clsx(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    isDeleteEnabled
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : theme === 'dark'
                        ? 'bg-[#242838] text-[#4B5563] cursor-not-allowed'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Add Adjustment Modal
interface AddAdjustmentModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onAdd: (adjustment: Omit<BalanceAdjustment, 'id' | 'createdAt'>) => void;
}

const AddAdjustmentModal: React.FC<AddAdjustmentModalProps> = ({ isOpen, account, onClose, onAdd }) => {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'payout' | 'deposit' | 'adjustment'>('payout');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const { theme } = useThemeStore();

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setAmount('');
      setType('payout');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    }
  }, [isOpen]);

  if (!isOpen || !account) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // For payouts, make the amount negative
    const finalAmount = type === 'payout' ? -Math.abs(numAmount) : Math.abs(numAmount);

    onAdd({
      date,
      amount: finalAmount,
      type,
      description: description.trim() || undefined
    });

    onClose();
  };

  const typeOptions = [
    { value: 'payout', label: 'Payout', icon: ArrowUpRight, color: '#F45B69', desc: 'Money withdrawn from account' },
    { value: 'deposit', label: 'Deposit', icon: ArrowDownLeft, color: '#3BF68A', desc: 'Money added to account' },
    { value: 'adjustment', label: 'Adjustment', icon: DollarSign, color: '#A78BFA', desc: 'Manual balance correction' }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={clsx(
          'rounded-xl border max-w-md w-full',
          theme === 'dark'
            ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
            : 'bg-white border-gray-200'
        )}
      >
        <div className={clsx(
          'p-6 border-b',
          theme === 'dark' ? 'border-white/5' : 'border-gray-200'
        )}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h2 className={clsx(
                'text-xl font-bold',
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
              )}>Add Balance Adjustment</h2>
              <p className={clsx(
                'text-sm mt-1',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>Record a payout, deposit, or manual adjustment</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type Selection */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-3',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value as 'payout' | 'deposit' | 'adjustment')}
                    className={clsx(
                      'p-3 rounded-lg border-2 transition-all text-center',
                      type === option.value
                        ? theme === 'dark'
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : 'border-purple-500 bg-purple-50'
                        : theme === 'dark'
                          ? 'border-white/5 hover:border-emerald-500/50'
                          : 'border-gray-200 hover:border-purple-300'
                    )}
                  >
                    <Icon 
                      className="h-5 w-5 mx-auto mb-1" 
                      style={{ color: type === option.value ? option.color : (theme === 'dark' ? '#8B94A7' : '#6B7280') }} 
                    />
                    <div className={clsx(
                      'text-xs font-semibold',
                      type === option.value
                        ? (theme === 'dark' ? 'text-zinc-100' : 'text-gray-900')
                        : (theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')
                    )}>
                      {option.label}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className={clsx(
              'text-xs mt-2',
              theme === 'dark' ? 'text-[#6B7280]' : 'text-gray-400'
            )}>
              {typeOptions.find(o => o.value === type)?.desc}
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Amount
            </label>
            <div className="relative">
              <span className={clsx(
                'absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold',
                type === 'payout' ? 'text-rose-500' : 'text-emerald-500'
              )}>
                {type === 'payout' ? '-$' : '+$'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={clsx(
                  'w-full pl-12 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all text-lg font-semibold',
                  theme === 'dark'
                    ? 'bg-[#181B24] border-white/5 text-zinc-100 placeholder-[#4B5563]'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
                )}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Date
            </label>
            <div className="relative">
              <Calendar className={clsx(
                'absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-400'
              )} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={clsx(
                  'w-full pl-11 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                  theme === 'dark'
                    ? 'bg-[#181B24] border-white/5 text-zinc-100'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                )}
                required
              />
            </div>
          </div>

          {/* Description (Optional) */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Note <span className={theme === 'dark' ? 'text-[#6B7280]' : 'text-gray-400'}>(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., January payout, Account correction..."
              className={clsx(
                'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                theme === 'dark'
                  ? 'bg-[#181B24] border-white/5 text-zinc-100 placeholder-[#4B5563]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              )}
            />
          </div>

          {/* Preview */}
          <div className={clsx(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-[#181B24] border-white/5' : 'bg-gray-50 border-gray-200'
          )}>
            <div className="flex items-center justify-between">
              <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>
                Balance impact:
              </span>
              <span className={clsx(
                'text-lg font-bold',
                type === 'payout' ? 'text-rose-500' : 'text-emerald-500'
              )}>
                {type === 'payout' ? '-' : '+'}${parseFloat(amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'flex-1 px-4 py-3 rounded-lg border font-medium transition-all',
                theme === 'dark'
                  ? 'border-white/5 text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50'
                  : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:border-purple-300'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all"
            >
              Add Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Adjustments List Modal
interface AdjustmentsListModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onDelete: (adjustmentId: string) => void;
  onAddNew: () => void;
}

const AdjustmentsListModal: React.FC<AdjustmentsListModalProps> = ({ isOpen, account, onClose, onDelete, onAddNew }) => {
  const { theme } = useThemeStore();
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  if (!isOpen || !account) return null;

  const adjustments = account.balanceAdjustments || [];

  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(value));
    return value < 0 ? `-${formatted}` : `+${formatted}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const totalAdjustments = adjustments.reduce((sum, adj) => sum + adj.amount, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={clsx(
        'rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-hidden',
        theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5' : 'bg-white border-gray-200'
      )}>
        {/* Header */}
        <div className={clsx(
          'p-6 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-white/5' : 'border-gray-200'
        )}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h2 className={clsx(
                'text-xl font-bold',
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
              )}>Balance Adjustments</h2>
              <p className={clsx(
                'text-sm',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>{account.name} • {adjustments.length} adjustment{adjustments.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onAddNew}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add New</span>
            </button>
            <button
              onClick={onClose}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'text-zinc-400 hover:text-zinc-100 hover:bg-[#242838]'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              )}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className={clsx(
          'px-6 py-4 border-b',
          theme === 'dark' ? 'border-white/5 bg-[#181B24]' : 'border-gray-200 bg-gray-50'
        )}>
          <div className="flex items-center justify-between">
            <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>
              Total Impact on Balance:
            </span>
            <span className={clsx(
              'text-xl font-bold',
              totalAdjustments >= 0 ? 'text-emerald-500' : 'text-rose-500'
            )}>
              {formatCurrency(totalAdjustments)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {adjustments.length === 0 ? (
            <div className={clsx(
              'text-center py-12 rounded-lg border',
              theme === 'dark' ? 'bg-[#181B24] border-white/5' : 'bg-gray-50 border-gray-200'
            )}>
              <DollarSign className={clsx('h-12 w-12 mx-auto mb-3', theme === 'dark' ? 'text-zinc-400' : 'text-gray-400')} />
              <p className={clsx('text-sm font-medium', theme === 'dark' ? 'text-zinc-100' : 'text-gray-700')}>
                No adjustments recorded
              </p>
              <p className={clsx('text-xs mt-2 max-w-sm mx-auto', theme === 'dark' ? 'text-zinc-400' : 'text-gray-500')}>
                Record payouts, deposits, or manual corrections to keep your balance accurate.
              </p>
              <button
                onClick={onAddNew}
                className="mt-4 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all text-sm"
              >
                Add Your First Adjustment
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {adjustments.map((adjustment) => (
                <div
                  key={adjustment.id}
                  className={clsx(
                    'p-4 rounded-lg border transition-all',
                    theme === 'dark'
                      ? 'bg-[#181B24] border-white/5 hover:border-emerald-500/30'
                      : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={clsx(
                        'p-2 rounded-lg',
                        adjustment.type === 'payout'
                          ? 'bg-rose-500/10'
                          : adjustment.type === 'deposit'
                            ? 'bg-emerald-500/10'
                            : 'bg-[#242838]'
                      )}>
                        {adjustment.type === 'payout' ? (
                          <ArrowUpRight className="h-5 w-5 text-rose-500" />
                        ) : adjustment.type === 'deposit' ? (
                          <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <DollarSign className="h-5 w-5 text-zinc-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={clsx(
                            'font-semibold capitalize',
                            theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                          )}>
                            {adjustment.type}
                          </span>
                          <span className={clsx(
                            'text-lg font-bold',
                            adjustment.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          )}>
                            {formatCurrency(adjustment.amount)}
                          </span>
                        </div>
                        <p className={clsx(
                          'text-xs mt-1',
                          theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                        )}>
                          {formatDate(adjustment.date)}
                          {adjustment.description && ` • ${adjustment.description}`}
                        </p>
                      </div>
                    </div>
                    
                    {confirmDeleteId === adjustment.id ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            onDelete(adjustment.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className={clsx(
                            'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                            theme === 'dark'
                              ? 'bg-[#242838] text-zinc-400 hover:text-zinc-100'
                              : 'bg-gray-200 text-gray-600 hover:text-gray-900'
                          )}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(adjustment.id)}
                        className={clsx(
                          'p-1.5 rounded-lg transition-colors',
                          theme === 'dark'
                            ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                        )}
                        title="Delete adjustment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Edit Account Modal
interface EditAccountModalProps {
  account: Account | null;
  onClose: () => void;
  onSave: (id: string, name: string, broker: string, status: AccountStatus) => void;
  onImport: (accountId: string) => void;
  onClearTrades: (accountId: string) => void;
  onShowImportHistory: (account: Account) => void;
  onShowDeleteConfirm: (account: Account) => void;
}

const EditAccountModal: React.FC<EditAccountModalProps> = ({
  account,
  onClose,
  onSave,
  onImport,
  onClearTrades,
  onShowImportHistory,
  onShowDeleteConfirm
}) => {
  const [name, setName] = useState(account?.name || '');
  const [broker, setBroker] = useState(account?.broker || '');
  const [status, setStatus] = useState<AccountStatus>(account?.status || 'active');
  const [showBrokerDropdown, setShowBrokerDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { theme } = useThemeStore();

  // Update state when account changes
  React.useEffect(() => {
    if (account) {
      setName(account.name);
      setBroker(account.broker);
      setStatus(account.status || 'active');
    }
  }, [account]);

  if (!account) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && broker.trim()) {
      onSave(account.id, name.trim(), broker.trim(), status);
      onClose();
    }
  };

  const handleClearTrades = () => {
    onClearTrades(account.id);
    setShowClearConfirm(false);
    toast.success(`Cleared all trades from ${account.name}`);
  };

  const handleImport = () => {
    onImport(account.id);
    onClose();
  };

  const importCount = (account.importHistory || []).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={clsx(
          'rounded-xl border max-w-md w-full',
          theme === 'dark'
            ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
            : 'bg-white border-gray-200'
        )}
      >
        {/* Header */}
        <div className={clsx(
          'p-6 border-b',
          theme === 'dark' ? 'border-white/5' : 'border-gray-200'
        )}>
          <h2 className={clsx(
            'text-xl font-bold',
            theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
          )}>Edit Account</h2>
          <p className={clsx(
            'text-sm mt-1',
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>Update account details or manage trades</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Account Name */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Account Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Topstep Account"
              className={clsx(
                'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                theme === 'dark'
                  ? 'bg-[#181B24] border-white/5 text-zinc-100 placeholder-[#8B94A7]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              )}
              required
            />
          </div>

          {/* Broker Dropdown */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Broker / Platform
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowBrokerDropdown(!showBrokerDropdown);
                  setShowStatusDropdown(false);
                }}
                className={clsx(
                  'w-full px-4 py-3 rounded-lg border text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                  theme === 'dark'
                    ? 'bg-[#181B24] border-white/5 text-zinc-100'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                )}
              >
                <div className="flex items-center space-x-3">
                  {broker && renderBrokerBadge(getBrokerOption(broker))}
                  <span className={!broker ? (theme === 'dark' ? 'text-zinc-400' : 'text-gray-400') : ''}>
                    {broker || 'Select a broker'}
                  </span>
                </div>
                <ChevronDown className={clsx(
                  'h-5 w-5 transition-transform',
                  showBrokerDropdown && 'rotate-180'
                )} />
              </button>

              {showBrokerDropdown && (
                <div className={clsx(
                  'absolute z-20 w-full mt-1 rounded-lg border shadow-xl max-h-48 overflow-y-auto',
                  theme === 'dark'
                    ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
                    : 'bg-white border-gray-200'
                )}>
                  {BROKER_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => {
                        setBroker(option.label);
                        setShowBrokerDropdown(false);
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm transition-colors',
                        theme === 'dark'
                          ? 'text-zinc-100 hover:bg-[#242838]'
                          : 'text-gray-700 hover:bg-gray-100',
                        broker === option.label && (theme === 'dark' ? 'bg-[#242838]' : 'bg-gray-100')
                      )}
                    >
                      <div className="flex items-center space-x-3">
                        {renderBrokerBadge(option)}
                        <span>{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status Dropdown */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
            )}>
              Account Status
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowStatusDropdown(!showStatusDropdown);
                  setShowBrokerDropdown(false);
                }}
                className={clsx(
                  'w-full px-4 py-3 rounded-lg border text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                  theme === 'dark'
                    ? 'bg-[#181B24] border-white/5 text-zinc-100'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                )}
              >
                <div className="flex items-center space-x-2">
                  <div className={clsx(
                    'w-2 h-2 rounded-full',
                    status === 'active' ? 'bg-emerald-500' :
                      status === 'passed_eval' ? 'bg-[#60A5FA]' :
                        status === 'blown' ? 'bg-rose-500' :
                          'bg-yellow-400'
                  )} />
                  <span className="capitalize">
                    {status === 'inactive' ? 'Paid Out' : status === 'passed_eval' ? 'Passed Eval' : status}
                  </span>
                  {status === 'inactive' && <span>🏆</span>}
                  {status === 'passed_eval' && <span>🎯</span>}
                </div>
                <ChevronDown className={clsx(
                  'h-5 w-5 transition-transform',
                  showStatusDropdown && 'rotate-180'
                )} />
              </button>

              {showStatusDropdown && (
                <div className={clsx(
                  'absolute z-20 w-full mt-1 rounded-lg border shadow-xl',
                  theme === 'dark'
                    ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
                    : 'bg-white border-gray-200'
                )}>
                  {(['active', 'passed_eval', 'blown', 'inactive'] as AccountStatus[]).map((option) => {
                    const isPaidOut = option === 'inactive';
                    const isPassedEval = option === 'passed_eval';
                    const label = isPaidOut ? 'Paid Out' : isPassedEval ? 'Passed Eval' : option;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setStatus(option);
                          setShowStatusDropdown(false);
                        }}
                        className={clsx(
                          'w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                          theme === 'dark'
                            ? 'text-zinc-100 hover:bg-[#242838]'
                            : 'text-gray-700 hover:bg-gray-100',
                          status === option && (theme === 'dark' ? 'bg-[#242838]' : 'bg-gray-100')
                        )}
                      >
                        <div className={clsx(
                          'w-2 h-2 rounded-full',
                          option === 'active' ? 'bg-emerald-500' :
                            option === 'passed_eval' ? 'bg-[#60A5FA]' :
                              option === 'blown' ? 'bg-rose-500' :
                                'bg-yellow-400'
                        )} />
                        <span className="capitalize">{label}</span>
                        {isPaidOut && <span className="ml-auto text-xs">🏆</span>}
                        {isPassedEval && <span className="ml-auto text-xs">🎯</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Account Stats */}
          <div className={clsx(
            'rounded-lg p-4 border',
            theme === 'dark' ? 'bg-[#181B24] border-white/5' : 'bg-gray-50 border-gray-200'
          )}>
            <div className="flex justify-between items-center mb-2">
              <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>Total Trades</span>
              <span className={clsx('font-semibold', theme === 'dark' ? 'text-zinc-100' : 'text-gray-900')}>
                {account.trades.length}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>Balance</span>
              <span className={clsx('font-semibold', account.balance >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                ${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>CSV Imports</span>
              <button
                type="button"
                onClick={() => onShowImportHistory(account)}
                className={clsx(
                  'font-semibold flex items-center space-x-1 hover:underline',
                  theme === 'dark' ? 'text-zinc-400' : 'text-purple-600'
                )}
              >
                <span>{importCount}</span>
                {importCount > 0 && <History className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleImport}
              className={clsx(
                'w-full px-4 py-3 rounded-lg border font-medium flex items-center justify-center space-x-2 transition-all',
                theme === 'dark'
                  ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                  : 'border-green-300 text-green-600 hover:bg-green-50'
              )}
            >
              <Upload className="h-4 w-4" />
              <span>Import Trades</span>
            </button>

            <button
              type="button"
              onClick={() => onShowImportHistory(account)}
              className={clsx(
                'w-full px-4 py-3 rounded-lg border font-medium flex items-center justify-center space-x-2 transition-all',
                theme === 'dark'
                  ? 'border-zinc-700 text-zinc-400 hover:bg-[#242838]'
                  : 'border-purple-300 text-purple-600 hover:bg-purple-50'
              )}
            >
              <History className="h-4 w-4" />
              <span>{importCount > 0 ? `View Import History (${importCount})` : 'View Import History'}</span>
            </button>

            {account.trades.length > 0 && (
              <>
                {!showClearConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className={clsx(
                      'w-full px-4 py-3 rounded-lg border font-medium flex items-center justify-center space-x-2 transition-all',
                      theme === 'dark'
                        ? 'border-white/5 text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50'
                        : 'border-gray-300 text-gray-600 hover:text-gray-900'
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Clear All Trades</span>
                  </button>
                ) : (
                  <div className={clsx(
                    'p-3 rounded-lg border',
                    theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'
                  )}>
                    <p className={clsx('text-sm mb-2', theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700')}>
                      Clear all {account.trades.length} trades? This cannot be undone.
                    </p>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleClearTrades}
                        className="flex-1 px-3 py-2 bg-yellow-500 text-black text-sm font-medium rounded-lg hover:bg-yellow-400 transition-all"
                      >
                        Yes, Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(false)}
                        className={clsx(
                          'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all',
                          theme === 'dark'
                            ? 'border-white/5 text-zinc-400 hover:text-zinc-100'
                            : 'border-gray-300 text-gray-600 hover:text-gray-900'
                        )}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Delete Account Section */}
          {account.type !== 'demo' && (
            <div className={clsx(
              'pt-4 border-t',
              theme === 'dark' ? 'border-white/5' : 'border-gray-200'
            )}>
              <button
                type="button"
                onClick={() => onShowDeleteConfirm(account)}
                className="w-full px-4 py-3 rounded-lg border border-red-500/30 text-red-500 font-medium flex items-center justify-center space-x-2 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Account</span>
              </button>
            </div>
          )}

          {/* Delete Account Section */}
          {account.type !== 'demo' && (
            <div className={clsx(
              'pt-4 border-t',
              theme === 'dark' ? 'border-white/5' : 'border-gray-200'
            )}>
              <button
                type="button"
                onClick={() => onShowDeleteConfirm(account)}
                className="w-full px-4 py-3 rounded-lg border border-red-500/30 text-red-500 font-medium flex items-center justify-center space-x-2 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Account</span>
              </button>
            </div>
          )}

          {/* Form Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={clsx(
                'flex-1 px-4 py-3 rounded-lg border font-medium transition-all',
                theme === 'dark'
                  ? 'border-white/5 text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50'
                  : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:border-purple-300'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AccountActionsMenuProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onImport: () => void;
  onStatusChange: (status: AccountStatus) => void;
  onClearTrades: () => void;
  onAdjustBalance: () => void;
}

const AccountActionsMenu: React.FC<AccountActionsMenuProps> = ({ account, onEdit, onDelete, onImport, onStatusChange, onClearTrades, onAdjustBalance }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const { theme } = useThemeStore();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 192 // 192px = w-48 (12rem)
      });
    }

    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={clsx(
          'p-2 rounded-lg transition-colors',
          theme === 'dark'
            ? 'text-zinc-400 hover:text-zinc-100 hover:bg-[#242838]'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        )}
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={clsx(
              'fixed w-48 rounded-lg border shadow-xl z-50',
              theme === 'dark'
                ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
                : 'bg-white border-gray-200'
            )}
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              onClick={() => { onImport(); setIsOpen(false); }}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                theme === 'dark'
                  ? 'text-zinc-100 hover:bg-[#242838]'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Upload className="h-4 w-4" />
              <span>Import Trades</span>
            </button>
            <button
              onClick={() => { onEdit(); setIsOpen(false); }}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                theme === 'dark'
                  ? 'text-zinc-100 hover:bg-[#242838]'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Edit2 className="h-4 w-4" />
              <span>Edit Account</span>
            </button>
            <button
              onClick={() => { onAdjustBalance(); setIsOpen(false); }}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                theme === 'dark'
                  ? 'text-emerald-500 hover:bg-emerald-500/10'
                  : 'text-green-600 hover:bg-green-50'
              )}
            >
              <DollarSign className="h-4 w-4" />
              <span>Adjust Balance</span>
            </button>

            <div className={clsx('my-1 border-t', theme === 'dark' ? 'border-white/5' : 'border-gray-100')} />

            {/* Status Options */}
            <div className="px-2 py-1">
              <p className={clsx('text-xs px-2 mb-1 uppercase font-semibold', theme === 'dark' ? 'text-zinc-400' : 'text-gray-400')}>
                Set Status
              </p>
              {(['active', 'passed_eval', 'blown', 'inactive'] as AccountStatus[]).map((status) => {
                const isPaidOut = status === 'inactive';
                const isPassedEval = status === 'passed_eval';
                const label = isPaidOut ? 'Paid Out' : isPassedEval ? 'Passed Eval' : status;

                return (
                  <button
                    key={status}
                    onClick={() => { onStatusChange(status); setIsOpen(false); }}
                    className={clsx(
                      'w-full px-2 py-1.5 text-left text-sm rounded flex items-center space-x-2 transition-colors',
                      account.status === status
                        ? (theme === 'dark'
                          ? (isPaidOut ? 'bg-yellow-500/10 text-yellow-400' : isPassedEval ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-500')
                          : (isPaidOut ? 'bg-yellow-50 text-yellow-600' : isPassedEval ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'))
                        : (theme === 'dark' ? 'text-zinc-400 hover:bg-[#242838] hover:text-zinc-100' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')
                    )}
                  >
                    <div className={clsx(
                      'w-1.5 h-1.5 rounded-full',
                      status === 'active' ? 'bg-emerald-500' :
                        status === 'passed_eval' ? 'bg-[#60A5FA]' :
                          status === 'blown' ? 'bg-rose-500' :
                            'bg-yellow-400'
                    )} />
                    <span className="capitalize font-medium">{label}</span>
                    {isPaidOut && <span className="ml-auto text-xs">🏆</span>}
                    {isPassedEval && <span className="ml-auto text-xs">🎯</span>}
                  </button>
                );
              })}
            </div>

            <div className={clsx('my-1 border-t', theme === 'dark' ? 'border-white/5' : 'border-gray-100')} />

            <button
              onClick={() => { onClearTrades(); setIsOpen(false); }}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                'text-orange-500 hover:bg-orange-500/10'
              )}
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear All Trades</span>
            </button>

            {account.type !== 'demo' && (
              <button
                onClick={() => { onDelete(); setIsOpen(false); }}
                className={clsx(
                  'w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                  'text-red-500 hover:bg-red-500/10'
                )}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Account</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface AccountsPageProps {
  onImportForAccount: (accountId: string) => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({ onImportForAccount }) => {
  const { accounts, addAccount, updateAccount, deleteAccount, selectAccount, selectedAccountId, deleteImportHistoryEntry, clearAccountTrades, addBalanceAdjustment, deleteBalanceAdjustment } = useAccountStore();
  const { theme } = useThemeStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showImportHistory, setShowImportHistory] = useState<Account | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Account | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [showAdjustments, setShowAdjustments] = useState<Account | null>(null);
  const [showAddAdjustment, setShowAddAdjustment] = useState<Account | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleAddAccount = (name: string, broker: string) => {
    const id = addAccount({ name, broker, type: 'file_upload' });
    toast.success(`Account "${name}" created`);
    selectAccount(id);
  };

  const handleSaveAccount = (id: string, name: string, broker: string, status: AccountStatus) => {
    updateAccount(id, { name, broker, status });
    toast.success(`Account "${name}" updated`);
  };

  const handleStatusChange = (accountId: string, status: AccountStatus) => {
    updateAccount(accountId, { status });
    toast.success('Account status updated');
  };

  const handleClearTrades = (accountId: string) => {
    updateAccount(accountId, { trades: [], balance: 0, importHistory: [] });
  };

  const handleDeleteAccount = (account: Account) => {
    deleteAccount(account.id);
    setShowDeleteConfirm(null);
    setEditingAccount(null);
    toast.success(`Account "${account.name}" deleted`);
  };

  const handleDeleteImportEntry = (entryId: string) => {
    if (showImportHistory) {
      deleteImportHistoryEntry(showImportHistory.id, entryId);
      toast.success('Import record removed');
    }
  };

  const handleAddAdjustment = (adjustment: Omit<BalanceAdjustment, 'id' | 'createdAt'>) => {
    if (showAddAdjustment) {
      addBalanceAdjustment(showAddAdjustment.id, adjustment);
      const typeLabel = adjustment.type === 'payout' ? 'Payout' : adjustment.type === 'deposit' ? 'Deposit' : 'Adjustment';
      toast.success(`${typeLabel} recorded successfully`);
    }
  };

  const handleDeleteAdjustment = (adjustmentId: string) => {
    if (showAdjustments) {
      deleteBalanceAdjustment(showAdjustments.id, adjustmentId);
      toast.success('Adjustment removed');
    }
  };

  // Keep the adjustments modal in sync with store updates
  React.useEffect(() => {
    if (!showAdjustments) return;
    const updatedAccount = accounts.find(a => a.id === showAdjustments.id);
    if (updatedAccount) {
      setShowAdjustments(updatedAccount);
    } else {
      setShowAdjustments(null);
    }
  }, [accounts, showAdjustments?.id]);

  // Keep the import history modal in sync with store updates
  React.useEffect(() => {
    if (!showImportHistory) return;
    const updatedAccount = accounts.find(a => a.id === showImportHistory.id);
    if (updatedAccount) {
      setShowImportHistory(updatedAccount);
    } else {
      setShowImportHistory(null);
    }
  }, [accounts, showImportHistory?.id]);

  const formatBalance = (balance: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.abs(balance));

    if (balance < 0) {
      return `-${formatted}`;
    }
    return formatted;
  };

  const getBrokerIcon = (broker: string) => {
    // Simple emoji-based icons for different brokers
    if (broker.toLowerCase().includes('topstep')) return '📈';
    if (broker.toLowerCase().includes('apex')) return '🏔️';
    if (broker.toLowerCase().includes('ftmo')) return '💎';
    if (broker.toLowerCase().includes('funded')) return '💰';
    if (broker.toLowerCase().includes('projectx')) return '🚀';
    if (broker.toLowerCase().includes('template') || broker.toLowerCase().includes('generic')) return '📋';
    return '📊';
  };

  const getTypeLabel = (type: Account['type']) => {
    switch (type) {
      case 'file_upload': return 'File upload';
      case 'demo': return 'Demo';
      case 'manual': return 'Manual';
      default: return type;
    }
  };

  const activeAccounts = accounts.filter(a => (a.status || 'active') === 'active');
  const inactiveAccounts = accounts.filter(a => (a.status || 'active') !== 'active');

  const renderAccountRow = (account: Account) => (
    <div
      key={account.id}
      className={clsx(
        'grid grid-cols-6 gap-4 px-6 py-4 items-center border-b transition-colors cursor-pointer',
        theme === 'dark'
          ? 'border-white/5 hover:bg-[#181B24]/80 backdrop-blur-md'
          : 'border-gray-100 hover:bg-gray-50',
        selectedAccountId === account.id && (
          theme === 'dark'
            ? 'bg-emerald-500/5 border-l-2 border-l-[#3BF68A]'
            : 'bg-purple-50 border-l-2 border-l-purple-500'
        )
      )}
      onClick={() => selectAccount(account.id)}
    >
      {/* Account Name */}
      <div className={clsx(
        'font-medium flex items-center space-x-2',
        theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
      )}>
        <span>{account.name}</span>
        {account.status !== 'active' && (
          <span className={clsx(
            'text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider flex items-center gap-1',
            account.status === 'blown'
              ? 'bg-red-500/20 text-red-500'
              : account.status === 'passed_eval'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-yellow-500/20 text-yellow-500'
          )}>
            {account.status === 'inactive' ? 'PAID OUT' : account.status === 'passed_eval' ? 'PASSED EVAL' : account.status}
            {account.status === 'inactive' && '🏆'}
            {account.status === 'passed_eval' && '🎯'}
          </span>
        )}
      </div>

      {/* Broker */}
      <div className="flex items-center space-x-2">
        <span className="text-lg">{getBrokerIcon(account.broker)}</span>
        <span className={theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'}>
          {account.broker}
        </span>
      </div>

      {/* Balance */}
      <div>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className={clsx(
            'font-medium hover:underline',
            account.balance >= 0
              ? 'text-emerald-500'
              : 'text-rose-500'
          )}
        >
          {formatBalance(account.balance)}
        </a>
      </div>

      {/* Last Update */}
      <div className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>
        {account.lastUpdate || '-'}
      </div>

      {/* Type */}
      <div className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>
        {getTypeLabel(account.type)}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onImportForAccount(account.id);
          }}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            theme === 'dark'
              ? 'text-zinc-400 hover:text-emerald-500 hover:bg-emerald-500/10'
              : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
          )}
          title="Import trades"
        >
          <Plus className="h-5 w-5" />
        </button>
        <AccountActionsMenu
          account={account}
          onEdit={() => setEditingAccount(account)}
          onDelete={() => setShowDeleteConfirm(account)}
          onImport={() => onImportForAccount(account.id)}
          onStatusChange={(status) => handleStatusChange(account.id, status)}
          onClearTrades={() => clearAccountTrades(account.id)}
          onAdjustBalance={() => setShowAdjustments(account)}
        />
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={clsx(
            'text-2xl font-bold',
            theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
          )}>
            My Trading Accounts
          </h1>
          <p className={clsx(
            'text-sm mt-1',
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>
            Manage your prop firm and trading accounts
          </p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        {/* Tabs */}
        <div className={clsx(
          'flex p-1 rounded-xl',
          theme === 'dark' ? 'bg-[#242838]/50' : 'bg-gray-100'
        )}>
          <button
            onClick={() => setActiveTab('active')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2',
              activeTab === 'active'
                ? theme === 'dark'
                  ? 'bg-emerald-500/20 text-emerald-500 shadow-sm'
                  : 'bg-white text-gray-900 shadow-sm'
                : theme === 'dark'
                  ? 'text-zinc-400 hover:text-zinc-100'
                  : 'text-gray-500 hover:text-gray-900'
            )}
          >
            <span>Active Accounts</span>
            <span className={clsx(
              'px-2 py-0.5 rounded-full text-xs',
              activeTab === 'active'
                ? theme === 'dark' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-gray-100 text-gray-900'
                : theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md text-zinc-400' : 'bg-gray-200 text-gray-600'
            )}>
              {activeAccounts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inactive')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2',
              activeTab === 'inactive'
                ? theme === 'dark'
                  ? 'bg-rose-500/20 text-rose-500 shadow-sm'
                  : 'bg-white text-gray-900 shadow-sm'
                : theme === 'dark'
                  ? 'text-zinc-400 hover:text-zinc-100'
                  : 'text-gray-500 hover:text-gray-900'
            )}
          >
            <span>Inactive Accounts</span>
            <span className={clsx(
              'px-2 py-0.5 rounded-full text-xs',
              activeTab === 'inactive'
                ? theme === 'dark' ? 'bg-rose-500/20 text-rose-500' : 'bg-gray-100 text-gray-900'
                : theme === 'dark' ? 'bg-[#181B24]/80 backdrop-blur-md text-zinc-400' : 'bg-gray-200 text-gray-600'
            )}>
              {inactiveAccounts.length}
            </span>
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all shadow-lg shadow-[#3BF68A]/20"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Account</span>
        </button>
      </div>

      {/* Accounts Table */}
      <div className={clsx(
        'rounded-xl border overflow-hidden mb-8',
        theme === 'dark' ? 'border-white/5' : 'border-gray-200'
      )}>
        {/* Table Header */}
        <div className={clsx(
          'px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider',
          theme === 'dark'
            ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5 text-zinc-400'
            : 'bg-gray-50 border-gray-200 text-gray-500'
        )}>
          {activeTab === 'active' ? 'Active Accounts List' : 'Inactive Accounts History'}
        </div>

        {/* Table Content */}
        <div className={clsx(
          theme === 'dark' ? 'bg-[#181B24]' : 'bg-white'
        )}>
          {/* Column Headers */}
          <div className={clsx(
            'grid grid-cols-6 gap-4 px-6 py-3 text-sm font-medium border-b',
            theme === 'dark'
              ? 'text-zinc-400 border-white/5'
              : 'text-gray-500 border-gray-200'
          )}>
            <div>Account name</div>
            <div>Broker</div>
            <div>Balance</div>
            <div>Last update</div>
            <div>Type</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Account Rows */}
          {activeTab === 'active' ? (
            activeAccounts.length === 0 ? (
              <div className={clsx(
                'px-6 py-12 text-center',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>
                <p className="text-lg mb-2">No active accounts</p>
                <p className="text-sm">Create an account to start tracking trades</p>
              </div>
            ) : (
              activeAccounts.map(renderAccountRow)
            )
          ) : (
            inactiveAccounts.length === 0 ? (
              <div className={clsx(
                'px-6 py-12 text-center',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>
                <p className="text-lg mb-2">No inactive accounts</p>
                <p className="text-sm">Blown or archived accounts will appear here</p>
              </div>
            ) : (
              inactiveAccounts.map(renderAccountRow)
            )
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className={clsx(
          'rounded-xl p-6 border',
          theme === 'dark'
            ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
            : 'bg-white border-gray-200'
        )}>
          <p className={clsx(
            'text-sm',
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>Total Accounts</p>
          <p className={clsx(
            'text-3xl font-bold mt-1',
            theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
          )}>{accounts.length}</p>
        </div>

        <div className={clsx(
          'rounded-xl p-6 border',
          theme === 'dark'
            ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
            : 'bg-white border-gray-200'
        )}>
          <p className={clsx(
            'text-sm',
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>Combined Balance</p>
          <p className={clsx(
            'text-3xl font-bold mt-1',
            accounts.reduce((sum, a) => sum + a.balance, 0) >= 0
              ? 'text-emerald-500'
              : 'text-rose-500'
          )}>
            {formatBalance(accounts.reduce((sum, a) => sum + a.balance, 0))}
          </p>
        </div>

        <div className={clsx(
          'rounded-xl p-6 border',
          theme === 'dark'
            ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
            : 'bg-white border-gray-200'
        )}>
          <p className={clsx(
            'text-sm',
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>Total Trades</p>
          <p className={clsx(
            'text-3xl font-bold mt-1',
            theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
          )}>
            {accounts.reduce((sum, a) => sum + a.trades.length, 0)}
          </p>
        </div>
      </div>

      {/* Data Management Section */}
      <div className={clsx(
        'rounded-xl border mt-6 overflow-hidden',
        theme === 'dark' ? 'border-white/5' : 'border-gray-200'
      )}>
        <div className={clsx(
          'px-6 py-4 border-b',
          theme === 'dark'
            ? 'bg-[#181B24]/80 backdrop-blur-md border-white/5'
            : 'bg-gray-50 border-gray-200'
        )}>
          <div className="flex items-center space-x-2">
            <HardDrive className={clsx(
              'h-5 w-5',
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
            )} />
            <h2 className={clsx(
              'text-lg font-semibold',
              theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
            )}>
              Data Management
            </h2>
          </div>
          <p className={clsx(
            'text-sm mt-1',
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>
            Backup and restore your trading data
          </p>
        </div>

        <div className={clsx(
          'p-6',
          theme === 'dark' ? 'bg-[#181B24]' : 'bg-white'
        )}>
          {/* Two Column Layout - Save & Load - Compact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* LEFT COLUMN - SAVE / DOWNLOAD */}
            <div className={clsx(
              'p-4 rounded-lg border',
              theme === 'dark'
                ? 'bg-emerald-500/5 border-emerald-500/30/20'
                : 'bg-green-50 border-green-200'
            )}>
              <div className="flex items-center space-x-2 mb-3">
                <Download className={clsx(
                  'h-5 w-5',
                  theme === 'dark' ? 'text-emerald-500' : 'text-green-600'
                )} />
                <h3 className={clsx(
                  'font-semibold',
                  theme === 'dark' ? 'text-emerald-500' : 'text-green-700'
                )}>
                  Save Your Data
                </h3>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    try {
                      exportAllData();
                      setLastBackupTime();
                      toast.success('✅ Backup downloaded!');
                    } catch {
                      toast.error('Failed to export data');
                    }
                  }}
                  className={clsx(
                    'w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-all',
                    theme === 'dark'
                      ? 'bg-emerald-500 text-[#181B24] hover:bg-[#2DD876]'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  )}
                >
                  <Download className="h-4 w-4" />
                  <span>Download Full Backup</span>
                </button>

                <button
                  onClick={() => {
                    try {
                      exportTradesToCSV();
                      toast.success('📊 CSV exported!');
                    } catch {
                      toast.error('Failed to export CSV');
                    }
                  }}
                  className={clsx(
                    'w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all',
                    theme === 'dark'
                      ? 'bg-[#242838] text-zinc-400 hover:text-zinc-100 hover:bg-[#2D3748]'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  )}
                >
                  <FileText className="h-4 w-4" />
                  <span>Export as CSV</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN - LOAD / RESTORE */}
            <div className={clsx(
              'p-4 rounded-lg border-2',
              theme === 'dark'
                ? 'bg-rose-500/5 border-rose-500/30/30'
                : 'bg-red-50 border-red-200'
            )}>
              <div className="flex items-center space-x-2 mb-3">
                <AlertTriangle className={clsx(
                  'h-5 w-5',
                  theme === 'dark' ? 'text-rose-500' : 'text-red-600'
                )} />
                <h3 className={clsx(
                  'font-semibold',
                  theme === 'dark' ? 'text-rose-500' : 'text-red-700'
                )}>
                  Restore Backup
                </h3>
              </div>

              {/* Warning Box */}
              <div className={clsx(
                'p-2 rounded-lg mb-3 text-xs',
                theme === 'dark'
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-red-100 text-red-700'
              )}>
                ⚠️ <strong>Warning:</strong> This will DELETE all your current data and replace it with the backup file.
              </div>

              <button
                onClick={() => setShowRestoreConfirm(true)}
                className={clsx(
                  'w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-all border-2',
                  theme === 'dark'
                    ? 'bg-transparent text-rose-500 border-rose-500/30 hover:bg-rose-500/10'
                    : 'bg-transparent text-red-600 border-red-400 hover:bg-red-50'
                )}
              >
                <Upload className="h-4 w-4" />
                <span>Restore from Backup...</span>
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const result = importBackupData(event.target?.result as string);
                      if (result.success) {
                        const items = result.itemsRestored.join(', ');
                        toast.success(`✅ Restored: ${items}. Refreshing...`);
                        setTimeout(() => window.location.reload(), 1500);
                      } else {
                        toast.error(result.error || 'Failed to restore backup');
                      }
                    };
                    reader.readAsText(file);
                  }
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* Storage Usage - With Progress Bar */}
          <div className={clsx(
            'mt-4 p-4 rounded-lg',
            theme === 'dark' ? 'bg-[#242838]/50' : 'bg-gray-100'
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <HardDrive className={clsx(
                  'h-4 w-4',
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                )} />
                <span className={clsx(
                  'text-sm font-medium',
                  theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
                )}>
                  Local Storage
                </span>
              </div>
              <span className={clsx(
                'text-sm font-mono',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>
                {(getStorageUsage().used / 1024).toFixed(1)} KB / 5 MB
              </span>
            </div>

            {/* Progress Bar */}
            <div className={clsx(
              'h-2 rounded-full overflow-hidden mb-2',
              theme === 'dark' ? 'bg-[#181B24]' : 'bg-gray-200'
            )}>
              <div
                className={clsx(
                  'h-full transition-all rounded-full',
                  getStorageUsage().percentage < 60
                    ? 'bg-gradient-to-r from-[#3BF68A] to-[#60A5FA]'
                    : getStorageUsage().percentage < 85
                      ? 'bg-gradient-to-r from-[#FBBF24] to-[#F59E0B]'
                      : 'bg-gradient-to-r from-[#F45B69] to-[#EF4444]'
                )}
                style={{ width: `${Math.min(getStorageUsage().percentage, 100)}%` }}
              />
            </div>

            <p className={clsx(
              'text-xs',
              theme === 'dark' ? 'text-[#6B7280]' : 'text-gray-500'
            )}>
              {getStorageUsage().percentage < 60
                ? '✓ Plenty of space available'
                : getStorageUsage().percentage < 85
                  ? '⚡ Storage is filling up — screenshots use the most space'
                  : '⚠️ Running low on space — consider backing up and clearing old data'}
            </p>
          </div>

          {/* Cloud Service Teaser */}
          <div className={clsx(
            'mt-3 p-3 rounded-lg border flex items-center justify-between',
            theme === 'dark'
              ? 'bg-gradient-to-r from-[#A78BFA]/5 to-[#3BF68A]/5 border-[#A78BFA]/20'
              : 'bg-gradient-to-r from-purple-50 to-green-50 border-purple-200'
          )}>
            <div className="flex items-center space-x-3">
              <div className={clsx(
                'p-1.5 rounded-lg',
                theme === 'dark' ? 'bg-[#242838]/80' : 'bg-purple-100'
              )}>
                <svg
                  className={clsx('h-4 w-4', theme === 'dark' ? 'text-zinc-400' : 'text-purple-600')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <div>
                <p className={clsx(
                  'text-sm font-medium',
                  theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
                )}>
                  ☁️ TradePilot Cloud — Coming Soon
                </p>
                <p className={clsx(
                  'text-xs',
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                )}>
                  Sync across devices • Automatic backups • More storage
                </p>
              </div>
            </div>
            <span className={clsx(
              'text-xs px-2 py-1 rounded-full font-medium',
              theme === 'dark'
                ? 'bg-[#242838]/80 text-zinc-400'
                : 'bg-purple-100 text-purple-700'
            )}>
              Soon
            </span>
          </div>

          {/* Import Trades Callout */}
          <div className={clsx(
            'mt-4 p-4 rounded-xl border flex items-start space-x-3',
            theme === 'dark'
              ? 'bg-[#60A5FA]/5 border-[#60A5FA]/30'
              : 'bg-blue-50 border-blue-200'
          )}>
            <div className={clsx(
              'p-2 rounded-lg flex-shrink-0',
              theme === 'dark' ? 'bg-[#60A5FA]/20' : 'bg-blue-100'
            )}>
              <FileText className={clsx(
                'h-5 w-5',
                theme === 'dark' ? 'text-[#60A5FA]' : 'text-blue-600'
              )} />
            </div>
            <div>
              <p className={clsx(
                'font-medium',
                theme === 'dark' ? 'text-[#60A5FA]' : 'text-blue-700'
              )}>
                Want to import trades from your broker?
              </p>
              <p className={clsx(
                'text-sm mt-1',
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}>
                Use the <strong>"Import Trades"</strong> button in the top-right corner, or click the <strong>⋮ menu</strong> on any account card above.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAccount}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSave={handleSaveAccount}
        onImport={(accountId) => {
          setEditingAccount(null);
          onImportForAccount(accountId);
        }}
        onClearTrades={handleClearTrades}
        onShowImportHistory={(account) => {
          setEditingAccount(null);
          setShowImportHistory(account);
        }}
        onShowDeleteConfirm={(account) => {
          setShowDeleteConfirm(account);
        }}
      />

      {/* Import History Modal */}
      <ImportHistoryModal
        isOpen={showImportHistory !== null}
        account={showImportHistory}
        onClose={() => setShowImportHistory(null)}
        onDeleteEntry={handleDeleteImportEntry}
      />

      {/* Delete Confirmation Modal (GitHub-style) */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm !== null}
        account={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={() => {
          if (showDeleteConfirm) {
            handleDeleteAccount(showDeleteConfirm);
          }
        }}
      />

      {/* Adjustments List Modal */}
      <AdjustmentsListModal
        isOpen={showAdjustments !== null}
        account={showAdjustments}
        onClose={() => setShowAdjustments(null)}
        onDelete={handleDeleteAdjustment}
        onAddNew={() => {
          const account = showAdjustments;
          setShowAdjustments(null);
          setShowAddAdjustment(account);
        }}
      />

      {/* Add Adjustment Modal */}
      <AddAdjustmentModal
        isOpen={showAddAdjustment !== null}
        account={showAddAdjustment}
        onClose={() => setShowAddAdjustment(null)}
        onAdd={handleAddAdjustment}
      />

      {/* Restore Backup Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setShowRestoreConfirm(false);
              setRestoreConfirmText('');
            }}
          />
          <div
            className={clsx(
              'relative w-full max-w-md mx-4 rounded-2xl border p-6',
              theme === 'dark'
                ? 'bg-[#181B24] border-rose-500/50'
                : 'bg-white border-red-300'
            )}
          >
            {/* Header */}
            <div className="flex items-center space-x-3 mb-4">
              <div className={clsx(
                'p-2 rounded-full',
                theme === 'dark' ? 'bg-rose-500/20' : 'bg-red-100'
              )}>
                <AlertTriangle className={clsx(
                  'h-6 w-6',
                  theme === 'dark' ? 'text-rose-500' : 'text-red-600'
                )} />
              </div>
              <h3 className={clsx(
                'text-lg font-bold',
                theme === 'dark' ? 'text-rose-500' : 'text-red-700'
              )}>
                Restore Backup
              </h3>
            </div>

            {/* Warning Content */}
            <div className={clsx(
              'p-4 rounded-lg mb-4',
              theme === 'dark' ? 'bg-rose-500/10' : 'bg-red-50'
            )}>
              <p className={clsx(
                'text-sm font-medium mb-2',
                theme === 'dark' ? 'text-rose-500' : 'text-red-700'
              )}>
                ⚠️ This action will permanently delete:
              </p>
              <ul className={clsx(
                'text-sm space-y-1 ml-4 list-disc',
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-700'
              )}>
                <li>All your trading accounts</li>
                <li>All imported trades</li>
                <li>All journal entries & notes</li>
                <li>All screenshots</li>
                <li>All settings</li>
              </ul>
            </div>

            {/* Type to confirm */}
            <p className={clsx(
              'text-sm mb-2',
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            )}>
              Type <strong className={theme === 'dark' ? 'text-rose-500' : 'text-red-600'}>RESTORE</strong> to confirm:
            </p>
            <input
              type="text"
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              placeholder="Type RESTORE"
              className={clsx(
                'w-full px-4 py-2 rounded-lg border text-sm mb-4',
                theme === 'dark'
                  ? 'bg-[#242838] border-white/10 text-zinc-100 placeholder:text-[#6B7280]'
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400',
                'focus:outline-none focus:ring-2',
                theme === 'dark' ? 'focus:ring-[#F45B69]/50' : 'focus:ring-red-500/50'
              )}
              autoFocus
            />

            {/* Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setRestoreConfirmText('');
                }}
                className={clsx(
                  'flex-1 py-2 rounded-lg border font-medium transition-all',
                  theme === 'dark'
                    ? 'border-white/5 text-zinc-400 hover:text-zinc-100 hover:border-white/10'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (restoreConfirmText === 'RESTORE') {
                    setShowRestoreConfirm(false);
                    setRestoreConfirmText('');
                    fileInputRef.current?.click();
                  }
                }}
                disabled={restoreConfirmText !== 'RESTORE'}
                className={clsx(
                  'flex-1 py-2 rounded-lg font-medium transition-all',
                  restoreConfirmText === 'RESTORE'
                    ? theme === 'dark'
                      ? 'bg-rose-500 text-white hover:bg-[#E04A58]'
                      : 'bg-red-600 text-white hover:bg-red-700'
                    : theme === 'dark'
                      ? 'bg-[#242838] text-[#4B5563] cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                Choose File & Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
