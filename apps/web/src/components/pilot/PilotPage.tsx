"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cpu,
  Layers3,
  ListChecks,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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
import { PROVIDERS, type ModelConfig } from "@/lib/pilot/models";
import { useModelStore } from "@/lib/pilot/modelStore";
import { ModelPanel } from "./ModelPanel";
import { PilotCoach } from "./PilotCoach";
import { TradeReview } from "./TradeReview";
import { ManualTrade } from "./ManualTrade";
import "./pilot.css";

type View = "overview" | "reviews" | "playbook" | "settings";
const tabs: { id: View; label: string }[] = [
  { id: "overview", label: "Ask Pilot" },
  { id: "reviews", label: "Trade reviews" },
  { id: "playbook", label: "Your edge" },
  { id: "settings", label: "Settings" },
];

const sessionLabel = (d: string) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "No sessions yet";

export function PilotPage() {
  const {
    accounts,
    selectedAccountId,
    selectAccount,
    showAllAccounts,
    initializeFromIDB,
  } = useAccountStore();
  const [view, setView] = useState<View>("overview");
  const { model, setModel: saveModel, hydrate } = useModelStore();
  useEffect(() => {
    initializeFromIDB();
    hydrate();
  }, [initializeFromIDB, hydrate]);
  const account = accounts.find((a) => a.id === selectedAccountId);
  const pendingCount =
    account?.trades.filter((t) => t.pilotReview && !t.pilotReview.reviewed)
      .length || 0;
  const sourceLabel = account?.syncSource
    ? `${account.syncSource.provider} · ${account.syncSource.automatic ? "auto-sync" : "manual sync"}`
    : account?.type === "demo"
      ? "Sample data"
      : "Imported trades";

  return (
    <div className="pilot-workspace">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
            <Sparkles className="h-5 w-5 text-tp-green" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight text-zinc-50">
              Pilot AI
            </h1>
            <p className="text-xs text-zinc-500">
              Your AI trading coach, grounded in your own trades
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1.5 pl-3 pr-8 hover:border-white/[0.14]">
            <Layers3 className="h-4 w-4 text-zinc-500" />
            <span className="flex flex-col leading-tight">
              <select
                aria-label="Pilot account"
                value={account?.id || ""}
                onChange={(e) => selectAccount(e.target.value)}
                className="cursor-pointer appearance-none bg-transparent pr-1 text-[13px] font-medium text-zinc-100 focus:outline-none"
              >
                {!account && <option value="">Choose account</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.type === "demo" ? " · Demo" : ""}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-zinc-500">
                {sourceLabel} · {account?.trades.length || 0} trades
              </span>
            </span>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-zinc-500" />
          </label>
          <button
            onClick={() => setView("settings")}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] font-medium text-zinc-300 hover:border-white/[0.14] hover:text-zinc-50"
          >
            <Cpu className="h-4 w-4 text-zinc-500" />
            {model.provider === "local"
              ? "Built-in analysis"
              : model.model || PROVIDERS[model.provider].label}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav
        aria-label="Pilot sections"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-white/[0.06] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const active = view === t.id;
          return (
            <button
              key={t.id}
              aria-current={active ? "page" : undefined}
              onClick={() => setView(t.id)}
              className={clsx(
                "relative -mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium",
                active
                  ? "border-tp-green text-zinc-50"
                  : "border-transparent text-zinc-500 hover:text-zinc-200",
              )}
            >
              {t.label}
              {t.id === "reviews" && pendingCount > 0 && (
                <span className="rounded-full bg-tp-yellow/15 px-1.5 text-[11px] font-semibold tabular-nums text-tp-yellow">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {showAllAccounts && account && (
        <p className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
          <CircleHelp className="h-3.5 w-3.5" />
          Pilot works on one account at a time — currently {account.name}.
        </p>
      )}

      {account ? (
        <AccountWorkspace
          key={account.id}
          account={account}
          model={model}
          saveModel={saveModel}
          view={view}
          setView={setView}
        />
      ) : view === "settings" ? (
        <ModelPanel config={model} onChange={saveModel} />
      ) : (
        <div className="rounded-3xl border border-dashed border-white/[0.1] px-6 py-16 text-center">
          <Layers3 className="mx-auto h-8 w-8 text-zinc-500" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-100">
            Start with an account
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Create or connect an account to give Pilot your trading context.
          </p>
          <Link
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-tp-green px-4 py-2.5 text-sm font-semibold text-[#0D1628]"
            href="/app/accounts"
          >
            Set up an account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <footer className="mt-10 flex items-center justify-center gap-2 text-[11px] text-zinc-600">
        <ShieldCheck className="h-3.5 w-3.5" />
        Scoped to one account · closed trades only · you stay in control
      </footer>
    </div>
  );
}

function AccountWorkspace({
  account,
  model,
  saveModel,
  view,
  setView,
}: {
  account: Account;
  model: ModelConfig;
  saveModel: (value: ModelConfig) => void;
  view: View;
  setView: (v: View) => void;
}) {
  const updateAccount = useAccountStore((s) => s.updateAccount);
  const settings = account.pilotSettings || DEFAULT_SETTINGS;
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [message, setMessage] = useState("");
  const [demoDismissed, setDemoDismissed] = useState(false);
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
  // First flagged trade in the whole account — used by the demo banner.
  const exampleFlagged = useMemo(() => {
    if (account.type !== "demo") return null;
    const all = orderedTrades(account.trades);
    return (
      all.find((t) => inspectTrade(t, all, settings.rules).flags.length) ||
      null
    );
  }, [account.type, account.trades, settings.rules]);
  const pnl = day.reduce((sum, t) => sum + t.netPL, 0);
  const wins = day.filter((t) => t.netPL > 0).length;
  const pending = account.trades.filter(
    (t) => t.pilotReview && !t.pilotReview.reviewed,
  );
  const unreviewed = account.trades.filter((t) => !t.pilotReview).length;
  const lossUsed = Math.min(
    100,
    Math.max(0, (-pnl / settings.rules.dailyLoss) * 100),
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
  const checkFor = (id: string) => checks.find((c) => c.trade.id === id);

  const sessionPicker = (
    <label className="relative inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-2.5 pr-7 text-[13px] text-zinc-200 hover:border-white/[0.14]">
      <select
        aria-label="Review session"
        value={session}
        onChange={(e) => setDate(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent focus:outline-none"
      >
        {!dates.length && <option value="">No sessions yet</option>}
        {dates.map((d) => (
          <option key={d} value={d}>
            {sessionLabel(d)}
            {d === dates[0] ? " · Latest" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-zinc-500" />
    </label>
  );

  const logButton = (
    <button
      onClick={() => setManual(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] font-medium text-zinc-200 hover:border-white/[0.14] hover:text-zinc-50"
    >
      <Plus className="h-3.5 w-3.5" />
      Log a trade
    </button>
  );

  const tradeList = (list: Trade[]) =>
    list.length ? (
      <div className="divide-y divide-white/[0.05]">
        {list.map((t) => (
          <TradeRow
            key={t.id}
            trade={t}
            flagCount={checkFor(t.id)?.flags.length || 0}
            onOpen={() => setSelectedTrade(t.id)}
          />
        ))}
      </div>
    ) : (
      <div className="py-10 text-center">
        <ArrowDownToLine className="mx-auto h-6 w-6 text-zinc-500" />
        <h3 className="mt-3 text-sm font-semibold text-zinc-100">
          No trades in this session yet
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          Import your fills or log a trade to start your first review.
        </p>
        <Link
          href="/app/accounts"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-tp-green hover:underline"
        >
          Connect or import trades <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );

  return (
    <>
      {message && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-xl border border-tp-green/20 bg-tp-green/[0.07] px-4 py-2.5 text-sm text-zinc-200"
        >
          <Check className="h-4 w-4 text-tp-green" />
          <span className="flex-1">{message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
            className="text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {view === "settings" ? (
        <div className="grid items-start gap-6 xl:grid-cols-2 [&_.pilot-settings]:max-w-none">
          <Settings account={account} settings={settings} />
          <ModelPanel config={model} onChange={saveModel} />
        </div>
      ) : view === "playbook" ? (
        <Edge trades={account.trades} />
      ) : view === "reviews" ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {sessionPicker}
              <span className="text-sm text-zinc-500">
                {day.length} {day.length === 1 ? "trade" : "trades"} ·{" "}
                <span className={pnl < 0 ? "text-tp-red" : pnl > 0 ? "text-tp-green" : ""}>
                  {money(pnl)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {logButton}
              <button
                disabled={!account.trades.length}
                onClick={run}
                className="inline-flex items-center gap-1.5 rounded-lg bg-tp-green px-3 py-1.5 text-[13px] font-semibold text-[#0D1628] hover:brightness-110 disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Draft reviews
              </button>
            </div>
          </div>

          {flags.length > 0 && (
            <Panel
              title="Rule breaks this session"
              icon={ShieldCheck}
              action={
                <button
                  onClick={() => setView("settings")}
                  className="text-xs font-medium text-zinc-400 hover:text-zinc-100"
                >
                  Edit rules
                </button>
              }
            >
              <div className="space-y-2">
                {flags.map((f, i) => (
                  <FlagRow key={i} flag={f} onOpen={() => setSelectedTrade(f.id)} />
                ))}
              </div>
            </Panel>
          )}

          <Panel
            title="Trades"
            icon={ListChecks}
            action={
              <span className="text-xs text-zinc-500">
                {pending.length} drafts waiting across this account
              </span>
            }
          >
            {tradeList([...day].reverse())}
          </Panel>
          {checks.some((c) => !c.timingKnown) && (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <CircleHelp className="h-3.5 w-3.5" />
              Some entry times are missing, so timing checks are incomplete.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {account.type === "demo" && !demoDismissed && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-tp-blue/20 bg-tp-blue/[0.06] px-4 py-2.5 text-sm">
              <Sparkles className="h-4 w-4 shrink-0 text-tp-blue" />
              <span className="flex-1 text-zinc-300">
                You’re exploring the demo account —{" "}
                {account.trades.length} sample trades, so you can see what
                Pilot catches before connecting your own.
              </span>
              {exampleFlagged && (
                <button
                  onClick={() => setSelectedTrade(exampleFlagged.id)}
                  className="inline-flex items-center gap-1 font-medium text-tp-blue hover:underline"
                >
                  See an example review <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                aria-label="Dismiss demo banner"
                onClick={() => setDemoDismissed(true)}
                className="text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <PilotCoach
            key={`${account.id}-${model.provider}-${model.model}`}
            account={account}
            model={model}
          />

          {/* Insight cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <InsightCard
              icon={TrendingUp}
              label={`Latest session · ${sessionLabel(dates[0] || "")}`}
              onClick={() => setView("reviews")}
              cta="Open session"
            >
              {(() => {
                const latest = account.trades.filter(
                  (t) => t.date.slice(0, 10) === dates[0],
                );
                const net = latest.reduce((s, t) => s + t.netPL, 0);
                const w = latest.filter((t) => t.netPL > 0).length;
                return (
                  <>
                    <div
                      className={clsx(
                        "text-2xl font-semibold tabular-nums",
                        net < 0 ? "text-tp-red" : net > 0 ? "text-tp-green" : "text-zinc-100",
                      )}
                    >
                      {money(net)}
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">
                      {latest.length} {latest.length === 1 ? "trade" : "trades"}
                      {latest.length > 0 &&
                        ` · ${Math.round((w / latest.length) * 100)}% win rate`}
                    </p>
                  </>
                );
              })()}
            </InsightCard>

            <InsightCard
              icon={ShieldCheck}
              label="Rule watch"
              onClick={() => setView(flags.length ? "reviews" : "settings")}
              cta={flags.length ? "See rule breaks" : "Edit rules"}
              tone={flags.length ? "warn" : undefined}
            >
              <div className="text-2xl font-semibold tabular-nums text-zinc-100">
                {money(Math.max(0, settings.rules.dailyLoss + Math.min(0, pnl)))}
                <span className="ml-1.5 text-sm font-normal text-zinc-500">
                  left today
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={clsx(
                    "h-full rounded-full",
                    lossUsed > 66 ? "bg-tp-red" : lossUsed > 33 ? "bg-tp-yellow" : "bg-tp-green",
                  )}
                  style={{ width: `${Math.max(lossUsed, 2)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {flags.length
                  ? `${flags.length} rule ${flags.length === 1 ? "break" : "breaks"} on ${sessionLabel(session)}`
                  : `No rule breaks · ${day.length}/${settings.rules.maxTrades} trades used`}
              </p>
            </InsightCard>

            <InsightCard
              icon={ListChecks}
              label="Needs review"
              onClick={pending.length ? () => setView("reviews") : run}
              cta={pending.length ? "Open reviews" : "Draft reviews with Pilot"}
              disabled={!account.trades.length}
            >
              <div className="text-2xl font-semibold tabular-nums text-zinc-100">
                {pending.length || unreviewed}
                <span className="ml-1.5 text-sm font-normal text-zinc-500">
                  {pending.length ? "drafts ready" : "trades unreviewed"}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                {pending.length
                  ? "Pilot drafted tags and notes. Check them and save."
                  : "Let Pilot tag trades and draft your notes."}
              </p>
            </InsightCard>
          </div>

          {/* Recent trades */}
          <Panel
            title="Recent trades"
            icon={ListChecks}
            action={
              <div className="flex items-center gap-2">
                {sessionPicker}
                {logButton}
              </div>
            }
          >
            {tradeList([...day].reverse().slice(0, 5))}
            {day.length > 5 && (
              <button
                onClick={() => setView("reviews")}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-tp-green hover:underline"
              >
                View all {day.length} trades <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </Panel>
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

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-tp-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <Icon className="h-4 w-4 text-zinc-500" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function InsightCard({
  icon: Icon,
  label,
  cta,
  onClick,
  tone,
  disabled,
  children,
}: {
  icon: typeof Sparkles;
  label: string;
  cta: string;
  onClick: () => void;
  tone?: "warn";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "group flex h-full flex-col rounded-2xl border bg-tp-card p-5 text-left transition-colors hover:border-white/[0.14]",
        tone === "warn" ? "border-tp-yellow/25" : "border-white/[0.06]",
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500">
        <Icon className={clsx("h-4 w-4", tone === "warn" ? "text-tp-yellow" : "text-zinc-500")} />
        {label}
      </div>
      <div className="flex-1">{children}</div>
      <div className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-300 group-hover:text-tp-green">
        {cta}
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function TradeRow({
  trade: t,
  flagCount,
  onOpen,
}: {
  trade: Trade;
  flagCount: number;
  onOpen: () => void;
}) {
  const status = t.pilotReview?.reviewed
    ? { label: "Reviewed", cls: "bg-tp-green/10 text-tp-green" }
    : t.pilotReview
      ? { label: "Draft ready", cls: "bg-tp-blue/10 text-tp-blue" }
      : { label: "Not reviewed", cls: "bg-white/[0.05] text-zinc-400" };
  return (
    <button
      onClick={onOpen}
      className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-white/[0.03]"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[11px] font-semibold text-zinc-300 ring-1 ring-inset ring-white/[0.05]">
        {t.symbol.slice(0, 3)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          {t.symbol}
          {t.side && (
            <span
              className={clsx(
                "rounded px-1.5 py-px text-[11px] font-medium",
                t.side === "Long" ? "bg-tp-green/10 text-tp-green" : "bg-tp-red/10 text-tp-red",
              )}
            >
              {t.side}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-zinc-500">
          {t.time || "Time not recorded"} · {t.quantity} contracts ·{" "}
          {t.strategy || "No setup recorded"}
        </div>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        {flagCount > 0 && (
          <span className="rounded-md bg-tp-yellow/10 px-2 py-0.5 text-[11px] font-medium text-tp-yellow">
            {flagCount} rule {flagCount === 1 ? "break" : "breaks"}
          </span>
        )}
        <span className={clsx("rounded-md px-2 py-0.5 text-[11px] font-medium", status.cls)}>
          {status.label}
        </span>
      </div>
      <div
        className={clsx(
          "w-20 text-right text-sm font-semibold tabular-nums",
          t.netPL < 0 ? "text-tp-red" : "text-tp-green",
        )}
      >
        {money(t.netPL)}
      </div>
      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300" />
    </button>
  );
}

function FlagRow({
  flag,
  onOpen,
}: {
  flag: { symbol: string; time?: string; text: string };
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-xl border border-tp-yellow/15 bg-tp-yellow/[0.04] px-3 py-2.5 text-left hover:border-tp-yellow/30"
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tp-yellow/15 text-xs font-bold text-tp-yellow">
        !
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-zinc-100">{flag.text}</span>
        <span className="block text-xs text-zinc-500">
          {flag.symbol} · {flag.time || "Time not recorded"}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300" />
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
