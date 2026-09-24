"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { FlaskConical, Plus, Rocket, ShieldCheck } from "lucide-react";
import { MAX_RUNNING, useProvingStore, type ProvingTest } from "@/store/provingStore";
import { STRATEGIES, defaultConfig, type StrategyId } from "@/lib/proving/engine";
import { programByKey, type Evaluation } from "@/lib/proving/firms";
import { testEvaluation } from "@/lib/proving/runner";
import { RTH_CLOSE, RTH_OPEN, nyClock } from "@/lib/pilot/market";
import { CompareChart, Sparkline } from "./charts";
import { StrategyGlyph } from "./glyphs";
import { NewTest, type NewTestInput } from "./NewTest";
import { TestDetail } from "./TestDetail";

const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const usd = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

const TEMPLATES: { strategy: StrategyId; programKey: string; pitch: string }[] = [
  { strategy: "double-break-vwap", programKey: "lucid-flex:lucidflex-50k", pitch: "Your main setup against LucidFlex's EOD drawdown." },
  { strategy: "sr-retest", programKey: "topstep:topstep-50k", pitch: "Level retests through Topstep's 50% consistency rule." },
  { strategy: "vwap-pullback", programKey: "apex:apex-50k", pitch: "Trend pullbacks against Apex's intraday trailing drawdown." },
];

export function ProvingPage() {
  const { tests, selectedId, select, add } = useProvingStore();
  const [hydrated, setHydrated] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => setHydrated(true), []);

  const evals = useMemo(() => new Map(tests.map((t) => [t.id, testEvaluation(t)])), [tests]);
  const running = tests.filter((t) => t.state === "running").length;
  const selected = tests.find((t) => t.id === selectedId) ?? tests[0] ?? null;
  const clock = nyClock(Date.now());
  const open = clock.weekday > 0 && clock.weekday < 6 && clock.minute >= RTH_OPEN && clock.minute < RTH_CLOSE;

  const create = (t: NewTestInput) => {
    add({ name: t.name, cfg: t.cfg, programKey: t.programKey, startDate: t.startDate });
    setCreating(false);
  };
  const fromTemplate = (strategy: StrategyId, programKey: string) => {
    // A 30-session replay, then live.
    const d = new Date();
    d.setDate(d.getDate() - 44);
    const p = programByKey(programKey)!;
    add({ name: `${STRATEGIES[strategy].short} · ${p.firm.split(" ")[0]} ${p.sizeLabel}`, cfg: defaultConfig(strategy), programKey, startDate: d.toISOString().slice(0, 10) });
  };

  if (!hydrated) return null;

  const passed = tests.filter((t) => evals.get(t.id)?.verdict === "passed").length;
  const failed = tests.filter((t) => evals.get(t.id)?.verdict === "failed").length;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-tp-card/60 px-6 py-6 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_120%_at_0%_0%,rgba(0,214,143,0.12),transparent_50%),radial-gradient(80%_120%_at_100%_0%,rgba(177,140,255,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(70%_80%_at_70%_0%,black,transparent)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-tp-green">
              <FlaskConical className="h-3.5 w-3.5" /> Proving Ground
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-[34px]">
              Prove it passes{" "}
              <span className="bg-gradient-to-r from-tp-green via-emerald-300 to-[#B18CFF] bg-clip-text text-transparent">before you pay for it.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Each test puts one strategy on one prop firm's exact rules. It replays real bars, then keeps trading live every session on its own until the account passes or blows. Run up to {MAX_RUNNING} side by side.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex flex-wrap gap-2 font-mono text-[11px]">
              <span className={clsx("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ring-inset", open ? "bg-tp-green/10 text-tp-green ring-tp-green/25" : "bg-white/[0.04] text-zinc-400 ring-white/[0.08]")}>
                <span className={clsx("h-1.5 w-1.5 rounded-full", open ? "animate-pulse bg-tp-green" : "bg-zinc-500")} />
                {open ? "Market open · trading live" : "Market closed · next session queued"}
              </span>
              <span className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-zinc-300 ring-1 ring-inset ring-white/[0.08]">
                {running}/{MAX_RUNNING} running · {passed} passed · {failed} failed
              </span>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-tp-green to-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#0D1628] shadow-[0_10px_30px_-12px_rgba(0,214,143,0.8)] hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> New test
            </button>
          </div>
        </div>
      </section>

      {!tests.length ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {TEMPLATES.map((t) => {
            const p = programByKey(t.programKey)!;
            return (
              <button key={t.strategy} onClick={() => fromTemplate(t.strategy, t.programKey)} className="group rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5 text-left transition hover:-translate-y-0.5 hover:border-tp-green/30">
                <StrategyGlyph id={t.strategy} active />
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {p.firm} · {p.program} · {p.sizeLabel}
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-50">{STRATEGIES[t.strategy].label}</p>
                <p className="mt-1 text-[13px] text-zinc-400">{t.pitch}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-tp-green">
                  <Rocket className="h-3.5 w-3.5" /> Replay 30 sessions, then go live
                </span>
              </button>
            );
          })}
          <p className="flex items-center gap-2 text-[12px] text-zinc-500 lg:col-span-3">
            <ShieldCheck className="h-3.5 w-3.5" /> Real CME futures bars, fills on the next bar's open plus slippage, and the stop wins when a bar hits both. Rules come from each firm's published terms, so check them before you buy.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {tests.map((t) => (
              <TestCard key={t.id} test={t} e={evals.get(t.id) ?? null} active={selected?.id === t.id} onClick={() => select(t.id)} />
            ))}
            {running < MAX_RUNNING && (
              <button onClick={() => setCreating(true)} className="grid min-h-[190px] place-items-center rounded-2xl border border-dashed border-white/[0.1] text-zinc-500 transition hover:border-tp-green/40 hover:text-tp-green">
                <span className="flex flex-col items-center gap-2 text-sm font-medium">
                  <Plus className="h-5 w-5" /> Add a test
                  <span className="text-[11px] font-normal text-zinc-600">{MAX_RUNNING - running} slots free</span>
                </span>
              </button>
            )}
          </section>

          {tests.length > 1 && (
            <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">The race · profit by trading day</p>
                <div className="flex flex-wrap gap-3">
                  {tests.map((t) => (
                    <button key={t.id} onClick={() => select(t.id)} className="flex items-center gap-1.5 text-[11.5px] text-zinc-400 hover:text-zinc-100">
                      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <CompareChart
                series={tests.map((t) => {
                  const e = evals.get(t.id);
                  const p = programByKey(t.programKey);
                  return { id: t.id, name: t.name, color: t.color, target: p?.target ?? 0, points: (e?.marks ?? []).map((m) => m.balance - (p?.size ?? 0)) };
                })}
              />
            </section>
          )}

          {selected && evals.get(selected.id) && <TestDetail key={selected.id} test={selected} evaluation={evals.get(selected.id)!} />}
        </>
      )}

      {creating && <NewTest onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}

function TestCard({ test, e, active, onClick }: { test: ProvingTest; e: Evaluation | null; active: boolean; onClick: () => void }) {
  const p = programByKey(test.programKey);
  if (!p) return null;
  const today = Object.values(test.days).find((d) => d.partial);
  const openTrade = today?.trades.find((t) => t.exit === "open");
  const v = e?.verdict ?? "pending";
  const progress = Math.max(0, Math.min(100, ((e?.profit ?? 0) / p.target) * 100));
  const buffer = Math.max(0, Math.min(100, ((e?.buffer ?? p.drawdown) / p.drawdown) * 100));
  const replaying = test.state === "running" && test.lastRun === 0;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "group relative overflow-hidden rounded-2xl border bg-tp-card/90 p-4 text-left transition",
        active ? "border-white/[0.18] shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_40px_-24px_rgba(0,0,0,0.8)]" : "border-white/[0.06] hover:border-white/[0.12]",
      )}
    >
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: test.color, opacity: active ? 1 : 0.6 }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-50">{test.name}</p>
          <p className="truncate text-[11.5px] text-zinc-500">
            {STRATEGIES[test.cfg.strategy].label} · {test.cfg.contracts} {test.cfg.instrument} · {p.firm} {p.sizeLabel}
          </p>
        </div>
        <Badge v={v} state={test.state} replaying={replaying} live={!!today} />
      </div>
      <div className="mt-3 h-14">{e && e.marks.length > 0 ? <Sparkline marks={e.marks} start={p.size} color={test.color} /> : <div className="tp-flow-shimmer h-full rounded-lg" />}</div>
      <div className="mt-3 space-y-1.5">
        <Bar label="Target" pct={progress} color="bg-tp-green" text={`${signed(e?.profit ?? 0)} / ${usd(p.target)}`} />
        <Bar label="Buffer" pct={buffer} color={buffer < 30 ? "bg-tp-red" : buffer < 60 ? "bg-tp-yellow" : "bg-tp-blue"} text={usd(e?.buffer ?? p.drawdown)} />
      </div>
      <p className="mt-3 truncate text-[11.5px] text-zinc-500">
        {openTrade
          ? `Live: ${openTrade.side} ${openTrade.qty} @ ${openTrade.entryPx.toLocaleString("en-US")} · ${signed(openTrade.pnl)} open`
          : test.error
            ? test.error
            : e?.headline}
      </p>
    </button>
  );
}

function Bar({ label, pct, color, text }: { label: string; pct: number; color: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-11 font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={clsx("h-full rounded-full transition-[width] duration-700", color)} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="w-24 text-right font-mono text-[10.5px] tabular-nums text-zinc-300">{text}</span>
    </div>
  );
}

function Badge({ v, state, replaying, live }: { v: Evaluation["verdict"]; state: ProvingTest["state"]; replaying: boolean; live: boolean }) {
  const [label, cls] =
    v === "passed"
      ? ["Passed", "bg-tp-green/15 text-tp-green"]
      : v === "failed"
        ? ["Failed", "bg-tp-red/15 text-tp-red"]
        : state === "paused"
          ? ["Paused", "bg-white/[0.06] text-zinc-400"]
          : replaying
            ? ["Replaying", "bg-[#B18CFF]/15 text-[#B18CFF]"]
            : live
              ? ["Live", "bg-tp-red/15 text-tp-red"]
              : ["Queued", "bg-tp-blue/15 text-tp-blue"];
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider", cls)}>
      {label === "Live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tp-red" />}
      {label}
    </span>
  );
}
