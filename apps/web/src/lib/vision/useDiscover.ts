"use client";

// Discover's studies for a chart. With library data the server's deep study
// is read (years of history); without it, a worker rates every idea on the
// recent bars the browser can fetch, clearly marked as recent only. Results
// are kept for five minutes per market and timeframe.

import { useCallback, useEffect, useRef, useState } from "react";
import { DISCOVER_DEFAULTS, type DetectorStudy } from "./discover";
import type { DiscoverReply, DiscoverRequest } from "./discover.worker";
import { loadHistory } from "./feed";
import { FEES } from "./limits";
import { SYMBOLS, type Timeframe, type VisionSymbolId } from "./markets";

export interface DiscoverData {
  status: "idle" | "loading" | "ready" | "error";
  source: "library" | "recent" | null;
  studies: Map<string, DetectorStudy>;
  /** Ideas tested on this market: the Bonferroni m. */
  m: number;
  /** The timeframe the studies are on (5m or 15m). */
  studyTf: Timeframe;
  /** A deep study running on the server. */
  job: { stage: string; done: number; total: number } | null;
  /** The library has this market but no study yet: one can be run. */
  canDeep: boolean;
  /** Worker progress, 0..1, while rating on recent bars. */
  progress: number | null;
  error: string;
  runDeep: () => void;
}

/** 1m reads from the 5m study; 1h and 4h from the 15m one. */
export const studyTfOf = (tf: Timeframe): Timeframe => (tf === "15m" || tf === "1h" || tf === "4h" ? "15m" : "5m");

const KEEP_MS = 5 * 60_000;
const cache = new Map<string, { at: number; source: "library" | "recent"; studies: DetectorStudy[]; m: number }>();

export function useDiscover(symbol: VisionSymbolId, tf: Timeframe, enabled: boolean): DiscoverData {
  const studyTf = studyTfOf(tf);
  const key = `${symbol}|${studyTf}`;
  const sym = SYMBOLS[symbol];
  const futures = sym.kind === "futures";
  const deepMarket = futures && DISCOVER_DEFAULTS.markets.includes(symbol);
  const [state, setState] = useState<Omit<DiscoverData, "runDeep" | "studyTf">>({ status: "idle", source: null, studies: new Map(), m: 0, job: null, canDeep: false, progress: null, error: "" });
  const [nonce, setNonce] = useState(0);
  const worker = useRef<Worker | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let poll: ReturnType<typeof setTimeout> | null = null;
    const done = (source: "library" | "recent", studies: DetectorStudy[], m: number, extra: Partial<DiscoverData> = {}) => {
      cache.set(key, { at: Date.now(), source, studies, m });
      if (live) setState((s) => ({ ...s, status: "ready", source, studies: new Map(studies.map((x) => [x.id, x])), m, progress: null, error: "", ...extra }));
    };
    const recent = async (canDeep: boolean) => {
      setState((s) => ({ ...s, status: "loading", progress: 0, canDeep }));
      try {
        const bars = await loadHistory(symbol, studyTf);
        if (!live) return;
        if (bars.length < 300) throw new Error("Not enough recent bars to rate anything.");
        worker.current ??= new Worker(new URL("./discover.worker.ts", import.meta.url));
        const id = Date.now();
        worker.current.onmessage = (e: MessageEvent<DiscoverReply>) => {
          const msg = e.data;
          if (msg.id !== id || !live) return;
          if (msg.type === "progress") setState((s) => ({ ...s, progress: msg.done / msg.total }));
          else if (msg.type === "done") done("recent", msg.studies, msg.m, { canDeep });
          else setState((s) => ({ ...s, status: "error", error: msg.error, progress: null }));
        };
        const req: DiscoverRequest = {
          id,
          bars,
          symbol,
          tf: studyTf,
          futures,
          env: { anchor: futures ? "rth" : "utc", tick: sym.tick, pointValue: futures ? sym.pointValue!.micro : 1, fee: futures ? FEES.micro : 0, maxHold: studyTf === "5m" ? 48 : 24, context: { fomc: [], early: [], vix: {} } },
        };
        worker.current.postMessage(req);
      } catch (e) {
        if (live) setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Discover failed", progress: null }));
      }
    };
    const deep = async () => {
      const r = await fetch(`/api/library/lab?view=discover&symbol=${symbol}&tf=${studyTf}`, { cache: "no-store" });
      const j = (await r.json()) as { state: { studies: DetectorStudy[]; m: number } | null; job: DiscoverData["job"] & { error?: string } };
      if (!live) return;
      if (j.job && !j.job.error) {
        setState((s) => ({ ...s, job: j.job }));
        poll = setTimeout(deep, 3000);
      } else setState((s) => ({ ...s, job: null, error: j.job?.error ?? s.error }));
      if (j.state) return done("library", j.state.studies, j.state.m, { canDeep: false });
      // No deep study yet: rate on recent bars meanwhile, and offer the deep one when the library has this market.
      const lib = await fetch("/api/library", { cache: "no-store" })
        .then((x) => x.json())
        .catch(() => null);
      if (!live) return;
      const canDeep = !!lib?.series?.[symbol];
      const hit = cache.get(key);
      if (hit && hit.source === "recent" && Date.now() - hit.at < KEEP_MS) return done("recent", hit.studies, hit.m, { canDeep });
      if (!j.job) void recent(canDeep);
      else setState((s) => ({ ...s, canDeep }));
    };
    const hit = cache.get(key);
    if (hit && hit.source === "library" && Date.now() - hit.at < KEEP_MS && !nonce) done("library", hit.studies, hit.m);
    else if (deepMarket) {
      setState((s) => ({ ...s, status: s.status === "ready" ? "ready" : "loading" }));
      void deep().catch((e) => live && setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Discover failed" })));
    } else if (hit && Date.now() - hit.at < KEEP_MS) done(hit.source, hit.studies, hit.m);
    else void recent(false);
    return () => {
      live = false;
      if (poll) clearTimeout(poll);
    };
  }, [key, enabled, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const runDeep = useCallback(() => {
    void fetch("/api/library/lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discover", symbol }) }).then(() => {
      cache.delete(key);
      setNonce((n) => n + 1);
    });
  }, [symbol, key]);

  return { ...state, studyTf, runDeep };
}
