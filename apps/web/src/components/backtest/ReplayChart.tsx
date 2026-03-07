'use client';

import React from 'react';
import clsx from 'clsx';
import { ReplayCandle, ReplayExecution } from '@/lib/backtest/replay';

function priceY(price: number, min: number, max: number, height: number): number {
  if (max === min) return height / 2;
  return ((max - price) / (max - min)) * height;
}

export function ReplayChart({
  candles,
  executions,
  activeExecutionId,
  currentPrice,
  openPosition,
}: {
  candles: ReplayCandle[];
  executions: ReplayExecution[];
  activeExecutionId: string | null;
  currentPrice?: number | null;
  openPosition?: {
    side: 'Long' | 'Short';
    entryPrice: number;
  } | null;
}) {
  const width = 1360;
  const height = 760;
  const paddingX = 48;
  const paddingTop = 40;
  const priceAreaHeight = 520;
  const volumeAreaTop = 600;
  const volumeAreaHeight = 110;

  if (candles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-white/5 bg-[#101522] text-sm text-zinc-500">
        No replay candles loaded
      </div>
    );
  }

  const prices = candles.flatMap((candle) => [candle.high, candle.low]);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const maxVolume = Math.max(...candles.map((candle) => candle.volume));
  const step = (width - paddingX * 2) / candles.length;
  const candleWidth = Math.max(5, step - 3);

  return (
    <div className="relative h-[680px] min-h-[680px] w-full overflow-hidden rounded-[28px] border border-white/5 bg-[#0B1120] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-full w-full">
        <rect x={0} y={0} width={width} height={height} fill="#0B1120" rx={28} />
        {Array.from({ length: 6 }).map((_, index) => {
          const y = paddingTop + (priceAreaHeight / 5) * index;
          return (
            <line
              key={index}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="#1E293B"
              strokeDasharray="4 8"
            />
          );
        })}
        {Array.from({ length: 8 }).map((_, index) => {
          const x = paddingX + ((width - paddingX * 2) / 7) * index;
          return (
            <line
              key={`v-${index}`}
              x1={x}
              x2={x}
              y1={paddingTop}
              y2={volumeAreaTop + volumeAreaHeight}
              stroke="#111827"
              strokeDasharray="2 8"
            />
          );
        })}

        {candles.map((candle, index) => {
          const x = paddingX + index * step + 1.5;
          const openY = priceY(candle.open, min, max, priceAreaHeight) + paddingTop;
          const closeY = priceY(candle.close, min, max, priceAreaHeight) + paddingTop;
          const highY = priceY(candle.high, min, max, priceAreaHeight) + paddingTop;
          const lowY = priceY(candle.low, min, max, priceAreaHeight) + paddingTop;
          const rising = candle.close >= candle.open;
          const volumeHeight = maxVolume > 0 ? (candle.volume / maxVolume) * volumeAreaHeight : 0;

          return (
            <g key={candle.timestamp}>
              <line
                x1={x + candleWidth / 2}
                x2={x + candleWidth / 2}
                y1={highY}
                y2={lowY}
                stroke={rising ? '#34D399' : '#FB7185'}
                strokeWidth={2}
              />
              <rect
                x={x}
                y={Math.min(openY, closeY)}
                width={candleWidth}
                height={Math.max(3, Math.abs(closeY - openY))}
                rx={2}
                fill={rising ? '#34D399' : '#FB7185'}
                opacity={0.92}
              />
              <rect
                x={x}
                y={volumeAreaTop + volumeAreaHeight - volumeHeight}
                width={candleWidth}
                height={volumeHeight}
                rx={2}
                fill={rising ? '#34D399' : '#FB7185'}
                opacity={0.38}
              />
            </g>
          );
        })}

        {openPosition && (
          <g>
            <line
              x1={paddingX}
              x2={width - paddingX}
              y1={priceY(openPosition.entryPrice, min, max, priceAreaHeight) + paddingTop}
              y2={priceY(openPosition.entryPrice, min, max, priceAreaHeight) + paddingTop}
              stroke={openPosition.side === 'Long' ? '#60A5FA' : '#F59E0B'}
              strokeDasharray="8 8"
              strokeWidth={2}
            />
            <text
              x={width - paddingX}
              y={priceY(openPosition.entryPrice, min, max, priceAreaHeight) + paddingTop - 10}
              textAnchor="end"
              className="fill-zinc-300 text-[12px] font-semibold"
            >
              OPEN {openPosition.side.toUpperCase()} {openPosition.entryPrice.toFixed(2)}
            </text>
          </g>
        )}

        {typeof currentPrice === 'number' && (
          <g>
            <line
              x1={paddingX}
              x2={width - paddingX}
              y1={priceY(currentPrice, min, max, priceAreaHeight) + paddingTop}
              y2={priceY(currentPrice, min, max, priceAreaHeight) + paddingTop}
              stroke="#38BDF8"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              opacity={0.8}
            />
            <text
              x={width - paddingX}
              y={priceY(currentPrice, min, max, priceAreaHeight) + paddingTop - 8}
              textAnchor="end"
              className="fill-sky-300 text-[12px] font-semibold"
            >
              {currentPrice.toFixed(2)}
            </text>
          </g>
        )}

        {executions.map((execution) => {
          const candleIndex = candles.findIndex((candle) => candle.timestamp >= execution.timestamp);
          if (candleIndex === -1) return null;
          const x = paddingX + candleIndex * step + candleWidth / 2 + 2;
          const y = priceY(execution.price, min, max, priceAreaHeight) + paddingTop;
          const active = execution.id === activeExecutionId;

          return (
            <g key={execution.id}>
              <circle
                cx={x}
                cy={y}
                r={active ? 9 : 6}
                fill={execution.type === 'entry' ? '#60A5FA' : '#F59E0B'}
                stroke={active ? '#FFFFFF' : '#0F1422'}
                strokeWidth={active ? 3 : 2}
              />
              <text
                x={x}
                y={y - 14}
                textAnchor="middle"
                className={clsx('fill-zinc-300 text-[10px] font-semibold', active && 'fill-white')}
              >
                {execution.type === 'entry' ? 'IN' : 'OUT'}
              </text>
            </g>
          );
        })}

        {candles
          .filter((_, index) => index % Math.max(1, Math.floor(candles.length / 6)) === 0)
          .map((candle, index) => {
            const candleIndex = candles.findIndex((item) => item.timestamp === candle.timestamp);
            const x = paddingX + candleIndex * step + candleWidth / 2 + 2;
            return (
              <text
                key={`label-${candle.timestamp}`}
                x={x}
                y={height - 22}
                textAnchor="middle"
                className="fill-zinc-500 text-[11px]"
              >
                {new Date(candle.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
