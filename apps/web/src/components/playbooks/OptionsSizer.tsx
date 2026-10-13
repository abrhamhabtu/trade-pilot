"use client";

import React, { useState } from "react";

type Plan = { underlying: string; contract: string; short: string; stop: string; target: string; stopPct: number };

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Field({ label, value, onChange, prefix, suffix, step }: { label: string; value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</span>
      <span className="mt-1.5 flex items-center gap-1 rounded-xl bg-tp-fill px-3 py-2 focus-within:ring-2 focus-within:ring-tp-accent/60">
        {prefix && <span className="text-[15px] text-zinc-500">{prefix}</span>}
        <input
          type="number"
          min={0}
          step={step ?? 1}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full min-w-0 bg-transparent text-[17px] font-semibold tabular-nums text-white focus:outline-none"
        />
        {suffix && <span className="text-[15px] text-zinc-500">{suffix}</span>}
      </span>
    </label>
  );
}

/** Contracts from dollars at risk: the stop is a percentage of the premium paid. */
export function OptionsSizer({ plan }: { plan: Plan }) {
  const [account, setAccount] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const [premium, setPremium] = useState(1.8);
  const [stopPct, setStopPct] = useState(plan.stopPct);

  const ok = [account, riskPct, premium, stopPct].every((n) => Number.isFinite(n) && n > 0);
  const riskBudget = ok ? (account * riskPct) / 100 : 0;
  const lossPerContract = ok ? premium * 100 * (stopPct / 100) : 0;
  const contracts = ok ? Math.floor(riskBudget / lossPerContract) : 0;
  const cost = contracts * premium * 100;
  const plannedLoss = contracts * lossPerContract;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account size" value={account} onChange={setAccount} prefix="$" step={500} />
          <Field label="Risk per trade" value={riskPct} onChange={setRiskPct} suffix="%" step={0.25} />
          <Field label="Option price" value={premium} onChange={setPremium} prefix="$" step={0.05} />
          <Field label="Stop, % of premium" value={stopPct} onChange={setStopPct} suffix="%" step={5} />
        </div>
        <dl className="mt-5 space-y-2.5 text-[15px]">
          {[
            ["Trade", plan.underlying],
            ["Contract", plan.contract],
            ["Wrong when", plan.stop],
            ["Target", plan.target],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[88px_1fr] gap-3">
              <dt className="pt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{k}</dt>
              <dd className="leading-snug text-zinc-300">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl bg-tp-panel p-6 ring-1 ring-inset ring-white/[0.07]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Buy</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[56px] font-bold leading-none tracking-[-0.04em] tabular-nums text-white">{contracts}</span>
          <span className="text-[17px] text-zinc-400">contract{contracts === 1 ? "" : "s"}</span>
        </div>
        {ok && contracts === 0 && (
          <p className="mt-3 text-[15px] leading-snug text-tp-orange">
            One contract would lose {usd(lossPerContract)} at the stop, more than your {usd(riskBudget)} budget. Pick a cheaper strike or skip the trade.
          </p>
        )}
        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/[0.08]">
          {[
            ["You pay", usd(cost)],
            ["Loss at stop", usd(plannedLoss)],
            ["Max loss", usd(cost)],
          ].map(([k, v]) => (
            <div key={k} className="bg-tp-panel px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{k}</div>
              <div className="mt-1 text-[19px] font-bold tabular-nums text-white">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
          Maths only. A long option can lose its whole price if it gaps past your stop, so treat “You pay” as the real worst case. Fees are not included.
        </p>
      </div>
    </div>
  );
}
