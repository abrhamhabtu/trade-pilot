"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Play, RefreshCw, Sparkles, Square, X } from "lucide-react";
import { analyze, type Scan } from "@/lib/vision/analyze";
import { useFeed, type Feed } from "@/lib/vision/feed";
import { SYMBOLS, TIMEFRAMES, formatPrice, type Timeframe, type VisionSymbolId } from "@/lib/vision/markets";
import type { VisionPosition } from "@/store/visionStore";
import { VisionChart, type Phase } from "./VisionChart";

const SCAN_MS = 2400;
const CALLOUT_MS = 650;

/**
 * The reveal: a scan line crosses the chart, then each callout appears in
 * turn, then the plan and projection. Runs again whenever the chart, the
 * timeframe or the setup changes, or the trader asks for a rescan.
 */
function usePhase(key: string, callouts: number): Phase & { done: boolean; step: "scanning" | "marking" | "planning" | "done" } {
  const [p, setP] = useState<Phase & { done: boolean; step: "scanning" | "marking" | "planning" | "done" }>({ scan: 0, revealed: 0, projection: false, done: false, step: "scanning" });
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setP({ scan: null, revealed: callouts, projection: true, done: true, step: "done" });
      return;
    }
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = performance.now();
    setP({ scan: 0, revealed: 0, projection: false, done: false, step: "scanning" });
    const frame = (now: number) => {
      const f = Math.min(1, (now - start) / SCAN_MS);
      setP((x) => ({ ...x, scan: f }));
      if (f < 1) raf = requestAnimationFrame(frame);
      else {
        setP((x) => ({ ...x, scan: null, step: callouts ? "marking" : "done", done: !callouts }));
        for (let k = 1; k <= callouts; k++) timers.push(setTimeout(() => setP((x) => ({ ...x, revealed: k })), k * CALLOUT_MS));
        if (callouts) {
          timers.push(setTimeout(() => setP((x) => ({ ...x, projection: true, step: "planning" })), (callouts + 1) * CALLOUT_MS));
          timers.push(setTimeout(() => setP((x) => ({ ...x, step: "done", done: true })), (callouts + 2.5) * CALLOUT_MS));
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [key, callouts]);
  return p;
}

export interface ChartState {
  feed: Feed;
  scan: Scan | null;
  phase: ReturnType<typeof usePhase>;
  /** Replaying history: nothing on screen may be traded. */
  replaying: boolean;
}

export function ChartCard({
  symbol,
  tf,
  focused,
  compact,
  position,
  tradeLabel,
  onFocus,
  onTf,
  onClose,
  onState,
}: {
  symbol: VisionSymbolId;
  tf: Timeframe;
  focused: boolean;
  compact: boolean;
  position: VisionPosition | null;
  tradeLabel: string;
  onFocus: () => void;
  onTf: (tf: Timeframe) => void;
  onClose?: () => void;
  onState: (s: ChartState) => void;
}) {
  const sym = SYMBOLS[symbol];
  const feed = useFeed(symbol, tf);
  const fmt = (n: number) => formatPrice(sym, n);
  // Replay: walk the latest real setup forward bar by bar.
  const [replay, setReplay] = useState<{ cursor: number; end: number } | null>(null);
  const bars = replay ? feed.bars.slice(0, replay.cursor) : feed.bars;
  // Analyse closed bars only: recompute when a bar closes, not on every tick.
  const closedKey = bars.length > 1 ? `${bars.length}:${bars[bars.length - 2].t}` : "";
  const scan = useMemo(() => (bars.length > 1 ? analyze(bars, { forming: true, fmt }) : null), [closedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rescan, setRescan] = useState(0);
  const setup = scan?.setup ?? null;
  const phase = usePhase(`${symbol}|${tf}|${setup?.id ?? "none"}|${rescan}|${bars.length ? 1 : 0}`, setup ? setup.callouts.length : 0);

  useEffect(() => setReplay(null), [symbol, tf]);
  useEffect(() => {
    if (!replay) return;
    if (replay.cursor >= replay.end) {
      const id = setTimeout(() => setReplay(null), 2500);
      return () => clearTimeout(id);
    }
    // Hold while a reveal is playing, so each step can be read.
    if (!phase.done && phase.step !== "done") return;
    const id = setTimeout(() => setReplay((r) => (r ? { ...r, cursor: r.cursor + 1 } : r)), 160);
    return () => clearTimeout(id);
  }, [replay, phase.done, phase.step]);
  const startReplay = () => {
    const past = analyze(feed.bars, { forming: true, fmt, maxAge: 800 }).setup;
    if (!past) return;
    const start = Math.max(70, past.levelIndex - 12);
    setReplay({ cursor: start, end: Math.min(feed.bars.length, (past.outcomeIndex ?? feed.bars.length - 1) + 8) });
  };

  const report = useRef(onState);
  report.current = onState;
  useEffect(() => report.current({ feed, scan, phase, replaying: !!replay }), [feed, scan, phase, replay]);

  const last = bars[bars.length - 1];
  const first = bars.find((b) => last && b.t >= last.t - 86_400);
  const change = last && first ? ((last.c - first.o) / first.o) * 100 : null;

  const banner = (() => {
    if (feed.loading && !feed.bars.length) return { title: "Loading the chart", detail: `Pulling ${sym.label} ${tf} bars` };
    if (feed.error && !feed.bars.length) return { title: "No data right now", detail: feed.error };
    if (replay && phase.step !== "scanning" && (!setup || phase.done)) return { title: "Replaying history", detail: `Bar ${replay.cursor} of ${feed.bars.length}: watching the latest real setup play out. Nothing here can be traded` };
    if (phase.step === "scanning") return { title: "Scanning the chart", detail: "Reading structure, liquidity, volume and momentum on every candle" };
    if (setup && phase.step === "marking") {
      const c = setup.callouts[Math.max(0, phase.revealed - 1)];
      return { title: c ? (c.n === 1 ? `Marks the ${c.title.toLowerCase()}` : c.title) : "Pattern recognised", detail: c?.detail ?? "" };
    }
    if (position) return { title: "Price vs the plan", detail: `${position.side === "long" ? "Long" : "Short"} from ${fmt(position.entry)}, stop ${fmt(position.stop)}, target ${fmt(position.target)}` };
    if (setup && setup.outcome === "target") return { title: "Prediction confirmed", detail: `Reached ${fmt(setup.target)}. Scanning for the next setup` };
    if (setup && setup.outcome === "stop") return { title: "Stopped out", detail: `The ${setup.side} setup hit ${fmt(setup.stop)}. Scanning for the next one` };
    if (setup && setup.outcome === "open")
      return setup.fresh
        ? { title: "Your call", detail: "Take the trade, skip it, or let auto-execute take setups like this" }
        : { title: `${setup.side === "long" ? "Long" : "Short"} setup in play`, detail: `Fired ${scan!.closed - 1 - setup.index} bars ago; the plan is still open` };
    const below = scan?.pools.below;
    const above = scan?.pools.above;
    return { title: "Waiting for a high-probability setup", detail: below || above ? `Watching ${[below && fmt(below.price) + " below", above && fmt(above.price) + " above"].filter(Boolean).join(" and ")}` : "Watching for a sweep and reversal" };
  })();
  const progress = phase.step === "scanning" ? (phase.scan ?? 0) : phase.step === "marking" ? 0.4 + 0.15 * phase.revealed : 1;
  const sourceLabel = feed.source === "coinbase" ? "Coinbase · live" : feed.source === "tradovate" ? `Tradovate · live${feed.contract ? ` · ${feed.contract}` : ""}` : feed.source === "projectx" ? `TopstepX · live${feed.contract ? ` · ${feed.contract}` : ""}` : feed.source === "yahoo" ? "Delayed ~10 min" : "";
  const fresh = Date.now() - feed.lastTick < (sym.kind === "crypto" ? 15_000 : 60_000);

  return (
    <section
      onMouseDown={onFocus}
      className={clsx("relative overflow-hidden rounded-[28px] border bg-[#121214]/80 backdrop-blur-2xl transition", focused ? "border-white/[0.14] shadow-[0_30px_80px_-40px_rgba(255,138,61,0.35)]" : "border-white/[0.07]")}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-white">{sym.label}</h2>
          {last && <span className="text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-white">{fmt(last.c)}</span>}
          {change != null && (
            <span className={clsx("rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums", change >= 0 ? "bg-[#FF8A3D]/15 text-[#FFB27D]" : "bg-white/[0.08] text-white/70")}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          )}
        </div>
        <span className="text-[12px] text-white/45">
          {sym.name} · {tf} {sourceLabel && `· ${sourceLabel}`}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className={clsx("mr-1 flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.06em]", feed.delayed ? "text-white/45" : "text-[#FF8A3D]")}>
            {feed.delayed ? "DELAYED" : "LIVE"}
            <span className={clsx("h-1.5 w-1.5 rounded-full", feed.delayed ? "bg-white/40" : "bg-[#FF8A3D]", fresh && !feed.delayed && "animate-pulse")} />
          </span>
          <div className="flex rounded-full bg-white/[0.06] p-0.5">
            {TIMEFRAMES.map((t) => (
              <button key={t} onClick={() => onTf(t)} className={clsx("rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition", t === tf ? "bg-white/[0.16] text-white" : "text-white/50 hover:text-white")}>
                {t}
              </button>
            ))}
          </div>
          <button
            aria-label={replay ? "Stop replay" : "Replay the latest setup"}
            title={replay ? "Stop replay" : "Replay the latest setup bar by bar"}
            onClick={() => (replay ? setReplay(null) : startReplay())}
            className={clsx("flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold", replay ? "bg-[#FF8A3D] text-black" : "text-white/60 hover:bg-white/[0.08] hover:text-white")}
          >
            {replay ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {replay ? "Replaying" : "Replay"}
          </button>
          <button aria-label="Scan again" title="Scan again" onClick={() => setRescan((r) => r + 1)} className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
          {onClose && (
            <button aria-label="Close chart" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <div className="mx-5 mt-3 overflow-hidden rounded-2xl border border-[#FF8A3D]/20 bg-gradient-to-r from-[#FF8A3D]/[0.12] via-white/[0.03] to-transparent">
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFB27D] to-[#FF7A2D] text-black shadow-[0_6px_18px_-6px_rgba(255,138,61,0.9)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div key={banner.title} className="tp-card-in min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-white">{banner.title}</p>
            <p className="truncate text-[12.5px] text-white/55">{banner.detail}</p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-[#FF8A3D]/15 px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-[#FFB27D] sm:inline">{tradeLabel}</span>
        </div>
        <div className="h-0.5 bg-white/[0.04]">
          <div className="h-full bg-gradient-to-r from-[#FF8A3D] to-[#FFB27D] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="px-2 pb-2 pt-2">
        {bars.length ? (
          <VisionChart bars={bars} sym={sym} scan={scan} phase={phase} position={replay ? null : position} height={compact ? 380 : 560} />
        ) : (
          <div className="tp-shimmer m-3 rounded-2xl" style={{ height: compact ? 360 : 540 }} />
        )}
      </div>
      {feed.note && <p className="px-5 pb-3 text-[12px] text-white/45">{feed.note}</p>}
    </section>
  );
}
