// Client side of Proving Ground: fetch bars once per symbol and timeframe,
// then advance every test from its last finished session to now. Because the
// engine is deterministic, catching up after the app was closed produces the
// exact trades a live run would have taken.

import type { Bar } from "@/lib/pilot/market";
import { RTH_CLOSE, nyClock, rootSymbol } from "@/lib/pilot/market";
import type { TvSignal } from "@/lib/pilot/session";
import { INSTRUMENTS, runSession, toSessions, type DaySim, type Session, type Timeframe } from "./engine";
import { evaluate, programByKey } from "./firms";
import type { ProvingTest } from "@/store/provingStore";

type Feed = { at: number; bars: Bar[]; sessions: Session[] };
const feeds = new Map<string, Feed>();
const inflight = new Map<string, Promise<Feed>>();

export async function loadFeed(source: string, tf: Timeframe, maxAgeMs = 55_000): Promise<Feed> {
  const key = `${source}:${tf}`;
  const hit = feeds.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    const res = await fetch(`/api/proving/bars?source=${encodeURIComponent(source)}&tf=${tf}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "Bars unavailable");
    const bars: Bar[] = j.t.map((t: number, i: number) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v[i] }));
    const feed = { at: Date.now(), bars, sessions: toSessions(bars) };
    feeds.set(key, feed);
    return feed;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export const feedFor = (t: ProvingTest) => ({ source: INSTRUMENTS[t.cfg.instrument].source, tf: t.cfg.timeframe });

export function testEvaluation(t: ProvingTest) {
  const program = programByKey(t.programKey);
  if (!program) return null;
  const days = Object.values(t.days).filter((d) => d.date >= t.startDate);
  return evaluate(days, program, { contracts: t.cfg.contracts, micro: INSTRUMENTS[t.cfg.instrument].micro });
}

/** TradingView signals that belong to this test's market and arrived while it ran. */
export function signalsFor(t: ProvingTest, signals: TvSignal[]) {
  const family = INSTRUMENTS[t.cfg.instrument].source;
  return signals
    .filter((s) => s.side && s.receivedAt >= t.createdAt)
    .filter((s) => {
      const root = rootSymbol(s.symbol);
      return (family === "NQ=F" ? ["NQ", "MNQ"] : ["ES", "MES"]).includes(root);
    })
    .map((s) => ({ t: Math.floor(s.receivedAt / 1000), side: s.side as "long" | "short" }));
}

/**
 * The sessions to (re)simulate for a test: every finished session since the
 * start that is not stored yet, plus today's while it is still trading.
 * Stops at the session that decided the account.
 */
export function advance(t: ProvingTest, sessions: Session[], signals: TvSignal[], now = Date.now()): DaySim[] {
  const clock = nyClock(now);
  const verdict = testEvaluation(t);
  if (verdict && (verdict.verdict === "passed" || verdict.verdict === "failed") && !Object.values(t.days).some((d) => d.partial)) return [];
  const sig = t.cfg.strategy === "tv-signals" ? signalsFor(t, signals) : undefined;
  const out: DaySim[] = [];
  for (const s of sessions) {
    if (s.date < t.startDate || !s.rth.length) continue;
    const stored = t.days[s.date];
    const live = s.date === clock.date && clock.minute < RTH_CLOSE + 5;
    if (stored && !stored.partial && !live) continue;
    out.push(runSession(s, t.cfg, { partial: live, signals: sig }));
  }
  // Re-grade with the new sessions and drop anything after the deciding day.
  const merged = { ...t, days: { ...t.days, ...Object.fromEntries(out.map((d) => [d.date, d])) } };
  const e = testEvaluation(merged);
  if (e?.on && (e.verdict === "passed" || e.verdict === "failed")) return out.filter((d) => d.date <= e.on!);
  return out;
}
