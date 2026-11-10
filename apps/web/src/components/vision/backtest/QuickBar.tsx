"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Bookmark, CornerDownLeft, RefreshCcw, Search, Trash2 } from "lucide-react";
import { parseQuick } from "@/lib/vision/quick";
import { FIRM_PROGRAMS } from "@/lib/proving/firms";
import type { BacktestResult } from "@/lib/vision/backtest";
import { useVisionStore, type BacktestSettings } from "@/store/visionStore";

const FIRMS = FIRM_PROGRAMS.map((p) => ({ key: p.key, firm: p.firm, size: p.size }));

/**
 * Type a test, press Enter. ⌘K focuses it from anywhere on the tab. What was
 * understood shows as chips; words that changed nothing are listed. Presets
 * sit beside it, and "Re-run all" says what moved since last time.
 */
export function QuickBar({ onRun, run }: { onRun: (patch: Partial<BacktestSettings>) => void; run: (p: Partial<BacktestSettings>) => Promise<{ result: BacktestResult } | null> }) {
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const q = useMemo(() => (text.trim() ? parseQuick(text, FIRMS) : null), [text]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#121214]/80 p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/[0.05] px-3 ring-1 ring-inset ring-white/[0.06] focus-within:ring-[#5AC8FA]/50">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q && q.used.length) onRun(q.patch);
            }}
            placeholder="nq 5m orb ny open 1y 50k lucid 2 micros"
            aria-label="Quick backtest"
            className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30"
          />
          <kbd className="hidden shrink-0 rounded bg-white/[0.08] px-1.5 py-0.5 text-[10.5px] text-white/45 sm:block">⌘K</kbd>
        </div>
        <button disabled={!q?.used.length} onClick={() => q && onRun(q.patch)} className="flex h-10 items-center gap-1.5 rounded-2xl bg-[#5AC8FA] px-3.5 text-[13px] font-bold text-black disabled:opacity-40">
          <CornerDownLeft className="h-4 w-4" /> Run
        </button>
        <Presets run={run} />
      </div>
      {q && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {q.used.map((u) => (
            <span key={u} className="rounded-md bg-[#5AC8FA]/12 px-2 py-0.5 text-[11.5px] font-semibold text-[#9BE1FF]">
              {u}
            </span>
          ))}
          {q.unknown.length > 0 && <span className="ml-1 text-[11.5px] text-[#FF8D85]">Didn&apos;t use: {q.unknown.join(", ")}</span>}
        </div>
      )}
    </div>
  );
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function Presets({ run }: { run: (p: Partial<BacktestSettings>) => Promise<{ result: BacktestResult } | null> }) {
  const presets = useVisionStore((s) => s.presets);
  const set = useVisionStore((s) => s.set);
  const setBt = useVisionStore((s) => s.setBt);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rerun, setRerun] = useState<{ done: number; changes: string[] } | null>(null);
  const save = () => {
    const bt = useVisionStore.getState().bt;
    set({ presets: [...presets, { id: uid(), name: name.trim() || `Preset ${presets.length + 1}`, bt }] });
    setName("");
  };
  const all = async () => {
    const changes: string[] = [];
    setRerun({ done: 0, changes });
    const next = [...useVisionStore.getState().presets];
    for (let k = 0; k < next.length; k++) {
      const p = next[k];
      const r = await run(p.bt);
      if (r) {
        const now = { at: Date.now(), netR: r.result.stats.netR, trades: r.result.stats.trades };
        const was = p.lastRun;
        changes.push(was ? `${p.name}: ${was.netR.toFixed(1)}R → ${now.netR.toFixed(1)}R, ${was.trades} → ${now.trades} trades` : `${p.name}: ${now.netR.toFixed(1)}R over ${now.trades} trades (first run)`);
        next[k] = { ...p, lastRun: now };
      } else changes.push(`${p.name}: no data`);
      setRerun({ done: k + 1, changes: [...changes] });
    }
    set({ presets: next });
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={clsx("flex h-10 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-semibold ring-1 ring-white/[0.06]", open ? "bg-white/[0.14] text-white" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.1]")}>
        <Bookmark className="h-4 w-4" /> Presets{presets.length ? ` · ${presets.length}` : ""}
      </button>
      {open && (
        <div className="tp-card-in absolute right-0 top-12 z-40 w-[340px] rounded-[18px] border border-white/[0.1] bg-[#1B1B1E]/[0.98] p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
          <div className="flex gap-1.5 p-1">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Name these settings" className="h-9 min-w-0 flex-1 rounded-xl bg-white/[0.06] px-2.5 text-[13px] text-white outline-none" />
            <button onClick={save} className="rounded-xl bg-white px-3 text-[12.5px] font-bold text-black">
              Save
            </button>
          </div>
          {presets.map((p) => (
            <div key={p.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.05]">
              <button
                onClick={() => {
                  setBt(p.bt);
                  setOpen(false);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-[13.5px] font-semibold text-white">{p.name}</span>
                <span className="block truncate text-[11.5px] text-white/45">
                  {p.bt.symbol} {p.bt.tf} · {p.bt.logic === "custom" ? "your rules" : p.bt.reader}
                  {p.lastRun ? ` · ${p.lastRun.netR >= 0 ? "+" : ""}${p.lastRun.netR.toFixed(1)}R last run` : ""}
                </span>
              </button>
              <button aria-label={`Delete ${p.name}`} onClick={() => set({ presets: presets.filter((x) => x.id !== p.id) })} className="text-white/30 opacity-0 hover:text-white group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {presets.length > 0 && (
            <button onClick={all} disabled={!!rerun && rerun.done < presets.length} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.07] py-2 text-[12.5px] font-semibold text-white hover:bg-white/[0.1] disabled:opacity-50">
              <RefreshCcw className={clsx("h-3.5 w-3.5", rerun && rerun.done < presets.length && "animate-spin")} /> Re-run all on the current data
            </button>
          )}
          {rerun && (
            <ul className="mt-1.5 space-y-0.5 px-1 text-[11.5px] text-white/60">
              {rerun.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          {!presets.length && <p className="px-2 py-2 text-[12px] text-white/40">Save the settings you test often, then re-run them all when new data comes in.</p>}
        </div>
      )}
    </div>
  );
}
