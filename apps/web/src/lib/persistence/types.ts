export interface StoredSettings {
  hasImportedData: boolean;
  lastImportTime: number;
}

export interface RoutineSnapshot {
  checklistItems: unknown[];
  gamePlans: Record<string, unknown>;
  tradingRules: unknown[];
}

export interface AppPersistence {
  saveAccounts(accounts: unknown[]): Promise<void>;
  loadAccounts(): Promise<unknown[] | null>;
  saveSelectedAccountId(id: string | null): void;
  loadSelectedAccountId(): string | null;
  saveNotes(notes: Record<string, unknown>): Promise<void>;
  loadNotes(): Promise<Record<string, unknown>>;
  saveTrades(trades: unknown[]): void;
  loadTrades<T>(): T[] | null;
  saveSettings(settings: StoredSettings): void;
  loadSettings(): StoredSettings | null;
  saveTheme(theme: string): void;
  loadTheme(): string | null;
  saveRoutine(snapshot: RoutineSnapshot): void;
  loadRoutine(): RoutineSnapshot | null;
  saveJournalEntries(entries: unknown[]): void;
  loadJournalEntries<T>(): T[] | null;
}
