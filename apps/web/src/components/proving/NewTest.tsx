"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowRight, Check, FlaskConical, Minus, Plus, Rocket, X } from "lucide-react";
import {
  INSTRUMENTS,
  STRATEGIES,
  TF_HISTORY_DAYS,
  defaultConfig,
  runSession,
  stats,
  type Instrument,
  type StrategyConfig,
  type StrategyId,
  type Timeframe,
} from "@/lib/proving/engine";
import { DD_LABEL, FIRM_PROGRAMS, evaluate, programByKey } from "@/lib/proving/firms";
import { loadFeed } from "@/lib/proving/runner";
import { nyClock } from "@/lib/pilot/market";
import { StrategyGlyph } from "./glyphs";

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const FIRMS = [...new Map(FIRM_PROGRAMS.map((p) => [p.firm, p.firm])).keys()];

export interface NewTestInput {
  name: string;
  cfg: StrategyConfig;
  programKey: string;
  startDate: string;
}

export function NewTest({
  initial,
  onCreate,
  onClose,
  title = "New test",
  cta = "Launch test",
}: {
  initial?: Partial<NewTestInput>;
  onCreate: (t: NewTestInput) => void;
  onClose: () => void;
  title?: string;
  cta?: string;
}) {
  const [cfg, setCfg] = useState<StrategyConfig>(initial?.cfg ?? defaultConfig("double-break-vwap"));
  const [programKey, setProgramKey] = useState(initial?.programKey ?? "lucid-flex:lucidflex-50k");
  const [replayDays, setReplayDays] = useState(30);
  const [name, setName] = useState(initial?.name ?? "");
  const [refPrice, setRefPrice] = useState<number | null>(null);
  const program = programByKey(programKey)!;
  const firm = program.firm;
  const set = (patch: Partial<StrategyConfig>) => setCfg((c) => ({ ...c, ...patch }));

  // Real bars for the preview, and a live price to size default stops with.
  const [feed, setFeed] = useState<Awaited<ReturnType<typeof loadFeed>> | null>(null);
  const [feedErr, setFeedErr] = useState("");
  useEffect(() => {
    let off = false;
    setFeed(null);
    loadFeed(INSTRUMENTS[cfg.instrument].source, cfg.timeframe)
      .then((f) => {
        if (off) return;
        setFeed(f);
        setFeedErr("");
        setRefPrice(f.bars[f.bars.length - 1]?.c ?? null);
      })
      .catch((e) => !off && setFeedErr(e.message));
    return () => {
      off = true;
    };
  }, [cfg.instrument, cfg.timeframe]);

  const maxReplay = Math.max(0, (feed?.sessions.length ?? TF_HISTORY_DAYS[cfg.timeframe]) - 2);
  const days = Math.min(replayDays, maxReplay);
  const startDate = useMemo(() => {
    if (!feed || days === 0) {
      // Next session: today if the open hasn't passed, else tomorrow.
      const c = nyClock(Date.now());
      return c.date;
    }
    return feed.sessions[feed.sessions.length - days]?.date ?? feed.sessions[1]?.date;
  }, [feed, days]);

  // Preview: the same engine and the same rules the live test will use.
  const preview = useMemo(() => {
    if (!feed || cfg.strategy === "tv-signals") return null;
    const today = nyClock(Date.now()).date;
    const sims = feed.sessions.slice(1).filter((s) => s.date >= (days ? startDate : feed.sessions[Math.max(1, feed.sessions.length - 30)].date) && s.date < today).map((s) => runSession(s, cfg));
    const e = evaluate(sims, program, { contracts: cfg.contracts, micro: INSTRUMENTS[cfg.instrument].micro });
    return { e, st: stats(sims), n: sims.length };
  }, [feed, cfg, program, startDate, days]);

  const choose = (strategy: StrategyId) => setCfg((c) => ({ ...defaultConfig(strategy, c.instrument, refPrice ?? undefined), contracts: c.contracts, timeframe: c.timeframe }));
  const instrument = (i: Instrument) => setCfg((c) => ({ ...defaultConfig(c.strategy, i, i === c.instrument ? refPrice ?? undefined : undefined), timeframe: c.timeframe }));
  const tiers = FIRM_PROGRAMS.filter((p) => p.firmId === program.firmId);
  const autoName = `${STRATEGIES[cfg.strategy].short} · ${program.firm.split(" ")[0]} ${program.sizeLabel}`;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="tp-sheet-in flex h-full w-full max-w-[1120px] flex-col overflow-hidden border-l border-white/[0.08] bg-tp-base shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
              <FlaskConical className="h-4 w-4 text-tp-green" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-zinc-50">{title}</h2>
              <p className="text-xs text-zinc-500">Strategy × firm rules × a start date. It replays, then trades live every session.</p>
            </div>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 space-y-8 overflow-y-auto px-6 py-6">
            {/* 1 · Strategy */}
            <Section n={1} title="Strategy">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(STRATEGIES) as StrategyId[]).map((id) => {
                  const on = cfg.strategy === id;
                  return (
                    <button
                      key={id}
                      onClick={() => choose(id)}
                      className={clsx(
                        "group relative flex flex-col gap-2 rounded-xl border p-3 text-left transition",
                        on ? "border-tp-green/40 bg-tp-green/[0.06] shadow-[0_0_0_1px_rgba(0,214,143,0.15)]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]",
                      )}
                    >
                      <StrategyGlyph id={id} active={on} />
                      <span className="text-[13px] font-semibold text-zinc-100">{STRATEGIES[id].label}</span>
                      <span className="text-[11.5px] leading-snug text-zinc-500">{STRATEGIES[id].blurb}</span>
                      {on && <Check className="absolute right-2.5 top-2.5 h-4 w-4 text-tp-green" />}
                    </button>
                  );
                })}
              </div>
              <ul className="mt-3 grid gap-1 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3 sm:grid-cols-2">
                {STRATEGIES[cfg.strategy].rules.map((r) => (
                  <li key={r} className="flex gap-2 text-[12px] text-zinc-400">
                    <span className="text-tp-green">·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </Section>

            {/* 2 · Firm */}
            <Section n={2} title="Prop firm rules">
              <div className="flex flex-wrap gap-1.5">
                {FIRMS.map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      const p = FIRM_PROGRAMS.find((x) => x.firm === f && x.size === program.size) || FIRM_PROGRAMS.find((x) => x.firm === f)!;
                      setProgramKey(p.key);
                    }}
                    className={clsx("rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition", f === firm ? "bg-white/[0.1] text-zinc-50 ring-1 ring-white/[0.14]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100")}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[...new Map(FIRM_PROGRAMS.filter((p) => p.firm === firm).map((p) => [p.firmId, p])).values()].map((p) => {
                  const on = p.firmId === program.firmId;
                  const atSize = FIRM_PROGRAMS.find((x) => x.firmId === p.firmId && x.size === program.size) || p;
                  return (
                    <button
                      key={p.firmId}
                      onClick={() => setProgramKey(atSize.key)}
                      className={clsx("rounded-xl border p-3 text-left transition", on ? "border-tp-blue/40 bg-tp-blue/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-zinc-100">{p.program}</span>
                        <span className={clsx("rounded px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider", p.model === "instant" ? "bg-tp-yellow/10 text-tp-yellow" : "bg-white/[0.05] text-zinc-400")}>
                          {p.model === "instant" ? "Straight to funded" : "Evaluation"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-zinc-500">
                        {DD_LABEL[p.ddType]} · {p.consistencyPct < 100 ? `${p.consistencyPct}% consistency` : "no consistency"} · {p.minDays}-day min
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Account</span>
                {tiers.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setProgramKey(t.key)}
                    className={clsx("rounded-lg px-2.5 py-1 font-mono text-[12px] transition", t.key === programKey ? "bg-tp-green/15 text-tp-green ring-1 ring-tp-green/30" : "text-zinc-400 hover:bg-white/[0.05]")}
                  >
                    {t.sizeLabel}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Rule k="Profit target" v={usd(program.target)} />
                <Rule k={`${DD_LABEL[program.ddType]} DD`} v={usd(program.drawdown)} />
                <Rule k="Daily loss limit" v={program.dll ? usd(program.dll) : "None"} />
                <Rule k="Max size" v={`${program.maxMinis} minis / ${program.maxMicros} micros`} />
              </div>
            </Section>

            {/* 3 · Rules */}
            <Section n={3} title="Execution rules">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Instrument">
                  <Seg value={cfg.instrument} onChange={instrument} options={(Object.keys(INSTRUMENTS) as Instrument[]).map((i) => ({ value: i, label: i }))} />
                </Field>
                <Field label="Contracts">
                  <Stepper value={cfg.contracts} min={1} max={INSTRUMENTS[cfg.instrument].micro ? program.maxMicros : program.maxMinis} onChange={(contracts) => set({ contracts })} />
                </Field>
                <Field label="Bar size">
                  <Seg value={cfg.timeframe} onChange={(timeframe: Timeframe) => set({ timeframe })} options={[{ value: "1m", label: "1 min" }, { value: "2m", label: "2 min" }, { value: "5m", label: "5 min" }]} />
                </Field>
                <Field label="Direction">
                  <Seg value={cfg.direction} onChange={(direction) => set({ direction })} options={[{ value: "both", label: "Both" }, { value: "long", label: "Long only" }, { value: "short", label: "Short only" }]} />
                </Field>
                <Field label="Stop">
                  <Seg value={cfg.stopMode} onChange={(stopMode) => set({ stopMode })} options={[{ value: "structure", label: "Structure" }, { value: "fixed", label: "Fixed points" }]} />
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Num label={cfg.stopMode === "fixed" ? "Stop pts" : "Fallback"} value={cfg.stopPoints} onChange={(stopPoints) => set({ stopPoints })} />
                    <Num label="Min pts" value={cfg.minStop} onChange={(minStop) => set({ minStop })} />
                    <Num label="Max pts" value={cfg.maxStop} onChange={(maxStop) => set({ maxStop })} />
                  </div>
                </Field>
                <Field label="Target">
                  <Seg value={String(cfg.targetR)} onChange={(v) => set({ targetR: Number(v) })} options={["1", "1.5", "2", "3"].map((v) => ({ value: v, label: `${v}R` }))} />
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-zinc-400">
                    <input type="checkbox" checked={cfg.breakEvenR > 0} onChange={(e) => set({ breakEvenR: e.target.checked ? 1 : 0 })} className="accent-[#00D68F]" />
                    Move stop to break-even at +1R
                  </label>
                </Field>
                <Field label="Trading window (ET)">
                  <div className="grid grid-cols-3 gap-2">
                    <Num label="Wait min" value={cfg.waitMinutes} onChange={(waitMinutes) => set({ waitMinutes })} />
                    <Time label="Last entry" value={cfg.lastEntry} onChange={(lastEntry) => set({ lastEntry })} />
                    <Time label="Flat by" value={cfg.flatBy} onChange={(flatBy) => set({ flatBy })} />
                  </div>
                </Field>
                <Field label="Day limits">
                  <div className="grid grid-cols-3 gap-2">
                    <Num label="Max trades" value={cfg.maxTrades} onChange={(maxTrades) => set({ maxTrades })} />
                    <Num label="Stop after L" value={cfg.stopAfterLosses} onChange={(stopAfterLosses) => set({ stopAfterLosses })} />
                    <Num label="Daily stop $" value={cfg.dailyStop} onChange={(dailyStop) => set({ dailyStop })} />
                  </div>
                </Field>
              </div>
            </Section>

            {/* 4 · Start */}
            <Section n={4} title="Start">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-zinc-200">
                    {days ? (
                      <>
                        Replay <b className="text-zinc-50">{days} sessions</b> from {shortDate(startDate)}, then trade live
                      </>
                    ) : (
                      <>Start fresh and trade live from the next session</>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">{maxReplay} available on {cfg.timeframe}</span>
                </div>
                <input type="range" min={0} max={maxReplay} value={days} onChange={(e) => setReplayDays(Number(e.target.value))} className="mt-3 w-full accent-[#00D68F]" />
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={autoName}
                className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-tp-green/40 focus:outline-none"
              />
            </Section>
          </div>

          {/* Ticket */}
          <aside className="flex min-h-0 flex-col border-t border-white/[0.06] bg-tp-panel/60 lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Test ticket</p>
              <div className="rounded-xl border border-white/[0.06] bg-tp-card p-4">
                <p className="text-sm font-semibold text-zinc-50">{name || autoName}</p>
                <dl className="mt-3 space-y-1.5 text-[12.5px]">
                  <Row k="Strategy" v={STRATEGIES[cfg.strategy].label} />
                  <Row k="Account" v={`${program.firm} ${program.program} ${program.sizeLabel}`} />
                  <Row k="Size" v={`${cfg.contracts} ${cfg.instrument} · ${cfg.timeframe}`} />
                  <Row k="Risk" v={`${cfg.stopMode === "fixed" ? `${cfg.stopPoints} pts` : `${cfg.minStop}–${cfg.maxStop} pts`} · ${cfg.targetR}R`} />
                  <Row k="Window" v={`9:${String(30 + cfg.waitMinutes).padStart(2, "0")} → ${cfg.lastEntry}`} />
                </dl>
              </div>

              <div className={clsx("rounded-xl border p-4", !preview ? "border-white/[0.06] bg-white/[0.02]" : preview.e.verdict === "passed" ? "border-tp-green/30 bg-tp-green/[0.06]" : preview.e.verdict === "failed" ? "border-tp-red/30 bg-tp-red/[0.06]" : "border-tp-yellow/25 bg-tp-yellow/[0.05]")}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Preview on real bars</p>
                {feedErr ? (
                  <p className="mt-2 text-[12.5px] text-tp-red">{feedErr}</p>
                ) : cfg.strategy === "tv-signals" ? (
                  <p className="mt-2 text-[12.5px] text-zinc-400">Signal tests start empty: they trade the TradingView signals that arrive from now on.</p>
                ) : !preview ? (
                  <p className="tp-flow-shimmer mt-2 rounded px-1 text-[12.5px] text-zinc-400">Loading {cfg.instrument} {cfg.timeframe} bars…</p>
                ) : (
                  <>
                    <p className={clsx("mt-1.5 text-lg font-semibold", preview.e.verdict === "passed" ? "text-tp-green" : preview.e.verdict === "failed" ? "text-tp-red" : "text-tp-yellow")}>
                      {preview.e.verdict === "passed" ? "Would have passed" : preview.e.verdict === "failed" ? "Would have failed" : "Not decided"}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-zinc-400">{preview.e.headline}. {preview.e.detail}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <Mini k="Trades" v={String(preview.st.trades)} />
                      <Mini k="Win" v={`${Math.round(preview.st.winRate)}%`} />
                      <Mini k="PF" v={Number.isFinite(preview.st.profitFactor) ? preview.st.profitFactor.toFixed(2) : "∞"} />
                    </div>
                    <p className="mt-2 text-[10.5px] text-zinc-600">Over the last {preview.n} sessions. Past bars, not a promise.</p>
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-white/[0.06] p-5">
              <button
                onClick={() => onCreate({ name: name.trim() || autoName, cfg, programKey, startDate })}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-tp-green to-emerald-400 px-4 py-3 text-sm font-semibold text-[#0D1628] shadow-[0_10px_30px_-12px_rgba(0,214,143,0.8)] hover:brightness-110"
              >
                <Rocket className="h-4 w-4" /> {cta} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2.5 text-sm font-semibold text-zinc-100">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] font-mono text-[10px] text-zinc-300">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      {children}
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={clsx("flex-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition", value === o.value ? "bg-white/[0.09] text-zinc-50" : "text-zinc-500 hover:text-zinc-200")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button aria-label="Fewer" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:text-zinc-50">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-12 text-center font-mono text-lg font-semibold tabular-nums text-zinc-50">{value}</span>
      <button aria-label="More" onClick={() => onChange(Math.min(max, value + 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:text-zinc-50">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <span className="text-[11px] text-zinc-500">firm cap {max}</span>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 font-mono text-[12.5px] text-zinc-100 focus:border-tp-green/40 focus:outline-none";
function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10.5px] text-zinc-500">{label}</span>
      <input type="number" min={0} step="any" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} className={inputCls} />
    </label>
  );
}
function Time({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10.5px] text-zinc-500">{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}
function Rule({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-2 ring-1 ring-inset ring-white/[0.05]">
      <p className="text-[10.5px] text-zinc-500">{k}</p>
      <p className="font-mono text-[12.5px] text-zinc-100">{v}</p>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-right text-zinc-200">{v}</dd>
    </div>
  );
}
function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-black/15 py-1.5">
      <p className="font-mono text-[13px] font-semibold text-zinc-100">{v}</p>
      <p className="text-[10px] text-zinc-500">{k}</p>
    </div>
  );
}
