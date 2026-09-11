"use client";
import Link from "next/link";
import { useThemeClasses } from "../payout/payoutPrimitives";
import type { Account } from "@/store/accountStore";

export function JourneyGuide({
  account,
  target,
  consistencyGap,
  consistencyMet,
}: {
  account: Account;
  target: number;
  consistencyGap: number;
  consistencyMet: boolean;
}) {
  const { card, text, muted } = useThemeClasses();
  const remaining = Math.max(0, target - account.balance);
  const payouts = (account.balanceAdjustments ?? []).filter(
    (a) => a.type === "payout",
  );
  const amount = payouts.reduce((sum, a) => sum + Math.abs(a.amount), 0);
  const usd = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  const steps = [
    {
      label: "Build your record",
      done: account.trades.length > 0,
      detail: `${account.trades.length} trades recorded`,
    },
    {
      label: account.isFunded
        ? "Build a payout buffer"
        : "Reach your evaluation target",
      done: remaining === 0 && target > 0,
      detail:
        remaining > 0
          ? `${usd(remaining)} to your configured goal`
          : "Configured profit goal reached",
    },
    {
      label: "Keep days balanced",
      done: consistencyMet,
      detail:
        consistencyGap > 0
          ? `${usd(consistencyGap)} additional profit for the configured consistency rule`
          : consistencyMet
            ? "Configured consistency check met"
            : "Record profitable sessions first",
    },
    {
      label: account.isFunded
        ? "Review payout eligibility"
        : "Review evaluation eligibility",
      done: false,
      detail:
        "Confirm minimum days, drawdown and current program rules with your firm",
    },
  ];
  const next = steps.find((s) => !s.done)!;
  return (
    <section
      className={`${card} ${text} p-5 sm:p-7`}
      aria-label="Journey milestones"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-500 font-semibold">
            Your next good decision
          </p>
          <h2 className="text-2xl font-semibold mt-2">{next.label}</h2>
          <p className={`${muted} text-sm mt-2 max-w-xl`}>
            {next.detail}. Take the next qualified setup; a daily number is not
            a reason to force a trade.
          </p>
        </div>
        <Link
          href="/app/payout"
          className="rounded-lg px-4 py-2 text-sm bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
        >
          Compare smaller sizing →
        </Link>
      </div>
      <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-7">
        {steps.map((s, i) => (
          <li key={s.label} className="border-t border-current/15 pt-4">
            <span
              className={`text-xs font-mono ${s.done ? "text-emerald-500" : muted}`}
            >
              {s.done ? "✓ COMPLETE" : `0${i + 1}`}
            </span>
            <h3 className="text-sm font-semibold mt-2">{s.label}</h3>
            <p className={`${muted} text-xs leading-relaxed mt-1`}>
              {s.detail}
            </p>
          </li>
        ))}
      </ol>
      <div
        className={`mt-6 pt-4 border-t border-current/10 flex flex-wrap justify-between gap-2 text-xs ${muted}`}
      >
        <span>
          {payouts.length} recorded payouts · {usd(amount)} withdrawn
        </span>
        <Link href="/app/routine" className="underline underline-offset-4">
          Open your pre-trade routine
        </Link>
      </div>
    </section>
  );
}
