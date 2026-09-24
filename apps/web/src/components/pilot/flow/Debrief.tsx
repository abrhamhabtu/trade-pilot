"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Check, ListChecks, RotateCw, Sparkles } from "lucide-react";
import type { Account } from "@/store/accountStore";
import { useSessionFlow } from "@/store/sessionFlowStore";
import { tradeMinute, type PilotRules } from "@/lib/pilot/workspace";
import { RTH_CLOSE, RTH_OPEN, nyClock } from "@/lib/pilot/market";
import { debrief, minuteLabel, sessionsOf, shortDate, type DayPlan } from "@/lib/pilot/session";
import { Card, Eyebrow, ScoreRing } from "./ui";

const usd = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export function DebriefView({
  account,
  plan,
  rules,
  today,
  onAsk,
  onReviews,
}: {
  account: Account;
  plan: DayPlan;
  rules: PilotRules;
  today: string;
  onAsk: (q: string) => void;
  onReviews: () => void;
}) {
  const signals = useSessionFlow((s) => s.signals);
  const carry = useSessionFlow((s) => s.carry[account.id]);
  const setCarry = useSessionFlow((s) => s.setCarry);
  const sessions = useMemo(() => sessionsOf(account.trades), [account.trades]);
  const dates = [...sessions.keys()].sort().reverse();
  const [date, setDate] = useState(sessions.has(today) ? today : dates[0] || today);
  const d = useMemo(() => debrief(date, account.trades, plan, rules, signals), [date, account.trades, plan, rules, signals]);
  const [focus, setFocus] = useState(d.tomorrow);
  useEffect(() => setFocus(d.tomorrow), [d.tomorrow]);
  const carried = carry?.date === date && carry.text === focus;
  const trades = sessions.get(date) || [];
  const daySignals = signals.filter((s) => !s.test && nyClock(s.receivedAt).date === date);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Eyebrow className="text-tp-blue">Post-session review</Eyebrow>
          <p className="mt-1 text-sm text-zinc-400">
            {date === today ? "Today's session" : `No trades logged today yet, so this is your last session: ${shortDate(date)}.`}
          </p>
        </div>
        <select
          aria-label="Session to debrief"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-zinc-200 focus:outline-none"
        >
          {dates.slice(0, 30).map((x) => (
            <option key={x} value={x}>
              {shortDate(x)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="P&L" value={d.trades ? usd(d.pnl) : "$0"} tone={d.pnl > 0 ? "green" : d.pnl < 0 ? "red" : undefined} />
        <Tile label="Win rate" value={d.trades ? `${Math.round(d.winRate)}%` : "—"} />
        <Tile label="Trades" value={`${d.trades}`} sub={`of ${rules.maxTrades} allowed`} />
        <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-tp-card/90 p-4">
          <div className="relative">
            <ScoreRing value={d.score} size={60} />
            <span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums text-zinc-100">{d.score ?? "—"}</span>
          </div>
          <div>
            <Eyebrow>Plan score</Eyebrow>
            <p className="mt-1 text-[12px] text-zinc-400">{d.cleanStreak > 1 ? `${d.cleanStreak} clean sessions in a row` : d.score == null ? "No trades to score" : "Share of your plan's rules kept"}</p>
          </div>
        </div>
      </div>

      <Card title="Session timeline · ET">
        <Timeline trades={trades} signalMinutes={daySignals.map((s) => nyClock(s.receivedAt).minute)} waitMinutes={plan.waitMinutes} />
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card
          glow
          title={
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-tp-green">
              <Sparkles className="h-3 w-3" /> Pilot's debrief
            </span>
          }
        >
          {d.insights.length ? (
            <ul className="space-y-3">
              {d.insights.map((i, n) => (
                <li key={n} className="tp-flow-scan flex gap-3" style={{ animationDelay: `${n * 80}ms` }}>
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.tone === "good" ? "bg-tp-green" : i.tone === "warn" ? "bg-tp-yellow" : "bg-tp-blue")} />
                  <div>
                    <p className="text-[13.5px] font-semibold text-zinc-100">{i.title}</p>
                    <p className="text-[13px] leading-relaxed text-zinc-400">{i.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-zinc-500">Nothing to review for this session yet.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
            <button
              onClick={() => onAsk(`Review my session on ${date}. What did I do well, what cost me the most, and what's the one change for tomorrow?`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-tp-green px-3 py-1.5 text-[13px] font-semibold text-[#0D1628] hover:brightness-110"
            >
              <Sparkles className="h-3.5 w-3.5" /> Go deeper with Pilot
            </button>
            <button
              onClick={onReviews}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] font-medium text-zinc-200 hover:border-white/[0.16]"
            >
              <ListChecks className="h-3.5 w-3.5" /> Tag and review each trade
            </button>
          </div>
        </Card>

        <Card title="Tomorrow's focus">
          <textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[14px] leading-relaxed text-zinc-100 focus:border-tp-green/40 focus:outline-none"
          />
          <button
            onClick={() => setCarry(account.id, date, focus.trim())}
            disabled={!focus.trim() || carried}
            className={clsx(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              carried ? "bg-tp-green/10 text-tp-green" : "bg-gradient-to-r from-tp-green to-emerald-400 text-[#0D1628] hover:brightness-110",
            )}
          >
            {carried ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            {carried ? "Set as tomorrow's first line" : "Carry into tomorrow's Flight plan"}
          </button>
          <p className="mt-3 flex items-center gap-2 text-[12px] text-zinc-500">
            <RotateCw className="h-3.5 w-3.5 text-tp-blue" />
            Each debrief feeds the next pre-market plan, so every session starts from the last one's lesson.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, tone, sub }: { label: string; value: string; tone?: "green" | "red"; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-tp-card/90 p-4">
      <Eyebrow>{label}</Eyebrow>
      <p className={clsx("mt-1.5 text-2xl font-semibold tabular-nums", tone === "green" ? "text-tp-green" : tone === "red" ? "text-tp-red" : "text-zinc-50")}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
    </div>
  );
}

/** 09:30 → 16:00. Trades above the line sized by P&L, signals as ticks below, the opening window shaded. */
function Timeline({ trades, signalMinutes, waitMinutes }: { trades: { id: string; time?: string; netPL: number; symbol: string; strategy?: string }[]; signalMinutes: number[]; waitMinutes: number }) {
  const span = RTH_CLOSE - RTH_OPEN;
  const x = (m: number) => `${Math.min(100, Math.max(0, ((m - RTH_OPEN) / span) * 100))}%`;
  const timed = trades.map((t) => ({ ...t, m: tradeMinute(t.time) })).filter((t): t is typeof t & { m: number } => t.m !== null);
  const maxAbs = Math.max(1, ...timed.map((t) => Math.abs(t.netPL)));
  const hours = [RTH_OPEN, 10 * 60 + 30, 11 * 60 + 30, 12 * 60 + 30, 13 * 60 + 30, 14 * 60 + 30, 15 * 60 + 30];
  return (
    <div className="relative h-36 select-none">
      <div className="absolute inset-y-4 bg-tp-yellow/[0.1]" style={{ left: 0, width: x(RTH_OPEN + waitMinutes) }} title="Opening window" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
      {hours.map((h) => (
        <div key={h} className="absolute bottom-0 -translate-x-1/2 font-mono text-[10px] text-zinc-600" style={{ left: x(h) }}>
          {minuteLabel(h)}
        </div>
      ))}
      {timed.map((t) => {
        const size = 10 + (Math.abs(t.netPL) / maxAbs) * 22;
        return (
          <div
            key={t.id}
            title={`${t.time} · ${t.symbol} · ${usd(t.netPL)}${t.strategy ? ` · ${t.strategy}` : ""}`}
            className={clsx("absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-tp-card", t.netPL >= 0 ? "bg-tp-green/80" : "bg-tp-red/80")}
            style={{ left: x(t.m), top: `calc(50% - ${t.netPL >= 0 ? size / 2 + 8 : -(size / 2 + 8)}px)`, width: size, height: size }}
          />
        );
      })}
      {signalMinutes.map((m, i) => (
        <div key={i} className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 rounded bg-tp-blue" style={{ left: x(m) }} title={`Signal at ${minuteLabel(m)}`} />
      ))}
      <div className="absolute right-0 top-0 flex gap-3 font-mono text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-tp-green/80" />win</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-tp-red/80" />loss</span>
        <span className="flex items-center gap-1"><span className="h-2 w-0.5 bg-tp-blue" />signal</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 bg-tp-yellow/20" />opening window</span>
      </div>
    </div>
  );
}
