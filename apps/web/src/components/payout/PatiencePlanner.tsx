"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { patienceScenario, PatienceInputs } from "@/lib/patience";
import { useThemeClasses } from "./payoutPrimitives";

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const defaults: PatienceInputs = {
  risk: 100,
  accounts: 3,
  cushion: 2000,
  winRate: 45,
  reward: 1.5,
  trades: 2,
  split: 90,
  fees: 4,
  goal: 3000,
};

export function PatiencePlanner({
  initial = {},
}: {
  initial?: Partial<PatienceInputs>;
}) {
  const { card, text, muted, input, inset } = useThemeClasses();
  const [edits, setEdits] = useState<Partial<PatienceInputs>>({});
  const p = { ...defaults, ...initial, ...edits };
  const [view, setView] = useState<"income" | "week">("income");
  const [day, setDay] = useState(0);
  const smaller = patienceScenario(p, 0.5);
  const current = patienceScenario(p);
  const fields: {
    key: keyof PatienceInputs;
    label: string;
    min: number;
    max: number;
    step: number;
    format?: (n: number) => string;
  }[] = [
    {
      key: "risk",
      label: "Risk per trade / account",
      min: 10,
      max: 1000,
      step: 10,
      format: usd,
    },
    {
      key: "accounts",
      label: "Accounts copying the same trades",
      min: 1,
      max: 20,
      step: 1,
    },
    {
      key: "cushion",
      label: "Assumed loss cushion / account",
      min: 100,
      max: 10000,
      step: 100,
      format: usd,
    },
    {
      key: "goal",
      label: "Combined income goal",
      min: 100,
      max: 20000,
      step: 100,
      format: usd,
    },
  ];
  return (
    <section
      className={`${card} ${text} overflow-hidden`}
      aria-label="Patience planner"
    >
      <div className="p-5 sm:p-7 border-b border-white/10">
        <div className="flex items-center gap-2 text-emerald-500 text-xs font-semibold tracking-widest uppercase">
          <ShieldCheck size={16} /> Stay in the game
        </div>
        <h2 className="text-2xl sm:text-3xl tracking-tight font-semibold mt-3">
          What if you traded smaller?
        </h2>
        <p className={`${muted} text-sm mt-2 max-w-2xl`}>
          Give your edge more room to play out. Compare the same strategy at
          half the risk, with the extra time made visible.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mt-6">
          {fields.map((f) => (
            <label key={f.key} className="text-xs block">
              <span className="flex justify-between gap-3 mb-2">
                <span className={muted}>{f.label}</span>
                <strong className="tabular-nums">
                  {f.format ? f.format(p[f.key]) : p[f.key]}
                </strong>
              </span>
              <input
                className="w-full accent-emerald-500"
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={p[f.key]}
                onChange={(e) =>
                  setEdits((v) => ({ ...v, [f.key]: Number(e.target.value) }))
                }
              />
            </label>
          ))}
        </div>
      </div>
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap gap-2 mb-5" aria-label="Scenario view">
          {(["income", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm border ${view === v ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500" : "border-transparent"}`}
            >
              {v === "income"
                ? "The patient path"
                : "Walk through a rough week"}
            </button>
          ))}
        </div>
        {view === "income" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[smaller, current].map((s, i) => (
                <div
                  key={i}
                  className={`${inset} p-5 ${i === 0 ? "ring-1 ring-emerald-500/30" : ""}`}
                >
                  <p className={`${muted} text-xs uppercase tracking-wider`}>
                    {i === 0 ? "Half the size" : "Current size"}
                  </p>
                  <p className="text-3xl font-semibold tabular-nums mt-2">
                    {usd(s.risk)}
                    <span className={`${muted} text-xs font-normal`}>
                      {" "}
                      risk / account
                    </span>
                  </p>
                  <dl className="text-sm space-y-3 mt-5">
                    <div className="flex justify-between gap-3">
                      <dt className={muted}>
                        Losses before cushion is reached
                      </dt>
                      <dd className="font-semibold">{s.lossesBeforeLimit}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className={muted}>20-session model, after split*</dt>
                      <dd>{usd(s.cycle)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className={muted}>Sessions toward {usd(p.goal)}*</dt>
                      <dd>
                        {s.goalSessions === null
                          ? "No positive edge"
                          : s.goalSessions}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className={muted}>One copied loss, all accounts</dt>
                      <dd className="text-rose-400">
                        −{usd((s.risk + p.fees) * p.accounts)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <p className="text-sm mt-5">
              {smaller.daily > 0
                ? `Half size buys ${Math.max(0, smaller.lossesBeforeLimit - current.lossesBeforeLimit)} more full losses of room under a fixed cushion. The trade-off is a longer path to the same goal.`
                : "These assumptions do not produce a positive edge after fees. Increasing size or account count will not fix that."}
            </p>
          </>
        ) : (
          <div className={`${inset} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {day === 0 ? "Start of the week" : `Session ${day} of 5`}
                </h3>
                <p className={`${muted} text-xs mt-1`}>
                  −2R, −2R, no trade, +1R, +2R. Fees on each active day.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  aria-label="Previous session"
                  disabled={day === 0}
                  onClick={() => setDay((d) => d - 1)}
                  className="p-2 border border-current/20 rounded disabled:opacity-30"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  aria-label="Next session"
                  disabled={day === 5}
                  onClick={() => setDay((d) => d + 1)}
                  className="p-2 border border-current/20 rounded disabled:opacity-30"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
            {[smaller, current].map((s, i) => {
              const pnl = s.roughWeek.slice(0, day).reduce((a, b) => a + b, 0);
              const remaining = p.cushion + pnl;
              const breached = s.roughWeek
                .slice(0, day)
                .some(
                  (_, n) =>
                    p.cushion +
                      s.roughWeek.slice(0, n + 1).reduce((a, b) => a + b, 0) <=
                    0,
                );
              return (
                <div className="mt-6" key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{i === 0 ? "Half size" : "Current size"}</span>
                    <strong>
                      {breached
                        ? "Cushion breached earlier"
                        : `${usd(Math.max(0, remaining))} cushion left`}
                    </strong>
                  </div>
                  <div className="h-3 rounded bg-zinc-500/15 overflow-hidden">
                    <div
                      className={`h-full transition-all ${i === 0 ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{
                        width: `${Math.min(100, Math.max(0, (remaining / p.cushion) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p className={`${muted} text-sm mt-5`}>
              {day === 3
                ? "A no-trade day protects the cushion. Waiting is a valid decision."
                : "Both sizes experience the same sequence. Smaller risk leaves more room for the next qualified setup."}
            </p>
          </div>
        )}
        <details className="mt-5 text-xs">
          <summary className="cursor-pointer py-2">
            Edit assumptions & understand the model
          </summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {(
              [
                {
                  key: "winRate",
                  label: "Trade win rate (%)",
                  min: 0,
                  max: 100,
                  step: 1,
                },
                {
                  key: "reward",
                  label: "Average win / loss (R)",
                  min: 0,
                  max: 10,
                  step: 0.1,
                },
                {
                  key: "trades",
                  label: "Trades / session",
                  min: 1,
                  max: 20,
                  step: 1,
                },
                {
                  key: "split",
                  label: "Your profit split (%)",
                  min: 0,
                  max: 100,
                  step: 1,
                },
                {
                  key: "fees",
                  label: "Fees / round trip ($)",
                  min: 0,
                  max: 100,
                  step: 0.5,
                },
              ] as const
            ).map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  className={`${input} mt-1 w-full rounded border p-2`}
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={p[f.key]}
                  onChange={(e) =>
                    setEdits((v) => ({
                      ...v,
                      [f.key]: Math.min(
                        f.max,
                        Math.max(f.min, Number(e.target.value) || 0),
                      ),
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <button className="underline mt-3" onClick={() => setEdits({})}>
            Reset to planner inputs
          </button>
        </details>
        <p className={`${muted} text-xs leading-relaxed mt-4`}>
          *Illustrative expectancy, not a payout forecast. Assumes identical
          copied trades and a fixed remaining cushion. Trailing drawdown,
          slippage, subscriptions, resets, payout caps, eligibility and taxes
          are excluded. More accounts multiply losses too. A positive average
          does not guarantee survival or income. Changes here only explore
          scenarios.
        </p>
      </div>
    </section>
  );
}
