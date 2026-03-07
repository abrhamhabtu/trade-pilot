'use client';

import React from 'react';
import { Tooltip } from '@/components/Tooltip';

export function HelpTooltip({
  content,
}: {
  content: string;
}) {
  return (
    <Tooltip content={content} position="top">
      <div className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-[#242838] text-[10px] text-zinc-400 transition-all hover:bg-white/10">
        ?
      </div>
    </Tooltip>
  );
}
