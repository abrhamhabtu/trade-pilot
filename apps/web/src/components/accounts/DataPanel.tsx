'use client';

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Cloud, Download, FileSpreadsheet, HardDrive, RotateCcw } from 'lucide-react';
import { toast } from '@/store/toastStore';
import { exportAllData, exportTradesToCSV, getLastBackupTime, importBackupData, setLastBackupTime } from '@/hooks/useLocalStorage';
import { getStorageEstimate } from '@/utils/indexedDB';
import { Bar, Card } from '@/components/routine/journeyUi';
import { RestoreBackupModal } from './AccountModals';
import { btn, timeAgo } from './accountUi';

export function DataPanel() {
  const [storage, setStorage] = useState<{ used: number; quota: number; percentage: number } | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStorageEstimate().then(setStorage).catch(() => {});
    setLastBackup(getLastBackupTime());
  }, []);

  const stale = !lastBackup || Date.now() - lastBackup > 7 * 86_400_000;
  const pct = storage?.percentage ?? 0;

  const download = () => {
    try {
      exportAllData();
      setLastBackupTime();
      setLastBackup(Date.now());
      toast.success('Backup downloaded');
    } catch {
      toast.error('Could not create the backup');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={clsx('flex flex-col', stale && 'border-tp-yellow/20')}>
          <div className="flex items-start justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-tp-green/10 text-tp-green ring-1 ring-inset ring-tp-green/20">
              <Download className="h-5 w-5" />
            </span>
            <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-medium', stale ? 'bg-tp-yellow/10 text-tp-yellow' : 'bg-tp-green/10 text-tp-green')}>
              {lastBackup ? `Last: ${timeAgo(lastBackup)}` : 'Never backed up'}
            </span>
          </div>
          <h3 className="mt-4 font-semibold text-zinc-50">Download a full backup</h3>
          <p className="mt-1 flex-1 text-sm text-zinc-400">
            Everything — accounts, trades, journal, screenshots and settings — in one file. {stale && 'Do this weekly; your data only lives in this browser.'}
          </p>
          <button onClick={download} className={clsx(btn.primary, 'mt-5 w-full')}>
            <Download className="h-4 w-4" /> Download backup
          </button>
        </Card>

        <Card className="flex flex-col">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-tp-blue/10 text-tp-blue ring-1 ring-inset ring-tp-blue/20">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-semibold text-zinc-50">Export trades to CSV</h3>
          <p className="mt-1 flex-1 text-sm text-zinc-400">A spreadsheet of every trade for Excel, Sheets or your accountant. Not restorable — use a backup for that.</p>
          <button
            onClick={() => {
              try {
                exportTradesToCSV();
                toast.success('CSV exported');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Could not export CSV');
              }
            }}
            className={clsx(btn.secondary, 'mt-5 w-full')}
          >
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </button>
        </Card>

        <Card className="flex flex-col">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-tp-red/10 text-tp-red ring-1 ring-inset ring-tp-red/20">
            <RotateCcw className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-semibold text-zinc-50">Restore from a backup</h3>
          <p className="mt-1 flex-1 text-sm text-zinc-400">Moving browsers or computers? Load a backup file. It replaces what’s here now.</p>
          <button onClick={() => setRestoring(true)} className={clsx(btn.dangerOutline, 'mt-5 w-full')}>
            <RotateCcw className="h-4 w-4" /> Restore backup…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const result = importBackupData(ev.target?.result as string);
                  if (result.success) {
                    toast.success(`Restored ${result.itemsRestored.join(', ')}. Reloading…`);
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    toast.error(result.error || 'Could not restore that file');
                  }
                };
                reader.readAsText(file);
              }
              e.target.value = '';
            }}
          />
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.05] text-zinc-300 ring-1 ring-inset ring-white/10">
              <HardDrive className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="font-semibold text-zinc-50">Storage in this browser</h3>
              <p className="text-sm text-zinc-400">
                {pct < 60 ? 'Plenty of room.' : pct < 85 ? 'Filling up — screenshots use the most space.' : 'Almost full — back up and remove old screenshots.'}
              </p>
            </div>
          </div>
          <span className="font-mono text-sm tabular-nums text-zinc-400">
            {storage ? `${(storage.used / 1024 ** 2).toFixed(1)} MB of ${(storage.quota / 1024 ** 3).toFixed(1)} GB` : 'Checking…'}
          </span>
        </div>
        <Bar value={Math.max(pct, storage ? 1 : 0)} tone={pct < 60 ? 'green' : pct < 85 ? 'yellow' : 'red'} className="mt-4" />
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3 ring-1 ring-inset ring-white/[0.04]">
          <Cloud className="h-4 w-4 shrink-0 text-tp-blue" />
          <p className="flex-1 text-sm text-zinc-400">
            <span className="text-zinc-200">TradePilot Cloud</span> — sync across devices with automatic backups.
          </p>
          <span className="rounded-full bg-tp-blue/10 px-2.5 py-0.5 text-xs font-medium text-tp-blue">Coming soon</span>
        </div>
      </Card>

      {restoring && (
        <RestoreBackupModal
          onClose={() => setRestoring(false)}
          onConfirm={() => {
            setRestoring(false);
            fileRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
