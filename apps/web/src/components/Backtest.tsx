'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus, Play, CheckCircle, Pause, Trash2, ChevronRight,
    TrendingUp, TrendingDown, Clock, BarChart2, Target,
    ArrowUpRight, ArrowDownLeft, Edit3, X, Search,
    FlaskConical, LayoutDashboard, FileBarChart, MoreVertical,
    Zap, Award, AlertTriangle, Calendar, DollarSign, Activity
} from 'lucide-react';
import clsx from 'clsx';
import { useBacktestStore, BacktestSession, BacktestTrade, SessionStatus } from '@/store/backtestStore';
import { useThemeStore } from '@/store/themeStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const statusColors: Record<SessionStatus, { bg: string; text: string; dot: string }> = {
    active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    completed: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
    paused: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
};

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color = 'emerald', trend }: {
    label: string; value: string; sub?: string;
    icon: React.ElementType; color?: string; trend?: 'up' | 'down' | 'neutral';
}) {
    const colors: Record<string, string> = {
        emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
        blue: 'from-blue-500/20    to-blue-500/5    border-blue-500/20    text-blue-400',
        rose: 'from-rose-500/20    to-rose-500/5    border-rose-500/20    text-rose-400',
        amber: 'from-amber-500/20   to-amber-500/5   border-amber-500/20   text-amber-400',
        purple: 'from-purple-500/20  to-purple-500/5  border-purple-500/20  text-purple-400',
    };
    const cls = colors[color] || colors.emerald;
    return (
        <div className={`bg-gradient-to-br ${cls} border rounded-xl p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm font-medium">{label}</span>
                <div className={`p-2 rounded-lg bg-white/5`}>
                    <Icon className={`h-4 w-4 ${cls.split(' ').find(c => c.startsWith('text-'))}`} />
                </div>
            </div>
            <div>
                <div className="text-2xl font-bold text-zinc-100">{value}</div>
                {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}

// ─── Create Session Modal ─────────────────────────────────────────────────────

function CreateSessionModal({ onClose }: { onClose: () => void }) {
    const { createSession } = useBacktestStore();
    const { theme } = useThemeStore();
    const [form, setForm] = useState({
        name: '', symbol: '', strategy: '', description: '',
        startBalance: '100000', timeframe: '5m', startDate: '', endDate: ''
    });

    const handle = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const submit = () => {
        if (!form.name.trim() || !form.symbol.trim()) return;
        createSession({
            name: form.name.trim(),
            symbol: form.symbol.trim().toUpperCase(),
            strategy: form.strategy.trim() || undefined,
            description: form.description.trim() || undefined,
            startBalance: parseFloat(form.startBalance) || 100000,
            timeframe: form.timeframe,
            startDate: form.startDate || undefined,
            endDate: form.endDate || undefined,
            status: 'active',
        });
        onClose();
    };

    const inputCls = clsx(
        'w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all',
        theme === 'dark'
            ? 'bg-[#242838] border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:ring-emerald-500/30 focus:border-emerald-500/50'
            : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-emerald-500/30'
    );
    const labelCls = 'text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className={clsx(
                'relative w-full max-w-lg mx-4 rounded-2xl border shadow-2xl',
                theme === 'dark' ? 'bg-[#1E2130] border-white/10' : 'bg-white border-gray-200'
            )}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10">
                            <FlaskConical className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-100">New Backtest Session</h2>
                            <p className="text-xs text-zinc-500">Set up your backtesting parameters</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/5 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className={labelCls}>Session Name *</label>
                            <input className={inputCls} placeholder="e.g. MNQ Morning Breakout" value={form.name} onChange={e => handle('name', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Symbol *</label>
                            <input className={inputCls} placeholder="MNQ, ES, NQ..." value={form.symbol} onChange={e => handle('symbol', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Timeframe</label>
                            <select className={inputCls} value={form.timeframe} onChange={e => handle('timeframe', e.target.value)}>
                                {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Start Balance</label>
                            <input className={inputCls} type="number" placeholder="100000" value={form.startBalance} onChange={e => handle('startBalance', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Strategy</label>
                            <input className={inputCls} placeholder="e.g. Breakout" value={form.strategy} onChange={e => handle('strategy', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Backtest Start Date</label>
                            <input className={inputCls} type="date" value={form.startDate} onChange={e => handle('startDate', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelCls}>Backtest End Date</label>
                            <input className={inputCls} type="date" value={form.endDate} onChange={e => handle('endDate', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label className={labelCls}>Notes / Description</label>
                            <textarea className={clsx(inputCls, 'resize-none h-16')} placeholder="Strategy notes or hypothesis..." value={form.description} onChange={e => handle('description', e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex space-x-3">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20 transition-all text-sm font-medium">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!form.name.trim() || !form.symbol.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-[#181B24] font-semibold text-sm hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Create Session
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Add Trade Modal ──────────────────────────────────────────────────────────

function AddTradeModal({ session, onClose }: { session: BacktestSession; onClose: () => void }) {
    const { addTrade } = useBacktestStore();
    const { theme } = useThemeStore();
    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        time: '',
        side: 'Long' as 'Long' | 'Short',
        entryPrice: '',
        exitPrice: '',
        quantity: '1',
        stopLoss: '',
        takeProfit: '',
        duration: '',
        notes: '',
    });

    const handle = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

    const entry = parseFloat(form.entryPrice) || 0;
    const exit = parseFloat(form.exitPrice) || 0;
    const qty = parseFloat(form.quantity) || 1;
    const rawPL = form.side === 'Long' ? (exit - entry) * qty : (entry - exit) * qty;
    const outcome = rawPL > 0 ? 'win' : rawPL < 0 ? 'loss' : 'breakeven' as const;

    const sl = parseFloat(form.stopLoss) || 0;
    const rRaw = sl > 0 ? (Math.abs(entry - exit)) / Math.abs(entry - sl) : undefined;

    const submit = () => {
        if (!entry || !exit || !qty) return;
        addTrade(session.id, {
            date: form.date,
            time: form.time || undefined,
            side: form.side,
            entryPrice: entry,
            exitPrice: exit,
            quantity: qty,
            netPL: parseFloat(rawPL.toFixed(2)),
            outcome,
            stopLoss: sl || undefined,
            takeProfit: parseFloat(form.takeProfit) || undefined,
            duration: parseInt(form.duration) || undefined,
            rMultiple: rRaw ? parseFloat(rRaw.toFixed(2)) : undefined,
            notes: form.notes || undefined,
        });
        onClose();
    };

    const inputCls = clsx(
        'w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all',
        theme === 'dark'
            ? 'bg-[#242838] border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:ring-emerald-500/30 focus:border-emerald-500/50'
            : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-emerald-500/30'
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className={clsx(
                'relative w-full max-w-md mx-4 rounded-2xl border shadow-2xl',
                theme === 'dark' ? 'bg-[#1E2130] border-white/10' : 'bg-white border-gray-200'
            )}>
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
                    <div>
                        <h2 className="text-base font-bold text-zinc-100">Log Backtest Trade</h2>
                        <p className="text-xs text-zinc-500">{session.symbol} · {session.name}</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-white/5 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-3">
                    {/* Side toggle */}
                    <div className="grid grid-cols-2 gap-2">
                        {(['Long', 'Short'] as const).map(s => (
                            <button key={s} onClick={() => handle('side', s)}
                                className={clsx(
                                    'py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all border',
                                    form.side === s
                                        ? s === 'Long'
                                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                            : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                                        : 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300'
                                )}>
                                {s === 'Long' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                {s}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs text-zinc-500 mb-1 block">Date</label>
                            <input type="date" className={inputCls} value={form.date} onChange={e => handle('date', e.target.value)} /></div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">Time</label>
                            <input type="time" className={inputCls} value={form.time} onChange={e => handle('time', e.target.value)} /></div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">Entry Price</label>
                            <input className={inputCls} type="number" step="0.01" placeholder="0.00" value={form.entryPrice} onChange={e => handle('entryPrice', e.target.value)} /></div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">Exit Price</label>
                            <input className={inputCls} type="number" step="0.01" placeholder="0.00" value={form.exitPrice} onChange={e => handle('exitPrice', e.target.value)} /></div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">Quantity / Contracts</label>
                            <input className={inputCls} type="number" step="1" placeholder="1" value={form.quantity} onChange={e => handle('quantity', e.target.value)} /></div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">Stop Loss</label>
                            <input className={inputCls} type="number" step="0.01" placeholder="Optional" value={form.stopLoss} onChange={e => handle('stopLoss', e.target.value)} /></div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">Take Profit</label>
                            <input className={inputCls} type="number" step="0.01" placeholder="Optional" value={form.takeProfit} onChange={e => handle('takeProfit', e.target.value)} /></div>
                        <div><label className="text-xs text-zinc-500 mb-1 block">Duration (min)</label>
                            <input className={inputCls} type="number" placeholder="Optional" value={form.duration} onChange={e => handle('duration', e.target.value)} /></div>
                    </div>

                    {/* Live P&L preview */}
                    {entry > 0 && exit > 0 && (
                        <div className={clsx(
                            'rounded-xl p-3 flex items-center justify-between border',
                            rawPL >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'
                        )}>
                            <span className="text-sm text-zinc-400">Estimated P&L</span>
                            <div className="flex items-center gap-3">
                                {rRaw && <span className="text-xs text-zinc-500">{rRaw >= 0 ? '+' : ''}{rRaw.toFixed(2)}R</span>}
                                <span className={clsx('font-bold text-lg', rawPL >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                    {rawPL >= 0 ? '+' : ''}{fmt(rawPL)}
                                </span>
                            </div>
                        </div>
                    )}

                    <div><label className="text-xs text-zinc-500 mb-1 block">Notes</label>
                        <textarea className={clsx(inputCls, 'resize-none h-14')} placeholder="Setup, entry reason, lessons..." value={form.notes} onChange={e => handle('notes', e.target.value)} /></div>
                </div>

                <div className="px-6 pb-5 flex space-x-3">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-zinc-200 transition-all text-sm">Cancel</button>
                    <button
                        onClick={submit}
                        disabled={!entry || !exit || !qty}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-[#181B24] font-semibold text-sm hover:bg-emerald-400 transition-all disabled:opacity-40"
                    >
                        Log Trade
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({ session, onOpen, onDelete, onComplete }: {
    session: BacktestSession;
    onOpen: () => void;
    onDelete: () => void;
    onComplete: () => void;
}) {
    const { theme } = useThemeStore();
    const [menuOpen, setMenuOpen] = useState(false);
    const sc = statusColors[session.status];
    const pnlPos = session.totalPnL >= 0;

    return (
        <div
            onClick={onOpen}
            className={clsx(
                'grid gap-4 px-6 py-4 border-b items-center cursor-pointer transition-colors group',
                'grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,1fr,auto]',
                theme === 'dark'
                    ? 'border-white/5 hover:bg-white/[0.02]'
                    : 'border-gray-100 hover:bg-gray-50'
            )}
        >
            {/* Name */}
            <div>
                <div className="flex items-center gap-2">
                    <div className={clsx('w-1.5 h-1.5 rounded-full', sc.dot)} />
                    <span className="font-medium text-zinc-100 text-sm group-hover:text-emerald-400 transition-colors">{session.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 ml-3.5">
                    <span className="text-xs text-zinc-500">{session.symbol}</span>
                    {session.strategy && <span className="text-xs text-zinc-600">· {session.strategy}</span>}
                    {session.timeframe && <span className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-zinc-500">{session.timeframe}</span>}
                </div>
            </div>

            {/* Status */}
            <div>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', sc.bg, sc.text)}>
                    {session.status}
                </span>
            </div>

            {/* Start Balance */}
            <div className="text-sm text-zinc-400">{fmt(session.startBalance)}</div>

            {/* Current Balance */}
            <div className={clsx('text-sm font-medium', pnlPos ? 'text-emerald-400' : 'text-rose-400')}>
                {fmt(session.currentBalance)}
            </div>

            {/* P&L */}
            <div className={clsx('text-sm font-semibold', pnlPos ? 'text-emerald-400' : 'text-rose-400')}>
                {pnlPos ? '+' : ''}{fmt(session.totalPnL)}
            </div>

            {/* Win Rate */}
            <div className="text-sm text-zinc-300">
                {session.totalTrades > 0 ? fmtPct(session.winRate) : '—'}
            </div>

            {/* Trades */}
            <div className="text-sm text-zinc-400">{session.totalTrades}</div>

            {/* Actions */}
            <div className="relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => setMenuOpen(o => !o)}
                    className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                >
                    <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                        <div className={clsx(
                            'absolute right-0 top-full mt-1 w-44 rounded-xl border shadow-xl z-50 py-1 overflow-hidden',
                            theme === 'dark' ? 'bg-[#1E2130] border-white/10' : 'bg-white border-gray-200'
                        )}>
                            <button onClick={() => { onOpen(); setMenuOpen(false); }}
                                className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-white/5 flex items-center gap-2">
                                <Edit3 className="h-3.5 w-3.5" /> Open Session
                            </button>
                            {session.status !== 'completed' && (
                                <button onClick={() => { onComplete(); setMenuOpen(false); }}
                                    className="w-full px-4 py-2 text-left text-sm text-blue-400 hover:bg-blue-500/10 flex items-center gap-2">
                                    <CheckCircle className="h-3.5 w-3.5" /> Mark Complete
                                </button>
                            )}
                            <div className="border-t border-white/5 my-1" />
                            <button onClick={() => { onDelete(); setMenuOpen(false); }}
                                className="w-full px-4 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── TradingView symbol mapping ───────────────────────────────────────────────

const TV_SYMBOL_MAP: Record<string, string> = {
    MNQ: 'CME_MINI:MNQ1!',
    MES: 'CME_MINI:MES1!',
    ES: 'CME_MINI:ES1!',
    NQ: 'CME_MINI:NQ1!',
    YM: 'CBOT_MINI:YM1!',
    RTY: 'CME_MINI:RTY1!',
    MCL: 'NYMEX:MCL1!',
    CL: 'NYMEX:CL1!',
    GC: 'COMEX:GC1!',
    SI: 'COMEX:SI1!',
    ZB: 'CBOT:ZB1!',
    ZN: 'CBOT:ZN1!',
    BTC: 'BITSTAMP:BTCUSD',
    ETH: 'BITSTAMP:ETHUSD',
    SPY: 'AMEX:SPY',
    QQQ: 'NASDAQ:QQQ',
    AAPL: 'NASDAQ:AAPL',
    TSLA: 'NASDAQ:TSLA',
    NVDA: 'NASDAQ:NVDA',
};

const TV_INTERVAL_MAP: Record<string, string> = {
    '1m': '1', '5m': '5', '15m': '15', '30m': '30',
    '1h': '60', '4h': '240', '1D': 'D', '1W': 'W',
};

function resolveTvSymbol(raw: string): string {
    const upper = raw.trim().toUpperCase();
    return TV_SYMBOL_MAP[upper] || upper;
}

// ─── TradingView Chart Embed ──────────────────────────────────────────────────

function TradingViewChart({ symbol, timeframe }: { symbol: string; timeframe?: string }) {
    const containerId = `tv_chart_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const tvSymbol = resolveTvSymbol(symbol);
    const interval = TV_INTERVAL_MAP[timeframe || '5m'] || '5';

    useEffect(() => {
        // Remove any previous widget
        const prev = document.getElementById(containerId);
        if (prev) prev.innerHTML = '';

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
            if (typeof (window as unknown as Record<string, unknown>).TradingView === 'undefined') return;
            const TV = (window as unknown as Record<string, { widget: new (cfg: Record<string, unknown>) => void }>).TradingView;
            new TV.widget({
                container_id: containerId,
                autosize: true,
                symbol: tvSymbol,
                interval,
                timezone: 'America/New_York',
                theme: 'dark',
                style: '1',
                locale: 'en',
                toolbar_bg: '#1E2130',
                enable_publishing: false,
                hide_top_toolbar: false,
                hide_legend: false,
                save_to_server: false,
                allow_symbol_change: true,
                studies: ['Volume@tv-basicstudies'],
                overrides: {
                    'paneProperties.background': '#181B24',
                    'paneProperties.backgroundType': 'solid',
                    'scalesProperties.textColor': '#71717a',
                },
            });
        };
        document.head.appendChild(script);

        return () => {
            try {
                const el = document.getElementById(containerId);
                if (el) el.innerHTML = '';
                if (script.parentNode) script.parentNode.removeChild(script);
            } catch { /* ignore cleanup errors */ }
        };
    }, [symbol, timeframe]);

    return (
        <div id={containerId} className="w-full h-full rounded-l-xl overflow-hidden" />
    );
}

// ─── Session Detail ───────────────────────────────────────────────────────────

type SessionView = 'log' | 'chart';

function SessionDetail({ session, onBack }: { session: BacktestSession; onBack: () => void }) {
    const { deleteTrade, completeSession } = useBacktestStore();
    const { theme } = useThemeStore();
    const [showAddTrade, setShowAddTrade] = useState(false);
    const [sessionView, setSessionView] = useState<SessionView>('log');
    const pnlPos = session.totalPnL >= 0;

    const losses = session.trades.filter((t: BacktestTrade) => t.outcome === 'loss');
    const wins = session.trades.filter((t: BacktestTrade) => t.outcome === 'win');
    const avgWin = wins.length > 0 ? wins.reduce((s: number, t: BacktestTrade) => s + t.netPL, 0) / wins.length : 0;
    const sc = statusColors[session.status];

    return (
        <div className="flex flex-col h-full">
            {showAddTrade && <AddTradeModal session={session} onClose={() => setShowAddTrade(false)} />}

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors">
                        <ChevronRight className="h-5 w-5 rotate-180" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold text-zinc-100">{session.name}</h1>
                            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', sc.bg, sc.text)}>{session.status}</span>
                            <span className="text-xs bg-white/5 px-2 py-0.5 rounded font-mono text-zinc-400">{session.symbol}</span>
                            {session.timeframe && <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-zinc-500">{session.timeframe}</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-0.5">
                            <span className={clsx('text-sm font-semibold', pnlPos ? 'text-emerald-400' : 'text-rose-400')}>
                                {pnlPos ? '+' : ''}{fmt(session.totalPnL)} P&L
                            </span>
                            <span className="text-xs text-zinc-600">·</span>
                            <span className="text-xs text-zinc-500">{session.totalTrades} trades</span>
                            <span className="text-xs text-zinc-600">·</span>
                            <span className="text-xs text-zinc-500">{session.totalTrades > 0 ? fmtPct(session.winRate) : '—'} WR</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View toggle */}
                    <div className="flex p-1 rounded-xl gap-1 bg-[#242838]/70 border border-white/5">
                        <button onClick={() => setSessionView('log')}
                            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                sessionView === 'log' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300')}>
                            <FlaskConical className="h-3.5 w-3.5" /> Trade Log
                        </button>
                        <button onClick={() => setSessionView('chart')}
                            className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                sessionView === 'chart' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300')}>
                            <BarChart2 className="h-3.5 w-3.5" /> TradingView
                        </button>
                    </div>

                    {session.status !== 'completed' && (
                        <button onClick={() => completeSession(session.id)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-xs font-medium transition-all">
                            <CheckCircle className="h-3.5 w-3.5" /> Complete
                        </button>
                    )}
                    <button onClick={() => setShowAddTrade(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-[#181B24] font-semibold text-xs hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
                        <Plus className="h-4 w-4" /> Log Trade
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b border-white/5 flex-shrink-0">
                {[
                    { label: 'Balance', value: fmt(session.currentBalance), color: pnlPos ? 'text-emerald-400' : 'text-rose-400' },
                    { label: 'P&L', value: `${pnlPos ? '+' : ''}${fmt(session.totalPnL)}`, color: pnlPos ? 'text-emerald-400' : 'text-rose-400' },
                    { label: 'Win Rate', value: session.totalTrades > 0 ? fmtPct(session.winRate) : '—', color: 'text-zinc-200' },
                    { label: 'Profit Factor', value: session.totalTrades > 0 ? session.profitFactor.toFixed(2) : '—', color: 'text-zinc-200' },
                ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/[0.03] rounded-xl px-4 py-2.5 border border-white/5">
                        <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
                        <p className={clsx('text-sm font-bold', color)}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Content area */}
            {sessionView === 'log' ? (
                /* ─── Trade Log View ─── */
                <div className="flex-1 overflow-auto p-6">
                    <div className={clsx('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-white/5' : 'border-gray-200')}>
                        <div className={clsx('grid grid-cols-[60px,1fr,1fr,1fr,1fr,1fr,1fr,80px,40px] gap-3 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider border-b',
                            theme === 'dark' ? 'bg-[#181B24] border-white/5 text-zinc-500' : 'bg-gray-50 border-gray-100 text-gray-400')}>
                            <span>#</span><span>Date</span><span>Side</span><span>Entry</span>
                            <span>Exit</span><span>Qty</span><span>P&L</span><span>R</span><span></span>
                        </div>
                        <div className={theme === 'dark' ? 'bg-[#181B24]' : 'bg-white'}>
                            {session.trades.length === 0 ? (
                                <div className="py-20 text-center">
                                    <FlaskConical className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                                    <p className="text-zinc-400 font-semibold">No trades logged yet</p>
                                    <p className="text-zinc-600 text-sm mt-1">Click "Log Trade" or switch to TradingView to start</p>
                                    <button onClick={() => setShowAddTrade(true)}
                                        className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 text-[#181B24] font-semibold text-sm hover:bg-emerald-400 transition-all">
                                        Log First Trade
                                    </button>
                                </div>
                            ) : (
                                [...session.trades].reverse().map((trade: BacktestTrade, i: number) => {
                                    const pos = trade.netPL >= 0;
                                    return (
                                        <div key={trade.id} className={clsx(
                                            'grid grid-cols-[60px,1fr,1fr,1fr,1fr,1fr,1fr,80px,40px] gap-3 px-6 py-3 border-b items-center group',
                                            theme === 'dark' ? 'border-white/5 hover:bg-white/[0.02]' : 'border-gray-50 hover:bg-gray-50'
                                        )}>
                                            <span className="text-zinc-600 text-xs">{session.trades.length - i}</span>
                                            <span className="text-zinc-400 text-sm">{trade.date}</span>
                                            <span className={clsx('flex items-center gap-1 text-xs font-medium',
                                                trade.side === 'Long' ? 'text-emerald-400' : 'text-rose-400')}>
                                                {trade.side === 'Long' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                                                {trade.side}
                                            </span>
                                            <span className="text-zinc-300 font-mono text-xs">{trade.entryPrice.toFixed(2)}</span>
                                            <span className="text-zinc-300 font-mono text-xs">{trade.exitPrice.toFixed(2)}</span>
                                            <span className="text-zinc-400 text-xs">{trade.quantity}</span>
                                            <span className={clsx('font-semibold text-xs', pos ? 'text-emerald-400' : 'text-rose-400')}>
                                                {pos ? '+' : ''}{fmt(trade.netPL)}
                                            </span>
                                            <span className={clsx('text-xs font-medium',
                                                trade.rMultiple ? trade.rMultiple >= 1 ? 'text-emerald-400' : 'text-amber-400' : 'text-zinc-600')}>
                                                {trade.rMultiple ? `${trade.rMultiple >= 0 ? '+' : ''}${trade.rMultiple}R` : '—'}
                                            </span>
                                            <button onClick={() => deleteTrade(session.id, trade.id)}
                                                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all p-1 rounded">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ─── Chart View ─── */
                <div className="flex-1 flex min-h-0">
                    {/* TradingView chart — takes ~70% width */}
                    <div className="flex-1 min-h-0 bg-[#181B24]">
                        <TradingViewChart symbol={session.symbol} timeframe={session.timeframe} />
                    </div>

                    {/* Right panel — compact trade log */}
                    <div className="w-80 flex-shrink-0 border-l border-white/5 bg-[#1E2130] flex flex-col overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Trade Log</span>
                            <button onClick={() => setShowAddTrade(true)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-[#181B24] text-xs font-semibold hover:bg-emerald-400 transition-all">
                                <Plus className="h-3 w-3" /> Log
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {session.trades.length === 0 ? (
                                <div className="py-12 text-center px-4">
                                    <p className="text-zinc-500 text-sm font-medium">No trades yet</p>
                                    <p className="text-zinc-600 text-xs mt-1">Analyze the chart, then log your trades here</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {[...session.trades].reverse().map((t: BacktestTrade, i: number) => {
                                        const pos = t.netPL >= 0;
                                        return (
                                            <div key={t.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors group">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-zinc-600 text-xs">#{session.trades.length - i}</span>
                                                        <span className={clsx('text-xs font-medium flex items-center gap-0.5',
                                                            t.side === 'Long' ? 'text-emerald-400' : 'text-rose-400')}>
                                                            {t.side === 'Long' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                                                            {t.side}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {t.rMultiple && <span className="text-xs text-zinc-500">{t.rMultiple >= 0 ? '+' : ''}{t.rMultiple}R</span>}
                                                        <span className={clsx('text-xs font-bold', pos ? 'text-emerald-400' : 'text-rose-400')}>
                                                            {pos ? '+' : ''}{fmt(t.netPL)}
                                                        </span>
                                                        <button onClick={() => deleteTrade(session.id, t.id)}
                                                            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all">
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-zinc-600">
                                                    <span>{t.date}</span>
                                                    <span>·</span>
                                                    <span className="font-mono">{t.entryPrice.toFixed(2)} → {t.exitPrice.toFixed(2)}</span>
                                                    <span>·</span>
                                                    <span>{t.quantity} ct</span>
                                                </div>
                                                {t.notes && <p className="text-xs text-zinc-600 mt-1 truncate">{t.notes}</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {/* Running totals */}
                        <div className="px-4 py-3 border-t border-white/5 bg-[#181B24] flex-shrink-0 space-y-1.5">
                            {[
                                { label: 'Total P&L', value: `${pnlPos ? '+' : ''}${fmt(session.totalPnL)}`, color: pnlPos ? 'text-emerald-400' : 'text-rose-400' },
                                { label: 'Win Rate', value: session.totalTrades > 0 ? fmtPct(session.winRate) : '—', color: 'text-zinc-200' },
                                { label: 'Trades', value: `${wins.length}W / ${losses.length}L`, color: 'text-zinc-400' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-600">{label}</span>
                                    <span className={clsx('font-semibold', color)}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

function SessionsTab() {
    const { sessions, deleteSession, completeSession } = useBacktestStore();
    const { theme } = useThemeStore();
    const [showCreate, setShowCreate] = useState(false);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
    const [search, setSearch] = useState('');
    const [openSession, setOpenSession] = useState<BacktestSession | null>(null);

    // Keep openSession in sync with store updates
    const currentOpenSession = useMemo(() =>
        openSession ? sessions.find(s => s.id === openSession.id) || null : null,
        [openSession, sessions]
    );

    const filtered = useMemo(() =>
        sessions.filter(s => {
            if (filter !== 'all' && s.status !== filter) return false;
            if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
                !s.symbol.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        }), [sessions, filter, search]);

    const mostRecent = sessions.find(s => s.status === 'active');

    if (currentOpenSession) {
        return (
            <div className="h-full">
                <SessionDetail session={currentOpenSession} onBack={() => setOpenSession(null)} />
            </div>
        );
    }

    return (
        <div className="p-6">
            {showCreate && <CreateSessionModal onClose={() => setShowCreate(false)} />}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Backtesting Sessions</h1>
                    <p className="text-zinc-500 text-sm mt-1">Track and analyze your strategy performance over historical data</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-[#181B24] font-semibold text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                    <Plus className="h-4 w-4" /> New Session
                </button>
            </div>

            {/* Active session banner */}
            {mostRecent && (
                <div className="mb-6 rounded-xl bg-gradient-to-r from-emerald-500/15 to-blue-500/10 border border-emerald-500/20 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <div>
                            <p className="text-zinc-200 text-sm font-medium">Active: <span className="text-emerald-400">{mostRecent.name}</span></p>
                            <p className="text-zinc-500 text-xs mt-0.5">{mostRecent.symbol} · {mostRecent.totalTrades} trades · {fmt(mostRecent.totalPnL)} P&L</p>
                        </div>
                    </div>
                    <button onClick={() => setOpenSession(mostRecent)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-[#181B24] font-semibold text-sm hover:bg-emerald-400 transition-all">
                        <Play className="h-3.5 w-3.5" /> Continue
                    </button>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-4 mb-4">
                <div className={clsx('flex p-1 rounded-xl gap-1', theme === 'dark' ? 'bg-[#242838]/50' : 'bg-gray-100')}>
                    {(['all', 'active', 'completed'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all',
                                filter === f
                                    ? theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white text-gray-900 shadow-sm'
                                    : theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'
                            )}>{f} ({sessions.filter(s => f === 'all' || s.status === f).length})</button>
                    ))}
                </div>
                <div className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 max-w-xs',
                    theme === 'dark' ? 'bg-[#242838]/50 border-white/10' : 'bg-white border-gray-200')}>
                    <Search className="h-4 w-4 text-zinc-500" />
                    <input className="bg-transparent text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none flex-1"
                        placeholder="Search sessions..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {/* Table */}
            <div className={clsx('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-white/5' : 'border-gray-200')}>
                {/* Header row */}
                <div className={clsx(
                    'grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,1fr,auto] gap-4 px-6 py-3 text-xs font-semibold uppercase tracking-wider border-b',
                    theme === 'dark' ? 'bg-[#181B24] border-white/5 text-zinc-500' : 'bg-gray-50 border-gray-200 text-gray-400'
                )}>
                    <span>Session</span><span>Status</span><span>Start Balance</span>
                    <span>Balance</span><span>P&L</span><span>Win %</span><span>Trades</span><span></span>
                </div>
                <div className={theme === 'dark' ? 'bg-[#181B24]' : 'bg-white'}>
                    {filtered.length === 0 ? (
                        <div className="py-20 text-center">
                            <FlaskConical className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
                            <p className="text-zinc-400 font-semibold text-lg">No sessions yet</p>
                            <p className="text-zinc-600 text-sm mt-1">Create your first backtesting session to get started</p>
                            <button onClick={() => setShowCreate(true)}
                                className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 text-[#181B24] font-semibold text-sm hover:bg-emerald-400 transition-all">
                                Create Session
                            </button>
                        </div>
                    ) : (
                        filtered.map(session => (
                            <SessionRow
                                key={session.id}
                                session={session}
                                onOpen={() => setOpenSession(session)}
                                onDelete={() => deleteSession(session.id)}
                                onComplete={() => completeSession(session.id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab() {
    const { sessions, getStats } = useBacktestStore();
    const stats = getStats();

    const recentSessions = sessions.slice(0, 5);
    const allTrades = sessions.flatMap(s => s.trades);
    const tradesByOutcome = {
        win: allTrades.filter(t => t.outcome === 'win').length,
        loss: allTrades.filter(t => t.outcome === 'loss').length,
        breakeven: allTrades.filter(t => t.outcome === 'breakeven').length,
    };

    // Symbol breakdown
    const symbolMap: Record<string, { pnl: number; trades: number }> = {};
    sessions.forEach(s => {
        if (!symbolMap[s.symbol]) symbolMap[s.symbol] = { pnl: 0, trades: 0 };
        symbolMap[s.symbol].pnl += s.totalPnL;
        symbolMap[s.symbol].trades += s.totalTrades;
    });
    const symbols = Object.entries(symbolMap).sort((a, b) => b[1].pnl - a[1].pnl);

    if (sessions.length === 0) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-96">
                <LayoutDashboard className="h-14 w-14 text-zinc-700 mb-4" />
                <h2 className="text-zinc-300 text-xl font-bold">No Data Yet</h2>
                <p className="text-zinc-600 text-sm mt-2 text-center max-w-xs">
                    Create backtest sessions and log trades to see your performance dashboard
                </p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-zinc-100">Backtest Dashboard</h1>
                <p className="text-zinc-500 text-sm mt-1">Aggregate performance across all your sessions</p>
            </div>

            {/* Top stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="Total P&L" value={fmt(stats.overallPnL)}
                    sub={`${stats.totalSessions} sessions`} icon={DollarSign}
                    color={stats.overallPnL >= 0 ? 'emerald' : 'rose'} />
                <StatCard label="Win Rate" value={fmtPct(stats.overallWinRate)}
                    sub={`${stats.totalTrades} total trades`} icon={Target} color="blue" />
                <StatCard label="Profit Factor" value={stats.totalTrades > 0 ? stats.overallProfitFactor.toFixed(2) : '—'}
                    sub="Win $ / Loss $" icon={BarChart2} color="purple" />
                <StatCard label="Sessions" value={`${stats.activeSessions} active`}
                    sub={`${stats.completedSessions} completed`} icon={Activity} color="amber" />
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Trade outcomes */}
                <div className="bg-[#181B24] border border-white/5 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Trade Outcomes</h3>
                    <div className="space-y-3">
                        {[
                            { label: 'Wins', count: tradesByOutcome.win, color: 'bg-emerald-400', total: stats.totalTrades },
                            { label: 'Losses', count: tradesByOutcome.loss, color: 'bg-rose-400', total: stats.totalTrades },
                            { label: 'Breakeven', count: tradesByOutcome.breakeven, color: 'bg-amber-400', total: stats.totalTrades },
                        ].map(({ label, count, color, total }) => (
                            <div key={label}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-zinc-400">{label}</span>
                                    <span className="text-sm font-medium text-zinc-200">{count} ({total > 0 ? fmtPct(count / total * 100) : '0%'})</span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className={clsx('h-full rounded-full transition-all', color)}
                                        style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Symbol breakdown */}
                <div className="bg-[#181B24] border border-white/5 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">By Symbol</h3>
                    <div className="space-y-2">
                        {symbols.length === 0 ? (
                            <p className="text-zinc-600 text-sm">No symbol data yet</p>
                        ) : symbols.slice(0, 5).map(([sym, data]) => (
                            <div key={sym} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-white/5 px-2 py-0.5 rounded font-mono text-zinc-300">{sym}</span>
                                    <span className="text-xs text-zinc-600">{data.trades} trades</span>
                                </div>
                                <span className={clsx('text-sm font-semibold', data.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                    {data.pnl >= 0 ? '+' : ''}{fmt(data.pnl)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Best session highlight */}
            {stats.bestSession && (
                <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/5 border border-emerald-500/20 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Award className="h-5 w-5 text-emerald-400" />
                        <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Best Session</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-zinc-500">Name</p>
                            <p className="text-zinc-200 font-medium text-sm mt-0.5">{stats.bestSession.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Symbol</p>
                            <p className="text-zinc-200 font-medium text-sm mt-0.5">{stats.bestSession.symbol}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">P&L</p>
                            <p className="text-emerald-400 font-bold text-sm mt-0.5">+{fmt(stats.bestSession.totalPnL)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">Win Rate</p>
                            <p className="text-zinc-200 font-medium text-sm mt-0.5">{fmtPct(stats.bestSession.winRate)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
    const { sessions } = useBacktestStore();
    const allTrades = sessions.flatMap(s => s.trades.map(t => ({ ...t, sessionName: s.name, symbol: s.symbol })));
    const completedSessions = sessions.filter(s => s.status === 'completed');

    if (sessions.length === 0) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-96">
                <FileBarChart className="h-14 w-14 text-zinc-700 mb-4" />
                <h2 className="text-zinc-300 text-xl font-bold">No Reports Yet</h2>
                <p className="text-zinc-600 text-sm mt-2 text-center max-w-xs">
                    Complete backtest sessions to generate performance reports
                </p>
            </div>
        );
    }

    const wins = allTrades.filter(t => t.outcome === 'win');
    const losses = allTrades.filter(t => t.outcome === 'loss');
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.netPL, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.netPL, 0)) / losses.length : 0;
    const rTrades = allTrades.filter(t => t.rMultiple !== undefined);
    const avgR = rTrades.length > 0 ? rTrades.reduce((s, t) => s + (t.rMultiple || 0), 0) / rTrades.length : 0;

    const longsW = wins.filter(t => t.side === 'Long').length;
    const longsL = losses.filter(t => t.side === 'Long').length;
    const shortsW = wins.filter(t => t.side === 'Short').length;
    const shortsL = losses.filter(t => t.side === 'Short').length;

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-zinc-100">Performance Reports</h1>
                <p className="text-zinc-500 text-sm mt-1">Deep analysis across all backtest sessions</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard label="Avg Win" value={fmt(avgWin)} sub={`Over ${wins.length} wins`} icon={TrendingUp} color="emerald" />
                <StatCard label="Avg Loss" value={fmt(avgLoss)} sub={`Over ${losses.length} losses`} icon={TrendingDown} color="rose" />
                <StatCard label="Avg R-Multiple" value={rTrades.length > 0 ? `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R` : '—'}
                    sub={`${rTrades.length} trades with SL`} icon={Zap} color="purple" />
            </div>

            {/* Long vs Short */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-[#181B24] border border-white/5 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Long vs Short</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                                <span className="text-zinc-300 text-sm font-medium">Long</span>
                            </div>
                            <div className="text-right">
                                <p className="text-zinc-200 font-semibold">{longsW + longsL} trades</p>
                                <p className="text-xs text-zinc-500">
                                    {longsW + longsL > 0 ? fmtPct((longsW / (longsW + longsL)) * 100) : '—'} win rate
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ArrowDownLeft className="h-4 w-4 text-rose-400" />
                                <span className="text-zinc-300 text-sm font-medium">Short</span>
                            </div>
                            <div className="text-right">
                                <p className="text-zinc-200 font-semibold">{shortsW + shortsL} trades</p>
                                <p className="text-xs text-zinc-500">
                                    {shortsW + shortsL > 0 ? fmtPct((shortsW / (shortsW + shortsL)) * 100) : '—'} win rate
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sessions summary table */}
                <div className="bg-[#181B24] border border-white/5 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Session Summary</h3>
                    <div className="space-y-2">
                        {sessions.slice(0, 5).map(s => (
                            <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                                <div>
                                    <p className="text-zinc-300 text-xs font-medium">{s.name}</p>
                                    <p className="text-zinc-600 text-xs">{s.totalTrades} trades · {fmtPct(s.winRate)} WR</p>
                                </div>
                                <span className={clsx('text-xs font-semibold', s.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                    {s.totalPnL >= 0 ? '+' : ''}{fmt(s.totalPnL)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/5 border border-purple-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">Key Insights</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-zinc-500 text-xs mb-1">Best Direction</p>
                        <p className="text-zinc-200 font-medium">
                            {longsW / Math.max(longsW + longsL, 1) >= shortsW / Math.max(shortsW + shortsL, 1)
                                ? '📈 Long trades outperform'
                                : '📉 Short trades outperform'}
                        </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-zinc-500 text-xs mb-1">R:R Assessment</p>
                        <p className="text-zinc-200 font-medium">
                            {rTrades.length === 0 ? 'Add stop losses to track R'
                                : avgR >= 2 ? '🔥 Excellent R:R ratio'
                                    : avgR >= 1 ? '✅ Positive R:R ratio'
                                        : '⚠️ R:R needs improvement'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Backtest Component ──────────────────────────────────────────────────

type BacktestTab = 'sessions' | 'dashboard' | 'reports';

const tabs: { id: BacktestTab; label: string; icon: React.ElementType }[] = [
    { id: 'sessions', label: 'Sessions', icon: FlaskConical },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
];

export const Backtest: React.FC = () => {
    const { hydrate } = useBacktestStore();
    const { theme } = useThemeStore();
    const [activeTab, setActiveTab] = useState<BacktestTab>('sessions');

    useEffect(() => { hydrate(); }, []);

    return (
        <div className="h-full flex flex-col" style={{ background: theme === 'dark' ? '#181B24' : '#F8FAFC' }}>
            {/* Sub-navigation */}
            <div className={clsx(
                'border-b sticky top-0 z-10',
                theme === 'dark' ? 'bg-[#1E2130] border-white/5' : 'bg-white border-gray-200'
            )}>
                <div className="flex items-center gap-1 px-6">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all',
                                    activeTab === tab.id
                                        ? 'border-emerald-400 text-emerald-400'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                {activeTab === 'sessions' && <SessionsTab />}
                {activeTab === 'dashboard' && <DashboardTab />}
                {activeTab === 'reports' && <ReportsTab />}
            </div>
        </div>
    );
};
