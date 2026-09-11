'use client';

import React, { useState } from 'react';
import { Flame, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useThemeClasses } from './payoutPrimitives';

// Trader wisdom, framed around the one truth the prop firms bank on: that you'll
// break your own rules before the math ever fails you. Rotate for a fresh nudge.
const EDGE_LINES: { quote: string; tag: string }[] = [
  { quote: 'No setup is a complete reason to sit out. Your income goal does not need to become today’s trading quota.', tag: 'Patience' },
  { quote: 'An unusually large winning day can raise the profit needed under a consistency rule. Check the rule before increasing size.', tag: 'Consistency' },
  { quote: 'Choose the stop from the setup, then size the position to fit your risk budget. A wider stop calls for fewer contracts.', tag: 'Discipline' },
  { quote: 'A small positive edge can disappear after fees and slippage. Judge the plan using net results.', tag: 'Expectancy' },
  { quote: 'Protect enough room for the next qualified setup. A slower path can be easier to follow through a losing streak.', tag: 'Survival' },
  { quote: 'A planned loss is part of trading. Increasing size to win it back changes the plan when emotions are highest.', tag: 'Process' },
  { quote: 'Copied accounts multiply the same loss. Review total exposure before adding another account.', tag: 'Scale' },
  { quote: 'Before requesting a payout, check the cushion that will remain after the withdrawal.', tag: 'Payouts' },
  { quote: 'Score the session on whether you followed your rules. A green result does not make an oversized trade a good decision.', tag: 'Mindset' },
  { quote: 'Decide your stop time and loss limit before the session. Make stopping a decision you have already made.', tag: 'Repeat' },
  { quote: 'You do not need to manufacture a green day. Wait for the setup that fits your plan.', tag: 'Consistency' },
  { quote: 'The next trade is optional. Keeping the account available for tomorrow has value too.', tag: 'Endurance' },
];

const initialIndex = () => {
  // Deterministic per-day pick (SSR-safe): same line on server and first client paint.
  const day = Math.floor(Date.now() / 86_400_000);
  return day % EDGE_LINES.length;
};

export const MotivationStrip: React.FC = () => {
  const { dark, text, muted } = useThemeClasses();
  const [i, setI] = useState(initialIndex);
  const line = EDGE_LINES[i % EDGE_LINES.length];

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border p-5 sm:p-6',
        dark ? 'border-tp-green/15' : 'border-tp-green/20'
      )}
      style={{
        background: dark
          ? 'linear-gradient(135deg, rgba(0,214,143,0.10) 0%, rgba(79,156,249,0.06) 60%, rgba(23,32,53,0.3) 100%)'
          : 'linear-gradient(135deg, rgba(0,214,143,0.08) 0%, rgba(79,156,249,0.05) 100%)',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tp-green/15">
          <Flame className="h-4 w-4 text-tp-green" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-tp-green">Edge mindset</span>
            <span className={clsx('text-[10px] font-medium uppercase tracking-wider', muted)}>· {line.tag}</span>
          </div>
          <p className={clsx('text-sm font-medium leading-relaxed sm:text-[15px]', text)}>{line.quote}</p>
        </div>
        <button
          type="button"
          onClick={() => setI((v) => (v + 1) % EDGE_LINES.length)}
          aria-label="Next"
          className={clsx(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
            dark ? 'text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
          )}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
