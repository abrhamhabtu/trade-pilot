"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Camera, Check, ChevronDown, Loader2, ShieldCheck, ShieldAlert, X as XIcon } from "lucide-react";
import { useModelStore } from "@/lib/pilot/modelStore";
import { PROVIDERS, type ModelConfig } from "@/lib/pilot/models";
import type { Scan } from "@/lib/vision/analyze";
import type { VisionSymbol } from "@/lib/vision/markets";
import type { ReadResult } from "@/lib/vision/read";
import type { ChartState } from "./ChartCard";
import { captureChart } from "./VisionChart";

type Tool = { id: "claude-code" | "codex"; label: string; installed: boolean; loggedIn: boolean; version: string; fix: string };

/** Lists the logged-in tools on this computer, and connects one with a click. */
export function useSessionTools() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const model = useModelStore((s) => s.model);
  const setModel = useModelStore((s) => s.setModel);
  const refresh = () =>
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((j) => setTools(j.tools))
      .catch(() => setTools([]));
  useEffect(() => {
    void refresh();
  }, []);
  const connect = (id: Tool["id"]) => setModel({ ...model, provider: id, model: "", apiKey: model.apiKey } as ModelConfig);
  return { tools, connect, refresh };
}

export function SessionConnect({ compact }: { compact?: boolean }) {
  const { tools, connect, refresh } = useSessionTools();
  const provider = useModelStore((s) => s.model.provider);
  if (!tools) return <p className="text-[12.5px] text-white/40">Looking for Claude Code and Codex on this computer…</p>;
  if (!tools.length) return <p className="text-[12.5px] text-white/50">Logged-in tools only work when TradePilot runs on your own computer.</p>;
  return (
    <div className={clsx("grid gap-2", !compact && "sm:grid-cols-2")}>
      {tools.map((t) => {
        const on = provider === t.id;
        return (
          <div key={t.id} className={clsx("rounded-[16px] p-3.5", on ? "bg-white text-black" : "bg-white/[0.05] text-white")}>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[14px] font-semibold">{t.label}</p>
              {on ? (
                <span className="flex items-center gap-1 text-[12px] font-semibold"><Check className="h-3.5 w-3.5" /> Connected</span>
              ) : t.loggedIn ? (
                <button onClick={() => connect(t.id)} className="rounded-full bg-white px-3 py-1 text-[12.5px] font-semibold text-black">Use this</button>
              ) : (
                <button onClick={refresh} className="rounded-full bg-white/[0.1] px-3 py-1 text-[12.5px] font-medium text-white">Check again</button>
              )}
            </div>
            <p className={clsx("mt-0.5 text-[12px] leading-snug", on ? "text-black/60" : "text-white/50")}>{t.loggedIn ? `Logged in. Uses your plan, no API key.` : t.fix}</p>
          </div>
        );
      })}
    </div>
  );
}

const STANCE = { take: "Would take it", wait: "Would wait", skip: "Would skip it" };

/** A real screenshot to the trader's AI, the answer, and proof of whether it looked. */
export function ChartRead({ sym, state, scan }: { sym: VisionSymbol; state: ChartState | null; scan: Scan }) {
  const model = useModelStore((s) => s.model);
  const session = model.provider === "claude-code" || model.provider === "codex";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState("");
  const [out, setOut] = useState<(ReadResult & { prompt: string }) | null>(null);
  const [shown, setShown] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    abort.current?.abort();
    setOut(null);
    setError("");
    setImage("");
    setBusy(false);
  }, [sym.id]);

  if (!session)
    return (
      <div className="mb-2 rounded-[16px] bg-white/[0.04] p-3">
        <p className="text-[13px] font-medium text-white/85">Let your AI look at this chart</p>
        <p className="mb-2 mt-0.5 text-[12px] leading-snug text-white/50">Connect what you already use. No API key.</p>
        <SessionConnect compact />
      </div>
    );

  const run = async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setError("");
    setOut(null);
    try {
      const bars = state?.bars ?? [];
      const shot = captureChart(sym.id);
      if (!shot || !bars.length) throw new Error("The chart isn't on screen yet.");
      setImage(shot.image);
      const view = bars.slice(Math.max(0, shot.from), Math.min(bars.length, shot.to + 1));
      if (!view.length) throw new Error("No bars are in view. Zoom the chart back in.");
      const lastBar = view[view.length - 1];
      const truth = { high: Math.max(...view.map((b) => b.h)), low: Math.min(...view.map((b) => b.l)), last: lastBar.c, lastCandle: lastBar.c >= lastBar.o ? ("up" as const) : ("down" as const), bars: view.length };
      // No prices that let it pass the checks without looking: those stay in the picture.
      const facts = { scan: scan.items.map((i) => `${i.label}: ${i.value}`), setup: scan.setup ? { side: scan.setup.side, rr: scan.setup.rr, outcome: scan.setup.outcome, reader: scan.setup.reader, history: { matches: scan.setup.history.matches, wins: scan.setup.history.wins, losses: scan.setup.history.losses, hitRate: scan.setup.history.hitRate, expectancyR: scan.setup.history.expectancyR } } : null };
      const r = await fetch("/api/ai/read", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal, body: JSON.stringify({ tool: model.provider, image: shot.image, market: sym.label, tf: bars.length > 1 ? `${Math.round((bars[1].t - bars[0].t) / 60)}m` : "", facts, truth }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "The AI didn't answer.");
      setOut(j);
    } catch (e) {
      if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : "The AI didn't answer.");
    } finally {
      if (!ctl.signal.aborted) setBusy(false);
    }
  };

  return (
    <div className="mb-2">
      <button onClick={run} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13.5px] font-semibold text-black disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {busy ? `${PROVIDERS[model.provider].label.replace(" (logged in)", "")} is looking…` : out ? "Read it again" : "Read this chart"}
      </button>
      {error && <p className="mt-2 text-[13px] leading-snug text-[#FF8D85]">{error}</p>}
      {/* A local data: picture, which next/image can't optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt={`The ${sym.label} screenshot sent to the AI`} className="mt-3 w-full rounded-[14px] ring-1 ring-white/[0.08]" />}
      {out && (
        <div className="mt-3">
          <p className={clsx("flex items-center gap-1.5 text-[13px] font-semibold", out.verified ? "text-[#7CE59A]" : "text-[#FFB27D]")}>
            {out.verified ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />} {out.verified ? "It read the chart: its numbers match the bars" : "Don't trust this one: it misread the chart"}
          </p>
          <p className={clsx("mt-2 text-[14px] leading-relaxed", out.verified ? "text-white/90" : "text-white/50")}>{out.read.read}</p>
          {out.read.stance && <p className="mt-2 text-[13px] font-medium text-white">{STANCE[out.read.stance]}</p>}
          {out.read.invalidation && <p className="mt-1 text-[13px] leading-snug text-white/65">Wrong if: {out.read.invalidation}</p>}
          {out.read.levels.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[12.5px] tabular-nums text-white/70">
              {out.read.levels.map((l) => <li key={l.price} className="flex justify-between gap-3"><span>{l.why}</span><span>{l.price.toLocaleString("en-US")}</span></li>)}
            </ul>
          )}
          <button onClick={() => setShown(!shown)} aria-expanded={shown} className="mt-3 flex items-center gap-1 text-[12.5px] font-medium text-white/55 hover:text-white">
            <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", shown && "rotate-180")} /> How the app checked it, and what it was told
          </button>
          {shown && (
            <div className="mt-2">
              <ul className="space-y-1">
                {out.checks.map((c) => (
                  <li key={c.what} className="flex items-start gap-1.5 text-[12.5px] leading-snug">
                    {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7CE59A]" /> : <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFA3AB]" />}
                    <span className="text-white/70"><span className="font-medium text-white/90">{c.what}.</span> {c.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-white/40">The high and low weren&apos;t in what it was told, so a right answer means it read the picture. Its opinion is still an opinion: only the history in the facts is evidence.</p>
              <pre className="mt-2 max-h-48 overflow-auto rounded-[12px] bg-black/40 p-3 text-[11px] leading-relaxed text-white/60 whitespace-pre-wrap">{out.prompt}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
