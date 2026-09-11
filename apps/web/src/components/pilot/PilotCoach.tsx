"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  CalendarCheck,
  Gauge,
  Loader2,
  MessageSquarePlus,
  ShieldAlert,
  Sparkles,
  Square,
  Trophy,
} from "lucide-react";
import clsx from "clsx";
import type { Account } from "@/store/accountStore";
import {
  DEFAULT_SETTINGS,
  inspectTrade,
  money,
  orderedTrades,
  playbookStats,
} from "@/lib/pilot/workspace";
import {
  PROVIDERS,
  requestCoaching,
  type ModelConfig,
} from "@/lib/pilot/models";

export function accountContext(account: Account) {
  const rules = account.pilotSettings?.rules || DEFAULT_SETTINGS.rules;
  const trades = orderedTrades(account.trades)
    .slice(-100)
    .map((t) => ({
      id: t.id,
      date: t.date,
      time: t.time,
      symbol: t.symbol,
      side: t.side,
      quantity: t.quantity,
      netPL: t.netPL,
      duration: t.duration,
      strategy: t.strategy,
      notes: t.notes?.slice(0, 1500),
      flags: inspectTrade(t, account.trades, rules).flags,
    }));
  return {
    scope: "Selected account only; latest 100 trades maximum",
    totalTrades: account.trades.length,
    demo: account.type === "demo",
    rules,
    trades,
  };
}
function builtIn(question: string, account: Account) {
  if (!account.trades.length)
    return "This account has no trades yet. Log a trade or connect your data to begin.";
  const q = question.toLowerCase();
  const rules = account.pilotSettings?.rules || DEFAULT_SETTINGS.rules;
  const all = orderedTrades(account.trades);
  if (/setup|pattern|edge|playbook/.test(q)) {
    const rows = playbookStats(all);
    return rows.length
      ? rows
          .slice(0, 3)
          .map(
            (r) =>
              `${r.name}: ${r.count} trades, ${money(r.pnl)} net, ${Math.round((r.wins / r.count) * 100)}% wins.${r.count < 20 ? " Small sample." : ""}`,
          )
          .join("\n\n") +
          "\n\nThis ranks recorded setups by total P&L, not future profitability."
      : "Record a setup on your trades so I can compare them.";
  }
  if (/rule|loss|revenge|risk|limit/.test(q)) {
    const flags = all.flatMap((t) =>
      inspectTrade(t, all, rules).flags.map(
        (f) => `• ${t.date.slice(0, 10)} · ${t.symbol} — ${f}`,
      ),
    );
    return flags.length
      ? `${flags.length} rule ${flags.length === 1 ? "break" : "breaks"} across ${all.length} trades. Most recent:\n\n${flags.slice(-5).join("\n")}\n\nThese are checks against your configured rules, not verified firm compliance.`
      : "No configured-rule breaches found in available closed-trade data. Missing timestamps and open-position risk cannot be verified.";
  }
  if (/session|review|performance|pnl/.test(q)) {
    const latest = all[all.length - 1].date.slice(0, 10);
    const day = all.filter((t) => t.date.slice(0, 10) === latest);
    return `Latest recorded session · ${latest}\n\n${day.length} ${day.length === 1 ? "trade" : "trades"}, ${money(day.reduce((s, t) => s + t.netPL, 0))} net, ${Math.round((day.filter((t) => t.netPL > 0).length / day.length) * 100)}% win rate.\n\nOpen a trade review to inspect its rule observations and add your own execution notes.`;
  }
  return "Built-in analysis can summarize your last session, compare recorded setups, or check your rules. Connect a model in Settings for open-ended coaching.";
}

const PROMPTS = [
  { icon: CalendarCheck, text: "Review my last session" },
  { icon: ShieldAlert, text: "Where am I breaking my rules?" },
  { icon: Trophy, text: "Which setup is working best?" },
  { icon: Gauge, text: "How is my risk looking?" },
];

/** Chat-first hero: the main way to use Pilot. */
export function PilotCoach({
  account,
  model,
}: {
  account: Account;
  model: ModelConfig;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  // A question handed over from the dashboard coach (?ask=...) is asked once, then cleared from the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("ask");
    if (!q) return;
    params.delete("ask");
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    void ask(q.slice(0, 500));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);
  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const next = [
      ...messages,
      { role: "user" as const, content: question.trim() },
    ];
    setInput("");
    setError("");
    setMessages(next);
    setBusy(true);
    controller.current = new AbortController();
    try {
      const content =
        model.provider === "local"
          ? builtIn(question, account)
          : await requestCoaching(
              model,
              next.slice(-15),
              accountContext(account),
              controller.current.signal,
            );
      setMessages([...next, { role: "assistant", content }]);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "Response stopped."
          : e instanceof Error
            ? e.message
            : "Request failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    controller.current?.abort();
    setMessages([]);
    setError("");
    field.current?.focus();
  };
  const chatting = messages.length > 0 || busy;
  const local = model.provider === "local";

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-tp-card px-5 py-8 sm:px-10 sm:py-10"
      style={{
        backgroundImage:
          "radial-gradient(70% 55% at 50% 0%, rgba(0,214,143,0.10) 0%, transparent 70%), radial-gradient(40% 40% at 90% 100%, rgba(79,156,249,0.07) 0%, transparent 70%)",
      }}
    >
      {!chatting ? (
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
            <Sparkles className="h-6 w-6 text-tp-green" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-[28px]">
            What do you want to know about your trading?
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Pilot has read {account.trades.length} trades from{" "}
            <span className="font-medium text-zinc-200">{account.name}</span>.
            Ask in plain English.
          </p>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
              <Sparkles className="h-4 w-4 text-tp-green" />
            </div>
            <span className="text-sm font-semibold text-zinc-100">Ask Pilot</span>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>
      )}

      {chatting && (
        <div
          ref={scroller}
          aria-live="polite"
          className="mx-auto max-h-[440px] max-w-3xl space-y-4 overflow-y-auto pb-2 pr-1"
        >
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-sm text-zinc-100">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-tp-green/15">
                  <Sparkles className="h-3.5 w-3.5 text-tp-green" />
                </div>
                <p className="min-w-0 max-w-[85%] whitespace-pre-line rounded-2xl rounded-tl-md border border-white/[0.06] bg-black/20 px-4 py-3 text-sm leading-relaxed text-zinc-200">
                  {m.content}
                </p>
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 pl-10 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading your trades…
            </div>
          )}
          {error && (
            <p role="alert" className="pl-10 text-sm text-tp-red">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Composer */}
      <form
        className={clsx("mx-auto", chatting ? "mt-4 max-w-3xl" : "mt-7 max-w-2xl")}
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label className="sr-only" htmlFor="pilot-question">
          Ask Pilot
        </label>
        <div className="flex items-end gap-2 rounded-2xl bg-black/30 p-2 pl-4 ring-1 ring-inset ring-white/[0.09] transition focus-within:ring-tp-green/40">
          <textarea
            ref={field}
            id="pilot-question"
            rows={1}
            maxLength={6000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={chatting ? "Ask a follow-up…" : "e.g. Why did I lose money last week?"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            style={{ outline: "none" }}
          />
          {busy ? (
            <button
              type="button"
              aria-label="Stop response"
              onClick={() => controller.current?.abort()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.08] text-zinc-200 hover:bg-white/[0.12]"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tp-green text-[#0D1628] hover:brightness-110 disabled:bg-white/[0.06] disabled:text-zinc-500"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          {local
            ? "Built-in analysis · runs privately on this device"
            : `${PROVIDERS[model.provider].label} · ${model.model || "choose a model ID"} · latest 100 trades`}
        </p>
      </form>

      {/* Suggested questions */}
      <div className={clsx("mx-auto flex flex-wrap justify-center gap-2", chatting ? "mt-3 max-w-3xl" : "mt-5 max-w-2xl")}>
        {PROMPTS.map(({ icon: Icon, text }) => (
          <button
            key={text}
            type="button"
            disabled={busy}
            onClick={() => ask(text)}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-zinc-300 hover:border-tp-green/30 hover:bg-tp-green/[0.06] hover:text-zinc-50"
          >
            <Icon className="h-3.5 w-3.5 text-tp-green" />
            {text}
          </button>
        ))}
      </div>
    </section>
  );
}
