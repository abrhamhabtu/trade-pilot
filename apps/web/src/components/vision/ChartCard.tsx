"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, FlaskConical, Play, RefreshCw, Sparkles, Square, X } from "lucide-react";
import { READERS, READER_ORDER, analyze, readerStats, type ReaderChoice, type ReaderId, type Scan, type Side } from "@/lib/vision/analyze";
import { buildDemo, type Demo } from "@/lib/vision/demo";
import { useFeed, type Feed } from "@/lib/vision/feed";
import type { Bar } from "@/lib/pilot/market";
import { SYMBOLS, TF_SECONDS, TIMEFRAMES, formatPrice, type Timeframe, type VisionSymbolId } from "@/lib/vision/markets";
import type { VisionPosition, VisionTrade } from "@/store/visionStore";
import { VisionChart, type Phase } from "./VisionChart";

const SCAN_MS = 2400;
const CALLOUT_MS = 700;

type Step = "scanning" | "marking" | "planning" | "done";

/**
 * The reveal: a scan line crosses the chart, each callout appears in turn,
 * then the plan and projection. Runs again whenever the chart, timeframe,
 * strategy or setup changes, or the trader asks for a rescan.
 */
function usePhase(key: string, callouts: number): Phase & { done: boolean; step: Step; key: string } {
  const [p, setP] = useState<Phase & { done: boolean; step: Step; key: string }>({ scan: 0, revealed: 0, projection: false, done: false, step: "scanning", key: "" });
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setP({ scan: null, revealed: callouts, projection: true, done: true, step: "done", key });
      return;
    }
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = performance.now();
    setP({ scan: 0, revealed: 0, projection: false, done: false, step: "scanning", key });
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

export type ChartMode = "live" | "replay" | "demo";

export interface ChartState {
  feed: Feed;
  /** The bars on screen: live, the replay so far, or the demo so far. */
  bars: Bar[];
  scan: Scan | null;
  phase: ReturnType<typeof usePhase>;
  mode: ChartMode;
  /** Replaying history: nothing on screen may be traded. */
  replaying: boolean;
}

type DemoOpts = { reader: ReaderChoice; side: Side | "random"; outcome: "random" | "win" | "loss"; speed: 1 | 2 | 4 };

export function ChartCard({
  symbol,
  tf,
  reader,
  focused,
  compact,
  position,
  closed,
  tradeLabel,
  onFocus,
  onTf,
  onReader,
  onClose,
  onState,
}: {
  symbol: VisionSymbolId;
  tf: Timeframe;
  reader: ReaderChoice;
  focused: boolean;
  compact: boolean;
  position: VisionPosition | null;
  closed: VisionTrade | null;
  tradeLabel: string;
  onFocus: () => void;
  onTf: (tf: Timeframe) => void;
  onReader: (r: ReaderChoice) => void;
  onClose?: () => void;
  onState: (s: ChartState) => void;
}) {
  const sym = SYMBOLS[symbol];
  const feed = useFeed(symbol, tf);
  const fmt = (n: number) => formatPrice(sym, n);
  const anchor = sym.kind === "futures" ? "rth" : "utc";

  // Replay walks the latest real setup forward; demo plays a simulated one.
  const [replay, setReplay] = useState<{ cursor: number; end: number } | null>(null);
  const [demo, setDemo] = useState<{ d: Demo; cursor: number; speed: number } | null>(null);
  const [demoOpts, setDemoOpts] = useState<DemoOpts>({ reader: "auto", side: "random", outcome: "random", speed: 2 });
  const [menu, setMenu] = useState<"reader" | "demo" | null>(null);
  const mode: ChartMode = demo ? "demo" : replay ? "replay" : "live";
  const bars = demo ? demo.d.bars.slice(0, demo.cursor) : replay ? feed.bars.slice(0, replay.cursor) : feed.bars;
  const activeReader: ReaderChoice = demo ? demo.d.reader : reader;

  // Analyse closed bars only: recompute when a bar closes, not on every tick.
  const closedKey = `${mode}:${activeReader}:${bars.length > 1 ? `${bars.length}:${bars[bars.length - 2].t}` : ""}`;
  const scan = useMemo(
    () => (bars.length > 1 ? analyze(bars, { forming: true, fmt, reader: activeReader, anchor, maxAge: demo ? 80 : 30, historyBars: demo ? feed.bars : undefined, minIndex: demo ? demo.d.fires - 2 : undefined }) : null),
    [closedKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [rescan, setRescan] = useState(0);
  const setup = scan?.setup ?? null;
  const phase = usePhase(`${symbol}|${tf}|${activeReader}|${setup?.id ?? "none"}|${rescan}|${mode}|${bars.length ? 1 : 0}`, setup ? setup.callouts.length : 0);
  const report = useRef(onState);
  report.current = onState;

  useEffect(() => {
    setReplay(null);
    setDemo(null);
  }, [symbol, tf]);

  // Advance replay and demo one bar at a time, holding while a reveal plays.
  useEffect(() => {
    if (!replay && !demo) return;
    const end = replay ? replay.end : demo!.d.bars.length;
    const cursor = replay ? replay.cursor : demo!.cursor;
    if (cursor >= end) {
      if (replay) {
        const id = setTimeout(() => setReplay(null), 3000);
        return () => clearTimeout(id);
      }
      return;
    }
    if (!phase.done && phase.step !== "done") return;
    const ms = replay ? 160 : 340 / (demo!.speed || 1);
    const id = setTimeout(() => (replay ? setReplay((r) => (r ? { ...r, cursor: r.cursor + 1 } : r)) : setDemo((d) => (d ? { ...d, cursor: d.cursor + 1 } : d))), ms);
    return () => clearTimeout(id);
  }, [replay, demo, phase.done, phase.step]);

  const startReplay = () => {
    setDemo(null);
    const past = analyze(feed.bars, { forming: true, fmt, reader, anchor, maxAge: 800 }).setup;
    if (!past) return;
    setReplay({ cursor: Math.max(70, Math.min(past.levelIndex, past.sweepIndex) - 14), end: Math.min(feed.bars.length, (past.outcomeIndex ?? feed.bars.length - 1) + 8) });
  };
  const [demoError, setDemoError] = useState("");
  const startDemo = (o: DemoOpts) => {
    setReplay(null);
    setMenu(null);
    const price = feed.bars[feed.bars.length - 1]?.c ?? (sym.kind === "crypto" ? 70_000 : 20_000);
    const options = READER_ORDER.filter((r) => r !== "orb" || TF_SECONDS[tf] <= 900);
    const pick: ReaderId = o.reader === "auto" ? options[Math.floor(Math.random() * options.length)] : o.reader === "orb" && TF_SECONDS[tf] > 900 ? "sweep" : o.reader;
    const d = buildDemo({ reader: pick, side: o.side === "random" ? undefined : o.side, win: o.outcome === "random" ? undefined : o.outcome === "win", price, tfSeconds: TF_SECONDS[tf], anchor });
    if (!d) {
      setDemoError("Couldn't build that demo; try another strategy.");
      return;
    }
    setDemoError("");
    setDemo({ d, cursor: d.start, speed: o.speed });
  };

  // A reveal still belonging to the previous setup reports as not done, so nothing acts on it early.
  const phaseKey = `${symbol}|${tf}|${activeReader}|${setup?.id ?? "none"}|${rescan}|${mode}|${bars.length ? 1 : 0}`;
  const current = phase.key === phaseKey ? phase : { ...phase, done: false, projection: false, step: "scanning" as Step };
  useEffect(() => report.current({ feed, bars, scan, phase: current, mode, replaying: mode === "replay" }), [feed, bars, scan, phase, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const loaded = feed.bars.length > 80;
  const stats = useMemo(() => (menu === "reader" && loaded ? readerStats(feed.bars, { forming: true, anchor }) : {}), [menu, loaded, symbol, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = bars[bars.length - 1];
  const first = bars.find((b) => last && b.t >= last.t - 86_400);
  const change = last && first ? ((last.c - first.o) / first.o) * 100 : null;
  const recentClose = closed && Date.now() - closed.closedAt < 90_000 ? closed : null;

  const banner = (() => {
    if (feed.loading && !feed.bars.length && mode === "live") return { title: "Loading the chart", detail: `Pulling ${sym.label} ${tf} bars` };
    if (feed.error && !feed.bars.length && mode === "live") return { title: "No data right now", detail: feed.error };
    if (phase.step === "scanning") return { title: `Scanning the chart${activeReader === "auto" ? "" : ` · ${READERS[activeReader as ReaderId].label}`}`, detail: "Reading structure, liquidity, volume and momentum on every candle" };
    if (setup && phase.step === "marking") {
      const c = setup.callouts[Math.max(0, phase.revealed - 1)];
      return { title: c ? (c.n === 1 ? `Marks the ${c.title.toLowerCase()}` : c.title) : "Pattern recognised", detail: c?.detail ?? "" };
    }
    if (setup && phase.step === "planning" && setup.outcome === "open") return { title: "Vision projects the next move", detail: `${setup.side === "long" ? "Up" : "Down"} to ${fmt(setup.target)}, a ${(((setup.target - setup.entry) / setup.entry) * 100).toFixed(2)}% move` };
    if (recentClose) return { title: recentClose.reason === "target" ? "Prediction confirmed" : recentClose.reason === "stop" ? "Stopped out" : "Position closed", detail: `${recentClose.side === "long" ? "Long" : "Short"} ${recentClose.qty} closed ${recentClose.pnl >= 0 ? "+" : "-"}$${Math.abs(recentClose.pnl).toFixed(2)}` };
    if (position) return { title: position.auto ? "Auto-executed" : "Price follows the plan", detail: `${position.side === "long" ? "Long" : "Short"} ${position.qty} filled at ${fmt(position.entry)} · stop ${fmt(position.stop)} · target ${fmt(position.target)}` };
    if (setup && setup.outcome === "target") return { title: "Prediction confirmed", detail: `Reached ${fmt(setup.target)}. Scanning for the next setup` };
    if (setup && setup.outcome === "stop") return { title: "Stopped out", detail: `The ${setup.side} setup hit ${fmt(setup.stop)}. Scanning for the next one` };
    if (setup && setup.outcome === "open")
      return setup.fresh
        ? { title: "Your call", detail: "Take the forecast, skip it, or let auto-execute take it" }
        : { title: `${setup.side === "long" ? "Long" : "Short"} setup in play`, detail: `Fired ${scan!.closed - 1 - setup.index} bars ago; the plan is still open` };
    if (mode === "demo") return { title: "Demo", detail: "Simulated price. The setup forms in a moment" };
    if (mode === "replay") return { title: "Replaying history", detail: "Watching the latest real setup play out. Nothing here can be traded" };
    const below = scan?.pools.below;
    const above = scan?.pools.above;
    return { title: "Waiting for a high-probability setup", detail: below || above ? `Watching ${[below && fmt(below.price) + " below", above && fmt(above.price) + " above"].filter(Boolean).join(" and ")}` : "Watching for your setups" };
  })();
  const progress = phase.step === "scanning" ? (phase.scan ?? 0) : phase.step === "marking" ? 0.35 + 0.18 * phase.revealed : 1;
  const sourceLabel = mode === "demo" ? "Simulated" : feed.source === "coinbase" ? "Coinbase · live" : feed.source === "tradovate" ? `Tradovate · live${feed.contract ? ` · ${feed.contract}` : ""}` : feed.source === "projectx" ? `TopstepX · live${feed.contract ? ` · ${feed.contract}` : ""}` : feed.source === "yahoo" ? "Delayed ~10 min" : "";
  const fresh = Date.now() - feed.lastTick < (sym.kind === "crypto" ? 15_000 : 60_000);
  const readerLabel = activeReader === "auto" ? "Any strategy" : READERS[activeReader as ReaderId].label;

  return (
    <section
      onMouseDown={onFocus}
      className={clsx("relative rounded-[28px] border bg-[#121214]/80 backdrop-blur-2xl transition", focused ? "border-white/[0.14] shadow-[0_30px_80px_-40px_rgba(255,138,61,0.35)]" : "border-white/[0.07]")}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-white">{sym.label}</h2>
          {last && <span className="text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-white">{fmt(last.c)}</span>}
          {change != null && (
            <span className={clsx("rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums", change >= 0 ? "bg-[#FF8A3D]/15 text-[#FFB27D]" : "bg-white/[0.08] text-white/70")}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          )}
          <span className="text-[12px] text-white/40">
            {sym.name} · {tf}
            {sourceLabel && ` · ${sourceLabel}`}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className={clsx("mr-1 flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.06em]", mode === "demo" ? "text-[#FFB27D]" : feed.delayed ? "text-white/45" : "text-[#FF8A3D]")}>
            {mode === "demo" ? "DEMO" : mode === "replay" ? "REPLAY" : feed.delayed ? "DELAYED" : "LIVE"}
            <span className={clsx("h-1.5 w-1.5 rounded-full", feed.delayed && mode === "live" ? "bg-white/40" : "bg-[#FF8A3D]", (fresh || mode !== "live") && "animate-pulse")} />
          </span>
          <div className="flex rounded-full bg-white/[0.06] p-0.5">
            {TIMEFRAMES.map((t) => (
              <button key={t} onClick={() => onTf(t)} className={clsx("rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition", t === tf ? "bg-white/[0.16] text-white" : "text-white/50 hover:text-white")}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Toolbar: strategy, demo, replay, rescan */}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-5">
        <div className="relative">
          <button onClick={() => setMenu(menu === "reader" ? null : "reader")} className="flex h-9 items-center gap-2 rounded-full bg-white/[0.07] pl-3 pr-2.5 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.1]">
            <Sparkles className="h-3.5 w-3.5 text-[#FF8A3D]" /> {readerLabel}
            <ChevronDown className="h-3.5 w-3.5 text-white/50" />
          </button>
          {menu === "reader" && (
            <Popover onClose={() => setMenu(null)}>
              <p className="px-3 pb-1 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-white/40">Read this chart with</p>
              {(["auto", ...READER_ORDER] as ReaderChoice[]).map((r) => {
                const st = r === "auto" ? null : stats[r as ReaderId];
                const disabled = r === "orb" && TF_SECONDS[tf] > 900;
                return (
                  <button
                    key={r}
                    disabled={disabled}
                    onClick={() => {
                      onReader(r);
                      setMenu(null);
                    }}
                    className={clsx("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition disabled:opacity-35", r === reader ? "bg-white/[0.08]" : "hover:bg-white/[0.05]")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-white">{r === "auto" ? "Any strategy" : READERS[r as ReaderId].label}</span>
                      <span className="block truncate text-[12px] text-white/45">{r === "auto" ? "Whichever of your setups fires first" : disabled ? "Needs 15m bars or faster" : READERS[r as ReaderId].blurb}</span>
                    </span>
                    {st && (
                      <span className="text-right text-[11.5px] tabular-nums">
                        <span className={clsx("block font-semibold", st.expectancyR == null ? "text-white/40" : st.expectancyR >= 0 ? "text-[#FFB27D]" : "text-[#FF8D85]")}>
                          {st.expectancyR == null ? "unrated" : `${st.expectancyR >= 0 ? "+" : ""}${st.expectancyR.toFixed(2)}R`}
                        </span>
                        <span className="block text-white/40">
                          {st.matches} here{st.hitRate != null ? ` · ${Math.round(st.hitRate * 100)}%` : ""}
                        </span>
                      </span>
                    )}
                    {r === reader && <Check className="h-4 w-4 shrink-0 text-[#FF8A3D]" />}
                  </button>
                );
              })}
              <p className="px-3 pb-2 pt-1 text-[11px] leading-snug text-white/35">Edge and hit rate are this reader on the bars loaded here, target vs stop. Unrated means under 8 decided signals.</p>
            </Popover>
          )}
        </div>

        <div className="relative">
          {mode === "demo" ? (
            <button onClick={() => setDemo(null)} className="flex h-9 items-center gap-1.5 rounded-full bg-[#FF8A3D] px-3 text-[13px] font-semibold text-black">
              <Square className="h-3.5 w-3.5" /> End demo
            </button>
          ) : (
            <button onClick={() => setMenu(menu === "demo" ? null : "demo")} className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.1]">
              <FlaskConical className="h-3.5 w-3.5 text-[#FF8A3D]" /> Demo
            </button>
          )}
          {menu === "demo" && (
            <Popover onClose={() => setMenu(null)}>
              <div className="space-y-3 p-3">
                <div>
                  <p className="text-[15px] font-semibold text-white">Play a demo setup</p>
                  <p className="text-[12px] leading-snug text-white/45">Simulated price, clearly marked. The pattern is checked by the real reader, and the odds shown come from this chart&apos;s real history.</p>
                </div>
                <Choice label="Strategy" value={demoOpts.reader} options={[{ v: "auto" as ReaderChoice, l: "Surprise me" }, ...READER_ORDER.map((r) => ({ v: r as ReaderChoice, l: READERS[r].short }))]} onChange={(v) => setDemoOpts((o) => ({ ...o, reader: v }))} />
                <Choice label="Direction" value={demoOpts.side} options={[{ v: "random" as const, l: "Either" }, { v: "long" as const, l: "Long" }, { v: "short" as const, l: "Short" }]} onChange={(v) => setDemoOpts((o) => ({ ...o, side: v }))} />
                <Choice label="Outcome" value={demoOpts.outcome} options={[{ v: "random" as const, l: "Either" }, { v: "win" as const, l: "Win" }, { v: "loss" as const, l: "Loss" }]} onChange={(v) => setDemoOpts((o) => ({ ...o, outcome: v }))} />
                <Choice label="Speed" value={demoOpts.speed} options={[{ v: 1 as const, l: "1×" }, { v: 2 as const, l: "2×" }, { v: 4 as const, l: "4×" }]} onChange={(v) => setDemoOpts((o) => ({ ...o, speed: v }))} />
                <button onClick={() => startDemo(demoOpts)} className="w-full rounded-xl bg-[#FF8A3D] py-2.5 text-[14px] font-bold text-black">
                  Start demo
                </button>
              </div>
            </Popover>
          )}
        </div>

        <button
          onClick={() => (replay ? setReplay(null) : startReplay())}
          title="Replay the latest real setup bar by bar"
          className={clsx("flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-white/[0.06]", replay ? "bg-[#FF8A3D] text-black" : "bg-white/[0.07] text-white hover:bg-white/[0.1]")}
        >
          {replay ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-[#FF8A3D]" />} {replay ? "Stop replay" : "Replay"}
        </button>
        {demoError && <span className="text-[12px] text-[#FF8D85]">{demoError}</span>}
        <span className="flex-1" />
        <button aria-label="Scan again" title="Scan again" onClick={() => setRescan((r) => r + 1)} className="grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white">
          <RefreshCw className="h-4 w-4" />
        </button>
        {onClose && (
          <button aria-label="Close chart" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mx-5 mt-3 overflow-hidden rounded-2xl border border-[#FF8A3D]/20 bg-gradient-to-r from-[#FF8A3D]/[0.12] via-white/[0.03] to-transparent">
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#FFB27D] to-[#FF7A2D] text-black shadow-[0_6px_18px_-6px_rgba(255,138,61,0.9)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div key={banner.title} className="tp-card-in min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-white">{banner.title}</p>
            <p className="truncate text-[12.5px] text-white/55">{banner.detail}</p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-[#FF8A3D]/15 px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-[#FFB27D] sm:inline">{mode === "demo" ? "DEMO" : tradeLabel}</span>
        </div>
        <div className="h-0.5 bg-white/[0.04]">
          <div className="h-full bg-gradient-to-r from-[#FF8A3D] to-[#FFB27D] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-b-[28px] px-2 pb-2 pt-2">
        {bars.length ? (
          <VisionChart
            bars={bars}
            sym={sym}
            scan={scan}
            phase={phase}
            position={mode === "replay" ? null : position}
            closed={mode === "replay" ? null : closed}
            height={compact ? 400 : 580}
            label={mode === "demo" ? "DEMO · SIMULATED PRICE" : mode === "replay" ? "REPLAY · PAST BARS" : undefined}
            story={mode !== "live"}
          />
        ) : (
          <div className="tp-shimmer m-3 rounded-2xl" style={{ height: compact ? 380 : 560 }} />
        )}
      </div>
      {feed.note && mode === "live" && <p className="px-5 pb-3 text-[12px] text-white/45">{feed.note}</p>}
    </section>
  );
}

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const id = setTimeout(() => window.addEventListener("mousedown", away), 0);
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="tp-card-in absolute left-0 top-11 z-40 w-[340px] rounded-[20px] border border-white/[0.1] bg-[#1B1B1E]/[0.97] p-1.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
      {children}
    </div>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1 text-[12px] text-white/50">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={String(o.v)} onClick={() => onChange(o.v)} className={clsx("rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition", o.v === value ? "bg-white text-black" : "bg-white/[0.07] text-white/70 hover:bg-white/[0.12]")}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
