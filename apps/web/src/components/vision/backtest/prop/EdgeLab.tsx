"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, FlaskConical, Loader2, Play, Repeat, Route, Shield, Sparkles, Stethoscope } from "lucide-react";
import type { Study } from "@/lib/server/library/lab";
import type { Versus, Worth } from "@/lib/vision/economics";
import { Stat, toneOf } from "./LabBits";
import type { AccountState, PropAccount } from "@/lib/vision/account";
import { accountUnits, autopsy, firmTraps, goNoGo, planLabel, simulate, type Autopsy, type FirmRow, type FirmTrap, type GoNoGo, type PlanRow, type SizingPlan } from "@/lib/vision/lab";
import { SYMBOLS, isSymbol } from "@/lib/vision/markets";
import { useVisionStore } from "@/store/visionStore";
import { Seg } from "../ui";
import { money } from "../data";

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const post = (body: unknown) => fetch("/api/library/lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));

type Job = { stage: string; done: number; total: number; error?: string } | null;

function useStudy(a: PropAccount) {
  const [study, setStudy] = useState<Study | null>(null);
  const [key, setKey] = useState("");
  const [job, setJob] = useState<Job>(null);
  const [loaded, setLoaded] = useState(false);
  const url = `/api/library/lab?program=${encodeURIComponent(a.program)}&symbol=${a.symbol}&micro=${a.micro ? 1 : 0}`;
  const refresh = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return setLoaded(true);
    const j = await r.json();
    setStudy(j.study);
    setKey(j.limitsKey ?? "");
    setJob(j.job);
    setLoaded(true);
  }, [url]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!job || job.error) return;
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [job, refresh]);
  const start = useCallback(async () => {
    const { j } = await post({ action: "study", program: a.program, symbol: a.symbol, micro: a.micro });
    setJob(j.job ?? { stage: "Getting ready", done: 0, total: 1, error: j.error });
  }, [a.program, a.symbol, a.micro]);
  return { study, job, loaded, start, limitsKey: key };
}

/** The firm's game, the strategy and size that beat it, and what went wrong when they didn't. */
export function EdgeLab({ a, s, hasData, dataTo, onSave }: { a: PropAccount; s: AccountState; hasData: boolean; dataTo?: number; onSave: (a: PropAccount) => Promise<PropAccount> }) {
  const { study, job, loaded, start, limitsKey } = useStudy(a);
  const set = useVisionStore((x) => x.set);
  const p = s.program;
  const word = isSymbol(a.symbol) ? (a.micro ? SYMBOLS[a.symbol].roots?.micro : SYMBOLS[a.symbol].roots?.full) ?? "contracts" : "contracts";
  const traps = useMemo(() => firmTraps(p), [p]);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState<"" | "trade" | "campaign">("");
  const running = !!job && !job.error;
  const done = s.status !== "active";

  const trade = async (variant: string, plan: SizingPlan) => {
    setBusy("trade");
    const { ok, j } = await post({ action: "trade", account: a, variant, plan });
    setBusy("");
    if (!ok) return setOut(j.error ?? "Couldn't trade the plan.");
    await onSave(j.account);
    setOut(j.text);
  };
  const campaign = async () => {
    setBusy("campaign");
    const { ok, j } = await post({ action: "campaign", account: a });
    setBusy("");
    if (!ok) return setOut(j.error ?? "Autopilot couldn't run.");
    await onSave(j.account);
    setOut(j.text);
  };

  // New data in the library: study again without being asked, and the log records what changed.
  const stale = !!study && ((!!dataTo && new Date(dataTo * 1000).toISOString().slice(0, 10) > study.dataTo) || !study.shootout || !study.money || (!!limitsKey && study.limitsKey !== limitsKey));
  useEffect(() => {
    if (stale && !job) void start();
  }, [stale, job, start]);

  const cur = study?.walk.current;
  const [group, setGroup] = useState<LabGroup>("money");
  const [tab, setTab] = useState<LabTab>("money");
  const pickGroup = (g: LabGroup) => {
    setGroup(g);
    setTab(TABS[g][0]);
  };
  const go = study ? goNoGo(study.walk.steps, study.coin.rate, p.cost) : null;
  const clear = !!study && !!cur && cur.odds.low >= study.coin.rate && study.walk.passRate > study.coin.rate;
  const top = study?.shootout?.[0];
  return (
    <section className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#121214]/80 backdrop-blur-2xl">
      {!loaded ? (
        <p className="p-8 text-center text-[13px] text-white/40">Looking for an earlier study…</p>
      ) : running ? (
        <div className="p-6">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-white">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding your edge
          </p>
          <p className="mt-1 text-[13px] text-white/55">{job!.stage}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${Math.min(100, (job!.done / Math.max(1, job!.total)) * 100)}%` }} />
          </div>
        </div>
      ) : !study ? (
        <div className="flex flex-wrap items-center gap-5 p-6">
          <div className="min-w-[260px] flex-1">
            <p className="text-[20px] font-semibold tracking-[-0.02em] text-white">Find your edge against {p.firm}</p>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-white/55">Tests every strategy and sizing plan on your {a.symbol} history, then shows what held up on data it hadn&apos;t seen.</p>
            {job?.error && <p className="mt-2 text-[13px] text-[#FFA3AB]">{job.error}</p>}
          </div>
          {hasData ? (
            <button onClick={start} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[14.5px] font-semibold text-black active:scale-[0.98]">
              <FlaskConical className="h-4 w-4" /> Run the study
            </button>
          ) : (
            <button onClick={() => set({ btTab: "library" })} className="rounded-full bg-white/[0.1] px-5 py-3 text-[14px] font-medium text-white">
              Add {a.symbol} data first
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-6 p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
            <div className="flex items-baseline gap-5">
              <div>
                <p className={clsx("text-[56px] font-semibold leading-none tracking-[-0.045em] tabular-nums", study.walk.passRate > study.coin.rate ? "text-white" : "text-[#FFA3AB]")}>{pct(study.walk.passRate)}</p>
                <p className="mt-1.5 text-[12.5px] text-white/50">your pass rate</p>
              </div>
              <div>
                <p className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white/40">{pct(study.coin.rate)}</p>
                <p className="mt-1.5 text-[12.5px] text-white/50">with no edge</p>
              </div>
            </div>
            <div className="min-w-0 lg:border-l lg:border-white/[0.07] lg:pl-6">
              <p className="text-[17px] font-semibold tracking-[-0.01em] text-white">{clear ? "The history clears the bar for this plan" : "The history doesn't clear the bar yet"}</p>
              {cur && (
                <p className="mt-0.5 text-[13.5px] leading-snug text-white/60">
                  {cur.variantLabel}. {planLabel(cur.plan, word)}. {study.walk.passed} of {study.walk.passed + study.walk.failed} decided attempts passed, likely range {pct(study.walk.range.low)} to {pct(study.walk.range.high)}.
                </p>
              )}
              {cur && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {!done && (
                    <button onClick={() => trade(cur.variant, cur.plan)} disabled={!!busy} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-black disabled:opacity-50">
                      {busy === "trade" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />} Trade this plan
                    </button>
                  )}
                  <button onClick={campaign} disabled={!!busy || a.trades.length > 0} title={a.trades.length ? "Autopilot starts from a clean account. Reset this one first." : undefined} className="flex items-center gap-2 rounded-full bg-white/[0.09] px-4 py-2 text-[13.5px] font-medium text-white hover:bg-white/[0.14] disabled:opacity-40">
                    {busy === "campaign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Autopilot
                  </button>
                  <button onClick={start} className="flex items-center gap-2 rounded-full px-3 py-2 text-[13.5px] font-medium text-white/55 hover:text-white">
                    <Repeat className="h-3.5 w-3.5" /> Study again
                  </button>
                </div>
              )}
              {out && <p className="mt-2.5 text-[12.5px] leading-snug text-[#9BE1FF]">{out}</p>}
            </div>
          </div>
          {study.health.status !== "normal" && study.health.status !== "unknown" && (
            <p className={clsx("mx-6 mb-4 rounded-[14px] px-4 py-2.5 text-[13px] leading-snug", study.health.status === "alarm" ? "bg-[#FF7A85]/12 text-[#FFC2C7]" : "bg-[#FFD60A]/10 text-[#FFE27A]")}>
              <strong className="font-semibold">{study.health.status === "alarm" ? "Health alarm. " : "Worth watching. "}</strong>{study.health.text}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-6 pt-4">
            <Seg size="sm" value={group} onChange={pickGroup} label="Lab section" options={[{ v: "money" as const, l: "Money" }, { v: "proof" as const, l: "Proof" }, { v: "you" as const, l: "You and the firm" }]} />
            <span className="h-5 w-px bg-white/[0.1]" />
            <div className="flex flex-wrap gap-1">
              {TABS[group].map((t) => (
                <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)} className={clsx("rounded-full px-3 py-1.5 text-[12.5px] font-medium", tab === t ? "bg-white/[0.12] text-white" : "text-white/50 hover:text-white")}>{TAB_NAME[t]}</button>
              ))}
            </div>
          </div>
          {tab === "money" && <MoneyTab study={study} current={a.program} />}
          {tab === "worth" && <WorthTab study={study} />}
          {tab === "firms" && <Shootout study={study} current={a.program} go={go!} top={top} word={word} />}
          {tab === "size" && <SizeLab study={study} word={word} />}
          {tab === "attempts" && <Attempts study={study} word={word} />}
          {tab === "stress" && <StressTab study={study} />}
          {tab === "news" && <NewsTab study={study} />}
          {tab === "patterns" && <Learned study={study} word={word} />}
          {tab === "game" && <GameTab study={study} />}
          {tab === "traps" && <Traps traps={traps} />}
          {tab === "account" && (a.trades.length > 0 ? <AccountAutopsy a={a} s={s} word={word} /> : <p className="p-6 text-[13px] text-white/50">Trade this account and it reads each attempt here: what went wrong and which change would have saved it.</p>)}
          {tab === "versus" && <VersusTab a={a} />}
        </>
      )}
    </section>
  );
}

type LabGroup = "money" | "proof" | "you";
type LabTab = "money" | "worth" | "firms" | "size" | "attempts" | "stress" | "news" | "patterns" | "game" | "traps" | "account" | "versus";
const TABS: Record<LabGroup, LabTab[]> = { money: ["money", "worth", "firms", "size"], proof: ["attempts", "stress", "news", "patterns"], you: ["account", "versus", "game", "traps"] };
const TAB_NAME: Record<LabTab, string> = { money: "Money in your pocket", worth: "Eval vs. funded", firms: "Best firm", size: "Sizing", attempts: "Attempts", stress: "Stress test", news: "News days", patterns: "Patterns", game: "The prop game", traps: "Firm's traps", account: "This account", versus: "You vs. the machine" };

function WorthRows({ rows, current }: { rows: Worth[]; current?: string }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[minmax(0,1.6fr)_82px_82px_72px_64px_78px_66px] gap-3 px-3 pb-1.5 text-[11.5px] font-medium text-white/45">
          <span />
          <span className="text-right">A year, average</span>
          <span className="text-right">Bad year</span>
          <span className="text-right">Fees</span>
          <span className="text-right">Paid out</span>
          <span className="text-right">To 1st payout</span>
          <span className="text-right">Days</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className={clsx("grid grid-cols-[minmax(0,1.6fr)_82px_82px_72px_64px_78px_66px] items-center gap-3 rounded-[12px] px-3 py-2 text-[12.5px] tabular-nums", r.key === current && "bg-white/[0.07]")}>
            <span className="min-w-0 truncate text-white/85" title={r.label}>{r.label}{r.model === "instant" && <span className="ml-1.5 text-white/40">straight to funded</span>}</span>
            <span className={clsx("text-right font-semibold", r.meanNet >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{money(r.meanNet)}</span>
            <span className="text-right text-white/55">{money(r.p10)}</span>
            <span className="text-right text-white/55">{usd(r.meanSpent)}</span>
            <span className="text-right text-white/70">{pct(r.pPayout)}</span>
            <span className="text-right text-white/55">{r.medianCostToPayout != null ? usd(r.medianCostToPayout) : "Never"}</span>
            <span className="text-right text-white/55">{r.medianDaysToPayout ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoneyTab({ study, current }: { study: Study; current: string }) {
  const top = study.money[0];
  return (
    <div className="p-6">
      <p className="text-[15px] font-semibold text-white">{top.meanNet > 0 ? `${top.label} left the most: ${money(top.meanNet)} a year on average, after every fee.` : "On these trades, no firm paid more than it cost over a year, on average."}</p>
      <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">A year of buying, resetting, activating, trading funded and taking payouts at each firm, started on many dates in your history. &quot;Paid out&quot; is the share of years with at least one payout.</p>
      <WorthRows rows={study.money} current={current} />
      <p className="mt-3 text-[11.5px] leading-snug text-white/40">{study.firmNote} Payouts: everything above one drawdown of cushion, at the firm&apos;s split. Taxes aren&apos;t counted.</p>
    </div>
  );
}

function WorthTab({ study }: { study: Study }) {
  const evals = study.riskMore.filter((r) => r.model === "eval");
  const instant = study.riskMore.filter((r) => r.model === "instant").sort((a, b) => b.meanNet - a.meanNet);
  const best = [...evals].sort((a, b) => b.meanNet - a.meanNet)[0];
  const low = evals[0];
  const topInstant = instant[0];
  return (
    <div className="p-6">
      {best ? (
        <p className="text-[15px] font-semibold text-white">
          {best === low ? "Risking more didn't help: the smallest size did best." : best.meanNet > 0 ? `Risking more paid, up to a point: ${best.label.toLowerCase()} made ${money(best.meanNet)} a year.` : `No risk level made money in a year here. ${best.label} lost least, ${usd(best.meanNet)}.`}
          {topInstant ? ` The best straight-to-funded account ${topInstant.meanNet >= 0 ? "made" : "lost"} ${usd(topInstant.meanNet)}.` : ""}
        </p>
      ) : <p className="text-[15px] font-semibold text-white">This is an instant account. Compare it with evaluations in Money in your pocket.</p>}
      <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">Each row changes only the risk during the evaluation; funded accounts stay at your funded limit. A higher size passes faster but buys more resets. These rows show which wins, in dollars.</p>
      <WorthRows rows={study.riskMore} />
    </div>
  );
}

function StressTab({ study }: { study: Study }) {
  const t = study.stress;
  return (
    <div className="p-6">
      <p className="text-[15px] font-semibold text-white">{t.verdict}</p>
      <p className="mt-0.5 text-[12.5px] text-white/50">Same plan, {pct(t.base)} pass rate as tested. {pct(t.luck)} of no-skill worlds did at least as well.</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Stat k="If the days came in another order" v={`${pct(t.shuffled.low)} to ${pct(t.shuffled.high)}`} sub={`Typically ${pct(t.shuffled.median)}`} />
        <Stat k="Random direction, same sizes" v={pct(t.noSkill.median)} sub={`Best case ${pct(t.noSkill.high)}`} />
        <Stat k="One winner in ten missed" v={pct(t.missedFills)} tone={t.missedFills < t.base * 0.7 ? "neg" : undefined} />
        {t.slippage.map((x) => <Stat key={x.ticks} k={`${x.ticks} more tick${x.ticks > 1 ? "s" : ""} of slippage`} v={pct(x.passRate)} tone={x.passRate < t.base * 0.7 ? "neg" : undefined} />)}
      </dl>
      {study.fills && (
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <p className="text-[14px] font-semibold text-white">Checked against one-second bars</p>
          <p className="mt-0.5 text-[13px] leading-snug text-white/65">{study.fills.text}</p>
          <p className="mt-1 text-[12px] tabular-nums text-white/40">{study.fills.trades} trades from {nice(study.fills.from)} to {nice(study.fills.to)}, the only stretch with one-second data. Total {study.fills.totalR >= 0 ? "+" : ""}{study.fills.totalR.toFixed(1)}R.</p>
        </div>
      )}
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <p className="text-[14px] font-semibold text-white">Strategy health</p>
        <p className="mt-0.5 text-[13px] leading-snug text-white/65">{study.health.text}</p>
        {study.health.status !== "unknown" && <p className="mt-1 text-[12px] tabular-nums text-white/40">Recent {study.health.recentR >= 0 ? "+" : ""}{study.health.recentR.toFixed(2)}R a trade, history {study.health.historyR >= 0 ? "+" : ""}{study.health.historyR.toFixed(2)}R. Losing run now {study.health.streak}, longest before {study.health.worstStreak}.</p>}
      </div>
    </div>
  );
}

function NewsTab({ study }: { study: Study }) {
  const n = study.news;
  const best = [...n.skip].sort((a, b) => b.passRate - a.passRate)[0];
  return (
    <div className="grid gap-6 p-6 md:grid-cols-2">
      <div>
        <h4 className="text-[15px] font-semibold text-white">How it does on news days</h4>
        <div className="mt-2 space-y-1.5">
          {n.rows.map((r) => (
            <p key={r.key} className="grid grid-cols-[minmax(0,1fr)_60px_56px_64px] gap-2 text-[12.5px] tabular-nums">
              <span className="truncate text-white/75">{r.label}</span>
              <span className="text-right text-white/50">{r.trades}</span>
              <span className="text-right text-white/50">{pct(r.winRate)}</span>
              <span className={clsx("text-right font-medium", r.avgR >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{r.avgR >= 0 ? "+" : ""}{r.avgR.toFixed(2)}R</span>
            </p>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-[15px] font-semibold text-white">{best.passRate > n.base + 0.02 ? `${best.label}: ${pct(best.passRate)} against ${pct(n.base)}` : "Sitting out news barely changes the pass rate"}</h4>
        <div className="mt-2 space-y-1.5">
          {n.skip.map((x) => <p key={x.key} className="flex justify-between text-[12.5px] tabular-nums"><span className="text-white/75">{x.label}</span><span className="font-medium text-white">{pct(x.passRate)}</span></p>)}
        </div>
        <p className="mt-3 text-[11.5px] text-white/40">Release dates from the St. Louis Fed. Set any of these to sit out under Limits and firm rules.</p>
      </div>
    </div>
  );
}

function GameTab({ study }: { study: Study }) {
  return (
    <div className="grid gap-x-8 gap-y-5 p-6 md:grid-cols-2">
      {study.insights.map((x) => (
        <div key={x.title}>
          <p className="text-[14.5px] font-semibold leading-snug text-white">{x.title}</p>
          <p className="mt-1 text-[13px] leading-snug text-white/60">{x.body}</p>
        </div>
      ))}
    </div>
  );
}

function VersusTab({ a }: { a: PropAccount }) {
  const [report, setReport] = useState<Versus | null | undefined>(undefined);
  useEffect(() => {
    post({ action: "versus", account: a }).then(({ j }) => setReport(j.report ?? null));
  }, [a]);
  if (report === undefined) return <p className="p-6 text-[13px] text-white/40">Comparing your trades…</p>;
  if (!report) return <p className="p-6 text-[13px] text-white/50">Trade some days by hand with I trade it, and this compares them with the plan on the same days: what you skipped, cut early or sized up, and what each habit made or cost.</p>;
  return (
    <div className="p-6">
      <p className="text-[15px] font-semibold text-white">Over the {report.days} days you traded, you {report.gap >= 0 ? "beat" : "trailed"} the machine by {usd(report.gap)}.</p>
      <dl className="mt-3 grid grid-cols-2 gap-6 md:max-w-xl">
        <Stat k="You" v={money(report.you.pnl)} tone={report.you.pnl >= 0 ? "pos" : "neg"} sub={`${report.you.trades} trades, ${pct(report.you.winRate)} wins`} />
        <Stat k="The machine, same days and size" v={money(report.machine.pnl)} tone={report.machine.pnl >= 0 ? "pos" : "neg"} sub={`${report.machine.trades} trades, ${pct(report.machine.winRate)} wins`} />
      </dl>
      <div className="mt-4 space-y-3">
        {report.leaks.map((l) => (
          <div key={l.id} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13.5px] font-medium text-white">{l.title}</p>
              <p className="text-[12.5px] leading-snug text-white/50">{l.detail}</p>
            </div>
            <span className={clsx("shrink-0 text-[14px] font-semibold tabular-nums", toneOf(l.dollars))}>{money(l.dollars)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Traps({ traps }: { traps: FirmTrap[] }) {
  return (
    <div className="grid gap-x-8 gap-y-4 p-6 md:grid-cols-2">
      {traps.map((t) => (
        <div key={t.id}>
          <p className="text-[14px] font-semibold text-white">{t.title}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">{t.how}</p>
          <p className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug text-[#9BE1FF]">
            <Shield className="mt-0.5 h-3 w-3 shrink-0" /> {t.answer}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── The same strategy at every firm ──

function Shootout({ study, current, go, top, word }: { study: Study; current: string; go: GoNoGo; top?: FirmRow; word: string }) {
  const rows = study.shootout ?? [];
  return (
    <div className="p-6">
      {top && <p className="text-[15px] font-semibold text-white">{top.key === current ? "This firm's rules suit this strategy best" : `${top.firm}'s rules suit this strategy best`}: {pct(top.odds.passRate)} against {pct(top.coin)} with no edge.</p>}
      <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">The same trades at every firm&apos;s account of this size, each with the sizing that suits its rules. Ranked by how far they beat a no-edge trader at that firm.</p>
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[minmax(0,1.3fr)_60px_60px_60px_72px_minmax(0,1.2fr)] gap-3 px-3 pb-1.5 text-[11.5px] font-medium text-white/45">
            <span>Firm</span>
            <span className="text-right">Pass</span>
            <span className="text-right">No edge</span>
            <span className="text-right">Edge</span>
            <span className="text-right">Per pass</span>
            <span>Best sizing</span>
          </div>
          {rows.map((r) => (
            <div key={r.key} className={clsx("grid grid-cols-[minmax(0,1.3fr)_60px_60px_60px_72px_minmax(0,1.2fr)] items-center gap-3 rounded-[12px] px-3 py-2 text-[12.5px] tabular-nums", r.key === current && "bg-white/[0.07]")}>
              <span className="min-w-0 truncate text-white/85" title={`${r.firm}, ${r.program}`}>{r.firm} <span className="text-white/40">{r.program}</span></span>
              <span className="text-right font-semibold text-white">{pct(r.odds.passRate)}</span>
              <span className="text-right text-white/50">{pct(r.coin)}</span>
              <span className={clsx("text-right font-semibold", r.edge > 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{r.edge > 0 ? "+" : ""}{Math.round(r.edge * 100)}</span>
              <span className="text-right text-white/60">{r.odds.costPerPass ? usd(r.odds.costPerPass) : "Never"}</span>
              <span className="min-w-0 truncate text-white/55" title={planLabel(r.plan, word)}>{planLabel(r.plan, word)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <p className="text-[15px] font-semibold text-white">Waiting for a clear signal</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">One rule, set before each attempt: start only when even the cautious estimate beats a no-edge trader.</p>
        <div className="mt-2.5 grid gap-x-8 gap-y-1 text-[13px] tabular-nums sm:grid-cols-2">
          <p className="flex justify-between gap-3"><span className="text-white/70">When it said go</span><span className="font-semibold text-white">{go.taken.passed} of {go.taken.passed + go.taken.failed} passed, {pct(go.taken.passRate)}</span></p>
          <p className="flex justify-between gap-3"><span className="text-white/70">When it said wait</span><span className="text-white/60">{go.skipped.passed} of {go.skipped.passed + go.skipped.failed} passed, {pct(go.skipped.passRate)}</span></p>
        </div>
        <p className="mt-1.5 text-[12px] text-white/40">{go.taken.attempts < 10 ? "Too few go signals to lean on yet. " : ""}Waiting would have skipped {go.skipped.attempts} attempts and {usd(go.saved)} in fees.</p>
      </div>
    </div>
  );
}

// ── Why this account passed or didn't ──

function AccountAutopsy({ a, s, word }: { a: PropAccount; s: AccountState; word: string }) {
  const report = useMemo<Autopsy | null>(() => {
    if (!isSymbol(a.symbol)) return null;
    const pv = SYMBOLS[a.symbol].pointValue;
    if (!pv) return null;
    const price = { pointValue: a.micro ? pv.micro : pv.full, fee: a.micro ? 1.04 : 3.64, micro: a.micro };
    const days = accountUnits(a.trades, price);
    const qtys = a.trades.map((t) => t.qty).sort((x, y) => x - y);
    // The sizes really traded, so this reads the attempt that happened; rescues try other sizes on the same trades.
    const plan: SizingPlan = { kind: "actual", amount: qtys[qtys.length >> 1] ?? 1, dayStop: 0, dayCap: false, coast: false };
    const att = simulate(days, s.program, plan, price, { horizon: days.length });
    return autopsy(days, 0, att, s.program, plan, price, word);
  }, [a.trades, a.symbol, a.micro, s.program, word]);
  if (!report) return null;
  const tone = s.status === "passed" ? "text-[#7CE59A]" : s.status === "blown" ? "text-[#FFA3AB]" : "text-white";
  return (
    <div className="p-6">
      <h4 className={clsx("flex items-center gap-2 text-[16px] font-semibold", tone)}>
        <Stethoscope className="h-4 w-4" /> {s.status === "passed" ? "Why this one passed" : s.status === "blown" ? "Why this one failed" : "Where this attempt stands"}
      </h4>
      <div className="mt-3 grid gap-5 lg:grid-cols-2">
        <div className="space-y-2.5">
          {report.causes.length === 0 && <p className="text-[13px] text-white/55">{s.status === "passed" ? `Target reached inside the rules. Peak profit ${usd(report.closest)}.` : "Nothing wrong yet. It keeps reading as trades come in."}</p>}
          {report.causes.map((c) => (
            <div key={c.id}>
              <p className="text-[13.5px] font-semibold text-white">{c.title}</p>
              <p className="text-[12.5px] leading-snug text-white/55">{c.detail}</p>
            </div>
          ))}
          {s.status === "passed" && report.riskShare > 0.2 && <p className="text-[12.5px] leading-snug text-[#FFD08A]">It passed, but each trade risked {pct(report.riskShare)} of the drawdown: {Math.max(1, Math.ceil(1 / report.riskShare))} losers in a row would have ended it. Don&apos;t count on repeating this at the same size.</p>}
          <p className="text-[12px] text-white/40">
            Typical trade risked {pct(report.riskShare)} of the drawdown. Longest losing run {report.streak}. Peak profit {usd(report.closest)}.
            {report.phantom > 0 ? ` Unbanked profit lifted the floor ${usd(report.phantom)}.` : ""}
          </p>
        </div>
        {report.rescues.length > 0 && (
          <div>
            <p className="text-[13.5px] font-semibold text-white">The same trades would have survived with</p>
            <div className="mt-2 space-y-1.5">
              {report.rescues.map((r) => (
                <p key={r.change} className="flex justify-between gap-3 rounded-[12px] bg-white/[0.04] px-3 py-2 text-[12.5px]">
                  <span className="text-white/80">{r.change}</span>
                  <span className={clsx("shrink-0 font-medium tabular-nums", r.result === "passed" ? "text-[#7CE59A]" : "text-white/55")}>{r.result === "passed" ? `Passes in ${r.days} days` : `Alive, ${money(r.profit)}`}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sizing ──

function RangeBar({ low, high, mid, coin }: { low: number; high: number; mid: number; coin: number }) {
  return (
    <span className="relative block h-2 w-full rounded-full bg-white/[0.06]" aria-hidden>
      <span className="absolute inset-y-0 rounded-full bg-white/25" style={{ left: `${low * 100}%`, width: `${Math.max(1, (high - low) * 100)}%` }} />
      <span className="absolute inset-y-[-2px] w-[3px] rounded-full bg-white" style={{ left: `${mid * 100}%` }} />
      <span className="absolute inset-y-[-3px] w-px bg-[#FF7A85]" style={{ left: `${coin * 100}%` }} />
    </span>
  );
}

function SizeLab({ study, word }: { study: Study; word: string }) {
  const [all, setAll] = useState(false);
  const rows = study.sizing.rows;
  const best = study.sizing.best;
  const flat = study.sizing.flat;
  const shown = all ? rows : rows.slice(0, 7);
  const edge = (r: PlanRow) => r.test.passRate - (flat?.test.passRate ?? 0);
  return (
    <div className="p-6">
      <h4 className="flex items-center gap-2 text-[16px] font-semibold text-white">
        <FlaskConical className="h-4 w-4" /> Size that beats the rules
      </h4>
      <p className="mt-1 text-[12.5px] leading-snug text-white/50">
        {study.walk.current?.variantLabel}. Plans are ranked on data before {study.sizing.splitDate ? nice(study.sizing.splitDate) : "the split"}; the newer column played no part in the ranking, so it&apos;s the one to believe. Range is the likely true pass rate, the red tick a coin-flip trader.
      </p>
      {best && flat && edge(best) > 0.02 && (
        <p className="mt-2 text-[13.5px] font-medium text-[#7CE59A]">
          Sizing alone adds {Math.round(edge(best) * 100)} points on the newer data over the best flat size, {planLabel(flat.plan, word)}.
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[minmax(0,1.5fr)_56px_56px_minmax(100px,0.8fr)_60px_76px] gap-3 px-3 pb-1.5 text-[11.5px] font-medium text-white/45">
            <span>Plan</span>
            <span className="text-right">Older</span>
            <span className="text-right">Newer</span>
            <span>Range, all years</span>
            <span className="text-right">Days</span>
            <span className="text-right">Per pass</span>
          </div>
          {shown.map((r, i) => (
            <div key={i} className={clsx("grid grid-cols-[minmax(0,1.5fr)_56px_56px_minmax(100px,0.8fr)_60px_76px] items-center gap-3 rounded-[12px] px-3 py-2 text-[12.5px] tabular-nums", i === 0 ? "bg-white/[0.07]" : "")}>
              <span className="min-w-0 truncate text-white/85" title={planLabel(r.plan, word)}>{planLabel(r.plan, word)}</span>
              <span className="text-right text-white/60">{pct(r.train.passRate)}</span>
              <span className={clsx("text-right font-semibold", r.test.passRate > study.coin.rate ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{pct(r.test.passRate)}</span>
              <RangeBar low={r.all.low} high={r.all.high} mid={r.all.passRate} coin={study.coin.rate} />
              <span className="text-right text-white/60">{r.all.medianDays ?? "—"}</span>
              <span className="text-right text-white/60">{r.all.costPerPass ? usd(r.all.costPerPass) : "Never"}</span>
            </div>
          ))}
        </div>
      </div>
      {rows.length > 7 && (
        <button onClick={() => setAll(!all)} className="mt-1 flex items-center gap-1 px-3 text-[12.5px] font-medium text-white/60 hover:text-white">
          <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", all && "rotate-180")} /> {all ? "Show fewer" : `All ${rows.length} plans`}
        </button>
      )}
    </div>
  );
}

// ── Every attempt ──

function Attempts({ study, word }: { study: Study; word: string }) {
  const steps = study.walk.steps;
  const lastFail = [...steps].reverse().find((x) => x.result !== "passed");
  const [open, setOpen] = useState<number | null>(lastFail?.n ?? steps.at(-1)?.n ?? null);
  const step = steps.find((x) => x.n === open);
  return (
    <div className="p-6">
      <h4 className="flex items-center gap-2 text-[16px] font-semibold text-white">
        <Route className="h-4 w-4" /> Every attempt, in date order
      </h4>
      <p className="mt-1 text-[12.5px] text-white/50">Each square is one attempt, chosen using only what came before it. Tap one to read it.</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {steps.map((x) => (
          <button key={x.n} onClick={() => setOpen(x.n)} aria-label={`Attempt ${x.n}, ${x.result}`} title={`${nice(x.start)}: ${x.result === "passed" ? "passed" : x.result === "floor" ? "failed" : "unfinished"}`} className={clsx("h-5 w-5 rounded-[5px]", x.result === "passed" ? "bg-[#30D158]" : x.result === "floor" ? "bg-[#FF7A85]" : "bg-white/20", open === x.n && "ring-2 ring-white ring-offset-1 ring-offset-[#121214]")} />
        ))}
      </div>
      {step && (
        <div className="mt-3 rounded-[16px] bg-white/[0.035] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={clsx("text-[15px] font-semibold", step.result === "passed" ? "text-[#7CE59A]" : step.result === "floor" ? "text-[#FFA3AB]" : "text-white")}>
              Attempt {step.n}. {step.autopsy.headline}
            </p>
            <p className="text-[12.5px] tabular-nums text-white/50">
              {nice(step.start)} to {nice(step.end)}, {money(step.profit)}
            </p>
          </div>
          <p className="mt-1 text-[12.5px] text-white/70">
            {step.variantLabel}. {planLabel(step.plan, word)}. Expected {pct(step.expected)} from history up to {nice(step.trainedTo)}.
          </p>
          <p className="mt-1 text-[12.5px] text-white/45">{step.change}</p>
          {step.autopsy.causes.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {step.autopsy.causes.map((c) => (
                <div key={c.id}>
                  <p className="text-[13px] font-medium text-white">{c.title}</p>
                  <p className="text-[12px] leading-snug text-white/50">{c.detail}</p>
                </div>
              ))}
            </div>
          )}
          {step.autopsy.rescues.length > 0 && (
            <p className="mt-2 text-[12.5px] text-[#9BE1FF]">
              Would have survived with: {step.autopsy.rescues.map((r) => r.change.toLowerCase()).join("; ")}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── What it has learned ──

function Learned({ study, word }: { study: Study; word: string }) {
  const max = Math.max(1, ...study.years.map((y) => y.passed + y.failed + y.other));
  const fails = study.walk.failed + study.walk.unfinished;
  return (
    <div className="grid gap-6 p-6 lg:grid-cols-2 2xl:grid-cols-3">
      <div className="min-w-0">
        <h4 className="text-[15px] font-semibold text-white">Year by year</h4>
        <div className="mt-2 space-y-1">
          {study.years.map((y) => (
            <div key={y.year} className="grid grid-cols-[38px_minmax(0,1fr)_44px] items-center gap-2 text-[12px] tabular-nums">
              <span className="text-white/55">{y.year}</span>
              <span className="flex h-2.5 gap-px">
                <span className="rounded-l bg-[#30D158]" style={{ width: `${(y.passed / max) * 100}%` }} />
                <span className="bg-[#FF7A85]" style={{ width: `${(y.failed / max) * 100}%` }} />
                <span className="rounded-r bg-white/20" style={{ width: `${(y.other / max) * 100}%` }} />
              </span>
              <span className="text-right text-white/55">{y.passed}/{y.passed + y.failed + y.other}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0">
        <h4 className="text-[15px] font-semibold text-white">What keeps killing attempts</h4>
        <div className="mt-2 space-y-1.5">
          {study.causes.slice(0, 6).map((c) => (
            <p key={c.id} className="flex justify-between gap-3 text-[12.5px]">
              <span className="text-white/75">{c.title}</span>
              <span className="tabular-nums text-white/50">{c.count} of {fails}</span>
            </p>
          ))}
        </div>
        {study.rescues.length > 0 && (
          <>
            <h4 className="mt-4 text-[15px] font-semibold text-white">What would have saved them</h4>
            <div className="mt-2 space-y-1.5">
              {study.rescues.map((r) => (
                <p key={r.change} className="flex justify-between gap-3 text-[12.5px]">
                  <span className="text-[#9BE1FF]">{r.change}</span>
                  <span className="tabular-nums text-white/50">{r.count}</span>
                </p>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="min-w-0 lg:col-span-2 2xl:col-span-1">
        <h4 className="text-[15px] font-semibold text-white">Strategy league</h4>
        <p className="text-[12px] text-white/45">Each variant under the current sizing plan, by its safest odds. Of {study.variants} tested, the top ones are likely flattered by being the best of many.</p>
        <div className="mt-2 space-y-1">
          {study.league.slice(0, 8).map((l) => (
            <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_40px_52px] gap-2 text-[12px] tabular-nums">
              <span className="truncate text-white/75" title={l.label}>{l.label}</span>
              <span className="text-right font-medium text-white">{pct(l.odds.passRate)}</span>
              <span className={clsx("text-right", l.expectancyR > 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{l.expectancyR >= 0 ? "+" : ""}{l.expectancyR.toFixed(2)}R</span>
            </div>
          ))}
        </div>
      </div>
      <div className="min-w-0 lg:col-span-2 2xl:col-span-3">
        <h4 className="text-[15px] font-semibold text-white">Study log</h4>
        <ol className="mt-2 space-y-1.5">
          {[...study.generations].reverse().slice(0, 6).map((g) => (
            <li key={g.at} className="flex flex-wrap justify-between gap-x-4 text-[12.5px]">
              <span className="min-w-0 text-white/70">
                {new Date(g.at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}: {g.note}
              </span>
              <span className="tabular-nums text-white/45">
                {pct(g.passRate)} over {g.attempts} attempts, {planLabel(g.plan, word)}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11.5px] leading-snug text-white/40">
          Costs: {usd(study.fee)} a contract round trip and a tick of slippage on stops and entries. Not modelled: activation fees, news bans, payout caps and fills in fast markets. {study.variants} variants tested on {study.dataFrom} to {study.dataTo}.
        </p>
      </div>
    </div>
  );
}
