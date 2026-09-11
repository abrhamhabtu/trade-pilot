'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flag,
  Flame,
  Gauge,
  Mountain,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  Shield,
  ShieldCheck,
  Target,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { useAccountStore, type Account } from '../../store/accountStore';
import type { Trade } from '../../store/tradingStore';
import { DEFAULT_SETTINGS } from '@/lib/pilot/workspace';
import { PositionSizer } from '../playbooks/PositionSizer';
import { ConsistencyGuardian } from './ConsistencyGuardian';
import { Bar, Card, CardTitle, MoneyInput, Segmented, StatusPill, usd } from './journeyUi';

const TRADING_QUOTES = [
  'The goal of a successful trader is to make the best trades. Money is secondary.',
  'The market is a device for transferring money from the impatient to the patient.',
  'Risk comes from not knowing what you’re doing.',
  'Don’t focus on the money; focus on the execution.',
  'A loss is only a mistake if you don’t learn from it.',
  'Discipline is the bridge between goals and accomplishment.',
  'Boring is profitable. Same setup, same size, same stop.',
];

type Pace = 'conservative' | 'moderate' | 'aggressive' | 'custom';
const PACE_CONFIG: Record<Exclude<Pace, 'custom'>, { label: string; dailyTarget: number; icon: React.ElementType }> = {
  conservative: { label: 'Steady', dailyTarget: 150, icon: Shield },
  moderate: { label: 'Moderate', dailyTarget: 300, icon: Zap },
  aggressive: { label: 'Fast', dailyTarget: 600, icon: Flame },
};

const DEFAULT_FOCUS = ['Wait for my A+ setup — no FOMO', 'Respect the hard stop, never move it', 'Check the economic calendar before the open'];

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const JourneyPage: React.FC = () => {
  const { accounts, selectedAccountId, updateAccount } = useAccountStore();
  const account = accounts.find((a) => a.id === selectedAccountId) || null;

  const [target, setTarget] = useState(account?.profitTarget || 3000);
  const [isFunded, setIsFunded] = useState(account?.isFunded || false);
  const [pace, setPace] = useState<Pace>(account?.pacingPreference || 'moderate');
  const [customPace, setCustomPace] = useState(account?.customDailyPace || 250);
  const [consistencyRule, setConsistencyRule] = useState(account?.consistencyRulePercentage || 30);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'consistency'>('overview');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setTarget(account.profitTarget || 3000);
      setIsFunded(account.isFunded || false);
      setPace(account.pacingPreference || 'moderate');
      setCustomPace(account.customDailyPace || 250);
      setConsistencyRule(account.consistencyRulePercentage || 30);
    }
  }, [account]);

  const dailyTarget = pace === 'custom' ? Math.max(1, customPace) : PACE_CONFIG[pace].dailyTarget;

  // Most recent payout — consistency resets after a payout.
  const lastPayoutDate = useMemo(() => {
    const payouts = (account?.balanceAdjustments ?? []).filter((a) => a.type === 'payout').sort((a, b) => b.date.localeCompare(a.date));
    return payouts.length ? payouts[0].date : null;
  }, [account?.balanceAdjustments]);

  const tradesAfterPayout = useMemo(() => {
    if (!account) return [];
    if (!lastPayoutDate) return account.trades;
    return account.trades.filter((t) => (t.date ? t.date.split('T')[0] : '') > lastPayoutDate);
  }, [account, lastPayoutDate]);

  const byDay = (trades: Trade[]) =>
    trades.reduce(
      (acc, t) => {
        const d = t.date ? t.date.split('T')[0] : 'unknown';
        acc[d] = (acc[d] || 0) + t.netPL;
        return acc;
      },
      {} as Record<string, number>,
    );
  const actualDailyPnL = useMemo(() => (account ? byDay(account.trades) : {}), [account]);
  const dailyPnLAfterPayout = useMemo(() => byDay(tradesAfterPayout), [tradesAfterPayout]);
  const pnlAfterPayout = useMemo(() => tradesAfterPayout.reduce((s, t) => s + t.netPL, 0), [tradesAfterPayout]);

  // Consistency: min required profit = highest day / rule %; qualified when highest/total ≤ rule.
  const consistency = useMemo(() => {
    const days = Object.values(dailyPnLAfterPayout);
    const highestDay = days.length ? Math.max(0, ...days) : 0;
    const currentTotalProfit = Math.max(0, pnlAfterPayout);
    const minimumRequiredProfit = highestDay / (consistencyRule / 100);
    const currentConsistencyPercent = currentTotalProfit > 0 ? (highestDay / currentTotalProfit) * 100 : 0;
    const isQualified = currentTotalProfit > 0 && currentConsistencyPercent <= consistencyRule;
    return {
      highestDay,
      currentTotalProfit,
      minimumRequiredProfit,
      currentConsistencyPercent,
      isQualified,
      tradingDaysSincePayout: Object.keys(dailyPnLAfterPayout).length,
    };
  }, [dailyPnLAfterPayout, consistencyRule, pnlAfterPayout]);

  const currentPnL = account?.balance ?? 0;

  const calendar = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const offset = (monthStart.getDay() + 6) % 7; // Monday-first grid
    const start = new Date(monthStart);
    start.setDate(monthStart.getDate() - offset);

    const tradeDates = Object.keys(actualDailyPnL).filter((d) => d !== 'unknown').sort();
    const lastTradeDate = tradeDates.length ? new Date(`${tradeDates[tradeDates.length - 1]}T12:00:00`) : new Date(today);
    lastTradeDate.setHours(0, 0, 0, 0);

    // Goal needs BOTH conditions: balance target and consistency minimum.
    const balanceDays = Math.ceil(Math.max(0, target - currentPnL) / dailyTarget);
    const consistencyDays = Math.ceil(Math.max(0, consistency.minimumRequiredProfit - consistency.currentTotalProfit) / dailyTarget);
    const tradingDaysNeeded = Math.max(balanceDays, consistencyDays);
    const bothMet = currentPnL >= target && consistency.isQualified && consistency.currentTotalProfit >= consistency.minimumRequiredProfit;

    let goalDate: Date | null = null;
    if (bothMet) {
      let running = 0;
      for (const d of tradeDates) {
        running += actualDailyPnL[d] || 0;
        if (running >= target) {
          goalDate = new Date(`${d}T00:00:00`);
          break;
        }
      }
      goalDate = goalDate || new Date(lastTradeDate);
    } else if (tradingDaysNeeded > 0) {
      const check = new Date(lastTradeDate > today ? lastTradeDate : today);
      let added = 0;
      while (added < tradingDaysNeeded && added < 365) {
        check.setDate(check.getDate() + 1);
        if (check.getDay() !== 0 && check.getDay() !== 6) added++;
      }
      goalDate = added >= tradingDaysNeeded ? check : null;
    }

    const maxAbs = Math.max(1, ...Object.values(actualDailyPnL).map(Math.abs));
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = localDate(date);
      const isPast = date < today;
      const isToday = date.getTime() === today.getTime();
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      let pnl = 0;
      let isProjected = false;
      if (isPast || isToday) pnl = actualDailyPnL[dateStr] || 0;
      else if (!isWeekend && !bothMet && target > 0 && (!goalDate || date <= goalDate)) {
        pnl = dailyTarget;
        isProjected = true;
      }
      days.push({
        date,
        dateStr,
        pnl,
        isPast,
        isToday,
        isProjected,
        isWeekend,
        isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
        isGoalDay: !!goalDate && localDate(goalDate) === dateStr,
        intensity: Math.min(1, Math.abs(pnl) / maxAbs),
      });
    }
    // Trim a trailing week that belongs entirely to next month.
    const trimmed = days.slice(35).every((d) => !d.isCurrentMonth) ? days.slice(0, 35) : days;
    return { days: trimmed, goalDate, tradingDaysNeeded, bothMet };
  }, [actualDailyPnL, dailyTarget, target, currentPnL, currentMonth, consistency]);

  if (!account) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-tp-card">
          <AlertCircle className="h-8 w-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-50">No account selected</h2>
        <Link href="/app/accounts" className="mt-3 text-sm font-medium text-tp-green hover:underline">
          Choose an account →
        </Link>
      </div>
    );
  }

  // Dual-condition payout qualification
  const balanceProgress = target > 0 ? Math.min(100, Math.max(0, (currentPnL / target) * 100)) : 0;
  const remainingPnL = Math.max(0, target - currentPnL);
  const balanceMet = target > 0 && currentPnL >= target;
  const consistencyProgress =
    consistency.minimumRequiredProfit > 0 ? Math.min(100, Math.max(0, (consistency.currentTotalProfit / consistency.minimumRequiredProfit) * 100)) : 0;
  const consistencyGap = Math.max(0, consistency.minimumRequiredProfit - consistency.currentTotalProfit);
  const consistencyMet = consistency.isQualified && consistency.currentTotalProfit >= consistency.minimumRequiredProfit;
  const payoutReady = balanceMet && consistencyMet;

  const save = (patch: Partial<Account>) => updateAccount(account.id, patch);
  const selectedTrades = selectedDay ? account.trades.filter((t) => t.date?.startsWith(selectedDay)) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-tp-green/25 to-tp-blue/20 ring-1 ring-inset ring-white/10">
            <Compass className="h-5 w-5 text-tp-green" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight text-zinc-50">Journey</h1>
            <p className="text-xs text-zinc-500">Your road to {isFunded ? 'the next payout' : 'passing the evaluation'} · {account.name}</p>
          </div>
        </div>
        <Segmented
          value={isFunded ? 'funded' : 'challenge'}
          onChange={(v) => {
            setIsFunded(v === 'funded');
            save({ isFunded: v === 'funded' });
          }}
          options={[
            { value: 'challenge', label: <><Mountain className="h-4 w-4" /> Evaluation</> },
            { value: 'funded', label: <><Trophy className="h-4 w-4" /> Funded</> },
          ]}
        />
      </header>

      <MissionHero
        account={account}
        balance={currentPnL}
        target={target}
        setTarget={(v) => {
          setTarget(v);
          save({ profitTarget: v });
        }}
        balanceProgress={balanceProgress}
        consistencyProgress={consistencyProgress}
        balanceMet={balanceMet}
        consistencyMet={consistencyMet}
        payoutReady={payoutReady}
        remaining={remainingPnL}
        consistencyGap={consistencyGap}
        daysNeeded={calendar.tradingDaysNeeded}
        goalDate={calendar.goalDate}
        dailyTarget={dailyTarget}
        isFunded={isFunded}
      />

      {/* Tabs */}
      <nav aria-label="Journey sections" className="flex gap-1 border-b border-white/[0.06]">
        {([
          { id: 'overview', label: 'Overview', icon: Compass },
          { id: 'consistency', label: 'Consistency Guardian', icon: ShieldCheck },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
            className={clsx(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium',
              activeTab === t.id ? 'border-tp-green text-zinc-50' : 'border-transparent text-zinc-500 hover:text-zinc-200',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.id === 'consistency' && (
              <span
                className={clsx(
                  'rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                  consistency.currentConsistencyPercent <= consistencyRule ? 'bg-tp-green/15 text-tp-green' : 'bg-tp-red/15 text-tp-red',
                )}
              >
                {consistency.currentConsistencyPercent.toFixed(0)}%
              </span>
            )}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <GamePlan
            account={account}
            pace={pace}
            setPace={(p) => {
              setPace(p);
              save({ pacingPreference: p });
            }}
            customPace={customPace}
            setCustomPace={(v) => {
              setCustomPace(v);
              save({ customDailyPace: v });
            }}
            dailyTarget={dailyTarget}
            highestDay={consistency.highestDay}
            remaining={Math.max(remainingPnL, consistencyGap)}
          />

          <div className="grid gap-6 xl:grid-cols-12">
            {/* Roadmap calendar */}
            <Card className="xl:col-span-8">
              <CardTitle
                icon={CalendarDays}
                title="Roadmap"
                subtitle={`Real days in colour, projected days at ${usd(dailyTarget)}/day dashed.`}
                action={
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-xl bg-black/25 p-1 ring-1 ring-inset ring-white/[0.07]">
                      <button
                        aria-label="Previous month"
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button onClick={() => setCurrentMonth(new Date())} className="px-2 text-sm font-semibold text-zinc-100">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </button>
                      <button
                        aria-label="Next month"
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                }
              />

              <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,0.45fr)_minmax(0,0.45fr)] gap-1.5">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="pb-1 text-center text-xs font-medium text-zinc-500">
                    {d}
                  </div>
                ))}
                {calendar.days.map((day) => {
                  const hasTrades = !day.isProjected && day.pnl !== 0;
                  const active = selectedDay === day.dateStr;
                  const tint = hasTrades
                    ? day.pnl > 0
                      ? `rgba(0,214,143,${0.08 + day.intensity * 0.32})`
                      : `rgba(255,72,104,${0.08 + day.intensity * 0.32})`
                    : undefined;
                  return (
                    <button
                      key={day.dateStr}
                      type="button"
                      disabled={!hasTrades}
                      onClick={() => setSelectedDay(active ? null : day.dateStr)}
                      title={hasTrades ? `${day.date.toDateString()} · ${usd(day.pnl, true)}` : day.isProjected ? `Projected ${usd(day.pnl)}` : undefined}
                      style={tint ? { background: tint } : undefined}
                      className={clsx(
                        'relative flex h-[74px] flex-col justify-between rounded-xl p-2 text-left transition-all',
                        !day.isCurrentMonth && 'opacity-30',
                        day.isWeekend && !hasTrades && 'bg-white/[0.015]',
                        day.isGoalDay && 'bg-gradient-to-br from-tp-green to-[#3fe0b0] text-[#0D1628] shadow-[0_0_30px_-6px_rgba(0,214,143,0.7)]',
                        day.isProjected && !day.isGoalDay && 'border border-dashed border-white/[0.1]',
                        !day.isProjected && !hasTrades && !day.isWeekend && !day.isGoalDay && 'bg-white/[0.03]',
                        day.isToday && 'ring-2 ring-tp-blue/70',
                        active && 'ring-2 ring-white/70',
                        hasTrades && 'cursor-pointer hover:brightness-125',
                      )}
                    >
                      <span className={clsx('text-xs font-medium tabular-nums', day.isGoalDay ? 'text-[#0D1628]' : day.isToday ? 'text-tp-blue' : 'text-zinc-500')}>
                        {day.date.getDate()}
                      </span>
                      {day.isGoalDay ? (
                        <span className="flex items-center gap-1 text-xs font-bold">
                          <Trophy className="h-3.5 w-3.5" /> Goal
                        </span>
                      ) : hasTrades ? (
                        <span className={clsx('truncate text-[13px] font-semibold tabular-nums', day.pnl > 0 ? 'text-tp-green' : 'text-tp-red')}>
                          {day.pnl > 0 ? '+' : '−'}
                          {usd(Math.abs(day.pnl))}
                        </span>
                      ) : day.isProjected && !day.isWeekend ? (
                        <span className="truncate text-xs tabular-nums text-zinc-600">+{usd(day.pnl)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
                <Legend swatch="bg-tp-green/40" label="Green day" />
                <Legend swatch="bg-tp-red/40" label="Red day" />
                <Legend swatch="border border-dashed border-white/30" label="Projected" />
                <Legend swatch="bg-tp-green" label="Goal date" />
                <Legend swatch="ring-2 ring-tp-blue/70" label="Today" />
                <span className="ml-auto">Click a coloured day to see its trades</span>
              </div>

              {/* Day detail */}
              {selectedDay && (
                <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-zinc-100">
                      {new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      <span className="ml-2 font-normal text-zinc-500">
                        {selectedTrades.length} trade{selectedTrades.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <button onClick={() => setSelectedDay(null)} aria-label="Close day" className="text-zinc-500 hover:text-zinc-200">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.05]">
                    {selectedTrades.map((t) => (
                      <div key={t.id} className="flex items-center gap-3 py-2 text-sm">
                        <span className="w-12 font-semibold text-zinc-200">{t.symbol}</span>
                        {t.side && (
                          <span className={clsx('rounded px-1.5 text-xs', t.side === 'Long' ? 'bg-tp-green/10 text-tp-green' : 'bg-tp-red/10 text-tp-red')}>
                            {t.side}
                          </span>
                        )}
                        <span className="flex-1 truncate text-zinc-500">
                          {t.time || ''} {t.strategy ? `· ${t.strategy}` : ''}
                        </span>
                        <span className={clsx('font-semibold tabular-nums', t.netPL >= 0 ? 'text-tp-green' : 'text-tp-red')}>{usd(t.netPL, true)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Right rail */}
            <div className="space-y-6 xl:col-span-4">
              <Card>
                <CardTitle icon={Shield} title="Payout readiness" subtitle="Both have to be green." tone={payoutReady ? 'green' : 'yellow'} />
                {lastPayoutDate && (
                  <p className="mb-4 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset after payout on {new Date(`${lastPayoutDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
                    {consistency.tradingDaysSincePayout} trading day{consistency.tradingDaysSincePayout === 1 ? '' : 's'} since
                  </p>
                )}
                <Condition
                  n={1}
                  title="Balance target"
                  met={balanceMet}
                  progress={balanceProgress}
                  lines={[
                    ['Balance', usd(currentPnL, true)],
                    ['Target', usd(target)],
                  ]}
                  gap={balanceMet ? 'Reached' : `${usd(remainingPnL, true)} to go`}
                />
                <Condition
                  n={2}
                  title={`Consistency (${consistencyRule}%)`}
                  met={consistencyMet}
                  progress={consistencyProgress}
                  tone="yellow"
                  lines={[
                    ['Best day since payout', usd(consistency.highestDay, true)],
                    ['Profit since payout', usd(consistency.currentTotalProfit, true)],
                    ['Best day share', `${consistency.currentConsistencyPercent.toFixed(1)}% of ${consistencyRule}% max`],
                  ]}
                  gap={consistencyMet ? 'Qualified' : `${usd(consistencyGap, true)} more profit`}
                />
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium text-zinc-500">Your firm’s consistency rule</div>
                  <Segmented
                    size="sm"
                    value={consistencyRule}
                    onChange={(r) => {
                      setConsistencyRule(r);
                      save({ consistencyRulePercentage: r });
                    }}
                    options={[15, 20, 30, 40, 50].map((r) => ({ value: r, label: `${r}%` }))}
                  />
                </div>
                <button
                  onClick={() => setActiveTab('consistency')}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-tp-green hover:underline"
                >
                  Simulate tomorrow in the Guardian <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </Card>

              <FocusList account={account} save={save} />
            </div>
          </div>

          {/* Micro sizing */}
          <Card>
            <CardTitle
              icon={Calculator}
              title="Size today’s trades for micros"
              subtitle="Contracts per trade, your TradingView bracket, and how many winners it takes to close the gap."
            />
            <PositionSizer strategyId="journey" evalTarget={Math.round(Math.max(remainingPnL, consistencyGap))} targetLabel="Profit still needed" />
          </Card>
        </div>
      ) : (
        <ConsistencyGuardian
          account={account}
          actualDailyPnL={dailyPnLAfterPayout}
          lastPayoutDate={lastPayoutDate}
          tradingDaysSincePayout={consistency.tradingDaysSincePayout}
          rule={consistencyRule}
        />
      )}
    </div>
  );
};

// ─── Hero ────────────────────────────────────────────────────────────────────

function MissionHero(p: {
  account: Account;
  balance: number;
  target: number;
  setTarget: (v: number) => void;
  balanceProgress: number;
  consistencyProgress: number;
  balanceMet: boolean;
  consistencyMet: boolean;
  payoutReady: boolean;
  remaining: number;
  consistencyGap: number;
  daysNeeded: number;
  goalDate: Date | null;
  dailyTarget: number;
  isFunded: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const outer = 2 * Math.PI * 44;
  const inner = 2 * Math.PI * 34;
  const overall = Math.min(p.balanceProgress, p.consistencyProgress || (p.consistencyMet ? 100 : 0));

  const steps = [
    { label: 'Build your record', done: p.account.trades.length > 0, detail: `${p.account.trades.length} trades logged` },
    {
      label: p.isFunded ? 'Build a payout buffer' : 'Hit the profit target',
      done: p.balanceMet,
      detail: p.balanceMet ? 'Target reached' : `${usd(p.remaining)} to go`,
    },
    {
      label: 'Keep days balanced',
      done: p.consistencyMet,
      detail: p.consistencyMet ? 'Consistency met' : p.consistencyGap > 0 ? `${usd(p.consistencyGap)} more profit` : 'Log profitable days first',
    },
    { label: p.isFunded ? 'Request payout' : 'Get funded', done: false, detail: 'Confirm min days & drawdown with your firm' },
  ];
  const nextIdx = steps.findIndex((s) => !s.done);
  const next = steps[nextIdx];

  return (
    <section
      className="overflow-hidden rounded-3xl border border-white/[0.07] p-6 sm:p-8"
      style={{
        background:
          'radial-gradient(50% 90% at 0% 0%, rgba(0,214,143,0.13) 0%, transparent 60%), radial-gradient(40% 80% at 100% 100%, rgba(79,156,249,0.10) 0%, transparent 60%), #111c2e',
      }}
    >
      <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr_minmax(280px,340px)]">
        {/* Ring */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-44 w-44">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={p.balanceMet ? '#00D68F' : '#e4e9f0'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={outer}
                strokeDashoffset={outer - (outer * p.balanceProgress) / 100}
                className="transition-all duration-1000"
              />
              <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="34"
                fill="none"
                stroke={p.consistencyMet ? '#00D68F' : '#FFB800'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={inner}
                strokeDashoffset={inner - (inner * p.consistencyProgress) / 100}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              {p.payoutReady ? (
                <>
                  <Trophy className="h-6 w-6 text-tp-green" />
                  <span className="mt-1 text-sm font-semibold text-tp-green">Goals met</span>
                </>
              ) : (
                <>
                  <span className="text-3xl font-semibold tabular-nums text-zinc-50">{overall.toFixed(0)}%</span>
                  <span className="text-xs text-zinc-500">both goals</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className={clsx('h-2 w-2 rounded-full', p.balanceMet ? 'bg-tp-green' : 'bg-zinc-200')} /> Balance
            </span>
            <span className="flex items-center gap-1.5">
              <span className={clsx('h-2 w-2 rounded-full', p.consistencyMet ? 'bg-tp-green' : 'bg-tp-yellow')} /> Consistency
            </span>
          </div>
        </div>

        {/* Numbers */}
        <div className="min-w-0">
          <div className="text-sm text-zinc-400">Balance (profit)</div>
          <div className="text-4xl font-semibold tabular-nums tracking-tight text-zinc-50 sm:text-5xl">{usd(p.balance, true)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-zinc-400">
            of
            {editing ? (
              <MoneyInput value={p.target} onChange={p.setTarget} className="w-36" />
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 font-semibold text-tp-green hover:bg-white/[0.05]"
              >
                {usd(p.target)} target
                <Pencil className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
              </button>
            )}
            {editing && (
              <button onClick={() => setEditing(false)} className="rounded-lg bg-white/[0.08] px-2 py-1 text-xs font-medium text-zinc-100">
                Done
              </button>
            )}
          </div>
          <Bar value={p.balanceProgress} tone={p.balanceMet ? 'green' : 'white'} className="mt-4 max-w-md" />
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-300">
            {p.payoutReady ? (
              <>Both goals are met. Confirm minimum days and drawdown with your firm before you request it.</>
            ) : (
              <>
                {p.remaining > 0 && <><strong className="text-zinc-50">{usd(p.remaining)}</strong> to target · </>}
                {p.consistencyGap > 0 && <><strong className="text-tp-yellow">{usd(p.consistencyGap)}</strong> for consistency · </>}
                about <strong className="text-zinc-50">{p.daysNeeded} trading days</strong> at {usd(p.dailyTarget)}/day
                {p.goalDate && <> → <strong className="text-tp-green">{p.goalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong></>}.
              </>
            )}
          </p>
        </div>

        {/* Next decision */}
        <div className="rounded-2xl border border-tp-green/20 bg-black/20 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-tp-green">Your next good decision</div>
          <div className="mt-1.5 text-lg font-semibold text-zinc-50">{next.label}</div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{next.detail}. Take the next qualified setup — a daily number is never a reason to force a trade.</p>
          <Link href="/app/routine" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-tp-green hover:underline">
            Open pre-trade routine <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Milestones */}
      <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={clsx(
              'relative rounded-xl border px-4 py-3',
              s.done ? 'border-tp-green/25 bg-tp-green/[0.06]' : i === nextIdx ? 'border-white/[0.15] bg-white/[0.04]' : 'border-white/[0.06] bg-black/10',
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                  s.done ? 'bg-tp-green text-[#0D1628]' : i === nextIdx ? 'bg-white text-[#0D1628]' : 'bg-white/[0.07] text-zinc-400',
                )}
              >
                {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="text-sm font-semibold text-zinc-100">{s.label}</span>
            </div>
            <p className="mt-1 pl-8 text-xs text-zinc-400">{s.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── Game plan ───────────────────────────────────────────────────────────────

function GamePlan({
  account,
  pace,
  setPace,
  customPace,
  setCustomPace,
  dailyTarget,
  highestDay,
  remaining,
}: {
  account: Account;
  pace: Pace;
  setPace: (p: Pace) => void;
  customPace: number;
  setCustomPace: (v: number) => void;
  dailyTarget: number;
  highestDay: number;
  remaining: number;
}) {
  const [risk, setRisk] = useState(200);
  const [r, setR] = useState(2);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('tp_sizer_v1') || '{}');
      if (s.risk) setRisk(s.risk);
    } catch {
      /* default */
    }
  }, []);
  const dailyLoss = account.pilotSettings?.rules.dailyLoss ?? DEFAULT_SETTINGS.rules.dailyLoss;
  // Stop-at profit: stay under your best day so the consistency target can't grow.
  const safeMax = highestDay > 0 ? Math.floor(highestDay - 1) : null;
  const perWin = risk * r;
  const winsToday = perWin > 0 ? Math.ceil(dailyTarget / perWin) : 0;
  const lossesToStop = risk > 0 ? Math.floor(dailyLoss / risk) : 0;
  const daysLeft = dailyTarget > 0 ? Math.ceil(remaining / dailyTarget) : 0;

  return (
    <Card>
      <CardTitle
        icon={Flag}
        title="Today’s game plan"
        subtitle="Your numbers for the session — decided before the open, not during it."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={pace}
              onChange={setPace}
              options={[
                ...(Object.keys(PACE_CONFIG) as (keyof typeof PACE_CONFIG)[]).map((k) => {
                  const Icon = PACE_CONFIG[k].icon;
                  return { value: k as Pace, label: <><Icon className="h-3.5 w-3.5" />{PACE_CONFIG[k].label} ${PACE_CONFIG[k].dailyTarget}</> };
                }),
                { value: 'custom' as Pace, label: 'Custom' },
              ]}
            />
            {pace === 'custom' && <MoneyInput value={customPace} onChange={setCustomPace} className="w-28" />}
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PlanTile icon={Target} tone="green" label="Daily goal" value={usd(dailyTarget)} note={`${daysLeft} trading day${daysLeft === 1 ? '' : 's'} to close the gap`} />
        <PlanTile
          icon={ShieldCheck}
          tone="yellow"
          label="Stop at profit"
          value={safeMax !== null ? usd(safeMax) : '—'}
          note={safeMax !== null ? 'Stay under your best day so the consistency target can’t grow' : 'No green days yet since payout'}
        />
        <PlanTile icon={AlertCircle} tone="red" label="Stop at loss" value={`−${usd(dailyLoss)}`} note={`${lossesToStop} full loss${lossesToStop === 1 ? '' : 'es'} at ${usd(risk)} risk · set in Pilot rules`} />
        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <Gauge className="h-4 w-4 text-tp-blue" /> Winners needed today
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{winsToday}</div>
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
            at
            <MoneyInput value={risk} onChange={setRisk} className="w-24 [&_input]:py-1 [&_input]:text-sm" />
            ×
            <select
              value={r}
              onChange={(e) => setR(Number(e.target.value))}
              aria-label="Reward multiple"
              className="rounded-lg bg-black/25 px-2 py-1 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.09] focus:outline-none"
            >
              {[1, 1.5, 2, 2.5, 3].map((v) => (
                <option key={v} value={v}>
                  {v}R
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {safeMax !== null && dailyTarget > safeMax && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-tp-yellow/25 bg-tp-yellow/[0.06] px-4 py-3 text-sm text-zinc-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-tp-yellow" />
          Your daily goal ({usd(dailyTarget)}) is above your stop-at-profit ({usd(safeMax)}). Hitting it would set a new best day and raise the consistency
          target — pick a slower pace.
        </p>
      )}
    </Card>
  );
}

function PlanTile({ icon: Icon, tone, label, value, note }: { icon: React.ElementType; tone: 'green' | 'yellow' | 'red'; label: string; value: string; note: string }) {
  const color = { green: 'text-tp-green', yellow: 'text-tp-yellow', red: 'text-tp-red' }[tone];
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <Icon className={clsx('h-4 w-4', color)} /> {label}
      </div>
      <div className={clsx('mt-1 text-2xl font-semibold tabular-nums', color)}>{value}</div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{note}</p>
    </div>
  );
}

// ─── Right rail pieces ───────────────────────────────────────────────────────

function Condition({
  n,
  title,
  met,
  progress,
  lines,
  gap,
  tone = 'white',
}: {
  n: number;
  title: string;
  met: boolean;
  progress: number;
  lines: [string, string][];
  gap: string;
  tone?: 'white' | 'yellow';
}) {
  return (
    <div className={clsx('mb-3 rounded-xl border p-4', met ? 'border-tp-green/25 bg-tp-green/[0.05]' : 'border-white/[0.07] bg-black/15')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.08] text-[11px]">{n}</span>
          {title}
        </span>
        <StatusPill ok={met} okLabel="Met" noLabel="Not yet" />
      </div>
      <dl className="space-y-1.5 text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-zinc-400">{k}</dt>
            <dd className="font-medium tabular-nums text-zinc-100">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className={clsx('font-semibold', met ? 'text-tp-green' : tone === 'yellow' ? 'text-tp-yellow' : 'text-zinc-100')}>{gap}</span>
        <span className="text-xs tabular-nums text-zinc-500">{progress.toFixed(0)}%</span>
      </div>
      <Bar value={progress} tone={met ? 'green' : tone === 'yellow' ? 'yellow' : 'white'} className="mt-1.5" />
    </div>
  );
}

function FocusList({ account, save }: { account: Account; save: (p: Partial<Account>) => void }) {
  const items = account.dailyFocus?.length ? account.dailyFocus : DEFAULT_FOCUS;
  const todayKey = `tp_focus_${account.id}_${localDate(new Date())}`;
  const [done, setDone] = useState<number[]>([]);
  const [draft, setDraft] = useState('');
  const [quote, setQuote] = useState('');
  useEffect(() => {
    setQuote(TRADING_QUOTES[Math.floor(Math.random() * TRADING_QUOTES.length)]);
    try {
      setDone(JSON.parse(localStorage.getItem(todayKey) || '[]'));
    } catch {
      setDone([]);
    }
  }, [todayKey]);
  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next);
    try {
      localStorage.setItem(todayKey, JSON.stringify(next));
    } catch {
      /* session only */
    }
  };
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    save({ dailyFocus: [...items, t].slice(0, 8) });
    setDraft('');
  };
  const remove = (i: number) => {
    save({ dailyFocus: items.filter((_, j) => j !== i) });
    setDone(done.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)));
  };

  return (
    <Card>
      <CardTitle icon={Check} title="Today’s focus" subtitle={`${done.length}/${items.length} locked in · resets daily`} />
      <ul className="space-y-2">
        {items.map((item, i) => {
          const on = done.includes(i);
          return (
            <li key={`${item}-${i}`} className="group flex items-center gap-2">
              <button
                onClick={() => toggle(i)}
                aria-pressed={on}
                className={clsx(
                  'flex flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  on ? 'border-tp-green/25 bg-tp-green/[0.06] text-zinc-100' : 'border-white/[0.06] text-zinc-300 hover:border-white/[0.12]',
                )}
              >
                <span className={clsx('grid h-5 w-5 shrink-0 place-items-center rounded-md', on ? 'bg-tp-green text-[#0D1628]' : 'ring-1 ring-inset ring-white/20')}>
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
                {item}
              </button>
              <button
                onClick={() => remove(i)}
                aria-label={`Remove "${item}"`}
                className="rounded-md p-1 text-zinc-600 opacity-0 hover:text-zinc-200 group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add your own rule…"
          className="flex-1 rounded-xl bg-black/25 px-3 py-2 text-sm text-zinc-100 ring-1 ring-inset ring-white/[0.09] placeholder:text-zinc-600 focus:outline-none focus:ring-tp-green/40"
        />
        <button onClick={add} aria-label="Add focus point" className="rounded-xl bg-white/[0.07] px-3 text-zinc-200 hover:bg-white/[0.12]">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {quote && (
        <p className="mt-5 flex gap-2 border-t border-white/[0.06] pt-4 text-sm italic leading-relaxed text-zinc-400">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
          {quote}
        </p>
      )}
    </Card>
  );
}

const Legend = ({ swatch, label }: { swatch: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={clsx('h-3 w-3 rounded', swatch)} />
    {label}
  </span>
);
