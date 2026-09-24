"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, BookOpen, Check, CircleDashed, Lightbulb, NotebookPen, Radio, Sparkles, Trash2, X } from "lucide-react";
import type { Account } from "@/store/accountStore";
import { useSessionFlow } from "@/store/sessionFlowStore";
import { useDailyNotesStore } from "@/store/dailyNotesStore";
import type { PilotRules } from "@/lib/pilot/workspace";
import { RTH_CLOSE, RTH_OPEN, nyClock, type MarketRead } from "@/lib/pilot/market";
import {
  adherence,
  minuteLabel,
  sessionNudges,
  setupLabel,
  type DayPlan,
  type GamePlan,
  type SignalCheck,
  type TvSignal,
} from "@/lib/pilot/session";
import { judge, tradesOn } from "./judge";
import { SignalSetup } from "./SignalSetup";
import { Card, Chip, Eyebrow, Snapshot } from "./ui";

const usd = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

export function InFlight({
  account,
  plan,
  game,
  rules,
  today,
  now,
  primary,
  listening,
  onAsk,
}: {
  account: Account;
  plan: DayPlan;
  game: GamePlan;
  rules: PilotRules;
  today: string;
  now: number;
  primary: MarketRead | null;
  listening: boolean;
  onAsk: (q: string) => void;
}) {
  const allSignals = useSessionFlow((s) => s.signals);
  const events = useSessionFlow((s) => s.events);
  const notes = useSessionFlow((s) => s.notes);
  const addNote = useSessionFlow((s) => s.addNote);
  const removeNote = useSessionFlow((s) => s.removeNote);
  const { minute } = nyClock(now);
  const trades = useMemo(() => tradesOn(account, today), [account, today]);
  const history = useMemo(() => account.trades.filter((t) => t.date.slice(0, 10) < today), [account.trades, today]);

  const signals = useMemo(
    () =>
      allSignals
        .filter((s) => nyClock(s.receivedAt).date === today)
        .map((s) => ({ signal: s, ...judge(s, account, plan, events.date === today ? events.list : []) }))
        .reverse(),
    [allSignals, today, account, plan, events],
  );
  const signalById = new Map(allSignals.map((s) => [s.id, s]));
  const dayNotes = notes.filter((n) => n.accountId === account.id && n.date === today).sort((a, b) => b.at - a.at);
  const { items, score } = adherence(trades, account.trades, plan, rules);
  const nudges = sessionNudges(trades, history, rules, minute);

  const pnl = trades.reduce((s, t) => s + t.netPL, 0);
  const left = Math.max(0, rules.dailyLoss + Math.min(0, pnl));
  const used = Math.min(100, ((rules.dailyLoss - left) / rules.dailyLoss) * 100);
  const inSession = minute >= RTH_OPEN && minute < RTH_CLOSE;
  const elapsed = minute - RTH_OPEN;
  const status = inSession
    ? `In session · ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
    : minute < RTH_OPEN
      ? `Opens in ${Math.floor((RTH_OPEN - minute) / 60)}h ${(RTH_OPEN - minute) % 60}m`
      : "Session closed";
  const entriesOpen = inSession && minute >= game.firstEntry;

  return (
    <div className="space-y-6">
      {/* ── Status strip ─────────────────────────────────────── */}
      <div className="grid gap-3 rounded-2xl border border-white/[0.06] bg-tp-card/90 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex items-center gap-3 lg:col-span-2">
          <span className={clsx("relative grid h-10 w-10 place-items-center rounded-xl ring-1 ring-inset", inSession ? "bg-tp-red/10 text-tp-red ring-tp-red/25" : "bg-white/[0.04] text-zinc-500 ring-white/[0.06]")}>
            {inSession && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-tp-red" />}
            <Radio className="h-4 w-4" />
          </span>
          <div>
            <p className={clsx("font-mono text-[11px] font-semibold uppercase tracking-[0.18em]", inSession ? "text-tp-red" : "text-zinc-500")}>{status}</p>
            <p className="text-[13px] text-zinc-300">
              {!inSession
                ? "Signals still arrive and get checked. The rules just apply to 9:30–16:00."
                : entriesOpen
                  ? "Entries open. Only your setups, only your size."
                  : `Hands off until ${minuteLabel(game.firstEntry)}. Let the opening candle close.`}
            </p>
          </div>
        </div>
        <Stat label="P&L today" value={trades.length ? usd(pnl) : "$0"} tone={pnl > 0 ? "green" : pnl < 0 ? "red" : undefined} />
        <Stat label="Trades" value={`${trades.length} / ${rules.maxTrades}`} tone={trades.length >= rules.maxTrades ? "red" : undefined} />
        <div>
          <Eyebrow>Left to lose</Eyebrow>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">${Math.round(left).toLocaleString("en-US")}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className={clsx("h-full rounded-full", used > 66 ? "bg-tp-red" : used > 33 ? "bg-tp-yellow" : "bg-tp-green")} style={{ width: `${Math.max(used, 2)}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* ── Left: signals ─────────────────────────────────── */}
        <div className="space-y-6">
          <SignalSetup plan={plan} primary={primary} compact={signals.length > 0} />

          <Card title={`Signal feed · ${signals.length} today`} action={listening ? <Chip tone="green">Live</Chip> : <Chip>Paused</Chip>}>
            {signals.length ? (
              <ul className="space-y-3">
                {signals.map(({ signal, check, minute: m }) => (
                  <SignalCard key={signal.id} signal={signal} check={check} minute={m} onAsk={onAsk} />
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
                <Radio className="mx-auto h-6 w-6 text-zinc-600" />
                <p className="mt-3 text-sm font-medium text-zinc-200">Quiet so far</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-zinc-500">
                  When your indicator fires, the signal lands here with a chart snapshot and Pilot's check against today's plan. Send a test signal above to see one.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* ── Right: adherence, nudges, notes ──────────────── */}
        <div className="space-y-6 xl:sticky xl:top-4">
          <Card title="Plan adherence" action={<span className="font-mono text-[11px] text-zinc-500">{score == null ? "—" : `${score}%`}</span>}>
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.label} className="flex items-start gap-2.5">
                  <span
                    className={clsx(
                      "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded",
                      i.state === "ok" ? "bg-tp-green/15 text-tp-green" : i.state === "fail" ? "bg-tp-red/15 text-tp-red" : "text-zinc-600",
                    )}
                  >
                    {i.state === "ok" ? <Check className="h-3 w-3" strokeWidth={3} /> : i.state === "fail" ? <X className="h-3 w-3" strokeWidth={3} /> : <CircleDashed className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] text-zinc-200">{i.label}</span>
                    <span className="block text-[11.5px] text-zinc-500">{i.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {nudges.map((n) => (
            <div
              key={n.title}
              className={clsx(
                "tp-flow-scan rounded-2xl border p-4",
                n.tone === "warn" ? "border-tp-yellow/30 bg-tp-yellow/[0.05]" : n.tone === "good" ? "border-tp-green/25 bg-tp-green/[0.05]" : "border-tp-blue/25 bg-tp-blue/[0.05]",
              )}
            >
              <p className={clsx("flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]", n.tone === "warn" ? "text-tp-yellow" : n.tone === "good" ? "text-tp-green" : "text-tp-blue")}>
                {n.tone === "warn" ? <AlertTriangle className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />} Behavioral nudge
              </p>
              <p className="mt-1.5 text-[13px] font-semibold text-zinc-100">{n.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-300">{n.text}</p>
            </div>
          ))}

          <QuickNotes
            accountId={account.id}
            today={today}
            minute={minute}
            notes={dayNotes}
            signalById={signalById}
            addNote={addNote}
            removeNote={removeNote}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className={clsx("mt-1 text-lg font-semibold tabular-nums", tone === "green" ? "text-tp-green" : tone === "red" ? "text-tp-red" : "text-zinc-100")}>{value}</p>
    </div>
  );
}

function SignalCard({ signal, check, minute, onAsk }: { signal: TvSignal; check: SignalCheck; minute: number; onAsk: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const v = check.verdict;
  return (
    <li className={clsx("tp-flow-scan overflow-hidden rounded-xl border bg-white/[0.02]", v === "go" ? "border-tp-green/25" : v === "caution" ? "border-tp-yellow/25" : "border-tp-red/25")}>
      <div className="flex flex-col gap-3 p-3 sm:flex-row">
        <Snapshot closes={signal.closes} vwaps={signal.vwaps} level={signal.level} side={signal.side} width={200} height={68} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] text-zinc-500">{minuteLabel(minute)}</span>
            <span className="text-sm font-semibold text-zinc-100">{signal.symbol}</span>
            <Chip tone="blue">{setupLabel(signal.setup)}</Chip>
            {signal.side && <Chip tone={signal.side === "long" ? "green" : "red"}>{signal.side}</Chip>}
            {signal.test && <Chip>Test</Chip>}
          </div>
          <p className="mt-1 font-mono text-[12px] text-zinc-400">
            {signal.price != null && <>@ {signal.price.toLocaleString("en-US")}</>}
            {signal.vwap != null && <> · VWAP {signal.vwap.toLocaleString("en-US")}</>}
            {signal.level != null && <> · {signal.levelName || "level"} {signal.level.toLocaleString("en-US")}</>}
            {signal.tf && <> · {signal.tf}m</>}
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-zinc-200">
            <span className={clsx("font-semibold", v === "go" ? "text-tp-green" : v === "caution" ? "text-tp-yellow" : "text-tp-red")}>
              {v === "go" ? "Cleared." : v === "caution" ? "Caution." : "Wait."}
            </span>{" "}
            {check.headline}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button onClick={() => setOpen((o) => !o)} className="text-[12px] font-medium text-zinc-400 hover:text-zinc-100">
              {open ? "Hide checks" : `See ${check.checks.length} checks`}
            </button>
            <button
              onClick={() => onAsk(`A ${setupLabel(signal.setup)} ${signal.side || ""} signal fired on ${signal.symbol} at ${minuteLabel(minute)}${signal.price != null ? ` at ${signal.price}` : ""}. Pilot said: ${check.headline} From my own history with this setup at this time of day, what should I watch for?`)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-tp-green hover:underline"
            >
              <Sparkles className="h-3 w-3" /> Ask Pilot
            </button>
          </div>
        </div>
      </div>
      {open && (
        <ul className="grid gap-1.5 border-t border-white/[0.05] bg-black/10 px-3 py-2.5 sm:grid-cols-2">
          {check.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-[12px]">
              <span className={clsx("mt-px font-mono font-bold", c.state === "ok" ? "text-tp-green" : c.state === "warn" ? "text-tp-yellow" : "text-tp-red")}>
                {c.state === "ok" ? "✓" : c.state === "warn" ? "!" : "✕"}
              </span>
              <span>
                <span className="text-zinc-300">{c.label}: </span>
                <span className="text-zinc-500">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function QuickNotes({
  accountId,
  today,
  minute,
  notes,
  signalById,
  addNote,
  removeNote,
}: {
  accountId: string;
  today: string;
  minute: number;
  notes: ReturnType<typeof useSessionFlow.getState>["notes"];
  signalById: Map<string, TvSignal>;
  addNote: ReturnType<typeof useSessionFlow.getState>["addNote"];
  removeNote: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const { hydrate, getNote, saveNote } = useDailyNotesStore();
  const add = () => {
    if (!text.trim()) return;
    addNote({ accountId, date: today, at: Date.now(), text: text.trim(), auto: false });
    setText("");
    setSaved(false);
  };
  const toJournal = async () => {
    await hydrate();
    const existing = getNote(today, accountId)?.content || "";
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const list = [...notes]
      .sort((a, b) => a.at - b.at)
      .map((n) => `<li><b>${new Date(n.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</b> ${esc(n.text)}</li>`)
      .join("");
    const block = `<h3>Session notes (Pilot)</h3><ul>${list}</ul>`;
    // Replace a previous export rather than stacking copies of it.
    const base = existing.replace(/<h3>Session notes \(Pilot\)<\/h3><ul>[\s\S]*?<\/ul>/, "");
    saveNote(today, `${base}${block}`, accountId);
    setSaved(true);
  };
  return (
    <Card
      title="Quick notes"
      action={
        notes.length ? (
          <button onClick={toJournal} className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-400 hover:text-zinc-100">
            {saved ? <Check className="h-3.5 w-3.5 text-tp-green" /> : <BookOpen className="h-3.5 w-3.5" />}
            {saved ? "In your journal" : "Save to journal"}
          </button>
        ) : null
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`${minuteLabel(minute)}: what you see, what you feel…`}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-tp-green/40 focus:outline-none"
        />
        <button type="submit" aria-label="Add note" className="grid w-10 place-items-center rounded-lg bg-tp-green/15 text-tp-green hover:bg-tp-green/25">
          <NotebookPen className="h-4 w-4" />
        </button>
      </form>
      {notes.length ? (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => {
            const s = n.signalId ? signalById.get(n.signalId) : undefined;
            return (
              <li key={n.id} className="group flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
                {s && <Snapshot closes={s.closes} vwaps={s.vwaps} level={s.level} side={s.side} width={84} height={40} className="shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug text-zinc-200">{n.text}</p>
                  <p className="mt-1 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                    {new Date(n.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}
                    {n.auto && <span className="text-tp-green">✓ Auto-captured</span>}
                  </p>
                </div>
                <button aria-label="Delete note" onClick={() => removeNote(n.id)} className="self-start text-zinc-600 opacity-0 hover:text-zinc-200 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] text-zinc-500">Signals write their own note with a snapshot. Add yours in between.</p>
      )}
    </Card>
  );
}
