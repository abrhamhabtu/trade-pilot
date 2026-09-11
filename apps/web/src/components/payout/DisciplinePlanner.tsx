"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Minus, Plus } from "lucide-react";
import { SESSION_INSTRUMENTS } from "@/lib/sessionRisk";
import { disciplineScenario, pressurePath } from "@/lib/discipline";
import { MicroPlanState } from "./MicroSizingPlanner";
import { useThemeClasses } from "./payoutPrimitives";

const names: Record<string, string> = {
  MNQ: "Nasdaq",
  MES: "S&P 500",
  MGC: "Gold",
  MYM: "Dow",
  MBT: "Bitcoin",
  M2K: "Russell",
};
const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
export interface DisciplineSettings {
  goal: number;
  cushion: number;
  fees: number;
  slippageTicks: number;
}
interface Props {
  view: "plan" | "stress";
  micro: MicroPlanState;
  onMicro: (p: Partial<MicroPlanState>) => void;
  accounts: number;
  onAccounts: (n: number) => void;
  settings: DisciplineSettings;
  onSettings: (p: Partial<DisciplineSettings>) => void;
  strategy: {
    winRatePercent: number;
    rewardToRisk: number;
    tradesPerDay: number;
  };
  onStrategy: (p: Partial<Props["strategy"]>) => void;
  split: number;
  onView: (view: "path" | "stress" | "withdraw") => void;
}

export function DisciplinePlanner({
  view,
  micro,
  onMicro,
  accounts,
  onAccounts,
  settings,
  onSettings,
  strategy,
  onStrategy,
  split,
  onView,
}: Props) {
  const { text, muted, input, dark } = useThemeClasses();
  const [day, setDay] = useState(0);
  const [sequence, setSequence] = useState<"rough" | "streak">("rough");
  const instrument =
    SESSION_INSTRUMENTS[micro.symbol as keyof typeof SESSION_INSTRUMENTS];
  const model = {
    contracts: micro.contracts,
    stop: micro.stopPts,
    pointValue: instrument?.pointValue ?? 0,
    tick: instrument?.tick ?? 0,
    accounts,
    ...settings,
    winRate: strategy.winRatePercent,
    reward: strategy.rewardToRisk,
    trades: strategy.tradesPerDay,
    split,
  };
  const current = disciplineScenario(model);
  const smaller = disciplineScenario(
    model,
    Math.max(1, Math.floor(micro.contracts / 2)),
  );
  const panel = dark
    ? "bg-[#101c2b] border-white/10"
    : "bg-white border-gray-200";
  const smallLabel =
    smaller?.contracts === current?.contracts
      ? "Minimum whole contract"
      : "Smaller size";
  const pathSequence =
    sequence === "rough" ? [-1, -1, 0, 1, -1, 1] : [-1, -1, -1, -1, -1, -1];
  const num = (v: string, min: number, max: number) =>
    Math.min(max, Math.max(min, Number(v) || min));
  return (
    <section
      className={`${text} border ${panel} rounded-xl overflow-hidden`}
      aria-label="Discipline payout planner"
    >
      <div className="grid xl:grid-cols-[300px_minmax(0,1fr)]">
        <div
          className={`p-5 sm:p-6 xl:border-r border-zinc-500/20 ${dark ? "bg-black/10" : "bg-gray-50"}`}
        >
          <p
            className={`${muted} text-[10px] tracking-[0.2em] uppercase font-semibold`}
          >
            01 / Your repeatable plan
          </p>
          <div
            className="grid grid-cols-3 gap-2 mt-5"
            aria-label="Choose instrument"
          >
            {Object.entries(names).map(([symbol, name]) => (
              <button
                key={symbol}
                onClick={() => onMicro({ symbol })}
                aria-pressed={micro.symbol === symbol}
                className={`border rounded-lg px-2 py-3 text-left transition-colors ${micro.symbol === symbol ? "border-emerald-400 bg-emerald-400/10" : "border-zinc-500/20 hover:border-zinc-400/60"}`}
              >
                <span className="font-semibold text-sm block">{symbol}</span>
                <span className={`${muted} text-[10px]`}>{name}</span>
              </button>
            ))}
          </div>
          {micro.symbol === "MBT" && (
            <p className="text-xs text-amber-500 mt-3">
              CME Micro Bitcoin · 0.1 BTC/contract. Not spot Bitcoin or other
              exchanges’ contracts. Check firm availability.
            </p>
          )}
          <div className="flex items-center justify-between gap-3 mt-6">
            <div>
              <p className="text-sm font-medium">Contracts / account</p>
              <p className={`${muted} text-xs mt-1`}>Whole contracts only</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Decrease contracts"
                disabled={micro.contracts <= 1}
                className="border border-zinc-500/30 rounded-md p-2 disabled:opacity-30"
                onClick={() =>
                  onMicro({ contracts: Math.max(1, micro.contracts - 1) })
                }
              >
                <Minus size={15} />
              </button>
              <span className="font-mono font-semibold w-6 text-center">
                {micro.contracts}
              </span>
              <button
                aria-label="Increase contracts"
                disabled={micro.contracts >= 50}
                className="border border-zinc-500/30 rounded-md p-2 disabled:opacity-30"
                onClick={() => onMicro({ contracts: micro.contracts + 1 })}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <label className="text-xs">
              Stop distance (points)
              <input
                className={`${input} w-full rounded-md p-2.5 mt-2`}
                type="number"
                min={instrument?.tick ?? 0.1}
                step={instrument?.tick ?? 0.1}
                value={micro.stopPts}
                onChange={(e) =>
                  onMicro({
                    stopPts: num(
                      e.target.value,
                      instrument?.tick ?? 0.1,
                      100000,
                    ),
                  })
                }
              />
            </label>
            <label className="text-xs">
              Copied accounts
              <input
                className={`${input} w-full rounded-md p-2.5 mt-2`}
                type="number"
                min="1"
                max="50"
                step="1"
                value={accounts}
                onChange={(e) =>
                  onAccounts(Math.floor(num(e.target.value, 1, 50)))
                }
              />
            </label>
            <label className="text-xs">
              Combined income goal ($)
              <input
                className={`${input} w-full rounded-md p-2.5 mt-2`}
                type="number"
                min="1"
                step="100"
                value={settings.goal}
                onChange={(e) =>
                  onSettings({ goal: num(e.target.value, 1, 1000000) })
                }
              />
            </label>
            <label className="text-xs">
              Assumed cushion / account ($)
              <input
                className={`${input} w-full rounded-md p-2.5 mt-2`}
                type="number"
                min="1"
                step="100"
                value={settings.cushion}
                onChange={(e) =>
                  onSettings({ cushion: num(e.target.value, 1, 1000000) })
                }
              />
            </label>
          </div>
          <details className="mt-5 border-t border-zinc-500/20 pt-3">
            <summary className="text-xs font-medium cursor-pointer py-2">
              Costs & strategy assumptions
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {(
                [
                  ["fees", "Fees / contract ($)", settings.fees, 0, 1000, 0.01],
                  [
                    "slippageTicks",
                    "Slippage (ticks)",
                    settings.slippageTicks,
                    0,
                    1000,
                    1,
                  ],
                  [
                    "winRatePercent",
                    "Win rate (%)",
                    strategy.winRatePercent,
                    0,
                    100,
                    1,
                  ],
                  [
                    "rewardToRisk",
                    "Average win (R)",
                    strategy.rewardToRisk,
                    0.1,
                    10,
                    0.1,
                  ],
                  [
                    "tradesPerDay",
                    "Trades / session",
                    strategy.tradesPerDay,
                    1,
                    20,
                    1,
                  ],
                ] as const
              ).map(([key, label, value, min, max, step]) => (
                <label key={key} className="text-xs">
                  {label}
                  <input
                    type="number"
                    className={`${input} w-full rounded-md p-2 mt-1`}
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => {
                      const v = num(e.target.value, min, max);
                      if (key === "fees" || key === "slippageTicks")
                        onSettings({
                          [key]: key === "slippageTicks" ? Math.floor(v) : v,
                        });
                      else onStrategy({ [key]: v });
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
          <p className={`${muted} text-[11px] leading-relaxed mt-4`}>
            {strategy.winRatePercent}% wins · {strategy.rewardToRisk}R winners ·{" "}
            {strategy.tradesPerDay} trades/session · {split}% split. Costs are
            estimates. The cushion here is a scenario, not live account health.
          </p>
        </div>
        <div className="min-w-0 p-5 sm:p-8">
          {!current || !smaller ? (
            <p role="alert">
              Check the inputs to calculate a valid whole-contract scenario.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap justify-between items-center gap-3">
                <p
                  className={`${muted} text-[10px] tracking-[0.2em] uppercase font-semibold`}
                >
                  {view === "plan"
                    ? "02 / Make patience visible"
                    : "02 / See a difficult stretch"}
                </p>
                <span className="font-mono text-[10px] rounded-md border border-zinc-500/30 px-2 py-1">
                  ILLUSTRATION · NOT A FORECAST
                </span>
              </div>
              {view === "plan" ? (
                <>
                  <div className="mt-7">
                    <p className={`${muted} text-sm`}>
                      One stopout across {accounts} account
                      {accounts === 1 ? "" : "s"}
                    </p>
                    <p className="font-mono text-5xl sm:text-6xl tracking-tighter mt-2">
                      {usd(current.copiedLoss)}
                      <span className="text-lg text-rose-400 ml-2">
                        at risk
                      </span>
                    </p>
                    <p className={`${muted} mt-3 text-xs`}>
                      {usd(current.loss)} / account, including estimated fees
                      and slippage. Same trade, multiplied exposure.
                    </p>
                  </div>
                  <div className="mt-8 grid grid-cols-2 border-y border-zinc-500/20 py-5 gap-4">
                    <div>
                      <p className={`${muted} text-xs`}>
                        {smallLabel} · {smaller.contracts} {micro.symbol}
                      </p>
                      <p className="text-3xl font-mono mt-2 text-emerald-500">
                        {smaller.losses}
                        <span className={`${muted} text-xs ml-2`}>losses</span>
                      </p>
                      <p className={`${muted} text-xs mt-2`}>
                        before a fixed cushion is reached
                      </p>
                    </div>
                    <div className="border-l border-zinc-500/20 pl-4">
                      <p className={`${muted} text-xs`}>
                        Current size · {current.contracts} {micro.symbol}
                      </p>
                      <p className="text-3xl font-mono mt-2">
                        {current.losses}
                        <span className={`${muted} text-xs ml-2`}>losses</span>
                      </p>
                      <p className={`${muted} text-xs mt-2`}>
                        before the same boundary
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-5">
                    {[smaller, current].map((s, i) => (
                      <div key={i}>
                        <div className="flex flex-wrap justify-between gap-2 text-xs">
                          <span>
                            {i === 0 ? smallLabel : "Current size"} ·
                            after-split 20-session model
                          </span>
                          <span className="font-mono font-semibold">
                            {usd(s.cycle)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded bg-zinc-500/20 mt-2">
                          <div
                            className={`h-full rounded transition-[width] motion-reduce:transition-none ${i === 0 ? "bg-emerald-400" : "bg-zinc-400"}`}
                            style={{
                              width: `${Math.max(0, Math.min(100, (s.cycle / settings.goal) * 100))}%`,
                            }}
                          />
                        </div>
                        <p className={`${muted} text-[11px] mt-2`}>
                          {s.sessions === null
                            ? "No positive expectancy after costs. More size cannot repair it."
                            : `${s.sessions} modeled sessions toward ${usd(settings.goal)} combined. Timing is uncertain.`}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div
                    className={`mt-6 p-4 border-l-2 border-emerald-400 ${dark ? "bg-emerald-400/5" : "bg-emerald-50"}`}
                  >
                    <p className="font-medium text-sm">
                      {current.contracts === 1
                        ? "Already at one contract. You can still choose not to trade."
                        : `${smaller.losses - current.losses} more full losses of room. That is what downsizing buys.`}
                    </p>
                    <p className={`${muted} text-xs mt-2 leading-relaxed`}>
                      {current.edge <= 0
                        ? "These assumptions lose money after costs. Work on the setup or sit out; scaling accounts multiplies that loss."
                        : "The goal is not to earn it all today. Smaller size lowers loss exposure—but does not remove risk or guarantee a payout."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-6">
                    <button
                      disabled={current.contracts === 1}
                      onClick={() => onMicro({ contracts: smaller.contracts })}
                      className="bg-emerald-400 text-gray-950 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                    >
                      Use {smaller.contracts} contract
                      {smaller.contracts === 1 ? "" : "s"}
                    </button>
                    <button
                      onClick={() => onView("stress")}
                      className="border border-zinc-500/30 rounded-lg px-4 py-2.5 text-sm"
                    >
                      Pressure test this plan →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-2xl sm:text-3xl tracking-tight font-semibold mt-6">
                    Can your size handle a rough stretch?
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-5">
                    {(["rough", "streak"] as const).map((s) => (
                      <button
                        key={s}
                        aria-pressed={sequence === s}
                        onClick={() => {
                          setSequence(s);
                          setDay(0);
                        }}
                        className={`text-xs px-3 py-2 rounded border ${sequence === s ? "border-emerald-400 text-emerald-500" : "border-zinc-500/30"}`}
                      >
                        {s === "rough"
                          ? "Losses, a pause, then mixed results"
                          : "Six losses in a row"}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-6">
                    <p className="font-mono text-sm">
                      {day === 0 ? "Before entry" : `Step ${day} / 6`}
                    </p>
                    <div className="flex gap-2">
                      <button
                        aria-label="Previous stress step"
                        disabled={day === 0}
                        onClick={() => setDay((d) => d - 1)}
                        className="p-2 border border-zinc-500/30 rounded disabled:opacity-30"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <button
                        aria-label="Next stress step"
                        disabled={day === 6}
                        onClick={() => setDay((d) => d + 1)}
                        className="p-2 border border-zinc-500/30 rounded disabled:opacity-30"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 space-y-8">
                    {[smaller, current].map((s, i) => {
                      const path = pressurePath(
                        settings.cushion,
                        s.loss,
                        s.risk * strategy.rewardToRisk,
                        s.costs,
                        pathSequence.slice(0, day),
                      );
                      const left = path[path.length - 1];
                      return (
                        <div key={i}>
                          <div className="flex flex-wrap justify-between gap-2 text-sm">
                            <span>
                              {i === 0 ? smallLabel : "Current size"} ·{" "}
                              {s.contracts} {micro.symbol}
                            </span>
                            <strong
                              className={`font-mono ${left === 0 ? "text-rose-400" : i === 0 ? "text-emerald-500" : ""}`}
                            >
                              {left === 0
                                ? "Boundary breached"
                                : `${usd(left)} left`}
                            </strong>
                          </div>
                          <div className="h-6 bg-zinc-500/10 rounded mt-3 overflow-hidden">
                            <div
                              className={`h-full transition-[width] motion-reduce:transition-none ${i === 0 ? "bg-emerald-400" : "bg-zinc-400"}`}
                              style={{
                                width: `${Math.max(0, Math.min(100, (left / settings.cushion) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-7 text-xl font-medium">
                    {day === 3 && sequence === "rough"
                      ? "Sitting out costs no trading loss in this model."
                      : "Same market sequence. Different room to recover."}
                  </p>
                  <p className={`${muted} mt-3 text-sm leading-relaxed`}>
                    Each active step is one full win or stopout, with estimated
                    costs. The pause has no trades. Once the boundary is
                    breached, that account stops. Fixed cushion only—not a
                    trailing-drawdown simulation.
                  </p>
                  <button
                    onClick={() => onView("path")}
                    className="mt-6 text-sm text-emerald-500"
                  >
                    ← Adjust size, not your patience
                  </button>
                </>
              )}
              <p
                className={`${muted} text-[11px] leading-relaxed border-t border-zinc-500/20 pt-4 mt-6`}
              >
                Expectancy is an average, not a likely path or payout date.
                Excludes trailing drawdown, payout eligibility/caps, account
                fees, resets and taxes. More accounts multiply losses too.{" "}
                <Link className="underline" href="/app/session">
                  Check actual entered limits in Session Plan.
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
