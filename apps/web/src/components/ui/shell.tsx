'use client';

import React from 'react';
import clsx from 'clsx';

export function PageSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={clsx('p-4 sm:p-6', className)}>{children}</section>;
}

export function SurfaceCard({
  children,
  className,
  padding = 'md',
  hoverable = false,
  fullHeight = false,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  fullHeight?: boolean;
  glow?: 'green' | 'red' | 'blue' | 'none';
}) {
  const glowStyles: Record<string, string> = {
    green: 'border-tp-green/20',
    red:   'border-tp-red/20',
    blue:  'border-tp-blue/20',
    none:  '',
  };

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-white/[0.06] bg-tp-card shadow-lift transition-all duration-200',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-6',
        padding === 'lg' && 'p-8',
        hoverable && 'hover:border-white/[0.12] hover:bg-tp-raised cursor-pointer',
        fullHeight && 'h-full',
        glow && glow !== 'none' ? glowStyles[glow] : '',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('mb-4 flex items-center justify-between', className)}>
      <div className="flex items-center gap-2">{title}</div>
      {action}
    </div>
  );
}
