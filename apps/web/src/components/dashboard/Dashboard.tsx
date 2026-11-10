'use client';

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical } from 'lucide-react';
import { DashboardHeader } from './DashboardHeader';
import { MetricsGrid } from './MetricsGrid';
import { CoachCard } from './CoachCard';
import { PropNetCard } from './PropNetCard';
import { DailyStopBanner } from './DailyStopBanner';
import { AccountPulse } from './AccountPulse';
import { ChartsContainer } from './ChartsContainer';
import { useChartData } from '../../hooks/useChartData';
import { Trade, TradingMetrics, TimePeriod } from '../../store/tradingStore';
import { PageSection } from '@/components/ui';

interface DashboardProps {
  trades: Trade[];
  allTrades: Trade[];
  metrics: TradingMetrics;
  selectedTimePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onImport?: () => void;
  onNavigateToRoutine?: () => void;
  accountId?: string;
  accountBalance?: number;
}

// The dashboard is a stack of sections. Their order and visibility belong to the
// trader; the panels inside "Charts" can be dragged around on their own as well.
const SECTIONS = [
  { id: 'metrics', title: 'Key numbers' },
  { id: 'pulse', title: 'Account pulse' },
  { id: 'coach', title: 'Pilot Coach' },
  { id: 'overview', title: 'Calendar and score' },
  { id: 'panels', title: 'Charts' },
  { id: 'prop-net', title: 'Prop net' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];
const DEFAULT_ORDER = SECTIONS.map((s) => s.id) as SectionId[];
const STORAGE_KEY = 'tradepilot_dashboard_sections_v1';

interface Layout {
  order: SectionId[];
  hidden: SectionId[];
}
const DEFAULT_LAYOUT: Layout = { order: DEFAULT_ORDER, hidden: [] };

function sanitize(raw: unknown): Layout {
  const known = (v: unknown): v is SectionId => typeof v === 'string' && DEFAULT_ORDER.includes(v as SectionId);
  const r = (raw ?? {}) as { order?: unknown; hidden?: unknown };
  const order = Array.isArray(r.order) ? [...new Set(r.order.filter(known))] : [];
  // A section added in a later version joins at its default position's end.
  return {
    order: [...order, ...DEFAULT_ORDER.filter((id) => !order.includes(id))],
    hidden: Array.isArray(r.hidden) ? [...new Set(r.hidden.filter(known))] : [],
  };
}

export const Dashboard: React.FC<DashboardProps> = ({
  trades,
  allTrades,
  metrics,
  selectedTimePeriod,
  onTimePeriodChange,
  isLoading,
  onRefresh,
  onNavigateToRoutine,
  accountId,
  accountBalance
}) => {
  const {
    radarData,
    cumulativePLData,
    dailyPLData,
    calendarData,
    timePerformanceData,
    durationPerformanceData
  } = useChartData(trades, metrics);

  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [dragging, setDragging] = useState<SectionId | null>(null);
  const dragId = useRef<SectionId | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLayout(sanitize(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  const commit = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const move = (id: SectionId, to: number) => {
    const order = layout.order.filter((x) => x !== id);
    order.splice(Math.max(0, Math.min(order.length, to)), 0, id);
    commit({ ...layout, order });
  };
  const toggleHidden = (id: SectionId) =>
    commit({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id] });

  const charts = (part: 'overview' | 'panels') => (
    <ChartsContainer
      part={part}
      editMode={editMode}
      resetSignal={resetSignal}
      radarData={radarData}
      cumulativePLData={cumulativePLData}
      dailyPLData={dailyPLData}
      calendarData={calendarData}
      timePerformanceData={timePerformanceData}
      durationPerformanceData={durationPerformanceData}
      trades={trades}
      consistencyScore={metrics.consistency}
      onNavigateToRoutine={onNavigateToRoutine}
      accountId={accountId}
    />
  );

  const nodes: Record<SectionId, React.ReactNode> = {
    metrics: <MetricsGrid metrics={metrics} trades={trades} accountBalance={accountBalance} />,
    pulse: <AccountPulse />,
    coach: <CoachCard trades={trades} />,
    overview: charts('overview'),
    panels: charts('panels'),
    'prop-net': (
      <div className="mb-6">
        <PropNetCard />
      </div>
    ),
  };

  return (
    <PageSection>
      <DashboardHeader
        selectedTimePeriod={selectedTimePeriod}
        onTimePeriodChange={onTimePeriodChange}
        displayTradesCount={trades.length}
        totalTradesCount={allTrades.length}
        isLoading={isLoading}
        onRefresh={onRefresh}
        editMode={editMode}
        onToggleEdit={() => setEditMode((v) => !v)}
        onResetLayout={() => {
          commit(DEFAULT_LAYOUT);
          setResetSignal((n) => n + 1);
        }}
      />

      <DailyStopBanner />

      {editMode && (
        <p className="mb-4 text-[13px] text-zinc-400">
          Drag a section by its handle, or use the arrows. The eye hides one. Inside Charts, drag any panel. Your layout saves as you go.
        </p>
      )}

      {layout.order.map((id, index) => {
        const hidden = layout.hidden.includes(id);
        if (!editMode) return hidden ? null : <React.Fragment key={id}>{nodes[id]}</React.Fragment>;

        const title = SECTIONS.find((s) => s.id === id)!.title;
        // Charts stays open and live so its own panels can be dragged; the rest shrink to a preview.
        const live = id === 'panels' && !hidden;
        return (
          <div
            key={id}
            onDragOver={(e) => {
              const from = dragId.current;
              if (!from) return;
              e.preventDefault();
              if (from === id) return;
              // Swap only once the pointer is past the middle, so tall and short sections do not trade places back and forth.
              const box = e.currentTarget.getBoundingClientRect();
              const past = e.clientY > box.top + box.height / 2;
              if (layout.order.indexOf(from) < index ? past : !past) move(from, index);
            }}
            onDrop={(e) => e.preventDefault()}
            className={clsx(
              'mb-4 rounded-[26px] border border-dashed p-2 transition-opacity',
              dragging === id ? 'border-tp-accent/70 opacity-60' : 'border-white/15',
            )}
          >
            <div
              draggable
              onDragStart={(e) => {
                dragId.current = id;
                setDragging(id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                dragId.current = null;
                setDragging(null);
              }}
              className="flex cursor-grab items-center gap-2 rounded-full bg-tp-fill py-1.5 pl-3 pr-1.5 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className={clsx('min-w-0 flex-1 truncate text-[14px] font-semibold', hidden ? 'text-zinc-500 line-through' : 'text-zinc-100')}>{title}</span>
              {hidden && <span className="text-[12px] font-medium text-zinc-500">Hidden</span>}
              <button
                type="button"
                onClick={() => move(id, index - 1)}
                disabled={index === 0}
                aria-label={`Move ${title} up`}
                className="tp-press grid h-8 w-8 place-items-center rounded-full text-zinc-300 hover:bg-white/[0.1] disabled:opacity-25"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(id, index + 1)}
                disabled={index === layout.order.length - 1}
                aria-label={`Move ${title} down`}
                className="tp-press grid h-8 w-8 place-items-center rounded-full text-zinc-300 hover:bg-white/[0.1] disabled:opacity-25"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => toggleHidden(id)}
                aria-pressed={hidden}
                aria-label={hidden ? `Show ${title}` : `Hide ${title}`}
                className="tp-press grid h-8 w-8 place-items-center rounded-full text-zinc-300 hover:bg-white/[0.1]"
              >
                {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!hidden && (
              <div className={clsx('mt-2 px-1', !live && 'tp-fade-bottom pointer-events-none max-h-40 overflow-hidden')} aria-hidden={!live}>
                {nodes[id]}
              </div>
            )}
          </div>
        );
      })}
    </PageSection>
  );
};

export default Dashboard;
