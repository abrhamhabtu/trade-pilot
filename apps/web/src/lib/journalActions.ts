import { useAccountStore, journalAccountCounts } from '@/store/accountStore';
import { DEFAULT_JOURNAL_ID, useJournalStore } from '@/store/journalStore';

/** Switch the whole app to another journal. */
export function openJournal(id: string) {
  if (useJournalStore.getState().activeId === id) return;
  // Accounts first: the account store reads which journal it is leaving.
  useAccountStore.getState().switchJournal(id);
  useJournalStore.getState().setActive(id);
}

/** Create a journal and step into it. */
export function createJournal(name: string) {
  const id = useJournalStore.getState().addJournal(name);
  openJournal(id);
  return id;
}

/** Delete a journal. Its accounts are kept: they move to the first journal. */
export function deleteJournal(id: string) {
  if (id === DEFAULT_JOURNAL_ID) return;
  openJournal(id);
  const accounts = useAccountStore.getState();
  for (const a of [...accounts.accounts]) accounts.moveAccountToJournal(a.id, DEFAULT_JOURNAL_ID);
  openJournal(DEFAULT_JOURNAL_ID);
  useJournalStore.getState().removeJournal(id);
}

export const accountCounts = () => journalAccountCounts(useAccountStore.getState().accounts);
