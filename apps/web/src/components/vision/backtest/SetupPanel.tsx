"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Building2, Database, MessageSquareText, Play, Radio, ScanEye } from "lucide-react";
import { READERS, READER_ORDER, type ReaderChoice } from "@/lib/vision/analyze";
import { SESSION_WINDOWS, TEMPLATES, parseRules, type SessionKey } from "@/lib/vision/custom";
import { SYMBOLS, TIMEFRAMES, isSymbol, type Timeframe, type VisionSymbolId } from "@/lib/vision/markets";
import { DD_LABEL, FIRM_PROGRAMS, programByKey } from "@/lib/proving/firms";
import { useVisionStore } from "@/store/visionStore";
import { dateOf, money, type Library } from "./data";
import { RulesEditor } from "./RulesEditor";
import { Field, Num, Seg, Toggle } from "./ui";

const MARKETS: VisionSymbolId[] = ["NQ", "ES", "GC", "CL", "BTC", "ETH", "SOL", "XRP"];
const PERIODS = [
  { v: 0, l: "All" },
  { v: 30, l: "30D" },
  { v: 90, l: "90D" },
  { v: 365, l: "1Y" },
  { v: 1095, l: "3Y" },
  { v: -1, l: "Custom" },
];
const BALANCES = [5_000, 10_000, 25_000, 50_000, 100_000, 150_000];
const SESSIONS: SessionKey[] = ["all", "asia", "london", "ny", "open"];
// Roughly what the free feeds hold at each timeframe.
const FEED_DAYS: Record<"futures" | "crypto", Record<Timeframe, string>> = {
  futures: { "1m": "7 days", "5m": "60 days", "15m": "60 days", "1h": "2 years", "4h": "2 years" },
  crypto: { "1m": "6 days", "5m": "31 days", "15m": "94 days", "1h": "1 year", "4h": "1 year" },
};

function Step({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-5 backdrop-blur-2xl">
      <header className="mb-4 flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-white text-[13px] font-bold text-black">{n}</span>
        <div>
          <h3 className="text-[16px] font-bold tracking-tight text-white">{title}</h3>
          {sub && <p className="text-[12px] text-white/45">{sub}</p>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Chips<T extends string | number>({ value, options, onChange, disabled }: { value: T; options: { v: T; l: React.ReactNode; title?: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          disabled={disabled}
          title={o.title}
          onClick={() => onChange(o.v)}
          aria-pressed={o.v === value}
          className={clsx("rounded-full px-3 py-1.5 text-[12.5px] font-semibold ring-1 transition disabled:opacity-40", o.v === value ? "bg-[#5AC8FA]/15 text-white ring-[#5AC8FA]/55" : "bg-white/[0.04] text-white/60 ring-white/[0.07] hover:bg-white/[0.08] hover:text-white")}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function SetupPanel({ lib, has, onRun, running, progress, rules = true, runLabel = "Run backtest" }: { lib: Library | null; has: { fomc: boolean; early: boolean; vix: boolean }; onRun: () => void; running: boolean; progress: number | null; rules?: boolean; runLabel?: string }) {
  const bt = useVisionStore((s) => s.bt);
  const setBt = useVisionStore((s) => s.setBt);
  const sym = isSymbol(bt.symbol) ? SYMBOLS[bt.symbol] : null;
  const series = lib?.series[bt.symbol];
  const crypto = sym?.kind === "crypto";
  // Without library data for this market the free feed is used, whatever was picked.
  const source = series ? bt.source : "feed";
  const program = programByKey(bt.prop.program);
  const propOn = !crypto && bt.prop.on && !!program;

  // The words are read as they are typed; edits on the rule cards then win until the words change.
  const [text, setText] = useState(bt.text);
  useEffect(() => setText(bt.text), [bt.text]);
  const parsed = useMemo(() => parseRules(text), [text]);
  useEffect(() => {
    if (bt.logic !== "custom") return;
    const id = setTimeout(() => {
      if (text !== bt.text || !bt.rules) setBt({ text, rules: parsed.rules, ...(parsed.rules.session ? { session: parsed.rules.session } : {}) });
    }, 350);
    return () => clearTimeout(id);
  }, [text, bt.logic]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTemplate = (t: string) => {
    const p = parseRules(t).rules;
    setBt({ text: t, rules: p, ...(p.session ? { session: p.session } : {}) });
  };
  const pickSymbol = (id: VisionSymbolId) => setBt({ symbol: id, source: lib?.series[id] ? "library" : "feed" });
  const programs = useMemo(() => {
    const m = new Map<string, typeof FIRM_PROGRAMS>();
    for (const p of FIRM_PROGRAMS) m.set(`${p.firm} · ${p.program}`, [...(m.get(`${p.firm} · ${p.program}`) ?? []), p]);
    return [...m.entries()];
  }, []);

  return (
    <div className="space-y-4">
      <Step n={1} title="Market" sub="Symbol, timeframe, dates, balance and session">
        <div className="grid grid-cols-4 gap-1.5">
          {MARKETS.map((id) => {
            const m = SYMBOLS[id];
            const own = !!lib?.series[id];
            return (
              <button
                key={id}
                onClick={() => pickSymbol(id)}
                className={clsx("relative rounded-[13px] px-2 py-2 text-left ring-1 transition", bt.symbol === id ? "bg-[#5AC8FA]/12 ring-[#5AC8FA]/55" : "bg-white/[0.04] ring-white/[0.06] hover:bg-white/[0.07]")}
              >
                <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-white">
                  <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                  {id}
                </span>
                <span className="block truncate text-[11px] text-white/45">{m.name}</span>
                {own && <Database className="absolute right-1.5 top-1.5 h-3 w-3 text-[#9BE1FF]" aria-label="In your library" />}
              </button>
            );
          })}
        </div>
        <Field
          label="Data"
          hint={
            source === "library" && series
              ? `${dateOf(series.from)} – ${dateOf(series.to)} · ${Math.round(series.bars).toLocaleString()} one-minute bars`
              : sym
                ? `${crypto ? "Coinbase" : "Yahoo, continuous contract"} · about ${FEED_DAYS[crypto ? "crypto" : "futures"][bt.tf]} at ${bt.tf}${series ? "" : ". Add files in Library for years of history."}`
                : ""
          }
        >
          <Seg
            full
            value={source}
            onChange={(v) => setBt({ source: v })}
            options={[
              { v: "library" as const, l: <span className="flex items-center justify-center gap-1.5"><Database className="h-3.5 w-3.5" /> Your library</span>, disabled: !series, title: series ? undefined : `No ${bt.symbol} in your library yet` },
              { v: "feed" as const, l: <span className="flex items-center justify-center gap-1.5"><Radio className="h-3.5 w-3.5" /> Free feed</span>, disabled: !sym },
            ]}
          />
        </Field>
        <Field label="Execution timeframe">
          <Seg full size="sm" value={bt.tf} onChange={(tf) => setBt({ tf })} options={TIMEFRAMES.map((t) => ({ v: t, l: t }))} />
        </Field>
        <Field label="Period">
          <Seg full size="sm" value={bt.days} onChange={(days) => setBt({ days })} options={PERIODS} />
          {bt.days === -1 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="date" value={bt.from ?? ""} onChange={(e) => setBt({ from: e.target.value })} className="rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] text-white [color-scheme:dark] ring-1 ring-inset ring-white/[0.07]" aria-label="From" />
              <input type="date" value={bt.to ?? ""} onChange={(e) => setBt({ to: e.target.value })} className="rounded-xl bg-white/[0.06] px-3 py-2 text-[13px] text-white [color-scheme:dark] ring-1 ring-inset ring-white/[0.07]" aria-label="To" />
            </div>
          )}
        </Field>
        {rules && (
          <Field label="Start balance" hint={propOn ? `Set by ${program!.firm} ${program!.sizeLabel}` : undefined}>
            <Chips value={propOn ? program!.size : bt.balance} onChange={(balance) => setBt({ balance })} disabled={propOn} options={BALANCES.map((b) => ({ v: b, l: `${b / 1000}K` }))} />
          </Field>
        )}
        <Field label="Trading session" hint={SESSION_WINDOWS[bt.session].detail + (bt.session === "asia" || bt.session === "london" ? ". VWAP strategies read the day's VWAP outside New York." : "")}>
          <Chips value={bt.session} onChange={(session) => setBt({ session })} options={SESSIONS.map((k) => ({ v: k, l: SESSION_WINDOWS[k].label }))} />
        </Field>
      </Step>

      <Step n={2} title={rules ? "Strategy" : "Vision reads with"} sub={rules ? "Pick one of yours, or write the logic in plain English" : "Vision marks these setups as they form"}>
        {rules && (
          <Seg
            full
            value={bt.logic}
            onChange={(logic) => setBt({ logic, ...(logic === "custom" && !bt.rules ? { rules: parseRules(bt.text).rules } : {}) })}
            options={[
              { v: "vision" as const, l: <span className="flex items-center justify-center gap-1.5"><ScanEye className="h-3.5 w-3.5" /> Vision strategies</span> },
              { v: "custom" as const, l: <span className="flex items-center justify-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5" /> Your words</span> },
            ]}
          />
        )}
        {!rules || bt.logic === "vision" ? (
          <div className="space-y-1">
            {(["auto", ...READER_ORDER] as ReaderChoice[]).map((r) => (
              <button
                key={r}
                onClick={() => setBt({ reader: r })}
                className={clsx("flex w-full items-start gap-2.5 rounded-[13px] px-3 py-2 text-left transition", bt.reader === r ? "bg-[#5AC8FA]/12 ring-1 ring-[#5AC8FA]/45" : "hover:bg-white/[0.05]")}
              >
                <span className={clsx("mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full ring-2", bt.reader === r ? "ring-[#5AC8FA]" : "ring-white/25")}>{bt.reader === r && <span className="h-1.5 w-1.5 rounded-full bg-[#5AC8FA]" />}</span>
                <span>
                  <span className="block text-[13.5px] font-semibold text-white">{r === "auto" ? "Every strategy" : READERS[r].label}</span>
                  <span className="block text-[11.5px] leading-snug text-white/45">{r === "auto" ? "Takes whichever of your strategies fires first" : READERS[r].blurb}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => applyTemplate(t.text)} className={clsx("whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1", bt.text === t.text ? "bg-white text-black ring-white" : "bg-white/[0.04] text-white/65 ring-white/[0.08] hover:text-white")}>
                  {t.name}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-white/55">Strategy logic</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Describe entries, exits and risk the way you'd explain them to another trader."
                className="w-full resize-y rounded-[16px] bg-white/[0.05] px-3.5 py-3 text-[13.5px] leading-relaxed text-white placeholder:text-white/30 outline-none ring-1 ring-inset ring-white/[0.08] focus:ring-[#5AC8FA]/60"
              />
            </label>
            {bt.rules && <RulesEditor rules={bt.rules} onChange={(r) => setBt({ rules: r })} unknown={text === bt.text ? parsed.unknown : []} />}
          </>
        )}
      </Step>

      {rules && (
        <Step n={3} title="Risk & rules" sub="Size, costs, management and filters">
          <Field label="Direction">
            <Seg full size="sm" value={bt.side} onChange={(side) => setBt({ side })} options={[{ v: "both" as const, l: "Both" }, { v: "long" as const, l: "Longs" }, { v: "short" as const, l: "Shorts" }]} />
          </Field>
          {crypto ? (
            <Field label="Risk per trade" hint="Each trade is sized so the stop costs this much.">
              <Num value={bt.riskDollars} onChange={(riskDollars) => setBt({ riskDollars })} min={1} prefix="$" />
            </Field>
          ) : (
            sym && (
              <Field
                label="Position size"
                hint={
                  bt.sizing === "risk"
                    ? `Whole ${bt.micro ? sym.roots!.micro : sym.roots!.full} contracts risking up to ${money((propOn ? program!.size : bt.balance) * (bt.riskPct / 100))} a trade; trades that can't fit one are skipped.`
                    : `${bt.micro ? sym.roots!.micro : sym.roots!.full} · $${bt.micro ? sym.pointValue!.micro : sym.pointValue!.full} a point per contract`
                }
              >
                <div className="flex flex-wrap gap-2">
                  <Seg size="sm" value={bt.sizing} onChange={(sizing) => setBt({ sizing })} options={[{ v: "fixed" as const, l: "Contracts" }, { v: "risk" as const, l: "% risk" }]} />
                  {bt.sizing === "fixed" ? <Num value={bt.contracts} onChange={(contracts) => setBt({ contracts: Math.round(contracts) })} min={1} max={50} width="w-24" /> : <Num value={bt.riskPct} onChange={(riskPct) => setBt({ riskPct })} min={0.1} max={10} step={0.1} suffix="%" width="w-24" />}
                  <Seg size="sm" value={bt.micro ? 1 : 0} onChange={(v) => setBt({ micro: v === 1 })} options={[{ v: 1, l: "Micro" }, { v: 0, l: "Full" }]} />
                </div>
              </Field>
            )
          )}
          <div className="grid grid-cols-3 gap-2">
            <Field label={crypto ? "Fees / trade" : "Comm. / RT"}>
              <Num value={bt.commission} onChange={(commission) => setBt({ commission })} min={0} step={0.01} prefix="$" />
            </Field>
            <Field label="Slippage">
              <Num value={bt.slippageTicks} onChange={(slippageTicks) => setBt({ slippageTicks })} min={0} max={20} suffix="tick" />
            </Field>
            <Field label="Max hold">
              <Num value={bt.maxHold} onChange={(maxHold) => setBt({ maxHold: Math.round(maxHold) })} min={2} max={2000} suffix="bars" />
            </Field>
          </div>
          {bt.logic === "vision" && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Break-even">
                <Seg full size="sm" value={bt.breakEvenR ?? 0} onChange={(v) => setBt({ breakEvenR: v || null })} options={[{ v: 0, l: "Off" }, { v: 1, l: "1R" }, { v: 1.5, l: "1.5R" }]} />
              </Field>
              <Field label="Trades a day">
                <Seg full size="sm" value={bt.maxPerDay ?? 0} onChange={(v) => setBt({ maxPerDay: v || null })} options={[{ v: 0, l: "Any" }, { v: 1, l: "1" }, { v: 2, l: "2" }, { v: 3, l: "3" }]} />
              </Field>
            </div>
          )}
          <Field label="Filters" hint={has.fomc || has.vix ? undefined : "Add the free-data pack in Library to filter by FOMC days, early closes and VIX."}>
            <div className="space-y-1 rounded-[15px] bg-white/[0.03] px-3 py-2">
              <Toggle label="Skip FOMC days" on={bt.skipFomc} onChange={(skipFomc) => setBt({ skipFomc })} disabled={!has.fomc} />
              <Toggle label="Skip early-close days" on={bt.skipEarly} onChange={(skipEarly) => setBt({ skipEarly })} disabled={!has.early} />
              <div className="flex items-center justify-between gap-2 py-1">
                <span className={clsx("text-[13.5px]", has.vix ? "text-white/80" : "text-white/35")}>VIX (prior close)</span>
                <Seg size="sm" value={has.vix ? bt.vix : "any"} onChange={(vix) => setBt({ vix })} options={[{ v: "any" as const, l: "Any" }, { v: "low" as const, l: "<15", disabled: !has.vix }, { v: "mid" as const, l: "15–25", disabled: !has.vix }, { v: "high" as const, l: "25+", disabled: !has.vix }]} />
              </div>
            </div>
          </Field>

          {!crypto && (
            <div className={clsx("rounded-[18px] p-3 ring-1 transition", propOn ? "bg-[#BF5AF2]/[0.08] ring-[#BF5AF2]/40" : "bg-white/[0.03] ring-white/[0.06]")}>
              <div className="flex items-center gap-2.5">
                <span className={clsx("grid h-8 w-8 place-items-center rounded-[10px]", propOn ? "bg-[#BF5AF2] text-white" : "bg-white/[0.07] text-white/60")}>
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-white">Prop firm mode</p>
                  <p className="text-[11.5px] text-white/45">Grade the run against a firm&apos;s rules and find the size that passes</p>
                </div>
                <div className="w-[46px]">
                  <Toggle label="" on={bt.prop.on} onChange={(on) => setBt({ prop: { ...bt.prop, on } })} />
                </div>
              </div>
              {bt.prop.on && (
                <div className="mt-3 space-y-2">
                  <select value={bt.prop.program} onChange={(e) => setBt({ prop: { ...bt.prop, program: e.target.value } })} aria-label="Firm and account" className="w-full rounded-xl bg-white/[0.07] px-3 py-2 text-[13px] text-white ring-1 ring-inset ring-white/[0.08]">
                    {programs.map(([name, ps]) => (
                      <optgroup key={name} label={name}>
                        {ps.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.firm} {p.sizeLabel} · {p.program}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {program && (
                    <div className="grid grid-cols-2 gap-1.5 text-[12px]">
                      <Rule k="Profit target" v={money(program.target)} />
                      <Rule k={`${DD_LABEL[program.ddType]} DD`} v={money(program.drawdown)} />
                      <Rule k="Daily loss limit" v={program.dll ? money(program.dll) : "None"} />
                      <Rule k="Consistency" v={program.consistencyPct >= 100 ? "None" : `${program.consistencyPct}% best day`} />
                      <Rule k="Min days" v={String(program.minDays)} />
                      <Rule k="Max size" v={`${program.maxMinis} minis / ${program.maxMicros} micros`} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Step>
      )}

      <button
        onClick={onRun}
        disabled={running || !(sym || series)}
        className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[18px] bg-gradient-to-b from-[#8EE3FF] to-[#3AB4F2] py-4 text-[16px] font-bold text-black shadow-[0_14px_34px_-12px_rgba(90,200,250,0.85)] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
      >
        {running && progress != null && <span className="absolute inset-y-0 left-0 bg-white/35 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />}
        <Play className="relative h-4 w-4 fill-current" />
        <span className="relative">{running ? (progress != null ? `Testing… ${Math.round(progress * 100)}%` : "Loading history…") : runLabel}</span>
      </button>
    </div>
  );
}

function Rule({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-2.5 py-1.5">
      <p className="text-[10.5px] text-white/40">{k}</p>
      <p className="font-semibold text-white/85">{v}</p>
    </div>
  );
}
