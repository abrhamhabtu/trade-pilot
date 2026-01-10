import React, { useState } from 'react';
import { Plus, MoreVertical, Upload, Trash2, Edit2, ChevronDown } from 'lucide-react';
import { useAccountStore, Account } from '../../store/accountStore';
import { useThemeStore } from '../../store/themeStore';
import { toast } from '../../store/toastStore';
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

interface AccountActionsMenuProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onImport: () => void;
}

const AccountActionsMenu: React.FC<AccountActionsMenuProps> = ({ account, onEdit, onDelete, onImport }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useThemeStore();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
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
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className={clsx(
            'absolute right-0 mt-2 w-48 rounded-lg border shadow-xl z-20',
            theme === 'dark'
              ? 'bg-[#15181F] border-[#1F2937]'
              : 'bg-white border-gray-200'
          )}>
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
  const { accounts, addAccount, deleteAccount, selectAccount, selectedAccountId } = useAccountStore();
  const { theme } = useThemeStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const handleAddAccount = (name: string, broker: string) => {
    const id = addAccount({ name, broker, type: 'file_upload' });
    toast.success(`Account "${name}" created`);
    selectAccount(id);
  };

  const handleDeleteAccount = (account: Account) => {
    if (window.confirm(`Are you sure you want to delete "${account.name}"? This will remove all associated trades.`)) {
      deleteAccount(account.id);
      toast.success(`Account "${account.name}" deleted`);
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
                    onDelete={() => handleDeleteAccount(account)}
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

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAccount}
      />
    </div>
  );
};
