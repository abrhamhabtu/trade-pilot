"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, ArrowRight, Bot, Check, Dices, Hand, Layers, Shield, X } from "lucide-react";
import { DD_LABEL, FIRM_PROGRAMS, type FirmProgram } from "@/lib/proving/firms";
import { FIRM_ORDER, firmBrand } from "@/components/proving/firmBrand";
import { ACCOUNT_COLORS, newAccount, type PropAccount } from "@/lib/vision/account";
import { coinFlipOdds, firmTraps } from "@/lib/vision/lab";
import { SYMBOLS, type Timeframe } from "@/lib/vision/markets";
import { Seg } from "../ui";
import type { Library } from "../data";
import { Corridor } from "./Corridor";

const STEPS = ["Firm", "Account", "Market and start", "Name"];
const FUTURES = ["NQ", "ES", "GC", "CL"] as const;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const pct = (n: number) => `${Math.round(n * 100)}%`;

type Sort = "yours" | "odds" | "cost";

// Thousands of simulated days per firm: worked out once per visit, not on every open.
const flips = new Map<string, ReturnType<typeof coinFlipOdds>>();
const flipOf = (p: FirmProgram) => {
  const hit = flips.get(p.key);
  if (hit) return hit;
  const out = coinFlipOdds(p, { runs: 120, horizon: 80 });
  flips.set(p.key, out);
  return out;
};

function FirmMark({ firmId, firm }: { firmId: string; firm: string }) {
  const b = firmBrand(firmId);
  return b.logo ? (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-white/[0.92] p-1.5">
      <Image src={b.logo} alt="" width={28} height={28} className="h-full w-full object-contain" />
    </span>
  ) : (
    <span aria-label={firm} className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[13px] font-black text-black" style={{ background: b.color }}>
      {b.mono}
    </span>
  );
}

/** A guided setup for a new prop backtest account. Size is chosen later, when trading starts. */
export function NewAccount({ lib, existing, onCancel, onCreate, start }: { lib: Library | null; existing: PropAccount[]; onCancel: () => void; onCreate: (a: PropAccount) => void; start?: Partial<PropAccount> }) {
  const [step, setStep] = useState(0);
  const [sort, setSort] = useState<Sort>("yours");
  const [model, setModel] = useState<"all" | "eval" | "instant">("all");
  // Every firm at one size, so the bars and odds compare like with like.
  const rows = useMemo(() => {
    const m = new Map<string, FirmProgram[]>();
    for (const p of FIRM_PROGRAMS) m.set(p.firmId, [...(m.get(p.firmId) ?? []), p]);
    return [...m.values()].map((ps) => {
      const ref = ps.find((p) => p.size === 50_000) ?? ps[0];
      return { ps, ref, flip: flipOf(ref) };
    });
  }, []);
  const initial = start?.program ? FIRM_PROGRAMS.find((p) => p.key === start.program) : undefined;
  const [firmId, setFirmId] = useState(initial?.firmId ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const program = FIRM_PROGRAMS.find((p) => p.key === key) ?? null;
  const [symbol, setSymbol] = useState<string>(start?.symbol ?? "NQ");
  const [tf, setTf] = useState<Timeframe>(start?.tf ?? "5m");
  const series = lib?.series[symbol];
  const lo = series ? new Date(series.from * 1000 + 30 * 86_400_000) : new Date(Date.now() - 50 * 86_400_000);
  const hi = series ? new Date(series.to * 1000 - 20 * 86_400_000) : new Date(Date.now() - 7 * 86_400_000);
  const [date, setDate] = useState(start?.startDate ?? iso(new Date(hi.getTime() - 120 * 86_400_000)));
  const [name, setName] = useState("");
  const [color, setColor] = useState(ACCOUNT_COLORS[existing.length % ACCOUNT_COLORS.length]);
  const [mode, setMode] = useState<PropAccount["mode"]>(start?.mode ?? "both");
  const [blind, setBlind] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  useEffect(() => {
    if (!program) return;
    const n = existing.filter((a) => a.program === program.key).length + 1;
    setName(`${program.firm.replace(/ (Trading|Futures|Funding|Trader)$/, "")} ${program.sizeLabel}, ${symbol}${n > 1 ? ` #${n}` : ""}`);
  }, [program, symbol, existing]);

  const shown = useMemo(() => {
    const list = rows.filter((r) => model === "all" || r.ref.model === model);
    if (sort === "odds") return [...list].sort((a, b) => b.flip.rate - a.flip.rate);
    if (sort === "cost") return [...list].sort((a, b) => (a.flip.costPerPass ?? 1e9) - (b.flip.costPerPass ?? 1e9));
    const rank = (f: string) => {
      const i = FIRM_ORDER.indexOf(f);
      return i < 0 ? 99 : i;
    };
    return [...list].sort((a, b) => rank(a.ref.firm) - rank(b.ref.firm));
  }, [rows, sort, model]);

  const flip = useMemo(() => (program ? flipOf(program) : null), [program]);
  const traps = useMemo(() => (program ? firmTraps(program) : []), [program]);

  const quick = [
    { l: "3 months ago", d: new Date(hi.getTime() - 90 * 86_400_000) },
    { l: "Start of this year", d: new Date(Date.UTC(hi.getUTCFullYear(), 0, 2)) },
    { l: "Covid crash, Mar 2020", d: new Date(Date.UTC(2020, 1, 24)) },
    { l: "2022 bear market", d: new Date(Date.UTC(2022, 0, 3)) },
    { l: "Aug 2024 vol spike", d: new Date(Date.UTC(2024, 6, 15)) },
  ].filter((q) => q.d >= lo && q.d <= hi);
  const ok = [!!firmId, !!program, !!date, name.trim().length > 0][step];

  const create = () => {
    if (!program) return;
    const a = newAccount({ name: name.trim(), color, program: program.key, symbol, tf, micro: start?.micro ?? true, sizing: start?.sizing ?? "fixed", contracts: Math.min(start?.contracts ?? 2, program.maxMicros), riskPct: start?.riskPct ?? 1, mode, startDate: date });
    onCreate(blind ? { ...a, events: [...a.events, { at: Date.now(), kind: "note", text: "Blind start: a random date" }] } : a);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 backdrop-blur-[10px] sm:items-center sm:p-6" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="New prop account" onClick={(e) => e.stopPropagation()} className="tp-sheet flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[28px] border border-white/[0.09] bg-[#111114] sm:rounded-[28px]">
        <header className="flex items-center gap-5 border-b border-white/[0.06] px-6 py-4">
          <h2 className="min-w-0 flex-1 text-[22px] font-semibold tracking-[-0.02em] text-white">{["Which firm are you taking on?", "Pick the account", "Where does it start?", "Name it and choose how you'll test"][step]}</h2>
          <ol className="hidden items-center gap-1 md:flex" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-1">
                <button disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined} className={clsx("rounded-full px-3 py-1 text-[12.5px] font-medium transition", i === step ? "bg-white text-black" : i < step ? "text-white/75 hover:bg-white/[0.08]" : "text-white/30")}>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <button aria-label="Close" onClick={onCancel} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white/70 hover:bg-white/[0.14]">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
          <div className="min-h-[420px] min-w-0 px-6 py-5 lg:overflow-y-auto">
            {step === 0 && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Seg size="sm" value={model} onChange={setModel} label="Type of account" options={[{ v: "all" as const, l: "All" }, { v: "eval" as const, l: "Evaluation" }, { v: "instant" as const, l: "Instant" }]} />
                  <span className="flex-1" />
                  <Seg size="sm" value={sort} onChange={setSort} label="Sort firms" options={[{ v: "yours" as const, l: "Your firms" }, { v: "odds" as const, l: "Best odds" }, { v: "cost" as const, l: "Cheapest pass" }]} />
                </div>
                <div className="space-y-1.5">
                  {shown.map(({ ps, ref, flip: f }) => {
                    const on = firmId === ref.firmId;
                    return (
                      <button
                        key={ref.firmId}
                        onClick={() => {
                          setFirmId(ref.firmId);
                          setKey(ref.key);
                        }}
                        aria-pressed={on}
                        className={clsx("grid w-full grid-cols-[auto_minmax(0,1fr)_72px] items-center gap-x-3.5 rounded-[18px] px-3.5 py-3 text-left transition sm:grid-cols-[auto_minmax(0,0.9fr)_minmax(0,1fr)_72px]", on ? "bg-white/[0.1] ring-1 ring-white/40" : "bg-white/[0.03] hover:bg-white/[0.06]")}
                      >
                        <FirmMark firmId={ref.firmId} firm={ref.firm} />
                        <span className="min-w-0">
                          <span className="block truncate text-[14.5px] font-semibold text-white">{ref.firm}</span>
                          <span className="block truncate text-[12px] text-white/50">
                            {ref.program}, from {usd(Math.min(...ps.map((p) => p.cost)))}
                          </span>
                        </span>
                        <span className="col-span-3 row-start-2 mt-2 sm:col-span-1 sm:row-start-auto sm:mt-0">
                          <Corridor p={ref} size="sm" />
                        </span>
                        <span className="col-start-3 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
                          <span className="block text-[17px] font-semibold tabular-nums tracking-tight text-white">{pct(f.rate)}</span>
                          <span className="block text-[10.5px] text-white/40">no-edge odds</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11.5px] leading-snug text-white/40">Bars compare each firm&apos;s 50K-size account, or its nearest. Red is the room you may lose, green is what you must make. No-edge odds: how often a coin-flip trader passes under these rules alone.</p>
              </>
            )}

            {step === 1 && program && (
              <div className="grid gap-2 sm:grid-cols-2">
                {FIRM_PROGRAMS.filter((p) => p.firmId === firmId).map((p) => (
                  <button key={p.key} onClick={() => setKey(p.key)} aria-pressed={key === p.key} className={clsx("rounded-[18px] p-4 text-left transition", key === p.key ? "bg-white/[0.1] ring-1 ring-white/40" : "bg-white/[0.03] hover:bg-white/[0.06]")}>
                    <span className="flex items-baseline justify-between">
                      <span className="text-[24px] font-semibold tracking-[-0.02em] text-white">{p.sizeLabel}</span>
                      <span className="text-[13px] tabular-nums text-white/60">
                        {usd(p.cost)}
                        {p.costCadence === "monthly" ? " a month" : ""}
                      </span>
                    </span>
                    <span className="mt-3 block">
                      <Corridor p={p} />
                    </span>
                    <span className="mt-2.5 block text-[12px] text-white/50">
                      {p.dll ? `${usd(p.dll)} daily limit` : "No daily limit"}, up to {p.maxMinis} minis or {p.maxMicros} micros
                    </span>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="max-w-xl space-y-5">
                <Label t="Market">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {FUTURES.map((id) => {
                      const s = lib?.series[id];
                      return (
                        <button key={id} onClick={() => setSymbol(id)} aria-pressed={symbol === id} className={clsx("rounded-[14px] px-3 py-2.5 text-left", symbol === id ? "bg-white/[0.1] ring-1 ring-white/40" : "bg-white/[0.03] hover:bg-white/[0.06]")}>
                          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-white">
                            <span className="h-2 w-2 rounded-full" style={{ background: SYMBOLS[id].color }} /> {SYMBOLS[id].name}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] tabular-nums text-white/45">{s ? `${new Date(s.from * 1000).getUTCFullYear()} to ${new Date(s.to * 1000).getUTCFullYear()}` : "2 months, free feed"}</span>
                        </button>
                      );
                    })}
                  </div>
                </Label>
                <Label t="Chart timeframe">
                  <Seg full size="sm" value={tf} onChange={setTf} options={(["1m", "5m", "15m", "1h"] as Timeframe[]).map((t) => ({ v: t, l: t }))} />
                </Label>
                <Label t="Start date" hint={series ? `${symbol} history runs ${iso(new Date(series.from * 1000))} to ${iso(new Date(series.to * 1000))}.` : "Add your data in the Library to reach further back than about two months."}>
                  <input
                    type="date"
                    value={date}
                    min={iso(lo)}
                    max={iso(hi)}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setBlind(false);
                    }}
                    className="w-full rounded-[13px] bg-white/[0.06] px-3 py-2.5 text-[14px] text-white [color-scheme:dark] ring-1 ring-inset ring-white/[0.08]"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quick.map((q) => (
                      <button
                        key={q.l}
                        onClick={() => {
                          setDate(iso(q.d));
                          setBlind(false);
                        }}
                        className={clsx("rounded-full px-2.5 py-1 text-[12px] font-medium", date === iso(q.d) ? "bg-white text-black" : "bg-white/[0.05] text-white/65 hover:text-white")}
                      >
                        {q.l}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setDate(iso(new Date(lo.getTime() + Math.random() * (hi.getTime() - lo.getTime()))));
                        setBlind(true);
                      }}
                      className={clsx("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium", blind ? "bg-white text-black" : "bg-white/[0.05] text-white/65 hover:text-white")}
                    >
                      <Dices className="h-3.5 w-3.5" /> Random date
                    </button>
                  </div>
                </Label>
              </div>
            )}

            {step === 3 && program && (
              <div className="max-w-xl space-y-5">
                <Label t="Account name">
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="w-full rounded-[13px] bg-white/[0.06] px-3.5 py-3 text-[16px] font-medium text-white outline-none ring-1 ring-inset ring-white/[0.08] focus:ring-white/40" />
                </Label>
                <Label t="Colour">
                  <div className="flex gap-2">
                    {ACCOUNT_COLORS.map((c) => (
                      <button key={c} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={clsx("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-[#111114] transition", color === c ? "ring-white" : "ring-transparent")} style={{ background: c }} />
                    ))}
                  </div>
                </Label>
                <Label t="How will you test it?">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { v: "manual" as const, icon: <Hand className="h-4 w-4" />, t: "By hand", d: "Replay bar by bar and place the trades yourself" },
                      { v: "auto" as const, icon: <Bot className="h-4 w-4" />, t: "Automated", d: "Run a strategy forward until it passes or fails" },
                      { v: "both" as const, icon: <Layers className="h-4 w-4" />, t: "Both", d: "Mix sessions by hand with strategy runs" },
                    ].map((m) => (
                      <button key={m.v} onClick={() => setMode(m.v)} aria-pressed={mode === m.v} className={clsx("rounded-[16px] p-3 text-left", mode === m.v ? "bg-white/[0.1] ring-1 ring-white/40" : "bg-white/[0.03] hover:bg-white/[0.06]")}>
                        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-white">
                          {m.icon} {m.t}
                        </span>
                        <span className="mt-1 block text-[11.5px] leading-snug text-white/50">{m.d}</span>
                      </button>
                    ))}
                  </div>
                </Label>
                <p className="text-[12.5px] leading-relaxed text-white/50">You&apos;ll pick contracts and risk once the account is open, right where you trade it. The lab there can work out the size that gives you the best odds at this firm.</p>
              </div>
            )}
          </div>

          {/* The deal stays in view while you choose. */}
          <aside className={clsx("border-t border-white/[0.06] bg-white/[0.02] px-6 py-5 lg:block lg:overflow-y-auto lg:border-l lg:border-t-0", !program && "hidden")}>
            {!program ? (
              <div className="flex h-full min-h-[200px] flex-col justify-center text-center">
                <p className="text-[15px] font-medium text-white/70">Pick a firm to see how its rules tilt the game</p>
                <p className="mx-auto mt-1 max-w-[260px] text-[12.5px] leading-snug text-white/40">Every firm wins when you buy another evaluation. Here is where each one makes that likely.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <FirmMark firmId={program.firmId} firm={program.firm} />
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-white">
                      {program.firm} {program.sizeLabel}
                    </p>
                    <p className="truncate text-[12px] text-white/50">{program.program}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Corridor p={program} size="lg" />
                </div>
                {flip && (
                  <div className="mt-4 rounded-[16px] bg-white/[0.04] p-3.5">
                    <p className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-white">{pct(flip.rate)}</p>
                    <p className="mt-1.5 text-[12.5px] leading-snug text-white/55">
                      of coin-flip traders pass, about {flip.costPerPass ? usd(flip.costPerPass) : "more than it's worth"} in fees per pass. Your strategy has to beat this number, or the firm is the one with the edge.
                    </p>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  {traps.slice(0, 4).map((t) => (
                    <div key={t.id}>
                      <p className="flex items-start gap-1.5 text-[13px] font-semibold text-white">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFB98A]" /> {t.title}
                      </p>
                      <p className="mt-0.5 pl-5 text-[12px] leading-snug text-white/50">{t.how}</p>
                      <p className="mt-1 flex items-start gap-1.5 pl-5 text-[12px] leading-snug text-[#9BE1FF]">
                        <Shield className="mt-0.5 h-3 w-3 shrink-0" /> {t.answer}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11.5px] leading-snug text-white/40">
                  {DD_LABEL[program.ddType]} drawdown, at least {program.minDays} trading day{program.minDays === 1 ? "" : "s"}, {program.split}% split once funded. {program.notes} Check the firm&apos;s current terms before you pay.
                </p>
              </div>
            )}
          </aside>
        </div>

        <footer className="flex items-center gap-2 border-t border-white/[0.06] px-6 py-3.5">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2.5 text-[14px] font-medium text-white hover:bg-white/[0.12]">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
          <span className="flex-1" />
          {step < 3 ? (
            <button disabled={!ok} onClick={() => setStep(step + 1)} className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black disabled:opacity-40">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button disabled={!ok} onClick={create} className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black disabled:opacity-40">
              <Check className="h-4 w-4" /> Create account
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Label({ t, hint, children }: { t: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-white/60">{t}</p>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-white/40">{hint}</p>}
    </div>
  );
}
