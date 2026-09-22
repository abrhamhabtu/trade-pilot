"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bookmark,
  CalendarCheck,
  Check,
  Gauge,
  History,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  Search,
  Sparkles,
  Square,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useModelStore } from "@/lib/pilot/modelStore";
import { PilotMarkdown } from "./PilotMarkdown";
import { useAccountStore, type Account } from "@/store/accountStore";
import { useRoutineStore } from "@/store/routineStore";
import { localSessionDate } from "@/lib/sessionRisk";
import {
  DEFAULT_SETTINGS,
  inspectTrade,
  money,
  orderedTrades,
  playbookStats,
} from "@/lib/pilot/workspace";
import { PROVIDERS, type ModelConfig } from "@/lib/pilot/models";
import type { ChatTurn } from "@/lib/pilot/chatTypes";
import { buildFactSheet } from "@/lib/pilot/facts";
import { lookupsIn, runPilotTurn } from "@/lib/pilot/runChat";
import { newChatId, takeaway, usePilotMemory } from "@/lib/pilot/memoryStore";

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
  { icon: Wallet, text: "Can I take a payout this week?" },
  { icon: Gauge, text: "Am I trading too big for my drawdown?" },
  { icon: CalendarCheck, text: "Review my last session" },
  { icon: Trophy, text: "Which setup is working best?" },
];

type Item = { kind: "user"; text: string } | { kind: "answer"; text: string; lookups: string[] };

/** The transcript as the trader reads it: questions, and one answer per question with the lookups behind it. */
function toItems(turns: ChatTurn[]): Item[] {
  const items: Item[] = [];
  for (const t of turns) {
    if (t.role === "user") items.push({ kind: "user", text: t.content });
    else if (t.role === "assistant") {
      const last = items.at(-1);
      const lookups = lookupsIn([t]);
      if (last?.kind === "answer") {
        if (t.content) last.text = last.text ? `${last.text}\n\n${t.content}` : t.content;
        last.lookups.push(...lookups);
      } else items.push({ kind: "answer", text: t.content, lookups });
    }
  }
  return items.filter((i) => i.kind === "user" || i.text);
}

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function AnswerActions({ text, accountId }: { text: string; accountId: string }) {
  const addNote = usePilotMemory((s) => s.addNote);
  const notes = usePilotMemory((s) => s.notes);
  const { tradingRules, addTradingRule } = useRoutineStore();
  const line = takeaway(text);
  if (!line) return null;
  const remembered = notes.some((n) => n.accountId === accountId && n.text === line.replace(/\s+/g, " ").slice(0, 280));
  const ruled = tradingRules.some((r) => r.text.trim() === line.trim());
  const chip =
    "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-10">
      <button
        type="button"
        disabled={remembered}
        onClick={() => addNote(accountId, line)}
        title={`Pilot will keep this in mind: “${line}”`}
        className={clsx(chip, remembered ? "text-tp-green ring-tp-green/25" : "text-zinc-400 ring-white/[0.08] hover:bg-white/[0.05] hover:text-zinc-100")}
      >
        {remembered ? <Check className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
        {remembered ? "Remembered" : "Remember"}
      </button>
      <button
        type="button"
        disabled={ruled}
        onClick={() => addTradingRule(line, "mindset")}
        title={`Add to your Preflight rules: “${line}”`}
        className={clsx(chip, ruled ? "text-tp-green ring-tp-green/25" : "text-zinc-400 ring-white/[0.08] hover:bg-white/[0.05] hover:text-zinc-100")}
      >
        {ruled ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        {ruled ? "In your rules" : "Make it a rule"}
      </button>
    </div>
  );
}

/** Chat-first hero: the main way to use Pilot. */
export function PilotCoach({
  account,
  model,
}: {
  account: Account;
  model: ModelConfig;
}) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [chatId, setChatId] = useState(() => newChatId());
  const [live, setLive] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const hydrated = useModelStore((s) => s.hydrated);
  const accounts = useAccountStore((s) => s.accounts);
  const gamePlans = useRoutineStore((s) => s.gamePlans);
  const memory = usePilotMemory();
  const urlAsk = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => usePilotMemory.getState().hydrate(), []);

  const notes = memory.notes.filter((n) => n.accountId === account.id);
  const chats = memory.chats.filter((c) => c.accountId === account.id);

  // A question handed over from elsewhere in the app (?ask=...) is asked once,
  // then cleared from the URL. Two things have to settle first, or the answer
  // is thrown away: the saved model config has to hydrate (this component is
  // keyed by the model, so hydrating remounts it), and an account named in the
  // link has to be selected. Until both are true, leave the URL alone.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("ask");
    if (!q) return;
    const wanted = params.get("account");
    if (wanted && wanted !== account.id) return;
    if (urlAsk.current) return;
    urlAsk.current = true;
    const pending = ask(q.slice(0, 500));
    const mine = controller.current;
    void pending.then(() => {
      urlAsk.current = false;
      // Clear ?ask= only once the question has actually been answered. An
      // aborted attempt leaves it in place so the next mount can retry it —
      // Strict Mode aborts the first attempt on every mount in development.
      if (mine?.signal.aborted) return;
      params.delete("ask");
      const rest = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${rest ? `?${rest}` : ""}`,
      );
    });
    return () => {
      urlAsk.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, hydrated]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, live, status, busy]);

  /** The fact sheet plus a slice of raw trades, rebuilt for every question so it is current. */
  const buildContext = () => {
    const today = localSessionDate();
    const plan = gamePlans[today];
    const rules = account.pilotSettings?.rules || DEFAULT_SETTINGS.rules;
    return {
      facts: buildFactSheet({
        account,
        accounts,
        today,
        plan: plan ? { maxLoss: plan.maxLoss, maxProfit: plan.maxProfit, maxTrades: plan.maxTrades, stopTime: plan.stopTime } : undefined,
        notes: notes.map((n) => n.text),
      }),
      pilotRules: rules,
      recentTrades: orderedTrades(account.trades)
        .slice(-40)
        .map((t) => ({ date: t.date.slice(0, 10), time: t.time, symbol: t.symbol, side: t.side, qty: t.quantity, netPL: t.netPL, setup: t.strategy, flags: inspectTrade(t, account.trades, rules).flags })),
    };
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const prior = turns;
    setInput("");
    setError("");
    setLive("");
    setTurns([...prior, { role: "user", content: q }]);
    setBusy(true);
    const mine = new AbortController();
    controller.current = mine;
    // A superseded attempt must not write over the turn that replaced it.
    const current = () => controller.current === mine;
    try {
      const next: ChatTurn[] =
        model.provider === "local"
          ? [...prior, { role: "user", content: q }, { role: "assistant", content: builtIn(q, account) }]
          : await runPilotTurn({
              config: model,
              history: prior,
              question: q,
              context: buildContext(),
              toolContext: { account, accounts, today: localSessionDate() },
              signal: mine.signal,
              onText: (text) => current() && setLive(text),
              onStatus: (s) => current() && setStatus(s),
            });
      if (!current()) return;
      setTurns(next);
      const title = (next.find((t) => t.role === "user") as { content: string } | undefined)?.content ?? q;
      memory.saveChat({ id: chatId, accountId: account.id, title: title.slice(0, 90), updatedAt: new Date().toISOString(), turns: next });
    } catch (e) {
      if (!current()) return;
      const stopped = e instanceof Error && e.name === "AbortError";
      // A failed turn leaves no answer, so take the question back out of the
      // transcript and return it to the box — otherwise unanswered questions
      // pile up above a single error and the next send resends them as context.
      setTurns(prior);
      if (!stopped) setInput(q);
      setError(stopped ? "Response stopped." : e instanceof Error ? e.message : "Request failed.");
    } finally {
      if (current()) {
        setBusy(false);
        setStatus(null);
        setLive("");
      }
    }
  };
  const reset = () => {
    controller.current?.abort();
    setTurns([]);
    setChatId(newChatId());
    setError("");
    setShowHistory(false);
    field.current?.focus();
  };
  const resume = (id: string) => {
    const chat = chats.find((c) => c.id === id);
    if (!chat || busy) return;
    setTurns(chat.turns);
    setChatId(chat.id);
    setError("");
    setShowHistory(false);
  };
  // An error counts as transcript: a first message that fails rolls back to an
  // empty transcript, and the reason it failed still has to be on screen.
  const chatting = turns.length > 0 || busy || !!error;
  const local = model.provider === "local";
  const items = toItems(turns);

  const history = (
    <ul className="max-h-64 space-y-0.5 overflow-y-auto">
      {chats.map((c) => (
        <li key={c.id} className="group flex items-center gap-2">
          <button
            type="button"
            onClick={() => resume(c.id)}
            className={clsx(
              "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition hover:bg-white/[0.05]",
              c.id === chatId ? "text-zinc-50" : "text-zinc-300",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="truncate">{c.title}</span>
            <span className="ml-auto shrink-0 text-[11px] text-zinc-500">{ago(c.updatedAt)}</span>
          </button>
          <button
            type="button"
            aria-label={`Delete chat: ${c.title}`}
            onClick={() => {
              memory.deleteChat(c.id);
              if (c.id === chatId) reset();
            }}
            className="rounded-md p-1 text-zinc-600 opacity-0 transition hover:text-tp-red group-hover:opacity-100 focus:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );

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
            Pilot knows {account.trades.length} trades from{" "}
            <span className="font-medium text-zinc-200">{account.name}</span>, your room to lose, payouts, fees and firm rules. Ask in plain English.
          </p>
        </div>
      ) : (
        <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
              <Sparkles className="h-4 w-4 text-tp-green" />
            </div>
            <span className="text-sm font-semibold text-zinc-100">Ask Pilot</span>
          </div>
          <div className="flex items-center gap-1">
            {chats.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                aria-expanded={showHistory}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
              >
                <History className="h-3.5 w-3.5" />
                History
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New chat
            </button>
          </div>
          {showHistory && (
            <div className="absolute right-0 top-10 z-20 w-80 rounded-xl border border-white/[0.08] bg-tp-raised p-1.5 shadow-2xl shadow-black/50">
              {history}
            </div>
          )}
        </div>
      )}

      {chatting && (
        <div
          ref={scroller}
          aria-live="polite"
          className="mx-auto max-h-[520px] max-w-3xl space-y-4 overflow-y-auto pb-2 pr-1"
        >
          {items.map((m, i) =>
            m.kind === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-sm text-zinc-100">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={i}>
                <div className="flex gap-3">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-tp-green/15">
                    <Sparkles className="h-3.5 w-3.5 text-tp-green" />
                  </div>
                  <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-white/[0.06] bg-black/20 px-4 py-3">
                    <PilotMarkdown text={m.text} />
                    {m.lookups.length > 0 && (
                      <p className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/[0.05] pt-2 text-[11px] text-zinc-500">
                        <Search className="h-3 w-3" /> Checked: {[...new Set(m.lookups)].join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                {!busy && <AnswerActions text={m.text} accountId={account.id} />}
              </div>
            ),
          )}
          {busy && (live || status) && (
            <div className="flex gap-3">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-tp-green/15">
                <Sparkles className="h-3.5 w-3.5 text-tp-green" />
              </div>
              <div className="min-w-0 max-w-[85%]">
                {live && (
                  <div className="rounded-2xl rounded-tl-md border border-white/[0.06] bg-black/20 px-4 py-3">
                    <PilotMarkdown text={live} />
                  </div>
                )}
                {status && (
                  <p className="mt-1.5 flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {status}
                  </p>
                )}
              </div>
            </div>
          )}
          {busy && !live && !status && (
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
            ? "Built-in analysis · runs privately on this device · connect a model in Settings for full coaching"
            : `${PROVIDERS[model.provider].label} · ${model.model || "choose a model ID"} · fact sheet + journal lookups`}
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

      {/* Memory: past chats to pick up, and what Pilot keeps in mind */}
      {!chatting && chats.length > 0 && (
        <div className="mx-auto mt-8 max-w-2xl">
          <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Recent chats</p>
          {history}
        </div>
      )}
      {notes.length > 0 && (
        <div className={clsx("mx-auto", chatting ? "mt-5 max-w-3xl" : "mt-6 max-w-2xl")}>
          <p className="mb-2 flex items-center gap-1.5 px-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            <Bookmark className="h-3 w-3" /> Pilot remembers
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {notes.map((n) => (
              <li key={n.id} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/[0.04] py-1 pl-2.5 pr-1 text-xs text-zinc-300 ring-1 ring-inset ring-white/[0.06]">
                <span className="truncate">{n.text}</span>
                <button type="button" aria-label={`Forget: ${n.text}`} onClick={() => memory.deleteNote(n.id)} className="rounded p-0.5 text-zinc-500 hover:text-tp-red">
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
