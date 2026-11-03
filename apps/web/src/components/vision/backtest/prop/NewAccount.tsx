"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import { firmBrand } from "@/components/proving/firmBrand";
import { ArrowLeft, ArrowRight, Bot, Building2, Check, Dices, Hand, Landmark, Layers, X } from "lucide-react";
import { DD_LABEL, FIRM_PROGRAMS, isLive, liveProgram, type FirmProgram } from "@/lib/proving/firms";
import { ACCOUNT_COLORS, newAccount, type PropAccount } from "@/lib/vision/account";
import { SYMBOLS, type Timeframe } from "@/lib/vision/markets";
import { Num, Seg } from "../ui";
import type { Library } from "../data";

const STEPS = ["Firm", "Account", "Market & start", "Name it"];
const LIVE_STEPS = ["Amount", "Market & start", "Name it"];
const AMOUNTS = [1000, 5000, 10_000, 25_000, 50_000];
const FUTURES = ["NQ", "ES", "GC", "CL"] as const;
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** A guided setup for a new prop backtest account. */
export function NewAccount({ lib, existing, onCancel, onCreate, start }: { lib: Library | null; existing: PropAccount[]; onCancel: () => void; onCreate: (a: PropAccount) => void; start?: Partial<PropAccount> }) {
  const [kind, setKind] = useState<"prop" | "live" | null>(start?.program ? (isLive(start.program) ? "live" : "prop") : null);
  const [amount, setAmount] = useState(start?.program && isLive(start.program) ? Number(start.program.split(":")[1]) : 5000);
  const [stopPct, setStopPct] = useState(start?.program && isLive(start.program) ? Number(start.program.split(":")[2]) : 50);
  const live = kind === "live";
  const [screen, setScreen] = useState(0);
  // Live skips the firm's two steps: its screens are amount, market, name.
  const step = live ? (screen === 0 ? -1 : screen + 1) : screen;
  const firms = useMemo(() => {
    const m = new Map<string, FirmProgram[]>();
    for (const p of FIRM_PROGRAMS) m.set(p.firmId, [...(m.get(p.firmId) ?? []), p]);
    return [...m.values()];
  }, []);
  const initial = start?.program ? FIRM_PROGRAMS.find((p) => p.key === start.program) : undefined;
  const [firmId, setFirmId] = useState(initial?.firmId ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const program = live ? liveProgram(Math.max(100, amount), stopPct) : (FIRM_PROGRAMS.find((p) => p.key === key) ?? null);
  const [symbol, setSymbol] = useState<string>(start?.symbol ?? (lib?.series.NQ ? "NQ" : "NQ"));
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
  // A sensible default name once the firm and market are known.
  useEffect(() => {
    if (!program) return;
    const n = existing.filter((a) => a.program === program.key).length + 1;
    setName(live ? `Live ${program.sizeLabel}, ${symbol}${n > 1 ? ` #${n}` : ""}` : `${program.firm.replace(/ (Trading|Futures|Funding|Trader)$/, "")} ${program.sizeLabel} · ${symbol}${n > 1 ? ` #${n}` : ""}`);
  }, [program?.key, symbol, existing, live]); // eslint-disable-line react-hooks/exhaustive-deps

  const quick = [
    { l: "3 months ago", d: new Date(hi.getTime() - 90 * 86_400_000) },
    { l: "Start of this year", d: new Date(Date.UTC(hi.getUTCFullYear(), 0, 2)) },
    { l: "Covid crash · Mar 2020", d: new Date(Date.UTC(2020, 1, 24)) },
    { l: "2022 bear market", d: new Date(Date.UTC(2022, 0, 3)) },
    { l: "Aug 2024 vol spike", d: new Date(Date.UTC(2024, 6, 15)) },
  ].filter((q) => q.d >= lo && q.d <= hi);
  const ok = step === -1 ? amount >= 100 : [!!firmId, !!program, !!date, name.trim().length > 0][step];

  const create = () => {
    if (!program) return;
    const a = newAccount({ name: name.trim(), color, program: program.key, symbol, tf, micro: start?.micro ?? true, sizing: start?.sizing ?? "fixed", contracts: Math.min(start?.contracts ?? 2, program.maxMicros), riskPct: start?.riskPct ?? 1, mode, startDate: date });
    if (live) a.phase = "live";
    onCreate(blind ? { ...a, events: [...a.events, { at: Date.now(), kind: "note", text: "Blind start: a random date" }] } : a);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-[8px] sm:items-center sm:p-6" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="New prop account" onClick={(e) => e.stopPropagation()} className="tp-sheet flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[30px] border border-white/[0.08] bg-[#161618]/95 backdrop-blur-2xl sm:rounded-[30px]">
        <header className="flex items-center gap-4 px-6 pb-4 pt-5">
          <div className="flex-1">
            <h2 className="text-[24px] font-bold tracking-tight text-white">{!kind ? "What kind of account?" : step === -1 ? "How much of your own money?" : ["Which firm are you taking on?", "Pick the account", "Where does it start?", "Name it and choose how you'll test"][step]}</h2>
          </div>
          <button aria-label="Close" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08] text-white/70 hover:bg-white/[0.14]">
            <X className="h-4 w-4" />
          </button>
        </header>
        {kind && <ol className="flex gap-2 px-6 pb-4">
          {(live ? LIVE_STEPS : STEPS).map((s, i) => (
            <li key={s} className="flex flex-1 flex-col gap-1.5">
              <span className={clsx("h-1 rounded-full transition-colors duration-500", i <= screen ? "bg-gradient-to-r from-[#BF5AF2] to-[#5AC8FA]" : "bg-white/[0.08]")} />
              <span className={clsx("text-[11.5px] font-semibold", i === screen ? "text-white" : "text-white/40")}>
                {i + 1}. {s}
              </span>
            </li>
          ))}
        </ol>}

        <div className="min-h-[380px] flex-1 overflow-y-auto px-6 pb-4">
          {!kind && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { v: "prop" as const, icon: <Building2 className="h-6 w-6" />, t: "Prop firm", d: "Practice an evaluation or funded account under a firm's exact rules." },
                { v: "live" as const, icon: <Landmark className="h-6 w-6" />, t: "Live money", d: "Your own $1,000, $5,000 or $50,000 at a broker. No firm rules, only margin and the loss you set." },
              ].map((m) => (
                <button key={m.v} onClick={() => setKind(m.v)} className="min-h-[190px] rounded-[24px] bg-white/[0.04] p-6 text-left ring-1 ring-white/[0.08] transition hover:bg-white/[0.08]">
                  <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-white/[0.1] text-white">{m.icon}</span>
                  <span className="mt-4 block text-[22px] font-semibold tracking-[-0.02em] text-white">{m.t}</span>
                  <span className="mt-1 block text-[13.5px] leading-snug text-white/55">{m.d}</span>
                </button>
              ))}
            </div>
          )}

          {kind && step === -1 && (
            <div className="max-w-xl space-y-5">
              <Label t="Starting balance">
                <div className="flex flex-wrap gap-1.5">
                  {AMOUNTS.map((x) => (
                    <button key={x} aria-pressed={amount === x} onClick={() => setAmount(x)} className={clsx("rounded-full px-4 py-2.5 text-[15px] font-semibold tabular-nums", amount === x ? "bg-white text-black" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.1]")}>{usd(x)}</button>
                  ))}
                  <Num value={amount} onChange={(v) => setAmount(Math.round(v))} min={100} max={10_000_000} step={500} width="w-32" />
                </div>
              </Label>
              <Label t="The most you'd lose before you stop" hint={`At ${stopPct}% it stops at ${usd(amount * (1 - stopPct / 100))}, the same way a firm's floor would. Nothing here risks real money: this is a backtest.`}>
                <div className="flex flex-wrap gap-1.5">
                  {[10, 25, 50, 75].map((x) => (
                    <button key={x} aria-pressed={stopPct === x} onClick={() => setStopPct(x)} className={clsx("rounded-full px-3.5 py-2 text-[14px] font-medium tabular-nums", stopPct === x ? "bg-white text-black" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]")}>{x}%</button>
                  ))}
                </div>
              </Label>
              <p className="rounded-[16px] bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-white/55">Only your broker&apos;s margin limits your size, so small balances may not be able to trade some stops at all, even in micros. The lab shows you where that line is.</p>
            </div>
          )}

          {step === 0 && kind && (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {firms.map((ps) => {
                const f = ps[0];
                const on = firmId === f.firmId;
                return (
                  <button
                    key={f.firmId}
                    onClick={() => {
                      setFirmId(f.firmId);
                      setKey(ps.find((p) => p.size === 50_000)?.key ?? ps[0].key);
                    }}
                    className={clsx("rounded-[20px] p-4 text-left ring-1 transition", on ? "bg-[#BF5AF2]/12 ring-[#BF5AF2]/60" : "bg-white/[0.04] ring-white/[0.07] hover:bg-white/[0.07]")}
                  >
                    <div className="flex items-start gap-3">
                      <FirmMark firmId={f.firmId} firm={f.firm} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-bold text-white">{f.firm}</p>
                        <p className="truncate text-[12px] text-white/50">{f.program}</p>
                      </div>
                      {on && <Check className="h-4 w-4 text-[#E3B5FF]" />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <Tag>{f.model === "instant" ? "Instant funding" : "Evaluation"}</Tag>
                      <Tag>{DD_LABEL[f.ddType]}</Tag>
                      <Tag>from {usd(Math.min(...ps.map((p) => p.cost)))}</Tag>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && !live && program && (
            <div className="space-y-4">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {FIRM_PROGRAMS.filter((p) => p.firmId === firmId).map((p) => (
                  <button key={p.key} onClick={() => setKey(p.key)} className={clsx("rounded-[20px] p-4 text-left ring-1 transition", key === p.key ? "bg-[#BF5AF2]/12 ring-[#BF5AF2]/60" : "bg-white/[0.04] ring-white/[0.07] hover:bg-white/[0.07]")}>
                    <p className="flex items-center justify-between text-[22px] font-bold tracking-tight text-white">
                      {p.sizeLabel} {key === p.key && <Check className="h-4 w-4 text-[#E3B5FF]" />}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px]">
                      <Kv k="Target" v={p.model === "instant" ? "—" : usd(p.target)} />
                      <Kv k="Drawdown" v={usd(p.drawdown)} />
                      <Kv k="Daily limit" v={p.dll ? usd(p.dll) : "None"} />
                      <Kv k="Max size" v={`${p.maxMinis} / ${p.maxMicros}μ`} />
                    </div>
                    <p className="mt-2 text-[12px] font-semibold text-white/60">
                      {usd(p.cost)} {p.costCadence === "monthly" ? "a month" : "one time"}
                    </p>
                  </button>
                ))}
              </div>
              <div className="rounded-[18px] bg-white/[0.04] p-4 ring-1 ring-white/[0.06]">
                <p className="text-[13px] font-semibold text-white">
                  {program.firm} · {program.program} rules
                </p>
                <div className="mt-2 grid gap-1.5 text-[12.5px] text-white/65 sm:grid-cols-2">
                  <p>• {DD_LABEL[program.ddType]} drawdown of {usd(program.drawdown)}{program.lock != null ? `, locking ${program.lock ? `at +${usd(program.lock)}` : "at the start balance"}` : ", trailing for good"}</p>
                  <p>• {program.dll ? `Daily loss limit ${usd(program.dll)}; the day ends there` : "No daily loss limit"}</p>
                  <p>• {program.consistencyPct >= 100 ? "No consistency rule" : `Best day at most ${program.consistencyPct}% of ${program.consistencyBasis === "profitTarget" ? "the target" : "total profit"}`}</p>
                  <p>• At least {program.minDays} trading day{program.minDays === 1 ? "" : "s"} · {program.split}% split once funded</p>
                </div>
                {program.notes && <p className="mt-2 text-[11.5px] leading-snug text-white/40">{program.notes}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <Label t="Market">
                  <div className="grid grid-cols-4 gap-1.5">
                    {FUTURES.map((id) => (
                      <button key={id} onClick={() => setSymbol(id)} className={clsx("rounded-[13px] px-2 py-2 text-left ring-1", symbol === id ? "bg-[#BF5AF2]/12 ring-[#BF5AF2]/55" : "bg-white/[0.04] ring-white/[0.06] hover:bg-white/[0.07]")}>
                        <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-white">
                          <span className="h-2 w-2 rounded-full" style={{ background: SYMBOLS[id].color }} /> {id}
                        </span>
                        <span className="block truncate text-[11px] text-white/45">{lib?.series[id] ? "Your library" : "Free feed"}</span>
                      </button>
                    ))}
                  </div>
                </Label>
                <Label t="Execution timeframe">
                  <Seg full size="sm" value={tf} onChange={setTf} options={(["1m", "5m", "15m", "1h"] as Timeframe[]).map((t) => ({ v: t, l: t }))} />
                </Label>
              </div>
              <div className="space-y-4">
                <Label t="Start date" hint={series ? `Your ${symbol} history runs ${iso(new Date(series.from * 1000))} to ${iso(new Date(series.to * 1000))}.` : "Without library data, replay reaches back about two months."}>
                  <input
                    type="date"
                    value={date}
                    min={iso(lo)}
                    max={iso(hi)}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setBlind(false);
                    }}
                    className="w-full rounded-xl bg-white/[0.06] px-3 py-2.5 text-[14px] text-white [color-scheme:dark] ring-1 ring-inset ring-white/[0.08]"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quick.map((q) => (
                      <button key={q.l} onClick={() => {
                          setDate(iso(q.d));
                          setBlind(false);
                        }} className={clsx("rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", date === iso(q.d) ? "bg-white text-black ring-white" : "bg-white/[0.04] text-white/65 ring-white/[0.08] hover:text-white")}>
                        {q.l}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setDate(iso(new Date(lo.getTime() + Math.random() * (hi.getTime() - lo.getTime()))));
                        setBlind(true);
                      }}
                      className={clsx("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1", blind ? "bg-[#BF5AF2] text-white ring-[#BF5AF2]" : "bg-white/[0.04] text-white/65 ring-white/[0.08] hover:text-white")}
                    >
                      <Dices className="h-3.5 w-3.5" /> Random date
                    </button>
                  </div>
                </Label>
                <p className="rounded-[16px] bg-white/[0.03] p-3 text-[12.5px] leading-relaxed text-white/55">
                  The account opens at the New York open on this day. Replay picks up where you leave off each time, and automated runs continue from the same point, so both add to one account&apos;s balance and drawdown. You&apos;ll pick contracts and risk on the account, right where you trade it.
                </p>
              </div>
            </div>
          )}

          {step === 3 && program && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="space-y-4">
                <Label t="Account name">
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="w-full rounded-xl bg-white/[0.06] px-3.5 py-3 text-[16px] font-semibold text-white outline-none ring-1 ring-inset ring-white/[0.08] focus:ring-[#BF5AF2]/60" />
                </Label>
                <Label t="Colour">
                  <div className="flex gap-2">
                    {ACCOUNT_COLORS.map((c) => (
                      <button key={c} aria-label={`Colour ${c}`} onClick={() => setColor(c)} className={clsx("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-[#161618] transition", color === c ? "ring-white" : "ring-transparent")} style={{ background: c }} />
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
                      <button key={m.v} onClick={() => setMode(m.v)} className={clsx("rounded-[16px] p-3 text-left ring-1", mode === m.v ? "bg-[#BF5AF2]/12 ring-[#BF5AF2]/60" : "bg-white/[0.04] ring-white/[0.07] hover:bg-white/[0.07]")}>
                        <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-white">
                          {m.icon} {m.t}
                        </span>
                        <span className="mt-1 block text-[11.5px] leading-snug text-white/50">{m.d}</span>
                      </button>
                    ))}
                  </div>
                </Label>
              </div>
              <div className="rounded-[22px] p-5 ring-1 ring-white/[0.08]" style={{ background: `linear-gradient(150deg, ${color}2e, rgba(22,22,24,0.9) 60%)` }}>
                <p className="flex items-center gap-2 text-[12px] font-semibold text-white/60">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> Preview
                </p>
                <p className="mt-2 text-[22px] font-bold tracking-tight text-white">{name || "Untitled account"}</p>
                <p className="text-[13px] text-white/55">
                  {live ? "Live money, your broker" : `${program.firm} ${program.sizeLabel} · ${program.program}`}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[12.5px]">
                  <Kv k="Balance" v={usd(program.size)} />
                  <Kv k="Target" v={program.model === "instant" ? "—" : usd(program.target)} />
                  <Kv k={live ? "Stops at" : "Floor"} v={usd(program.size - program.drawdown)} />
                  <Kv k="Daily limit" v={program.dll ? usd(program.dll) : "None"} />
                  <Kv k="Market" v={`${symbol} · ${tf}`} />
                  <Kv k="Starts" v={blind ? "A random day" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} />
                  <Kv k="Cost" v={`${usd(program.cost)}${program.costCadence === "monthly" ? "/mo" : ""}`} />
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-white/[0.06] px-6 py-4">
          {kind && (screen > 0 || !start?.program) && (
            <button onClick={() => (screen > 0 ? setScreen(screen - 1) : setKind(null))} className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-white/[0.12]">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}
          <span className="flex-1" />
          {!kind ? null : step < 3 ? (
            <button disabled={!ok} onClick={() => setScreen(screen + 1)} className="flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[14px] font-bold text-black disabled:opacity-40">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button disabled={!ok} onClick={create} className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#BF5AF2] to-[#5AC8FA] px-5 py-2.5 text-[14px] font-bold text-white shadow-[0_12px_30px_-12px_rgba(191,90,242,0.9)] disabled:opacity-40">
              <Check className="h-4 w-4" /> Create account
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

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

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-white/60">{children}</span>;
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-2.5 py-1.5">
      <p className="text-[10.5px] text-white/40">{k}</p>
      <p className="truncate font-semibold text-white/90">{v}</p>
    </div>
  );
}

function Label({ t, hint, children }: { t: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-white/55">{t}</p>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-white/40">{hint}</p>}
    </div>
  );
}
