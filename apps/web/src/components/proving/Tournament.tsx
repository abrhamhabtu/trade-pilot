"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Crown, Dices, Info, Loader2, Rocket, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { INSTRUMENTS, STRATEGIES, type Instrument, type StrategyId } from "@/lib/proving/engine";
import { FIRM_PROGRAMS } from "@/lib/proving/firms";
import { loadFeed } from "@/lib/proving/runner";
import { oddsScore, ranked, type Cell, type Tournament as TournamentResult, type TourneyMode } from "@/lib/proving/tournament";
import type { TourneyRequest } from "@/lib/proving/tournament.worker";
import type { CareerEvent } from "@/lib/proving/career";
import { useProvingStore } from "@/store/provingStore";
import { setHistoryParams } from "@/hooks/useHistoryParam";
import { StrategyGlyph } from "./glyphs";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const shortDate = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const SIZES = [...new Set(FIRM_PROGRAMS.map((p) => p.size))].sort((a, b) => a - b);
const sizeLabel = (n: number) => `$${n / 1000}K`;

type Progress = { done: number; total: number; label: string };

/** Odds of coming out ahead, as a colour: green is a real chance, red a donation. */
const tone = (p: number) => (p >= 0.55 ? "green" : p >= 0.35 ? "yellow" : "red");
const TONE_BG = { green: "rgb(var(--tp-green) / ALPHA)", yellow: "rgb(var(--tp-yellow) / ALPHA)", red: "rgb(var(--tp-red) / ALPHA)" } as const;
const TONE_TEXT = { green: "text-tp-green", yellow: "text-tp-yellow", red: "text-tp-red" } as const;

export function Tournament() {
  const [instrument, setInstrument] = useState<Instrument>("MNQ");
  const [size, setSize] = useState(50000);
  const [mode, setMode] = useState<TourneyMode>("tuned");
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const job = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("../../lib/proving/tournament.worker.ts", import.meta.url));
    worker.current = w;
    w.onmessage = (e: MessageEvent<{ id: number; type: string } & Record<string, unknown>>) => {
      if (e.data.id !== job.current) return;
      if (e.data.type === "progress") setProgress(e.data as unknown as Progress);
      else if (e.data.type === "done") {
        setResult(e.data.result as TournamentResult);
        setProgress(null);
      } else {
        setError(String(e.data.error));
        setProgress(null);
      }
    };
    return () => w.terminate();
  }, []);

  useEffect(() => {
    const id = ++job.current;
    setError("");
    setPick(null);
    setProgress({ done: 0, total: 6, label: "Loading bars" });
    loadFeed(INSTRUMENTS[instrument].source, "5m")
      .then((feed) => {
        if (id !== job.current) return;
        const req: TourneyRequest = { id, bars: feed.bars, instrument, size, mode, now: Date.now() };
        worker.current?.postMessage(req);
      })
      .catch((e) => {
        if (id !== job.current) return;
        setError(e instanceof Error ? e.message : "Bars unavailable");
        setProgress(null);
      });
  }, [instrument, size, mode]);

  const order = useMemo(() => (result ? ranked(result) : []), [result]);
  const best = order[0] ?? null;
  const keyOf = (c: Cell) => `${c.strategy}|${c.program.key}`;
  const selected = order.find((c) => keyOf(c) === pick) ?? best;
  // Strategies, best first by their best pair.
  const rows = useMemo(() => {
    if (!result) return [];
    const top = new Map<StrategyId, number>();
    for (const c of result.cells) top.set(c.strategy, Math.max(top.get(c.strategy) ?? -Infinity, oddsScore(c.odds)));
    return [...result.entrants].sort((a, b) => (top.get(b.id) ?? 0) - (top.get(a.id) ?? 0));
  }, [result]);

  const busy = progress !== null;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#B18CFF]">
            <Trophy className="h-3.5 w-3.5" /> Tournament
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-50">Every strategy against every firm, scored in money.</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
            Each pair buys its evals, pays its resets, trades the funded account and takes payouts. The winner is the pair most likely to pay you more than it costs you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Seg label="Market" value={instrument} options={(["MNQ", "MES"] as const).map((v) => ({ v, label: v }))} onChange={setInstrument} />
          <Seg label="Account" value={size} options={SIZES.map((v) => ({ v, label: sizeLabel(v) }))} onChange={setSize} />
          <Seg
            label="Rules"
            value={mode}
            options={[
              { v: "tuned" as const, label: "Tuned, scored on unseen days" },
              { v: "starting" as const, label: "Starting rules" },
            ]}
            onChange={setMode}
          />
        </div>
      </section>

      {busy && (
        <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-6">
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin text-[#B18CFF]" />
            {progress!.label}…
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#B18CFF] to-tp-green transition-[width] duration-500" style={{ width: `${Math.max(6, (progress!.done / progress!.total) * 100)}%` }} />
          </div>
        </section>
      )}

      {error && !busy && <p className="rounded-2xl border border-tp-red/30 bg-tp-red/[0.08] p-4 text-sm text-tp-red">{error}</p>}

      {result && !busy && best && (
        <>
          <BestBet cell={best} result={result} />

          {/* Matrix */}
          <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Chance of coming out ahead in 3 months · typical result</p>
              <p className="text-[12px] text-zinc-500">
                {result.mode === "tuned"
                  ? `Rules and size chosen on ${shortDate(result.trainFrom ?? "")}–${shortDate(result.trainTo ?? "")}, scored on ${shortDate(result.from)}–${shortDate(result.to)}`
                  : `Starting rules, ${shortDate(result.from)}–${shortDate(result.to)}`}
              </p>
            </div>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[760px] border-separate border-spacing-1.5">
                <thead>
                  <tr>
                    <th className="w-56" />
                    {result.programs.map((p) => (
                      <th key={p.key} className="px-1 pb-1 text-left align-bottom">
                        <p className="text-[12px] font-semibold leading-tight text-zinc-200">{p.firm}</p>
                        <p className="text-[11px] font-normal leading-tight text-zinc-500">
                          {p.program} · {usd(p.cost)}
                          {p.costCadence === "monthly" ? "/mo" : ""}
                        </p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="pr-2 align-middle">
                        <div className="w-20">
                          <StrategyGlyph id={e.id} active />
                        </div>
                        <p className="text-[13px] font-semibold text-zinc-100">{STRATEGIES[e.id].label}</p>
                        <p className="text-[11px] text-zinc-500">
                          {e.holds ? (
                            <span className="text-tp-green">Held up on unseen days</span>
                          ) : (
                            <span>Unseen half {signed(e.halves[1])}</span>
                          )}
                        </p>
                      </td>
                      {result.programs.map((p) => {
                        const c = result.cells.find((x) => x.strategy === e.id && x.program.key === p.key)!;
                        const t = tone(c.odds.pProfit);
                        const active = selected && keyOf(selected) === keyOf(c);
                        return (
                          <td key={p.key} className="p-0">
                            <button
                              onClick={() => setPick(keyOf(c))}
                              className={clsx(
                                "w-full rounded-xl px-2.5 py-2 text-left ring-1 ring-inset transition hover:brightness-125",
                                active ? "ring-white/60" : "ring-white/[0.04]",
                              )}
                              style={{ background: TONE_BG[t].replace("ALPHA", String(0.06 + c.odds.pProfit * 0.22)) }}
                            >
                              <p className={clsx("text-[17px] font-semibold tabular-nums", TONE_TEXT[t])}>{c.odds.runs ? pct(c.odds.pProfit) : "—"}</p>
                              <p className="font-mono text-[11px] tabular-nums text-zinc-300">{c.odds.runs ? signed(c.odds.medianNet) : "over size"}</p>
                              <p className="font-mono text-[10px] text-zinc-500">
                                {c.contracts} {e.cfg.instrument}
                              </p>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected && <PairDetail cell={selected} result={result} />}

          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-zinc-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Odds come from {best.odds.runs} account lives of {best.odds.horizon} sessions each, dealt at random from the strategy&apos;s own scored days, so streaks are not
              preserved. Payouts are modelled simply: once the firm&apos;s minimum days are traded, everything above one drawdown of cushion is withdrawn at the firm&apos;s split.
              Activation fees, payout caps and payout calendars are not included. Bars are free CME data, about 10 minutes delayed, and the window is the last {result.mode === "tuned" ? "~60" : result.sessions} sessions.
            </span>
          </p>
        </>
      )}
    </div>
  );
}

function BestBet({ cell, result }: { cell: Cell; result: TournamentResult }) {
  const e = result.entrants.find((x) => x.id === cell.strategy)!;
  const o = cell.odds;
  const good = o.pProfit >= 0.5;
  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-7",
        good ? "border-tp-green/30 bg-gradient-to-br from-tp-green/[0.14] via-tp-card/90 to-tp-card/90" : "border-tp-yellow/25 bg-gradient-to-br from-tp-yellow/[0.1] via-tp-card/90 to-tp-card/90",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-xl">
          <p className={clsx("flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]", good ? "text-tp-green" : "text-tp-yellow")}>
            <Crown className="h-3.5 w-3.5" /> {good ? "Best bet right now" : "Least bad bet right now"}
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-[28px]">
            {STRATEGIES[cell.strategy].label} <span className="text-zinc-500">on</span> {cell.program.firm} {cell.program.sizeLabel}
          </h3>
          <p className="mt-1 text-[13px] text-zinc-400">
            {cell.program.program} · {cell.contracts} {e.cfg.instrument} · {e.cfg.timeframe} bars
          </p>
          {e.changes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {e.changes.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-md bg-[#B18CFF]/12 px-2 py-0.5 text-[11.5px] text-[#CDB6FF] ring-1 ring-inset ring-[#B18CFF]/25">
                  <Sparkles className="h-3 w-3" /> {c}
                </span>
              ))}
            </div>
          )}
          {e.stats.trades < 15 && (
            <p className="mt-3 text-[13px] leading-relaxed text-tp-yellow/90">
              Only {e.stats.trades} trades in the scored window. Treat this as a lead to test, not proof.
            </p>
          )}
          {!good && (
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-400">
              No pair is better than a coin flip at this size over this window. Try another account size or market, or tune a strategy yourself in a test.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={clsx("text-5xl font-semibold tabular-nums tracking-tight", good ? "text-tp-green" : "text-tp-yellow")}>{pct(o.pProfit)}</p>
          <p className="mt-1 text-[12px] text-zinc-400">chance of more paid out than spent</p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Figure k="Typical result" v={signed(o.medianNet)} tone={o.medianNet >= 0 ? "green" : "red"} />
        <Figure k="Bad case (1 in 10)" v={signed(o.p10)} tone="red" />
        <Figure k="Good case (1 in 10)" v={signed(o.p90)} tone="green" />
        <Figure k="Typical cost to play" v={usd(o.medianSpent)} />
        <Figure k="First payout" v={o.medianFirstPayout ? `~${o.medianFirstPayout} sessions` : "None"} />
      </div>
      <RunAsTest cell={cell} result={result} />
    </section>
  );
}

function PairDetail({ cell, result }: { cell: Cell; result: TournamentResult }) {
  const e = result.entrants.find((x) => x.id === cell.strategy)!;
  const c = cell.career;
  const o = cell.odds;
  // Where the typical, bad and good cases sit on one line.
  const lo = Math.min(o.p10, 0);
  const hi = Math.max(o.p90, 1);
  const at = (n: number) => `${((n - lo) / (hi - lo)) * 100}%`;
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <Dices className="h-3.5 w-3.5" /> {o.runs} account lives · {STRATEGIES[cell.strategy].short} × {cell.program.firm} {cell.program.program}
        </p>
        <p className="mt-3 text-[15px] text-zinc-200">
          <span className={clsx("font-semibold", TONE_TEXT[tone(o.pProfit)])}>{pct(o.pProfit)}</span> came out ahead,{" "}
          <span className="font-semibold text-zinc-50">{pct(o.pPayout)}</span> got at least one payout.
        </p>
        <div className="relative mt-6 h-10">
          <div className="absolute inset-x-0 top-4 h-1.5 rounded-full bg-white/[0.06]" />
          <div className="absolute top-4 h-1.5 rounded-full bg-gradient-to-r from-tp-red/70 via-zinc-400/50 to-tp-green/70" style={{ left: at(o.p10), right: `calc(100% - ${at(o.p90)})` }} />
          <div className="absolute top-2 h-5 w-px bg-white/40" style={{ left: at(0) }} />
          <Tick at={at(o.p10)} label={signed(o.p10)} />
          <Tick at={at(o.medianNet)} label={signed(o.medianNet)} strong />
          <Tick at={at(o.p90)} label={signed(o.p90)} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Figure k="Trades (scored)" v={String(e.stats.trades)} />
          <Figure k="Win rate" v={`${Math.round(e.stats.winRate)}%`} />
          <Figure k="Profit factor" v={Number.isFinite(e.stats.profitFactor) ? e.stats.profitFactor.toFixed(2) : "∞"} />
        </div>
        <RunAsTest cell={cell} result={result} />
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">The real window, in order</p>
        <p className="mt-3 text-[15px] text-zinc-200">
          Spent <span className="font-semibold text-zinc-50">{usd(c.spent)}</span>, paid out <span className="font-semibold text-zinc-50">{usd(c.paidOut)}</span>:{" "}
          <span className={clsx("font-semibold", c.net >= 0 ? "text-tp-green" : "text-tp-red")}>{signed(c.net)}</span>
          {c.status === "funded" && c.openProfit !== 0 && <span className="text-zinc-400"> with {signed(c.openProfit)} still in the funded account</span>}
          {c.status === "eval" && c.openProfit !== 0 && <span className="text-zinc-400"> and an eval {signed(c.openProfit)} in progress</span>}.
        </p>
        <ol className="mt-4 max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {c.events.length ? (
            c.events.map((ev, i) => <EventRow key={i} ev={ev} />)
          ) : (
            <li className="text-[13px] text-zinc-500">{c.status === "over-size" ? "This size is over the firm's contract cap." : "No sessions to trade."}</li>
          )}
        </ol>
      </div>
    </section>
  );
}

const EVENT_STYLE: Record<CareerEvent["kind"], [string, string]> = {
  bought: ["Bought account", "text-zinc-300"],
  renewed: ["Monthly renewal", "text-zinc-400"],
  "eval-failed": ["Eval failed", "text-tp-red"],
  passed: ["Eval passed", "text-tp-green"],
  blown: ["Funded account blown", "text-tp-red"],
  payout: ["Payout", "text-tp-green"],
};

function EventRow({ ev }: { ev: CareerEvent }) {
  const [label, cls] = EVENT_STYLE[ev.kind];
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-1.5 text-[13px]">
      <span className="flex items-center gap-2">
        <span className="w-14 font-mono text-[11px] text-zinc-500">{shortDate(ev.date)}</span>
        <span className={cls}>{label}</span>
      </span>
      {ev.amount > 0 && <span className={clsx("font-mono tabular-nums", ev.kind === "payout" ? "text-tp-green" : "text-zinc-400")}>{ev.kind === "payout" ? "+" : "-"}{usd(ev.amount)}</span>}
    </li>
  );
}

function RunAsTest({ cell, result }: { cell: Cell; result: TournamentResult }) {
  const add = useProvingStore((s) => s.add);
  const e = result.entrants.find((x) => x.id === cell.strategy)!;
  const start = () => {
    add({
      name: `${STRATEGIES[cell.strategy].short} · ${cell.program.firm.split(" ")[0]} ${cell.program.sizeLabel}`,
      cfg: { ...e.cfg, contracts: cell.contracts },
      programKey: cell.program.key,
      startDate: result.from,
    });
    setHistoryParams({ view: null });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-tp-green to-emerald-400 px-4 py-2.5 text-sm font-semibold text-tp-base hover:brightness-110">
        <Rocket className="h-4 w-4" /> Run it as a live test
      </button>
      <span className="flex items-center gap-1.5 text-[12px] text-zinc-500">
        <ShieldCheck className="h-3.5 w-3.5" /> Replays the scored window, then trades every new session
      </span>
    </div>
  );
}

function Tick({ at, label, strong }: { at: string; label: string; strong?: boolean }) {
  return (
    <div className="absolute top-0 -translate-x-1/2" style={{ left: at }}>
      <div className={clsx("mx-auto mt-3 h-3.5 w-3.5 rounded-full border-2 border-tp-base", strong ? "bg-white" : "bg-zinc-500")} />
      <p className={clsx("mt-1 whitespace-nowrap font-mono text-[11px] tabular-nums", strong ? "text-zinc-100" : "text-zinc-500")}>{label}</p>
    </div>
  );
}

function Figure({ k, v, tone }: { k: string; v: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]">
      <p className="text-[11px] text-zinc-500">{k}</p>
      <p className={clsx("mt-0.5 font-mono text-[15px] font-semibold tabular-nums", tone === "green" ? "text-tp-green" : tone === "red" ? "text-tp-red" : "text-zinc-100")}>{v}</p>
    </div>
  );
}

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <div className="flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-inset ring-white/[0.06]">
        {options.map((o) => (
          <button
            key={String(o.v)}
            onClick={() => onChange(o.v)}
            className={clsx("whitespace-nowrap rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition", value === o.v ? "bg-white/[0.12] text-zinc-50" : "text-zinc-400 hover:text-zinc-200")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
