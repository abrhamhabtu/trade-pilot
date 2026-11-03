"use client";

import { useState } from "react";
import clsx from "clsx";
import { FlaskConical, Loader2, Play, Repeat } from "lucide-react";
import type { LiveStudy } from "@/lib/server/library/lab";
import type { AccountState, PropAccount } from "@/lib/vision/account";
import type { SizingPlan } from "@/lib/vision/lab";
import { Seg } from "../ui";
import { JobBar, Panel, Stat, pct, signed, usd } from "./LabBits";
import { labPost, useLabView, useLimits } from "./useLab";

/** Your own money: what a balance can actually do, and what a firm would have done with the same trades. */
export function LiveLab({ a, s, hasData, onSave }: { a: PropAccount; s: AccountState; hasData: boolean; onSave: (a: PropAccount) => Promise<PropAccount> }) {
  const { data, job, setJob, loaded } = useLabView<{ study: LiveStudy | null }>(`view=live&symbol=${a.symbol}&micro=${a.micro ? 1 : 0}`);
  const { limits } = useLimits();
  const [cap, setCap] = useState(s.program.size);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const st = data?.study;
  const start = async () => {
    const { j } = await labPost({ action: "live-study", symbol: a.symbol, micro: a.micro });
    setJob(j.job);
  };
  const trade = async () => {
    if (!st) return;
    setBusy(true);
    const plan: SizingPlan = { kind: "room", amount: Math.min(1, ((s.program.size * limits.livePct) / 100) / Math.max(1, s.program.drawdown)), dayStop: 0, dayCap: false, coast: false };
    const { ok, j } = await labPost({ action: "trade", account: a, variant: st.variant, plan, horizon: 252 });
    setBusy(false);
    if (!ok) return setOut(j.error ?? "Couldn't trade the plan.");
    await onSave(j.account);
    setOut(j.text);
  };
  const caps = st ? [...new Set(st.table.map((r) => r.capital))] : [];
  const near = caps.includes(cap) ? cap : caps.reduce((b, x) => (Math.abs(x - s.program.size) < Math.abs(b - s.program.size) ? x : b), caps[0] ?? 0);
  const rows = st?.table.filter((r) => r.capital === near) ?? [];
  return (
    <Panel>
      {!loaded ? (
        <p className="p-8 text-center text-[13px] text-white/40">Looking for an earlier study…</p>
      ) : job && !job.error ? (
        <JobBar job={job} title="Working out what this balance can do" />
      ) : !st ? (
        <div className="flex flex-wrap items-center gap-5 p-6">
          <div className="min-w-[260px] flex-1">
            <p className="text-[20px] font-semibold tracking-[-0.02em] text-white">What could this money do?</p>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-white/55">Picks the strategy that held up on your {a.symbol} history, then compounds it from $1,000 to $50,000 at different risk levels, started on many dates.</p>
            {job?.error && <p className="mt-2 text-[13px] text-[#FFA3AB]">{job.error}</p>}
          </div>
          <button disabled={!hasData} onClick={start} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[14.5px] font-semibold text-black disabled:opacity-40"><FlaskConical className="h-4 w-4" /> Run the study</button>
        </div>
      ) : (
        <div className="p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-[240px] flex-1">
              <p className="text-[20px] font-semibold tracking-[-0.02em] text-white">{st.avgR > 0 ? st.variantLabel : "No strategy here has a clear edge yet"}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-white/55">{st.avgR > 0 ? `${st.avgR >= 0 ? "+" : ""}${st.avgR.toFixed(3)}R a trade, ${pct(st.winRate)} wins. ` : `Best so far: ${st.variantLabel}, ${st.avgR.toFixed(3)}R a trade. `}Picked on the older 70% of the data.</p>
            </div>
            {!(s.status !== "active") && <button onClick={trade} disabled={busy} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />} Let it trade a year</button>}
            <button onClick={start} className="flex items-center gap-2 rounded-full px-3 py-2 text-[13.5px] font-medium text-white/55 hover:text-white"><Repeat className="h-3.5 w-3.5" /> Study again</button>
          </div>
          {out && <p className="mt-2 text-[12.5px] leading-snug text-[#9BE1FF]">{out}</p>}
          {st.health.status === "alarm" && <p className="mt-3 rounded-[14px] bg-[#FF7A85]/12 px-4 py-2.5 text-[13px] leading-snug text-[#FFC2C7]">{st.health.text}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h4 className="flex-1 text-[15px] font-semibold text-white">A year, from every start</h4>
            <Seg size="sm" value={near} onChange={setCap} label="Starting balance" options={caps.map((c) => ({ v: c, l: usd(c) }))} />
          </div>
          <div className="mt-2 overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[110px_repeat(5,minmax(0,1fr))] gap-3 px-3 pb-1.5 text-[11.5px] font-medium text-white/45">
                <span>Risk a trade</span><span className="text-right">Typical year</span><span className="text-right">Bad year</span><span className="text-right">Worst fall</span><span className="text-right">Hit your stop</span><span className="text-right">Too small to take</span>
              </div>
              {rows.map((r) => (
                <div key={r.riskPct} className="grid grid-cols-[110px_repeat(5,minmax(0,1fr))] gap-3 rounded-[12px] px-3 py-2 text-[13px] tabular-nums odd:bg-white/[0.025]">
                  <span className="text-white/85">{r.riskPct}%</span>
                  <span className={clsx("text-right font-semibold", r.medianEnd >= near ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{signed(r.medianEnd - near)}</span>
                  <span className="text-right text-white/60">{signed(r.p10End - near)}</span>
                  <span className="text-right text-white/60">{pct(r.medianDrawdown)}</span>
                  <span className="text-right text-white/60">{pct(r.ruin)}</span>
                  <span className={clsx("text-right", r.skipped > 0.25 ? "text-[#FFD08A]" : "text-white/60")}>{pct(r.skipped)}</span>
                </div>
              ))}
            </div>
          </div>
          <dl className="mt-5 grid gap-6 border-t border-white/[0.06] pt-5 sm:grid-cols-3">
            <Stat k="Smallest balance that fits" v={usd(st.minimum.capital)} sub={`A typical stop risks ${usd(st.minimum.typicalRisk)} per contract. At ${limits.livePct}% a trade, anything less skips signals.`} />
            {st.prop && <Stat k="Same trades, best prop account" v={signed(st.prop.meanNet)} tone={st.prop.meanNet >= 0 ? "pos" : "neg"} sub={`${st.prop.label}, a year on average after ${usd(st.prop.meanSpent)} in fees. ${pct(st.prop.pProfit)} of years ended ahead.`} />}
            <Stat k="Strategy health" v={st.health.status === "normal" ? "Normal" : st.health.status === "watch" ? "Watch" : st.health.status === "alarm" ? "Alarm" : "Too few trades"} sub={st.health.text} />
          </dl>
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <h4 className="text-[15px] font-semibold text-white">Strategies, older data against newer</h4>
            <div className="mt-2 space-y-1">
              {st.league.slice(0, 6).map((l) => (
                <p key={l.id} className="grid grid-cols-[minmax(0,1fr)_56px_70px_70px] gap-2 text-[12.5px] tabular-nums">
                  <span className="truncate text-white/75" title={l.label}>{l.label}</span>
                  <span className="text-right text-white/45">{l.trades}</span>
                  <span className="text-right text-white/60">{l.olderR >= 0 ? "+" : ""}{l.olderR.toFixed(3)}R</span>
                  <span className={clsx("text-right font-medium", l.newerR >= 0 ? "text-[#7CE59A]" : "text-[#FFA3AB]")}>{l.newerR >= 0 ? "+" : ""}{l.newerR.toFixed(3)}R</span>
                </p>
              ))}
            </div>
          </div>
          <p className="mt-4 text-[11.5px] leading-snug text-white/40">A backtest, not a live feed: no real orders are placed. Assumes common day margin, $1.04 a micro or $3.64 a full contract round trip, and a tick of slippage. Taxes, data fees and overnight margin aren&apos;t counted.</p>
        </div>
      )}
    </Panel>
  );
}
