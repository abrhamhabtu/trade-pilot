"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import { STRATEGIES, defaultConfig, type Instrument, type StrategyConfig, type StrategyId } from "@/lib/proving/engine";
import { DD_LABEL, FIRM_PROGRAMS, type FirmProgram } from "@/lib/proving/firms";
import { StrategyGlyph } from "./glyphs";
import { FIRM_ORDER, firmBrand } from "./firmBrand";

export interface QuickStartInput {
  name: string;
  cfg: StrategyConfig;
  programKey: string;
  startDate: string;
}

const STRATEGY_ORDER: StrategyId[] = ["double-break-vwap", "sr-retest", "vwap-pullback", "orb", "failed-breakout", "tv-signals"];
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

/**
 * Three taps to a running test: what you trade, where you trade it, go. Every
 * other rule starts from the strategy's defaults; the full editor is one tap
 * away for anyone who wants it.
 */
export function QuickStart({ onCreate, onClose, onAdvanced, preset }: { onCreate: (t: QuickStartInput) => void; onClose: () => void; onAdvanced: () => void; preset?: { strategy?: StrategyId; programKey?: string } }) {
  const [step, setStep] = useState(preset?.programKey ? 2 : preset?.strategy ? 1 : 0);
  const [strategy, setStrategy] = useState<StrategyId>(preset?.strategy ?? "double-break-vwap");
  const firms = useMemo(() => {
    const names = [...new Set(FIRM_PROGRAMS.map((p) => p.firm))];
    return names.sort((a, b) => (FIRM_ORDER.indexOf(a) + 1 || 99) - (FIRM_ORDER.indexOf(b) + 1 || 99));
  }, []);
  const presetProgram = FIRM_PROGRAMS.find((p) => p.key === preset?.programKey);
  const [firm, setFirm] = useState(presetProgram?.firm ?? firms[0]);
  const programs = useMemo(() => [...new Map(FIRM_PROGRAMS.filter((p) => p.firm === firm).map((p) => [p.firmId, p])).values()], [firm]);
  const [firmId, setFirmId] = useState(presetProgram?.firmId ?? programs[0]?.firmId);
  const sizes = FIRM_PROGRAMS.filter((p) => p.firmId === firmId);
  const [size, setSize] = useState(presetProgram?.size ?? 50000);
  const program: FirmProgram | undefined = sizes.find((p) => p.size === size) ?? sizes.find((p) => p.size === 50000) ?? sizes[0];
  const [instrument, setInstrument] = useState<Instrument>("MNQ");
  const [contracts, setContracts] = useState(defaultConfig(strategy, "MNQ").contracts);
  const [replay, setReplay] = useState(true);

  useEffect(() => {
    if (!programs.some((p) => p.firmId === firmId)) setFirmId(programs[0]?.firmId);
  }, [programs, firmId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cap = program ? (instrument.startsWith("M") ? program.maxMicros : program.maxMinis) : 1;
  const start = () => {
    if (!program) return;
    onCreate({
      name: `${STRATEGIES[strategy].short} · ${program.firm.split(" ")[0]} ${program.sizeLabel}`,
      cfg: { ...defaultConfig(strategy, instrument), contracts: Math.min(contracts, cap) },
      programKey: program.key,
      startDate: replay ? daysAgo(44) : daysAgo(0),
    });
  };
  const titles = ["What do you trade?", "Where do you trade it?", "Ready when you are"];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 backdrop-blur-[6px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New test"
        onClick={(e) => e.stopPropagation()}
        className="tp-sheet relative flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[30px] border border-white/[0.08] bg-[#161618]/95 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:rounded-[30px]"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />
        <header className="flex items-center gap-3 px-6 pb-3 pt-4">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="-ml-2 flex items-center rounded-full p-1.5 text-[15px] font-medium text-tp-blue hover:bg-white/[0.06]">
              <ChevronLeft className="h-5 w-5" /> Back
            </button>
          ) : (
            <span className="w-16" />
          )}
          <div className="flex flex-1 justify-center gap-1.5">
            {titles.map((_, i) => (
              <span key={i} className={clsx("h-1.5 rounded-full transition-all duration-500", i === step ? "w-6 bg-white" : i < step ? "w-1.5 bg-white/60" : "w-1.5 bg-white/20")} />
            ))}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] text-zinc-300 hover:bg-white/[0.14]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <h2 className="px-6 text-[28px] font-bold tracking-[-0.03em] text-white">{titles[step]}</h2>

        <div key={step} className="tp-step flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {step === 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {STRATEGY_ORDER.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setStrategy(id);
                    setContracts(defaultConfig(id, instrument).contracts);
                    setStep(1);
                  }}
                  className={clsx(
                    "group relative rounded-[20px] p-4 text-left transition duration-300 active:scale-[0.98]",
                    strategy === id ? "bg-white/[0.1] ring-2 ring-tp-green/70" : "bg-white/[0.045] ring-1 ring-white/[0.06] hover:bg-white/[0.07]",
                  )}
                >
                  <div className="h-9 w-28">
                    <StrategyGlyph id={id} active={strategy === id} />
                  </div>
                  <p className="mt-2 text-[16px] font-semibold text-white">{STRATEGIES[id].label}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-zinc-400">{STRATEGIES[id].blurb}</p>
                  {strategy === id && <Check className="absolute right-4 top-4 h-5 w-5 text-tp-green" />}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[20px] bg-white/[0.045] ring-1 ring-white/[0.06]">
                {firms.map((f, i) => {
                  const p = FIRM_PROGRAMS.find((x) => x.firm === f)!;
                  const brand = firmBrand(p.firmId);
                  const on = f === firm;
                  return (
                    <div key={f} className={clsx(i && "border-t border-white/[0.05]")}>
                      <button onClick={() => setFirm(f)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]">
                        <FirmMark firmId={p.firmId} />
                        <span className="flex-1">
                          <span className="block text-[15.5px] font-semibold text-white">{f}</span>
                          <span className="block text-[12.5px] text-zinc-500">
                            {new Set(FIRM_PROGRAMS.filter((x) => x.firm === f).map((x) => x.firmId)).size} program{new Set(FIRM_PROGRAMS.filter((x) => x.firm === f).map((x) => x.firmId)).size === 1 ? "" : "s"} · {DD_LABEL[p.ddType]}
                          </span>
                        </span>
                        {on ? <Check className="h-5 w-5 text-tp-green" /> : <ChevronRight className="h-4 w-4 text-zinc-600" />}
                      </button>
                      {on && (
                        <div className="flex flex-wrap gap-2 px-4 pb-4 pl-[60px]">
                          {programs.map((pr) => (
                            <button
                              key={pr.firmId}
                              onClick={() => setFirmId(pr.firmId)}
                              className={clsx("rounded-full px-3 py-1.5 text-[13px] font-medium transition", firmId === pr.firmId ? "bg-white text-black" : "bg-white/[0.07] text-zinc-300 hover:bg-white/[0.12]")}
                              style={firmId === pr.firmId ? { boxShadow: `0 6px 20px -8px ${brand.color}` } : undefined}
                            >
                              {pr.program}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Segmented label="Account size" value={program?.size ?? size} options={sizes.map((p) => ({ v: p.size, label: p.sizeLabel }))} onChange={setSize} />
              <button onClick={() => setStep(2)} disabled={!program} className="w-full rounded-2xl bg-white py-3.5 text-[16px] font-semibold text-black transition active:scale-[0.99] disabled:opacity-40">
                Continue
              </button>
            </div>
          )}

          {step === 2 && program && (
            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-[24px] p-5 ring-1 ring-white/[0.08]" style={{ background: `radial-gradient(120% 140% at 0% 0%, ${firmBrand(program.firmId).color}33, transparent 60%), rgba(255,255,255,0.04)` }}>
                <div className="flex items-center gap-3">
                  <FirmMark firmId={program.firmId} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-zinc-400">
                      {program.firm} · {program.program}
                    </p>
                    <p className="text-[22px] font-bold tracking-tight text-white">
                      {STRATEGIES[strategy].label} <span className="text-zinc-500">on</span> {program.sizeLabel}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Fact k="Target" v={program.model === "instant" ? "Payouts" : usd(program.target)} />
                  <Fact k="Drawdown" v={`${usd(program.drawdown)} ${program.ddType === "static" ? "static" : program.ddType === "trailing-eod" ? "EOD" : "intraday"}`} />
                  <Fact k="Consistency" v={program.consistencyPct >= 100 ? "None" : `${program.consistencyPct}%`} />
                  <Fact k="Cost" v={`${usd(program.cost)}${program.costCadence === "monthly" ? "/mo" : ""}`} />
                </div>
              </div>

              <div className="overflow-hidden rounded-[20px] bg-white/[0.045] ring-1 ring-white/[0.06]">
                <Row label="Market">
                  <Segmented value={instrument} options={(["MNQ", "MES"] as const).map((v) => ({ v, label: v }))} onChange={setInstrument} compact />
                </Row>
                <Row label="Size" hint={`Firm cap ${cap} ${instrument.startsWith("M") ? "micros" : "minis"}`}>
                  <div className="flex items-center gap-1 rounded-full bg-white/[0.07] p-1">
                    <button aria-label="Fewer contracts" onClick={() => setContracts((c) => Math.max(1, c - 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/[0.1]">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-16 text-center font-semibold tabular-nums text-white">
                      {Math.min(contracts, cap)} {instrument}
                    </span>
                    <button aria-label="More contracts" onClick={() => setContracts((c) => Math.min(cap, c + 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/[0.1]">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </Row>
                <Row label="Start" hint={replay ? "Replays about 30 past sessions first, then trades every new one" : "Trades from today's session on"}>
                  <Toggle on={replay} onChange={setReplay} label={replay ? "Replay first" : "Today"} />
                </Row>
              </div>

              <button onClick={start} className="w-full rounded-2xl bg-tp-green py-4 text-[17px] font-semibold text-black shadow-[0_18px_40px_-16px_rgb(var(--tp-green))] transition active:scale-[0.99]">
                Start test
              </button>
              <button onClick={onAdvanced} className="mx-auto flex items-center gap-1.5 text-[14px] font-medium text-tp-blue hover:underline">
                <SlidersHorizontal className="h-4 w-4" /> Fine-tune every rule
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FirmMark({ firmId, size = 36 }: { firmId: string; size?: number }) {
  const b = firmBrand(firmId);
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-[28%] ring-1 ring-white/[0.1]"
      style={{ width: size, height: size, background: b.logo ? "#fff" : `linear-gradient(145deg, ${b.color}, ${b.color}99)` }}
    >
      {b.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logo} alt="" className="h-[78%] w-[78%] object-contain" />
      ) : (
        <span className="font-bold text-white" style={{ fontSize: size * 0.36 }}>
          {b.mono}
        </span>
      )}
    </span>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-3 py-2.5">
      <p className="text-[11.5px] text-zinc-400">{k}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-white">{v}</p>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/[0.05] px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[15.5px] text-white">{label}</p>
        {hint && <p className="text-[12.5px] text-zinc-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-center gap-2.5 text-[14px] text-zinc-300" aria-pressed={on}>
      {label}
      <span className={clsx("relative block h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-300", on ? "bg-tp-green" : "bg-white/[0.16]")}>
        <span className={clsx("absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-spring", on ? "translate-x-[22px]" : "translate-x-[2px]")} />
      </span>
    </button>
  );
}

export function Segmented<T extends string | number>({ label, value, options, onChange, compact }: { label?: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; compact?: boolean }) {
  const i = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div>
      {label && <p className="mb-2 px-1 text-[13px] text-zinc-400">{label}</p>}
      <div className={clsx("relative grid rounded-[12px] bg-white/[0.07] p-[3px]", compact ? "min-w-[140px]" : "")} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        <span
          aria-hidden
          className="absolute bottom-[3px] top-[3px] rounded-[9px] bg-white/[0.18] shadow-[0_3px_8px_rgba(0,0,0,0.25),inset_0_0.5px_0_rgba(255,255,255,0.2)] transition-transform duration-500 ease-spring"
          style={{ left: 3, width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
        />
        {options.map((o) => (
          <button key={String(o.v)} onClick={() => onChange(o.v)} className={clsx("relative rounded-[9px] px-3 py-1.5 text-[13.5px] font-semibold transition-colors", o.v === value ? "text-white" : "text-zinc-400 hover:text-zinc-200")}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
