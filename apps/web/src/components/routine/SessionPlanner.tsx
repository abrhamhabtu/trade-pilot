"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccountStore } from "@/store/accountStore";
import {
  AccountHealthBoard,
  money,
} from "@/components/accounts/AccountHealthBoard";
import { useThemeClasses } from "@/components/payout/payoutPrimitives";
import {
  SessionInputs,
  SESSION_INSTRUMENTS,
  localSessionDate,
  sizeSession,
} from "@/lib/sessionRisk";

const KEY = "tradepilot_session_plan_v1";
const initial: SessionInputs = {
  symbol: "MNQ",
  stopPoints: 30,
  risk: 100,
  fees: 2,
  slippagePoints: 1,
  maxTrades: 2,
  completedTrades: 0,
  date: "",
  finishTime: "11:00",
  setup: "",
};

export function SessionPlanner() {
  const { card, text, muted, input, inset } = useThemeClasses();
  const { accounts, initializeFromIDB } = useAccountStore();
  const [plan, setPlan] = useState<SessionInputs>(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    initializeFromIDB();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setPlan({ ...initial, ...saved.plan });
        setSelected(Array.isArray(saved.selected) ? saved.selected : []);
      } else setPlan((p) => ({ ...p, date: localSessionDate() }));
    } catch {
      setStorageError(true);
    }
    setLoaded(true);
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, [initializeFromIDB]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ plan, selected }));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [plan, selected, loaded]);
  const eligible = accounts.filter((a) => a.type !== "demo");
  const chosen = eligible.filter((a) => selected.includes(a.id));
  const result = sizeSession(
    plan,
    chosen,
    new Date(Math.max(now.getTime(), Date.now())),
  );
  const missingAccount = selected.some(
    (id) => !eligible.some((a) => a.id === id),
  );
  const blocked = result.reasons.length > 0 || missingAccount;
  const set = (patch: Partial<SessionInputs>) =>
    setPlan((p) => ({ ...p, ...patch }));
  return (
    <div className={`${text} max-w-6xl mx-auto p-4 sm:p-6 space-y-6`}>
      <header>
        <p className="text-xs text-emerald-500 font-semibold uppercase tracking-widest">
          Before the first trade
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mt-2">
          A plan worth sticking to.
        </h1>
        <p className={`${muted} text-sm mt-2 max-w-2xl`}>
          Your edge today: a qualified setup, room for a loss, and a clear place
          to stop. No need to force the next payout.
        </p>
      </header>
      <div className="grid lg:grid-cols-[1.25fr_1fr] gap-5 items-start">
        <section className={`${card} p-5 sm:p-6`} aria-label="Session inputs">
          <div className="flex flex-wrap justify-between gap-3 items-center">
            <h2 className="text-lg font-semibold">Set your boundaries</h2>
            <span className={`${muted} text-xs`}>
              {loaded ? plan.date || "No date" : "Loading…"} · device local time
            </span>
          </div>
          {plan.date !== localSessionDate(now) && loaded && (
            <button
              className="mt-3 rounded-lg bg-emerald-500 text-gray-950 px-3 py-2 text-sm font-semibold"
              onClick={() =>
                set({
                  date: localSessionDate(),
                  completedTrades: 0,
                  lastTradeAt: undefined,
                })
              }
            >
              Start today · reset trade count
            </button>
          )}
          <label className="block text-sm mt-5">
            The setup I’m waiting for
            <input
              value={plan.setup}
              maxLength={160}
              onChange={(e) => set({ setup: e.target.value })}
              placeholder="e.g. Opening range retest with confirmation"
              className={`${input} w-full mt-2 p-2.5 rounded-lg`}
            />
          </label>
          <fieldset className="mt-5">
            <legend className="text-sm mb-2">
              Accounts taking this same trade
            </legend>
            <div className="space-y-2">
              {eligible.map((a) => (
                <label
                  key={a.id}
                  className={`${inset} flex items-center gap-3 p-3 text-sm`}
                >
                  <input
                    type="checkbox"
                    className="accent-emerald-500"
                    checked={selected.includes(a.id)}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, a.id]
                          : ids.filter((id) => id !== a.id),
                      )
                    }
                  />
                  <span>
                    {a.name}
                    <span className={`${muted} text-xs block`}>
                      {a.status.replace("_", " ")} · {a.broker}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {!eligible.length && (
              <p className={`${muted} text-sm`}>
                Add your own account first. Demo data is not used.
              </p>
            )}
          </fieldset>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <label className="text-xs">
              Instrument
              <select
                className={`${input} block w-full mt-1 p-2.5 rounded-lg`}
                value={plan.symbol}
                onChange={(e) => {
                  set({
                    symbol: e.target.value as SessionInputs["symbol"],
                    lastTradeAt: new Date().toISOString(),
                  });
                }}
              >
                {Object.keys(SESSION_INSTRUMENTS).map((s) => (
                  <option key={s} value={s}>
                    {s === "MBT"
                      ? "MBT · Micro Bitcoin (CME)"
                      : s === "MGC"
                        ? "MGC · Micro Gold"
                        : s}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["stopPoints", "Stop distance (points)", 0.01, 0.01],
                ["risk", "Maximum risk / account ($)", 0, 1],
                ["fees", "Round-trip fees / contract ($)", 0, 0.01],
                ["slippagePoints", "Slippage allowance (points)", 0, 0.25],
                ["maxTrades", "Maximum trades this session", 1, 1],
              ] as const
            ).map(([key, label, min, step]) => (
              <label key={key} className="text-xs">
                {label}
                <input
                  type="number"
                  min={min}
                  step={step}
                  value={Number.isFinite(plan[key]) ? plan[key] : ""}
                  className={`${input} block w-full mt-1 p-2.5 rounded-lg`}
                  onChange={(e) =>
                    set({
                      [key]:
                        e.target.value === "" ? NaN : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
            <label className="text-xs">
              Finish time (today, local)
              <input
                type="time"
                className={`${input} block w-full mt-1 p-2.5 rounded-lg`}
                value={plan.finishTime}
                onChange={(e) => set({ finishTime: e.target.value })}
                onInput={(e) => set({ finishTime: e.currentTarget.value })}
              />
            </label>
          </div>
          <p className={`${muted} text-xs mt-4`}>
            Fees are estimates—replace with your platform’s costs. Switching
            instruments requires reconfirming limits below.
          </p>
          <p className="text-xs mt-3" role="status">
            {storageError
              ? "Cannot save locally. Keep this page open; changes may be lost."
              : loaded
                ? "Plan saved on this device."
                : "Loading your plan…"}
          </p>
        </section>
        <section
          className={`${card} overflow-hidden lg:sticky lg:top-4`}
          aria-label="Position sizing result"
          aria-live="polite"
        >
          <div
            className={`p-5 sm:p-6 ${blocked ? "bg-amber-500/5" : "bg-emerald-500/5"}`}
          >
            <p
              className={`text-xs uppercase tracking-widest font-semibold ${blocked ? "text-amber-500" : "text-emerald-500"}`}
            >
              {blocked ? "Pause before entry" : "Within your entered limits"}
            </p>
            <h2 className="text-4xl font-semibold tracking-tight mt-4">
              {blocked ? "Wait / skip" : `${result.contracts} ${plan.symbol}`}
            </h2>
            <p className={`${muted} text-sm mt-2`}>
              {blocked
                ? "A no-trade decision can be the right decision."
                : "Contracts per account. A sizing estimate, not permission to trade."}
            </p>
          </div>
          <div className="p-5 sm:p-6">
            {blocked ? (
              <ul className="space-y-2 text-sm list-disc pl-4">
                {result.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {missingAccount && (
                  <li>
                    A selected account was removed. Clear the selection and
                    choose again.{" "}
                    <button
                      className="underline"
                      onClick={() => setSelected([])}
                    >
                      Clear selection
                    </button>
                  </li>
                )}
              </ul>
            ) : (
              <dl className="space-y-4 text-sm">
                {[
                  [
                    "Risk including costs / account",
                    money(result.perAccountRisk),
                  ],
                  ["Same loss across all accounts", money(result.totalRisk)],
                  ["Selected accounts", String(chosen.length)],
                  [
                    "Stop rounded to valid ticks",
                    `${result.roundedStop} points`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className={muted}>{label}</dt>
                    <dd className="font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {result.limitingAccount && (
              <p className="text-xs text-amber-500 mt-4">
                Budget constrained by {result.limitingAccount}.
              </p>
            )}
            <div className={`${inset} mt-6 p-4`}>
              <div className="flex justify-between gap-3 text-sm">
                <span>Completed trades</span>
                <strong>
                  {plan.completedTrades} / {plan.maxTrades}
                </strong>
              </div>
              <p className={`${muted} text-xs mt-2`}>
                Count a complete trade idea once, not each partial fill. Log it
                here after closing, then refresh account limits below.
              </p>
              <button
                disabled={
                  !loaded ||
                  plan.date !== localSessionDate(now) ||
                  plan.completedTrades >= plan.maxTrades
                }
                onClick={() => {
                  set({
                    completedTrades: plan.completedTrades + 1,
                    lastTradeAt: new Date().toISOString(),
                  });
                  setNow(new Date());
                }}
                className="border border-zinc-500/30 rounded-lg px-3 py-2 text-sm mt-3 disabled:opacity-40"
              >
                Log a completed trade
              </button>
              {plan.completedTrades > 0 && (
                <button
                  onClick={() =>
                    set({ completedTrades: plan.completedTrades - 1 })
                  }
                  className="block text-xs underline mt-3"
                >
                  Correct an accidental count (−1)
                </button>
              )}
            </div>
            <p className={`${muted} text-xs leading-relaxed mt-5`}>
              Read-only guidance. This does not place stops or lock your trading
              platform. Prices can gap past stops; copied accounts multiply the
              same risk. Set enforceable limits in your platform.
            </p>
            <Link
              href="/app/payout"
              className="block text-emerald-500 text-sm mt-4"
            >
              See the patient path to a payout →
            </Link>
          </div>
        </section>
      </div>
      <AccountHealthBoard />
    </div>
  );
}
