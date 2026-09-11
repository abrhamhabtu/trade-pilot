"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  FilePenLine,
  ShieldCheck,
  Tags,
} from "lucide-react";
import type { Account } from "@/store/accountStore";
import {
  DEFAULT_SETTINGS,
  inspectTrade,
  money,
  orderedTrades,
  playbookStats,
} from "@/lib/pilot/workspace";

const examples = [
  { id: "tags", label: "Auto-tag trades", icon: Tags },
  { id: "notes", label: "Draft a note", icon: FilePenLine },
  { id: "rules", label: "Catch a rule breach", icon: ShieldCheck },
  { id: "edge", label: "Compare setups", icon: BookOpen },
] as const;
type Example = (typeof examples)[number]["id"];

export function DemoPilotExamples({
  account,
  openTrade,
  openSession,
  openEdge,
}: {
  account: Account;
  openTrade: (id: string) => void;
  openSession: (date: string) => void;
  openEdge: () => void;
}) {
  const [example, setExample] = useState<Example>("rules");
  const rules = account.pilotSettings?.rules || DEFAULT_SETTINGS.rules;
  const data = useMemo(() => {
    const trades = orderedTrades(account.trades);
    const inspected = trades.map((trade) => ({
      trade,
      ...inspectTrade(trade, trades, rules),
    }));
    const flagged = [...inspected]
      .filter((r) => r.flags.length)
      .sort(
        (a, b) =>
          b.flags.length - a.flags.length || a.trade.netPL - b.trade.netPL,
      )[0];
    const tagged =
      inspected.find(
        (r) => r.trade.strategy && r.tags.includes("Opening session"),
      ) || inspected[0];
    return {
      flagged,
      tagged,
      observations: inspected.reduce((sum, r) => sum + r.flags.length, 0),
      setups: playbookStats(trades),
      sessions: new Set(trades.map((t) => t.date.slice(0, 10))).size,
    };
  }, [account.trades, rules]);
  if (!data.tagged) return null;
  const row = example === "rules" ? data.flagged : data.tagged;
  return (
    <section className="pilot-demo" aria-label="Demo analysis examples">
      <div className="pilot-demo-heading">
        <div>
          <span className="pilot-eyebrow">
            SEE PILOT IN ACTION · DEMO ACCOUNT
          </span>
          <h2>Here’s what Pilot found in your demo trades.</h2>
          <p>
            {account.trades.length} trades · {data.sessions} sessions ·{" "}
            {data.observations} rule observations. These examples are calculated
            from the account’s existing history.
          </p>
        </div>
        <span className="pilot-demo-label">
          <Check size={12} />
          Built-in analysis
        </span>
      </div>
      <div className="pilot-demo-tabs" aria-label="Choose an analysis example">
        {examples.map((item) => (
          <button
            key={item.id}
            aria-pressed={example === item.id}
            onClick={() => setExample(item.id)}
          >
            <item.icon size={15} />
            {item.label}
          </button>
        ))}
      </div>
      <div className="pilot-demo-result" aria-live="polite">
        {example === "edge" ? (
          <>
            <div className="pilot-demo-source">
              <span className="pilot-eyebrow">THE EVIDENCE</span>
              <h3>{data.setups.length} recorded setups</h3>
              <p>
                All {account.trades.length} demo trades, grouped by setup. No
                chart patterns guessed.
              </p>
              <button className="pilot-text-link" onClick={openEdge}>
                Explore all setups <ArrowRight size={14} />
              </button>
            </div>
            <div className="pilot-demo-output">
              <span className="pilot-eyebrow">PILOT’S COMPARISON</span>
              {data.setups.length ? (
                <>
                  <h3>{data.setups[0].name} leads this sample.</h3>
                  <div className="pilot-demo-comparison">
                    {[
                      data.setups[0],
                      ...(data.setups.length > 1
                        ? [data.setups[data.setups.length - 1]]
                        : []),
                    ].map((s) => (
                      <div key={s.name}>
                        <span>
                          <strong>{s.name}</strong>
                          <small>
                            {s.count} trades ·{" "}
                            {Math.round((s.wins / s.count) * 100)}% win rate
                          </small>
                        </span>
                        <strong
                          className={
                            s.pnl < 0 ? "pilot-negative" : "pilot-positive"
                          }
                        >
                          {money(s.pnl)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="pilot-small pilot-muted">
                    A comparison of recorded results, not proof of a repeatable
                    edge. Small samples need more evidence.
                  </p>
                </>
              ) : (
                <p>Record setup names to compare your trades.</p>
              )}
            </div>
          </>
        ) : row ? (
          <>
            <div className="pilot-demo-source">
              <span className="pilot-eyebrow">THE TRADE</span>
              <h3>
                {row.trade.symbol} <span>{row.trade.side}</span>
              </h3>
              <p>
                {row.trade.date.slice(0, 10)} ·{" "}
                {row.trade.time || "Time unrecorded"}
              </p>
              <dl>
                <div>
                  <dt>Net P&L</dt>
                  <dd
                    className={
                      row.trade.netPL < 0 ? "pilot-negative" : "pilot-positive"
                    }
                  >
                    {money(row.trade.netPL)}
                  </dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{row.trade.quantity} contracts</dd>
                </div>
                <div>
                  <dt>Recorded setup</dt>
                  <dd>{row.trade.strategy || "Not recorded"}</dd>
                </div>
              </dl>
              <button
                className="pilot-text-link"
                onClick={() => openTrade(row.trade.id)}
              >
                Open this trade <ArrowRight size={14} />
              </button>
            </div>
            <div className="pilot-demo-output">
              <span className="pilot-eyebrow">
                {example === "tags"
                  ? "PILOT’S SUGGESTED TAGS"
                  : example === "notes"
                    ? "PILOT’S NOTE DRAFT"
                    : "WHAT PILOT CAUGHT"}
              </span>
              {example === "tags" ? (
                <>
                  <h3>From a fill to an organized journal.</h3>
                  <div className="pilot-demo-tag-list">
                    {row.tags.map((tag) => (
                      <span key={tag}>
                        <Check size={12} />
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p>
                    Setup comes from “{row.trade.strategy || "unrecorded"},”
                    direction from the trade, and session from its{" "}
                    {row.trade.time || "missing"} entry time.
                  </p>
                  <p className="pilot-small pilot-muted">
                    Preview only. Open the trade to edit and save these tags.
                  </p>
                </>
              ) : example === "notes" ? (
                <>
                  <h3>A review you can start with.</h3>
                  <blockquote>{row.note}</blockquote>
                  <p className="pilot-small pilot-muted">
                    This factual draft hasn’t replaced your saved note. Add your
                    own observations before saving.
                  </p>
                </>
              ) : (
                <>
                  <h3>
                    {row.flags.length}{" "}
                    {row.flags.length === 1 ? "reason" : "reasons"} to review
                    this trade.
                  </h3>
                  <ul className="pilot-demo-findings">
                    {row.flags.map((flag) => (
                      <li key={flag}>
                        <ShieldCheck size={15} />
                        {flag}
                      </li>
                    ))}
                  </ul>
                  <p className="pilot-small pilot-muted">
                    Checked against{" "}
                    {account.pilotSettings
                      ? "this account’s saved personal limits"
                      : "starter limits"}
                    : {rules.maxTrades} trades/day, {rules.maxContracts}{" "}
                    contracts, {money(rules.dailyLoss)} daily realized loss
                    limit, finish at {rules.finishTime}. These are not verified
                    firm rules.
                  </p>
                  <button
                    className="pilot-text-link"
                    onClick={() => openSession(row.trade.date.slice(0, 10))}
                  >
                    See the full session <ArrowRight size={14} />
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="pilot-demo-output">
            <h3>No breaches found under your current rules.</h3>
            <p>
              Pilot checked the available demo trades. Choose another example to
              see tags, a note draft, or setup comparisons.
            </p>
          </div>
        )}
      </div>
      <p className="pilot-demo-footnote">
        Demo data · calculated on this device · no connected language model
        required. Your real accounts use the same review workflow.
      </p>
    </section>
  );
}
