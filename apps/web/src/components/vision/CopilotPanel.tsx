"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Loader2, Sparkles, Zap } from "lucide-react";
import type { Scan } from "@/lib/vision/analyze";
import { formatPrice, type VisionSymbol } from "@/lib/vision/markets";
import { useModelStore, modelReady } from "@/lib/pilot/modelStore";
import { PROVIDERS } from "@/lib/pilot/models";
import type { VisionPosition, VisionTrade } from "@/store/visionStore";
import type { ChartState } from "./ChartCard";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Reveal text a few characters at a time, like it is being written. */
function useTypewriter(text: string, run: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) {
      setN(0);
      return;
    }
    setN(0);
    const id = setInterval(() => setN((k) => (k >= text.length ? (clearInterval(id), k) : k + 3)), 16);
    return () => clearInterval(id);
  }, [text, run]);
  return text.slice(0, n);
}

export function CopilotPanel({
  sym,
  state,
  price,
  position,
  todays,
  autoExecute,
  autoNote,
  onAuto,
  onOpen,
  onSkip,
  onClosePosition,
  handled,
  lastTrade,
  sizing,
  venueSlot,
}: {
  sym: VisionSymbol;
  state: ChartState | null;
  price: number | null;
  position: VisionPosition | null;
  todays: VisionTrade[];
  autoExecute: boolean;
  autoNote: string;
  onAuto: (on: boolean) => void;
  onOpen: () => void;
  onSkip: () => void;
  onClosePosition: () => void;
  handled: boolean;
  lastTrade: VisionTrade | null;
  sizing: string;
  venueSlot: React.ReactNode;
}) {
  const scan: Scan | null = state?.scan ?? null;
  const phase = state?.phase;
  const setup = scan?.setup && scan.setup.outcome === "open" ? scan.setup : null;
  const scanning = phase?.step === "scanning";
  const fmt = (n: number) => formatPrice(sym, n);
  const typed = useTypewriter(scan?.overview ?? "", !!scan && !scanning && !state?.replaying);
  // Replays change the read on every bar; show it whole instead of retyping it.
  const overview = state?.replaying ? (scan?.overview ?? "") : typed;
  const model = useModelStore((s) => s.model);
  const hydrate = useModelStore((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  const ready = modelReady(model);
  const [ai, setAi] = useState<{ text: string; busy: boolean; error: string }>({ text: "", busy: false, error: "" });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    abort.current?.abort();
    setAi({ text: "", busy: false, error: "" });
  }, [scan?.setup?.id, sym.id]);

  const askModel = async () => {
    if (!scan) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setAi({ text: "", busy: true, error: "" });
    const facts = {
      market: sym.label,
      price,
      scan: scan.items.map((i) => `${i.label}: ${i.value}`),
      setup: scan.setup
        ? { side: scan.setup.side, entry: scan.setup.entry, stop: scan.setup.stop, target: scan.setup.target, rr: scan.setup.rr, outcome: scan.setup.outcome, history: { matches: scan.setup.history.matches, wins: scan.setup.history.wins, losses: scan.setup.history.losses, hitRate: scan.setup.history.hitRate, expectancyR: scan.setup.history.expectancyR } }
        : null,
      builtInRead: scan.overview,
    };
    try {
      const res = await fetch("/api/pilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          ...model,
          stream: true,
          context: { vision: facts },
          messages: [
            {
              role: "user",
              content: `You are reading a live ${sym.label} chart in TradePilot Vision. Using only these computed facts (do not invent numbers): ${JSON.stringify(facts)}. In 3 short sentences: what the chart is doing, whether the setup is worth taking given its history, and the one thing that would invalidate it.`,
            },
          ],
        }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "The model did not answer.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const e = JSON.parse(l);
          if (e.t === "text") setAi((x) => ({ ...x, text: x.text + e.v }));
          if (e.t === "error") throw new Error(e.v);
        }
      }
      setAi((x) => ({ ...x, busy: false }));
    } catch (e) {
      if (!ctl.signal.aborted) setAi({ text: "", busy: false, error: e instanceof Error ? e.message : "The model did not answer." });
    }
  };

  const h = setup?.history;
  const rate = h?.hitRate ?? null;
  const steps = [
    { k: "Detect", ok: !!setup },
    { k: "Validate", ok: !!setup && rate !== null },
    { k: "Risk", ok: !!setup && setup.rr >= 1.2 },
    { k: "Execute", ok: !!position },
  ];
  const pnl = position && price != null ? (position.side === "long" ? price - position.entry : position.entry - price) * position.qty * position.pointValue : 0;
  const realized = todays.reduce((a, t) => a + t.pnl, 0);
  const wins = todays.filter((t) => t.pnl > 0).length;
  const posProgress = position && price != null ? Math.max(0, Math.min(1, (price - position.stop) / (position.target - position.stop))) : 0;

  return (
    <aside className="relative flex flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#121214]/80 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-gradient-to-br from-[#FFB27D] to-[#FF7A2D] text-black shadow-[0_8px_24px_-8px_rgba(255,138,61,0.9)]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-white">Vision Copilot</p>
          <p className="truncate text-[12px] text-[#FFB27D]">{ready ? `${PROVIDERS[model.provider].label} · ${model.model}` : "Built-in chart reader"}</p>
        </div>
        <span className={clsx("h-2 w-2 rounded-full", scanning ? "animate-pulse bg-[#FF8A3D]" : "bg-white/30")} />
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <section>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">Market scan</p>
            <p className={clsx("text-[12px]", scanning ? "text-[#FFB27D]" : "text-white/40")}>{scanning ? `Scanning ${sym.label}…` : scan ? `Complete · ${scan.closed} bars` : ""}</p>
          </div>
          <ul className="mt-2 space-y-2">
            {(scan?.items ?? [{ label: "Market structure" }, { label: "Liquidity zones" }, { label: "Order flow & volume" }, { label: "Momentum (RSI / EMA)" }]).map((it, k) => {
              const done = !!scan && (!scanning || (phase?.scan ?? 0) >= (k + 1) / 5);
              const item = it as Partial<Scan["items"][number]>;
              return (
                <li key={it.label} className="flex items-center gap-2.5 text-[14px]">
                  <span className={clsx("grid h-[18px] w-[18px] place-items-center rounded-full", done ? "bg-[#FF8A3D]/20 text-[#FF8A3D]" : "border border-white/20")}>
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
                  </span>
                  <span className="flex-1 text-white/85">{it.label}</span>
                  {done && item.value && <span className={clsx("tp-fade-in text-[13px] font-semibold", item.tone === "up" ? "text-[#FFB27D]" : item.tone === "down" ? "text-[#FF8D85]" : "text-white/55")}>{item.value}</span>}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#FF8A3D] to-[#FFB27D] transition-[width] duration-300" style={{ width: `${scanning ? (phase?.scan ?? 0) * 100 : scan ? 100 : 0}%` }} />
          </div>
        </section>

        <section>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">Overview</p>
          {scanning || !scan ? (
            <div className="mt-2 space-y-2">
              <div className="tp-shimmer h-3 w-11/12 rounded-full" />
              <div className="tp-shimmer h-3 w-9/12 rounded-full" />
              <div className="tp-shimmer h-3 w-6/12 rounded-full" />
            </div>
          ) : (
            <p className="mt-2 min-h-[72px] text-[14.5px] leading-relaxed text-white/85">
              {overview}
              {overview.length < (scan.overview.length || 0) && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-[#FF8A3D]" />}
            </p>
          )}
          {scan && !scanning && (
            <div className="mt-2">
              {ready ? (
                <button onClick={askModel} disabled={ai.busy} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#FFB27D] hover:underline disabled:opacity-60">
                  {ai.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Ask {model.model || PROVIDERS[model.provider].label} for a second read
                </button>
              ) : (
                <a href="/app/pilot?tab=settings" className="text-[12.5px] text-white/45 hover:text-white/75">
                  Connect a model in Pilot AI settings for a second read →
                </a>
              )}
              {(ai.text || ai.error) && <p className={clsx("mt-2 rounded-2xl bg-white/[0.04] p-3 text-[13.5px] leading-relaxed", ai.error ? "text-[#FF8D85]" : "text-white/80")}>{ai.error || ai.text}</p>}
            </div>
          )}
        </section>

        {setup && phase?.projection ? (
          <section className="tp-card-in rounded-[22px] border border-[#FF8A3D]/25 bg-gradient-to-b from-[#FF8A3D]/[0.08] to-transparent p-4">
            <div className="flex items-start gap-3">
              <span className={clsx("rounded-full px-3 py-1 text-[13px] font-bold", setup.side === "long" ? "bg-[#FF8A3D] text-black" : "bg-white text-black")}>{setup.side === "long" ? "LONG" : "SHORT"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white">
                  {sym.label} <span className="ml-1 rounded-md bg-[#FF8A3D]/15 px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.06em] text-[#FFB27D]">FORECAST</span>
                </p>
                <p className="mt-0.5 text-[12.5px] text-[#FFB27D]">
                  Projected {(((setup.target - setup.entry) / setup.entry) * 100).toFixed(2)}% move · {setup.rr.toFixed(1)}R
                </p>
              </div>
              <Ring value={rate ?? 0} label={rate === null ? "—" : `${Math.round(rate * 100)}%`} />
            </div>
            <dl className="mt-3 space-y-1.5 text-[14px]">
              <Row k="Entry" v={fmt(setup.entry)} />
              <Row k="Target" v={fmt(setup.target)} tone="orange" />
              <Row k="Stop loss" v={fmt(setup.stop)} tone="red" />
              <Row k="Past matches" v={`${h!.matches}${h!.hitRate === null ? " · too few to rate" : ` · ${h!.wins}W ${h!.losses}L`}`} />
              {h!.expectancyR !== null && <Row k="Edge per trade" v={`${h!.expectancyR >= 0 ? "+" : ""}${h!.expectancyR.toFixed(2)}R`} tone={h!.expectancyR >= 0 ? "orange" : "red"} />}
              <Row k="Size" v={sizing} />
            </dl>
            <ol className="mt-4 flex items-start justify-between">
              {steps.map((s, k) => (
                <li key={s.k} className="relative flex flex-1 flex-col items-center">
                  {k > 0 && <span className={clsx("absolute right-1/2 top-[9px] h-[2px] w-full", steps[k - 1].ok ? "bg-[#FF8A3D]/70" : "bg-white/10")} />}
                  <span className={clsx("relative grid h-5 w-5 place-items-center rounded-full", s.ok ? "bg-[#FF8A3D] text-black" : "border-2 border-[#FF8A3D]/60 bg-[#121214]")}>{s.ok && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                  <span className={clsx("mt-1 text-[11.5px]", s.ok ? "text-white/80" : "text-[#FFB27D]")}>{s.k}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4">
              {state?.replaying ? (
                <p className="rounded-2xl bg-white/[0.05] px-3 py-2.5 text-center text-[13.5px] text-white/60">Replay of past bars · not tradable</p>
              ) : position ? (
                <p className="flex items-center gap-2 rounded-2xl border border-[#FF8A3D]/30 bg-[#FF8A3D]/10 px-3 py-2.5 text-[14px] font-semibold text-[#FFB27D]">
                  <Check className="h-4 w-4" /> Filled · {position.qty} @ {fmt(position.entry)} {position.venue !== "paper" ? `on ${position.venue === "tradovate" ? "Tradovate" : "TopstepX"}` : "(paper)"}
                </p>
              ) : autoExecute && !handled && setup.fresh ? (
                <p className="flex items-center gap-2 rounded-2xl bg-[#FF8A3D]/10 px-3 py-2.5 text-[14px] font-semibold text-[#FFB27D]">
                  <Zap className="h-4 w-4" /> {autoNote || "Auto-executing…"}
                </p>
              ) : handled ? (
                <p className="rounded-2xl bg-white/[0.04] px-3 py-2.5 text-[13.5px] text-white/55">Skipped. Scanning for the next setup.</p>
              ) : (
                <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                  <button onClick={onOpen} disabled={!setup.fresh} className="rounded-2xl bg-[#FF8A3D] py-3 text-[15px] font-bold text-black shadow-[0_12px_30px_-12px_rgba(255,138,61,0.9)] transition active:scale-[0.98] disabled:opacity-40" title={setup.fresh ? "" : "This setup fired a while ago; wait for a fresh one"}>
                    {setup.side === "long" ? "▲ Open long" : "▼ Open short"}
                  </button>
                  <button onClick={onSkip} className="rounded-2xl bg-white/[0.08] py-3 text-[15px] font-semibold text-white transition hover:bg-white/[0.12] active:scale-[0.98]">
                    Skip
                  </button>
                </div>
              )}
              <p className="mt-1.5 text-center text-[11.5px] text-white/40">{setup.fresh ? "You decide, or let auto-execute take it." : "Fired earlier; Vision only acts on fresh setups."}</p>
            </div>
          </section>
        ) : (
          <section className="grid min-h-[170px] place-items-center rounded-[22px] border border-dashed border-white/[0.1] p-4 text-center">
            <div>
              <Loader2 className={clsx("mx-auto h-6 w-6 text-white/40", (scanning || !scan) && "animate-spin")} />
              <p className="mt-3 text-[14px] text-white/60">{scanning ? "Reading the chart…" : "Waiting for a high-probability setup"}</p>
              {scan?.setup && scan.setup.outcome !== "open" && (
                <p className={clsx("mt-1 text-[12.5px]", scan.setup.outcome === "target" ? "text-[#FFB27D]" : "text-[#FF8D85]")}>
                  Last {scan.setup.side} setup {scan.setup.outcome === "target" ? "reached its target" : "was stopped out"}
                </p>
              )}
            </div>
          </section>
        )}

        <section>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">Open position</p>
          {position ? (
            <div className="mt-2 rounded-[20px] bg-white/[0.04] p-3.5">
              <div className="flex items-center gap-2">
                <span className={clsx("rounded-full px-2.5 py-0.5 text-[12px] font-bold", position.side === "long" ? "bg-[#FF8A3D] text-black" : "bg-white text-black")}>{position.side.toUpperCase()}</span>
                <span className="text-[14px] font-semibold text-white">
                  {position.qty} {sym.kind === "crypto" ? sym.id : "contracts"}
                </span>
                <span className={clsx("ml-auto text-[18px] font-bold tabular-nums", pnl >= 0 ? "text-[#FFB27D]" : "text-[#FF8D85]")}>{signed(pnl)}</span>
              </div>
              <div className="relative mt-3 h-1.5 rounded-full bg-gradient-to-r from-[#FF5A4E]/50 via-white/15 to-[#FF8A3D]/60">
                <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#121214] bg-white shadow" style={{ left: `${(position.side === "long" ? posProgress : 1 - posProgress) * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-white/40">
                <span>SL {fmt(position.stop)}</span>
                <button onClick={onClosePosition} className="font-semibold text-white/70 hover:text-white">
                  Close now
                </button>
                <span>TP {fmt(position.target)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-[20px] bg-white/[0.03] px-3 py-4 text-center text-[13.5px] text-white/45">
              No open positions
              {lastTrade && <p className={clsx("mt-1 font-semibold", lastTrade.pnl >= 0 ? "text-[#FFB27D]" : "text-[#FF8D85]")}>Last trade {signed(lastTrade.pnl)}</p>}
            </div>
          )}
        </section>

        <section>
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">Today</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat k="Vision trades" v={String(todays.length)} />
            <Stat k="Win rate" v={todays.length ? `${Math.round((wins / todays.length) * 100)}%` : "—"} />
            <Stat k="Realized" v={signed(realized)} tone={realized > 0 ? "orange" : realized < 0 ? "red" : undefined} />
          </div>
        </section>
      </div>

      <footer className="space-y-3 border-t border-white/[0.06] px-5 py-4">
        {venueSlot}
        <button onClick={() => onAuto(!autoExecute)} className={clsx("flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left transition", autoExecute ? "bg-[#FF8A3D]/12 ring-1 ring-[#FF8A3D]/40" : "bg-white/[0.04] ring-1 ring-white/[0.06]")}>
          <Zap className={clsx("h-5 w-5", autoExecute ? "text-[#FF8A3D]" : "text-white/50")} />
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-white">Auto-execute</span>
            <span className={clsx("block text-[12px]", autoExecute ? "text-[#FFB27D]" : "text-white/45")}>{autoExecute ? "On · takes fresh setups that pass your filters" : "Off · you confirm each trade"}</span>
          </span>
          <span className={clsx("relative block h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300", autoExecute ? "bg-[#FF8A3D]" : "bg-white/[0.16]")}>
            <span className={clsx("absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform duration-300 ease-spring", autoExecute ? "translate-x-[22px]" : "translate-x-[2px]")} />
          </span>
        </button>
      </footer>
    </aside>
  );
}

function Ring({ value, label }: { value: number; label: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-[52px] w-[52px] shrink-0 place-items-center" title="Target hit before stop in the loaded history">
      <svg width="52" height="52" className="-rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke="#FF8A3D" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-[stroke-dashoffset] duration-1000" />
      </svg>
      <span className="absolute text-[13px] font-bold tabular-nums text-white">{label}</span>
    </span>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "orange" | "red" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/50">{k}</dt>
      <dd className={clsx("font-semibold tabular-nums", tone === "orange" ? "text-[#FFB27D]" : tone === "red" ? "text-[#FF8D85]" : "text-white")}>{v}</dd>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "orange" | "red" }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <p className={clsx("text-[18px] font-bold tabular-nums", tone === "orange" ? "text-[#FFB27D]" : tone === "red" ? "text-[#FF8D85]" : "text-white")}>{v}</p>
      <p className="text-[11.5px] text-white/45">{k}</p>
    </div>
  );
}

export { usd };
