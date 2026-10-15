"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { Medal } from "lucide-react";
import { INSTRUMENTS, STRATEGIES } from "@/lib/proving/engine";
import { programByKey } from "@/lib/proving/firms";
import { career, careerOdds } from "@/lib/proving/career";
import { oddsScore } from "@/lib/proving/tournament";
import type { ProvingTest } from "@/store/provingStore";

const signed = (n: number) => `${n >= 0 ? "+" : "-"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const usd = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const MIN_SESSIONS = 5;

/**
 * Each test as its own prop account, ranked by money: what its real sessions
 * paid out against what they cost, and what usually happens over three months.
 */
export function Leaderboard({ tests, selectedId, onSelect }: { tests: ProvingTest[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const rows = useMemo(
    () =>
      tests
        .map((t) => {
          const p = programByKey(t.programKey);
          if (!p) return null;
          const days = Object.values(t.days).filter((d) => d.date >= t.startDate && !d.partial);
          const size = { contracts: t.cfg.contracts, micro: INSTRUMENTS[t.cfg.instrument].micro };
          const c = career(days, p, size);
          const o = days.length >= MIN_SESSIONS ? careerOdds(days, p, size, { runs: 300 }) : null;
          return { t, p, c, o, sessions: days.length };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => (b.o ? oddsScore(b.o) : -1e9) - (a.o ? oddsScore(a.o) : -1e9)),
    [tests],
  );
  if (!rows.length) return null;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <Medal className="h-3.5 w-3.5" /> Leaderboard · each test is its own prop account
        </p>
        <p className="text-[12px] text-zinc-500">Ranked by the chance of more paid out than spent over 3 months</p>
      </div>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="w-8 pb-2 font-normal">#</th>
              <th className="pb-2 font-normal">Test</th>
              <th className="pb-2 text-right font-normal">Chance ahead</th>
              <th className="pb-2 text-right font-normal">Typical 3 mo</th>
              <th className="pb-2 text-right font-normal">Real so far</th>
              <th className="pb-2 text-right font-normal">Account</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, p, c, o, sessions }, i) => (
              <tr
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={clsx("cursor-pointer border-t border-white/[0.05] transition hover:bg-white/[0.03]", selectedId === t.id && "bg-white/[0.04]")}
              >
                <td className="py-2.5 font-mono text-[13px] text-zinc-500">{i + 1}</td>
                <td className="py-2.5">
                  <p className="flex items-center gap-2 text-[14px] font-semibold text-zinc-100">
                    <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </p>
                  <p className="pl-4 text-[12px] text-zinc-500">
                    {STRATEGIES[t.cfg.strategy].short} · {t.cfg.contracts} {t.cfg.instrument} · {p.firm} {p.program}
                  </p>
                </td>
                <td className="py-2.5 text-right">
                  {o ? (
                    <span className={clsx("font-mono text-[15px] font-semibold tabular-nums", o.pProfit >= 0.55 ? "text-tp-green" : o.pProfit >= 0.35 ? "text-tp-yellow" : "text-tp-red")}>
                      {Math.round(o.pProfit * 100)}%
                    </span>
                  ) : (
                    <span className="text-[12px] text-zinc-500">
                      {sessions}/{MIN_SESSIONS} sessions
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-right font-mono text-[13px] tabular-nums text-zinc-300">{o ? signed(o.medianNet) : "—"}</td>
                <td className="py-2.5 text-right">
                  <p className={clsx("font-mono text-[13px] tabular-nums", c.net >= 0 ? "text-tp-green" : "text-tp-red")}>{signed(c.net)}</p>
                  <p className="text-[11px] text-zinc-500">
                    {usd(c.paidOut)} paid · {usd(c.spent)} spent
                  </p>
                </td>
                <td className="py-2.5 text-right text-[12px]">
                  <span
                    className={clsx(
                      "rounded-md px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider",
                      c.status === "funded" ? "bg-tp-green/15 text-tp-green" : c.status === "over-size" || c.status === "reset" ? "bg-tp-red/15 text-tp-red" : "bg-tp-blue/15 text-tp-blue",
                    )}
                  >
                    {c.status === "over-size" ? "Over size" : c.status === "funded" ? "Funded" : c.status === "reset" ? "Blown · next queued" : "In eval"}
                  </span>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {c.accountsBought} bought · {c.payouts} payout{c.payouts === 1 ? "" : "s"}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
