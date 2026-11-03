"use client";

import clsx from "clsx";
import { Coins, Stethoscope } from "lucide-react";
import type { CoinFlipReport, DoctorReport, Side } from "@/lib/vision/doctor";
import type { BacktestSettings } from "@/store/visionStore";

const r2 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(3)}R`;
const r1 = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}R`;
const nice = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "");
const tone = (n: number) => (n > 0 ? "text-[#7CE59A]" : n < 0 ? "text-[#FFA3AB]" : "text-white/60");

/** Whether the run beats a coin flip, and what would improve it. */
export function DoctorCard({ coin, doctor, onApply }: { coin: CoinFlipReport | null; doctor: DoctorReport | null; onApply: (p: Partial<BacktestSettings>) => void }) {
  if (!coin && !doctor) return null;
  return (
    <section className="grid gap-px overflow-hidden rounded-[26px] border border-white/[0.07] bg-white/[0.06] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      {coin && <Coin c={coin} />}
      {doctor && <Doctor d={doctor} onApply={onApply} />}
    </section>
  );
}

function Coin({ c }: { c: CoinFlipReport }) {
  const lo = Math.min(c.low, c.actualR);
  const hi = Math.max(c.high, c.actualR);
  const at = (x: number) => ((x - lo) / (hi - lo || 1)) * 100;
  return (
    <div className="bg-[#121214] p-6">
      <h3 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.01em] text-white"><Coins className="h-4.5 w-4.5" /> Against a coin flip</h3>
      <p className="mt-1 text-[13.5px] leading-snug text-white/70">{c.text}</p>
      <div className="relative mt-7 h-2 rounded-full bg-white/[0.08]" role="img" aria-label={`Coin flips landed between ${r1(c.low)} and ${r1(c.high)}. This strategy made ${r1(c.actualR)}.`}>
        <span className="absolute inset-y-0 rounded-full bg-white/25" style={{ left: `${at(c.low)}%`, width: `${Math.max(1, at(c.high) - at(c.low))}%` }} />
        <span className="absolute -top-1.5 h-5 w-[3px] rounded-full bg-white" style={{ left: `${at(c.actualR)}%` }} />
        <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[12px] font-semibold tabular-nums text-white" style={{ left: `${Math.min(92, Math.max(8, at(c.actualR)))}%` }}>{r1(c.actualR)}</span>
      </div>
      <dl className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12px] tabular-nums text-white/50">
        <div>Coin flips {r1(c.low)} to {r1(c.high)}</div>
        <div>Beat {Math.round(c.beat * 100)}%</div>
        <div>All trades reversed {r1(c.oppositeR)}</div>
      </dl>
      <p className="mt-3 text-[11.5px] leading-snug text-white/40">Same {c.trades} entries, stops, targets and costs, with the side picked at random 1,000 times. Add the Coin flip strategy under Your words to test the coin by itself.</p>
    </div>
  );
}

const Pair = ({ before, after }: { before: Side; after: Side }) => (
  <span className="tabular-nums">
    <span className="text-white/45">{r2(before.avgR)}</span> <span className="text-white/30">to</span> <span className={clsx("font-semibold", tone(after.avgR))}>{r2(after.avgR)}</span>
  </span>
);

function Doctor({ d, onApply }: { d: DoctorReport; onApply: (p: Partial<BacktestSettings>) => void }) {
  return (
    <div className="bg-[#121214] p-6">
      <h3 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.01em] text-white"><Stethoscope className="h-4.5 w-4.5" /> How to improve it</h3>
      <p className="mt-1 text-[12.5px] leading-snug text-white/50">
        Tried {d.tried} changes on trades before {nice(d.splitDate)}. {d.prescriptions.length ? d.prescriptions.length === 1 ? "This one also helped on newer trades and looks too large to be luck." : `These ${d.prescriptions.length} also helped on newer trades and look too large to be luck.` : "None helped on older and newer trades by more than luck could explain, so none is offered. That's a real answer: filters can't fix a strategy with no edge."} Figures are average R per trade after costs.
      </p>
      {d.prescriptions.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {d.prescriptions.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="min-w-[200px] flex-1">
                <p className="text-[13.5px] font-medium text-white">{p.title}</p>
                <p className="text-[12px] leading-snug text-white/45">{p.why}</p>
              </div>
              <p className="text-[12.5px]"><span className="text-white/40">Newer </span><Pair before={p.newer.before} after={p.newer.after} /></p>
              {p.apply && <button onClick={() => onApply(p.apply!)} className="rounded-full bg-white/[0.09] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-white/[0.15]">Apply and re-run</button>}
            </div>
          ))}
        </div>
      )}
      {d.stacked && (
        <p className="mt-3 rounded-[14px] bg-white/[0.04] px-4 py-2.5 text-[12.5px] leading-snug text-white/70">
          {d.stacked.titles.join(", ")} together: <Pair before={d.newer} after={d.stacked.newer} /> on newer trades, {d.stacked.newer.trades} of {d.newer.trades} kept.{d.stacked.newer.avgR <= 0 ? " Better, but still no edge." : ""}
        </p>
      )}
      <div className="mt-5 grid gap-x-6 gap-y-3 border-t border-white/[0.06] pt-4 md:grid-cols-2">
        {d.tips.map((t) => (
          <div key={t.title}>
            <p className="text-[13.5px] font-medium text-white">{t.title}</p>
            <p className="text-[12px] leading-snug text-white/50">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
