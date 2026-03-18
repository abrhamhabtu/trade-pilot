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
  return <section className={clsx('p-6', className)}>{children}</section>;
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
    green: 'shadow-[0_0_24px_rgba(0,214,143,0.07)] border-tp-green/10',
    red:   'shadow-[0_0_24px_rgba(255,72,104,0.07)] border-tp-red/10',
    blue:  'shadow-[0_0_24px_rgba(79,156,249,0.07)] border-tp-blue/10',
    none:  '',
  };

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border border-white/[0.07] transition-all duration-200',
        'bg-gradient-to-br from-tp-card/90 to-tp-panel/70 backdrop-blur-sm',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-6',
        padding === 'lg' && 'p-8',
        hoverable && 'hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 cursor-pointer',
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
