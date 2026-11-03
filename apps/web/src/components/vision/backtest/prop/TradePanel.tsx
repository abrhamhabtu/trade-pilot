"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Bot, Hand, Loader2, Play } from "lucide-react";
import { READERS, READER_ORDER, type ReaderChoice } from "@/lib/vision/analyze";
import { splitBySource, type AccountState, type PropAccount } from "@/lib/vision/account";
import { SESSION_WINDOWS, type SessionKey } from "@/lib/vision/custom";
import { gamePlan } from "@/lib/vision/economics";
import { DAY_MARGIN, FEES, riskCap } from "@/lib/vision/limits";
import { SYMBOLS, isSymbol } from "@/lib/vision/markets";
import { useVisionStore } from "@/store/visionStore";
import { Num, Seg } from "../ui";
import { timeOf } from "../data";
import { Panel, pct, signed, toneOf, usd } from "./LabBits";
import { useLimits } from "./useLab";

export type AutoRunRequest = { strategy: { logic: "vision"; reader: ReaderChoice } | { logic: "custom" }; session: SessionKey; horizon: "pass" | number };
export type AutoRunResult = { added: number; pnl: number; text: string } | { error: string };

const sdate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Today's numbers, from where the account stands and the trader's limits. */
export function GamePlanCard({ a, s }: { a: PropAccount; s: AccountState }) {
  const { limits } = useLimits();
  const [stop, setStop] = useState(a.symbol === "GC" ? 5 : a.symbol === "ES" ? 6 : 25);
  const m = isSymbol(a.symbol) ? SYMBOLS[a.symbol] : null;
  const pv = m?.pointValue ? (a.micro ? m.pointValue.micro : m.pointValue.full) : 1;
  const word = m?.roots ? (a.micro ? m.roots.micro : m.roots.full) : "contracts";
  const margin = a.phase === "live" ? DAY_MARGIN[a.symbol]?.[a.micro ? "micro" : "full"] : undefined;
  const g = gamePlan(s, { cap: riskCap(limits, a.symbol, a.phase), stopPoints: Math.max(0.1, stop), pointValue: pv, micro: a.micro, fee: a.micro ? FEES.micro : FEES.full, phase: a.phase, margin, livePct: limits.livePct, fundedConsistencyPct: limits.fundedConsistencyPct });
  return (
    <Panel className="p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="min-w-0 flex-1 text-[18px] font-semibold tracking-[-0.01em] text-white">Today&apos;s game plan</h3>
        <label className="flex items-center gap-2 text-[12.5px] text-white/55">
          With a stop of <Num value={stop} onChange={setStop} min={0.25} max={500} step={0.25} suffix="pts" width="w-24" />
        </label>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Fact k="Largest size" v={`${g.maxContracts} ${word}`} sub={`${usd(g.riskAtMax)} at risk, limit ${usd(g.maxRiskUsd)}`} />
        <Fact k="Stop for the day at" v={`-${usd(g.stopFor)}`} sub={s.program.dll ? `Firm's limit ${usd(s.program.dll)}` : "40% of your room"} />
        <Fact k={g.bestDayLimit ? "Stop making at" : "Best-day rule"} v={g.bestDayLimit ? `+${usd(g.bestDayLimit)}` : "None"} sub={g.daysAtLimit ? `${g.daysAtLimit} days like that to reach the target` : g.toTarget != null ? `${usd(g.toTarget)} to the target` : undefined} />
        <Fact k="Losses you can take" v={String(g.lossesLeft)} sub={`${usd(g.room)} of room left`} />
      </dl>
      {g.warning && <p className="mt-3 text-[13px] text-[#FFD08A]">{g.warning}</p>}
    </Panel>
  );
}

function Fact({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-white/45">{k}</dt>
      <dd className="truncate text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-white">{v}</dd>
      {sub && <dd className="text-[11.5px] leading-snug text-white/40">{sub}</dd>}
    </div>
  );
}

/** Two ways to fill the account, always labelled, each with its own record. */
export function WhoTrades({ a, s, onSave, onReplay, onAutoRun }: { a: PropAccount; s: AccountState; onSave: (a: PropAccount) => Promise<PropAccount>; onReplay: (a: PropAccount) => void; onAutoRun: (a: PropAccount, r: AutoRunRequest) => Promise<AutoRunResult> }) {
  const [who, setWho] = useState<"you" | "auto">(a.mode === "auto" ? "auto" : "you");
  const split = useMemo(() => splitBySource(a.trades), [a.trades]);
  const done = s.status !== "active";
  const pick = (x: "you" | "auto") => {
    setWho(x);
    onSave({ ...a, mode: a.mode === "both" ? "both" : x === "you" ? "manual" : "auto" });
  };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Side on={who === "you"} onClick={() => pick("you")} icon={<Hand className="h-5 w-5" />} title="I trade it" line="You watch the bars and place every trade." rec={split.you} />
      <Side on={who === "auto"} onClick={() => pick("auto")} icon={<Bot className="h-5 w-5" />} title="It trades for me" line="A strategy takes every signal by its rules." rec={split.auto} />
      <div className="md:col-span-2">
        {done ? (
          <p className="rounded-[20px] bg-white/[0.03] px-5 py-4 text-[13.5px] text-white/60">This attempt is finished. Reset it above to trade again.</p>
        ) : who === "you" ? (
          <Panel className="p-5">
            <SizePicker a={a} s={s} onSave={onSave} />
            <button onClick={() => onReplay(a)} className="mt-4 flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[14.5px] font-semibold text-black active:scale-[0.98]">
              <Hand className="h-4 w-4" /> {a.cursorT ? `Continue trading, ${timeOf(a.cursorT)}` : `Start trading, ${sdate(a.startDate)}`}
            </button>
          </Panel>
        ) : (
          <AutoRun a={a} s={s} onSave={onSave} onAutoRun={onAutoRun} />
        )}
      </div>
    </div>
  );
}

function Side({ on, onClick, icon, title, line, rec }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; line: string; rec: ReturnType<typeof splitBySource>["you"] }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={clsx("rounded-[22px] p-5 text-left transition", on ? "bg-white text-black" : "bg-[#121214]/80 text-white ring-1 ring-white/[0.08] hover:bg-white/[0.06]")}>
      <span className="flex items-center gap-2.5">
        {icon}
        <span className="text-[19px] font-semibold tracking-[-0.02em]">{title}</span>
      </span>
      <span className={clsx("mt-1 block text-[13px]", on ? "text-black/60" : "text-white/50")}>{line}</span>
      <span className={clsx("mt-3 block text-[13px] tabular-nums", on ? "text-black/75" : "text-white/70")}>
        {rec.trades ? `${rec.trades} trades over ${rec.days} days. ${signed(rec.pnl)}, ${pct(rec.winRate)} wins, ${rec.r >= 0 ? "+" : ""}${rec.r.toFixed(1)}R` : "No trades yet"}
      </span>
    </button>
  );
}

export function SizePicker({ a, s, onSave }: { a: PropAccount; s: AccountState; onSave: (a: PropAccount) => Promise<PropAccount> }) {
  const p = s.program;
  const { limits } = useLimits();
  const roots = isSymbol(a.symbol) ? SYMBOLS[a.symbol].roots : undefined;
  const firmCap = a.micro ? p.maxMicros : p.maxMinis;
  const pv = isSymbol(a.symbol) ? SYMBOLS[a.symbol].pointValue : undefined;
  const perPoint = pv ? (a.micro ? pv.micro : pv.full) * a.contracts : 0;
  const stop = a.symbol === "GC" ? 5 : a.symbol === "ES" ? 6 : 25;
  const limit = a.phase === "live" ? (p.size * limits.livePct) / 100 : p.drawdown * riskCap(limits, a.symbol, a.phase);
  const risk = a.sizing === "fixed" ? perPoint * stop : (p.size * a.riskPct) / 100;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Seg size="sm" label="Contract" value={a.micro ? 1 : 0} onChange={(v) => onSave({ ...a, micro: v === 1, contracts: Math.min(a.contracts, v === 1 ? p.maxMicros : p.maxMinis) })} options={[{ v: 1, l: roots?.micro ?? "Micro" }, { v: 0, l: roots?.full ?? "Full" }]} />
        <Seg size="sm" label="Sizing" value={a.sizing} onChange={(v) => onSave({ ...a, sizing: v })} options={[{ v: "fixed" as const, l: "Contracts" }, { v: "risk" as const, l: "% risk" }]} />
        {a.sizing === "fixed" ? <Num value={a.contracts} onChange={(c) => onSave({ ...a, contracts: Math.max(1, Math.min(firmCap, Math.round(c))) })} min={1} max={firmCap} width="w-20" /> : <Num value={a.riskPct} onChange={(r) => onSave({ ...a, riskPct: r })} min={0.1} max={5} step={0.1} suffix="%" width="w-24" />}
      </div>
      <p className={clsx("mt-2 text-[12.5px] leading-snug", risk > limit ? "text-[#FFD08A]" : "text-white/50")}>
        {a.sizing === "fixed" ? `A ${stop}-point stop risks ${usd(risk)}, ` : `Each trade risks about ${usd(risk)}, `}
        {pct(risk / Math.max(1, s.buffer))} of the room left. Your limit is {usd(limit)} a trade{risk > limit ? ": anything above it will be cut to fit" : ""}.
      </p>
    </div>
  );
}

function AutoRun({ a, s, onSave, onAutoRun }: { a: PropAccount; s: AccountState; onSave: (a: PropAccount) => Promise<PropAccount>; onAutoRun: (a: PropAccount, r: AutoRunRequest) => Promise<AutoRunResult> }) {
  const bt = useVisionStore((x) => x.bt);
  const [choice, setChoice] = useState<ReaderChoice | "custom">(bt.logic === "custom" && bt.rules ? "custom" : bt.reader);
  const [session, setSession] = useState<SessionKey>(bt.session ?? "ny");
  const [horizon, setHorizon] = useState<"pass" | number>("pass");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<AutoRunResult | null>(null);
  const run = async () => {
    setBusy(true);
    setOut(null);
    setOut(await onAutoRun(a, { strategy: choice === "custom" ? { logic: "custom" } : { logic: "vision", reader: choice }, session, horizon }));
    setBusy(false);
  };
  const sel = "w-full rounded-[12px] bg-white/[0.07] px-3 py-2.5 text-[13.5px] text-white ring-1 ring-inset ring-white/[0.08]";
  return (
    <Panel className="p-5">
      <SizePicker a={a} s={s} onSave={onSave} />
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] text-white/55">Strategy</span>
          <select value={choice} onChange={(e) => setChoice(e.target.value as ReaderChoice | "custom")} className={sel}>
            <option value="auto">Every Vision strategy</option>
            {READER_ORDER.map((r) => <option key={r} value={r}>{READERS[r].label}</option>)}
            <option value="custom" disabled={!bt.rules}>Your rules (from Strategy test){bt.rules ? "" : ", write them there first"}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] text-white/55">Session</span>
          <select value={session} onChange={(e) => setSession(e.target.value as SessionKey)} className={sel}>
            {(Object.keys(SESSION_WINDOWS) as SessionKey[]).map((k) => <option key={k} value={k}>{SESSION_WINDOWS[k].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] text-white/55">How far</span>
          <select value={String(horizon)} onChange={(e) => setHorizon(e.target.value === "pass" ? "pass" : Number(e.target.value))} className={sel}>
            <option value="pass">{a.phase === "eval" ? "Until it passes or blows" : "A year, or until it stops"}</option>
            <option value="5">Next 5 trading days</option>
            <option value="20">Next 20 trading days</option>
            <option value="60">Next 60 trading days</option>
          </select>
        </label>
        <button onClick={run} disabled={busy} className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />} {busy ? "Trading…" : "Run it"}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-white/40">Or use the lab&apos;s plan below: it picks the strategy and size for you.</p>
      {out && <p className={clsx("mt-3 text-[13px] leading-snug", "error" in out ? "text-[#FFA3AB]" : "text-[#9BE1FF]")}>{"error" in out ? out.error : out.text}</p>}
    </Panel>
  );
}

export { toneOf };
