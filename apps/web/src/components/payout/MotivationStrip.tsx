'use client';

import React, { useState } from 'react';
import { Flame, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useThemeClasses } from './payoutPrimitives';

// Trader wisdom, framed around the one truth the prop firms bank on: that you'll
// break your own rules before the math ever fails you. Rotate for a fresh nudge.
const EDGE_LINES: { quote: string; tag: string }[] = [
  { quote: 'The firm makes money when you over-trade. Your whole edge is the patience to stop while you are green.', tag: 'Patience' },
  { quote: "The consistency rule isn't there to stop you — it's the firm admitting that boring, even traders beat them.", tag: 'Consistency' },
  { quote: 'One oversized win can void a payout. Small, repeatable days are unkillable. Pace to the plan.', tag: 'Discipline' },
  { quote: "You don't have to be right often. At 1.5R, a 45% win rate still prints over time. Let the math work.", tag: 'Expectancy' },
  { quote: 'Survive the drawdown today and the payout is just arithmetic after that. Protect the account first.', tag: 'Survival' },
  { quote: "Most blown accounts aren't bad trades — they're good traders breaking their own rules. Be mechanical.", tag: 'Process' },
  { quote: 'Scaling accounts beats sizing up. Same risk per trade, multiplied payouts. Copy the plan, not the size.', tag: 'Scale' },
  { quote: 'Withdraw early and often. A paid trader trades calmer than a hopeful one. Take the money off the table.', tag: 'Payouts' },
  { quote: 'The house wants you emotional. Stay mechanical and you become the house.', tag: 'Mindset' },
  { quote: 'Trade the plan, take the payout, reload. Boring is the entire strategy — and boring is what wins.', tag: 'Repeat' },
  { quote: "Your best day shouldn't be your whole month. Spread the green, clear the rule, keep the payout.", tag: 'Consistency' },
  { quote: 'Beating a prop firm is not a hot streak — it is showing up, sized small, every single session.', tag: 'Endurance' },
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
