// Runs a backtest off the main thread: a year of 5-minute bars through every
// reader takes a few seconds and would freeze the page. With `league`, each
// strategy is then run on its own over the same bars, for the comparison table.

import type { Bar } from "@/lib/pilot/market";
import { READER_ORDER } from "./analyze";
import { runBacktest, type BacktestOptions } from "./backtest";

export type BacktestRequest = { id: number; bars: Bar[]; options: BacktestOptions; league?: boolean };

self.onmessage = (event: MessageEvent<BacktestRequest>) => {
  const { id, bars, options, league } = event.data;
  try {
    const result = runBacktest(bars, options, (done, total) => self.postMessage({ id, type: "progress", done, total }));
    self.postMessage({ id, type: "done", result });
    if (league) {
      const rows = READER_ORDER.map((reader) => ({ reader, stats: runBacktest(bars, { ...options, reader }).stats }));
      self.postMessage({ id, type: "league", rows });
    }
  } catch (e) {
    self.postMessage({ id, type: "error", error: e instanceof Error ? e.message : "Backtest failed" });
  }
};
