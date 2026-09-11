'use client';

import { useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { answerPilot, suggestedPrompts, type PilotMessage, type PilotTrade, type PremarketBriefing } from '@/lib/pilot';

export function AskPilot({
  trades,
  briefing,
}: {
  trades: PilotTrade[];
  briefing: PremarketBriefing;
}) {
  const prompts = useMemo(() => suggestedPrompts(briefing), [briefing]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<PilotMessage[]>([
    {
      role: 'pilot',
      text: 'Ask me anything about your trading. I already have this account’s tape — no screenshots, no re-explaining.',
    },
  ]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: q },
      { role: 'pilot', text: answerPilot(q, trades, briefing) },
    ]);
    setInput('');
  };

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A1220]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-tp-green">Ask Pilot</p>
          <p className="text-sm font-medium text-zinc-200">It already knows you</p>
        </div>
        <span className="rounded-full bg-tp-green/10 px-2 py-0.5 text-[10px] font-semibold text-tp-green">LIVE</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={
              m.role === 'user'
                ? 'ml-8 rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-zinc-100'
                : 'mr-8 rounded-xl border border-tp-green/15 bg-tp-green/[0.06] px-3 py-2 text-sm leading-relaxed text-zinc-200'
            }
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => ask(p)}
              className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[11px] text-zinc-400 hover:border-tp-green/30 hover:text-zinc-200"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Pilot anything about your trades..."
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-tp-green/40 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-tp-green px-3 py-2 text-[#0D1628]"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
