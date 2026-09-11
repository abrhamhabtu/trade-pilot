"use client";
import { create } from "zustand";
import { useAccountStore } from "@/store/accountStore";
import type { Trade } from "@/store/tradingStore";

export const useSyncStatus = create<{
  messages: Record<string, string>;
  set: (id: string, message: string) => void;
}>((set) => ({
  messages: {},
  set: (id, message) =>
    set((s) => ({ messages: { ...s.messages, [id]: message } })),
}));
export async function projectXRequest(body: Record<string, unknown>) {
  return connectionRequest("projectx", body);
}
export async function connectionRequest(
  provider: "projectx" | "tradovate-demo" | "tradovate-live",
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/connections/${provider === "projectx" ? "projectx" : "tradovate"}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        environment: provider === "tradovate-live" ? "live" : "demo",
      }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Connection failed. Try again.");
  return data;
}
const running = new Set<string>();
export async function syncAccount(id: string) {
  const source = useAccountStore
    .getState()
    .accounts.find((a) => a.id === id)?.syncSource;
  if (!source || running.has(id)) return;
  running.add(id);
  useSyncStatus.getState().set(id, "Syncing…");
  try {
    const data = await connectionRequest(source.provider, {
      action: "trades",
      accountId: source.remoteId,
      start: source.start,
    });
    const current = useAccountStore
      .getState()
      .accounts.find((a) => a.id === id);
    if (
      !current ||
      current.syncSource?.remoteId !== source.remoteId ||
      current.syncSource.provider !== source.provider ||
      current.syncSource.start !== source.start
    ) {
      useSyncStatus.getState().set(id, 'Account or history range changed. Sync again.');
      return;
    }
    const existing = new Map(current.trades.map((t) => [t.id, t]));
    const incoming: Trade[] = data.trades.map((t: Trade) => ({
      ...t,
      ...(existing.has(t.id)
        ? {
            notes: existing.get(t.id)?.notes,
            strategy: existing.get(t.id)?.strategy,
            rMultiple: existing.get(t.id)?.rMultiple,
          }
        : {}),
    }));
    const replaced = new Set([
      ...incoming.map((t) => t.id),
      ...(data.voidedIds ?? []),
    ]);
    // A limited history response must never erase older records that the provider omitted.
    const trades = [
      ...current.trades.filter((t) => !replaced.has(t.id)),
      ...incoming,
    ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    const balance =
      trades.reduce((sum, t) => sum + t.netPL, 0) +
      (current.balanceAdjustments ?? []).reduce((sum, a) => sum + a.amount, 0);
    useAccountStore.getState().updateAccount(id, {
      trades,
      balance,
      lastUpdate: new Date(data.asOf).toLocaleString(),
      syncSource: { ...current.syncSource, lastSynced: data.asOf },
    });
    useSyncStatus
      .getState()
      .set(id, `${incoming.length} closed executions synced`);
  } catch (error) {
    useSyncStatus
      .getState()
      .set(
        id,
        error instanceof Error
          ? error.message
          : "Sync failed. Existing trades are unchanged.",
      );
  } finally {
    running.delete(id);
  }
}
