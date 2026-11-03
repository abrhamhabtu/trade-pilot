"use client";

import clsx from "clsx";

// Backtest mode wears cyan so it never reads as the live chart.
export const CY = "#5AC8FA";
export const CY_SOFT = "#9BE1FF";
export const NEG = "#FF7A85";

export function Card({ title, aside, children, className }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-[26px] border border-white/[0.07] bg-[#121214]/80 p-5 backdrop-blur-2xl", className)}>
      {(title || aside) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">{title}</h3>}
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = "md",
  full,
}: {
  value: T;
  options: { v: T; l: React.ReactNode; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  label?: string;
  size?: "sm" | "md";
  full?: boolean;
}) {
  const i = Math.max(
    0,
    options.findIndex((o) => o.v === value),
  );
  return (
    <div role="group" aria-label={label} className={clsx("relative grid rounded-[13px] bg-white/[0.07] p-[3px]", full ? "w-full" : "w-fit")} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute bottom-[3px] left-[3px] top-[3px] rounded-[10px] bg-white/[0.16] transition-transform duration-500 ease-spring"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={String(o.v)}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.v)}
          aria-pressed={o.v === value}
          className={clsx(
            "relative whitespace-nowrap rounded-[10px] font-semibold disabled:opacity-30",
            size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3.5 py-1.5 text-[13.5px]",
            o.v === value ? "text-white" : "text-white/50 hover:text-white/80",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-semibold text-white/55">{label}</p>
      {children}
      {hint && <p className="text-[11.5px] leading-snug text-white/38">{hint}</p>}
    </div>
  );
}

export function Num({ value, onChange, min, max, step = 1, suffix, prefix, width = "w-full" }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string; prefix?: string; width?: string }) {
  return (
    <label className={clsx("flex items-center gap-1 rounded-xl bg-white/[0.06] px-3 py-2 ring-1 ring-inset ring-white/[0.07] focus-within:ring-[#5AC8FA]/60", width)}>
      {prefix && <span className="text-[13px] text-white/40">{prefix}</span>}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(min != null ? Math.max(min, max != null ? Math.min(max, n) : n) : n);
        }}
        className="w-full min-w-0 bg-transparent text-[14px] font-semibold tabular-nums text-white outline-none"
      />
      {suffix && <span className="whitespace-nowrap text-[12px] text-white/40">{suffix}</span>}
    </label>
  );
}

export function Toggle({ on, onChange, label, disabled, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; hint?: string }) {
  return (
    <button disabled={disabled} onClick={() => onChange(!on)} title={hint} className="flex w-full items-center justify-between gap-3 py-1 text-left disabled:opacity-40">
      <span className="text-[13.5px] text-white/80">{label}</span>
      <span className={clsx("relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors", on && !disabled ? "bg-[#5AC8FA]" : "bg-white/[0.14]")}>
        <span className={clsx("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-spring", on && !disabled ? "translate-x-[21px]" : "translate-x-[3px]")} />
      </span>
    </button>
  );
}

export function Pill({ tone = "muted", children }: { tone?: "muted" | "cyan" | "neg" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
        tone === "cyan" && "bg-[#5AC8FA]/15 text-[#9BE1FF]",
        tone === "neg" && "bg-[#FF7A85]/14 text-[#FFA3AB]",
        tone === "warn" && "bg-[#FFD60A]/12 text-[#FFE27A]",
        tone === "muted" && "bg-white/[0.07] text-white/60",
      )}
    >
      {children}
    </span>
  );
}
