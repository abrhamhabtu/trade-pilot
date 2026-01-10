import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Layers } from 'lucide-react';
import { useAccountStore } from '../../store/accountStore';
import { useThemeStore } from '../../store/themeStore';
import clsx from 'clsx';

export const AccountSelector: React.FC = () => {
  const { accounts, selectedAccountId, selectAccount, showAllAccounts, setShowAllAccounts } = useAccountStore();
  const { theme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getBrokerIcon = (broker: string) => {
    if (broker.toLowerCase().includes('topstep')) return '📈';
    if (broker.toLowerCase().includes('apex')) return '🏔️';
    if (broker.toLowerCase().includes('ftmo')) return '💎';
    if (broker.toLowerCase().includes('funded')) return '💰';
    if (broker.toLowerCase().includes('projectx')) return '🚀';
    if (broker.toLowerCase().includes('template') || broker.toLowerCase().includes('generic')) return '📋';
    return '📊';
  };

  const handleSelectAccount = (id: string) => {
    selectAccount(id);
    setShowAllAccounts(false);
    setIsOpen(false);
  };

  const handleShowAll = () => {
    setShowAllAccounts(true);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center space-x-3 px-4 py-2 rounded-lg border transition-all',
          theme === 'dark'
            ? 'bg-[#15181F] border-[#1F2937] hover:border-[#3BF68A]/50'
            : 'bg-white border-gray-200 hover:border-purple-300',
          isOpen && (theme === 'dark' ? 'border-[#3BF68A]/50' : 'border-purple-300')
        )}
      >
        {showAllAccounts ? (
          <>
            <div className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              theme === 'dark' ? 'bg-[#3BF68A]/10' : 'bg-purple-100'
            )}>
              <Layers className={clsx(
                'h-4 w-4',
                theme === 'dark' ? 'text-[#3BF68A]' : 'text-purple-600'
              )} />
            </div>
            <span className={clsx(
              'font-medium',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
            )}>
              All Accounts
            </span>
          </>
        ) : selectedAccount ? (
          <>
            <div className={clsx(
              'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
              theme === 'dark' ? 'bg-[#1F2937]' : 'bg-gray-100'
            )}>
              {getBrokerIcon(selectedAccount.broker)}
            </div>
            <span className={clsx(
              'font-medium',
              theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
            )}>
              {selectedAccount.name}
            </span>
          </>
        ) : (
          <span className={theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'}>
            Select Account
          </span>
        )}
        <ChevronDown className={clsx(
          'h-4 w-4 transition-transform',
          isOpen && 'rotate-180',
          theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-400'
        )} />
      </button>

      {isOpen && (
        <div className={clsx(
          'absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl z-50 overflow-hidden',
          theme === 'dark'
            ? 'bg-[#15181F] border-[#1F2937]'
            : 'bg-white border-gray-200'
        )}>
          {/* All Accounts Option */}
          {accounts.length > 1 && (
            <>
              <button
                onClick={handleShowAll}
                className={clsx(
                  'w-full px-4 py-3 flex items-center justify-between transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-[#1F2937]'
                    : 'hover:bg-gray-50',
                  showAllAccounts && (
                    theme === 'dark' 
                      ? 'bg-[#3BF68A]/10' 
                      : 'bg-purple-50'
                  )
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    theme === 'dark' ? 'bg-[#3BF68A]/10' : 'bg-purple-100'
                  )}>
                    <Layers className={clsx(
                      'h-4 w-4',
                      theme === 'dark' ? 'text-[#3BF68A]' : 'text-purple-600'
                    )} />
                  </div>
                  <div className="text-left">
                    <p className={clsx(
                      'font-medium text-sm',
                      theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
                    )}>
                      All Accounts
                    </p>
                    <p className={clsx(
                      'text-xs',
                      theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
                    )}>
                      View combined data
                    </p>
                  </div>
                </div>
                {showAllAccounts && (
                  <Check className="h-4 w-4 text-[#3BF68A]" />
                )}
              </button>
              <div className={clsx(
                'border-t mx-2',
                theme === 'dark' ? 'border-[#1F2937]' : 'border-gray-100'
              )} />
            </>
          )}

          {/* Individual Accounts */}
          <div className="py-1">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => handleSelectAccount(account.id)}
                className={clsx(
                  'w-full px-4 py-3 flex items-center justify-between transition-colors',
                  theme === 'dark'
                    ? 'hover:bg-[#1F2937]'
                    : 'hover:bg-gray-50',
                  !showAllAccounts && selectedAccountId === account.id && (
                    theme === 'dark' 
                      ? 'bg-[#3BF68A]/10' 
                      : 'bg-purple-50'
                  )
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className={clsx(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
                    theme === 'dark' ? 'bg-[#1F2937]' : 'bg-gray-100'
                  )}>
                    {getBrokerIcon(account.broker)}
                  </div>
                  <div className="text-left">
                    <p className={clsx(
                      'font-medium text-sm',
                      theme === 'dark' ? 'text-[#E5E7EB]' : 'text-gray-900'
                    )}>
                      {account.name}
                    </p>
                    <p className={clsx(
                      'text-xs',
                      theme === 'dark' ? 'text-[#8B94A7]' : 'text-gray-500'
                    )}>
                      {account.broker}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={clsx(
                    'text-sm font-medium',
                    account.balance >= 0 ? 'text-[#3BF68A]' : 'text-[#F45B69]'
                  )}>
                    ${Math.abs(account.balance).toLocaleString()}
                  </span>
                  {!showAllAccounts && selectedAccountId === account.id && (
                    <Check className="h-4 w-4 text-[#3BF68A]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
