"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import { Account, useAccountStore } from "@/store/accountStore";
import { snapshotFresh } from "@/lib/sessionRisk";
import { useThemeClasses } from "@/components/payout/payoutPrimitives";

export const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

function HealthRow({ account, now }: { account: Account; now: number }) {
  const { input, inset, muted } = useThemeClasses();
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const [editing, setEditing] = useState(false);
  const s = account.riskSnapshot;
  const fresh = snapshotFresh(s, now);
  const synced = account.syncSource?.lastSynced;
  const syncAge = synced ? now - Date.parse(synced) : Infinity;
  const currentSync =
    Number.isFinite(syncAge) && syncAge >= 0 && syncAge < 10 * 60_000;
  const depleted =
    !!s &&
    (s.cushion <= s.reserve ||
      s.dailyRemaining <= 0 ||
      s.personalDailyLimit <= 0);
  const fields = [
    [
      "cushion",
      "Remaining drawdown cushion ($)",
      "Distance to breach shown by your platform, not the nominal account size.",
    ],
    [
      "personalDailyLimit",
      "Your personal daily loss limit ($)",
      "Your own limit for the full session.",
    ],
    [
      "dailyRemaining",
      "Loss budget left today ($)",
      "Lower of your personal and firm allowance remaining, after today’s losses.",
    ],
    [
      "reserve",
      "Cushion to leave untouched ($)",
      "Your buffer; keep this below the remaining cushion.",
    ],
    [
      "contractCap",
      "Maximum contracts for this instrument",
      "Use the smallest applicable firm/personal cap. Recheck when switching symbols.",
    ],
  ] as const;
  return (
    <article className={`${inset} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{account.name}</h3>
          <p className={`${muted} text-xs mt-1`}>
            {account.broker} ·{" "}
            {account.isFunded === undefined
              ? "Stage unconfirmed"
              : account.isFunded
                ? "Funded"
                : "Evaluation"}{" "}
            · {account.status.replace("_", " ")}
          </p>
        </div>
        <span
          className={`text-xs rounded-full px-3 py-1 ${depleted ? "text-rose-400 bg-rose-500/10" : fresh ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"}`}
        >
          {depleted
            ? "Pause · no room"
            : fresh
              ? "Snapshot current · not live"
              : s
                ? "Refresh snapshot"
                : "Limits not confirmed"}
        </span>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 text-sm">
        {[
          ["Cushion left", s ? money(s.cushion) : "Unknown"],
          ["Today’s budget left", s ? money(s.dailyRemaining) : "Unknown"],
          ["Personal daily limit", s ? money(s.personalDailyLimit) : "Not set"],
          ["Protected reserve", s ? money(s.reserve) : "Not set"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className={`${muted} text-xs`}>{label}</dt>
            <dd className="font-semibold tabular-nums mt-1">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm mt-4">
        <span className={muted}>Next payout requirement: </span>
        {s?.nextRequirement || "Review your program’s current requirements."}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-xs">
        <div className={muted}>
          <p>
            Risk snapshot:{" "}
            {s ? new Date(s.confirmedAt).toLocaleString() : "Not entered"}
          </p>
          <p className="mt-1">
            Trade sync:{" "}
            {synced
              ? `${new Date(synced).toLocaleString()}${currentSync ? "" : " · stale"}`
              : account.syncSource
                ? "Not synced yet"
                : "Manual imports · no automatic sync"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="rounded-lg border border-zinc-500/30 px-3 py-2 font-medium"
          aria-expanded={editing}
        >
          {editing ? "Cancel" : "Update limits"}
        </button>
      </div>
      {editing && (
        <form
          className="mt-5 border-t border-zinc-500/20 pt-5"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const values = Object.fromEntries(
              fields.map(([key]) => [key, Number(data.get(key))]),
            ) as {
              cushion: number;
              personalDailyLimit: number;
              dailyRemaining: number;
              reserve: number;
              contractCap: number;
            };
            updateAccount(account.id, {
              isFunded: data.get("stage") === "funded",
              riskSnapshot: {
                ...values,
                dailyRemaining: Math.min(
                  values.dailyRemaining,
                  values.personalDailyLimit,
                ),
                nextRequirement: String(
                  data.get("nextRequirement") || "",
                ).trim(),
                confirmedAt: new Date().toISOString(),
              },
            });
            setEditing(false);
          }}
        >
          <p className={`${muted} text-xs mb-4`}>
            Check your platform now. These are manual snapshots, not live firm
            limits. Include open-position risk in the remaining budgets.
            Reconfirm after every trade and before changing instruments.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map(([key, label, help]) => (
              <label className="block text-xs" key={key}>
                {label}
                <input
                  className={`${input} block w-full mt-1 rounded-lg p-2.5`}
                  name={key}
                  type="number"
                  min={key === "contractCap" ? 1 : 0}
                  max={key === "contractCap" ? 1000 : 10000000}
                  step={key === "contractCap" ? 1 : 0.01}
                  required
                  defaultValue={s?.[key] ?? ""}
                />
                <span className={`${muted} block mt-1 leading-relaxed`}>
                  {help}
                </span>
              </label>
            ))}
            <label className="text-xs">
              Account stage
              <select
                name="stage"
                className={`${input} block mt-1 w-full rounded-lg p-2.5`}
                defaultValue={
                  account.isFunded === undefined
                    ? ""
                    : account.isFunded
                      ? "funded"
                      : "evaluation"
                }
                required
              >
                <option value="" disabled>
                  Confirm stage
                </option>
                <option value="evaluation">Evaluation</option>
                <option value="funded">Funded</option>
              </select>
            </label>
            <label className="text-xs sm:col-span-2">
              Next payout requirement
              <input
                name="nextRequirement"
                maxLength={240}
                required
                className={`${input} block w-full mt-1 rounded-lg p-2.5`}
                placeholder="e.g. Confirm qualifying days and leave the required buffer"
                defaultValue={s?.nextRequirement ?? ""}
              />
            </label>
          </div>
          <button
            type="submit"
            className="mt-4 rounded-lg bg-emerald-500 text-gray-950 px-4 py-2.5 text-sm font-semibold"
          >
            I checked my platform · save snapshot
          </button>
        </form>
      )}
    </article>
  );
}

export function AccountHealthBoard() {
  const accounts = useAccountStore((s) => s.accounts);
  const { card, text, muted } = useThemeClasses();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const relevant = accounts.filter(
    (a) =>
      a.type !== "demo" &&
      (a.status === "active" || a.status === "passed_eval"),
  );
  return (
    <section
      id="account-health"
      className={`${card} ${text} p-4 sm:p-6 mb-6 scroll-mt-20`}
      aria-label="Account health board"
    >
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-lg flex gap-2 items-center">
            <ShieldCheck className="w-5 h-5 text-emerald-500" /> Account health
          </h2>
          <p className={`${muted} text-sm mt-1`}>
            Protect the room you have left, not the account size on the label.
          </p>
        </div>
        <Link
          className="text-sm text-emerald-500 flex gap-1 items-center"
          href="/app/session"
        >
          Plan this session <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="space-y-3">
        {relevant.map((a) => (
          <HealthRow key={a.id} account={a} now={Math.max(now, Date.now())} />
        ))}
      </div>
      {!relevant.length && (
        <p className={`${muted} py-5 text-sm`}>
          Add a real active account in{" "}
          <Link href="/app/accounts" className="underline">
            Accounts
          </Link>{" "}
          to begin. Demo accounts are excluded from risk planning.
        </p>
      )}
      <p className={`${muted} text-xs mt-4`}>
        Snapshots expire after 30 minutes. Trade sync imports executions; it
        does not verify live equity, trailing drawdown, payout eligibility, or
        open positions.
      </p>
    </section>
  );
}
