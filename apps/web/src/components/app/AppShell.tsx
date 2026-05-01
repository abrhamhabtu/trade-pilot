'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AccountSelector } from '@/components/accounts';
import { ImportModal } from '@/components/ImportModal';
import { ToastContainer } from '@/components/common/Toast';
import { useThemeStore } from '@/store/themeStore';
import { useToastStore } from '@/store/toastStore';
import { useUIStore } from '@/store/uiStore';
import { dismissBackupReminder, shouldShowBackupReminder } from '@/hooks/useLocalStorage';
import clsx from 'clsx';

interface AppShellProps {
  children: ReactNode;
  showAccountSelector?: boolean;
  fullHeight?: boolean;
  showImportModal?: boolean;
  importTargetAccountId?: string | null;
  onImportClose?: () => void;
  onImportComplete?: (trades: import('@/store/tradingStore').Trade[]) => void;
}

export function AppShell({
  children,
  showAccountSelector = true,
  fullHeight = false,
  showImportModal = false,
  importTargetAccountId = null,
  onImportClose,
  onImportComplete,
}: AppShellProps) {
  const { theme } = useThemeStore();
  const { toasts, removeToast } = useToastStore();
  const { sidebarCollapsed } = useUIStore();
  const [showBackupReminder, setShowBackupReminder] = useState(false);

  useEffect(() => {
    if (shouldShowBackupReminder()) {
      setShowBackupReminder(true);
    }
  }, []);

  return (
    <div className={clsx('h-full', fullHeight && 'flex flex-col')}>
      {showBackupReminder && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div
            className={`mx-auto max-w-4xl mt-3 mx-4 px-4 py-2.5 rounded-xl flex items-center justify-between backdrop-blur-md shadow-lg ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30'
                : 'bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-200'}`}>
                <AlertTriangle className={`h-4 w-4 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`} />
              </div>
              <span className={`text-sm ${theme === 'dark' ? 'text-amber-100' : 'text-amber-800'}`}>
                Backup reminder: <span className="font-medium">Accounts → Data Management</span>
              </span>
            </div>
            <button
              onClick={() => {
                dismissBackupReminder();
                setShowBackupReminder(false);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'dark' ? 'text-amber-300 hover:bg-amber-500/20' : 'text-amber-700 hover:bg-amber-200'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showAccountSelector && (
        <div
          className={clsx(
            'fixed top-0 right-0 z-40 p-3 transition-all duration-300 sm:p-4',
            sidebarCollapsed ? 'left-20' : 'left-64'
          )}
          style={{
            background:
              theme === 'dark'
                ? 'linear-gradient(180deg, rgba(13,22,40,0.97) 0%, rgba(13,22,40,0) 100%)'
                : 'linear-gradient(180deg, rgba(240,244,252,0.97) 0%, rgba(240,244,252,0) 100%)',
          }}
        >
          <div className="flex justify-end min-w-0">
            <AccountSelector />
          </div>
        </div>
      )}

      <div className={clsx(showAccountSelector && 'pt-16', fullHeight && 'flex-1 min-h-0')}>{children}</div>

      {onImportClose && onImportComplete && (
        <ImportModal
          isOpen={showImportModal}
          onClose={onImportClose}
          targetAccountId={importTargetAccountId}
          onImportComplete={onImportComplete}
        />
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
