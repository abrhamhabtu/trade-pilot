"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { LabJobView } from "./useLab";

export const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
export const signed = (n: number) => `${n < 0 ? "-" : n > 0 ? "+" : ""}${usd(n)}`;
export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function JobBar({ job, title }: { job: NonNullable<LabJobView>; title: string }) {
  return (
    <div className="p-6">
      <p className="flex items-center gap-2 text-[16px] font-semibold text-white">
        <Loader2 className="h-4 w-4 animate-spin" /> {title}
      </p>
      <p className="mt-1 text-[13px] text-white/55">{job.stage}</p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${Math.min(100, (job.done / Math.max(1, job.total)) * 100)}%` }} />
      </div>
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={clsx("overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#121214]/80 backdrop-blur-2xl", className)}>{children}</section>;
}

export function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-white/45">{k}</p>
      <p className={clsx("truncate text-[22px] font-semibold tabular-nums tracking-[-0.02em]", tone === "pos" ? "text-[#7CE59A]" : tone === "neg" ? "text-[#FFA3AB]" : "text-white")}>{v}</p>
      {sub && <p className="text-[11.5px] leading-snug text-white/40">{sub}</p>}
    </div>
  );
}

export const toneOf = (n: number) => (n > 0 ? "text-[#7CE59A]" : n < 0 ? "text-[#FFA3AB]" : "text-white/60");
