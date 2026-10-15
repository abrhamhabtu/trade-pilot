"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { ArrowUpRight, Pause, Play, Plus, Sparkles } from "lucide-react";
import { INSTRUMENTS, STRATEGIES, type StrategyId } from "@/lib/proving/engine";
import { programByKey, type Evaluation, type FirmProgram } from "@/lib/proving/firms";
import { careerOdds, type Career, type CareerOdds } from "@/lib/proving/career";
import { oddsScore } from "@/lib/proving/tournament";
import { testCareer, testEvaluation } from "@/lib/proving/runner";
import { RTH_CLOSE, RTH_OPEN, nyClock } from "@/lib/pilot/market";
import { MAX_RUNNING, useProvingStore, type ProvingTest } from "@/store/provingStore";
import { CompareChart } from "./charts";
import { StrategyGlyph } from "./glyphs";
import { FirmMark } from "./QuickStart";
import { TestDetail } from "./TestDetail";

const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const usd = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const MIN_PAYOUT = 500;

export interface Row {
  t: ProvingTest;
  p: FirmProgram;
  e: Evaluation | null;
  life: Career;
  odds: CareerOdds | null;
  today: number | null;
  /** What the account is working toward now, in plain words, and how far along it is. */
  goal: { label: string; remaining: number; progress: number };
}

function goalOf(life: Career, p: FirmProgram): Row["goal"] {
  const a = life.account;
  if (!a)
    return {
      label: life.status === "over-size" ? "Over the firm's size cap" : life.status === "funded" ? "Passed. Funded account opens next session" : life.status === "reset" ? "Blown. New eval next session" : "First session pending",
      remaining: 0,
      progress: life.status === "funded" ? 1 : 0,
    };
  const profit = a.balance - a.start;
  if (life.status === "funded") {
    const need = a.start + p.drawdown + MIN_PAYOUT - a.balance;
    return need <= 0 ? { label: "Payout ready", remaining: 0, progress: 1 } : { label: "to next payout", remaining: need, progress: Math.max(0, Math.min(1, profit / (p.drawdown + MIN_PAYOUT))) };
  }
  const need = p.target - profit;
  return need <= 0 ? { label: "Target hit, rules pending", remaining: 0, progress: 1 } : { label: "to pass", remaining: need, progress: Math.max(0, Math.min(1, profit / p.target)) };
}

export function useRows(tests: ProvingTest[]) {
  return useMemo(() => {
    const date = nyClock(Date.now()).date;
    const rows: Row[] = [];
    for (const t of tests) {
      const p = programByKey(t.programKey);
      const life = testCareer(t);
      if (!p || !life) continue;
      const finished = Object.values(t.days).filter((d) => d.date >= t.startDate && !d.partial);
      const odds = finished.length >= 5 ? careerOdds(finished, p, { contracts: t.cfg.contracts, micro: INSTRUMENTS[t.cfg.instrument].micro }, { runs: 300 }) : null;
      const day = t.days[date];
      rows.push({ t, p, e: testEvaluation(t), life, odds, today: day ? day.pnl : null, goal: goalOf(life, p) });
    }
    return rows.sort((a, b) => (b.odds ? oddsScore(b.odds) : -1e9) - (a.odds ? oddsScore(a.odds) : -1e9));
  }, [tests]);
}

export function TestsHome({ onNew, onTemplate }: { onNew: () => void; onTemplate: (strategy: StrategyId, programKey: string) => void }) {
  const { tests, selectedId, select, update } = useProvingStore();
  const rows = useRows(tests);
  const selected = tests.find((t) => t.id === selectedId) ?? rows[0]?.t ?? null;
  const selectedEval = selected ? rows.find((r) => r.t.id === selected.id)?.e : null;

  if (!tests.length) return <Empty onNew={onNew} onTemplate={onTemplate} />;
  const running = tests.filter((t) => t.state === "running").length;

  return (
    <div className="space-y-8">
      <Fleet rows={rows} />

      <section>
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-white">Accounts</h2>
          <p className="text-[13px] text-zinc-500">Ranked by the chance of more paid out than spent over 3 months</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r, i) => (
            <WalletCard
              key={r.t.id}
              row={r}
              rank={r.odds ? i + 1 : null}
              active={selected?.id === r.t.id}
              onClick={() => select(r.t.id)}
              onToggle={() => update(r.t.id, { state: r.t.state === "running" ? "paused" : "running" })}
              canResume={running < MAX_RUNNING}
            />
          ))}
          {running < MAX_RUNNING && (
            <button
              onClick={onNew}
              className="group grid min-h-[236px] place-items-center rounded-[28px] border border-dashed border-white/[0.1] text-zinc-500 transition duration-300 hover:border-white/25 hover:bg-white/[0.02] hover:text-zinc-200"
            >
              <span className="flex flex-col items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/[0.06] transition group-hover:scale-110 group-hover:bg-white/[0.1]">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="text-[15px] font-semibold">New test</span>
                <span className="text-[12.5px] text-zinc-600">
                  {MAX_RUNNING - running} of {MAX_RUNNING} slots free
                </span>
              </span>
            </button>
          )}
        </div>
      </section>

      {rows.length > 1 && (
        <section className="rounded-[28px] border border-white/[0.06] bg-white/[0.025] p-6 backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[22px] font-bold tracking-[-0.02em] text-white">The race</h2>
            <div className="flex flex-wrap gap-3">
              {rows.map(({ t }) => (
                <button key={t.id} onClick={() => select(t.id)} className="flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-white">
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <CompareChart series={rows.map(({ t, p, e }) => ({ id: t.id, name: t.name, color: t.color, target: p.target, points: (e?.marks ?? []).map((m) => m.balance - p.size) }))} />
        </section>
      )}

      {selected && selectedEval && (
        <section>
          <h2 className="mb-3 px-1 text-[22px] font-bold tracking-[-0.02em] text-white">{selected.name}</h2>
          <TestDetail key={selected.id} test={selected} evaluation={selectedEval} />
        </section>
      )}
    </div>
  );
}

/** Every account at a glance: today, money in and out for life, and what is closest to happening. */
function Fleet({ rows }: { rows: Row[] }) {
  const clock = nyClock(Date.now());
  const open = clock.weekday > 0 && clock.weekday < 6 && clock.minute >= RTH_OPEN && clock.minute < RTH_CLOSE;
  const live = rows.filter((r) => r.t.state === "running");
  const today = live.reduce((a, r) => a + (r.today ?? 0), 0);
  const traded = live.some((r) => r.today !== null);
  const paid = rows.reduce((a, r) => a + r.life.paidOut, 0);
  const spent = rows.reduce((a, r) => a + r.life.spent, 0);
  const best = rows.find((r) => r.odds);
  const next = live
    .filter((r) => r.goal.remaining > 0 || r.goal.label === "Payout ready")
    .sort((a, b) => a.goal.remaining - b.goal.remaining)
    .slice(0, 3);

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/[0.07] p-6 sm:p-8" style={{ background: "radial-gradient(120% 140% at 0% 0%, rgb(var(--tp-green) / 0.14), transparent 55%), radial-gradient(90% 120% at 100% 0%, rgba(124,92,255,0.16), transparent 55%), rgba(255,255,255,0.025)" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div>
          <p className="flex items-center gap-2 text-[14px] font-medium text-zinc-400">
            <span className={clsx("h-2 w-2 rounded-full", open ? "animate-pulse bg-tp-green" : "bg-zinc-500")} />
            {open ? `Trading now · ${live.length} account${live.length === 1 ? "" : "s"} live` : traded ? "Today's session" : "Market closed"}
          </p>
          <p className={clsx("mt-2 text-[56px] font-bold leading-none tracking-[-0.045em] tabular-nums sm:text-[68px]", today > 0 ? "text-tp-green" : today < 0 ? "text-tp-red" : "text-white")}>
            {traded ? signed(today) : "$0"}
          </p>
          <p className="mt-2 text-[15px] text-zinc-400">across every running test today</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:min-w-[420px]">
          <Kpi k="Paid out" v={usd(paid)} tone={paid > 0 ? "green" : undefined} />
          <Kpi k="Spent on accounts" v={usd(spent)} />
          <Kpi k="Net" v={signed(paid - spent)} tone={paid - spent >= 0 ? "green" : "red"} />
        </div>
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[22px] bg-black/20 p-4 ring-1 ring-inset ring-white/[0.05]">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Up next</p>
          <ul className="mt-2 divide-y divide-white/[0.05]">
            {next.length ? (
              next.map((r) => (
                <li key={r.t.id} className="flex items-center gap-3 py-2.5">
                  <FirmMark firmId={r.p.firmId} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-white">{r.t.name}</span>
                    <span className="block truncate text-[12.5px] text-zinc-500">{r.p.firm} · {r.p.program}</span>
                  </span>
                  <span className="text-right">
                    <span className={clsx("block text-[15px] font-semibold tabular-nums", r.goal.label === "Payout ready" ? "text-tp-green" : "text-white")}>
                      {r.goal.label === "Payout ready" ? "Payout ready" : usd(r.goal.remaining)}
                    </span>
                    {r.goal.label !== "Payout ready" && <span className="block text-[12px] text-zinc-500">{r.goal.label}</span>}
                  </span>
                </li>
              ))
            ) : (
              <li className="py-2.5 text-[14px] text-zinc-500">Nothing running. Start a test or resume one.</li>
            )}
          </ul>
        </div>
        <div className="rounded-[22px] bg-black/20 p-4 ring-1 ring-inset ring-white/[0.05]">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Best bet</p>
          {best?.odds ? (
            <div className="mt-2 flex items-center gap-4">
              <Ring value={best.odds.pProfit} size={74} stroke={7} color={best.odds.pProfit >= 0.55 ? "rgb(var(--tp-green))" : best.odds.pProfit >= 0.35 ? "rgb(var(--tp-yellow))" : "rgb(var(--tp-red))"}>
                <span className="text-[19px] font-bold tabular-nums text-white">{Math.round(best.odds.pProfit * 100)}%</span>
              </Ring>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-white">{best.t.name}</p>
                <p className="text-[13px] text-zinc-400">chance it pays you more than it costs over 3 months</p>
                <p className="mt-1 text-[13px] text-zinc-500">Typical result {signed(best.odds.medianNet)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[14px] text-zinc-500">Odds appear once a test has five finished sessions.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** One test as a card in a wallet: whose account it is, what it is chasing, how likely it is to pay. */
function WalletCard({ row, rank, active, onClick, onToggle, canResume }: { row: Row; rank: number | null; active: boolean; onClick: () => void; onToggle: () => void; canResume: boolean }) {
  const { t, p, life, odds, today, goal } = row;
  const status =
    t.state === "paused"
      ? { label: "Paused", cls: "bg-white/[0.1] text-zinc-300" }
      : life.status === "funded"
        ? { label: "Funded", cls: "bg-tp-green/20 text-tp-green" }
        : life.status === "reset"
          ? { label: "Rebuying", cls: "bg-tp-red/20 text-tp-red" }
          : life.status === "over-size"
            ? { label: "Over size", cls: "bg-tp-red/20 text-tp-red" }
            : { label: t.lastRun === 0 ? "Replaying" : "Evaluation", cls: "bg-white/[0.12] text-white" };
  const profit = life.account ? life.account.balance - life.account.start : 0;
  // Between accounts, the next one starts with its full drawdown.
  const buffer = life.account ? life.account.balance - life.account.threshold : p.drawdown;
  const bufferPct = Math.max(0, Math.min(1, buffer / p.drawdown));
  const isLive = today !== null && t.state === "running";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={clsx(
        "group relative flex min-h-[236px] cursor-pointer flex-col overflow-hidden rounded-[28px] p-5 text-left transition duration-500 ease-spring",
        active ? "-translate-y-1 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-2 ring-white/50" : "ring-1 ring-white/[0.08] hover:-translate-y-0.5 hover:ring-white/20",
      )}
      style={{ background: `radial-gradient(130% 120% at 100% 0%, ${t.color}40, transparent 55%), linear-gradient(160deg, ${t.color}1f, rgba(20,20,22,0.92) 55%)` }}
    >
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="flex items-start gap-3">
        <FirmMark firmId={p.firmId} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{p.firm}</p>
          <p className="truncate text-[12.5px] text-white/55">
            {p.program} · {p.sizeLabel}
          </p>
        </div>
        <span className={clsx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", status.cls)}>
          {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tp-red" />}
          {status.label}
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className={clsx("text-[38px] font-bold leading-none tracking-[-0.04em] tabular-nums", profit > 0 ? "text-white" : profit < 0 ? "text-tp-red" : "text-white/80")}>{signed(profit)}</p>
          <p className="mt-1.5 text-[13px] text-white/55">
            {goal.remaining > 0 ? (
              <>
                <span className="font-semibold text-white/85">{usd(goal.remaining)}</span> {goal.label}
              </>
            ) : (
              goal.label
            )}
          </p>
        </div>
        <Ring value={goal.progress} size={58} stroke={6} color={life.status === "funded" ? "rgb(var(--tp-green))" : "#fff"}>
          <span className="text-[13px] font-bold tabular-nums text-white">{Math.round(goal.progress * 100)}%</span>
        </Ring>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[11.5px] text-white/50">
          <span>Room to drawdown</span>
          <span className="tabular-nums">{usd(buffer)}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.1]">
          <div className={clsx("h-full rounded-full transition-[width] duration-700", bufferPct < 0.3 ? "bg-tp-red" : bufferPct < 0.6 ? "bg-tp-yellow" : "bg-white/80")} style={{ width: `${Math.max(3, bufferPct * 100)}%` }} />
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-4">
        <span className="h-6 w-14 opacity-90">
          <StrategyGlyph id={t.cfg.strategy} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/60">
          {STRATEGIES[t.cfg.strategy].short} · {t.cfg.contracts} {t.cfg.instrument}
          {today !== null && <span className={clsx("ml-1.5 font-semibold", today >= 0 ? "text-tp-green" : "text-tp-red")}>{signed(today)} today</span>}
        </span>
        {odds && (
          <span className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-1 text-[12px] font-semibold tabular-nums text-white" title="Chance of more paid out than spent over 3 months">
            {rank && rank <= 3 && Math.round(odds.pProfit * 100) > 0 && <span>{["🥇", "🥈", "🥉"][rank - 1]}</span>}
            {Math.round(odds.pProfit * 100)}%
          </span>
        )}
        <button
          aria-label={t.state === "running" ? "Pause test" : "Resume test"}
          disabled={t.state === "paused" && !canResume}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.1] text-white opacity-0 transition hover:bg-white/[0.2] group-hover:opacity-100 disabled:opacity-30"
        >
          {t.state === "running" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function Ring({ value, size, stroke, color, children }: { value: number; size: number; stroke: number; color: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

function Kpi({ k, v, tone }: { k: string; v: string; tone?: "green" | "red" }) {
  return (
    <div className="rounded-[20px] bg-black/25 px-4 py-3 ring-1 ring-inset ring-white/[0.05]">
      <p className="text-[12px] text-zinc-400">{k}</p>
      <p className={clsx("mt-1 text-[22px] font-bold tracking-[-0.02em] tabular-nums", tone === "green" ? "text-tp-green" : tone === "red" ? "text-tp-red" : "text-white")}>{v}</p>
    </div>
  );
}

const TEMPLATES: { strategy: StrategyId; programKey: string; pitch: string }[] = [
  { strategy: "double-break-vwap", programKey: "lucid-flex:lucidflex-50k", pitch: "Your main setup through LucidFlex: no daily loss limit and no consistency rule once funded." },
  { strategy: "vwap-pullback", programKey: "tof-instant-sim:tofis-50k", pitch: "Trend pullbacks on a Top One instant funded account, straight to payouts." },
  { strategy: "sr-retest", programKey: "futures-elite:fe-elite-50k", pitch: "Level retests through Futures Elite's Elite evaluation and its EOD drawdown." },
];

function Empty({ onNew, onTemplate }: { onNew: () => void; onTemplate: (strategy: StrategyId, programKey: string) => void }) {
  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-[32px] border border-white/[0.07] px-6 py-12 text-center sm:px-12" style={{ background: "radial-gradient(80% 120% at 50% 0%, rgb(var(--tp-green) / 0.16), transparent 60%), rgba(255,255,255,0.025)" }}>
        <Sparkles className="mx-auto h-8 w-8 text-tp-green" />
        <h2 className="mx-auto mt-4 max-w-xl text-[34px] font-bold leading-[1.05] tracking-[-0.035em] text-white sm:text-[42px]">Run your strategy through a prop firm before you pay for one.</h2>
        <p className="mx-auto mt-3 max-w-lg text-[17px] text-zinc-400">Each test is its own account: it buys the eval, gets funded, takes payouts, and tells you if it would have made you money.</p>
        <button onClick={onNew} className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[16px] font-semibold text-black transition active:scale-[0.98]">
          <Plus className="h-5 w-5" /> New test
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {TEMPLATES.map((tpl) => {
          const p = programByKey(tpl.programKey);
          if (!p) return null;
          return (
            <button key={tpl.programKey} onClick={() => onTemplate(tpl.strategy, tpl.programKey)} className="group rounded-[28px] bg-white/[0.035] p-5 text-left ring-1 ring-white/[0.07] transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06]">
              <div className="flex items-center gap-3">
                <FirmMark firmId={p.firmId} size={38} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-white">{p.firm}</p>
                  <p className="truncate text-[12.5px] text-zinc-500">
                    {p.program} · {p.sizeLabel}
                  </p>
                </div>
                <ArrowUpRight className="ml-auto h-5 w-5 text-zinc-600 transition group-hover:text-white" />
              </div>
              <div className="mt-4 h-9 w-32">
                <StrategyGlyph id={tpl.strategy} active />
              </div>
              <p className="mt-2 text-[17px] font-semibold text-white">{STRATEGIES[tpl.strategy].label}</p>
              <p className="mt-1 text-[14px] leading-snug text-zinc-400">{tpl.pitch}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
