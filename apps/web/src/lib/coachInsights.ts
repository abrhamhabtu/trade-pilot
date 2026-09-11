import type { Trade } from '@/store/tradingStore';

/**
 * Pilot Coach: turns a trader's own history into short, specific coaching cards.
 * Every card cites the evidence it came from and ends with one habit to try.
 */

export type CoachCategory = 'discipline' | 'risk' | 'timing' | 'mindset' | 'strength';

export interface CoachInsight {
  id: string;
  category: CoachCategory;
  tone: 'warn' | 'good' | 'info';
  title: string;
  detail: string;
  action: string;
  /** Question handed to Pilot AI for a deeper look. */
  ask: string;
  /** Rough dollar impact, used for ranking. */
  weight: number;
}

export interface RuleLog {
  date: string;
  followed: number;
  total: number;
  broken: string[];
}

const usd = (n: number) => {
  const s = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  return n < 0 ? `-${s}` : s;
};
const signed = (n: number) => (n > 0 ? `+${usd(n)}` : usd(n));
const pct = (n: number) => `${Math.round(n)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const winRate = (ts: Trade[]) => (ts.length ? (ts.filter((t) => t.netPL > 0).length / ts.length) * 100 : 0);

function minutesOfDay(t?: string) {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!m) return null;
  let h = +m[1];
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + +m[2];
}

const hourLabel = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

function byDay(trades: Trade[]) {
  const days = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = t.date.slice(0, 10);
    days.set(k, [...(days.get(k) ?? []), t]);
  }
  for (const list of days.values()) list.sort((a, b) => (minutesOfDay(a.time) ?? 0) - (minutesOfDay(b.time) ?? 0));
  return days;
}

export function buildCoachInsights(trades: Trade[], ruleLogs: RuleLog[] = [], ruleCount = 0): CoachInsight[] {
  const out: CoachInsight[] = [];
  const days = byDay(trades);
  const ordered = [...days.keys()].sort().flatMap((k) => days.get(k)!);
  const overallWR = winRate(trades);
  const losers = trades.filter((t) => t.netPL < 0);
  const winners = trades.filter((t) => t.netPL > 0);
  const avgLoss = Math.abs(avg(losers.map((t) => t.netPL)));
  const avgWin = avg(winners.map((t) => t.netPL));

  if (trades.length >= 8) {
    // 1. Tilt: the trade after two straight losses (same session)
    const afterTwo: Trade[] = [];
    for (const list of days.values()) {
      for (let i = 2; i < list.length; i++) if (list[i - 1].netPL < 0 && list[i - 2].netPL < 0) afterTwo.push(list[i]);
    }
    if (afterTwo.length >= 2) {
      const wr = winRate(afterTwo);
      const net = afterTwo.reduce((n, t) => n + t.netPL, 0);
      if (wr < overallWR - 10 || net < 0) {
        out.push({
          id: 'tilt',
          category: 'discipline',
          tone: 'warn',
          title: 'Two losses in a row is your stop sign',
          detail: `After back-to-back losses, your next trade wins ${pct(wr)} of the time (vs ${pct(overallWR)} normally) and has netted ${signed(net)}.`,
          action: 'Hard rule: two straight losses = session over. Close the platform.',
          ask: 'How do my trades perform right after two losses in a row, and what should my stop rule be?',
          weight: Math.abs(Math.min(net, 0)) + 200,
        });
      }
    }

    // 2. Revenge sizing: size up right after a loss
    const revenge: Trade[] = [];
    for (const list of days.values()) {
      for (let i = 1; i < list.length; i++) if (list[i - 1].netPL < 0 && list[i].quantity > list[i - 1].quantity) revenge.push(list[i]);
    }
    if (revenge.length >= 2) {
      const net = revenge.reduce((n, t) => n + t.netPL, 0);
      out.push({
        id: 'revenge',
        category: 'discipline',
        tone: net < 0 ? 'warn' : 'info',
        title: 'Sizing up after a loss',
        detail: `You increased size right after a losing trade ${revenge.length} times. Those trades netted ${signed(net)}.`,
        action: 'After any loss, your next trade uses the same size or smaller. No exceptions.',
        ask: 'Am I revenge trading? Show me the trades where I sized up after a loss.',
        weight: Math.abs(Math.min(net, 0)) + 150,
      });
    }

    // 3. Overtrading: busy days vs normal days
    const counts = [...days.values()].map((l) => l.length).sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)] ?? 0;
    const cap = Math.max(3, Math.ceil(median * 1.5));
    const busy = [...days.values()].filter((l) => l.length > cap);
    const normal = [...days.values()].filter((l) => l.length <= cap);
    if (busy.length >= 2 && normal.length >= 2) {
      const busyAvg = avg(busy.map((l) => l.reduce((n, t) => n + t.netPL, 0)));
      const normAvg = avg(normal.map((l) => l.reduce((n, t) => n + t.netPL, 0)));
      if (busyAvg < normAvg) {
        out.push({
          id: 'overtrading',
          category: 'discipline',
          tone: 'warn',
          title: `More than ${cap} trades a day costs you`,
          detail: `Days with ${cap + 1}+ trades average ${signed(busyAvg)}; days with ${cap} or fewer average ${signed(normAvg)}.`,
          action: `Set a daily cap of ${cap} trades. When you hit it, you're done — win or lose.`,
          ask: `Do I overtrade? Compare my days with more than ${cap} trades to the rest.`,
          weight: (normAvg - busyAvg) * busy.length,
        });
      }
    }

    // 4. Giving back gains within the day
    let givebacks = 0;
    let givenBack = 0;
    for (const list of days.values()) {
      let run = 0;
      let peak = 0;
      for (const t of list) {
        run += t.netPL;
        peak = Math.max(peak, run);
      }
      if (peak >= Math.max(150, avgWin) && run < peak * 0.5) {
        givebacks++;
        givenBack += peak - run;
      }
    }
    if (givebacks >= 2) {
      out.push({
        id: 'giveback',
        category: 'mindset',
        tone: 'warn',
        title: 'Protect green days',
        detail: `${givebacks} days you were up nicely and gave back more than half — ${usd(givenBack)} handed back in total.`,
        action: 'Once you give back 30% of the day’s peak, stop. A smaller green day is still a win.',
        ask: 'Which days did I give back my gains, and what happened on those trades?',
        weight: givenBack,
      });
    }

    // 5. One outsized loss
    if (losers.length >= 3) {
      const worst = losers.reduce((a, b) => (b.netPL < a.netPL ? b : a));
      const ratio = Math.abs(worst.netPL) / (avgLoss || 1);
      if (ratio >= 2.5) {
        out.push({
          id: 'big-loss',
          category: 'risk',
          tone: 'warn',
          title: 'One trade can undo a week',
          detail: `Your biggest loss (${usd(worst.netPL)} on ${worst.symbol}) is ${ratio.toFixed(1)}× your average loss — about ${Math.max(1, Math.round(Math.abs(worst.netPL) / (avgWin || 1)))} average wins wiped out.`,
          action: 'Place the stop before you enter, every time. Never move it further away.',
          ask: 'What went wrong on my biggest losing trade and how do I prevent it?',
          weight: Math.abs(worst.netPL),
        });
      }
    }

    // 6. Holding losers longer than winners
    const wDur = avg(winners.map((t) => t.duration).filter((d) => d > 0));
    const lDur = avg(losers.map((t) => t.duration).filter((d) => d > 0));
    if (wDur > 0 && lDur > wDur * 1.3 && losers.length >= 3) {
      out.push({
        id: 'hold-losers',
        category: 'discipline',
        tone: 'warn',
        title: 'You give losers more time than winners',
        detail: `Losing trades are held ${Math.round(lDur)} min on average vs ${Math.round(wDur)} min for winners. Hope is not a plan.`,
        action: 'If price hits your invalidation, exit. Let winners have the extra time instead.',
        ask: 'Am I holding losing trades too long compared to my winners?',
        weight: avgLoss * 3,
      });
    }

    // 7. Weakest hour
    const hours = new Map<number, Trade[]>();
    for (const t of trades) {
      const m = minutesOfDay(t.time);
      if (m === null) continue;
      const h = Math.floor(m / 60);
      hours.set(h, [...(hours.get(h) ?? []), t]);
    }
    const hourRows = [...hours.entries()].filter(([, l]) => l.length >= 2).map(([h, l]) => ({ h, net: l.reduce((n, t) => n + t.netPL, 0), n: l.length }));
    if (hourRows.length >= 2) {
      const worst = hourRows.reduce((a, b) => (b.net < a.net ? b : a));
      const best = hourRows.reduce((a, b) => (b.net > a.net ? b : a));
      if (worst.net < 0) {
        out.push({
          id: 'bad-hour',
          category: 'timing',
          tone: 'warn',
          title: `${hourLabel(worst.h)}–${hourLabel(worst.h + 1)} is draining you`,
          detail: `${worst.n} trades in that hour have netted ${signed(worst.net)}. Your best hour (${hourLabel(best.h)}) has made ${signed(best.net)}.`,
          action: `Make ${hourLabel(worst.h)}–${hourLabel(worst.h + 1)} a no-trade window for the next two weeks and compare.`,
          ask: `Why do my trades between ${hourLabel(worst.h)} and ${hourLabel(worst.h + 1)} lose money?`,
          weight: Math.abs(worst.net),
        });
      } else if (best.net > 0) {
        out.push({
          id: 'best-hour',
          category: 'timing',
          tone: 'good',
          title: `Your edge lives at ${hourLabel(best.h)}`,
          detail: `${best.n} trades between ${hourLabel(best.h)} and ${hourLabel(best.h + 1)} have made ${signed(best.net)}.`,
          action: 'Be fully prepared before that window opens — levels marked, plan written.',
          ask: `What makes my ${hourLabel(best.h)} trades work so well?`,
          weight: best.net * 0.3,
        });
      }
    }
  }

  // 8. Rules: logging habit, the most-broken rule, and what following them is worth
  if (ruleCount > 0) {
    const recent = [...ruleLogs].sort((a, b) => b.date.localeCompare(a.date));
    const lastLogged = recent[0]?.date;
    const daysSince = lastLogged ? Math.floor((Date.now() - Date.parse(`${lastLogged}T12:00:00`)) / 86_400_000) : Infinity;
    if (daysSince >= 3) {
      out.push({
        id: 'log-rules',
        category: 'discipline',
        tone: 'info',
        title: lastLogged ? `No rule check-in for ${daysSince} days` : 'Start checking your rules',
        detail: 'What gets measured gets followed. Ticking your rules off takes 20 seconds and shows you where discipline slips.',
        action: 'After your session today, log each rule as followed or broken.',
        ask: 'Help me build a daily rule check-in habit.',
        weight: 120,
      });
    }
    const last = recent.slice(0, 10);
    const tally = new Map<string, number>();
    last.forEach((l) => l.broken.forEach((r) => tally.set(r, (tally.get(r) ?? 0) + 1)));
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      out.push({
        id: 'broken-rule',
        category: 'discipline',
        tone: 'warn',
        title: 'Your most-broken rule',
        detail: `“${top[0]}” was broken on ${top[1]} of your last ${last.length} logged days.`,
        action: 'Write it on a sticky note on your screen. Read it before every entry.',
        ask: `I keep breaking my rule "${top[0]}". How do I make it stick?`,
        weight: 180 + top[1] * 40,
      });
    }
    // Follow-the-rules payoff
    const pnlByDay = new Map([...days.entries()].map(([k, l]) => [k, l.reduce((n, t) => n + t.netPL, 0)]));
    const good = ruleLogs.filter((l) => l.total && l.followed / l.total >= 0.8 && pnlByDay.has(l.date)).map((l) => pnlByDay.get(l.date)!);
    const bad = ruleLogs.filter((l) => l.total && l.followed / l.total < 0.8 && pnlByDay.has(l.date)).map((l) => pnlByDay.get(l.date)!);
    if (good.length >= 2 && bad.length >= 2 && avg(good) > avg(bad)) {
      out.push({
        id: 'rules-pay',
        category: 'discipline',
        tone: 'good',
        title: 'Following your rules pays',
        detail: `Days you followed 80%+ of your rules averaged ${signed(avg(good))}. Days you didn’t: ${signed(avg(bad))}.`,
        action: 'That gap is your edge. Protect it before chasing a new setup.',
        ask: 'Show me how my P&L changes on days I follow my rules vs days I don’t.',
        weight: (avg(good) - avg(bad)) * 2,
      });
    }
  }

  // 9. Strength to reinforce
  if (trades.length >= 10 && winners.length && losers.length) {
    const rr = avgWin / (avgLoss || 1);
    if (rr >= 1.5 && overallWR >= 40) {
      out.push({
        id: 'strength-rr',
        category: 'strength',
        tone: 'good',
        title: 'Your winners outsize your losers',
        detail: `Average win ${usd(avgWin)} vs average loss ${usd(avgLoss)} — ${rr.toFixed(1)}:1. That is what keeps you profitable on red days.`,
        action: 'Keep taking full targets. Don’t cut winners early to feel safe.',
        ask: 'What is my real edge based on my trade history?',
        weight: 60,
      });
    }
  }

  // Timeless discipline principles fill the rotation when data is thin.
  const principles: Omit<CoachInsight, 'weight'>[] = [
    {
      id: 'p-maxloss',
      category: 'risk',
      tone: 'info',
      title: 'Decide your max loss before the open',
      detail: 'The worst time to set a limit is when you are already down. Pick the number while you are calm.',
      action: 'Write today’s max loss and max trades before your first entry.',
      ask: 'Help me set a sensible daily max loss for my account.',
    },
    {
      id: 'p-a-plus',
      category: 'discipline',
      tone: 'info',
      title: 'Only take A+ setups',
      detail: 'Most damage comes from trades you knew were “meh”. Boredom is not a setup.',
      action: 'Before entering, name the playbook. No name, no trade.',
      ask: 'Which of my setups performs best, and which should I drop?',
    },
    {
      id: 'p-journal',
      category: 'mindset',
      tone: 'info',
      title: 'One sentence per trade',
      detail: 'A quick note on why you entered turns random results into lessons you can repeat.',
      action: 'After each trade, write: setup, reason, and how you felt.',
      ask: 'Review my recent trades and tell me what patterns you see.',
    },
    {
      id: 'p-walkaway',
      category: 'mindset',
      tone: 'info',
      title: 'Walking away is a position',
      detail: 'No trade is a valid choice. Protecting capital on a messy day keeps you in the game for a clean one.',
      action: 'If you feel rushed, stand up for five minutes before the next entry.',
      ask: 'How can I tell when I should stop trading for the day?',
    },
    {
      id: 'p-size',
      category: 'risk',
      tone: 'info',
      title: 'Trade the size your mind can hold',
      detail: 'If a position makes you stare at every tick, it is too big — and your decisions get worse.',
      action: 'Drop one contract until you can follow your plan without flinching.',
      ask: 'Is my position size right for my account and drawdown?',
    },
  ];
  const day = Math.floor(Date.now() / 86_400_000);
  const needed = Math.max(0, 5 - out.length);
  for (let i = 0; i < needed; i++) out.push({ ...principles[(day + i) % principles.length], weight: 0 });

  const toneRank = { warn: 0, good: 1, info: 2 } as const;
  return out.sort((a, b) => toneRank[a.tone] - toneRank[b.tone] || b.weight - a.weight).slice(0, 7);
}
