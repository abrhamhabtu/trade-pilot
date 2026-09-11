"use client";
import { useEffect } from "react";
import { useAccountStore } from "@/store/accountStore";
import { prepareReviews } from "@/lib/pilot/workspace";

// Runs for every opted-in account on imports, connector syncs and manual entries,
// throughout the app. No paid model calls and no broker mutations.
export function PilotAutomation() {
  const accounts = useAccountStore((s) => s.accounts);
  useEffect(() => {
    for (const account of accounts) {
      if (!account.pilotSettings) continue;
      const trades = prepareReviews(account.trades, account.pilotSettings);
      if (trades !== account.trades)
        useAccountStore.getState().updateAccount(account.id, { trades });
    }
  }, [accounts]);
  return null;
}
