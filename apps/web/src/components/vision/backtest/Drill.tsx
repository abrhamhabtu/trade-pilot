"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, FolderDown, RotateCcw, X } from "lucide-react";
import type { Bar } from "@/lib/pilot/market";
import type { BacktestTrade } from "@/lib/vision/backtest";
import { MiniChart } from "./MiniChart";

const ROUND = 20;
type Pick = { t: BacktestTrade; take: boolean };

/** Up to `n` trades spread across the whole period, in time order, from a random start. */
function sample(trades: BacktestTrade[], n: number) {
  if (trades.length <= n) return [...trades];
  const step = trades.length / n;
  const off = Math.random() * step;
  return Array.from({ length: n }, (_, k) => trades[Math.floor(off + k * step)]);
}

/**
 * Take or skip, twenty times. Each setup shows up to the bar it triggered on
 * with the plan drawn; T takes it, K skips it, then the outcome plays out. The
 * score is your picks against simply taking every one.
 */
export function Drill({ bars, trades, name, onSave, onOpen }: { bars: Bar[]; trades: BacktestTrade[]; name: string; onSave: (picks: Pick[]) => Promise<boolean>; onOpen: (t: BacktestTrade) => void }) {
  const [round, setRound] = useState(() => sample(trades, ROUND));
  const [k, setK] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(760);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const t = round[k];
  const done = k >= round.length;

  const decide = useCallback(
    (take: boolean) => {
      if (!t || reveal) return;
      setPicks((p) => [...p, { t, take }]);
      setReveal(true);
      setTimeout(() => {
        setReveal(false);
        setK((x) => x + 1);
      }, 1400);
    },
    [t, reveal],
  );
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      const key = e.key.toLowerCase();
      if (key === "t") decide(true);
      else if (key === "k") decide(false);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [decide]);
  const again = () => {
    setRound(sample(trades, ROUND));
    setK(0);
    setPicks([]);
    setSaved("idle");
  };

  const score = useMemo(() => {
    if (!done || !picks.length) return null;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const taken = picks.filter((p) => p.take);
    const skippedWins = picks.filter((p) => !p.take && p.t.r > 0);
    const avoided = picks.filter((p) => !p.take && p.t.r <= 0);
    // The calls that cost most: big winners skipped, losers taken.
    const wrong = picks
      .map((p) => ({ p, cost: p.take ? Math.max(0, -p.t.r) : Math.max(0, p.t.r) }))
      .filter((x) => x.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3);
    return { yours: taken.reduce((a, p) => a + p.t.r, 0), all: picks.reduce((a, p) => a + p.t.r, 0), perTake: mean(taken.map((p) => p.t.r)), perAll: mean(picks.map((p) => p.t.r)), taken: taken.length, skippedWins, avoided, wrong };
  }, [done, picks]);

  if (!trades.length) return <p className="rounded-2xl bg-white/[0.04] p-4 text-[13.5px] text-white/55">This strategy took no trades in this period, so there is nothing to drill.</p>;
  const sign = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}R`;

  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-[16px] font-bold text-white">Decision drill · {name}</h3>
        <span className="text-[12.5px] tabular-nums text-white/50">{Math.min(k + 1, round.length)} of {round.length}</span>
      </div>
      <div ref={box} className="mt-3">
        {!done && t ? (
          <>
            <div className="overflow-hidden rounded-2xl bg-black/30 ring-1 ring-white/[0.06]">
              <MiniChart bars={bars} t={t} width={w} height={320} upTo={reveal ? undefined : t.entryIndex} win={t.r > 0} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <p className="mr-auto text-[13px] text-white/60">
                {reveal ? (
                  <span className={clsx("font-semibold", t.r > 0 ? "text-[#FFB27D]" : "text-[#FF8D85]")}>
                    {t.r > 0 ? "Winner" : "Loser"} · {sign(t.r)} · you {picks[picks.length - 1]?.take ? "took it" : "skipped it"}
                  </span>
                ) : (
                  <>
                    {t.side === "long" ? "Long" : "Short"} at {t.entry}, stop {t.stop}, target {t.target} · {new Date(t.entryT * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC
                  </>
                )}
              </p>
              <button disabled={reveal} onClick={() => decide(false)} className="flex h-10 items-center gap-1.5 rounded-full bg-white/[0.08] px-4 text-[13.5px] font-semibold text-white ring-1 ring-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40">
                <X className="h-4 w-4" /> Skip <kbd className="ml-1 text-[10.5px] text-white/40">K</kbd>
              </button>
              <button disabled={reveal} onClick={() => decide(true)} className="flex h-10 items-center gap-1.5 rounded-full bg-[#FF8A3D] px-4 text-[13.5px] font-bold text-black disabled:opacity-40">
                <Check className="h-4 w-4" /> Take <kbd className="ml-1 text-[10.5px] text-black/50">T</kbd>
              </button>
            </div>
          </>
        ) : score ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Stat label="Your picks" value={sign(score.yours)} sub={`${score.taken} taken · ${sign(score.perTake)} each`} good={score.yours >= score.all} />
              <Stat label="Taking every one" value={sign(score.all)} sub={`${picks.length} setups · ${sign(score.perAll)} each`} />
              <Stat label="Your calls" value={`${score.avoided.length} losers avoided`} sub={`${score.skippedWins.length} winners skipped`} />
            </div>
            <p className="text-[13px] text-white/60">{score.yours > score.all ? `Your filter added ${sign(score.yours - score.all)} over these ${picks.length}. Twenty is a small sample; drill again before trusting it.` : `Taking everything did ${sign(score.all - score.yours)} better than your picks here. Twenty is a small sample; drill again before reading much into it.`}</p>
            {score.wrong.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/40">The calls that cost most</p>
                <ul className="mt-1 space-y-1">
                  {score.wrong.map(({ p, cost }) => (
                    <li key={p.t.entryT}>
                      <button onClick={() => onOpen(p.t)} className="text-left text-[13px] text-white/75 underline-offset-2 hover:underline">
                        {new Date(p.t.entryT * 1000).toISOString().slice(0, 10)} · {p.take ? "took a loser" : "skipped a winner"} · cost {cost.toFixed(2)}R →
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={again} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-black">
                <RotateCcw className="h-4 w-4" /> Twenty more
              </button>
              <button
                disabled={saved === "saving" || saved === "saved"}
                onClick={async () => {
                  setSaved("saving");
                  setSaved((await onSave(picks)) ? "saved" : "error");
                }}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2 text-[13px] font-semibold text-white ring-1 ring-white/[0.06] disabled:opacity-60"
              >
                <FolderDown className="h-4 w-4" /> {saved === "saved" ? "Saved to Library" : saved === "error" ? "Couldn't save" : "Save to Library"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className={clsx("rounded-2xl p-3 ring-1", good ? "bg-[#FF8A3D]/10 ring-[#FF8A3D]/30" : "bg-white/[0.04] ring-white/[0.06]")}>
      <p className="text-[11.5px] text-white/45">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold tabular-nums text-white">{value}</p>
      <p className="text-[11.5px] text-white/45">{sub}</p>
    </div>
  );
}
