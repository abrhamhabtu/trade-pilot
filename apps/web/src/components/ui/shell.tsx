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
}: {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  fullHeight?: boolean;
}) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border border-white/5 bg-[rgba(30,33,48,0.55)] backdrop-blur-sm transition-all duration-200',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-6',
        padding === 'lg' && 'p-8',
        hoverable && 'hover:border-white/10 hover:shadow-lg',
        fullHeight && 'h-full',
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
