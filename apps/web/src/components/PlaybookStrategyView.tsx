"use client";

import Image from "next/image";
import { SetupAnatomy } from "./playbooks/SetupAnatomy";
import { StrategyWorkspace } from "./playbooks/StrategyWorkspace";
import { PositionSizer } from "./playbooks/PositionSizer";
import { Callout, PlaybookAI } from "./playbooks/PlaybookAI";
import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BellRing,
  BookOpen,
  Calculator,
  CheckCircle2,
  Circle,
  CircleHelp,
  ExternalLink,
  Clock,
  Lightbulb,
  ListChecks,
  LogOut,
  MonitorPlay,
  RotateCcw,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  Wand2,
} from "lucide-react";
import clsx from "clsx";
import type { PlaybookStrategy } from "./Playbooks";
import { buildStrategyChart } from "@/lib/strategyChart";
import { parseR } from "@/lib/futuresSpecs";
import { SIZING_DEFAULT, TV_SETUP } from "@/lib/tradingviewSetup";

const DIFF_STYLE: Record<PlaybookStrategy["difficulty"], string> = {
  Beginner: "bg-tp-green/15 text-tp-green border-tp-green/30",
  Intermediate: "bg-tp-yellow/15 text-tp-yellow border-tp-yellow/30",
  Advanced: "bg-tp-red/15 text-tp-red border-tp-red/30",
};

const JUMPS = [
  { id: "anatomy", label: "Anatomy" },
  { id: "how-it-works", label: "How it works" },
  { id: "checklist", label: "Checklist" },
  { id: "size-it", label: "Size it" },
  { id: "tradingview", label: "TradingView" },
  { id: "examples", label: "Examples" },
  { id: "pitfalls", label: "Edge & pitfalls" },
  { id: "pilot-ai", label: "✦ Pilot AI" },
];

const jump = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export const PlaybookStrategyView: React.FC<{
  strategy: PlaybookStrategy;
  onBack: () => void;
  onOpenToolkit?: () => void;
  /** Original playbook before AI edits (for undo history). */
  base?: PlaybookStrategy;
  onDelete?: () => void;
}> = ({ strategy, onBack, onOpenToolkit, base, onDelete }) => {
  const sizing = strategy.sizing ?? SIZING_DEFAULT[strategy.id];
  const tv = strategy.tvSetup ?? TV_SETUP[strategy.id];
  const targetR = parseR(strategy.riskReward);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Back */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          All strategies
        </button>
        {onOpenToolkit && (
          <button
            onClick={onOpenToolkit}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-tp-green"
          >
            <MonitorPlay className="h-4 w-4" />
            TradingView toolkit
          </button>
        )}
      </div>

      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-3xl border border-white/[0.07] p-6 sm:p-8"
        style={{
          background:
            "radial-gradient(60% 90% at 0% 0%, rgba(0,214,143,0.14) 0%, transparent 60%), radial-gradient(50% 80% at 100% 100%, rgba(79,156,249,0.10) 0%, transparent 60%), #111c2e",
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className={clsx("rounded-full border px-2.5 py-1 text-xs font-semibold", DIFF_STYLE[strategy.difficulty])}>
                {strategy.difficulty}
              </span>
              <Chip icon={<Clock className="h-3.5 w-3.5" />}>{strategy.timeframe}</Chip>
              <Chip icon={<TrendingUp className="h-3.5 w-3.5" />}>{strategy.marketCondition}</Chip>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-[40px] sm:leading-[1.1]">
              {strategy.name}
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-zinc-300">{strategy.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:min-w-[340px]">
            {strategy.custom ? (
              <Kpi label="Backtest" value="—" sub="not tested yet" />
            ) : (
              <Kpi label="AI backtest" value={`${strategy.winRate}%`} sub="win rate" accent />
            )}
            <Kpi label="Target" value={`${targetR}R`} sub={strategy.riskReward} />
            <Kpi label="Timeframe" value={strategy.timeframe} />
            <Kpi
              label="Default micro"
              value={sizing?.symbol ?? "MNQ"}
              sub={sizing ? `${sizing.stopPoints}-pt stop` : "set your stop"}
            />
          </div>
        </div>
      </div>

      {strategy.custom && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-tp-green/20 bg-tp-green/[0.05] px-4 py-3 text-sm">
          <Wand2 className="h-4 w-4 shrink-0 text-tp-green" />
          <span className="flex-1 text-zinc-300">
            Built with Pilot AI{strategy.source?.title ? <> from <span className="font-medium text-zinc-100">{strategy.source.title}</span></> : " from your notes"}.
            {" "}Backtest it before trading live.
          </span>
          {strategy.source?.url && (
            <a href={strategy.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-tp-green hover:underline">
              Source <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {onDelete && (
            <button
              onClick={() => window.confirm(`Delete "${strategy.name}"? This can't be undone.`) && onDelete()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-500 hover:bg-white/[0.05] hover:text-tp-red"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      )}

      <StrategyWorkspace
        key={strategy.id}
        strategyId={strategy.id}
        strategyName={strategy.name}
        seed={strategy.seed}
        guide={(anatomy) => (
          <div className="space-y-6 pt-4">
            {/* Jump links */}
            <nav
              aria-label="Jump to section"
              className="sticky top-16 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#0f1a2b]/90 p-1.5 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {JUMPS.map((j) => (
                <button
                  key={j.id}
                  onClick={() => jump(j.id)}
                  className="shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-50"
                >
                  {j.label}
                </button>
              ))}
            </nav>

            <SetupAnatomy strategy={strategy} {...anatomy} />

            {/* How it works + key terms */}
            <Section id="how-it-works" title="How it works" icon={BookOpen}>
              <div className={clsx("grid gap-6", strategy.glossary && "xl:grid-cols-[1.2fr_1fr]")}>
                <div className="space-y-4">
                  <p className="whitespace-pre-line text-base leading-relaxed text-zinc-300">{strategy.overview}</p>
                  {!!strategy.sourceClaims?.length && (
                    <Callout icon={AlertTriangle} tone="red" title="Creator claims (unverified)" items={strategy.sourceClaims} />
                  )}
                  {!!strategy.openQuestions?.length && (
                    <Callout icon={CircleHelp} tone="blue" title="Decide before you trade it" items={strategy.openQuestions} />
                  )}
                </div>
                {strategy.glossary && (
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Key terms</div>
                    <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      {strategy.glossary.map((g) => (
                        <div key={g.term} className="rounded-xl border border-white/[0.06] bg-black/15 px-4 py-3">
                          <dt className="text-sm font-semibold text-tp-green">{g.term}</dt>
                          <dd className="mt-0.5 text-[15px] leading-relaxed text-zinc-300">{g.meaning}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </Section>

            {/* Checklist + exits + risk */}
            <div id="checklist" className="grid scroll-mt-36 gap-4 xl:grid-cols-[1.25fr_1fr]">
              <Checklist rules={strategy.entryRules} />
              <div className="grid gap-4">
                <RuleList title="Exit plan" tone="blue" icon={LogOut} rules={strategy.exitRules} />
                <RuleList title="Risk rules" tone="red" icon={Shield} rules={strategy.riskManagement} />
              </div>
            </div>

            {/* Sizer */}
            <Section
              id="size-it"
              title="Size it for micros"
              icon={Calculator}
              subtitle="How many contracts to put in, and the exact stop & target ticks for your TradingView bracket."
            >
              <PositionSizer
                strategyId={strategy.id}
                defaultSymbol={sizing?.symbol}
                defaultStop={sizing?.stopPoints ?? 10}
                defaultR={targetR}
                note={sizing?.note}
              />
            </Section>

            {/* TradingView */}
            <Section
              id="tradingview"
              title="Set it up in TradingView"
              icon={MonitorPlay}
              subtitle={tv ? `Chart: ${tv.timeframe}` : undefined}
              action={
                onOpenToolkit && (
                  <button
                    onClick={onOpenToolkit}
                    className="inline-flex items-center gap-1 text-sm font-medium text-tp-green hover:underline"
                  >
                    Full toolkit <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )
              }
            >
              <div className="grid gap-4 lg:grid-cols-3">
                {(tv?.tools ?? [{ name: "Horizontal lines", how: "Alt/Option + H to mark your key levels before the session." }]).map((t, i) => (
                  <div key={t.name} className="rounded-xl border border-white/[0.06] bg-black/15 p-4">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.07] text-xs font-semibold text-zinc-200">
                        {i + 1}
                      </span>
                      <span className="text-[15px] font-semibold text-zinc-100">{t.name}</span>
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">{t.how}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-tp-green/20 bg-tp-green/[0.05] p-4">
                  <div className="flex items-center gap-2 text-[15px] font-semibold text-zinc-100">
                    <Target className="h-4 w-4 text-tp-green" />
                    Bracket every order
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">
                    In the order ticket tick Take Profit and Stop Loss, switch to ticks, and paste the numbers from{" "}
                    <button onClick={() => jump("size-it")} className="font-medium text-tp-green hover:underline">
                      Size it
                    </button>
                    . Your exit is decided before you enter.
                  </p>
                </div>
                {tv && (
                  <div className="rounded-xl border border-tp-blue/20 bg-tp-blue/[0.05] p-4">
                    <div className="flex items-center gap-2 text-[15px] font-semibold text-zinc-100">
                      <BellRing className="h-4 w-4 text-tp-blue" />
                      Alerts
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-zinc-400">{tv.alerts}</p>
                  </div>
                )}
              </div>
            </Section>

            {/* Worked examples */}
            <Section id="examples" title="Worked examples" icon={Target}>
              <div className="space-y-5">
                {strategy.examples.map((ex, i) => {
                  const isWin = /\+|profit|win|base hit/i.test(ex.result);
                  const chart = buildStrategyChart({
                    symbol: i % 2 === 0 ? "ES" : "NQ",
                    subtitle: ex.title,
                    direction: i % 2 === 0 ? "Long" : "Short",
                    variant: i % 2 === 0 ? 2 : 1,
                  });
                  return (
                    <div key={i} className="overflow-hidden rounded-xl border border-white/[0.06] bg-tp-base/40">
                      <div className="grid gap-0 lg:grid-cols-2">
                        <figure className="border-b border-white/[0.06] lg:border-b-0 lg:border-r">
                          <Image
                            src={chart}
                            alt={`Illustrative price path for ${ex.title}`}
                            width={720}
                            height={320}
                            unoptimized
                            className="h-auto w-full"
                          />
                          <figcaption className="px-4 py-2 text-xs text-zinc-500">
                            Conceptual illustration · not the historical trade described
                          </figcaption>
                        </figure>
                        <div className="p-5 sm:p-6">
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                            <h4 className="text-lg font-semibold text-zinc-50">{ex.title}</h4>
                            <span
                              className={clsx(
                                "rounded-full px-2.5 py-1 text-xs font-semibold",
                                isWin ? "bg-tp-green/15 text-tp-green" : "bg-white/[0.06] text-zinc-300",
                              )}
                            >
                              {ex.result}
                            </span>
                          </div>
                          <p className="mb-4 text-[15px] text-zinc-400">{ex.description}</p>
                          <dl className="space-y-3">
                            <ExRow label="Setup" tone="blue" value={ex.setup} />
                            <ExRow label="Entry" tone="green" value={ex.entry} />
                            <ExRow label="Exit" tone="yellow" value={ex.exit} />
                          </dl>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Edge & pitfalls */}
            <div id="pitfalls" className="grid scroll-mt-36 gap-4 lg:grid-cols-2">
              <BulletCard
                title="What gives you the edge"
                icon={Lightbulb}
                tone="green"
                items={strategy.tips}
              />
              <BulletCard
                title="What blows it up"
                icon={AlertTriangle}
                tone="red"
                items={strategy.commonMistakes}
              />
            </div>

            <PlaybookAI strategy={strategy} base={base ?? strategy} screenshots={anatomy.screenshots} />

            <p className="text-center text-xs text-zinc-500">
              Educational playbook · win rate and R:R are illustrative. Backtest on your own data before trading live.
            </p>
          </div>
        )}
      />
    </div>
  );
};

// ─── Bits ────────────────────────────────────────────────────────────────────

const Chip: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-zinc-300">
    {icon}
    {children}
  </span>
);

const Kpi: React.FC<{ label: string; value: string; sub?: string; accent?: boolean }> = ({ label, value, sub, accent }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3">
    <div className="text-xs font-medium text-zinc-500">{label}</div>
    <div className={clsx("mt-0.5 text-xl font-semibold tabular-nums", accent ? "text-tp-green" : "text-zinc-50")}>{value}</div>
    {sub && <div className="text-xs text-zinc-500">{sub}</div>}
  </div>
);

const Section: React.FC<{
  id?: string;
  title: string;
  icon: typeof BookOpen;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, icon: Icon, subtitle, action, children }) => (
  <section id={id} className="scroll-mt-36 rounded-2xl border border-white/[0.06] bg-tp-card p-5 sm:p-7">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tp-green/10 ring-1 ring-inset ring-tp-green/20">
          <Icon className="h-[18px] w-[18px] text-tp-green" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[15px] text-zinc-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

function Checklist({ rules }: { rules: string[] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const all = done.size === rules.length;
  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <section className="rounded-2xl border border-tp-green/20 bg-tp-card p-5 sm:p-7">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tp-green/10 ring-1 ring-inset ring-tp-green/20">
            <ListChecks className="h-[18px] w-[18px] text-tp-green" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-50">Pre-trade checklist</h2>
            <p className="mt-0.5 text-[15px] text-zinc-400">Tick every box before you enter. Any box empty = no trade.</p>
          </div>
        </div>
        {done.size > 0 && (
          <button
            onClick={() => setDone(new Set())}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-tp-green transition-all" style={{ width: `${(done.size / rules.length) * 100}%` }} />
      </div>

      <ul className="space-y-2">
        {rules.map((rule, i) => {
          const on = done.has(i);
          return (
            <li key={i}>
              <button
                onClick={() => toggle(i)}
                aria-pressed={on}
                className={clsx(
                  "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  on ? "border-tp-green/25 bg-tp-green/[0.06]" : "border-white/[0.06] bg-black/10 hover:border-white/[0.12]",
                )}
              >
                {on ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-tp-green" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-600" />
                )}
                <span className={clsx("text-[15px] leading-relaxed", on ? "text-zinc-100" : "text-zinc-300")}>
                  <span className="mr-1.5 font-semibold tabular-nums text-zinc-500">{i + 1}.</span>
                  {rule}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        className={clsx(
          "mt-4 rounded-xl px-4 py-3 text-[15px] font-medium",
          all ? "bg-tp-green/15 text-tp-green" : "bg-white/[0.04] text-zinc-400",
        )}
      >
        {all
          ? "All boxes ticked — take it with your planned size and bracket."
          : `${done.size} of ${rules.length} confirmed · keep waiting`}
      </div>
    </section>
  );
}

const TONE = {
  green: { text: "text-tp-green", bg: "bg-tp-green/10", border: "border-tp-green/20", dot: "bg-tp-green" },
  blue: { text: "text-tp-blue", bg: "bg-tp-blue/10", border: "border-tp-blue/20", dot: "bg-tp-blue" },
  red: { text: "text-tp-red", bg: "bg-tp-red/10", border: "border-tp-red/20", dot: "bg-tp-red" },
} as const;

const RuleList: React.FC<{
  title: string;
  tone: keyof typeof TONE;
  icon: typeof Shield;
  rules: string[];
}> = ({ title, tone, icon: Icon, rules }) => {
  const t = TONE[tone];
  return (
    <div className={clsx("rounded-2xl border bg-tp-card p-5", t.border)}>
      <div className="mb-3 flex items-center gap-2">
        <span className={clsx("grid h-8 w-8 place-items-center rounded-lg", t.bg, t.text)}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-base font-semibold text-zinc-50">{title}</h3>
      </div>
      <ul className="space-y-2.5">
        {rules.map((rule, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-zinc-300">
            <span className={clsx("mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
};

const BulletCard: React.FC<{
  title: string;
  icon: typeof Shield;
  tone: "green" | "red";
  items: string[];
}> = ({ title, icon: Icon, tone, items }) => {
  const t = TONE[tone];
  return (
    <div className={clsx("rounded-2xl border p-5 sm:p-6", t.border, tone === "green" ? "bg-tp-green/[0.04]" : "bg-tp-red/[0.04]")}>
      <div className="mb-4 flex items-center gap-2">
        <Icon className={clsx("h-5 w-5", t.text)} />
        <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-zinc-300">
            {tone === "green" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-tp-green" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tp-red" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

const EX_TONE = { green: "text-tp-green", blue: "text-tp-blue", yellow: "text-tp-yellow" } as const;

const ExRow: React.FC<{ label: string; tone: keyof typeof EX_TONE; value: string }> = ({ label, tone, value }) => (
  <div className="grid grid-cols-[64px_1fr] gap-3">
    <dt className={clsx("pt-0.5 text-xs font-semibold uppercase tracking-wide", EX_TONE[tone])}>{label}</dt>
    <dd className="text-[15px] leading-relaxed text-zinc-300">{value}</dd>
  </div>
);

