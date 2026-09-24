"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ClipboardList, Moon, Plane, Radio, RefreshCw } from "lucide-react";
import type { Account } from "@/store/accountStore";
import { resolvePlan, useSessionFlow } from "@/store/sessionFlowStore";
import { DEFAULT_SETTINGS } from "@/lib/pilot/workspace";
import { nyClock, tradedRoots, type MacroEvent, type MarketRead, type VixRead } from "@/lib/pilot/market";
import { buildGamePlan, stageAt, type DayPlan, type Stage } from "@/lib/pilot/session";
import { FlightPlan } from "./FlightPlan";
import { InFlight } from "./InFlight";
import { DebriefView } from "./Debrief";

export interface MarketState {
  markets: MarketRead[];
  vix: VixRead | null;
  events: MacroEvent[];
  eventsLive: boolean;
  errors: string[];
  asOf: number;
}

const STAGES: { id: Stage; n: number; label: string; sub: string; at: number; icon: typeof Plane }[] = [
  { id: "plan", n: 1, label: "Flight plan", sub: "Pre-market", at: 6 * 60 + 30, icon: ClipboardList },
  { id: "fly", n: 2, label: "In flight", sub: "09:30 – 16:00", at: 9 * 60 + 30, icon: Radio },
  { id: "debrief", n: 3, label: "Debrief", sub: "After the close", at: 16 * 60, icon: Moon },
];
const TRACK_FROM = 6 * 60;
const TRACK_TO = 17 * 60;
const pos = (m: number) => Math.min(100, Math.max(0, ((m - TRACK_FROM) / (TRACK_TO - TRACK_FROM)) * 100));

export function TodayFlow({
  account,
  onAsk,
  onReviews,
}: {
  account: Account;
  onAsk: (question: string) => void;
  onReviews: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const clock = nyClock(now);
  const today = clock.date;
  const live = stageAt(now);
  const [stage, setStage] = useState<Stage>(live);
  // Follow the clock across a stage boundary unless the trader is elsewhere on purpose.
  const [followClock, setFollowClock] = useState(true);
  useEffect(() => {
    if (followClock) setStage(live);
  }, [live, followClock]);

  const plans = useSessionFlow((s) => s.plans);
  const setPlanStore = useSessionFlow((s) => s.setPlan);
  const setEvents = useSessionFlow((s) => s.setEvents);
  const carry = useSessionFlow((s) => s.carry[account.id] ?? null);
  const listening = useSessionFlow((s) => s.listening);
  const plan = resolvePlan(plans, account.id, today);
  const setPlan = useCallback((patch: Partial<DayPlan>) => setPlanStore(account.id, today, patch), [account.id, today, setPlanStore]);
  const rules = account.pilotSettings?.rules || DEFAULT_SETTINGS.rules;

  // Keyed by the symbol string, so a refreshed account object does not refetch.
  const rootsKey = useMemo(() => {
    const found = tradedRoots(account.trades.slice(-60).map((t) => t.symbol));
    return (found.length ? found : ["NQ", "ES"]).join(",");
  }, [account.trades]);
  const roots = useMemo(() => rootsKey.split(","), [rootsKey]);

  const [market, setMarket] = useState<MarketState | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pilot/market?symbols=${rootsKey}`, { cache: "no-store" });
      const data = await res.json();
      setMarket(data);
      if (data.today) setEvents(data.today, data.events || []);
    } catch {
      setMarket({ markets: [], vix: null, events: [], eventsLive: false, errors: ["Market data is unreachable"], asOf: Date.now() });
    } finally {
      setLoading(false);
    }
  }, [rootsKey, setEvents]);
  useEffect(() => {
    load();
    // Quotes are delayed anyway; once a minute is plenty while the market is open.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const primary = market?.markets.find((m) => m.symbol === plan.symbol) || market?.markets[0] || null;
  const game = useMemo(
    () =>
      buildGamePlan({
        market: primary,
        events: market?.events || [],
        history: account.trades.filter((t) => t.date.slice(0, 10) < today),
        plan,
        rules,
        carry,
        today,
      }),
    [primary, market?.events, account.trades, plan, rules, carry, today],
  );

  const choose = (s: Stage) => {
    setStage(s);
    setFollowClock(s === live);
  };
  const weekend = clock.weekday === 0 || clock.weekday === 6;
  const timeLabel = new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

  return (
    <div className="space-y-6">
      {/* ── Flight path ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[radial-gradient(120%_140%_at_0%_0%,rgba(0,214,143,0.10),transparent_45%),radial-gradient(120%_140%_at_100%_0%,rgba(79,156,249,0.10),transparent_45%)] bg-tp-card/60 px-5 pb-5 pt-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-tp-green">
              Today · {new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-[28px]">
              A full session.{" "}
              <span className="bg-gradient-to-r from-tp-green via-emerald-300 to-tp-blue bg-clip-text text-transparent">Coached open to close.</span>
            </h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-400">
              Plan on real levels before the bell, get every TradingView signal checked against that plan while you trade, and close with a debrief that writes tomorrow's first line.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-xs text-zinc-300">
              <span className="relative flex h-2 w-2">
                {live === "fly" && !weekend && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tp-green opacity-60" />}
                <span className={clsx("relative inline-flex h-2 w-2 rounded-full", live === "fly" && !weekend ? "bg-tp-green" : "bg-zinc-500")} />
              </span>
              {timeLabel} ET
            </span>
            <button
              onClick={load}
              aria-label="Refresh market data"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
            >
              <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* The track: 06:00 → 17:00 ET, the plane is now. */}
        <div className="relative mt-7 px-3">
          <div className="relative h-1 rounded-full bg-white/[0.06]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-tp-green/70 via-tp-green to-tp-blue"
              style={{ width: `${weekend ? 0 : pos(clock.minute)}%` }}
            />
            {!weekend && clock.minute > TRACK_FROM && clock.minute < TRACK_TO && (
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos(clock.minute)}%` }}>
                <div className="grid h-7 w-7 place-items-center rounded-full bg-tp-base ring-2 ring-tp-green/60 shadow-[0_0_18px_rgba(0,214,143,0.45)]">
                  <Plane className="h-3.5 w-3.5 rotate-45 text-tp-green" />
                </div>
              </div>
            )}
          </div>
          <div className="relative mt-5 grid grid-cols-3 gap-2 sm:block sm:h-[68px]">
            {STAGES.map((s) => {
              const active = stage === s.id;
              const isLive = live === s.id && !weekend;
              const passed = !weekend && clock.minute >= s.at;
              return (
                <button
                  key={s.id}
                  onClick={() => choose(s.id)}
                  aria-current={active ? "step" : undefined}
                  className="group flex flex-col items-center text-center sm:absolute sm:top-0 sm:-translate-x-1/2 sm:first:translate-x-[-12%] sm:last:translate-x-[-88%]"
                  style={{ left: `${pos(s.at)}%` }}
                >
                  <span className="absolute -top-[26px] hidden h-3 w-px bg-white/10 sm:block" />
                  <span
                    className={clsx(
                      "grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition",
                      active
                        ? "border-tp-green bg-tp-green/15 text-tp-green shadow-[0_0_20px_rgba(0,214,143,0.35)]"
                        : passed
                          ? "border-white/20 bg-white/[0.06] text-zinc-200 group-hover:border-white/40"
                          : "border-white/10 bg-tp-base text-zinc-500 group-hover:border-white/30",
                    )}
                  >
                    {s.n}
                  </span>
                  <span className={clsx("mt-1.5 text-[13px] font-semibold sm:whitespace-nowrap", active ? "text-zinc-50" : "text-zinc-400 group-hover:text-zinc-200")}>
                    {s.label}
                    {isLive && <span className="ml-1.5 rounded bg-tp-green/15 px-1 py-px align-middle font-mono text-[9px] tracking-wider text-tp-green">NOW</span>}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-600">{s.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {stage === "plan" && (
        <FlightPlan
          account={account}
          market={market}
          loading={loading}
          primary={primary}
          plan={plan}
          setPlan={setPlan}
          game={game}
          rules={rules}
          today={today}
          minute={clock.minute}
          roots={roots}
          onAsk={onAsk}
          onNext={() => choose("fly")}
        />
      )}
      {stage === "fly" && (
        <InFlight
          account={account}
          plan={plan}
          game={game}
          rules={rules}
          today={today}
          now={now}
          primary={primary}
          listening={listening}
          onAsk={onAsk}
        />
      )}
      {stage === "debrief" && (
        <DebriefView account={account} plan={plan} rules={rules} today={today} onAsk={onAsk} onReviews={onReviews} />
      )}
    </div>
  );
}
