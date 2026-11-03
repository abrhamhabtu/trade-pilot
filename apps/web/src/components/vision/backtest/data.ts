"use client";

// Client side of the backtest workspace: the data library, the history a run
// uses, the session calendars and the trader's saved work.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bar } from "@/lib/pilot/market";
import type { LibFile, LibraryIndex } from "@/lib/server/library";
import type { SavedItem } from "@/lib/server/library/saved";
import type { BacktestContext } from "@/lib/vision/backtest";
import { loadHistory } from "@/lib/vision/feed";
import { SYMBOLS, isSymbol, type Timeframe } from "@/lib/vision/markets";
import type { BacktestSettings } from "@/store/visionStore";

export type { LibFile, SavedItem };
export type Library = LibraryIndex & { jobs: Record<string, { stage: string; done: number; total: number }> };

/** The library index, refreshed every couple of seconds while anything is processing. */
export function useLibrary() {
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/library", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Library unavailable");
      setLib(j);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Library unavailable");
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const busy = !!lib && (lib.files.some((f) => f.status === "processing") || Object.keys(lib.jobs).length > 0);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [busy, refresh]);
  return { lib, error, refresh, busy };
}

type RawContext = { fomc: string[]; vix: Record<string, number>; earlyCloses: { equity: { date: string }[]; metals: { date: string }[] } };

/** FOMC days, early closes and VIX for the filters; empty when the free-data pack is not in the library. */
export function useContext(symbol: string) {
  const [raw, setRaw] = useState<RawContext | null>(null);
  useEffect(() => {
    fetch("/api/library/context", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setRaw)
      .catch(() => setRaw(null));
  }, []);
  const metals = symbol === "GC";
  const ctx: BacktestContext = {
    fomc: raw?.fomc ?? [],
    vix: raw?.vix ?? {},
    early: (metals ? raw?.earlyCloses.metals : raw?.earlyCloses.equity)?.map((d) => d.date) ?? [],
  };
  return { ctx, has: { fomc: ctx.fomc.length > 0, early: ctx.early.length > 0, vix: Object.keys(ctx.vix).length > 0 } };
}

export interface Loaded {
  key: string;
  bars: Bar[];
  source: "library" | "feed";
  /** Where the bars came from, for the screen. */
  label: string;
  truncated: boolean;
}

const DAY = 86_400;
export const MAX_LIBRARY_BARS = 80_000;

/** The period a run covers, as unix seconds, from the settings and what the library holds. */
export function periodOf(s: BacktestSettings, cover: { from: number; to: number }) {
  if (s.days === -1 && s.from && s.to) {
    const from = Math.max(cover.from, Date.parse(`${s.from}T00:00:00Z`) / 1000);
    const to = Math.min(cover.to, Date.parse(`${s.to}T23:59:59Z`) / 1000);
    return { from, to };
  }
  return { from: s.days > 0 ? Math.max(cover.from, cover.to - s.days * DAY) : cover.from, to: cover.to };
}

const keyOf = (s: BacktestSettings) => `${s.symbol}|${s.source}|${s.tf}|${s.days}|${s.from ?? ""}|${s.to ?? ""}`;

/** Loads (and remembers) the bars for the current settings. */
export function useHistory(lib: Library | null) {
  const cache = useRef(new Map<string, Loaded>());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(
    async (s: BacktestSettings): Promise<Loaded | null> => {
      const key = keyOf(s);
      const hit = cache.current.get(key);
      if (hit) return hit;
      setLoading(true);
      setError("");
      try {
        let out: Loaded;
        const info = lib?.series[s.symbol];
        if (s.source === "library" && info) {
          const { from, to } = periodOf(s, info);
          const r = await fetch(`/api/library/bars?symbol=${s.symbol}&tf=${s.tf}&from=${Math.floor(from)}&to=${Math.ceil(to)}&max=${MAX_LIBRARY_BARS}`, { cache: "no-store" });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || "Library bars unavailable");
          const bars: Bar[] = j.t.map((t: number, i: number) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v[i] }));
          out = { key, bars, source: "library", label: `Your data · ${info.sources.join(", ") || "library"}`, truncated: !!j.truncated };
        } else {
          if (!isSymbol(s.symbol)) throw new Error(`${s.symbol} is only in your library; pick Library as the source.`);
          let bars = await loadHistory(s.symbol, s.tf as Timeframe);
          if (bars.length) {
            const { from, to } = periodOf(s, { from: bars[0].t, to: bars[bars.length - 1].t });
            bars = bars.filter((b) => b.t >= from && b.t <= to);
          }
          out = { key, bars, source: "feed", label: SYMBOLS[s.symbol].kind === "crypto" ? "Coinbase · free history" : "Yahoo · free history, ~10 min delayed", truncated: false };
        }
        if (out.bars.length < 120) throw new Error("Not enough bars in that period to test. Pick a longer period or another timeframe.");
        cache.current.set(key, out);
        return out;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load bars");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [lib],
  );
  return { load, loading, error, peek: (s: BacktestSettings) => cache.current.get(keyOf(s)) ?? null };
}

/** Saved backtests and replay sessions. */
export function useSaved() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/library/saved", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setItems(j.items);
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const save = useCallback(
    async (body: { item: Omit<SavedItem, "id" | "at">; settings: unknown; trades: Record<string, unknown>[]; extra?: unknown }) => {
      setError("");
      const r = await fetch("/api/library/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", ...body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error || "Could not save");
        return null;
      }
      refresh();
      return j.item as SavedItem;
    },
    [refresh],
  );
  const remove = useCallback(
    async (id: string) => {
      await fetch("/api/library/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove", id }) });
      refresh();
    },
    [refresh],
  );
  return { items, error, refresh, save, remove };
}

export function download(name: string, text: string, type = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const money = (n: number, dp = 0) => `${n < 0 ? "-" : n > 0 ? "+" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
export const sizeOf = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${Math.round(b / 1e3)} KB` : `${b} B`);
export const dateOf = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
export const timeOf = (t: number) => new Date(t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
