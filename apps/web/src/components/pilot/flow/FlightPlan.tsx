"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Clock,
  Crosshair,
  History,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import type { Account } from "@/store/accountStore";
import type { PilotRules } from "@/lib/pilot/workspace";
import { hhmmToMinute, type MarketRead } from "@/lib/pilot/market";
import {
  PREP_CHECKS,
  autoLevels,
  clusterLevels,
  roundLevels,
  sessionsOf,
  type LevelCluster,
  type LevelKind,
  type DayPlan,
  type GamePlan,
  type LineKind,
} from "@/lib/pilot/session";
import type { MarketState } from "./TodayFlow";
import { Card, Chip, Evidence, Eyebrow } from "./ui";
import { PlaybookPicker } from "./PlaybookPicker";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const LINE_ICON: Record<LineKind, typeof Clock> = {
  event: CalendarClock,
  clock: Clock,
  bias: TrendingUp,
  setup: Crosshair,
  risk: ShieldCheck,
  carry: History,
};

export function FlightPlan({
  account,
  market,
  loading,
  primary,
  plan,
  setPlan,
  game,
  rules,
  today,
  minute,
  roots,
  onAsk,
  onNext,
}: {
  account: Account;
  market: MarketState | null;
  loading: boolean;
  primary: MarketRead | null;
  plan: DayPlan;
  setPlan: (patch: Partial<DayPlan>) => void;
  game: GamePlan;
  rules: PilotRules;
  today: string;
  minute: number;
  roots: string[];
  onAsk: (q: string) => void;
  onNext: () => void;
}) {
  const sessions = sessionsOf(account.trades).size;
  const events = market?.events || [];
  const scan = [
    { label: "Asset scan", detail: `${roots.join(", ")} · from your recent trades`, done: true },
    {
      label: "Market read",
      detail: market?.markets.length
        ? `${market.markets.map((m) => m.source).join(", ")} · 5m bars${market.vix ? ` · VIX ${market.vix.level}` : ""}`
        : market?.errors[0] || "Reaching the quote source",
      done: !!market?.markets.length,
      failed: !!market && !market.markets.length,
    },
    {
      label: "Economic calendar",
      detail: market ? (market.eventsLive ? `Live feed · ${events.length} US events today` : `Recurring schedule only · ${events.length} today`) : "Checking today's releases",
      done: !!market,
      partial: !!market && !market.eventsLive,
    },
    { label: "Your tape", detail: `${account.trades.length} trades · ${sessions} sessions`, done: true },
  ];
  const checksDone = PREP_CHECKS.filter((c) => plan.checks[c.id]).length;
  const cleared = checksDone === PREP_CHECKS.length;

  return (
    <div className="space-y-6">
    <PlaybookPicker plan={plan} setPlan={setPlan} history={account.trades} />
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      {/* ── Left: what the market is doing ─────────────────────── */}
      <div className="space-y-6">
        <Card
          title="Pre-market scan"
          action={
            <span className="font-mono text-[10px] text-zinc-600">
              {market ? `Updated ${new Date(market.asOf).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET · quotes ~10 min delayed` : ""}
            </span>
          }
        >
          <ul className="space-y-2">
            {scan.map((row, i) => (
              <li
                key={row.label}
                className="tp-flow-scan flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="rounded-md bg-tp-green/10 px-2 py-0.5 font-mono text-[10px] text-tp-green ring-1 ring-inset ring-tp-green/20">
                  ✦ {row.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-400">{row.detail}</span>
                {row.failed ? (
                  <Chip tone="red">Offline</Chip>
                ) : row.partial ? (
                  <Chip tone="yellow">Limited</Chip>
                ) : row.done ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                    <Check className="h-3 w-3 text-tp-green" /> Complete
                  </span>
                ) : (
                  <span className="tp-flow-shimmer rounded px-2 py-0.5 text-[11px] text-zinc-400">Scanning…</span>
                )}
              </li>
            ))}
          </ul>

          {market?.markets.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {market.markets.map((m) => (
                <button
                  key={m.symbol}
                  onClick={() => setPlan({ symbol: m.symbol, levels: plan.levels.filter((l) => l.source === "manual") })}
                  className={clsx(
                    "rounded-xl border p-4 text-left transition",
                    primary?.symbol === m.symbol ? "border-tp-green/30 bg-tp-green/[0.04]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{m.symbol}</span>
                    <BiasChip bias={m.bias} />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-semibold tabular-nums text-zinc-50">{fmt(m.price)}</span>
                    {m.changePct != null && (
                      <span className={clsx("text-xs font-medium tabular-nums", m.changePct >= 0 ? "text-tp-green" : "text-tp-red")}>
                        {m.changePct >= 0 ? "+" : ""}
                        {m.changePct}%
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {m.reasons.slice(0, 3).map((r) => (
                      <li key={r} className="text-[12px] leading-snug text-zinc-500">· {r}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="grid gap-6 2xl:grid-cols-2">
          <LevelLadder primary={primary} plan={plan} setPlan={setPlan} />
          <Card title="Economic events · ET">
            {events.length ? (
              <ul className="space-y-2">
                {events.map((e) => {
                  const m = hhmmToMinute(e.time);
                  const diff = m == null ? null : m - minute;
                  return (
                    <li key={`${e.time}-${e.title}`} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                      <Chip tone={e.impact === "high" ? "red" : "yellow"}>{e.impact === "high" ? "High" : "Med"}</Chip>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-zinc-200">
                          <span className="font-mono text-zinc-400">{e.time}</span> · {e.title}
                        </p>
                        {(e.forecast || e.previous) && (
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {e.forecast && `Forecast ${e.forecast}`}
                            {e.forecast && e.previous && " · "}
                            {e.previous && `Prior ${e.previous}`}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                        {diff == null ? "" : diff > 0 ? `in ${diff >= 60 ? `${Math.floor(diff / 60)}h ` : ""}${diff % 60}m` : "passed"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-white/[0.08] px-3 py-6 text-center text-[13px] text-zinc-500">
                {market ? "No high or medium-impact US releases found for today." : "Checking today's releases…"}
              </p>
            )}
            {market && !market.eventsLive && (
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
                The live calendar feed didn't answer, so this is the recurring schedule (jobless claims, the payrolls report, Fed days). It can't see CPI, PPI or GDP. Check a live calendar before you size up.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* ── Right: Pilot's call, and the trader's plan ─────────── */}
      <div className="space-y-6 xl:sticky xl:top-4">
        <Card glow>
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-tp-green/15 to-tp-blue/15 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-tp-green">
              <Sparkles className="h-3 w-3" /> Pilot's call
            </span>
            <span className="font-mono text-[10px] text-zinc-600">{loading ? "thinking…" : `for ${today}`}</span>
          </div>
          <p className="text-[17px] font-semibold leading-snug text-zinc-50">{game.headline}</p>
          <ol className="mt-4 space-y-3">
            {game.lines.map((line, i) => {
              const Icon = LINE_ICON[line.kind];
              return (
                <li key={i} className="tp-flow-scan flex gap-3" style={{ animationDelay: `${120 + i * 80}ms` }}>
                  <span
                    className={clsx(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                      line.kind === "event" ? "bg-tp-red/10 text-tp-red ring-tp-red/20" : line.kind === "carry" ? "bg-tp-blue/10 text-tp-blue ring-tp-blue/20" : "bg-white/[0.04] text-zinc-300 ring-white/[0.06]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    {line.kind === "carry" && <Eyebrow className="mb-0.5 text-tp-blue">Carried from your debrief</Eyebrow>}
                    <p className="text-[13.5px] leading-relaxed text-zinc-300">{line.text}</p>
                    <Evidence items={line.evidence} />
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
            <button
              onClick={() =>
                onAsk(
                  `Here's my plan for today: ${game.headline} ${game.lines.map((l) => l.text).join(" ")} Using my own trades, what's the one thing most likely to break this plan, and how do I stop it?`,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-tp-green px-3 py-1.5 text-[13px] font-semibold text-[#0D1628] hover:brightness-110"
            >
              <Sparkles className="h-3.5 w-3.5" /> Pressure-test with Pilot
            </button>
            <span className="text-[11px] text-zinc-500">Not a signal service. Pilot plans around your rules and your tape.</span>
          </div>
        </Card>

        <Card title="Your plan">
          <Eyebrow className="mb-2">Bias</Eyebrow>
          <Segmented
            value={plan.bias}
            onChange={(bias) => setPlan({ bias })}
            options={[
              { value: "long", label: "Long only", icon: TrendingUp },
              { value: "both", label: "Let VWAP decide" },
              { value: "short", label: "Short only", icon: TrendingDown },
            ]}
          />

          <Eyebrow className="mb-2 mt-5">Wait after the open</Eyebrow>
          <Segmented
            value={String(plan.waitMinutes)}
            onChange={(v) => setPlan({ waitMinutes: Number(v) })}
            options={[0, 5, 15, 30].map((m) => ({ value: String(m), label: m ? `${m} min` : "None" }))}
          />
          <p className="mt-4 text-[12px] text-zinc-500">
            Rules for {account.name}: {rules.maxTrades} trades · ${rules.dailyLoss.toLocaleString("en-US")} daily stop · {rules.maxContracts} contracts · {rules.cooldown}m cooldown · done by {rules.finishTime}. Edit them in Settings.
          </p>
        </Card>

        <Card
          title="Pre-flight"
          action={<span className={clsx("font-mono text-[11px]", cleared ? "text-tp-green" : "text-zinc-500")}>{checksDone}/{PREP_CHECKS.length}</span>}
        >
          <div className="space-y-1.5">
            {PREP_CHECKS.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                <input
                  type="checkbox"
                  checked={!!plan.checks[c.id]}
                  onChange={(e) => setPlan({ checks: { ...plan.checks, [c.id]: e.target.checked } })}
                  className="h-4 w-4 accent-[#00D68F]"
                />
                <span className={clsx("text-[13px]", plan.checks[c.id] ? "text-zinc-500 line-through" : "text-zinc-200")}>{c.label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={onNext}
            className={clsx(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              cleared ? "bg-gradient-to-r from-tp-green to-emerald-400 text-[#0D1628] shadow-[0_8px_30px_-10px_rgba(0,214,143,0.7)]" : "border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:text-zinc-50",
            )}
          >
            {cleared ? "Cleared for takeoff" : "Go to In flight"} <ArrowRight className="h-4 w-4" />
          </button>
        </Card>
      </div>
    </div>
    </div>
  );
}

function BiasChip({ bias }: { bias: MarketRead["bias"] }) {
  return bias === "bullish" ? <Chip tone="green">Bullish lean</Chip> : bias === "bearish" ? <Chip tone="red">Bearish lean</Chip> : <Chip tone="yellow">Two-sided</Chip>;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: typeof Clock }[];
}) {
  return (
    <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition",
            value === o.value ? "bg-white/[0.09] text-zinc-50 shadow-sm" : "text-zinc-500 hover:text-zinc-200",
          )}
        >
          {o.icon && <o.icon className="h-3.5 w-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const KIND_STYLE: Record<LevelKind, { dot: string; tag: string }> = {
  prior: { dot: "bg-zinc-300", tag: "Prior day" },
  overnight: { dot: "bg-tp-yellow", tag: "Overnight" },
  vwap: { dot: "bg-tp-blue", tag: "VWAP" },
  opening: { dot: "bg-[#B18CFF]", tag: "Opening range" },
  round: { dot: "bg-zinc-600", tag: "Round" },
  manual: { dot: "bg-tp-green", tag: "Yours" },
};

/**
 * Every level that matters today, stacked by price with price itself in the
 * stack. Levels that sit on top of each other merge into one confluence zone,
 * and distance is measured against a normal day's range so "40 points" means
 * something.
 */
function LevelLadder({ primary, plan, setPlan }: { primary: MarketRead | null; plan: DayPlan; setPlan: (p: Partial<DayPlan>) => void }) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [copied, setCopied] = useState(false);
  const manual = plan.levels.filter((l) => l.source === "manual").map((l) => ({ ...l, kind: "manual" as const }));
  const all = primary ? [...autoLevels(primary), ...roundLevels(primary.price), ...manual] : manual;
  const clusters = primary ? clusterLevels(all, primary.price) : clusterLevels(all, all[0]?.price ?? 1);
  const adr = primary?.adr ?? null;
  // The next real level each way: a bare round number or VWAP on its own doesn't count.
  const real = (c: LevelCluster) => c.levels.some((l) => l.kind !== "round" && l.kind !== "vwap");
  const above = primary ? clusters.filter((c) => c.price > primary.price && real(c)).at(-1) : undefined;
  const below = primary ? clusters.find((c) => c.price < primary.price && real(c)) : undefined;
  const rangePos = primary?.pdh != null && primary.pdl != null && primary.pdh > primary.pdl ? ((primary.price - primary.pdl) / (primary.pdh - primary.pdl)) * 100 : null;

  const add = () => {
    const p = Number(price.replace(/,/g, ""));
    if (!Number.isFinite(p) || p <= 0) return;
    setPlan({ levels: [...plan.levels, { id: `m-${Date.now()}`, label: label.trim() || "My level", price: p, source: "manual" }] });
    setLabel("");
    setPrice("");
  };
  const copy = async () => {
    const text = clusters.map((c) => `${fmt(Math.round(c.price * 4) / 4)}  ${c.levels.map((l) => l.label).join(" + ")}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const rows: ({ kind: "cluster"; c: LevelCluster } | { kind: "price" })[] = [];
  let placed = false;
  for (const c of clusters) {
    if (!placed && primary && c.price < primary.price) {
      rows.push({ kind: "price" });
      placed = true;
    }
    rows.push({ kind: "cluster", c });
  }
  if (!placed && primary) rows.push({ kind: "price" });

  return (
    <Card
      title={`Key levels${primary ? ` · ${primary.symbol}` : ""}`}
      action={
        <div className="flex items-center gap-2">
          {adr && <Chip>ADR {fmt(adr)} pts</Chip>}
          <button onClick={copy} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100">
            {copied ? <Check className="h-3 w-3 text-tp-green" /> : <Target className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      }
    >
      {primary && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Mini k="Next resistance" v={above ? `+${fmt(Math.round((above.price - primary.price) * 4) / 4)}` : "—"} sub={above?.levels[0].label} tone="red" />
          <Mini k="Next support" v={below ? `-${fmt(Math.round((primary.price - below.price) * 4) / 4)}` : "—"} sub={below?.levels[0].label} tone="green" />
          <Mini k="In yesterday's range" v={rangePos == null ? "—" : rangePos > 100 ? "Above" : rangePos < 0 ? "Below" : `${Math.round(rangePos)}%`} sub={rangePos == null ? undefined : rangePos > 100 || rangePos < 0 ? "outside PDH/PDL" : "from the low"} />
        </div>
      )}
      {rows.length ? (
        <ul className="space-y-0.5">
          {rows.map((r, i) => {
            if (r.kind === "price")
              return (
                <li key="price" className="relative my-1.5 flex items-center gap-2 rounded-lg bg-tp-green/[0.07] px-2.5 py-1.5 ring-1 ring-inset ring-tp-green/25">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tp-green opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-tp-green" />
                  </span>
                  <span className="flex-1 font-mono text-[11px] uppercase tracking-wider text-tp-green">Price now</span>
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-zinc-50">{fmt(primary!.price)}</span>
                </li>
              );
            const c = r.c;
            const d = primary ? c.price - primary.price : 0;
            const reach = adr ? Math.min(1, Math.abs(d) / adr) : 0;
            const isNext = c === above || c === below;
            const onlyRound = c.levels.every((l) => l.kind === "round");
            const vwap = c.levels.some((l) => l.kind === "vwap");
            return (
              <li
                key={`${c.levels.map((l) => l.id).join("+")}-${i}`}
                className={clsx(
                  "group relative flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-1.5",
                  c.confluence ? "bg-tp-yellow/[0.05] ring-1 ring-inset ring-tp-yellow/20" : "hover:bg-white/[0.03]",
                  onlyRound && "opacity-60",
                )}
              >
                {/* Distance, as a share of a normal day's range */}
                {primary && adr && (
                  <span
                    className={clsx("pointer-events-none absolute inset-y-1 left-0 rounded-r", vwap ? "bg-tp-blue/[0.08]" : d > 0 ? "bg-tp-red/[0.07]" : "bg-tp-green/[0.07]")}
                    style={{ width: `${reach * 100}%` }}
                  />
                )}
                <span className="relative flex shrink-0 -space-x-1">
                  {c.levels.map((l) => (
                    <span key={l.id} className={clsx("h-2 w-2 rounded-full ring-2 ring-tp-card", KIND_STYLE[l.kind].dot)} />
                  ))}
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className={clsx("block truncate text-[13px]", vwap ? "text-tp-blue" : "text-zinc-200")}>
                    {c.levels.map((l) => l.label).join(" + ")}
                  </span>
                  {(c.confluence || isNext) && (
                    <span className="mt-0.5 flex gap-1">
                      {c.confluence && <span className="rounded bg-tp-yellow/15 px-1 font-mono text-[9px] uppercase tracking-wider text-tp-yellow">Confluence</span>}
                      {isNext && (
                        <span className={clsx("rounded px-1 font-mono text-[9px] uppercase tracking-wider", c === above ? "bg-tp-red/15 text-tp-red" : "bg-tp-green/15 text-tp-green")}>
                          {c === above ? "Next resistance" : "Next support"}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                {primary && (
                  <span className="relative w-16 text-right font-mono text-[10.5px] tabular-nums text-zinc-500">
                    {d > 0 ? "+" : ""}
                    {fmt(Math.round(d * 4) / 4)}
                  </span>
                )}
                <span className="relative w-20 text-right font-mono text-[13px] tabular-nums text-zinc-100">{fmt(Math.round(c.price * 4) / 4)}</span>
                {c.levels.some((l) => l.source === "manual") ? (
                  <button
                    aria-label="Remove your level"
                    onClick={() => setPlan({ levels: plan.levels.filter((l) => !c.levels.some((x) => x.id === l.id)) })}
                    className="relative text-zinc-600 opacity-0 hover:text-zinc-200 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="w-3.5" />
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-4 text-center text-[13px] text-zinc-500">Levels appear once the market read loads. Add your own below.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {(Object.keys(KIND_STYLE) as LevelKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1 text-[10.5px] text-zinc-500">
            <span className={clsx("h-1.5 w-1.5 rounded-full", KIND_STYLE[k].dot)} />
            {KIND_STYLE[k].tag}
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-3 flex gap-2"
      >
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name (e.g. Weekly high)" className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-tp-green/40 focus:outline-none" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Price" className="w-24 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-tp-green/40 focus:outline-none" />
        <button type="submit" aria-label="Add level" className="grid w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:text-zinc-50">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </Card>
  );
}

function Mini({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "red" | "green" }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-2 ring-1 ring-inset ring-white/[0.05]">
      <p className="text-[10px] text-zinc-500">{k}</p>
      <p className={clsx("font-mono text-[14px] font-semibold tabular-nums", tone === "red" ? "text-tp-red" : tone === "green" ? "text-tp-green" : "text-zinc-100")}>{v}</p>
      {sub && <p className="truncate text-[10px] text-zinc-500">{sub}</p>}
    </div>
  );
}
