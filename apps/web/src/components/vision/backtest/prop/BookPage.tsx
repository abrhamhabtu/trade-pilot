"use client";

import { useState } from "react";
import { Layers, Play } from "lucide-react";
import type { PortfolioStudy } from "@/lib/server/library/lab";
import { FIRM_PROGRAMS } from "@/lib/proving/firms";
import { JobBar, Panel, pct, usd } from "./LabBits";
import { labPost, useLabView } from "./useLab";

/** Why five accounts on one strategy are one bet, and whether other markets help. */
export function BookPage() {
  const [program, setProgram] = useState("topstep:topstep-50k");
  const { data, job, setJob, loaded } = useLabView<{ study: PortfolioStudy | null }>(`view=portfolio&program=${encodeURIComponent(program)}`);
  const run = async () => {
    const { j } = await labPost({ action: "portfolio", program });
    setJob(j.job);
  };
  const st = data?.study;
  return (
    <div className="space-y-5">
      <Panel>
        {job && !job.error ? (
          <JobBar job={job} title="Starting accounts together" />
        ) : (
          <div className="flex flex-wrap items-center gap-5 p-6">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/[0.07] text-white"><Layers className="h-5 w-5" /></span>
            <div className="min-w-[240px] flex-1">
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white">Several accounts at once</h3>
              <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-white/55">Copying one strategy across five accounts is one bet at five times the fee. This starts accounts on the same days and shows how often they all fail together, and whether mixing markets helps.</p>
              {job?.error && <p className="mt-1 text-[13px] text-[#FFA3AB]">{job.error}</p>}
            </div>
            <select aria-label="Account" value={program} onChange={(e) => setProgram(e.target.value)} className="max-w-[240px] rounded-[12px] bg-white/[0.07] px-3 py-2.5 text-[13px] text-white">
              {FIRM_PROGRAMS.filter((p) => p.model === "eval").map((p) => <option key={p.key} value={p.key}>{p.firm} {p.sizeLabel}, {p.program}</option>)}
            </select>
            <button onClick={run} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black"><Play className="h-3.5 w-3.5 fill-current" /> {st ? "Run again" : "Run it"}</button>
          </div>
        )}
      </Panel>
      {loaded && st && (
        <Panel className="p-6">
          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[minmax(0,1.5fr)_90px_90px_90px_80px_90px] gap-3 pb-2 text-[12px] font-medium text-white/45">
                <span>Set-up</span><span className="text-right">All fail</span><span className="text-right">One passes</span><span className="text-right">Passes per go</span><span className="text-right">Fees</span><span className="text-right">Per pass</span>
              </div>
              {st.books.map((b) => (
                <div key={b.label} className="grid grid-cols-[minmax(0,1.5fr)_90px_90px_90px_80px_90px] gap-3 border-t border-white/[0.05] py-2.5 text-[13px] tabular-nums">
                  <span className="truncate text-white/85">{b.label}</span>
                  <span className="text-right font-semibold text-[#FFA3AB]">{pct(b.allFail)}</span>
                  <span className="text-right font-semibold text-white">{pct(b.anyPass)}</span>
                  <span className="text-right text-white/70">{b.avgPasses.toFixed(2)}</span>
                  <span className="text-right text-white/60">{usd(b.cost)}</span>
                  <span className="text-right text-white/60">{b.costPerPass ? usd(b.costPerPass) : "Never"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <h4 className="text-[14px] font-semibold text-white">How much these markets move together</h4>
              <p className="text-[12px] text-white/45">Daily results of the strategies below. 0 means unrelated, 1 means the same bet.</p>
              <div className="mt-2 space-y-1 text-[13px] tabular-nums">
                {st.correlation.map((c) => <p key={c.a + c.b} className="flex justify-between"><span className="text-white/70">{c.a} and {c.b}</span><span className="font-medium text-white">{c.value.toFixed(2)}</span></p>)}
              </div>
            </div>
            <div>
              <h4 className="text-[14px] font-semibold text-white">Each market&apos;s strategy</h4>
              <div className="mt-2 space-y-1 text-[12.5px] text-white/60">{st.picks.map((x) => <p key={x.symbol}>{x.label}</p>)}</div>
            </div>
          </div>
          <p className="mt-4 text-[11.5px] leading-snug text-white/40">Check each firm&apos;s rules on copy trading and on how many accounts you may hold. Some limit both.</p>
        </Panel>
      )}
    </div>
  );
}
