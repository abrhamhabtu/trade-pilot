"use client";

import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { READERS, READER_ORDER, type PatternId, type ReaderId } from "@/lib/vision/analyze";
import { PATTERNS, PATTERN_ORDER } from "@/lib/vision/patterns";
import { ENTRY_LABEL, describeRules, ruleChips, type CustomRules, type EntryRule, type StopRule, type TargetRule } from "@/lib/vision/custom";

const ENTRY_DEFAULTS: Record<EntryRule["kind"], EntryRule> = {
  pdhl_retest: { kind: "pdhl_retest", bars: 12 },
  pdhl_sweep: { kind: "pdhl_sweep" },
  orb: { kind: "orb", minutes: 15 },
  vwap_cross: { kind: "vwap_cross" },
  ema_cross: { kind: "ema_cross", fast: 9, slow: 21 },
  fvg: { kind: "fvg" },
  rsi: { kind: "rsi", len: 14, low: 30, high: 70 },
  structure: { kind: "structure" },
  narrow_orb: { kind: "narrow_orb", minutes: 30, lookback: 7 },
  inside_orb: { kind: "inside_orb", minutes: 30 },
  gap_fade: { kind: "gap_fade", minGap: 0.5 },
  last_half: { kind: "last_half", signal: "first30" },
  coin_flip: { kind: "coin_flip", minute: 575, seed: 1 },
  open_reversal: { kind: "open_reversal", minMove: 1.5 },
  opening_drive: { kind: "opening_drive", minMove: 1.5 },
  globex_break: { kind: "globex_break" },
  reader: { kind: "reader", reader: "dbvwap" },
  pattern: { kind: "pattern", pattern: "asia_sweep" },
};
const STOP_DEFAULTS: Record<StopRule["kind"], StopRule> = { atr: { kind: "atr", mult: 1.5, len: 14 }, points: { kind: "points", pts: 20 }, ticks: { kind: "ticks", n: 40 }, swing: { kind: "swing", bars: 8 }, signal: { kind: "signal" }, plan: { kind: "plan" } };
const STOP_LABEL: Record<StopRule["kind"], string> = { atr: "× ATR", points: "Points", ticks: "Ticks", swing: "Swing of last N bars", signal: "Signal candle", plan: "Strategy's own" };
const TARGET_DEFAULTS: Record<TargetRule["kind"], TargetRule> = { r: { kind: "r", r: 2 }, points: { kind: "points", pts: 40 }, plan: { kind: "plan" } };

const sel = "rounded-lg bg-white/[0.07] px-2 py-1 text-[12px] font-semibold text-white ring-1 ring-inset ring-white/[0.08] outline-none";
const numIn = "w-14 rounded-lg bg-white/[0.07] px-2 py-1 text-right text-[12px] font-semibold tabular-nums text-white ring-1 ring-inset ring-white/[0.08] outline-none";

function N({ v, on, step = 1, min = 0 }: { v: number; on: (n: number) => void; step?: number; min?: number }) {
  return <input type="number" className={numIn} value={v} step={step} min={min} onChange={(e) => Number.isFinite(Number(e.target.value)) && on(Math.max(min, Number(e.target.value)))} />;
}

/** The parsed rules, read back the way they will run, each part editable in place. */
export function RulesEditor({ rules, onChange, unknown }: { rules: CustomRules; onChange: (r: CustomRules) => void; unknown: string[] }) {
  const d = describeRules(rules);
  const set = (patch: Partial<CustomRules>) => onChange({ ...rules, ...patch });
  const e = rules.entry;
  return (
    <div className="rounded-[18px] bg-gradient-to-b from-[#5AC8FA]/[0.08] to-transparent p-3.5 ring-1 ring-[#5AC8FA]/25">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9BE1FF]">
        <Sparkles className="h-3.5 w-3.5" /> Vision read it as
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {ruleChips(rules).map((c) => (
          <span key={c} className="rounded-md bg-white/[0.08] px-2 py-0.5 font-mono text-[11px] text-white/80">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        <Row dot="bg-[#5AC8FA]" title="Entry">
          <select className={sel} value={e.kind} onChange={(x) => set({ entry: ENTRY_DEFAULTS[x.target.value as EntryRule["kind"]] })}>
            {(Object.keys(ENTRY_LABEL) as EntryRule["kind"][]).map((k) => (
              <option key={k} value={k}>
                {ENTRY_LABEL[k]}
              </option>
            ))}
          </select>
          {e.kind === "reader" && (
            <select className={sel} value={e.reader} onChange={(x) => set({ entry: { kind: "reader", reader: x.target.value as ReaderId } })}>
              {READER_ORDER.map((r) => (
                <option key={r} value={r}>
                  {READERS[r].label}
                </option>
              ))}
            </select>
          )}
          {e.kind === "pattern" && (
            <select className={sel} value={e.pattern} onChange={(x) => set({ entry: { kind: "pattern", pattern: x.target.value as PatternId }, stop: { kind: "plan" }, target: { kind: "plan" } })}>
              {PATTERN_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PATTERNS[p].label}
                </option>
              ))}
            </select>
          )}
          {e.kind === "orb" && (
            <span className="flex items-center gap-1 text-[12px] text-white/55">
              first <N v={e.minutes} on={(minutes) => set({ entry: { ...e, minutes } })} min={1} /> min
            </span>
          )}
          {e.kind === "pdhl_retest" && (
            <span className="flex items-center gap-1 text-[12px] text-white/55">
              retest within <N v={e.bars} on={(bars) => set({ entry: { ...e, bars } })} min={1} /> bars
            </span>
          )}
          {e.kind === "ema_cross" && (
            <span className="flex items-center gap-1 text-[12px] text-white/55">
              <N v={e.fast} on={(fast) => set({ entry: { ...e, fast } })} min={1} /> / <N v={e.slow} on={(slow) => set({ entry: { ...e, slow } })} min={2} />
            </span>
          )}
          {e.kind === "rsi" && (
            <span className="flex items-center gap-1 text-[12px] text-white/55">
              <N v={e.low} on={(low) => set({ entry: { ...e, low } })} /> / <N v={e.high} on={(high) => set({ entry: { ...e, high } })} />
            </span>
          )}
        </Row>
        {d.long && <Line dot="bg-[#5AC8FA]" title="Long entry" text={d.long} />}
        {d.short && <Line dot="bg-[#FF7A85]" title="Short entry" text={d.short} />}
        <Row dot="bg-white/40" title="Stop loss">
          <select className={sel} value={rules.stop.kind} onChange={(x) => set({ stop: STOP_DEFAULTS[x.target.value as StopRule["kind"]] })}>
            {(Object.keys(STOP_LABEL) as StopRule["kind"][]).filter((k) => k !== "plan" || e.kind === "reader").map((k) => (
              <option key={k} value={k}>
                {STOP_LABEL[k]}
              </option>
            ))}
          </select>
          {rules.stop.kind === "atr" && (() => {
            const s = rules.stop;
            return (
              <span className="flex items-center gap-1 text-[12px] text-white/55">
                <N v={s.mult} step={0.1} on={(mult) => set({ stop: { ...s, mult } })} /> × ATR(<N v={s.len} on={(len) => set({ stop: { ...s, len } })} min={2} />)
              </span>
            );
          })()}
          {rules.stop.kind === "points" && (() => {
            const s = rules.stop;
            return <N v={s.pts} step={0.25} on={(pts) => set({ stop: { ...s, pts } })} />;
          })()}
          {rules.stop.kind === "ticks" && (() => {
            const s = rules.stop;
            return <N v={s.n} on={(n) => set({ stop: { ...s, n } })} min={1} />;
          })()}
          {rules.stop.kind === "swing" && (() => {
            const s = rules.stop;
            return <N v={s.bars} on={(bars) => set({ stop: { ...s, bars } })} min={2} />;
          })()}
        </Row>
        <Row dot="bg-white/40" title="Take profit">
          <select className={sel} value={rules.target.kind} onChange={(x) => set({ target: TARGET_DEFAULTS[x.target.value as TargetRule["kind"]] })}>
            <option value="r">Reward : risk</option>
            <option value="points">Points</option>
            {e.kind === "reader" && <option value="plan">Strategy&apos;s own</option>}
          </select>
          {rules.target.kind === "r" && (() => {
            const t = rules.target;
            return (
              <span className="flex items-center gap-1 text-[12px] text-white/55">
                <N v={t.r} step={0.25} on={(r) => set({ target: { ...t, r } })} /> : 1
              </span>
            );
          })()}
          {rules.target.kind === "points" && (() => {
            const t = rules.target;
            return <N v={t.pts} step={0.25} on={(pts) => set({ target: { ...t, pts } })} />;
          })()}
        </Row>
        <Row dot="bg-white/25" title="Extras">
          <select className={sel} value={rules.trend} onChange={(x) => set({ trend: x.target.value as CustomRules["trend"] })} aria-label="Trend filter">
            <option value="none">No trend filter</option>
            <option value="ema200">With the 200 EMA</option>
            <option value="vwap">VWAP side</option>
          </select>
          <select className={sel} value={rules.breakEvenR ?? 0} onChange={(x) => set({ breakEvenR: Number(x.target.value) || null })} aria-label="Break-even">
            <option value={0}>No break-even</option>
            <option value={0.5}>BE at 0.5R</option>
            <option value={1}>BE at 1R</option>
            <option value={1.5}>BE at 1.5R</option>
          </select>
          <select className={sel} value={rules.maxPerDay ?? 0} onChange={(x) => set({ maxPerDay: Number(x.target.value) || null })} aria-label="Trades a day">
            <option value={0}>Any trades a day</option>
            <option value={1}>1 a day</option>
            <option value={2}>2 a day</option>
            <option value={3}>3 a day</option>
          </select>
          <select className={sel} value={rules.side} onChange={(x) => set({ side: x.target.value as CustomRules["side"] })} aria-label="Direction">
            <option value="both">Longs & shorts</option>
            <option value="long">Longs only</option>
            <option value="short">Shorts only</option>
          </select>
        </Row>
      </div>
      {unknown.length > 0 && (
        <p className="mt-3 rounded-xl bg-[#FFD60A]/[0.08] px-3 py-2 text-[11.5px] leading-snug text-[#FFE27A]">
          Not used: {unknown.map((u) => `“${u.length > 70 ? `${u.slice(0, 70)}…` : u}”`).join(" ")}. Set it on the cards above if it matters.
        </p>
      )}
    </div>
  );
}

function Row({ dot, title, children }: { dot: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
        <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} /> {title}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 pl-3">{children}</div>
    </div>
  );
}

function Line({ dot, title, text }: { dot: string; title: string; text: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white">
        <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} /> {title}
      </p>
      <p className="pl-3 text-[12px] leading-snug text-white/55">{text}</p>
    </div>
  );
}
