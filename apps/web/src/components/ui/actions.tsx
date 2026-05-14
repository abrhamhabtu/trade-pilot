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
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-white text-zinc-950 hover:bg-zinc-200',
        variant === 'secondary' &&
          'border border-white/5 text-zinc-300 hover:bg-white/5 hover:text-zinc-100 hover:border-white/10',
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
    <div className={clsx('flex w-max items-center gap-2 rounded-lg border border-white/5 p-2', className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={clsx(
            'rounded-md px-3 py-1 text-sm transition-all duration-200',
            option === value
              ? 'bg-white text-zinc-950 font-medium'
              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
