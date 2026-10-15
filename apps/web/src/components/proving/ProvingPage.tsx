"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Beaker, Plus, Radio, Trophy } from "lucide-react";
import { useHistoryParam, useHistoryTab } from "@/hooks/useHistoryParam";
import { useProvingStore } from "@/store/provingStore";
import { STRATEGIES, defaultConfig, type StrategyId } from "@/lib/proving/engine";
import { programByKey } from "@/lib/proving/firms";
import { RTH_CLOSE, RTH_OPEN, nyClock } from "@/lib/pilot/market";
import { NewTest, type NewTestInput } from "./NewTest";
import { QuickStart } from "./QuickStart";
import { TestsHome } from "./TestsHome";
import { Tournament } from "./Tournament";
import { LivePanel } from "./LivePanel";

const VIEWS = ["tests", "tournament", "live"] as const;
const TABS = [
  { id: "tests", label: "Tests", icon: Beaker },
  { id: "tournament", label: "Tournament", icon: Trophy },
  { id: "live", label: "Live", icon: Radio },
] as const;

export function ProvingPage() {
  const [view, setView] = useHistoryTab("view", VIEWS);
  // The sheet lives in the URL too, so Back closes it.
  const [sheet, setSheet] = useHistoryParam("new");
  const { tests, add } = useProvingStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!hydrated) return null;

  const clock = nyClock(Date.now());
  const open = clock.weekday > 0 && clock.weekday < 6 && clock.minute >= RTH_OPEN && clock.minute < RTH_CLOSE;
  const running = tests.filter((t) => t.state === "running").length;

  const create = (t: NewTestInput) => {
    add({ name: t.name, cfg: t.cfg, programKey: t.programKey, startDate: t.startDate });
    setSheet(null);
    if (view !== "tests") setView("tests");
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const fromTemplate = (strategy: StrategyId, programKey: string) => {
    const d = new Date();
    d.setDate(d.getDate() - 44);
    const p = programByKey(programKey)!;
    add({ name: `${STRATEGIES[strategy].short} · ${p.firm.split(" ")[0]} ${p.sizeLabel}`, cfg: defaultConfig(strategy), programKey, startDate: d.toISOString().slice(0, 10) });
  };
  const index = TABS.findIndex((t) => t.id === view);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5 pt-1">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] font-medium text-zinc-400">
            <span className={clsx("h-2 w-2 rounded-full", open ? "animate-pulse bg-tp-green" : "bg-zinc-600")} />
            {open ? "Market open" : "Market closed"} · {running} of 5 tests running
          </p>
          <h1 className="mt-1 text-[40px] font-bold leading-[1.02] tracking-[-0.04em] text-white sm:text-[48px]">Proving Ground</h1>
          <p className="mt-1.5 max-w-xl text-pretty text-[17px] leading-snug text-zinc-400">Prove a strategy passes, and pays, before you buy the account.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <nav aria-label="Proving Ground views" className="relative grid flex-1 grid-cols-3 rounded-[14px] bg-white/[0.07] p-[3px] sm:w-[360px] sm:flex-none">
            <span
              aria-hidden
              className="absolute bottom-[3px] left-[3px] top-[3px] w-[calc((100%-6px)/3)] rounded-[11px] bg-white/[0.16] shadow-[0_3px_10px_rgba(0,0,0,0.3),inset_0_0.5px_0_rgba(255,255,255,0.18)] transition-transform duration-500 ease-spring"
              style={{ transform: `translateX(${index * 100}%)` }}
            />
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                aria-current={view === t.id ? "page" : undefined}
                className={clsx("relative flex items-center justify-center gap-1.5 rounded-[11px] py-2 text-[14px] font-semibold transition-colors", view === t.id ? "text-white" : "text-zinc-400 hover:text-zinc-200")}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setSheet("quick")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[15px] font-semibold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.5)] transition hover:brightness-95 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} /> New test
          </button>
        </div>
      </header>

      {view === "tournament" ? <Tournament /> : view === "live" ? <LivePanel /> : <TestsHome onNew={() => setSheet("quick")} onTemplate={fromTemplate} />}

      {sheet === "quick" && <QuickStart onCreate={create} onClose={() => setSheet(null)} onAdvanced={() => setSheet("advanced", { replace: true })} />}
      {sheet === "advanced" && <NewTest onCreate={create} onClose={() => setSheet(null)} />}
    </div>
  );
}
