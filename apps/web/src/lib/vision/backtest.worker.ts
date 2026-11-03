// Runs a backtest off the main thread: a year of 5-minute bars through every
// reader takes a few seconds and would freeze the page. After the run come the
// verdict, each strategy on its own (the league) and, in prop firm mode, the
// firm grading; each is posted as soon as it is ready.

import type { Bar } from "@/lib/pilot/market";
import { READER_ORDER } from "./analyze";
import { runBacktest, type BacktestOptions } from "./backtest";
import { propReport } from "./prop";
import { verdict } from "./verdict";

export type PropRequest = { programKey: string; contracts: number; micro: boolean; pointValue: number; stepSeconds: number; fixedSize: boolean };
export type BacktestRequest = { id: number; bars: Bar[]; options: BacktestOptions; league?: boolean; prop?: PropRequest | null };

self.onmessage = (event: MessageEvent<BacktestRequest>) => {
  const { id, bars, options, league, prop } = event.data;
  try {
    const result = runBacktest(bars, options, (done, total) => self.postMessage({ id, type: "progress", done, total }));
    self.postMessage({ id, type: "done", result });
    self.postMessage({ id, type: "verdict", verdict: verdict(result) });
    if (prop) self.postMessage({ id, type: "prop", report: propReport(result.trades, bars, prop) });
    if (league) {
      const rows = READER_ORDER.map((reader) => ({ reader, stats: runBacktest(bars, { ...options, custom: null, reader }).stats }));
      self.postMessage({ id, type: "league", rows });
    }
  } catch (e) {
    self.postMessage({ id, type: "error", error: e instanceof Error ? e.message : "Backtest failed" });
  }
};
