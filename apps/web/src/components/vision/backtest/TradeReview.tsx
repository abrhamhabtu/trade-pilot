"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, History, ScanEye } from "lucide-react";
import type { Bar } from "@/lib/pilot/market";
import { READERS, analyze } from "@/lib/vision/analyze";
import type { BacktestTrade } from "@/lib/vision/backtest";
import { TF_SECONDS, aggregate, formatPrice, type Timeframe, type VisionSymbol } from "@/lib/vision/markets";
import { useVisionStore, type VisionTrade } from "@/store/visionStore";
import { VisionChart } from "../VisionChart";
import { money, type Loaded } from "./data";
import { dur, strategyOf } from "./Results";
import { NEG, Pill } from "./ui";

const PHASE = { scan: null, revealed: 99, projection: true, step: "done" as const };
const VIEW_TFS: Timeframe[] = ["1m", "5m", "15m", "1h"];
export const TAGS = ["A+ setup", "Followed plan", "Chased", "Early exit", "Late entry", "News", "Choppy day", "Trend day"];

/** One trade the engine took, on the chart, with what it went through and the trader's notes. */
export function TradeReview({ bars, loaded, trade, sym, tf, anchor, onPrev, onNext, onReplay }: { bars: Bar[]; loaded: Loaded; trade: BacktestTrade; sym: VisionSymbol; tf: Timeframe; anchor: "rth" | "utc"; onPrev?: () => void; onNext?: () => void; onReplay: () => void }) {
  const [view, setView] = useState<Timeframe>(tf);
  const [marks, setMarks] = useState(trade.reader !== "custom");
  const [other, setOther] = useState<{ tf: Timeframe; bars: Bar[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const fmt = (n: number) => formatPrice(sym, n);
  const base = TF_SECONDS[tf];

  // ← and → step through the log.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  // The run's own bars around the trade: enough before for the session VWAP and averages to settle.
  const start = Math.max(0, trade.entryIndex - 400);
  const slice = useMemo(() => bars.slice(start, Math.min(bars.length, trade.exitIndex + 30)), [bars, start, trade.exitIndex]);
  const scan = useMemo(() => (trade.reader !== "custom" ? analyze(slice, { fmt, reader: trade.reader, anchor, atIndex: trade.entryIndex - start }) : null), [slice, trade]); // eslint-disable-line react-hooks/exhaustive-deps

  // Another timeframe: higher ones are built from the run's bars, lower ones come from the library.
  const lower = TF_SECONDS[view] < base;
  const canLower = loaded.source === "library";
  useEffect(() => {
    if (view === tf || !lower || !canLower) return;
    let live = true;
    setLoading(true);
    const s = TF_SECONDS[view];
    fetch(`/api/library/bars?symbol=${sym.id}&tf=${view}&from=${trade.entryT - 260 * s}&to=${trade.exitT + 60 * s}&max=6000`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => live && j.t && setOther({ tf: view, bars: j.t.map((t: number, i: number) => ({ t, o: j.o[i], h: j.h[i], l: j.l[i], c: j.c[i], v: j.v[i] })) }))
      .catch(() => undefined)
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [view, tf, lower, canLower, sym.id, trade.entryT, trade.exitT]);
  const shown = view === tf ? slice : lower ? (other?.tf === view ? other.bars : []) : aggregate(bars.slice(Math.max(0, trade.entryIndex - 400 * Math.round(TF_SECONDS[view] / base)), Math.min(bars.length, trade.exitIndex + 30 * Math.round(TF_SECONDS[view] / base))), TF_SECONDS[view]);
  const native = view === tf && marks && !!scan?.setup;

  const win = trade.r > 0;
  const outcome = trade.outcome === "target" ? "Target hit" : trade.outcome === "stop" ? "Stopped out" : trade.outcome === "breakeven" ? "Break-even stop" : "Time exit";
  const review = { side: trade.side, entry: trade.entry, stop: trade.stop, target: trade.target, exit: trade.exit, entryT: trade.entryT, exitT: trade.exitT, win, label: `${trade.outcome === "target" ? "TP" : trade.outcome === "stop" ? "SL" : trade.outcome === "breakeven" ? "BE" : "Exit"} ${money(trade.pnl, 2)}` };
  const closed: VisionTrade = { id: `bt-${trade.n}`, symbol: sym.id, side: trade.side, qty: trade.units, entry: trade.entry, stop: trade.stop, target: trade.target, openedAt: trade.entryT * 1000, setupId: "", auto: true, venue: "paper", pointValue: 1, exit: trade.exit, closedAt: Date.now(), pnl: trade.pnl, reason: trade.outcome === "target" ? "target" : trade.outcome === "stop" ? "stop" : "manual" };
  const targetR = Math.abs(trade.target - trade.entry) / Math.abs(trade.entry - trade.stop);

  return (
    <section className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#121214]/80 backdrop-blur-2xl">
      <header className="flex flex-wrap items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold tracking-tight text-white">
            {new Date(trade.entryT * 1000).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "America/New_York" })} · {trade.side === "long" ? "Long" : "Short"} /{sym.id}
          </p>
          <p className="font-mono text-[11.5px] text-white/45">
            {outcome} · {dur(trade.minutes)} · #{trade.n} · {strategyOf(trade.reader)}
          </p>
        </div>
        <p className={clsx("text-[22px] font-bold tabular-nums", win ? "text-[#9BE1FF]" : "text-[#FFA3AB]")}>{money(trade.pnl, 2)}</p>
        <div className="flex gap-1">
          <button aria-label="Previous trade (←)" title="Previous trade (←)" disabled={!onPrev} onClick={onPrev} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-white/75 hover:bg-white/[0.12] disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button aria-label="Next trade (→)" title="Next trade (→)" disabled={!onNext} onClick={onNext} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-white/75 hover:bg-white/[0.12] disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1.5 px-5 py-3">
        {VIEW_TFS.map((t) => {
          const off = TF_SECONDS[t] < base && !canLower;
          return (
            <button key={t} disabled={off} title={off ? "Lower timeframes need library data" : undefined} onClick={() => setView(t)} className={clsx("rounded-lg px-2.5 py-1 font-mono text-[12px] font-semibold ring-1 disabled:opacity-30", view === t ? "bg-white text-black ring-white" : "bg-white/[0.04] text-white/65 ring-white/[0.08] hover:text-white")}>
              {t}
            </button>
          );
        })}
        {trade.reader !== "custom" && view === tf && (
          <button onClick={() => setMarks(!marks)} className={clsx("ml-1 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold ring-1", marks ? "bg-[#FF8A3D]/14 text-[#FFB27D] ring-[#FF8A3D]/35" : "bg-white/[0.04] text-white/55 ring-white/[0.08]")}>
            <ScanEye className="h-3.5 w-3.5" /> Vision marks
          </button>
        )}
        <button onClick={onReplay} className="ml-auto flex items-center gap-1.5 rounded-full bg-[#5AC8FA]/14 px-3 py-1.5 text-[12.5px] font-semibold text-[#9BE1FF] ring-1 ring-[#5AC8FA]/30 hover:bg-[#5AC8FA]/20">
          <History className="h-3.5 w-3.5" /> Replay from here
        </button>
      </div>

      <div className="relative border-y border-white/[0.05] bg-black/25">
        {loading && <p className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-[12.5px] text-white/50">Loading {view}…</p>}
        <VisionChart bars={shown} sym={sym} scan={native ? scan : null} phase={PHASE} position={null} closed={native ? closed : null} height={420} story label={view === tf ? undefined : view.toUpperCase()} review={native ? null : review} />
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1.5 text-[12px]">
            <Cell k="Entry" v={fmt(trade.entry)} />
            <Cell k="Stop" v={fmt(trade.stop)} tone="neg" />
            <Cell k="Target" v={fmt(trade.target)} tone="pos" />
            <Cell k="Exit" v={fmt(trade.exit)} />
            <Cell k="Result" v={`${trade.r >= 0 ? "+" : ""}${trade.r.toFixed(2)}R`} tone={win ? "pos" : "neg"} />
            <Cell k="Size" v={`${+trade.units.toFixed(sym.kind === "crypto" ? 4 : 0)}`} />
            <Cell k="Risk" v={`$${Math.round(trade.riskUsd)}`} />
            <Cell k="Held" v={`${trade.hold} bars`} />
          </div>
          <Ruler mae={trade.mae} mfe={trade.mfe} exit={trade.r} target={targetR} />
          <div className="flex flex-wrap gap-1.5">
            {trade.vix != null && <Pill>VIX {trade.vix.toFixed(1)}</Pill>}
            {trade.fomc && <Pill tone="warn">FOMC day</Pill>}
            <Pill>{trade.slot} ET entry</Pill>
            {trade.reader !== "custom" && <Pill>{READERS[trade.reader].short}</Pill>}
          </div>
        </div>
        <Journal k={`${sym.id}:${trade.entryT}`} />
      </div>
    </section>
  );
}

function Cell({ k, v, tone }: { k: string; v: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-2.5 py-1.5">
      <p className="text-[10.5px] text-white/40">{k}</p>
      <p className={clsx("truncate font-semibold tabular-nums", tone === "pos" ? "text-[#9BE1FF]" : tone === "neg" ? "text-[#FFA3AB]" : "text-white/90")}>{v}</p>
    </div>
  );
}

/** How far the trade went against you (MAE) and for you (MFE), against the stop and target, in R. */
function Ruler({ mae, mfe, exit, target }: { mae: number; mfe: number; exit: number; target: number }) {
  const lo = Math.min(-1, mae, exit) - 0.15;
  const hi = Math.max(target, mfe, exit) + 0.15;
  const at = (r: number) => `${((r - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="rounded-[16px] bg-white/[0.04] px-3 pb-3 pt-2.5">
      <p className="mb-5 flex justify-between text-[11px] font-semibold text-white/45">
        <span>Heat {mae.toFixed(2)}R</span>
        <span>Run-up +{mfe.toFixed(2)}R</span>
      </p>
      <div className="relative h-2 rounded-full bg-white/[0.06]">
        <span className="absolute inset-y-0 rounded-l-full" style={{ left: at(mae), width: `calc(${at(0)} - ${at(mae)})`, background: NEG, opacity: 0.55 }} />
        <span className="absolute inset-y-0 rounded-r-full bg-[#5AC8FA]/55" style={{ left: at(0), width: `calc(${at(mfe)} - ${at(0)})` }} />
        {[
          { r: -1, l: "Stop" },
          { r: 0, l: "Entry" },
          { r: target, l: `${target.toFixed(1)}R` },
        ].map((m) => (
          <span key={m.l} className="absolute -top-4 -translate-x-1/2 text-[10px] text-white/40" style={{ left: at(m.r) }}>
            {m.l}
          </span>
        ))}
        {[-1, 0, target].map((r) => (
          <span key={r} className="absolute -top-0.5 h-3 w-px bg-white/40" style={{ left: at(r) }} />
        ))}
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#121214] bg-white" style={{ left: at(exit) }} title={`Exit ${exit.toFixed(2)}R`} />
      </div>
    </div>
  );
}

export function Journal({ k }: { k: string }) {
  const entry = useVisionStore((s) => s.journal[k]);
  const setJournal = useVisionStore((s) => s.setJournal);
  const [note, setNote] = useState(entry?.note ?? "");
  useEffect(() => setNote(entry?.note ?? ""), [k]); // eslint-disable-line react-hooks/exhaustive-deps
  const tags = entry?.tags ?? [];
  const toggle = (t: string) => setJournal(k, { note, tags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] });
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-white/55">Tags &amp; journal</p>
      <div className="flex flex-wrap gap-1.5">
        {TAGS.map((t) => (
          <button key={t} onClick={() => toggle(t)} className={clsx("rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1", tags.includes(t) ? "bg-[#BF5AF2]/18 text-[#E3B5FF] ring-[#BF5AF2]/45" : "bg-white/[0.04] text-white/55 ring-white/[0.08] hover:text-white")}>
            {t}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => setJournal(k, { tags, note })}
        rows={3}
        placeholder="What did you see? What would you do differently?"
        className="w-full resize-none rounded-[14px] bg-white/[0.05] px-3 py-2 text-[13px] text-white placeholder:text-white/30 outline-none ring-1 ring-inset ring-white/[0.08] focus:ring-[#BF5AF2]/50"
      />
    </div>
  );
}
