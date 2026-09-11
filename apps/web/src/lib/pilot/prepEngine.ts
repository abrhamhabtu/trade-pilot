export type PilotTrade = {
  date: string;
  time?: string;
  netPL: number;
  outcome: 'win' | 'loss';
  symbol?: string;
  strategy?: string;
  quantity?: number;
  duration?: number;
};

export type SessionPlanHint = {
  setup?: string;
  finishTime?: string;
  maxTrades?: number;
  symbol?: string;
};

export type BriefingPattern = {
  title: string;
  detail: string;
  tone: 'warn' | 'good' | 'info';
};

export type BriefingEvent = {
  time: string;
  label: string;
  impact: 'high' | 'med';
};

export type PremarketBriefing = {
  date: string;
  weekday: string;
  tradeCount: number;
  recommendation: string;
  focusSetup: string | null;
  avoidWindow: string | null;
  bestWindow: string | null;
  weekdayNote: string | null;
  lastSession: { date: string; pnl: number; trades: number } | null;
  streak: { direction: 'win' | 'loss'; count: number } | null;
  revengeRate: number | null;
  checklist: { id: string; label: string }[];
  events: BriefingEvent[];
  patterns: BriefingPattern[];
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseTradeHour(trade: PilotTrade): number | null {
  if (trade.time) {
    const match = trade.time.match(/^(\d{1,2})(?::(\d{2}))?/);
    if (match) {
      const hour = Number(match[1]);
      if (hour >= 0 && hour <= 23) return hour;
    }
  }
  const stamp = Date.parse(trade.date.includes('T') ? trade.date : `${trade.date}T12:00:00`);
  if (!Number.isFinite(stamp)) return null;
  return new Date(stamp).getHours();
}

export function sessionKey(trade: PilotTrade): string {
  return trade.date.slice(0, 10);
}

export function revengeTrades(trades: PilotTrade[], gapMinutes = 5): PilotTrade[] {
  const sorted = [...trades].sort((a, b) => {
    const da = `${sessionKey(a)} ${a.time || ''}`;
    const db = `${sessionKey(b)} ${b.time || ''}`;
    return da.localeCompare(db);
  });
  const flagged: PilotTrade[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (sessionKey(prev) !== sessionKey(curr)) continue;
    if (prev.outcome !== 'loss') continue;
    if (!prev.time || !curr.time) continue;
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const gap = toMin(curr.time) - toMin(prev.time);
    if (gap >= 0 && gap <= gapMinutes) flagged.push(curr);
  }
  return flagged;
}

function weekdayStats(trades: PilotTrade[]) {
  const map = new Map<number, { pnl: number; wins: number; trades: number }>();
  for (const trade of trades) {
    const day = new Date(`${sessionKey(trade)}T12:00:00`).getDay();
    const row = map.get(day) ?? { pnl: 0, wins: 0, trades: 0 };
    row.pnl += trade.netPL;
    row.trades += 1;
    if (trade.outcome === 'win' || trade.netPL > 0) row.wins += 1;
    map.set(day, row);
  }
  return [...map.entries()].map(([day, row]) => ({
    day,
    name: WEEKDAYS[day],
    ...row,
    winRate: row.trades ? (row.wins / row.trades) * 100 : 0,
    avg: row.pnl / row.trades,
  }));
}

function hourBuckets(trades: PilotTrade[]) {
  const buckets = [
    { id: 'open', label: '9:30–11:00 NY open', hours: [9, 10], pnl: 0, wins: 0, trades: 0 },
    { id: 'mid', label: '11:00–14:00 midday', hours: [11, 12, 13], pnl: 0, wins: 0, trades: 0 },
    { id: 'late', label: '14:00–16:00 afternoon', hours: [14, 15], pnl: 0, wins: 0, trades: 0 },
  ];
  for (const trade of trades) {
    const hour = parseTradeHour(trade);
    if (hour == null) continue;
    const bucket = buckets.find((b) => b.hours.includes(hour));
    if (!bucket) continue;
    bucket.trades += 1;
    bucket.pnl += trade.netPL;
    if (trade.outcome === 'win' || trade.netPL > 0) bucket.wins += 1;
  }
  return buckets.filter((b) => b.trades >= 3);
}

function setupStats(trades: PilotTrade[]) {
  const map = new Map<string, { pnl: number; wins: number; trades: number }>();
  for (const trade of trades) {
    const setup = (trade.strategy || '').trim();
    if (!setup) continue;
    const row = map.get(setup) ?? { pnl: 0, wins: 0, trades: 0 };
    row.pnl += trade.netPL;
    row.trades += 1;
    if (trade.outcome === 'win' || trade.netPL > 0) row.wins += 1;
    map.set(setup, row);
  }
  return [...map.entries()]
    .map(([setup, row]) => ({
      setup,
      ...row,
      winRate: row.trades ? (row.wins / row.trades) * 100 : 0,
    }))
    .filter((row) => row.trades >= 3)
    .sort((a, b) => b.pnl - a.pnl);
}

function lastSession(trades: PilotTrade[]) {
  if (!trades.length) return null;
  const byDay = new Map<string, PilotTrade[]>();
  for (const trade of trades) {
    const key = sessionKey(trade);
    const list = byDay.get(key) ?? [];
    list.push(trade);
    byDay.set(key, list);
  }
  const latest = [...byDay.keys()].sort().at(-1);
  if (!latest) return null;
  const dayTrades = byDay.get(latest)!;
  return {
    date: latest,
    trades: dayTrades.length,
    pnl: dayTrades.reduce((sum, t) => sum + t.netPL, 0),
  };
}

function streakFrom(trades: PilotTrade[]) {
  const sorted = [...trades].sort((a, b) => sessionKey(a).localeCompare(sessionKey(b)));
  if (!sorted.length) return null;
  const last = sorted[sorted.length - 1];
  const direction: 'win' | 'loss' = last.netPL >= 0 ? 'win' : 'loss';
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const isWin = sorted[i].netPL >= 0;
    if ((direction === 'win') !== isWin) break;
    count += 1;
  }
  return { direction, count };
}

export function sessionWindows(weekday: number): BriefingEvent[] {
  const events: BriefingEvent[] = [
    { time: '08:30', label: 'Economic data window (CPI / jobs / GDP weeks)', impact: 'high' },
    { time: '09:30', label: 'NY cash open — first 30 min is often the stop-run', impact: 'high' },
    { time: '10:00', label: 'Second-hour continuation / failed-auction window', impact: 'med' },
  ];
  if (weekday === 5) {
    events.push({ time: '14:00', label: 'Friday afternoon — historically thin, easy to overtrade', impact: 'high' });
  }
  return events;
}

export function buildPremarketBriefing(
  trades: PilotTrade[],
  now = new Date(),
  plan: SessionPlanHint = {},
): PremarketBriefing {
  const weekday = now.getDay();
  const weekdayName = WEEKDAYS[weekday];
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const days = weekdayStats(trades);
  const hours = hourBuckets(trades);
  const setups = setupStats(trades);
  const revenge = revengeTrades(trades);
  const last = lastSession(trades);
  const streak = streakFrom(trades);
  const todayStats = days.find((d) => d.day === weekday);
  const bestHour = hours.slice().sort((a, b) => b.pnl - a.pnl)[0] ?? null;
  const worstHour = hours.slice().sort((a, b) => a.pnl - b.pnl)[0] ?? null;
  const bestSetup = setups[0] ?? null;
  const patterns: BriefingPattern[] = [];

  let weekdayNote: string | null = null;
  if (todayStats && todayStats.trades >= 5) {
    if (todayStats.avg < 0) {
      weekdayNote = `${weekdayName}s have averaged ${todayStats.avg.toFixed(0)} per trade across ${todayStats.trades} trades (${todayStats.winRate.toFixed(0)}% WR). Size down or skip if the setup is not A+.`;
      patterns.push({
        title: `${weekdayName} leak`,
        detail: weekdayNote,
        tone: 'warn',
      });
    } else {
      weekdayNote = `${weekdayName}s are a plus-EV day for you: ${todayStats.winRate.toFixed(0)}% WR, avg ${todayStats.avg.toFixed(0)} / trade.`;
      patterns.push({ title: `${weekdayName} edge`, detail: weekdayNote, tone: 'good' });
    }
  }

  if (bestHour && worstHour && bestHour.id !== worstHour.id && worstHour.pnl < 0) {
    patterns.push({
      title: 'Time-of-day split',
      detail: `${bestHour.label} is your making window. ${worstHour.label} is red (${worstHour.pnl.toFixed(0)}). Protect the close.`,
      tone: 'warn',
    });
  }

  if (bestSetup) {
    patterns.push({
      title: 'A+ setup',
      detail: `${bestSetup.setup} is your best tagged play (${bestSetup.winRate.toFixed(0)}% WR, ${bestSetup.pnl.toFixed(0)} net). Wait for that — nothing else.`,
      tone: 'good',
    });
  }

  if (revenge.length >= 3 && trades.length >= 10) {
    const rate = Math.round((revenge.length / trades.length) * 100);
    patterns.push({
      title: 'Revenge re-entries',
      detail: `${rate}% of trades fire within 5 minutes of a loss. After a red ticket, sit out one full candle.`,
      tone: 'warn',
    });
  }

  if (last && last.pnl < 0) {
    patterns.push({
      title: 'Yesterday still in the account',
      detail: `Last session ${last.date} closed ${last.pnl.toFixed(0)} across ${last.trades} trades. Start smaller today.`,
      tone: 'info',
    });
  }

  if (!trades.length) {
    patterns.push({
      title: 'No history yet',
      detail: 'Import or journal a few sessions and Pilot will brief you from your tape — not generic advice.',
      tone: 'info',
    });
  }

  const avoidWindow = worstHour && worstHour.pnl < 0 ? worstHour.label : weekday === 5 ? 'Friday after 14:00' : null;
  const bestWindow = bestHour ? bestHour.label : '09:30–11:00 NY open';
  const focusSetup = plan.setup?.trim() || bestSetup?.setup || null;

  const recommendationParts = [
    focusSetup
      ? `Wait for ${focusSetup}. If it does not print, you do not trade.`
      : 'Name the one setup you will take before the open.',
    avoidWindow ? `Do not hunt in ${avoidWindow}.` : null,
    plan.finishTime ? `Hard stop at ${plan.finishTime}.` : 'Set a finish time before the first click.',
    plan.maxTrades ? `Cap is ${plan.maxTrades} trades.` : null,
  ].filter(Boolean);

  const checklist = [
    { id: 'levels', label: 'Mark VAL / VAH / VWAP (or your A+ levels) before 9:30' },
    { id: 'setup', label: focusSetup ? `Only take: ${focusSetup}` : 'Write the one setup you are waiting for' },
    { id: 'risk', label: plan.symbol ? `Size ${plan.symbol} to a static stop you can repeat` : 'Size the session to a static stop' },
    { id: 'cap', label: plan.maxTrades ? `Max ${plan.maxTrades} trades — then done` : 'Cap trades for the session' },
    { id: 'stop', label: plan.finishTime ? `Off the desk at ${plan.finishTime}` : 'Pick a finish time' },
    { id: 'tilt', label: 'After a loss: 5-minute timeout before the next ticket' },
  ];

  const events = sessionWindows(weekday);
  if (plan.finishTime) {
    events.push({ time: plan.finishTime, label: 'Your planned finish — flatten and walk', impact: 'high' });
  }

  return {
    date,
    weekday: weekdayName,
    tradeCount: trades.length,
    recommendation: recommendationParts.join(' '),
    focusSetup,
    avoidWindow,
    bestWindow,
    weekdayNote,
    lastSession: last,
    streak,
    revengeRate: trades.length >= 10 ? Math.round((revenge.length / trades.length) * 100) : null,
    checklist,
    events,
    patterns,
  };
}

export function tagTrade(trade: PilotTrade, all: PilotTrade[]): string[] {
  const tags: string[] = [];
  const hour = parseTradeHour(trade);
  if (hour != null && hour >= 9 && hour < 11) tags.push('NY open');
  if (hour != null && hour >= 14) tags.push('Afternoon');
  if (trade.strategy) tags.push(trade.strategy);
  const isRevenge = revengeTrades(all).some(
    (t) => sessionKey(t) === sessionKey(trade) && t.time === trade.time && t.netPL === trade.netPL && t.date === trade.date,
  );
  if (isRevenge) tags.push('Revenge risk');
  if (trade.netPL < 0 && (trade.duration ?? 99) <= 5) tags.push('Quick scratch');
  return tags;
}

export function summarizeToday(trades: PilotTrade[], today: string) {
  const day = trades.filter((t) => sessionKey(t) === today);
  const wins = day.filter((t) => t.netPL > 0).length;
  const pnl = day.reduce((sum, t) => sum + t.netPL, 0);
  return {
    trades: day.length,
    wins,
    losses: day.length - wins,
    pnl,
    winRate: day.length ? Math.round((wins / day.length) * 100) : 0,
    day,
  };
}

export type PilotMessage = {
  role: 'user' | 'pilot';
  text: string;
};

function formatMoney(n: number) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(0)}`;
}

export function answerPilot(
  question: string,
  trades: PilotTrade[],
  briefing: PremarketBriefing,
  now = new Date(),
): string {
  const q = question.trim().toLowerCase();
  if (!q) return 'Ask about your Fridays, revenge trades, best window, or last session.';

  if (!trades.length) {
    return 'I do not have your tape yet. Import trades or journal a few sessions, then ask again — answers come from your data, not the internet.';
  }

  if (/friday|weekday|monday|tuesday|wednesday|thursday|saturday|sunday/.test(q)) {
    return briefing.weekdayNote
      ?? `${briefing.weekday} does not have a strong sample yet. Keep tagging sessions and I will tell you if this weekday is a leak or an edge.`;
  }

  if (/revenge|tilt|re-?entry|after a loss/.test(q)) {
    if (briefing.revengeRate != null && briefing.revengeRate > 0) {
      return `${briefing.revengeRate}% of your tickets fire within 5 minutes of a loss. After a red trade, sit out one candle. That single rule is the cheapest edge you can add.`;
    }
    return 'I am not seeing a loud revenge-trade cluster in this sample. Still: one loss, one pause. Do not let the next click be emotional.';
  }

  if (/afternoon|morning|time|hour|window|open/.test(q)) {
    const parts = [
      briefing.bestWindow && `Your making window: ${briefing.bestWindow}.`,
      briefing.avoidWindow && `Avoid: ${briefing.avoidWindow}.`,
    ].filter(Boolean);
    return parts.length
      ? parts.join(' ')
      : 'Not enough time-stamped trades to split morning vs afternoon yet. Log the clock on the next import.';
  }

  if (/setup|playbook|a\+|pattern|vwap|auction|orb/.test(q)) {
    if (briefing.focusSetup) {
      return `Wait for ${briefing.focusSetup}. If it does not print, you are done — that is the whole plan.`;
    }
    return 'You have not tagged setups enough for me to name an A+ play. Tag trades with the playbook name (Failed Auction, VWAP pullback, ORB) and I will rank them.';
  }

  if (/last session|yesterday|this morning/.test(q)) {
    if (!briefing.lastSession) return 'No prior session on file.';
    const s = briefing.lastSession;
    return `Last session ${s.date}: ${s.trades} trades, ${formatMoney(s.pnl)}. ${s.pnl < 0 ? 'Start smaller today.' : 'Protect that. Do not give it back chasing.'}`;
  }

  if (/win rate|expectancy|how am i|performance|pnl/.test(q)) {
    const pnl = trades.reduce((sum, t) => sum + t.netPL, 0);
    const wins = trades.filter((t) => t.netPL > 0).length;
    const wr = Math.round((wins / trades.length) * 100);
    return `Across ${trades.length} trades: ${wr}% win rate, ${formatMoney(pnl)} net. ${briefing.recommendation}`;
  }

  if (/plan|prep|what should i|today/.test(q)) {
    return briefing.recommendation;
  }

  return `${briefing.recommendation} (${WEEKDAYS[now.getDay()]} briefing from ${briefing.tradeCount} of your trades.) Ask about Fridays, revenge entries, or your best window if you want the slice.`;
}

export function suggestedPrompts(briefing: PremarketBriefing): string[] {
  return [
    `Why do I keep losing on ${briefing.weekday}s?`,
    'Show me my A+ setup',
    'When do I revenge trade?',
    'What should I do this morning?',
  ];
}

