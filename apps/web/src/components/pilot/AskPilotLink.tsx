'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { pilotHref } from '@/lib/pilot/askPilot';

/** A small, consistent "ask Pilot about this" link for anywhere in the app. */
export function AskPilotLink({
  question,
  accountId,
  label = 'Ask Pilot',
  className,
}: {
  question: string;
  accountId?: string | null;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={pilotHref(question, accountId)}
      title={question}
      className={clsx('inline-flex items-center gap-1 text-xs font-medium text-tp-green hover:underline underline-offset-2', className)}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </Link>
  );
}
