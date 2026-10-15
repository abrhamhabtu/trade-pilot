// Runs a tournament off the main thread: tuning tries every rule variant of
// every strategy, which takes a few seconds and would freeze the page.

import type { Bar } from "@/lib/pilot/market";
import { toSessions, type Instrument, type StrategyConfig, type StrategyId } from "./engine";
import { TOURNEY_STRATEGIES, finishedSessions, runTournament, tune, type TourneyMode } from "./tournament";

export type TourneyRequest = { id: number; bars: Bar[]; instrument: Instrument; size: number; mode: TourneyMode; now: number };

self.onmessage = (event: MessageEvent<TourneyRequest>) => {
  const { id, bars, instrument, size, mode, now } = event.data;
  try {
    const sessions = toSessions(bars);
    let tuned: Partial<Record<StrategyId, StrategyConfig>> | undefined;
    if (mode === "tuned") {
      const done = finishedSessions(sessions, now);
      const train = done.slice(0, Math.floor(done.length / 2));
      const ref = done[done.length - 1]?.rth.at(-1)?.c;
      tuned = {};
      TOURNEY_STRATEGIES.forEach((s, i) => {
        self.postMessage({ id, type: "progress", done: i, total: TOURNEY_STRATEGIES.length + 1, label: `Tuning ${s}` });
        tuned![s] = tune(s, train, instrument, ref);
      });
    }
    self.postMessage({ id, type: "progress", done: TOURNEY_STRATEGIES.length, total: TOURNEY_STRATEGIES.length + 1, label: "Dealing account lives" });
    self.postMessage({ id, type: "done", result: runTournament(sessions, instrument, size, { now, tuned }) });
  } catch (e) {
    self.postMessage({ id, type: "error", error: e instanceof Error ? e.message : "Tournament failed" });
  }
};
