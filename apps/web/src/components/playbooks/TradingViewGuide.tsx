'use client';

import React from 'react';
import clsx from 'clsx';
import {
  BellRing,
  Calculator,
  CheckCircle2,
  Keyboard,
  LayoutTemplate,
  Rewind,
  Ruler,
  ShieldCheck,
  Table2,
  Trophy,
} from 'lucide-react';
import { FUTURES, pointValue } from '@/lib/futuresSpecs';
import { PositionSizer } from './PositionSizer';

const SECTIONS = [
  { id: 'tv-bracket', label: 'Auto TP & stop loss', icon: ShieldCheck },
  { id: 'tv-sizer', label: 'How many contracts?', icon: Calculator },
  { id: 'tv-position-tool', label: 'Plan with the Position tool', icon: Ruler },
  { id: 'tv-specs', label: 'Micro cheat sheet', icon: Table2 },
  { id: 'tv-layout', label: 'Chart setup', icon: LayoutTemplate },
  { id: 'tv-alerts', label: 'Alerts', icon: BellRing },
  { id: 'tv-replay', label: 'Practice with Replay', icon: Rewind },
  { id: 'tv-keys', label: 'Shortcuts', icon: Keyboard },
  { id: 'tv-prop', label: 'Beat the eval', icon: Trophy },
];

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function TradingViewGuide() {
  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Table of contents */}
      <nav aria-label="Toolkit sections" className="hidden lg:block">
        <div className="sticky top-20 space-y-0.5">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">On this page</div>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
            >
              <Icon className="h-4 w-4 text-zinc-500" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="min-w-0 space-y-6">
        {/* 1. Brackets */}
        <GuideSection
          id="tv-bracket"
          icon={ShieldCheck}
          eyebrow="Most important"
          title="Set your take profit and stop loss automatically"
          intro="A bracket order sends your entry, stop loss and take profit together. When one exit fills, the other cancels (OCO). You decide the risk before you click — no dragging lines in a panic."
        >
          <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
            <Steps
              steps={[
                ['Connect your account', 'Open the Trading Panel at the bottom of the chart and log in to the broker your prop firm gave you (often Tradovate). Paper Trading works the same way for practice.'],
                ['Open the order ticket', 'Click the Buy or Sell button at the top-left of the chart, or right-click the chart → Trade. The order panel slides in on the right.'],
                ['Tick “Take Profit” and “Stop Loss”', 'Both sit under the quantity field. Switch the unit to ticks — it is the easiest to get right with micros.'],
                ['Enter your numbers', 'Quantity = contracts. Stop and TP in ticks. Use the calculator below — it gives you all three.'],
                ['Place the order', 'The TP and SL show as lines on the chart attached to your position. Drag a line to adjust it — the order moves with it.'],
                ['Make it your default', 'Most broker connections remember the last TP/SL you used. Check the gear icon in the order panel for options to keep them — then every new order is already bracketed.'],
              ]}
            />
            <OrderTicketMock />
          </div>
          <Tip>
            Option names move around slightly between broker connections. If you can&apos;t see TP/SL in the ticket, your
            broker may only support them after the entry fills — you can then add them by right-clicking the position line.
          </Tip>
        </GuideSection>

        {/* 2. Sizer */}
        <GuideSection
          id="tv-sizer"
          icon={Calculator}
          eyebrow="Micros"
          title="How many contracts should I put in?"
          intro="Start from the most you're willing to lose on one trade, then let the stop distance decide the size. Wider stop = fewer contracts. The dollars you risk stay the same."
        >
          <PositionSizer />
        </GuideSection>

        {/* 3. Position tool */}
        <GuideSection
          id="tv-position-tool"
          icon={Ruler}
          eyebrow="Plan the trade"
          title="Draw the trade before you take it"
          intro="The Long Position and Short Position tools show entry, stop, target, R:R and ticks right on the chart."
        >
          <Steps
            steps={[
              ['Find the tool', 'Left toolbar → the measuring/forecasting group → Long Position (or Short Position).'],
              ['Click your entry', 'Click where you would enter. Drag the red box to your stop and the green box to your target.'],
              ['Tell it your risk', 'Double-click the drawing → Inputs. Set Account size and Risk (cash or %). The label now shows the quantity it would take.'],
              ['Read the label', 'It shows ticks to stop and target plus the R:R. Copy those tick numbers into your bracket order.'],
            ]}
          />
          <Tip>Draw a Position tool on every screenshot you save to the Workspace — it makes reviewing trades much faster.</Tip>
        </GuideSection>

        {/* 4. Specs */}
        <GuideSection id="tv-specs" icon={Table2} eyebrow="Reference" title="Micro contract cheat sheet" intro="1 E-mini = 10 micros. Ticks are the smallest move; points are what you see on the price scale.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wider text-zinc-500">
                  <th className="py-2.5 pr-4 font-medium">Symbol</th>
                  <th className="py-2.5 pr-4 font-medium">Market</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Tick size</th>
                  <th className="py-2.5 pr-4 text-right font-medium">$ / tick</th>
                  <th className="py-2.5 text-right font-medium">$ / point</th>
                </tr>
              </thead>
              <tbody>
                {FUTURES.map((f) => (
                  <tr key={f.symbol} className={clsx('border-b border-white/[0.04]', !f.micro && 'text-zinc-500')}>
                    <td className="py-2.5 pr-4 font-semibold text-zinc-100">{f.symbol}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{f.name}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{f.tick}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">${f.tickValue.toFixed(2)}</td>
                    <td className="py-2.5 text-right tabular-nums">${pointValue(f).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Tip>Quick maths: a 20-point MNQ stop is 80 ticks and costs $40 per contract. The same stop on NQ costs $400.</Tip>
        </GuideSection>

        {/* 5. Layout */}
        <GuideSection id="tv-layout" icon={LayoutTemplate} eyebrow="One-time setup" title="Set the chart up once, reuse it forever">
          <Cards
            items={[
              ['Use New York time', 'Click the time zone at the bottom-right of the chart and choose New York. Session opens, ORB and “stop at 11:00” rules now line up.'],
              ['Save an indicator template per playbook', 'Add the playbook’s indicators, then use the Indicator templates button in the top toolbar → Save. One click loads “VWAP pullback” or “Failed auction”.'],
              ['Save a layout per playbook', 'Layouts keep your drawings, timeframe and indicators. Name them after the playbook so switching is instant.'],
              ['Keep a watchlist of micros', 'Add MNQ1!, MES1!, MYM1! and MGC1! to a watchlist. The “1!” symbol always follows the front-month contract.'],
            ]}
          />
        </GuideSection>

        {/* 6. Alerts */}
        <GuideSection id="tv-alerts" icon={BellRing} eyebrow="Stop staring" title="Let alerts watch the levels for you">
          <Cards
            items={[
              ['Alert on a line', 'Right-click any horizontal line → Add alert. Pick “Crossing” and a one-time trigger.'],
              ['Alert on VWAP', 'Press Alt/Option + A and set the condition to price “Crossing” VWAP. You get pinged when price reaches fair value.'],
              ['Send it to your phone', 'In the alert, enable app notifications. Walk away between setups — this is how you avoid boredom trades.'],
              ['Name alerts with the plan', 'e.g. “VAL tagged — wait for U + body close”. The alert reminds you of the rule, not just the price.'],
            ]}
          />
        </GuideSection>

        {/* 7. Replay */}
        <GuideSection
          id="tv-replay"
          icon={Rewind}
          eyebrow="Reps"
          title="Practise a playbook with Bar Replay"
          intro="Replay hides the future so you can trade past sessions candle by candle."
        >
          <Steps
            steps={[
              ['Start Replay', 'Click Replay in the top toolbar and pick a starting candle a few days back.'],
              ['Trade it like it is live', 'Step forward one bar at a time. When your setup appears, place a paper bracket order with your real size.'],
              ['Log every rep', 'Screenshot it into this playbook’s Workspace. 20–30 reps per playbook is where confidence comes from.'],
            ]}
          />
          <Tip>Intraday Replay on 1-minute charts may need a paid TradingView plan.</Tip>
        </GuideSection>

        {/* 8. Shortcuts */}
        <GuideSection id="tv-keys" icon={Keyboard} eyebrow="Speed" title="Shortcuts worth learning" intro="On a Mac, Alt is the Option key.">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['Alt + H', 'Horizontal line'],
              ['Alt + V', 'Vertical line'],
              ['Alt + T', 'Trend line'],
              ['Alt + F', 'Fib retracement'],
              ['Alt + A', 'Create alert'],
              ['Alt + R', 'Reset the chart view'],
              ['Shift + click', 'Quick measure (distance, ticks, bars)'],
              ['Type a symbol', 'Start typing on the chart to switch symbols'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-4 py-3">
                <span className="text-[15px] text-zinc-300">{v}</span>
                <kbd className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-zinc-100">{k}</kbd>
              </div>
            ))}
          </div>
        </GuideSection>

        {/* 9. Prop */}
        <GuideSection id="tv-prop" icon={Trophy} eyebrow="Beat the platforms" title="Habits that pass evaluations">
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              'Same dollar risk every trade. Change the contract count, never the risk.',
              'Static stop and target from your backtest — the eval rewards consistency, not home runs.',
              'Stop for the day after 2 losses or half your daily loss limit, whichever comes first.',
              'Know if your drawdown trails. A trailing drawdown follows your peak balance, so giving back profit counts.',
              'Be flat before the session close. Most firms don’t allow holding overnight.',
              'Check the firm’s max contracts and news-trading rules before the first trade.',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-4 text-[15px] leading-relaxed text-zinc-300">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-tp-green" />
                {t}
              </li>
            ))}
          </ul>
        </GuideSection>
      </div>
    </div>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

export function GuideSection({
  id,
  icon: Icon,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  icon: typeof ShieldCheck;
  eyebrow?: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-white/[0.06] bg-tp-card p-5 sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tp-green/10 ring-1 ring-inset ring-tp-green/20">
          <Icon className="h-5 w-5 text-tp-green" />
        </div>
        <div>
          {eyebrow && <div className="text-xs font-semibold uppercase tracking-wider text-tp-green">{eyebrow}</div>}
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">{title}</h2>
          {intro && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-zinc-400">{intro}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <ol className="space-y-4">
      {steps.map(([title, body], i) => (
        <li key={title} className="flex gap-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-sm font-semibold tabular-nums text-zinc-200 ring-1 ring-inset ring-white/[0.08]">
            {i + 1}
          </span>
          <div className="pt-0.5">
            <div className="text-[15px] font-semibold text-zinc-100">{title}</div>
            <p className="mt-0.5 text-[15px] leading-relaxed text-zinc-400">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Cards({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([title, body]) => (
        <div key={title} className="rounded-xl border border-white/[0.06] bg-black/15 p-4">
          <div className="text-[15px] font-semibold text-zinc-100">{title}</div>
          <p className="mt-1 text-[15px] leading-relaxed text-zinc-400">{body}</p>
        </div>
      ))}
    </div>
  );
}

export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-tp-blue/20 bg-tp-blue/[0.06] px-4 py-3 text-sm leading-relaxed text-zinc-300">
      <span className="mr-1.5 font-semibold text-tp-blue">Tip</span>
      {children}
    </p>
  );
}

/** Simplified illustration of an order ticket with a bracket attached. */
function OrderTicketMock() {
  return (
    <figure className="self-start rounded-2xl border border-white/[0.08] bg-[#0b1320] p-4 text-sm">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1 text-center text-xs font-semibold">
        <span className="rounded-md bg-tp-green/90 py-1.5 text-[#0D1628]">Buy</span>
        <span className="py-1.5 text-zinc-500">Sell</span>
      </div>
      <MockRow label="Quantity" value="5" />
      <MockRow label="Order type" value="Market" />
      <div className="my-3 h-px bg-white/[0.06]" />
      <MockCheck label="Take Profit" value="120 ticks" tone="green" />
      <MockCheck label="Stop Loss" value="80 ticks" tone="red" />
      <div className="mt-3 rounded-lg bg-tp-green/90 py-2 text-center text-xs font-semibold text-[#0D1628]">Buy 5 MNQ</div>
      <figcaption className="mt-3 text-center text-[11px] text-zinc-500">Illustration · labels vary by broker</figcaption>
    </figure>
  );
}
const MockRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-1.5 text-zinc-400">
    {label}
    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-zinc-100">{value}</span>
  </div>
);
const MockCheck = ({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="flex items-center gap-2 text-zinc-200">
      <span className={clsx('grid h-4 w-4 place-items-center rounded text-[10px] text-[#0D1628]', tone === 'green' ? 'bg-tp-green' : 'bg-tp-red')}>✓</span>
      {label}
    </span>
    <span className={clsx('rounded-md px-2 py-0.5', tone === 'green' ? 'bg-tp-green/10 text-tp-green' : 'bg-tp-red/10 text-tp-red')}>{value}</span>
  </div>
);
