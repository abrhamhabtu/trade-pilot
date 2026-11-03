"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, ExternalLink, Play, Telescope } from "lucide-react";
import type { ScoutResult } from "@/lib/vision/scout";
import { Seg } from "../ui";
import { JobBar, Panel, pct } from "./LabBits";
import { labPost, useLabView } from "./useLab";

type View = { at: number | null; results: ScoutResult[]; approved: string[] };
type Show = "all" | "recommended" | "watch" | "rejected";

const TONE = { recommended: "bg-[#30D158]/15 text-[#7CE59A]", watch: "bg-[#FFD60A]/12 text-[#FFE27A]", rejected: "bg-white/[0.06] text-white/50" };
const WORD = { recommended: "Recommended", watch: "Watching", rejected: "Rejected" };

/** Ideas from research, judged on data they never saw. Nothing joins your strategies until you say so. */
export function ScoutPage() {
  const { data, job, setJob, loaded, refresh } = useLabView<View>("view=scout");
  const [show, setShow] = useState<Show>("all");
  const run = async () => {
    const { j } = await labPost({ action: "scout" });
    setJob(j.job);
  };
  const approve = async (id: string, on: boolean) => {
    await labPost({ action: "approve", id, on });
    refresh();
  };
  const res = data?.results ?? [];
  const list = res.filter((r) => show === "all" || r.verdict === show);
  const counts = { recommended: res.filter((r) => r.verdict === "recommended").length, watch: res.filter((r) => r.verdict === "watch").length, rejected: res.filter((r) => r.verdict === "rejected").length };
  return (
    <div className="space-y-5">
      <Panel>
        {job && !job.error ? (
          <JobBar job={job} title="Testing ideas on your data" />
        ) : (
          <div className="flex flex-wrap items-center gap-5 p-6">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/[0.07] text-white"><Telescope className="h-5 w-5" /></span>
            <div className="min-w-[240px] flex-1">
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-white">{counts.recommended ? `${counts.recommended} idea${counts.recommended === 1 ? "" : "s"} survived` : res.length ? "No idea has cleared the bar yet" : "Strategies you may not know"}</h3>
              <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-white/55">Ideas from papers and trading books, tested on NQ, ES and gold across your whole history. To be recommended, one has to work on old and new data alike, beat luck on the newest 30%, and pass more often than a no-edge trader. Most ideas won&apos;t.</p>
              {job?.error && <p className="mt-1 text-[13px] text-[#FFA3AB]">{job.error}</p>}
            </div>
            <button onClick={run} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black">
              <Play className="h-3.5 w-3.5 fill-current" /> {res.length ? "Run again" : "Run the scout"}
            </button>
          </div>
        )}
      </Panel>
      {!loaded ? null : res.length > 0 && (
        <Panel>
          <div className="flex flex-wrap items-center gap-3 px-6 pt-5">
            <Seg size="sm" value={show} onChange={setShow} label="Which ideas" options={[{ v: "all" as const, l: `All ${res.length}` }, { v: "recommended" as const, l: `Recommended ${counts.recommended}` }, { v: "watch" as const, l: `Watching ${counts.watch}` }, { v: "rejected" as const, l: `Rejected ${counts.rejected}` }]} />
            {data?.at && <span className="ml-auto text-[12px] text-white/40">Last run {new Date(data.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          </div>
          <div className="mt-3 divide-y divide-white/[0.05]">
            {list.map((r) => {
              const on = data!.approved.includes(r.id);
              return (
                <article key={r.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-white">{r.name}</p>
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-white/70">{r.symbol} {r.tf}</span>
                    <span className={clsx("rounded-full px-2 py-0.5 text-[11.5px] font-medium", TONE[r.verdict])}>{WORD[r.verdict]}</span>
                    <span className="flex-1" />
                    {r.verdict !== "rejected" && (
                      <button onClick={() => approve(r.id, !on)} aria-pressed={on} className={clsx("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold", on ? "bg-[#30D158] text-black" : "bg-white/[0.09] text-white hover:bg-white/[0.14]")}>
                        {on && <Check className="h-3.5 w-3.5" />} {on ? "In your strategies" : "Add to my strategies"}
                      </button>
                    )}
                  </div>
                  <p className="mt-1 max-w-3xl text-[13px] leading-snug text-white/65">{r.idea}</p>
                  <p className="mt-1.5 max-w-3xl text-[13px] leading-snug text-white">{r.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] tabular-nums text-white/50">
                    <span>Older {r.older.avgR >= 0 ? "+" : ""}{r.older.avgR.toFixed(3)}R over {r.older.trades}</span>
                    <span>Newer {r.newer.avgR >= 0 ? "+" : ""}{r.newer.avgR.toFixed(3)}R over {r.newer.trades}</span>
                    <span>t-stat {r.newer.t.toFixed(1)}</span>
                    <span>{pct(r.greenYears)} of years green</span>
                    <span>Passes {pct(r.passRate)} vs. {pct(r.coin)} no edge</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[11.5px] text-white/40">
                    {r.source}
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" aria-label="Source" className="hover:text-white"><ExternalLink className="h-3 w-3" /></a>}
                  </p>
                </article>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
