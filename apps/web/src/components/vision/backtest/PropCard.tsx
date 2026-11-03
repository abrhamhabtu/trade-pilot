"use client";

import clsx from "clsx";
import { Building2, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { DD_LABEL } from "@/lib/proving/firms";
import type { PropReport } from "@/lib/vision/prop";
import { money } from "./data";

const VIOLET = "#BF5AF2";
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The run graded against a firm: from day one, from every start date, funded, by size and against every firm. */
export function PropCard({ report, onProgram, onSize }: { report: PropReport; onProgram: (key: string) => void; onSize: (contracts: number) => void }) {
  const p = report.program;
  const r = report.rolling;
  const f = report.funded;
  const first = report.first;
  const ring = 2 * Math.PI * 46;
  const maxSize = Math.max(0.01, ...report.sizes.map((s) => s.rolling.passRate));
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#BF5AF2]/30 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(191,90,242,0.16),rgba(18,18,20,0.9)_55%)] backdrop-blur-2xl">
      <header className="flex flex-wrap items-center gap-3 px-6 pt-5">
        <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#BF5AF2] text-white shadow-[0_12px_30px_-12px_rgba(191,90,242,0.9)]">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#E3B5FF]">Prop firm mode</p>
          <p className="truncate text-[18px] font-bold tracking-tight text-white">
            {p.firm} {p.sizeLabel} · {p.program}
          </p>
          <p className="truncate text-[12px] text-white/45">
            Target {money(p.target).replace("+", "")} · {DD_LABEL[p.ddType]} {money(p.drawdown).replace("+", "")} · DLL {p.dll ? money(p.dll).replace("+", "") : "none"} · {p.consistencyPct >= 100 ? "no consistency rule" : `${p.consistencyPct}% consistency`} · {report.contracts} {report.micro ? "micros" : "minis"}
          </p>
        </div>
      </header>

      <div className="grid gap-5 p-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Pass odds */}
        <div className="flex flex-col items-center justify-center rounded-[22px] bg-black/25 p-4 ring-1 ring-white/[0.06]">
          <svg width="124" height="124" viewBox="0 0 124 124" aria-label={`Pass odds ${pct(r.passRate)}`}>
            <circle cx="62" cy="62" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle cx="62" cy="62" r="46" fill="none" stroke="#FF7A85" strokeOpacity="0.55" strokeWidth="10" strokeDasharray={`${(r.passRate + r.failRate) * ring} ${ring}`} transform="rotate(-90 62 62)" />
            <circle cx="62" cy="62" r="46" fill="none" stroke={VIOLET} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${r.passRate * ring} ${ring}`} transform="rotate(-90 62 62)" />
            <text x="62" y="62" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="800">
              {pct(r.passRate)}
            </text>
            <text x="62" y="82" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10.5" fontWeight="600">
              PASS ODDS
            </text>
          </svg>
          <p className="mt-2 text-center text-[12px] leading-snug text-white/50">
            Started on {r.starts} different days: {r.passed} passed, {r.failed} blown{r.open ? `, ${r.open} still going` : ""}.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Stat k="Days to pass" v={r.medianDays != null ? `${r.medianDays}` : "—"} d="Median trading days" />
            <Stat k="Cost per funded" v={r.costPerPass != null ? `$${Math.round(r.costPerPass).toLocaleString("en-US")}` : "—"} d={`At $${p.cost} ${p.costCadence === "monthly" ? "a month" : "an attempt"}`} />
            <Stat k="Payout odds" v={pct(f.pPayout)} d={`Funded, ${f.horizon} sessions`} />
            <Stat k="Median net" v={money(f.medianNet)} d={`Payouts minus fees · ${pct(f.pProfit)} profit`} />
          </div>
          <div className={clsx("flex items-start gap-2.5 rounded-[18px] px-4 py-3 ring-1", first.verdict === "passed" ? "bg-[#30D158]/10 ring-[#30D158]/30" : first.verdict === "failed" ? "bg-[#FF7A85]/10 ring-[#FF7A85]/30" : "bg-white/[0.04] ring-white/[0.08]")}>
            {first.verdict === "passed" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7CE59A]" /> : first.verdict === "failed" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFA3AB]" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />}
            <div>
              <p className="text-[13.5px] font-semibold text-white">From the first day: {first.headline}</p>
              <p className="text-[12.5px] text-white/55">{first.detail}</p>
            </div>
          </div>

          {report.sizes.length > 1 && (
            <div>
              <p className="mb-2 flex items-center justify-between text-[12px] font-semibold text-white/55">
                <span>Pass odds by size ({report.micro ? "micros" : "minis"})</span>
                {report.bestSize && report.bestSize !== report.contracts && (
                  <button onClick={() => onSize(report.bestSize!)} className="rounded-full bg-[#BF5AF2] px-3 py-1 text-[12px] font-bold text-white">
                    Use {report.bestSize} and run again
                  </button>
                )}
              </p>
              <div className="flex h-[96px] items-end gap-1">
                {report.sizes.map((s) => (
                  <button
                    key={s.contracts}
                    onClick={() => onSize(s.contracts)}
                    title={`${s.contracts}: ${pct(s.rolling.passRate)} pass · ${pct(s.rolling.failRate)} blown${s.rolling.medianDays ? ` · ${s.rolling.medianDays} days` : ""}`}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <span className="text-[9.5px] tabular-nums text-white/45 opacity-0 group-hover:opacity-100">{pct(s.rolling.passRate)}</span>
                    <span className="w-full rounded-t-[4px] transition" style={{ height: `${Math.max(2, (s.rolling.passRate / maxSize) * 70)}%`, background: s.contracts === report.bestSize ? VIOLET : s.contracts === report.contracts ? "rgba(255,255,255,0.55)" : "rgba(191,90,242,0.35)" }} />
                    <span className={clsx("text-[10px] tabular-nums", s.contracts === report.contracts ? "font-bold text-white" : "text-white/40")}>{s.contracts}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-6 pb-5 pt-4">
        <p className="mb-2 text-[12px] font-semibold text-white/55">The same trades at every firm&apos;s {p.sizeLabel} {p.model === "instant" ? "instant account" : "evaluation"}</p>
        <div className="space-y-1">
          {report.firms.map((x) => (
            <button key={x.key} onClick={() => onProgram(x.key)} className={clsx("grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_64px_86px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] transition", x.key === p.key ? "bg-[#BF5AF2]/14 ring-1 ring-[#BF5AF2]/40" : "hover:bg-white/[0.04]")}>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{x.firm}</span>
                <span className="block truncate text-[11px] text-white/40">{x.program}</span>
              </span>
              <span className="relative h-2 rounded-full bg-white/[0.06]">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${x.rolling.passRate * 100}%`, background: VIOLET }} />
              </span>
              <span className="text-right font-bold tabular-nums text-white">{x.overSize ? "Over cap" : pct(x.rolling.passRate)}</span>
              <span className="text-right tabular-nums text-white/45">{x.rolling.medianDays != null ? `${x.rolling.medianDays} days` : "—"}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] leading-snug text-white/38">
          Graded with Proving Ground&apos;s evaluator: drawdown walked bar by bar with the worse of each bar&apos;s high and low first, the daily limit flattening the day, consistency and minimum days. Funded odds resample your trading days into 200 three-month lives. Firm rules change; confirm on the firm&apos;s site.
        </p>
      </div>
    </section>
  );
}

function Stat({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-[16px] bg-black/25 px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]">
      <p className="text-[11px] font-semibold text-white/45">{k}</p>
      <p className="mt-0.5 truncate text-[20px] font-bold tabular-nums text-white">{v}</p>
      <p className="truncate text-[11px] text-white/38">{d}</p>
    </div>
  );
}
