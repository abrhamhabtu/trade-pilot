"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, FlaskConical, Loader2, Play, Repeat, Route, Shield, Sparkles, Stethoscope } from "lucide-react";
import type { Study } from "@/lib/server/library/lab";
import type { AccountState, PropAccount } from "@/lib/vision/account";
import { accountUnits, autopsy, firmTraps, planLabel, simulate, type Autopsy, type PlanRow, type SizingPlan } from "@/lib/vision/lab";
import { SYMBOLS, isSymbol } from "@/lib/vision/markets";
import { useVisionStore } from "@/store/visionStore";
import { money } from "../data";
import { Corridor } from "./Corridor";

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const nice = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const post = (body: unknown) => fetch("/api/library/lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));

type Job = { stage: string; done: number; total: number; error?: string } | null;

function useStudy(a: PropAccount) {
  const [study, setStudy] = useState<Study | null>(null);
  const [job, setJob] = useState<Job>(null);
  const [loaded, setLoaded] = useState(false);
  const url = `/api/library/lab?program=${encodeURIComponent(a.program)}&symbol=${a.symbol}&micro=${a.micro ? 1 : 0}`;
  const refresh = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return setLoaded(true);
    const j = await r.json();
    setStudy(j.study);
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
  return { study, job, loaded, start };
}

/** The firm's game, the strategy and size that beat it, and what went wrong when they didn't. */
export function EdgeLab({ a, s, hasData, dataTo, onSave }: { a: PropAccount; s: AccountState; hasData: boolean; dataTo?: number; onSave: (a: PropAccount) => Promise<PropAccount> }) {
  const { study, job, loaded, start } = useStudy(a);
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
  const stale = !!study && !!dataTo && new Date(dataTo * 1000).toISOString().slice(0, 10) > study.dataTo;
  useEffect(() => {
    if (stale && !job) void start();
  }, [stale, job, start]);

  const cur = study?.walk.current;
  return (
    <section className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#121214]/80 backdrop-blur-2xl">
      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* The firm's side */}
        <div className="min-w-0">
          <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white">How {p.firm} plays this</h3>
          <div className="mt-3">
            <Corridor p={p} size="lg" balance={s.balance} floor={s.threshold} />
          </div>
          <div className="mt-4 space-y-3">
            {traps.slice(0, 4).map((t) => (
              <div key={t.id}>
                <p className="text-[13.5px] font-semibold text-white">{t.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">{t.how}</p>
                <p className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug text-[#9BE1FF]">
                  <Shield className="mt-0.5 h-3 w-3 shrink-0" /> {t.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Your side */}
        <div className="min-w-0 rounded-[20px] bg-white/[0.035] p-5">
          {!loaded ? (
            <p className="py-10 text-center text-[13px] text-white/40">Looking for an earlier study…</p>
          ) : running ? (
            <div className="py-6">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
                <Loader2 className="h-4 w-4 animate-spin" /> Finding your edge
              </p>
              <p className="mt-1 text-[13px] text-white/55">{job!.stage}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${Math.min(100, (job!.done / Math.max(1, job!.total)) * 100)}%` }} />
              </div>
              <p className="mt-3 text-[12px] leading-snug text-white/40">The first study of a market runs every strategy variant through every year of your data, which takes a while. You can leave this page. After that, each firm takes moments.</p>
            </div>
          ) : !study ? (
            <div className="py-3">
              <p className="text-[20px] font-semibold tracking-[-0.02em] text-white">Find the edge against this firm</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">Runs each strategy, session and exit style through your {a.symbol} history, starts this account on hundreds of days, tries dozens of sizing plans, and tells you which held up on data it had never seen.</p>
              {job?.error && <p className="mt-3 rounded-[12px] bg-[#FF7A85]/12 px-3 py-2 text-[13px] text-[#FFA3AB]">{job.error}</p>}
              {hasData ? (
                <button onClick={start} className="mt-4 flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[14.5px] font-semibold text-black active:scale-[0.98]">
                  <FlaskConical className="h-4 w-4" /> Run the study
                </button>
              ) : (
                <button onClick={() => set({ btTab: "library" })} className="mt-4 rounded-full bg-white/[0.1] px-5 py-3 text-[14px] font-medium text-white">
                  Add {a.symbol} data in the Library first
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[13px] text-white/55">Without seeing the future, attempt by attempt since {nice(study.walk.steps[0]?.start ?? study.dataFrom)}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className={clsx("text-[52px] font-semibold leading-none tracking-[-0.04em] tabular-nums", study.walk.passRate > study.coin.rate ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{pct(study.walk.passRate)}</span>
                <span className="text-[14px] text-white/70">pass rate</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-white/60">
                {study.walk.passed} passed, {study.walk.failed} failed{study.walk.unfinished ? `, ${study.walk.unfinished} unfinished` : ""}. Likely true range {pct(study.walk.range.low)} to {pct(study.walk.range.high)}. A coin-flip trader gets {pct(study.coin.rate)}{study.walk.costPerPass ? `. About ${usd(study.walk.costPerPass)} in fees per pass` : ""}.
              </p>
              {study.walk.passRate <= study.coin.rate && <p className="mt-2 rounded-[12px] bg-[#FF7A85]/12 px-3 py-2 text-[13px] leading-snug text-[#FFC2C7]">No strategy here beats the firm yet. Don&apos;t pay for this account with these strategies: the rules have the edge. Write your own in Strategy test and run this again.</p>}
              {cur && (
                <div className="mt-4 border-t border-white/[0.07] pt-4">
                  <p className="text-[13px] text-white/55">The plan now, from everything up to {nice(study.dataTo)}</p>
                  <p className="mt-1 text-[15px] font-semibold text-white">{cur.variantLabel}</p>
                  <p className="text-[13.5px] text-white/75">{planLabel(cur.plan, word)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!done && (
                      <button onClick={() => trade(cur.variant, cur.plan)} disabled={!!busy} className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13.5px] font-semibold text-black disabled:opacity-50">
                        {busy === "trade" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />} Trade this plan
                      </button>
                    )}
                    <button onClick={campaign} disabled={!!busy || a.trades.length > 0} title={a.trades.length ? "Autopilot starts from a clean account. Reset this one first." : undefined} className="flex items-center gap-2 rounded-full bg-white/[0.1] px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-white/[0.15] disabled:opacity-40">
                      {busy === "campaign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Autopilot until it passes
                    </button>
                    <button onClick={start} className="flex items-center gap-2 rounded-full px-3 py-2.5 text-[13.5px] font-medium text-white/60 hover:text-white">
                      <Repeat className="h-4 w-4" /> Study again
                    </button>
                  </div>
                  {a.trades.length > 0 && !done && <p className="mt-2 text-[11.5px] text-white/40">Autopilot starts from a clean account. Reset this one to use it.</p>}
                  {out && <p className="mt-3 rounded-[12px] bg-[#5AC8FA]/10 px-3 py-2 text-[12.5px] leading-snug text-white/85">{out}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {a.trades.length > 0 && <AccountAutopsy a={a} s={s} word={word} />}
      {study && (
        <>
          <SizeLab study={study} word={word} />
          <Attempts study={study} word={word} />
          <Learned study={study} word={word} />
        </>
      )}
    </section>
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
    const plan: SizingPlan = { kind: "fixed", amount: qtys[qtys.length >> 1] ?? 1, dayStop: 0, dayCap: false, coast: false };
    const att = simulate(days, s.program, plan, price, { horizon: days.length });
    return autopsy(days, 0, att, s.program, plan, price, word);
  }, [a.trades, a.symbol, a.micro, s.program, word]);
  if (!report) return null;
  const tone = s.status === "passed" ? "text-[#7CE59A]" : s.status === "blown" ? "text-[#FFA3AB]" : "text-white";
  return (
    <div className="border-t border-white/[0.06] p-5">
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
    <div className="border-t border-white/[0.06] p-5">
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
    <div className="border-t border-white/[0.06] p-5">
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
    <div className="grid gap-6 border-t border-white/[0.06] p-5 lg:grid-cols-2 2xl:grid-cols-3">
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
