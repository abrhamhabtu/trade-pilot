"use client";
import { useEffect } from "react";
import { useAccountStore } from "@/store/accountStore";
import { syncAccount } from "@/lib/sync";

export function AutoSync() {
  useEffect(() => {
    let busy = false;
    const attempted = new Map<string, number>();
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        for (const account of useAccountStore.getState().accounts) {
          if (account.syncSource?.automatic && account.status === "active") {
            const delay =
              account.syncSource.provider === "projectx" ? 60000 : 300000;
            if (Date.now() - (attempted.get(account.id) ?? 0) < delay) continue;
            attempted.set(account.id, Date.now());
            await syncAccount(account.id);
          }
        }
      } finally {
        busy = false;
      }
    };
    const interval = window.setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return null;
}
