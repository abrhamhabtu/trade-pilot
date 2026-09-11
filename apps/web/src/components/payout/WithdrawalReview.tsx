"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Account } from "@/store/accountStore";
import { snapshotFresh } from "@/lib/sessionRisk";
import { money } from "@/components/accounts/AccountHealthBoard";
import { useThemeClasses } from "./payoutPrimitives";

export function WithdrawalReview({ account }: { account: Account | null }) {
  const { card, text, muted, input, inset } = useThemeClasses();
  const [amount, setAmount] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const s = account?.riskSnapshot;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setChecked([]);
  }, [amount, s?.confirmedAt, account?.isFunded, account?.status]);
  const valid = !!account && account.type !== "demo";
  const fresh = snapshotFresh(s, Math.max(now, Date.now()));
  const requested = Number(amount);
  const remaining = s ? s.cushion - requested : null;
  const room =
    fresh &&
    remaining !== null &&
    remaining > 0 &&
    remaining >= (s?.reserve ?? 0) &&
    requested > 0 &&
    Number.isFinite(requested);
  const reviewed =
    room &&
    checked.length === 3 &&
    account?.isFunded &&
    account?.status === "active";
  const checks = [
    [
      "eligibility",
      "I checked qualifying days, consistency, request window and payout cap.",
    ],
    [
      "effect",
      "I confirmed how this withdrawal changes my firm’s drawdown threshold and required buffer.",
    ],
    [
      "costs",
      "I checked the profit split, fees and the actual amount I will receive.",
    ],
  ];
  return (
    <section
      className={`${card} ${text} overflow-hidden`}
      aria-label="Withdrawal review"
    >
      <div className="grid lg:grid-cols-[1.1fr_1fr]">
        <div className="p-5 sm:p-7">
          <p className="text-xs font-semibold tracking-widest uppercase text-emerald-500">
            Keep the account. Then take the payout.
          </p>
          <h2 className="text-2xl font-semibold tracking-tight mt-3">
            What’s your next step?
          </h2>
          <p className="text-sm mt-3 leading-relaxed">
            {!valid
              ? "Select your own account above to review a withdrawal. You can still explore the scenarios below."
              : !account.isFunded
                ? "Confirm your funded stage in Account health before reviewing a withdrawal."
                : s?.nextRequirement ||
                  "Check your program’s current payout requirements and update Account health."}
          </p>
          <div className={`${inset} mt-5 p-4`}>
            <p className={`${muted} text-xs`}>Reviewing</p>
            <p className="font-semibold mt-1">
              {valid
                ? account.name
                : "Scenario only · no real account selected"}
            </p>
            <p className={`${muted} text-xs mt-2`}>
              {valid && s
                ? `Manual cushion snapshot · ${new Date(s.confirmedAt).toLocaleString()}${fresh ? "" : " · needs refresh"}`
                : "No confirmed remaining cushion"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 mt-5 text-sm">
            <Link
              href="/app/session#account-health"
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-gray-950 font-semibold"
            >
              Review account health
            </Link>
            <Link
              href="/app/session"
              className="rounded-lg border border-zinc-500/30 px-4 py-2.5"
            >
              Plan today’s risk
            </Link>
          </div>
        </div>
        <div className="p-5 sm:p-7 border-t lg:border-t-0 lg:border-l border-zinc-500/20">
          <h3 className="font-semibold">Before requesting a withdrawal</h3>
          <label className="block text-xs mt-4">
            Amount to debit from the account ($)
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              disabled={!valid}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter a withdrawal to explore"
              className={`${input} rounded-lg w-full p-3 mt-2`}
            />
          </label>
          <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div>
              <dt className={`${muted} text-xs`}>Cushion after debit*</dt>
              <dd
                className={`mt-1 text-xl font-semibold tabular-nums ${remaining !== null && requested > 0 && !room ? "text-amber-500" : ""}`}
              >
                {valid && s && amount && Number.isFinite(remaining)
                  ? money(remaining!)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className={`${muted} text-xs`}>Your protected reserve</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {valid && s ? money(s.reserve) : "—"}
              </dd>
            </div>
          </dl>
          <p className={`${muted} text-xs mt-3 leading-relaxed`}>
            *Simple cushion minus debit estimate, not an available payout
            balance. Firm thresholds can change after a withdrawal. Confirm the
            actual effect with your firm.
          </p>
          <div className="space-y-3 mt-5">
            {checks.map(([id, label]) => (
              <label
                key={id}
                className="flex items-start gap-3 text-xs leading-relaxed"
              >
                <input
                  type="checkbox"
                  disabled={!valid}
                  checked={checked.includes(id)}
                  className="mt-0.5 accent-emerald-500"
                  onChange={(e) =>
                    setChecked((v) =>
                      e.target.checked ? [...v, id] : v.filter((x) => x !== id),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <p
            className={`rounded-lg p-3 text-xs mt-4 ${reviewed ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}
            role="status"
          >
            {reviewed
              ? "Checklist reviewed. Confirm and submit with your firm—this is not an eligibility approval."
              : !fresh
                ? "Refresh your account snapshot before relying on this estimate."
                : !amount
                  ? "Enter an amount, then work through the checks."
                  : !room
                    ? "This amount leaves too little cushion under the entered reserve."
                    : "Complete the checks and confirm the account is active and funded."}
          </p>
          <p className={`${muted} text-xs mt-3`}>
            Review only; nothing is submitted. After payment, record the
            withdrawal in{" "}
            <Link href="/app/accounts" className="underline">
              Accounts
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
