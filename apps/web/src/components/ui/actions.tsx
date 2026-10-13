'use client';

import React from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function AppButton({
  children,
  className,
  variant = 'secondary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={clsx(
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium tp-press disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-white text-zinc-950 hover:bg-zinc-200',
        variant === 'secondary' &&
          'bg-tp-fill text-zinc-200 hover:bg-white/[0.14] hover:text-white',
        variant === 'ghost' && 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx('flex w-max items-center gap-0.5 rounded-[11px] bg-tp-fill p-[3px]', className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={clsx(
            'rounded-lg px-3 py-1 text-[13px] font-medium transition-all duration-200',
            option === value
              ? 'bg-[#5B6478]/70 text-white shadow-[0_1px_3px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(255,255,255,0.14)]'
              : 'text-zinc-400 hover:text-zinc-100'
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
