"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, FlaskConical } from "lucide-react";
import type { Trade } from "@/store/tradingStore";
import { useProvingStore } from "@/store/provingStore";
import { SETUPS, familyStats, type DayPlan, type SetupId } from "@/lib/pilot/session";
import { testEvaluation } from "@/lib/proving/runner";
import { programByKey } from "@/lib/proving/firms";
import type { StrategyId } from "@/lib/proving/engine";
import { StrategyGlyph } from "@/components/proving/glyphs";
import { Eyebrow } from "./ui";

const usd = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const ORDER: SetupId[] = ["double-break-vwap", "sr-retest", "vwap-pullback", "orb", "failed-breakout", "sr-break"];
const MAX = 3;

/** Today's playbook: which setups count as trades today, with the evidence for each. */
export function PlaybookPicker({ plan, setPlan, history }: { plan: DayPlan; setPlan: (p: Partial<DayPlan>) => void; history: Trade[] }) {
  const router = useRouter();
  const fam = useMemo(() => familyStats(history), [history]);
  const tests = useProvingStore((s) => s.tests);
  const proving = useMemo(() => {
    const m = new Map<string, { verdict: string; label: string; color: string }>();
    for (const t of tests) {
      const e = testEvaluation(t);
      const p = programByKey(t.programKey);
      if (!e || !p) continue;
      const prev = m.get(t.cfg.strategy);
      // Prefer a decided result over one still running.
      if (!prev || (prev.verdict === "active" && e.verdict !== "active"))
        m.set(t.cfg.strategy, { verdict: e.verdict, label: `${p.firm.split(" ")[0]} ${p.sizeLabel}`, color: t.color });
    }
    return m;
  }, [tests]);
  const toggle = (id: SetupId) => {
    const on = plan.setups.includes(id);
    if (!on && plan.setups.length >= MAX) return;
    setPlan({ setups: on ? plan.setups.filter((s) => s !== id) : [...plan.setups, id] });
  };
  const lead = plan.setups[0];

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Today's playbook</Eyebrow>
          <p className="mt-1 text-[15px] font-semibold text-zinc-50">
            {plan.setups.length ? (
              <>
                Trading{" "}
                {plan.setups.map((s, i) => (
                  <span key={s}>
                    {i > 0 && (i === plan.setups.length - 1 ? " and " : ", ")}
                    <span className="text-tp-green">{SETUPS[s].label}</span>
                  </span>
                ))}
                . Nothing else is a trade.
              </>
            ) : (
              "Pick up to three setups. If none of them prints, you don't trade."
            )}
          </p>
        </div>
        <span className="font-mono text-[11px] text-zinc-500">{plan.setups.length}/{MAX} chosen · first pick is your A setup</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {ORDER.map((id) => {
          const on = plan.setups.includes(id);
          const f = fam[SETUPS[id].family];
          const pv = proving.get(id);
          const blocked = !on && plan.setups.length >= MAX;
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              disabled={blocked}
              className={clsx(
                "group relative flex flex-col rounded-xl border p-3 text-left transition",
                on ? "border-tp-green/40 bg-tp-green/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]",
                blocked && "opacity-40",
              )}
            >
              <span className="flex items-center justify-between">
                {id === lead ? (
                  <span className="rounded bg-tp-green px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wider text-[#0D1628]">A setup</span>
                ) : on ? (
                  <span className="rounded bg-tp-green/15 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wider text-tp-green">In play</span>
                ) : (
                  <span />
                )}
                <span className={clsx("grid h-4 w-4 place-items-center rounded border", on ? "border-tp-green bg-tp-green text-[#0D1628]" : "border-white/20")}>
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </span>
              <StrategyGlyph id={(id === "sr-break" ? "sr-retest" : id) as StrategyId} active={on} />
              <span className="text-[13px] font-semibold text-zinc-100">{SETUPS[id].label}</span>
              <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-zinc-500">{SETUPS[id].how}</span>
              <span className="mt-2.5 block space-y-1 border-t border-white/[0.05] pt-2 font-mono text-[10.5px]">
                <span className="block text-zinc-400">
                  {f.n ? (
                    <>
                      Journal: {f.n} · {Math.round(f.winRate)}% · <span className={f.pnl >= 0 ? "text-tp-green" : "text-tp-red"}>{usd(f.pnl)}</span>
                    </>
                  ) : (
                    <span className="text-zinc-600">No journal trades yet</span>
                  )}
                </span>
                {pv ? (
                  <span className="flex items-center gap-1 truncate" style={{ color: pv.verdict === "passed" ? "#00D68F" : pv.verdict === "failed" ? "#FF4868" : pv.color }}>
                    <FlaskConical className="h-3 w-3 shrink-0" />
                    {pv.verdict === "passed" ? "Passed" : pv.verdict === "failed" ? "Failed" : "Testing"} · {pv.label}
                  </span>
                ) : id !== "sr-break" ? (
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push("/app/proving");
                    }}
                    className="flex items-center gap-1 text-zinc-600 hover:text-tp-blue"
                  >
                    <FlaskConical className="h-3 w-3" /> Prove it first
                  </span>
                ) : (
                  <span className="block text-zinc-700">Signal-only setup</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
