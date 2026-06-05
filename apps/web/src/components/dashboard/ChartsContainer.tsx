'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GripVertical, Settings2, RotateCcw, Check } from 'lucide-react';
import clsx from 'clsx';
import { RadarChartComponent } from '../charts/RadarChart';
import { PLChart } from '../charts/PLChart';
import { BarChartComponent } from '../charts/BarChart';
import { ProgressTracker } from '../charts/ProgressTracker';
import { TradesTable } from '../TradesTable';
import { TimePerformanceChart } from '../charts/TimePerformanceChart';
import { DurationPerformanceChart } from '../charts/DurationPerformanceChart';
import { Calendar } from '../Calendar';
import { Trade } from '../../store/tradingStore';
import {
  RadarDataPoint,
  CumulativePLDataPoint,
  DailyPLDataPoint,
  CalendarDataPoint,
  TimePerformanceDataPoint,
  DurationPerformanceDataPoint
} from '../../hooks/useChartData';

interface ChartsContainerProps {
  radarData: RadarDataPoint[];
  cumulativePLData: CumulativePLDataPoint[];
  dailyPLData: DailyPLDataPoint[];
  calendarData: CalendarDataPoint[];
  timePerformanceData: TimePerformanceDataPoint[];
  durationPerformanceData: DurationPerformanceDataPoint[];
  trades: Trade[];
  consistencyScore: number;
  onNavigateToRoutine?: () => void;
  accountId?: string;
}

// Each widget has a fixed width `w` (12-col units) and `rows` (masonry units,
// ~168px each). Only the ORDER is user-customisable (drag to rearrange).
interface WidgetDef {
  id: string;
  title: string;
  w: number;
  rows: number;
  scroll?: boolean;
}

const PINNED_WIDGET_IDS = ['calendar', 'trading-score', 'cumulative-pl'] as const;

const DASHBOARD_ROW_PX = 164;

const WIDGETS: WidgetDef[] = [
  { id: 'trading-score', title: 'Trading score', w: 4, rows: 2 },
  { id: 'cumulative-pl', title: 'Daily net cumulative P&L', w: 4, rows: 2 },
  { id: 'net-daily-pl', title: 'Net daily P&L', w: 4, rows: 2 },
  { id: 'progress-tracker', title: 'Progress tracker', w: 4, rows: 2 },
  { id: 'recent-trades', title: 'Recent trades', w: 4, rows: 2 },
  { id: 'calendar', title: 'Calendar', w: 8, rows: 4 },
  { id: 'time-performance', title: 'Time performance', w: 6, rows: 2 },
  { id: 'duration-performance', title: 'Duration performance', w: 6, rows: 2 },
];

const CUSTOMIZABLE_WIDGETS = WIDGETS.filter((w) => !PINNED_WIDGET_IDS.includes(w.id as typeof PINNED_WIDGET_IDS[number]));

const DEFAULT_ORDER = CUSTOMIZABLE_WIDGETS.map((w) => w.id);

// Literal classes so Tailwind keeps them. Always full width on mobile.
const COL_CLASS: Record<number, string> = {
  4: 'col-span-12 lg:col-span-4',
  6: 'col-span-12 lg:col-span-6',
  8: 'col-span-12 lg:col-span-8',
  12: 'col-span-12',
};

const STORAGE_KEY = 'tradepilot_dashboard_order_v3';

function sanitizeOrder(arr: unknown): string[] {
  if (!Array.isArray(arr)) return DEFAULT_ORDER;
  const valid = arr.filter(
    (id): id is string => typeof id === 'string' && CUSTOMIZABLE_WIDGETS.some((w) => w.id === id)
  );
  const seen = new Set<string>();
  const deduped = valid.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  const missing = CUSTOMIZABLE_WIDGETS.filter((w) => !deduped.includes(w.id)).map((w) => w.id);
  return [...deduped, ...missing];
}

export const ChartsContainer: React.FC<ChartsContainerProps> = React.memo(({
  radarData,
  cumulativePLData,
  dailyPLData,
  calendarData,
  timePerformanceData,
  durationPerformanceData,
  trades,
  consistencyScore,
  onNavigateToRoutine,
  accountId
}) => {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOrder(sanitizeOrder(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const nodeById: Record<string, React.ReactNode> = {
    'trading-score': <RadarChartComponent data={radarData} score={Math.round(consistencyScore)} />,
    'cumulative-pl': <PLChart data={cumulativePLData} type="cumulative" />,
    'net-daily-pl': <BarChartComponent data={dailyPLData} title="Net daily P&L" />,
    'progress-tracker': <ProgressTracker onViewMore={onNavigateToRoutine} />,
    'recent-trades': <TradesTable trades={trades.slice(0, 6)} />,
    calendar: <Calendar data={calendarData} trades={trades} accountId={accountId} />,
    'time-performance': <TimePerformanceChart data={timePerformanceData} />,
    'duration-performance': <DurationPerformanceChart data={durationPerformanceData} />,
  };

  const handleDragOver = (e: React.DragEvent, overId: string) => {
    if (!editMode) return;
    e.preventDefault();
    const from = dragId.current;
    if (!from || from === overId) return;
    setOrder((prev) => {
      const a = [...prev];
      const fi = a.indexOf(from);
      const oi = a.indexOf(overId);
      if (fi < 0 || oi < 0) return prev;
      a.splice(fi, 1);
      a.splice(oi, 0, from);
      return a;
    });
  };

  const handleDragEnd = () => {
    dragId.current = null;
    setDraggingId(null);
    setOrder((cur) => {
      persist(cur);
      return cur;
    });
  };

  const resetLayout = () => {
    setOrder(DEFAULT_ORDER);
    persist(DEFAULT_ORDER);
  };

  return (
    <div className="mb-8">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-300">Dashboard</h2>
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              onClick={resetLayout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
          <button
            onClick={() => setEditMode((v) => !v)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              editMode ? 'bg-tp-green/15 text-tp-green' : 'border border-white/10 text-zinc-400 hover:text-zinc-100'
            )}
          >
            {editMode ? <Check className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
            {editMode ? 'Done' : 'Customize'}
          </button>
        </div>
      </div>

      {editMode && (
        <p className="mb-3 text-xs text-zinc-500">Drag any panel to rearrange your dashboard. Your layout is saved automatically.</p>
      )}

      {/* Pinned hero — calendar sizes to content; sidebar stretches to match */}
      <div className="mb-6 grid grid-cols-12 items-stretch gap-4 lg:gap-6">
        <div className="col-span-12 min-w-0 lg:col-span-8">
          {nodeById.calendar}
        </div>
        <div className="col-span-12 flex min-h-0 flex-col gap-4 lg:col-span-4 lg:gap-6">
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl">{nodeById['trading-score']}</div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl">{nodeById['cumulative-pl']}</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 lg:gap-6" style={{ gridAutoRows: `${DASHBOARD_ROW_PX}px`, gridAutoFlow: 'dense' }}>
        {order.map((id) => {
          const w = WIDGETS.find((x) => x.id === id);
          if (!w) return null;
          const isDragging = draggingId === id;
          return (
            <div
              key={id}
              className={clsx(COL_CLASS[w.w], 'relative min-w-0')}
              style={{ gridRow: `span ${w.rows}` }}
              draggable={editMode}
              onDragStart={(e) => {
                if (!editMode) return;
                dragId.current = id;
                setDraggingId(id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => handleDragOver(e, id)}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
            >
              <div
                className={clsx(
                  'h-full min-h-0 rounded-xl',
                  w.scroll ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden',
                  editMode && 'pointer-events-none ring-2 ring-dashed ring-tp-green/30',
                  isDragging && 'opacity-50'
                )}
              >
                {nodeById[id]}
              </div>

              {editMode && (
                <div className="absolute left-1/2 top-2 z-10 -translate-x-1/2 cursor-grab active:cursor-grabbing rounded-full bg-tp-base/90 px-2.5 py-1 text-[11px] font-medium text-zinc-300 shadow-lg backdrop-blur">
                  <span className="inline-flex items-center gap-1">
                    <GripVertical className="h-3.5 w-3.5" />
                    {w.title}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

ChartsContainer.displayName = 'ChartsContainer';
