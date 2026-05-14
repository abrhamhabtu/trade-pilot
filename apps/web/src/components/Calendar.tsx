'use client';

import Image from 'next/image';
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Image as ImageIcon, 
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Save,
  Plus,
  Camera,
  Maximize2,
  Target,
  Bold,
  Italic,
  List,
  DollarSign
} from 'lucide-react';
import clsx from 'clsx';
import { Trade, useTradingStore } from '../store/tradingStore';
import { useDailyNotesStore, NoteImage } from '../store/dailyNotesStore';
import { useAccountStore } from '../store/accountStore';

// Predefined trading strategies
const TRADING_STRATEGIES = [
  'Breakout',
  'Breakdown',
  'Trend Following',
  'Mean Reversion',
  'Scalp',
  'Momentum',
  'Range Trade',
  'News Play',
  'Gap Fill',
  'VWAP Bounce',
  'Support/Resistance',
  'Pattern Trade',
  'Reversal',
  'Continuation',
  'Other'
];

interface CalendarData {
  date: string;
  pnl: number;
  trades: number;
}

interface CalendarProps {
  data: CalendarData[];
  trades: Trade[];
  accountId?: string;
}

interface TradePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  trades: Trade[];
  accountId?: string;
}

// Mini equity curve component
const EquityCurve: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const curveData = useMemo(() => {
    if (trades.length === 0) return [];
    
    // Sort trades by time
    const sortedTrades = [...trades].sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
    
    // Calculate cumulative P&L
    let cumulative = 0;
    const points = [{ x: 0, y: 0 }];
    sortedTrades.forEach((trade, index) => {
      cumulative += trade.netPL;
      points.push({ x: index + 1, y: cumulative });
    });
    
    return points;
  }, [trades]);

  if (curveData.length <= 1) return null;

  const maxY = Math.max(...curveData.map(p => p.y), 0);
  const minY = Math.min(...curveData.map(p => p.y), 0);
  const range = maxY - minY || 1;
  const finalValue = curveData[curveData.length - 1]?.y || 0;
  const isPositive = finalValue >= 0;

  // SVG dimensions
  const width = 280;
  const height = 100;
  const padding = 10;

  // Create path
  const pathPoints = curveData.map((point, index) => {
    const x = padding + (index / (curveData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.y - minY) / range) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Create fill path
  const fillPath = pathPoints + ` L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <div className="relative">
      <svg width={width} height={height} className="overflow-visible">
        {/* Zero line */}
        <line
          x1={padding}
          y1={height - padding - ((-minY) / range) * (height - padding * 2)}
          x2={width - padding}
          y2={height - padding - ((-minY) / range) * (height - padding * 2)}
          stroke="#1E2F4A"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
        
        {/* Fill area */}
        <path
          d={fillPath}
          fill={isPositive ? 'url(#greenGradient)' : 'url(#redGradient)'}
          opacity="0.3"
        />
        
        {/* Line */}
        <path
          d={pathPoints}
          fill="none"
          stroke={isPositive ? '#00D68F' : '#FF4868'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Dots */}
        {curveData.map((point, index) => {
          const x = padding + (index / (curveData.length - 1)) * (width - padding * 2);
          const y = height - padding - ((point.y - minY) / range) * (height - padding * 2);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="3"
              fill={point.y >= 0 ? '#00D68F' : '#FF4868'}
              className="opacity-70"
            />
          );
        })}
        
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00D68F" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#00D68F" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF4868" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FF4868" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-zinc-400 -ml-8">
        <span>${Math.round(maxY).toLocaleString()}</span>
        <span>$0</span>
        {minY < 0 && <span>${Math.round(minY).toLocaleString()}</span>}
      </div>
    </div>
  );
};

// Notes Editor Component
interface NotesEditorProps {
  date: string;
  isExpanded: boolean;
  onToggle: () => void;
  accountId?: string;
}

const NotesEditor: React.FC<NotesEditorProps> = ({ date, isExpanded, onToggle, accountId }) => {
  const { getNote, saveNote, addImage, removeImage } = useDailyNotesStore();
  const note = getNote(date, accountId);
  const [content, setContent] = useState(note?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<NoteImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Insert text at cursor position in textarea
  const insertAtCursor = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    setContent(newText);
    
    // Restore cursor position after the inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleBold = () => insertAtCursor('**', '**');
  const handleItalic = () => insertAtCursor('*', '*');
  const handleBullet = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    // Find the start of the current line
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const newText = content.substring(0, lineStart) + '• ' + content.substring(lineStart);
    setContent(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + 2);
    }, 0);
  };

  // Handle Enter key to auto-continue bullet points
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      // Find the start of the current line
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const currentLine = content.substring(lineStart, start);
      
      // Check if current line starts with a bullet
      if (currentLine.startsWith('• ')) {
        e.preventDefault();
        
        // If the line is just a bullet with no content, remove it and don't add new one
        if (currentLine.trim() === '•') {
          const newText = content.substring(0, lineStart) + content.substring(start);
          setContent(newText);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          // Add new line with bullet
          const newText = content.substring(0, start) + '\n• ' + content.substring(start);
          setContent(newText);
          setTimeout(() => {
            textarea.focus();
            const newPos = start + 3; // \n + • + space
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
      }
    }
  };

  // Sync content when note changes
  useEffect(() => {
    if (note?.content !== undefined) {
      setContent(note.content);
    }
  }, [note?.content]);

  const handleSave = useCallback(() => {
    setIsSaving(true);
    saveNote(date, content, accountId);
    setSaveMessage('Saved!');
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage(null);
    }, 1500);
  }, [date, content, saveNote, accountId]);

  // Auto-save on blur
  const handleBlur = () => {
    if (content !== (note?.content || '')) {
      handleSave();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          addImage(date, dataUrl, accountId);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (dataUrl) {
              addImage(date, dataUrl, accountId);
            }
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  };

  const hasContent = content.trim() || (note?.images && note.images.length > 0);

  return (
    <div className="border-t border-white/5">
      {/* Toggle Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#172035]/30 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className={clsx(
            'p-2 rounded-lg',
            hasContent ? 'bg-[#172035]/80' : 'bg-[#172035]'
          )}>
            <FileText className={clsx(
              'h-4 w-4',
              hasContent ? 'text-zinc-400' : 'text-zinc-400'
            )} />
          </div>
          <span className="text-zinc-100 font-medium">Daily Notes</span>
          {hasContent && (
            <span className="text-xs text-zinc-400 bg-[#172035] px-2 py-0.5 rounded">
              {note?.images?.length || 0} images
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {saveMessage && (
            <span className="text-xs text-emerald-500 animate-pulse">{saveMessage}</span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-zinc-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-1 bg-[#0D1628] rounded-lg p-1 border border-white/5">
              <button
                onClick={handleBold}
                className="p-2 rounded hover:bg-[#172035] text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Bold (**text**)"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                onClick={handleItalic}
                className="p-2 rounded hover:bg-[#172035] text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Italic (*text*)"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                onClick={handleBullet}
                className="p-2 rounded hover:bg-[#172035] text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Bullet Point"
              >
                <List className="h-4 w-4" />
              </button>
              <div className="w-px h-6 bg-[#172035] mx-1" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded hover:bg-[#172035] text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Add Image"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded hover:bg-[#172035] text-zinc-400 hover:text-zinc-100 transition-colors"
                title="Add Screenshot"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={clsx(
                'flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                isSaving
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : 'bg-zinc-200 text-white hover:bg-zinc-300'
              )}
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saved!' : 'Save'}</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Editor - Using textarea for reliable text input */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder="Write your thoughts, observations, or lessons from today's trading session...

• Use bullet points for trade notes (auto-continues on Enter)
• **Bold** for emphasis
• *Italic* for observations"
            className={clsx(
              'w-full min-h-[120px] overflow-y-auto p-4 rounded-xl border text-zinc-100 text-sm resize-y',
              'bg-[#0D1628] border-white/5',
              'focus:outline-none focus:ring-2 focus:ring-[#4F9CF9]/50 focus:border-zinc-500',
              'placeholder:text-[#4B5563]'
            )}
            dir="ltr"
            style={{
              minHeight: '120px'
            }}
          />

          {/* Images Grid */}
          {note?.images && note.images.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-400">Screenshots & Charts</span>
                <span className="text-xs text-[#4B5563]">{note.images.length} image{note.images.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {note.images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-video rounded-lg overflow-hidden border border-white/5 bg-[#0D1628] cursor-pointer"
                    onClick={() => setSelectedImage(image)}
                  >
                    <Image
                      src={image.dataUrl}
                      alt="Trade screenshot"
                      className="w-full h-full object-cover"
                      width={320}
                      height={180}
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImage(image);
                        }}
                        className="p-2 rounded-lg bg-[#172035] text-zinc-100 hover:bg-[#2D3748]"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(date, image.id, accountId);
                        }}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Add More Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-video rounded-lg border-2 border-dashed border-white/5 bg-[#0D1628] hover:border-zinc-500 hover:bg-[#172035]/50 transition-all flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-400"
                >
                  <Plus className="h-6 w-6 mb-1" />
                  <span className="text-xs">Add Image</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty state for images */}
          {(!note?.images || note.images.length === 0) && (
            <div className="mt-4 p-6 rounded-xl border-2 border-dashed border-white/5 bg-[#0D1628]/50 text-center">
              <Camera className="h-8 w-8 text-[#4B5563] mx-auto mb-2" />
              <p className="text-sm text-zinc-400 mb-1">Add screenshots or chart images</p>
              <p className="text-xs text-[#4B5563]">Click the image button above or paste directly (Ctrl/Cmd+V)</p>
            </div>
          )}

          {/* Image Lightbox */}
          {selectedImage && (
            <div 
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-8"
              onClick={() => setSelectedImage(null)}
            >
              <div className="relative max-w-5xl max-h-[90vh]">
                <Image
                  src={selectedImage.dataUrl}
                  alt="Trade screenshot"
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  width={1600}
                  height={900}
                  unoptimized
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TradePreviewModal: React.FC<TradePreviewModalProps> = ({ isOpen, onClose, date, trades, accountId }) => {
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [dayStrategy, setDayStrategy] = useState<string>('');
  const [openStrategyDropdown, setOpenStrategyDropdown] = useState<string | null>(null);
  const [showDayStrategyDropdown, setShowDayStrategyDropdown] = useState(false);
  const { hasNote } = useDailyNotesStore();
  const { updateTrade } = useTradingStore();

  // Get the most common strategy for the day (if any)
  const existingDayStrategy = useMemo(() => {
    const strategies = trades.map(t => t.strategy).filter(Boolean);
    if (strategies.length === 0) return '';
    const counts = strategies.reduce((acc, s) => {
      acc[s!] = (acc[s!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }, [trades]);

  // Initialize day strategy from existing trades
  useEffect(() => {
    if (existingDayStrategy && !dayStrategy) {
      setDayStrategy(existingDayStrategy);
    }
  }, [dayStrategy, existingDayStrategy]);

  // Handle setting strategy for a single trade
  const handleSetTradeStrategy = (tradeId: string, strategy: string) => {
    updateTrade(tradeId, { strategy });
    setOpenStrategyDropdown(null);
  };

  // Handle setting strategy for all trades in the day
  const handleSetDayStrategy = (strategy: string) => {
    setDayStrategy(strategy);
    trades.forEach(trade => {
      updateTrade(trade.id, { strategy });
    });
    setShowDayStrategyDropdown(false);
  };
  
  // Calculate all stats - MUST be before early return
  const stats = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winners: 0,
        losers: 0,
        grossPnL: 0,
        totalPnL: 0,
        commissions: 0,
        winRate: 0,
        volume: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0
      };
    }
    
    const winners = trades.filter(t => t.outcome === 'win');
    const losers = trades.filter(t => t.outcome === 'loss');
    
    const grossWins = winners.reduce((sum, t) => sum + t.netPL, 0);
    const grossLosses = Math.abs(losers.reduce((sum, t) => sum + t.netPL, 0));
    const totalPnL = trades.reduce((sum, t) => sum + t.netPL, 0);
    const totalCommissions = trades.reduce((sum, t) => sum + (t.commission || 0), 0);
    const totalVolume = trades.reduce((sum, t) => sum + t.quantity, 0);
    const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? 999 : 0;
    const avgWin = winners.length > 0 ? grossWins / winners.length : 0;
    const avgLoss = losers.length > 0 ? grossLosses / losers.length : 0;
    
    return {
      totalTrades: trades.length,
      winners: winners.length,
      losers: losers.length,
      grossPnL: grossWins,
      totalPnL,
      commissions: totalCommissions,
      winRate,
      volume: totalVolume,
      profitFactor,
      avgWin,
      avgLoss
    };
  }, [trades]);

  const dateHasNote = hasNote(date, accountId);

  // Early return AFTER all hooks
  if (!isOpen) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="rounded-2xl border border-white/5 max-w-6xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, #111F35 0%, #111F35 100%)'
        }}
        onClick={(e) => {
          e.stopPropagation();
          // Close dropdowns when clicking on modal background
          setOpenStrategyDropdown(null);
          setShowDayStrategyDropdown(false);
        }}
      >
        {/* Header Section - Tradezilla Style */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-bold text-zinc-100">
                {formatDate(date)}
              </h2>
              <span className="text-zinc-400">•</span>
              <div className="flex items-center space-x-2">
                <span className="text-zinc-400 text-lg">Net P&L</span>
                <span className={clsx(
                  'text-2xl font-bold',
                  stats.totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'
                )}>
                  {formatCurrency(stats.totalPnL)}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Add Note Button */}
              <button
                onClick={() => setNotesExpanded(!notesExpanded)}
                className={clsx(
                  'flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                  dateHasNote
                    ? 'bg-zinc-200 text-white hover:bg-zinc-300'
                    : 'bg-emerald-500 text-[#0D1628] hover:bg-[#2EE07A]'
                )}
              >
                <FileText className="h-4 w-4" />
                <span>{dateHasNote ? 'View Notes' : 'Add Note'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-[#172035] rounded-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Notes Section - At Top like Tradezilla */}
        <NotesEditor 
          date={date} 
          isExpanded={notesExpanded} 
          onToggle={() => setNotesExpanded(!notesExpanded)}
          accountId={accountId}
        />

        {/* Stats + Chart Row */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-12 gap-6">
            {/* Equity Curve */}
            <div className="col-span-5">
              <div className="bg-[#0D1628] rounded-xl p-4 border border-white/5">
                <div className="ml-8">
                  <EquityCurve trades={trades} />
                </div>
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="col-span-7">
              <div className="grid grid-cols-4 gap-3">
                {/* Total Trades */}
                <div className="bg-[#0D1628] rounded-xl p-3 border border-white/5">
                  <div className="text-zinc-400 text-xs mb-1">Total trades</div>
                  <div className="text-zinc-100 text-xl font-bold">{stats.totalTrades}</div>
                </div>
                
                {/* Winners */}
                <div className="bg-[#0D1628] rounded-xl p-3 border border-white/5">
                  <div className="text-zinc-400 text-xs mb-1">Winners</div>
                  <div className="text-emerald-500 text-xl font-bold">{stats.winners}</div>
                </div>
                
                {/* Gross P&L */}
                <div className="bg-[#0D1628] rounded-xl p-3 border border-white/5">
                  <div className="text-zinc-400 text-xs mb-1">Gross P&L</div>
                  <div className="text-zinc-100 text-xl font-bold">{formatCurrencyShort(stats.grossPnL)}</div>
                </div>
                
                {/* Commissions */}
                <div className="bg-[#0D1628] rounded-xl p-3 border border-white/5">
                  <div className="text-zinc-400 text-xs mb-1">Commissions</div>
                  <div className="text-rose-500 text-xl font-bold">{formatCurrencyShort(stats.commissions)}</div>
                </div>
                
                {/* Win Rate */}
                <div className="bg-[#0D1628] rounded-xl p-3 border border-white/5">
                  <div className="text-zinc-400 text-xs mb-1">Winrate</div>
                  <div className={clsx(
                    'text-xl font-bold',
                    stats.winRate >= 50 ? 'text-emerald-500' : 'text-rose-500'
                  )}>
                    {stats.winRate.toFixed(1)}%
                  </div>
                </div>
                
                {/* Losers */}
                <div className="bg-[#0D1628] rounded-xl p-3 border border-white/5">
                  <div className="text-zinc-400 text-xs mb-1">Losers</div>
                  <div className="text-rose-500 text-xl font-bold">{stats.losers}</div>
                </div>
                
                {/* Volume */}
                <div className="bg-[#0D1628] rounded-xl p-3 border border-white/5">
                  <div className="text-zinc-400 text-xs mb-1">Volume</div>
                  <div className="text-zinc-100 text-xl font-bold">{stats.volume}</div>
                </div>
                
                {/* Profit Factor */}
                <div className="bg-[#0D1628] rounded-xl p-3 border border-white/5">
                  <div className="text-zinc-400 text-xs mb-1">Profit factor</div>
                  <div className={clsx(
                    'text-xl font-bold',
                    stats.profitFactor >= 1 ? 'text-emerald-500' : 'text-rose-500'
                  )}>
                    {stats.profitFactor > 99 ? '∞' : stats.profitFactor.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Day Strategy Selector */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Target className="h-5 w-5 text-zinc-400" />
              <span className="text-zinc-100 font-medium">Day Strategy</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowDayStrategyDropdown(!showDayStrategyDropdown)}
                className={clsx(
                  'flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all min-w-[180px] justify-between',
                  dayStrategy
                    ? 'bg-[#172035] border-zinc-700 text-zinc-400'
                    : 'bg-[#172035] border-white/5 text-zinc-400 hover:border-zinc-500'
                )}
              >
                <span>{dayStrategy || 'Select strategy...'}</span>
                <ChevronDown className={clsx('h-4 w-4 transition-transform', showDayStrategyDropdown && 'rotate-180')} />
              </button>
              
              {showDayStrategyDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0D1628]/80 backdrop-blur-md border border-white/5 rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => handleSetDayStrategy('')}
                    className="w-full px-4 py-2 text-left text-sm text-zinc-400 hover:bg-[#172035] hover:text-zinc-100"
                  >
                    Clear strategy
                  </button>
                  <div className="border-t border-white/5 my-1" />
                  {TRADING_STRATEGIES.map((strategy) => (
                    <button
                      key={strategy}
                      onClick={() => handleSetDayStrategy(strategy)}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm transition-colors',
                        dayStrategy === strategy
                          ? 'bg-[#172035]/80 text-zinc-400'
                          : 'text-zinc-100 hover:bg-[#172035]'
                      )}
                    >
                      {strategy}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-2 ml-8">
            Set a strategy for all {trades.length} trades on this day, or customize each trade below
          </p>
        </div>

        {/* Trades Table Section */}
        <div className="px-6 pb-6">
          <div className="bg-[#0D1628] rounded-xl border border-white/5 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-16 gap-2 px-4 py-3 bg-[#111F35] border-b border-white/5 text-xs text-zinc-400 font-medium">
              <div className="col-span-2">Open time</div>
              <div className="col-span-2">Ticker</div>
              <div className="col-span-1">Side</div>
              <div className="col-span-2">Instrument</div>
              <div className="col-span-2">Net P&L</div>
              <div className="col-span-2">Net ROI</div>
              <div className="col-span-2">R-Multiple</div>
              <div className="col-span-3">Strategy</div>
            </div>
            
            {/* Table Body */}
            <div className="max-h-[40vh] overflow-y-auto">
              {trades.map((trade, index) => {
                // Calculate Net ROI (P&L / Entry Cost)
                const entryCost = trade.entryPrice * trade.quantity;
                const netROI = entryCost > 0 ? (trade.netPL / entryCost) * 100 : 0;
                
                return (
                  <div
                    key={trade.id}
                    className={clsx(
                      'grid grid-cols-16 gap-2 px-4 py-3 items-center transition-all duration-200',
                      index % 2 === 0 ? 'bg-transparent' : 'bg-[#111F35]/50',
                      'hover:bg-[#172035]/30'
                    )}
                  >
                    {/* Time */}
                    <div className="col-span-2 text-zinc-400 text-sm">
                      {trade.time || '—'}
                    </div>
                    
                    {/* Ticker */}
                    <div className="col-span-2 flex items-center space-x-2">
                      <span className="px-2 py-1 rounded-md bg-[#172035] text-zinc-100 text-sm font-medium">
                        {trade.symbol.replace(/\d{4}$/, '').substring(0, 3)}
                      </span>
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-semibold',
                        trade.outcome === 'win'
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : 'bg-rose-500/20 text-rose-500'
                      )}>
                        {trade.outcome === 'win' ? 'WIN' : 'LOSS'}
                      </span>
                    </div>
                    
                    {/* Side */}
                    <div className="col-span-1">
                      <span className={clsx(
                        'text-sm font-medium',
                        trade.side === 'Long' ? 'text-emerald-500' : 'text-rose-500'
                      )}>
                        {trade.side?.toUpperCase() || 'LONG'}
                      </span>
                    </div>
                    
                    {/* Instrument */}
                    <div className="col-span-2 text-zinc-400 text-sm truncate">
                      {trade.symbol}
                    </div>
                    
                    {/* Net P&L */}
                    <div className="col-span-2">
                      <span className={clsx(
                        'text-sm font-bold',
                        trade.netPL >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      )}>
                        {formatCurrency(trade.netPL)}
                      </span>
                    </div>
                    
                    {/* Net ROI */}
                    <div className="col-span-2">
                      <span className={clsx(
                        'text-sm',
                        netROI >= 0 ? 'text-zinc-100' : 'text-zinc-400'
                      )}>
                        {netROI >= 0 ? `${netROI.toFixed(2)}%` : `(${Math.abs(netROI).toFixed(2)}%)`}
                      </span>
                    </div>
                    
                    {/* R-Multiple */}
                    <div className="col-span-2">
                      <span className="text-sm text-zinc-400">
                        {trade.rMultiple ? trade.rMultiple.toFixed(2) : '—'}
                      </span>
                    </div>
                    
                    {/* Strategy - Dropdown */}
                    <div className="col-span-3 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenStrategyDropdown(openStrategyDropdown === trade.id ? null : trade.id);
                        }}
                        className={clsx(
                          'flex items-center space-x-1 px-2 py-1 rounded text-sm transition-all w-full justify-between',
                          trade.strategy
                            ? 'bg-[#172035] text-zinc-400 hover:bg-[#172035]/80'
                            : 'text-zinc-400 hover:bg-[#172035] hover:text-zinc-100'
                        )}
                      >
                        <span className="truncate">{trade.strategy || '— Select —'}</span>
                        <ChevronDown className="h-3 w-3 flex-shrink-0" />
                      </button>
                      
                      {openStrategyDropdown === trade.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-[#0D1628]/80 backdrop-blur-md border border-white/5 rounded-lg shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
                          <button
                            onClick={() => handleSetTradeStrategy(trade.id, '')}
                            className="w-full px-3 py-1.5 text-left text-xs text-zinc-400 hover:bg-[#172035] hover:text-zinc-100"
                          >
                            Clear
                          </button>
                          <div className="border-t border-white/5 my-1" />
                          {TRADING_STRATEGIES.map((strategy) => (
                            <button
                              key={strategy}
                              onClick={() => handleSetTradeStrategy(trade.id, strategy)}
                              className={clsx(
                                'w-full px-3 py-1.5 text-left text-xs transition-colors',
                                trade.strategy === strategy
                                  ? 'bg-[#172035]/80 text-zinc-400'
                                  : 'text-zinc-100 hover:bg-[#172035]'
                              )}
                            >
                              {strategy}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-white/5 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-medium text-zinc-400 bg-[#172035] hover:bg-[#2D3748] transition-colors"
          >
            Cancel
          </button>
          <button
            className="px-6 py-2.5 rounded-lg font-medium text-white bg-zinc-200 hover:bg-zinc-300 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export const Calendar: React.FC<CalendarProps> = ({ data, trades, accountId }) => {
  const { hasNote } = useDailyNotesStore();
  const { accounts, selectedAccountId } = useAccountStore();
  
  // Get adjustments for the current account
  const adjustments = useMemo(() => {
    const currentAccountId = accountId || selectedAccountId;
    if (!currentAccountId) return [];
    const account = accounts.find(a => a.id === currentAccountId);
    return account?.balanceAdjustments || [];
  }, [accounts, accountId, selectedAccountId]);
  
  // Helper to check if a date has an adjustment
  const hasAdjustment = (dateStr: string) => {
    return adjustments.some(adj => adj.date === dateStr);
  };
  
  // Get adjustment for a specific date
  const getAdjustmentForDate = (dateStr: string) => {
    return adjustments.find(adj => adj.date === dateStr);
  };
  
  // Start with the month that has the most recent trade data
  const getInitialDate = () => {
    if (data.length === 0) {
      return new Date(2025, 5, 1); // Default to June 2025
    }
    
    // Find the most recent trade date
    const sortedDates = data
      .map(d => new Date(d.date))
      .sort((a, b) => b.getTime() - a.getTime());
    
    if (sortedDates.length > 0) {
      const mostRecentDate = sortedDates[0];
      return new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), 1);
    }
    
    return new Date(2025, 5, 1); // Fallback to June 2025
  };

  const [currentDate, setCurrentDate] = useState(getInitialDate());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showTradePreview, setShowTradePreview] = useState(false);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const goToCurrentMonth = () => {
    // Go to the month with the most recent data, or June 2025 if no data
    setCurrentDate(getInitialDate());
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Helper function to check if a date is a weekend
  const isWeekend = (day: number) => {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  };
  
  // Helper function to check if a date is in the future
  const isFutureDate = (day: number) => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of today
    return date > today;
  };
  
  // Get day data from the actual data prop passed from App.tsx
  // Also includes any balance adjustments (payouts/deposits) for the day
  const getDayData = (day: number) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const tradeData = data.find(item => item.date === dateString);
    const adjustment = getAdjustmentForDate(dateString);
    
    // If there's an adjustment, add it to the P&L to show net account change (like TopOne)
    if (tradeData && adjustment) {
      return {
        ...tradeData,
        pnl: tradeData.pnl + adjustment.amount // Include adjustment in daily P&L
      };
    }
    
    // If there's only an adjustment (no trades), still show it as day data
    if (!tradeData && adjustment) {
      return {
        date: dateString,
        pnl: adjustment.amount,
        trades: 0
      };
    }
    
    return tradeData;
  };

  // Get trades for a specific date
  const getTradesForDate = (day: number) => {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return trades.filter(trade => trade.date === dateString);
  };
  
  // Calculate realistic win rate for a specific day based on actual trades
  const calculateDayWinRate = (dayData: CalendarData | undefined) => {
    if (!dayData || dayData.trades === 0) return 0;
    
    // Get all trades for this specific date from the trades prop
    const dayTrades = trades.filter(trade => trade.date === dayData.date);
    
    if (dayTrades.length === 0) return 0;
    
    // Calculate actual win rate from the trades
    const winningTrades = dayTrades.filter(trade => trade.outcome === 'win').length;
    const winRate = (winningTrades / dayTrades.length) * 100;
    
    return Math.round(winRate);
  };

  // Handle day click
  const handleDayClick = (day: number) => {
    const dayData = getDayData(day);
    if (dayData && dayData.trades > 0 && !isWeekend(day) && !isFutureDate(day)) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setSelectedDate(dateString);
      setShowTradePreview(true);
    }
  };
  
  // Calculate weekly data (only trading days) - Fixed to handle all months properly
  // Now includes balance adjustments (payouts/deposits) in weekly totals to match TopOne
  const getWeeklyData = () => {
    const weeks = [];
    const totalDaysToShow = Math.ceil((daysInMonth + firstDayOfWeek) / 7) * 7;
    
    for (let weekStart = 0; weekStart < totalDaysToShow; weekStart += 7) {
      const weekDays = [];
      let weekPnl = 0;
      let weekTrades = 0;
      let weekTradingDays = 0;
      
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const dayIndex = weekStart + dayOfWeek;
        
        if (dayIndex < firstDayOfWeek) {
          // Empty cell before month starts
          weekDays.push(null);
        } else {
          const day = dayIndex - firstDayOfWeek + 1;
          if (day <= daysInMonth) {
            weekDays.push(day);
            
            // Calculate week totals (now includes adjustments via getDayData)
            const dayData = getDayData(day);
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayAdjustment = getAdjustmentForDate(dateString);
            
            if (!isWeekend(day) && !isFutureDate(day)) {
              // Include trading P&L
              if (dayData && dayData.trades > 0) {
                weekPnl += dayData.pnl; // This now includes adjustments via getDayData
                weekTrades += dayData.trades;
                weekTradingDays++;
              } else if (dayAdjustment) {
                // Include adjustment even on non-trading days
                weekPnl += dayAdjustment.amount;
              }
            }
          } else {
            // Empty cell after month ends
            weekDays.push(null);
          }
        }
      }
      
      weeks.push({
        days: weekDays,
        pnl: weekPnl,
        trades: weekTrades,
        tradingDays: weekTradingDays
      });
    }
    
    return weeks;
  };
  
  const weeklyData = getWeeklyData();
  
  // Calculate monthly totals from actual data for the current viewing month
  // Includes both trading P&L and balance adjustments (payouts/deposits) to match TopOne
  const monthlyTotal = useMemo(() => {
    // Sum of trading P&L
    const tradingPnL = data.reduce((sum, dayData) => {
      const date = new Date(dayData.date);
      if (date.getFullYear() === year && date.getMonth() === month) {
        return sum + dayData.pnl;
      }
      return sum;
    }, 0);
    
    // Sum of adjustments (payouts, deposits)
    const adjustmentTotal = adjustments.reduce((sum, adj) => {
      const adjDate = new Date(adj.date + 'T12:00:00');
      if (adjDate.getFullYear() === year && adjDate.getMonth() === month) {
        return sum + adj.amount;
      }
      return sum;
    }, 0);
    
    return tradingPnL + adjustmentTotal;
  }, [data, adjustments, year, month]);
  
  const tradingDays = data.filter(dayData => {
    const date = new Date(dayData.date);
    return date.getFullYear() === year && date.getMonth() === month && dayData.trades > 0;
  }).length;

  // Check if current viewing month has any data
  const hasDataForMonth = data.some(dayData => {
    const date = new Date(dayData.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });

  // Get the month name for the "This month" button
  const getCurrentMonthLabel = () => {
    const initialDate = getInitialDate();
    if (year === initialDate.getFullYear() && month === initialDate.getMonth()) {
      return 'Current data';
    }
    return 'This month';
  };

  // Get trades for selected date
  const selectedDateTrades = selectedDate ? getTradesForDate(parseInt(selectedDate.split('-')[2])) : [];
  
  return (
    <div 
      className="rounded-xl border border-white/5 hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
      
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl border border-white/0 group-hover:border-white/10 pointer-events-none transition-colors duration-300">
        <div 
          className="w-full h-full rounded-xl"
          
        />
      </div>
      
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-white/5 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <button
                onClick={previousMonth}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="min-w-[10rem] text-lg font-semibold text-zinc-100 sm:text-xl">
                {monthNames[month]} {year}
              </h3>
              <button
                onClick={nextMonth}
                className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={goToCurrentMonth}
                className={clsx(
                  'px-3 py-1 rounded-full text-sm font-medium border transition-all duration-200',
                  hasDataForMonth
                    ? 'bg-white/10 text-emerald-500 border-emerald-500/30'
                    : 'bg-[#172035] text-zinc-400 border-white/5 hover:bg-white/5 hover:text-zinc-100 hover:border-emerald-500/30'
                )}
              >
                {getCurrentMonthLabel()}
              </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 sm:gap-8 xl:justify-end">
              <div className="text-right">
                <div className="text-sm text-zinc-400 mb-1">Monthly stats:</div>
                <div className="text-2xl font-bold text-zinc-50">
                  {formatCurrency(monthlyTotal)}
                </div>
              </div>
              <div className="text-right">
                {/* Removed the duplicate "11 days" text that was above the highlighted badge */}
                <div className="flex items-center space-x-2">
                  {/* Updated trading days indicator with gradient theme - this is the only one now */}
                  <div className="px-3 py-1 rounded-full bg-white/10 border border-emerald-500/30 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-200"></div>
                    <span className="text-emerald-500 text-sm font-medium">{tradingDays} days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[760px]">
              {/* Week day headers */}
              <div className="mb-4 grid grid-cols-[repeat(7,minmax(84px,1fr))_minmax(96px,1fr)] gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="px-3 py-2 text-center text-sm font-medium text-zinc-400">
                    {day}
                  </div>
                ))}
                <div className="px-3 py-2 text-center text-sm font-medium text-zinc-400">
                  Weekly
                </div>
              </div>

              {/* Calendar weeks */}
              {weeklyData.map((week, weekIndex) => (
                <div key={weekIndex} className="mb-2 grid grid-cols-[repeat(7,minmax(84px,1fr))_minmax(96px,1fr)] gap-2">
                  {/* Days of the week */}
                  {week.days.map((day, dayIndex) => {
                    if (!day) {
                      return <div key={`empty-${weekIndex}-${dayIndex}`} className="h-24 rounded-lg" />;
                    }
                    
                    const dayData = getDayData(day);
                    const today = new Date();
                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                    const isWeekendDay = isWeekend(day);
                    const isFuture = isFutureDate(day);
                    const winRate = calculateDayWinRate(dayData);
                    const hasTradesForDay = dayData && dayData.trades > 0;
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayHasNote = hasNote(dateString, accountId);
                    const dayHasAdjustment = hasAdjustment(dateString);
                    const dayAdjustment = getAdjustmentForDate(dateString);
                    
                    return (
                      <div
                        key={`${weekIndex}-${day}`}
                        className={clsx(
                          'relative h-24 rounded-lg border-2 p-3 transition-all duration-200 group',
                          isToday 
                            ? 'border-blue-500 bg-blue-500/10' 
                            : isFuture
                              ? 'border-white/5 bg-[#172035]/20 opacity-50' // Future dates styling
                              : isWeekendDay
                                ? 'border-white/5 bg-[#172035]/30' // Weekend styling
                                : dayData && dayData.pnl > 0 
                                  ? 'border-emerald-500/30 bg-emerald-500/10' 
                                  : dayData && dayData.pnl < 0 
                                    ? 'border-rose-500/30 bg-rose-500/10'
                                    : 'border-white/5 hover:border-emerald-500/50',
                          !isWeekendDay && !isFuture && 'hover:bg-white/5',
                          hasTradesForDay && !isWeekendDay && !isFuture && 'cursor-pointer'
                        )}
                        onClick={() => handleDayClick(day)}
                      >
                        {/* Top-right indicators container */}
                        <div className="absolute right-1 top-1 flex items-center space-x-1">
                          {/* Adjustment indicator */}
                          {dayHasAdjustment && (
                            <div 
                              className={clsx(
                                "rounded-full p-1",
                                dayAdjustment?.type === 'payout' 
                                  ? "bg-rose-500/30" 
                                  : dayAdjustment?.type === 'deposit'
                                    ? "bg-emerald-500/30"
                                    : "bg-[#1E2F4A]"
                              )}
                              title={`${dayAdjustment?.type}: ${dayAdjustment?.amount && dayAdjustment.amount < 0 ? '-' : '+'}$${Math.abs(dayAdjustment?.amount || 0).toLocaleString()}`}
                            >
                              <DollarSign className={clsx(
                                "h-3 w-3",
                                dayAdjustment?.type === 'payout' 
                                  ? "text-rose-500" 
                                  : dayAdjustment?.type === 'deposit'
                                    ? "text-emerald-500"
                                    : "text-zinc-400"
                              )} />
                            </div>
                          )}
                          
                          {/* Notes indicator */}
                          {dayHasNote && (
                            <div className="rounded-full bg-[#172035]/80 p-1">
                              <FileText className="h-3 w-3 text-zinc-400" />
                            </div>
                          )}
                        </div>
                        
                        <div className={clsx(
                          'mb-1 text-sm font-medium',
                          isFuture ? 'text-zinc-400/50' : isWeekendDay ? 'text-zinc-400' : 'text-zinc-100'
                        )}>
                          {day}
                        </div>
                        
                        {isFuture ? (
                          <div className="space-y-1">
                            {/* Empty space for future dates */}
                          </div>
                        ) : isWeekendDay ? (
                          <div className="space-y-1">
                            <div className="text-xs leading-snug text-zinc-400">Market closed</div>
                          </div>
                        ) : dayData && dayData.trades > 0 ? (
                          <div className="space-y-1">
                            {/* Net P&L (includes adjustments like TopOne shows) */}
                            <div className={clsx(
                              'truncate text-xs font-bold',
                              dayData.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {formatCurrency(dayData.pnl)}
                            </div>
                            <div className="text-xs leading-snug text-zinc-400">
                              {dayData.trades} trade{dayData.trades !== 1 ? 's' : ''}
                            </div>
                            <div className="text-xs leading-snug text-zinc-400">
                              {winRate}% WR
                            </div>
                          </div>
                        ) : dayHasAdjustment && dayAdjustment ? (
                          <div className="space-y-1">
                            <div className={clsx(
                              'truncate text-xs font-bold',
                              dayAdjustment.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {dayAdjustment.type === 'payout' ? 'Payout' : dayAdjustment.type === 'deposit' ? 'Deposit' : 'Adj'}
                            </div>
                            <div className={clsx(
                              'truncate text-xs font-semibold',
                              dayAdjustment.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {dayAdjustment.amount >= 0 ? '+' : ''}{formatCurrency(dayAdjustment.amount)}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs leading-snug text-zinc-400">0 trades</div>
                            <div className="text-xs leading-snug text-zinc-400">0% WR</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Weekly summary - Updated with gradient theme */}
                  <div className="h-24 rounded-lg border border-emerald-500/30 bg-white/5 p-3">
                    <div className="mb-1 text-xs text-zinc-400">Week {weekIndex + 1}</div>
                    <div className={clsx(
                      'mb-1 truncate text-sm font-bold',
                      week.pnl >= 0 ? 'text-zinc-50' : 'text-rose-500'
                    )}>
                      {formatCurrency(week.pnl)}
                    </div>
                    <div className="mb-1 text-xs text-zinc-400">
                      {week.tradingDays} days
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trade Preview Modal */}
      <TradePreviewModal
        isOpen={showTradePreview}
        onClose={() => setShowTradePreview(false)}
        date={selectedDate || ''}
        trades={selectedDateTrades}
        accountId={accountId}
      />
    </div>
  );
};
