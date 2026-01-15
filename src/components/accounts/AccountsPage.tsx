import React, { useState } from 'react';
import { Plus, MoreVertical, Upload, Trash2, Edit2, ChevronDown, FileText, AlertTriangle, History, X, Download, HardDrive } from 'lucide-react';
import { useAccountStore, Account } from '../../store/accountStore';
import { useThemeStore } from '../../store/themeStore';
import { toast } from '../../store/toastStore';
import { exportAllData, importBackupData, getStorageUsage } from '../../hooks/useLocalStorage';
import clsx from 'clsx';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, broker: string) => void;
}

const BROKER_OPTIONS = [
  'Topstep',
  'Apex Trader Funding',
  'My Funded Futures',
  'The Trading Pit',
  'FTMO',
  'Funded Next',
  'True Forex Funds',
  'E8 Funding',
  'The5ers',
  'ProjectX',
  'TopOne Futures',
  'Generic Template',
  'Other'
];

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
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-white border-gray-200'
        )}
      >
        <div className={clsx(
          'p-6 border-b',
          theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-200'
        )}>
          <h2 className={clsx(
            'text-xl font-bold',
            theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
          )}>Add New Account</h2>
          <p className={clsx(
            'text-sm mt-1',
            theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
          )}>Create a new trading account to track your trades</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
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
                  ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              )}
              required
            />
          </div>

          <div className="relative">
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              Broker / Prop Firm
            </label>
            <button
              type="button"
              onClick={() => setShowBrokerDropdown(!showBrokerDropdown)}
              className={clsx(
                'w-full px-4 py-3 rounded-lg border text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                theme === 'dark'
                  ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB]'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              )}
            >
              <span className={broker ? '' : (theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-400')}>
                {broker || 'Select a broker...'}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
            
            {showBrokerDropdown && (
              <div className={clsx(
                'absolute z-10 w-full mt-1 rounded-lg border shadow-xl max-h-48 overflow-y-auto',
                theme === 'dark'
                  ? 'bg-[#15181F] border-[#1F2937]'
                  : 'bg-white border-gray-200'
              )}>
                {BROKER_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setBroker(option);
                      setShowBrokerDropdown(false);
                    }}
                    className={clsx(
                      'w-full px-4 py-2 text-left text-sm transition-colors',
                      theme === 'dark'
                        ? 'text-[#E5E7EB] hover:bg-[#1F2937]'
                        : 'text-gray-900 hover:bg-gray-100',
                      broker === option && (theme === 'dark' ? 'bg-[#3BF68A]/10 text-[#3BF68A]' : 'bg-purple-50 text-purple-600')
                    )}
                  >
                    {option}
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
                  ? 'border-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50'
                  : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:border-purple-300'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 transition-all"
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
        theme === 'dark' ? 'bg-[#15181F] border-[#1F2937]' : 'bg-white border-gray-200'
      )}>
        {/* Warning Header */}
        <div className={clsx(
          'p-6 border-b',
          theme === 'dark' ? 'border-[#1F2937] bg-red-500/5' : 'border-gray-200 bg-red-50'
        )}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-red-500/20">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className={clsx(
                'text-xl font-bold',
                theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
              )}>Delete Account</h2>
              <p className={clsx(
                'text-sm',
                theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
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
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
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
                  ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
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
                  ? 'border-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB]'
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
        theme === 'dark' ? 'bg-[#15181F] border-[#1F2937]' : 'bg-white border-gray-200'
      )}>
        {/* Header */}
        <div className={clsx(
          'p-6 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-200'
        )}>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-[#A78BFA]/10">
              <History className="h-5 w-5 text-[#A78BFA]" />
            </div>
            <div>
              <h2 className={clsx(
                'text-xl font-bold',
                theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
              )}>Import History</h2>
              <p className={clsx(
                'text-sm',
                theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
              )}>{account.name} • {importHistory.length} import{importHistory.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              theme === 'dark'
                ? 'text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937]'
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
              theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2937]' : 'bg-gray-50 border-gray-200'
            )}>
              <FileText className={clsx('h-12 w-12 mx-auto mb-3', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-400')} />
              <p className={clsx('text-sm font-medium', theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700')}>
                No import history recorded
              </p>
              <p className={clsx('text-xs mt-2 max-w-sm mx-auto', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500')}>
                Import history tracking was just added. Your next CSV import will be recorded here with file name, date, trades count, and P&L.
              </p>
              <div className={clsx(
                'mt-4 p-3 rounded-lg text-xs text-left max-w-sm mx-auto',
                theme === 'dark' ? 'bg-[#1F2937]/50' : 'bg-gray-100'
              )}>
                <p className={clsx('font-medium mb-1', theme === 'dark' ? 'text-[#A78BFA]' : 'text-purple-600')}>
                  What gets tracked:
                </p>
                <ul className={clsx('space-y-1', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500')}>
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
                      ? 'bg-[#0B0D10] border-[#1F2937] hover:border-[#3BF68A]/30'
                      : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={clsx(
                        'p-2 rounded-lg',
                        theme === 'dark' ? 'bg-[#1F2937]' : 'bg-gray-200'
                      )}>
                        <FileText className={clsx('h-5 w-5', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500')} />
                      </div>
                      <div>
                        <p className={clsx(
                          'font-medium text-sm',
                          theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
                        )}>
                          {entry.fileName}
                        </p>
                        <p className={clsx(
                          'text-xs mt-1',
                          theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
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
                          ? 'text-[#8B94A7] hover:text-red-400 hover:bg-red-500/10'
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
                      theme === 'dark' ? 'bg-[#15181F]' : 'bg-white border border-gray-200'
                    )}>
                      <p className={clsx('text-xs', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500')}>
                        Trades
                      </p>
                      <p className={clsx(
                        'text-lg font-bold mt-1',
                        theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
                      )}>
                        {entry.tradesImported}
                      </p>
                    </div>
                    <div className={clsx(
                      'p-3 rounded-lg',
                      theme === 'dark' ? 'bg-[#15181F]' : 'bg-white border border-gray-200'
                    )}>
                      <p className={clsx('text-xs', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500')}>
                        P&L
                      </p>
                      <p className={clsx(
                        'text-lg font-bold mt-1',
                        entry.totalPnL >= 0 ? 'text-[#3BF68A]' : 'text-[#F45B69]'
                      )}>
                        {formatCurrency(entry.totalPnL)}
                      </p>
                    </div>
                    <div className={clsx(
                      'p-3 rounded-lg',
                      theme === 'dark' ? 'bg-[#15181F]' : 'bg-white border border-gray-200'
                    )}>
                      <p className={clsx('text-xs', theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500')}>
                        Date Range
                      </p>
                      <p className={clsx(
                        'text-sm font-medium mt-1',
                        theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
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
              theme === 'dark' ? 'bg-[#15181F] border-[#1F2937]' : 'bg-white border-gray-200'
            )}>
              {/* Header */}
              <div className={clsx(
                'p-5 border-b',
                theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-200'
              )}>
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className={clsx(
                      'text-lg font-bold',
                      theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
                    )}>Delete Import Record</h3>
                    <p className={clsx(
                      'text-sm',
                      theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
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
                    theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
                  )}>
                    {entryToDelete.fileName}
                  </p>
                  <p className={clsx(
                    'text-xs mt-2',
                    theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
                  )}>
                    {entryToDelete.tradesImported} trades • {formatCurrency(entryToDelete.totalPnL)} P&L
                  </p>
                </div>

                <p className={clsx(
                  'text-sm mb-3',
                  theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-600'
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
                      ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#4B5563]'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-red-500/50'
                  )}
                  autoFocus
                />
              </div>

              {/* Footer */}
              <div className={clsx(
                'p-5 border-t flex justify-end space-x-3',
                theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-200'
              )}>
                <button
                  onClick={() => {
                    setConfirmDeleteId(null);
                    setConfirmInput('');
                  }}
                  className={clsx(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    theme === 'dark'
                      ? 'text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937]'
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
                        ? 'bg-[#1F2937] text-[#4B5563] cursor-not-allowed'
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

// Edit Account Modal
interface EditAccountModalProps {
  account: Account | null;
  onClose: () => void;
  onSave: (id: string, name: string, broker: string) => void;
  onDelete: (account: Account) => void;
  onImport: (accountId: string) => void;
  onClearTrades: (accountId: string) => void;
  onShowImportHistory: (account: Account) => void;
  onShowDeleteConfirm: (account: Account) => void;
}

const EditAccountModal: React.FC<EditAccountModalProps> = ({ 
  account, 
  onClose, 
  onSave, 
  onDelete,
  onImport,
  onClearTrades,
  onShowImportHistory,
  onShowDeleteConfirm
}) => {
  const [name, setName] = useState(account?.name || '');
  const [broker, setBroker] = useState(account?.broker || '');
  const [showBrokerDropdown, setShowBrokerDropdown] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { theme } = useThemeStore();

  // Update state when account changes
  React.useEffect(() => {
    if (account) {
      setName(account.name);
      setBroker(account.broker);
    }
  }, [account]);

  if (!account) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && broker.trim()) {
      onSave(account.id, name.trim(), broker.trim());
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
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-white border-gray-200'
        )}
      >
        {/* Header */}
        <div className={clsx(
          'p-6 border-b',
          theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-200'
        )}>
          <h2 className={clsx(
            'text-xl font-bold',
            theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
          )}>Edit Account</h2>
          <p className={clsx(
            'text-sm mt-1',
            theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
          )}>Update account details or manage trades</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Account Name */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
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
                  ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
              )}
              required
            />
          </div>

          {/* Broker Dropdown */}
          <div>
            <label className={clsx(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
            )}>
              Broker / Platform
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBrokerDropdown(!showBrokerDropdown)}
                className={clsx(
                  'w-full px-4 py-3 rounded-lg border text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#3BF68A]/50 transition-all',
                  theme === 'dark'
                    ? 'bg-[#0B0D10] border-[#1F2937] text-[#E5E7EB]'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                )}
              >
                <span className={!broker ? (theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-400') : ''}>
                  {broker || 'Select a broker'}
                </span>
                <ChevronDown className={clsx(
                  'h-5 w-5 transition-transform',
                  showBrokerDropdown && 'rotate-180'
                )} />
              </button>

              {showBrokerDropdown && (
                <div className={clsx(
                  'absolute z-10 w-full mt-1 rounded-lg border shadow-xl max-h-48 overflow-y-auto',
                  theme === 'dark'
                    ? 'bg-[#15181F] border-[#1F2937]'
                    : 'bg-white border-gray-200'
                )}>
                  {BROKER_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setBroker(option);
                        setShowBrokerDropdown(false);
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm transition-colors',
                        theme === 'dark'
                          ? 'text-[#E5E7EB] hover:bg-[#1F2937]'
                          : 'text-gray-700 hover:bg-gray-100',
                        broker === option && (theme === 'dark' ? 'bg-[#1F2937]' : 'bg-gray-100')
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Account Stats */}
          <div className={clsx(
            'rounded-lg p-4 border',
            theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2937]' : 'bg-gray-50 border-gray-200'
          )}>
            <div className="flex justify-between items-center mb-2">
              <span className={theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'}>Total Trades</span>
              <span className={clsx('font-semibold', theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900')}>
                {account.trades.length}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className={theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'}>Balance</span>
              <span className={clsx('font-semibold', account.balance >= 0 ? 'text-[#3BF68A]' : 'text-[#F45B69]')}>
                ${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'}>CSV Imports</span>
              <button
                type="button"
                onClick={() => onShowImportHistory(account)}
                className={clsx(
                  'font-semibold flex items-center space-x-1 hover:underline',
                  theme === 'dark' ? 'text-[#A78BFA]' : 'text-purple-600'
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
                  ? 'border-[#3BF68A]/30 text-[#3BF68A] hover:bg-[#3BF68A]/10'
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
                  ? 'border-[#A78BFA]/30 text-[#A78BFA] hover:bg-[#A78BFA]/10'
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
                        ? 'border-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50'
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
                            ? 'border-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB]'
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
              theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-200'
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
                  ? 'border-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50'
                  : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:border-purple-300'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 transition-all"
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
}

const AccountActionsMenu: React.FC<AccountActionsMenuProps> = ({ account, onEdit, onDelete, onImport }) => {
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
            ? 'text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937]'
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
                ? 'bg-[#15181F] border-[#1F2937]'
                : 'bg-white border-gray-200'
            )}
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              onClick={() => { onImport(); setIsOpen(false); }}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm flex items-center space-x-2 transition-colors',
                theme === 'dark'
                  ? 'text-[#E5E7EB] hover:bg-[#1F2937]'
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
                  ? 'text-[#E5E7EB] hover:bg-[#1F2937]'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Edit2 className="h-4 w-4" />
              <span>Edit Account</span>
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
  const { accounts, addAccount, updateAccount, deleteAccount, selectAccount, selectedAccountId, deleteImportHistoryEntry } = useAccountStore();
  const { theme } = useThemeStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showImportHistory, setShowImportHistory] = useState<Account | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Account | null>(null);

  const handleAddAccount = (name: string, broker: string) => {
    const id = addAccount({ name, broker, type: 'file_upload' });
    toast.success(`Account "${name}" created`);
    selectAccount(id);
  };

  const handleSaveAccount = (id: string, name: string, broker: string) => {
    updateAccount(id, { name, broker });
    toast.success(`Account "${name}" updated`);
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
      // Refresh the account data
      const updatedAccount = accounts.find(a => a.id === showImportHistory.id);
      if (updatedAccount) {
        setShowImportHistory(updatedAccount);
      }
      toast.success('Import record removed');
    }
  };

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={clsx(
            'text-2xl font-bold',
            theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
          )}>
            My Trading Accounts
          </h1>
          <p className={clsx(
            'text-sm mt-1',
            theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
          )}>
            Manage your prop firm and trading accounts
          </p>
        </div>
      </div>

      {/* Accounts Table */}
      <div className={clsx(
        'rounded-xl border overflow-hidden',
        theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-200'
      )}>
        {/* Table Header */}
        <div className={clsx(
          'px-6 py-4 flex items-center justify-between border-b',
          theme === 'dark' 
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-gray-50 border-gray-200'
        )}>
          <h2 className={clsx(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
          )}>
            Active accounts
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add new account</span>
          </button>
        </div>

        {/* Table */}
        <div className={clsx(
          theme === 'dark' ? 'bg-[#0B0D10]' : 'bg-white'
        )}>
          {/* Column Headers */}
          <div className={clsx(
            'grid grid-cols-6 gap-4 px-6 py-3 text-sm font-medium border-b',
            theme === 'dark' 
              ? 'text-[#8B94A7] border-[#1F2937]' 
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
          {accounts.length === 0 ? (
            <div className={clsx(
              'px-6 py-12 text-center',
              theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
            )}>
              <p className="text-lg mb-2">No accounts yet</p>
              <p className="text-sm">Create your first account to start tracking trades</p>
            </div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className={clsx(
                  'grid grid-cols-6 gap-4 px-6 py-4 items-center border-b transition-colors cursor-pointer',
                  theme === 'dark' 
                    ? 'border-[#1F2937] hover:bg-[#15181F]' 
                    : 'border-gray-100 hover:bg-gray-50',
                  selectedAccountId === account.id && (
                    theme === 'dark' 
                      ? 'bg-[#3BF68A]/5 border-l-2 border-l-[#3BF68A]' 
                      : 'bg-purple-50 border-l-2 border-l-purple-500'
                  )
                )}
                onClick={() => selectAccount(account.id)}
              >
                {/* Account Name */}
                <div className={clsx(
                  'font-medium',
                  theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
                )}>
                  {account.name}
                </div>

                {/* Broker */}
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getBrokerIcon(account.broker)}</span>
                  <span className={theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'}>
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
                        ? 'text-[#3BF68A]'
                        : 'text-[#F45B69]'
                    )}
                  >
                    {formatBalance(account.balance)}
                  </a>
                </div>

                {/* Last Update */}
                <div className={theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'}>
                  {account.lastUpdate || '-'}
                </div>

                {/* Type */}
                <div className={theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'}>
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
                        ? 'text-[#8B94A7] hover:text-[#3BF68A] hover:bg-[#3BF68A]/10'
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
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className={clsx(
          'rounded-xl p-6 border',
          theme === 'dark' 
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-white border-gray-200'
        )}>
          <p className={clsx(
            'text-sm',
            theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
          )}>Total Accounts</p>
          <p className={clsx(
            'text-3xl font-bold mt-1',
            theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
          )}>{accounts.length}</p>
        </div>
        
        <div className={clsx(
          'rounded-xl p-6 border',
          theme === 'dark' 
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-white border-gray-200'
        )}>
          <p className={clsx(
            'text-sm',
            theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
          )}>Combined Balance</p>
          <p className={clsx(
            'text-3xl font-bold mt-1',
            accounts.reduce((sum, a) => sum + a.balance, 0) >= 0
              ? 'text-[#3BF68A]'
              : 'text-[#F45B69]'
          )}>
            {formatBalance(accounts.reduce((sum, a) => sum + a.balance, 0))}
          </p>
        </div>
        
        <div className={clsx(
          'rounded-xl p-6 border',
          theme === 'dark' 
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-white border-gray-200'
        )}>
          <p className={clsx(
            'text-sm',
            theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
          )}>Total Trades</p>
          <p className={clsx(
            'text-3xl font-bold mt-1',
            theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
          )}>
            {accounts.reduce((sum, a) => sum + a.trades.length, 0)}
          </p>
        </div>
      </div>

      {/* Data Management Section */}
      <div className={clsx(
        'rounded-xl border mt-6 overflow-hidden',
        theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-200'
      )}>
        <div className={clsx(
          'px-6 py-4 border-b',
          theme === 'dark' 
            ? 'bg-[#15181F] border-[#1F2937]' 
            : 'bg-gray-50 border-gray-200'
        )}>
          <div className="flex items-center space-x-2">
            <HardDrive className={clsx(
              'h-5 w-5',
              theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
            )} />
            <h2 className={clsx(
              'text-lg font-semibold',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
            )}>
              Data Management
            </h2>
          </div>
          <p className={clsx(
            'text-sm mt-1',
            theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
          )}>
            Backup and restore your trading data
          </p>
        </div>

        <div className={clsx(
          'p-6',
          theme === 'dark' ? 'bg-[#0B0D10]' : 'bg-white'
        )}>
          {/* Storage Usage */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className={clsx(
                'text-sm font-medium',
                theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-700'
              )}>
                Storage Used
              </span>
              <span className={clsx(
                'text-sm',
                theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
              )}>
                {(getStorageUsage().used / 1024).toFixed(1)} KB / {(getStorageUsage().total / 1024 / 1024).toFixed(0)} MB
              </span>
            </div>
            <div className={clsx(
              'h-2 rounded-full overflow-hidden',
              theme === 'dark' ? 'bg-[#1F2937]' : 'bg-gray-200'
            )}>
              <div 
                className="h-full bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] transition-all"
                style={{ width: `${Math.min(getStorageUsage().percentage, 100)}%` }}
              />
            </div>
            <p className={clsx(
              'text-xs mt-1',
              theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
            )}>
              {getStorageUsage().percentage < 80 
                ? 'Plenty of space available' 
                : getStorageUsage().percentage < 95 
                  ? 'Consider backing up and clearing old data'
                  : 'Storage almost full - backup recommended'}
            </p>
          </div>

          {/* Backup Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                try {
                  exportAllData();
                  toast.success('Backup downloaded successfully');
                } catch (error) {
                  toast.error('Failed to export data');
                }
              }}
              className={clsx(
                'flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                theme === 'dark'
                  ? 'bg-[#3BF68A]/10 text-[#3BF68A] hover:bg-[#3BF68A]/20 border border-[#3BF68A]/30'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
              )}
            >
              <Download className="h-4 w-4" />
              <span>Export Backup</span>
            </button>

            <label className={clsx(
              'flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all cursor-pointer',
              theme === 'dark'
                ? 'bg-[#A78BFA]/10 text-[#A78BFA] hover:bg-[#A78BFA]/20 border border-[#A78BFA]/30'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
            )}>
              <Upload className="h-4 w-4" />
              <span>Restore from Backup</span>
              <input
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
                        toast.success(`Restored ${result.accountsImported} account(s). Refreshing...`);
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
            </label>
          </div>

          {/* Info Box */}
          <div className={clsx(
            'mt-4 p-4 rounded-lg border',
            theme === 'dark' 
              ? 'bg-[#15181F] border-[#1F2937]' 
              : 'bg-gray-50 border-gray-200'
          )}>
            <p className={clsx(
              'text-sm',
              theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-600'
            )}>
              <strong>💡 Tip:</strong> Your data is stored locally in your browser. 
              Regular backups protect against accidental data loss. 
              Export creates a <code className={clsx(
                'px-1 py-0.5 rounded text-xs',
                theme === 'dark' ? 'bg-[#1F2937]' : 'bg-gray-200'
              )}>tradepilot_backup_YYYY-MM-DD.json</code> file.
            </p>
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
        onDelete={handleDeleteAccount}
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
    </div>
  );
};
