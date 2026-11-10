"use client";

// Day levels for a live chart. Live charts hold too few bars for yesterday's
// range or the overnight session on fast timeframes, so levels come from their
// own 5-minute history, fetched once per market and kept for five minutes. The
// chart's own bars are rolled up onto the end of it, so today's levels keep up
// with the feed instead of the history's delay.

import { useEffect, useMemo, useState } from "react";
import type { Bar } from "@/lib/pilot/market";
import { sessionOf } from "@/lib/pilot/market";
import { loadHistory } from "./feed";
import { alignLevels, levelsFor, type DayLevels } from "./levels";
import { SYMBOLS, TF_SECONDS, aggregate, type Timeframe, type VisionSymbolId } from "./markets";

const STEP = 300;
const KEEP_MS = 5 * 60_000;
const cache = new Map<VisionSymbolId, { at: number; bars: Bar[] }>();
const pending = new Map<VisionSymbolId, Promise<Bar[]>>();

async function history(symbol: VisionSymbolId): Promise<Bar[]> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.bars;
  const wait = pending.get(symbol);
  if (wait) return wait;
  const p = (async () => {
    let bars: Bar[] = [];
    try {
      bars = await loadHistory(symbol, "5m");
    } catch {
      bars = [];
    }
    // The free feed can be down; the library's 5m series is the fallback when it has this market.
    if (bars.length < 300) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const r = await fetch(`/api/library/bars?symbol=${symbol}&tf=5m&from=${now - 45 * 86_400}&to=${now}&max=20000`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const lib: Bar[] = j.t.map((t: number, i: number) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v[i] }));
          if (lib.length > bars.length) bars = lib;
        }
      } catch {
        /* no library: levels stay empty and the chart says nothing about them */
      }
    }
    cache.set(symbol, { at: Date.now(), bars });
    return bars;
  })().finally(() => pending.delete(symbol));
  pending.set(symbol, p);
  return p;
}

/** The 5m history with the chart's newer bars rolled up onto its end. */
export function mergeHistory(hist: Bar[], chart: Bar[], tf: Timeframe): Bar[] {
  if (!chart.length || TF_SECONDS[tf] > STEP) return hist;
  const last = hist.length ? hist[hist.length - 1].t : -Infinity;
  // Only whole 5m bars that start after the history ends; the one still forming is left out.
  const rolled = aggregate(chart, STEP).filter((b) => b.t > last);
  const lastChart = chart[chart.length - 1].t;
  const done = rolled.filter((b) => b.t + STEP <= lastChart + TF_SECONDS[tf]);
  return done.length ? [...hist, ...done] : hist;
}

export interface LevelsState {
  /** Day levels aligned to each chart bar; null where unknown. */
  perBar: (DayLevels | null)[];
  /** The levels as of the last closed chart bar. */
  now: DayLevels | null;
  ready: boolean;
}

export function useLevels(symbol: VisionSymbolId, tf: Timeframe, chart: Bar[]): LevelsState {
  const futures = SYMBOLS[symbol].kind === "futures";
  const [hist, setHist] = useState<Bar[] | null>(null);
  useEffect(() => {
    setHist(null);
    if (!futures) return;
    let live = true;
    const pull = () => history(symbol).then((b) => live && setHist(b));
    pull();
    const id = setInterval(pull, KEEP_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [symbol, futures]);
  // Recompute when a chart bar closes, not on every tick.
  const closedKey = chart.length > 1 ? chart[chart.length - 2].t : 0;
  return useMemo(() => {
    if (!futures || !hist || !hist.length) return { perBar: chart.map(() => null), now: null, ready: !futures || !!hist };
    const merged = mergeHistory(hist, chart, tf);
    const lv = levelsFor(merged);
    const perBar = alignLevels(chart, TF_SECONDS[tf], merged, lv, STEP);
    const closed = chart.length > 1 ? perBar[chart.length - 2] : null;
    return { perBar, now: closed, ready: true };
  }, [hist, closedKey, chart.length, tf, futures]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** First chart bar of the session the last bar is in, for where level lines start. */
export function sessionStartIndex(chart: Bar[]) {
  if (!chart.length) return 0;
  const key = sessionOf(chart[chart.length - 1].t).session;
  let k = chart.length - 1;
  while (k > 0 && sessionOf(chart[k - 1].t).session === key) k--;
  return k;
}
