"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, AudioLines, Loader2, Square } from "lucide-react";
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
        (f) => `${t.date.slice(0, 10)} · ${t.symbol} [${t.id}]: ${f}`,
      ),
    );
    return flags.length
      ? `${flags.length} observations across ${all.length} trades. Most recent:\n\n${flags.slice(-5).join("\n\n")}\n\nThese are configured-rule checks, not a diagnosis of your emotions or verified firm compliance.`
      : "No configured-rule breaches found in available closed-trade data. Missing timestamps and open-position risk cannot be verified.";
  }
  if (/session|review|performance|pnl/.test(q)) {
    const latest = all[all.length - 1].date.slice(0, 10);
    const day = all.filter((t) => t.date.slice(0, 10) === latest);
    return `Latest recorded session · ${latest}\n\n${day.length} ${day.length === 1 ? "trade" : "trades"}, ${money(day.reduce((s, t) => s + t.netPL, 0))} net, ${Math.round((day.filter((t) => t.netPL > 0).length / day.length) * 100)}% win rate.\n\nOpen a trade review to inspect its rule observations and add your own execution notes.`;
  }
  return "Built-in analysis can summarize your last session, compare recorded setups, or check your rules. Choose a connected model in Models for open-ended coaching.";
}
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
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
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
  return (
    <section className="pilot-coach">
      <header>
        <div className="pilot-coach-icon">
          <AudioLines size={19} />
        </div>
        <div>
          <h2>Ask Pilot</h2>
          <p>{PROVIDERS[model.provider].label}</p>
        </div>
        <span className="pilot-status">
          {model.provider === "local" ? "Private" : "On demand"}
        </span>
      </header>
      <div className="pilot-conversation" aria-live="polite">
        {!messages.length && (
          <div className="pilot-coach-welcome">
            <span className="pilot-eyebrow">A SECOND PAIR OF EYES</span>
            <h3>
              Let’s look at
              <br />
              your trading.
            </h3>
            <p>
              I can work with {account.trades.length} trades from{" "}
              <strong>{account.name}</strong>. What would you like to
              understand?
            </p>
            <div className="pilot-prompts">
              {[
                "Review my last session",
                "Where am I breaking my rules?",
                "Compare my recorded setups",
              ].map((q) => (
                <button key={q} onClick={() => ask(q)}>
                  {q}
                  <ArrowUp size={13} />
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`pilot-message ${m.role}`}>
            <span>{m.role === "user" ? "You" : "Pilot"}</span>
            <p>{m.content}</p>
          </div>
        ))}
        {busy && (
          <div className="pilot-muted pilot-inline-info">
            <Loader2 size={15} className="animate-spin" />
            Reading your account context…
          </div>
        )}
        {error && (
          <p role="alert" className="pilot-error">
            {error}
          </p>
        )}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label className="sr-only" htmlFor="pilot-question">
          Ask Pilot
        </label>
        <textarea
          id="pilot-question"
          rows={2}
          maxLength={6000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your trading…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
        />
        <div>
          <span>
            {model.provider === "local"
              ? "Built-in · no model connected"
              : `${model.model || "Choose a model ID"} · latest 100 trades`}
          </span>
          {busy ? (
            <button
              type="button"
              aria-label="Stop response"
              onClick={() => controller.current?.abort()}
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <ArrowUp size={17} />
            </button>
          )}
        </div>
      </form>
      <p className="pilot-coach-footnote">
        Grounded in this account. Always review the evidence.
      </p>
    </section>
  );
}
