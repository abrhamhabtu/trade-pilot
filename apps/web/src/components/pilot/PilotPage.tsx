"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  FilePenLine,
  Layers3,
  Plus,
  Radar,
  ShieldCheck,
  Sparkles,
  Tags,
  X,
} from "lucide-react";
import { useAccountStore, type Account } from "@/store/accountStore";
import type { Trade } from "@/store/tradingStore";
import {
  DEFAULT_SETTINGS,
  inspectTrade,
  money,
  orderedTrades,
  playbookStats,
  prepareReviews,
  type PilotSettings,
} from "@/lib/pilot/workspace";
import { DEFAULT_MODEL, type ModelConfig } from "@/lib/pilot/models";
import { DemoPilotExamples } from "./DemoPilotExamples";
import { ModelPanel } from "./ModelPanel";
import { PilotCoach } from "./PilotCoach";
import { TradeReview } from "./TradeReview";
import { ManualTrade } from "./ManualTrade";
import "./pilot.css";

type View = "overview" | "reviews" | "playbook" | "settings" | "models";
const tabs: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "reviews", label: "Trade reviews" },
  { id: "playbook", label: "Your edge" },
  { id: "settings", label: "Automations & rules" },
  { id: "models", label: "Models" },
];

export function PilotPage() {
  const {
    accounts,
    selectedAccountId,
    selectAccount,
    showAllAccounts,
    initializeFromIDB,
  } = useAccountStore();
  const [view, setView] = useState<View>("overview");
  const [model, setModel] = useState<ModelConfig>(DEFAULT_MODEL);
  useEffect(() => {
    initializeFromIDB();
  }, [initializeFromIDB]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("pilot_model_v1") || "null",
      );
      if (saved && Object.hasOwn(PROVIDER_IDS, saved.provider))
        setModel({ ...DEFAULT_MODEL, ...saved, apiKey: "" });
    } catch {
      /* retain default */
    }
  }, []);
  const saveModel = (value: ModelConfig) => {
    setModel(value);
    try {
      const { apiKey, ...safe } = value;
      localStorage.setItem("pilot_model_v1", JSON.stringify(safe));
    } catch {
      /* in-memory config still works */
    }
  };
  const account = accounts.find((a) => a.id === selectedAccountId);
  return (
    <div className="pilot-workspace">
      <header className="pilot-header">
        <div>
          <div className="pilot-brand">
            <AudioLines size={21} />
            <span>
              Pilot <span className="pilot-muted">/</span> Intelligence
            </span>
          </div>
          <h1>A clearer read on your trading.</h1>
          <p>Your trades, your rules, your next move. All in one place.</p>
        </div>
        <button className="pilot-button" onClick={() => setView("models")}>
          <Cpu size={15} />
          {model.provider === "local"
            ? "Built-in analysis"
            : model.model || "Choose a model"}
          <ChevronRight size={14} />
        </button>
      </header>
      <div className="pilot-context">
        <div className="pilot-context-icon">
          <Layers3 size={18} />
        </div>
        <label>
          <span>WORKING ACCOUNT</span>
          <select
            aria-label="Pilot account"
            value={account?.id || ""}
            onChange={(e) => selectAccount(e.target.value)}
          >
            {!account && <option value="">Choose account</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.type === "demo" ? " · Demo" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="pilot-context-divider" />
        <div className="pilot-source">
          <span className={`pilot-dot ${account?.syncSource ? "" : "muted"}`} />
          <span>
            {account?.syncSource
              ? `${account.syncSource.provider} · ${account.syncSource.automatic ? "Auto-sync enabled" : "Manual sync"}`
              : account?.type === "demo"
                ? "Sample trades · demo account"
                : "Imported & manually logged trades"}
            <small>
              {account?.syncSource?.lastSynced
                ? `Last synced ${new Date(account.syncSource.lastSynced).toLocaleString()}`
                : `${account?.trades.length || 0} trades in this account`}
            </small>
          </span>
        </div>
        <Link href="/app/accounts" className="pilot-text-link">
          Manage data <ArrowRight size={14} />
        </Link>
      </div>
      {showAllAccounts && (
        <p className="pilot-inline-info">
          Pilot is scoped to {account?.name || "one account"}. Choose an account
          above to keep its rules and trade history separate.
        </p>
      )}
      <nav className="pilot-tabs" aria-label="Pilot sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={view === t.id ? "page" : undefined}
            className={view === t.id ? "active" : ""}
            onClick={() => setView(t.id)}
          >
            {t.label}
            {t.id === "reviews" &&
              !!account?.trades.filter(
                (t) => t.pilotReview && !t.pilotReview.reviewed,
              ).length && (
                <span>
                  {
                    account.trades.filter(
                      (t) => t.pilotReview && !t.pilotReview.reviewed,
                    ).length
                  }
                </span>
              )}
          </button>
        ))}
      </nav>
      {view === "models" ? (
        <ModelPanel config={model} onChange={saveModel} />
      ) : account ? (
        <AccountWorkspace
          key={account.id}
          account={account}
          model={model}
          view={view}
          setView={setView}
        />
      ) : (
        <div className="pilot-empty">
          <Layers3 />
          <h2>Start with an account.</h2>
          <p>
            Create or connect an account to give Pilot your trading context.
          </p>
          <Link className="pilot-button primary" href="/app/accounts">
            Set up an account <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <footer className="pilot-footer">
        <ShieldCheck size={13} /> Account-scoped analysis <span>·</span>{" "}
        Closed-trade data <span>·</span> You stay in control
      </footer>
    </div>
  );
}
const PROVIDER_IDS = {
  local: 1,
  openrouter: 1,
  deepseek: 1,
  kimi: 1,
  opencode: 1,
  ollama: 1,
  custom: 1,
};

function AccountWorkspace({
  account,
  model,
  view,
  setView,
}: {
  account: Account;
  model: ModelConfig;
  view: View;
  setView: (v: View) => void;
}) {
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const settings = account.pilotSettings || DEFAULT_SETTINGS;
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [message, setMessage] = useState("");
  const dates = [...new Set(account.trades.map((t) => t.date.slice(0, 10)))]
    .sort()
    .reverse();
  const [date, setDate] = useState("");
  const session = date || dates[0] || "";
  const day = useMemo(
    () =>
      orderedTrades(
        account.trades.filter((t) => t.date.slice(0, 10) === session),
      ),
    [account.trades, session],
  );
  const checks = useMemo(
    () =>
      day.map((t) => ({
        trade: t,
        ...inspectTrade(t, account.trades, settings.rules),
      })),
    [day, account.trades, settings.rules],
  );
  const flags = checks.flatMap((c) =>
    c.flags.map((text) => ({
      id: c.trade.id,
      symbol: c.trade.symbol,
      time: c.trade.time,
      text,
    })),
  );
  const pnl = day.reduce((sum, t) => sum + t.netPL, 0);
  const pending = account.trades.filter(
    (t) => t.pilotReview && !t.pilotReview.reviewed,
  );
  const run = () => {
    const trades = prepareReviews(account.trades, settings, true);
    updateAccount(account.id, { trades });
    setMessage(
      `Review drafts prepared for ${trades.length} trades. Open a trade to edit and save.`,
    );
    setView("reviews");
  };
  const selected = account.trades.find((t) => t.id === selectedTrade);
  return (
    <>
      {account.type === "demo" && view === "overview" && (
        <DemoPilotExamples
          account={account}
          openTrade={setSelectedTrade}
          openSession={(date) => {
            setDate(date);
            setView("reviews");
          }}
          openEdge={() => setView("playbook")}
        />
      )}
      <div className="pilot-toolbar">
        <div>
          <span className="pilot-eyebrow">
            {view === "settings"
              ? "ACCOUNT PREFERENCES"
              : view === "playbook"
                ? "PATTERNS FROM YOUR HISTORY"
                : "SESSION WORKSPACE"}
          </span>
          {view !== "settings" && view !== "playbook" && (
            <label className="pilot-date">
              <Clock3 size={14} />
              <select
                aria-label="Review session"
                value={session}
                onChange={(e) => setDate(e.target.value)}
              >
                {!dates.length && <option value="">No sessions yet</option>}
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                    {d === dates[0] ? " · Latest session" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="pilot-actions">
          <button className="pilot-button" onClick={() => setManual(true)}>
            <Plus size={15} />
            Log a trade
          </button>
          <button
            className="pilot-button primary"
            disabled={!account.trades.length}
            onClick={run}
          >
            <Sparkles size={15} />
            Review trades
          </button>
        </div>
      </div>
      {message && (
        <div className="pilot-notice" role="status">
          <Check size={15} />
          {message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {view === "settings" ? (
        <Settings account={account} settings={settings} />
      ) : view === "playbook" ? (
        <Edge trades={account.trades} />
      ) : (
        <div className="pilot-main-grid">
          <div className="pilot-main-column">
            {view === "overview" && (
              <>
                <section className="pilot-summary">
                  <div className="pilot-summary-top">
                    <div>
                      <span className="pilot-eyebrow">
                        THE SESSION AT A GLANCE
                      </span>
                      <h2>
                        {day.length === 0
                          ? "Your next session starts here."
                          : flags.length
                            ? "A few moments worth a second look."
                            : "Make the review part of your routine."}
                      </h2>
                      <p>
                        {day.length === 0
                          ? "Connect an account, import a file, or log a trade. Pilot will turn your history into a useful review."
                          : `${day.length} ${day.length === 1 ? "trade" : "trades"} in this session. ${flags.length ? `${flags.length} rule observations to review before the next one.` : "No breaches found in configured checks."}`}
                      </p>
                    </div>
                    <div className="pilot-orbit">
                      <Radar size={38} strokeWidth={1} />
                    </div>
                  </div>
                  <div className="pilot-metrics">
                    <div>
                      <span>Net P&L</span>
                      <strong
                        className={
                          pnl < 0
                            ? "pilot-negative"
                            : pnl > 0
                              ? "pilot-positive"
                              : ""
                        }
                      >
                        {money(pnl)}
                      </strong>
                    </div>
                    <div>
                      <span>Win rate</span>
                      <strong>
                        {day.length
                          ? `${Math.round((day.filter((t) => t.netPL > 0).length / day.length) * 100)}%`
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Trade allowance</span>
                      <strong>
                        {day.length}
                        <small> / {settings.rules.maxTrades}</small>
                      </strong>
                    </div>
                  </div>
                </section>
                <section className="pilot-panel">
                  <div className="pilot-section-title">
                    <h2>
                      <ShieldCheck size={17} />
                      Rule watch
                    </h2>
                    <button
                      className="pilot-text-link"
                      onClick={() => setView("settings")}
                    >
                      Edit rules <ArrowRight size={13} />
                    </button>
                  </div>
                  <p className="pilot-muted pilot-small">
                    {account.pilotSettings
                      ? "Your saved rules"
                      : "Starter limits · customize for this account"}{" "}
                    · realized P&L only; open risk and firm compliance are not
                    verified.
                  </p>
                  <div className="pilot-rule-meter">
                    <div>
                      <span>Session loss budget</span>
                      <strong>
                        {money(
                          Math.max(
                            0,
                            settings.rules.dailyLoss + Math.min(0, pnl),
                          ),
                        )}{" "}
                        remaining
                      </strong>
                    </div>
                    <div className="pilot-meter">
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(0, (-pnl / settings.rules.dailyLoss) * 100))}%`,
                        }}
                      />
                    </div>
                    <small>
                      {money(settings.rules.dailyLoss)} personal daily limit
                    </small>
                  </div>
                  {flags.length ? (
                    <div className="pilot-flags">
                      {flags.slice(0, 3).map((f, i) => (
                        <button key={i} onClick={() => setSelectedTrade(f.id)}>
                          <span className="pilot-alert-mark">!</span>
                          <span>
                            <strong>{f.text}</strong>
                            <small>
                              {f.symbol} · {f.time || "Time not recorded"}
                            </small>
                          </span>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                      {flags.length > 3 && (
                        <button
                          className="pilot-text-link"
                          onClick={() => setView("reviews")}
                        >
                          View all {flags.length} observations{" "}
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="pilot-quiet">
                      <Check size={16} />
                      <span>
                        {day.length
                          ? "No flags in available trade data."
                          : "Waiting for trade data."}
                      </span>
                    </div>
                  )}
                  {checks.some((c) => !c.timingKnown) && (
                    <p className="pilot-inline-info">
                      Some entry times are missing. Timing checks are
                      incomplete.
                    </p>
                  )}
                </section>
                <section className="pilot-panel">
                  <div className="pilot-section-title">
                    <h2>
                      <Sparkles size={17} />
                      Working for you
                    </h2>
                    <button
                      className="pilot-text-link"
                      onClick={() => setView("settings")}
                    >
                      Configure <ArrowRight size={13} />
                    </button>
                  </div>
                  <div className="pilot-agent-rows">
                    <AgentRow
                      icon={Tags}
                      title="Tag your trades"
                      text="Recorded setups, direction and session tags."
                      on={settings.tags}
                      action={() => setView("settings")}
                    />
                    <AgentRow
                      icon={FilePenLine}
                      title="Draft your notes"
                      text="A factual recap, ready for your observations."
                      on={settings.notes}
                      action={() => setView("settings")}
                    />
                    <AgentRow
                      icon={ShieldCheck}
                      title="Check your rules"
                      text="Trade limits, sizing, loss budget and cooldown."
                      on
                      action={() => setView("reviews")}
                    />
                  </div>
                  <p className="pilot-small pilot-muted">
                    Automatic drafts run while TradePilot is open. No model
                    connection required.
                  </p>
                </section>
              </>
            )}
            {(view === "reviews" || view === "overview") && (
              <section className="pilot-panel">
                <div className="pilot-section-title">
                  <h2>
                    <Layers3 size={17} />
                    {view === "reviews" ? "Trade reviews" : "Latest trades"}
                  </h2>
                  <span className="pilot-muted pilot-small">
                    {pending.length} pending across this account
                  </span>
                </div>
                {day.length ? (
                  <div className="pilot-trade-list">
                    {(view === "overview"
                      ? [...day].reverse().slice(0, 3)
                      : [...day].reverse()
                    ).map((t) => {
                      const result = checks.find((c) => c.trade.id === t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTrade(t.id)}
                        >
                          <div className="pilot-symbol">
                            {t.symbol.slice(0, 3)}
                          </div>
                          <div className="pilot-trade-detail">
                            <strong>
                              {t.symbol}{" "}
                              <span>
                                {t.side || "Trade"} · {t.quantity} contracts
                              </span>
                            </strong>
                            <small>
                              {t.time || "Time unrecorded"} ·{" "}
                              {t.strategy || "Setup unrecorded"}
                            </small>
                            <div className="pilot-tags">
                              {t.pilotReview?.reviewed ? (
                                <span>Reviewed</span>
                              ) : t.pilotReview ? (
                                <span>Draft ready</span>
                              ) : (
                                <span>Not reviewed</span>
                              )}
                              {!!result?.flags.length && (
                                <span className="warning">
                                  {result.flags.length} observations
                                </span>
                              )}
                            </div>
                          </div>
                          <strong
                            className={
                              t.netPL < 0 ? "pilot-negative" : "pilot-positive"
                            }
                          >
                            {money(t.netPL)}
                          </strong>
                          <ChevronRight size={15} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="pilot-empty">
                    <ArrowDownToLine size={26} />
                    <h3>Give Pilot something to work with.</h3>
                    <p>
                      Import your fills or add a trade to start your first
                      review.
                    </p>
                    <Link className="pilot-button" href="/app/accounts">
                      Connect or import trades <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
                {view === "overview" && day.length > 3 && (
                  <button
                    className="pilot-text-link pilot-all-trades"
                    onClick={() => setView("reviews")}
                  >
                    View all {day.length} trades <ArrowRight size={14} />
                  </button>
                )}
              </section>
            )}
          </div>
          <aside className="pilot-aside">
            <PilotCoach
              key={`${account.id}-${model.provider}-${model.model}`}
              account={account}
              model={model}
            />
            <div className="pilot-side-note">
              <BookOpen size={17} />
              <div>
                <strong>Build a repeatable edge.</strong>
                <p>
                  See which recorded setups are earning their place in your
                  playbook.
                </p>
                <button
                  className="pilot-text-link"
                  onClick={() => setView("playbook")}
                >
                  Explore your patterns <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
      {selected && (
        <TradeReview
          key={selected.id}
          trade={selected}
          account={account}
          model={model}
          close={() => setSelectedTrade(null)}
        />
      )}
      {manual && (
        <ManualTrade accountId={account.id} close={() => setManual(false)} />
      )}
    </>
  );
}

function AgentRow({
  icon: Icon,
  title,
  text,
  on,
  action,
}: {
  icon: typeof Tags;
  title: string;
  text: string;
  on: boolean;
  action: () => void;
}) {
  return (
    <button onClick={action}>
      <Icon size={18} />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <span className={`pilot-status ${on ? "on" : ""}`}>
        {on ? "Enabled" : "Off"}
      </span>
      <ChevronRight size={13} />
    </button>
  );
}
function Settings({
  account,
  settings,
}: {
  account: Account;
  settings: PilotSettings;
}) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const updateAccount = useAccountStore((s) => s.updateAccount);
  return (
    <form
      className="pilot-panel pilot-settings"
      onSubmit={(e) => {
        e.preventDefault();
        updateAccount(account.id, { pilotSettings: draft });
        setSaved(true);
      }}
    >
      <span className="pilot-eyebrow">{account.name}</span>
      <h2>Make Pilot work your way.</h2>
      <p className="pilot-muted">
        These preferences apply only to this account. Start with your own
        limits, then match them to your firm’s current rules.
      </p>
      <div className="pilot-switches">
        {(["tags", "notes"] as const).map((key) => (
          <label key={key}>
            <span>
              <strong>
                {key === "tags"
                  ? "Automatically draft trade tags"
                  : "Automatically draft trade notes"}
              </strong>
              <small>
                Process existing and incoming trades. Review drafts before
                saving to the journal.
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={draft[key]}
              onChange={(e) => {
                setSaved(false);
                setDraft({ ...draft, [key]: e.target.checked });
              }}
            />
          </label>
        ))}
      </div>
      <h3>Personal session rules</h3>
      <div className="pilot-rule-fields">
        {(
          [
            { key: "maxTrades", label: "Maximum trades per day", min: 1 },
            {
              key: "dailyLoss",
              label: "Daily realized loss limit ($)",
              min: 1,
            },
            {
              key: "maxContracts",
              label: "Maximum contracts per trade",
              min: 1,
            },
            {
              key: "cooldown",
              label: "Cooldown after a loss (minutes)",
              min: 0,
            },
          ] as const
        ).map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              required
              type="number"
              min={f.min}
              max={f.key === "dailyLoss" ? 1000000 : 10000}
              step={1}
              value={draft.rules[f.key]}
              onChange={(e) => {
                setSaved(false);
                setDraft({
                  ...draft,
                  rules: { ...draft.rules, [f.key]: Number(e.target.value) },
                });
              }}
            />
          </label>
        ))}
        <label>
          Stop entering trades at
          <input
            required
            type="time"
            value={draft.rules.finishTime}
            onChange={(e) => {
              setSaved(false);
              setDraft({
                ...draft,
                rules: { ...draft.rules, finishTime: e.target.value },
              });
            }}
          />
        </label>
      </div>
      <p className="pilot-small pilot-muted">
        Times use the journal’s recorded clock. Ensure imports share the same
        timezone. Cooldown uses entry time plus recorded duration to estimate a
        loss’s close.
      </p>
      <div className="pilot-inline-info">
        <CircleHelp size={16} />
        <span>
          These checks do not include unrealized P&L, intraday trailing
          drawdown, news restrictions or broker-enforced limits. Keep your
          account risk snapshot current in Session Planner.
        </span>
      </div>
      <div className="pilot-actions">
        <button className="pilot-button primary" type="submit">
          <Check size={15} />
          Save account preferences
        </button>
        <Link className="pilot-text-link" href="/app/session">
          Open sizing planner <ArrowRight size={14} />
        </Link>
      </div>
      {saved && (
        <p role="status" className="pilot-positive">
          Preferences saved for {account.name}.
        </p>
      )}
    </form>
  );
}
function Edge({ trades }: { trades: Trade[] }) {
  const rows = playbookStats(trades);
  return (
    <section className="pilot-panel">
      <span className="pilot-eyebrow">YOUR EDGE</span>
      <h2>Find what deserves repeating.</h2>
      <p className="pilot-muted">
        Grouped by your recorded setup, across {trades.length} account trades.
        Historical results describe this sample; they do not establish an edge.
      </p>
      {rows.length ? (
        <div className="pilot-edge-table">
          <table>
            <thead>
              <tr>
                <th>Recorded setup</th>
                <th>Trades</th>
                <th>Win rate</th>
                <th>Net P&L</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.count}</td>
                  <td>{Math.round((r.wins / r.count) * 100)}%</td>
                  <td
                    className={r.pnl < 0 ? "pilot-negative" : "pilot-positive"}
                  >
                    {money(r.pnl)}
                  </td>
                  <td>
                    <span className="pilot-muted">
                      {r.count < 20 ? "Small sample" : "Review context"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pilot-empty">
          <BookOpen />
          <h3>Your setups will appear here.</h3>
          <p>Add a setup name when logging or reviewing trades.</p>
        </div>
      )}
      <div className="pilot-inline-info">
        {trades.filter((t) => !t.strategy).length} trades have no setup
        recorded. Pilot does not infer a chart setup from P&L alone.
      </div>
      <Link className="pilot-text-link" href="/app/playbooks">
        Open playbooks <ArrowRight size={14} />
      </Link>
    </section>
  );
}
