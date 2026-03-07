'use client';

import React from 'react';
import { Clock, LucideIcon } from 'lucide-react';
import { SurfaceCard } from '@/components/ui';

interface CoachingTipCardProps {
  title: string;
  tip: string;
  variant?: 'default' | 'performance';
  icon?: LucideIcon;
}

export const CoachingTipCard: React.FC<CoachingTipCardProps> = React.memo(({
  title,
  tip,
  variant = 'default',
  icon: Icon = Clock
}) => {
  const isPerformance = variant === 'performance';

  return (
    <SurfaceCard className="mb-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          {isPerformance ? (
            <div className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-emerald-500 rounded-full text-sm font-medium border border-emerald-500/30">
              <Icon className="h-4 w-4" />
              <span>{title}</span>
            </div>
          ) : (
            <div className="px-4 py-2 bg-white text-zinc-950 rounded-full text-sm font-medium shadow-sm">
              {title}
            </div>
          )}
        </div>
        <div className="flex-1 pt-1">
          <p className="text-zinc-300 text-base leading-relaxed">
            {tip}
          </p>
        </div>
      </div>
    </SurfaceCard>
  );
});

CoachingTipCard.displayName = 'CoachingTipCard';
