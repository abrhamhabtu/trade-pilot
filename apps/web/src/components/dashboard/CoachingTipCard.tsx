'use client';

import React from 'react';
import { Clock, LucideIcon } from 'lucide-react';

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
    <div
      className="rounded-xl p-6 mb-6 border border-[#1F2937] relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
      }}
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          {isPerformance ? (
            <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#3BF68A]/20 to-[#A78BFA]/20 text-[#3BF68A] rounded-full text-sm font-medium border border-[#3BF68A]/30">
              <Icon className="h-4 w-4" />
              <span>{title}</span>
            </div>
          ) : (
            <div className="px-4 py-2 bg-[#E5E7EB] text-[#15181F] rounded-full text-sm font-medium">
              {title}
            </div>
          )}
        </div>
        <div className="flex-1 pt-1">
          <p className="text-[#E5E7EB] text-base leading-relaxed">
            {tip}
          </p>
        </div>
      </div>
    </div>
  );
});

CoachingTipCard.displayName = 'CoachingTipCard';
