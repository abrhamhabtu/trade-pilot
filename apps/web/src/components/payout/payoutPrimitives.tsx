'use client';

import React from 'react';
import clsx from 'clsx';
import { useThemeStore } from '@/store/themeStore';
import { HelpTooltip } from '@/components/ui/feedback';

type Accent = 'green' | 'red' | 'blue' | 'yellow';

const ACCENT_TEXT: Record<Accent, string> = {
  green: 'text-tp-green',
  red: 'text-tp-red',
  blue: 'text-tp-blue',
  yellow: 'text-tp-yellow',
};

export function useThemeClasses() {
  const { theme } = useThemeStore();
  const dark = theme === 'dark';
  return {
    theme,
    dark,
    card: clsx('rounded-2xl border', dark ? 'bg-tp-card border-white/[0.06]' : 'bg-white border-gray-200'),
    inset: clsx('rounded-xl border', dark ? 'border-white/[0.06] bg-tp-base/50' : 'border-gray-100 bg-gray-50'),
    text: dark ? 'text-zinc-100' : 'text-gray-900',
    muted: dark ? 'text-zinc-500' : 'text-gray-500',
    input: clsx(dark ? 'border-white/[0.08] bg-tp-base text-zinc-100' : 'border-gray-200 bg-gray-50 text-gray-900'),
  };
}

export const LabelWithTip: React.FC<{ label: string; tip?: string; className?: string }> = ({
  label,
  tip,
  className,
}) => (
  <span className={clsx('inline-flex items-center gap-1', className)}>
    {label}
    {tip && <HelpTooltip content={tip} />}
  </span>
);

export const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ icon, title, subtitle, action }) => {
  const { text, muted } = useThemeClasses();
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className={clsx('text-sm font-semibold', text)}>{title}</h2>
        </div>
        {subtitle && <p className={clsx('mt-1 text-xs leading-relaxed', muted)}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
};

export const Stat: React.FC<{
  label: string;
  tip?: string;
  value: string;
  hint?: string;
  accent?: Accent;
}> = ({ label, tip, value, hint, accent }) => {
  const { text, muted, dark } = useThemeClasses();
  return (
    <div>
      <LabelWithTip label={label} tip={tip} className={clsx('text-xs', muted)} />
      <div className={clsx('mt-0.5 text-lg font-semibold', accent ? ACCENT_TEXT[accent] : text)}>{value}</div>
      {hint && <div className={clsx('mt-0.5 text-xs', dark ? 'text-zinc-600' : 'text-gray-400')}>{hint}</div>}
    </div>
  );
};

export const MiniStat: React.FC<{ label: string; tip?: string; value: string; sub?: string; accent?: Accent }> = ({
  label,
  tip,
  value,
  sub,
  accent,
}) => {
  const { text, muted, inset, dark } = useThemeClasses();
  return (
    <div className={clsx(inset, 'p-3')}>
      <LabelWithTip
        label={label}
        tip={tip}
        className={clsx('text-[10px] font-medium uppercase tracking-wide', muted)}
      />
      <div className={clsx('mt-1 text-base font-semibold', accent ? ACCENT_TEXT[accent] : text)}>{value}</div>
      {sub && <div className={clsx('mt-0.5 text-xs', dark ? 'text-zinc-600' : 'text-gray-400')}>{sub}</div>}
    </div>
  );
};

export const SliderField: React.FC<{
  label: string;
  tip?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}> = ({ label, tip, value, min, max, step, format, onChange }) => {
  const { dark } = useThemeClasses();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <LabelWithTip
          label={label}
          tip={tip}
          className={clsx('text-sm font-medium', dark ? 'text-zinc-300' : 'text-gray-700')}
        />
        <span className="text-sm font-semibold text-tp-green">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-tp-green"
      />
    </div>
  );
};

export const PillToggle: React.FC<{
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (v: string | number) => void;
  accent?: 'green' | 'blue';
  size?: 'sm' | 'md';
}> = ({ options, value, onChange, accent = 'green', size = 'md' }) => {
  const { dark } = useThemeClasses();
  const activeCls =
    accent === 'blue'
      ? 'border-tp-blue/40 bg-tp-blue/15 text-tp-blue'
      : 'border-tp-green/40 bg-tp-green/15 text-tp-green';
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            'rounded-md border font-semibold transition-colors',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
            value === opt.value
              ? activeCls
              : dark
                ? 'border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export const NumberInput: React.FC<{
  label?: string;
  value: number | '';
  onChange: (v: number | '') => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  large?: boolean;
}> = ({ label, value, onChange, min, max, step, prefix, suffix, large }) => {
  const { input, muted } = useThemeClasses();
  // Internal draft so the field can be fully cleared and retyped. While the user
  // is editing, an empty field stays empty (no forced 0); the last valid number
  // is kept upstream. On blur, an empty/invalid field falls back to the min.
  const [draft, setDraft] = React.useState<string>(value === '' ? '' : String(value));
  const editing = React.useRef(false);

  React.useEffect(() => {
    if (!editing.current) setDraft(value === '' || value === null || value === undefined ? '' : String(value));
  }, [value]);

  return (
    <div>
      {label && (
        <label className={clsx('mb-1.5 block text-xs font-medium uppercase tracking-wide', muted)}>{label}</label>
      )}
      <div className="relative">
        {prefix && <span className={clsx('absolute left-3 top-1/2 -translate-y-1/2 text-sm', muted)}>{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          onFocus={() => {
            editing.current = true;
          }}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            if (v === '') return; // allow empty while typing — keep last valid value upstream
            const n = Number(v);
            if (!Number.isNaN(n)) onChange(n);
          }}
          onBlur={() => {
            editing.current = false;
            if (draft === '' || Number.isNaN(Number(draft))) {
              const fallback = typeof min === 'number' ? min : 0;
              setDraft(String(fallback));
              onChange(fallback);
            } else {
              setDraft(String(Number(draft)));
            }
          }}
          className={clsx(
            'w-full rounded-xl border font-semibold',
            large ? 'px-4 py-2.5 text-lg' : 'px-3 py-2 text-sm',
            prefix && 'pl-7',
            input
          )}
        />
        {suffix && <span className={clsx('absolute right-3 top-1/2 -translate-y-1/2 text-sm', muted)}>{suffix}</span>}
      </div>
    </div>
  );
};

export const AdviceLine: React.FC<{ tone: 'neutral' | 'warn' | 'good'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const { dark } = useThemeClasses();
  return (
    <p
      className={clsx(
        'rounded-lg px-3 py-2 text-xs leading-relaxed',
        tone === 'warn' && 'bg-tp-red/10 text-tp-red',
        tone === 'good' && 'bg-tp-green/10 text-tp-green',
        tone === 'neutral' && (dark ? 'bg-white/[0.04] text-zinc-400' : 'bg-gray-100 text-gray-600')
      )}
    >
      {children}
    </p>
  );
};
