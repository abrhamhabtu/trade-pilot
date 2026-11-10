// Discover without a library: rates every idea on the recent bars the browser
// can fetch (about 60 days of 5m), off the main thread. Nothing rated here can
// be called proven; the panel says so.

import type { Bar } from "@/lib/pilot/market";
import { ideasFor, scenarioSeries, studyRows, summarize, type DetectorStudy, type StudyEnv } from "./discover";
import { levelsFor } from "./levels";
import type { Timeframe, VisionSymbolId } from "./markets";
import { patternContext } from "./patterns";

export type DiscoverRequest = { id: number; bars: Bar[]; symbol: VisionSymbolId; tf: Timeframe; futures: boolean; env: StudyEnv };
export type DiscoverReply = { id: number; type: "progress"; done: number; total: number } | { id: number; type: "done"; studies: DetectorStudy[]; m: number } | { id: number; type: "error"; error: string };

self.onmessage = (event: MessageEvent<DiscoverRequest>) => {
  const { id, bars, symbol, tf, futures, env } = event.data;
  try {
    const ideas = ideasFor(symbol, tf, futures);
    const ctx = patternContext(bars, env.anchor, futures ? levelsFor(bars) : bars.map(() => null));
    const series = scenarioSeries(ctx);
    const studies: DetectorStudy[] = [];
    ideas.forEach((idea, k) => {
      const rows = studyRows(bars, [idea], env, { ctx, series })[idea.id] ?? [];
      studies.push(summarize(idea.id, tf, rows, "recent"));
      self.postMessage({ id, type: "progress", done: k + 1, total: ideas.length } satisfies DiscoverReply);
    });
    self.postMessage({ id, type: "done", studies, m: ideas.length } satisfies DiscoverReply);
  } catch (e) {
    self.postMessage({ id, type: "error", error: e instanceof Error ? e.message : "Discover failed" } satisfies DiscoverReply);
  }
};
