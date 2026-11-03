"use client";

import clsx from "clsx";
import { CheckCircle2, ExternalLink, ShieldAlert } from "lucide-react";
import type { RiskLimits } from "@/lib/vision/limits";
import { Num, Seg } from "../ui";
import { Panel } from "./LabBits";
import { useLimits } from "./useLab";

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Your risk limits and trading hours, and how fresh each firm's rules are. Every plan reads these. */
export function LimitsPage() {
  const { limits: l, firms, save } = useLimits();
  const put = (patch: Partial<RiskLimits>) => save({ ...l, ...patch });
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="space-y-5">
        <Panel className="p-6">
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white">Risk per trade</h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">The most one trade may lose, as a share of the account&apos;s drawdown. Studies, Autopilot, strategy runs and replay all stop at these. Changing one re-runs the studies.</p>
          <div className="mt-4 space-y-3">
            <Line k="Evaluations" d="Set high on purpose, so the app can test whether risking more pays."><Num value={l.evalPct} onChange={(v) => put({ evalPct: v })} min={1} max={100} suffix="%" width="w-24" /></Line>
            <Line k="Funded accounts"><Num value={l.fundedPct} onChange={(v) => put({ fundedPct: v })} min={1} max={100} suffix="%" width="w-24" /></Line>
            <Line k="Gold, any account" d="Your limit for GC and MGC."><Num value={l.perMarket.GC ?? 100} onChange={(v) => put({ perMarket: { ...l.perMarket, GC: v } })} min={1} max={100} suffix="%" width="w-24" /></Line>
            <Line k="Live money" d="As a share of the balance, not a drawdown."><Num value={l.livePct} onChange={(v) => put({ livePct: v })} min={0.1} max={20} step={0.1} suffix="%" width="w-24" /></Line>
          </div>
        </Panel>
        <Panel className="p-6">
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white">Funded consistency</h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">The best-day rule to assume on funded accounts when working out payouts. Your best day can&apos;t be more than this share of the profit you withdraw. A firm&apos;s own stricter rule still applies.</p>
          <div className="mt-3"><Line k="Best day at most"><Num value={l.fundedConsistencyPct} onChange={(v) => put({ fundedConsistencyPct: v })} min={5} max={100} suffix="%" width="w-24" /></Line></div>
        </Panel>
        <Panel className="p-6">
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white">When you can trade</h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">A strategy that needs you at 3 am is no use if you&apos;re asleep. Results only count entries you could have taken.</p>
          <div className="mt-4 space-y-3">
            <Line k="Hours, New York time">
              <span className="flex items-center gap-2">
                <button onClick={() => put({ hours: l.hours ? null : [570, 720] })} className={clsx("rounded-full px-3 py-1.5 text-[12.5px] font-medium", l.hours ? "bg-white/[0.07] text-white/70" : "bg-white text-black")}>Any time</button>
                {l.hours && (
                  <>
                    <input aria-label="From" type="time" value={hm(l.hours[0])} onChange={(e) => e.target.value && put({ hours: [toMin(e.target.value), l.hours![1]] })} className="rounded-[10px] bg-white/[0.07] px-2 py-1.5 text-[13px] text-white [color-scheme:dark]" />
                    <input aria-label="To" type="time" value={hm(l.hours[1])} onChange={(e) => e.target.value && put({ hours: [l.hours![0], toMin(e.target.value)] })} className="rounded-[10px] bg-white/[0.07] px-2 py-1.5 text-[13px] text-white [color-scheme:dark]" />
                  </>
                )}
              </span>
            </Line>
            <Line k="Days">
              <span className="flex gap-1">
                {DAYS.map((d, i) => {
                  const on = l.weekdays.includes(i + 1);
                  return <button key={d} aria-pressed={on} onClick={() => put({ weekdays: on ? l.weekdays.filter((x) => x !== i + 1) : [...l.weekdays, i + 1].sort() })} className={clsx("rounded-full px-2.5 py-1.5 text-[12.5px] font-medium", on ? "bg-white text-black" : "bg-white/[0.06] text-white/50")}>{d}</button>;
                })}
              </span>
            </Line>
            <Line k="Sit out">
              <span className="flex gap-1">
                {(["cpi", "jobs", "fomc"] as const).map((k) => (
                  <button key={k} aria-pressed={l.skipNews[k]} onClick={() => put({ skipNews: { ...l.skipNews, [k]: !l.skipNews[k] } })} className={clsx("rounded-full px-2.5 py-1.5 text-[12.5px] font-medium", l.skipNews[k] ? "bg-white text-black" : "bg-white/[0.06] text-white/50")}>{k === "cpi" ? "CPI" : k === "jobs" ? "Jobs" : "FOMC"}</button>
                ))}
              </span>
            </Line>
          </div>
        </Panel>
      </div>
      <Panel>
        <header className="p-6 pb-3">
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white">Firm rule check</h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">Everything here is only as good as these rules, and firms change them often. Check the firm&apos;s own page before you pay.</p>
        </header>
        <div className="divide-y divide-white/[0.05]">
          {[...firms].sort((a, b) => rank(a.status) - rank(b.status) || b.ageDays - a.ageDays).map((f) => (
            <div key={f.id} className="px-6 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {f.status === "fresh" ? <CheckCircle2 className="h-4 w-4 text-[#7CE59A]" /> : <ShieldAlert className={clsx("h-4 w-4", f.status === "aging" ? "text-[#FFD08A]" : "text-[#FFA3AB]")} />}
                <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-white">{f.firm} <span className="text-white/45">{f.program}</span></p>
                <span className="text-[12px] tabular-nums text-white/45">{f.status === "unverified" ? "Never confirmed" : `Checked ${f.ageDays} days ago`}</span>
                <a href={f.url} target="_blank" rel="noreferrer" aria-label={`${f.firm} rules`} className="text-white/40 hover:text-white"><ExternalLink className="h-3.5 w-3.5" /></a>
              </div>
              {f.issues.map((x) => <p key={x} className="mt-1 pl-6 text-[12px] leading-snug text-white/50">{x}</p>)}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

const rank = (s: string) => ({ unverified: 0, stale: 1, aging: 2, fresh: 3 })[s] ?? 4;

function Line({ k, d, children }: { k: string; d?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-white/85">{k}</p>
        {d && <p className="text-[11.5px] text-white/40">{d}</p>}
      </div>
      {children}
    </div>
  );
}
