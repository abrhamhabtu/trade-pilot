"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { FlaskConical, X } from "lucide-react";
import { useProvingStore } from "@/store/provingStore";
import { useSessionFlow } from "@/store/sessionFlowStore";
import { advance, feedFor, loadFeed, testEvaluation } from "@/lib/proving/runner";
import { STRATEGIES } from "@/lib/proving/engine";
import { chime } from "@/components/pilot/flow/judge";

const TICK_MS = 60_000;

type Ping = { id: number; color: string; title: string; body: string; tone: "go" | "caution" | "wait" };

/**
 * Mounted once for the whole app. Every minute it advances each running test
 * on fresh bars, so tests trade the morning on their own while TradePilot is
 * open, and catch up exactly when it is opened again.
 */
export function ProvingRunner() {
  const running = useProvingStore((s) => s.tests.filter((t) => t.state === "running").map((t) => `${t.id}:${t.lastRun === 0}`).join(","));
  const [pings, setPings] = useState<Ping[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    const tick = async () => {
      if (busy.current || stopped) return;
      busy.current = true;
      try {
        const { tests, saveDays } = useProvingStore.getState();
        const signals = useSessionFlow.getState().signals;
        for (const t of tests.filter((x) => x.state === "running")) {
          const { source, tf } = feedFor(t);
          let feed;
          try {
            feed = await loadFeed(source, tf);
          } catch (e) {
            saveDays(t.id, [], e instanceof Error ? e.message : "Bars unavailable");
            continue;
          }
          const before = testEvaluation(t)?.verdict;
          const firstRun = t.lastRun === 0;
          const days = advance(t, feed.sessions, signals);
          const prevTrades = new Map(Object.values(t.days).flatMap((d) => d.trades).map((x) => [x.id, x.exit]));
          saveDays(t.id, days);
          const next = useProvingStore.getState().tests.find((x) => x.id === t.id);
          if (!next) continue;
          const after = testEvaluation(next);
          // A decided account frees its slot; tweaking the rules starts it again.
          const decided = after && (after.verdict === "passed" || after.verdict === "failed") && !Object.values(next.days).some((d) => d.partial);
          if (decided) useProvingStore.getState().update(t.id, { state: "paused" });
          if (firstRun) continue; // a fresh replay would ping for every historical trade
          const label = `${t.name} · ${STRATEGIES[t.cfg.strategy].short}`;
          for (const tr of days.flatMap((d) => d.trades)) {
            const was = prevTrades.get(tr.id);
            if (was === undefined)
              push({ color: t.color, title: label, body: `${tr.side === "long" ? "Long" : "Short"} ${tr.qty} ${t.cfg.instrument} @ ${tr.entryPx.toLocaleString("en-US")}. ${tr.why}.`, tone: "go" });
            if ((was === undefined || was === "open") && tr.exit !== "open")
              push({ color: t.color, title: label, body: `Closed ${tr.pnl >= 0 ? "+" : "-"}$${Math.abs(Math.round(tr.pnl))} (${tr.exit}, ${tr.r >= 0 ? "+" : ""}${tr.r}R).`, tone: tr.pnl >= 0 ? "go" : "wait" });
          }
          if (after && after.verdict !== before && (after.verdict === "passed" || after.verdict === "failed"))
            push({ color: t.color, title: `${t.name}: ${after.verdict === "passed" ? "PASSED" : "FAILED"}`, body: after.headline, tone: after.verdict === "passed" ? "go" : "wait" });
        }
      } finally {
        busy.current = false;
      }
    };
    const push = (p: Omit<Ping, "id">) => {
      chime(p.tone);
      setPings((xs) => [...xs.slice(-2), { ...p, id: Date.now() + Math.random() }]);
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    const onFocus = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [running]);

  useEffect(() => {
    if (!pings.length) return;
    const id = setTimeout(() => setPings((xs) => xs.slice(1)), 9000);
    return () => clearTimeout(id);
  }, [pings]);

  if (!pings.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[65] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      {pings.map((p) => (
        <div key={p.id} className="tp-flow-scan overflow-hidden rounded-xl border border-white/[0.08] bg-tp-raised/95 shadow-xl shadow-black/40 backdrop-blur">
          <div className="flex items-start gap-3 p-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${p.color}22`, color: p.color }}>
              <FlaskConical className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Proving Ground</p>
              <p className="truncate text-[13px] font-semibold text-zinc-100">{p.title}</p>
              <p className={clsx("text-[12.5px]", p.tone === "wait" ? "text-tp-red" : "text-zinc-300")}>{p.body}</p>
              <Link href="/app/proving" className="text-[11px] font-medium text-tp-blue hover:underline">
                Open →
              </Link>
            </div>
            <button aria-label="Dismiss" onClick={() => setPings((xs) => xs.filter((x) => x.id !== p.id))} className="text-zinc-500 hover:text-zinc-200">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
