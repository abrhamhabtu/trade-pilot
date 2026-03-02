'use client';

import React, { useState, useEffect } from 'react';
import {
  Filter,
  Download,
  Plus,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  ChevronDown,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Trade, useTradingStore } from '../store/tradingStore';
import { TradeFormModal } from './common/TradeFormModal';
import clsx from 'clsx';

interface TradeLogProps {
  trades: Trade[];
}

export const TradeLog: React.FC<TradeLogProps> = ({ trades }) => {
  // Get action functions from store (these still work but will need refactoring for account-based actions)
  const {
    hasImportedData,
    isLoading,
    refreshData,
    addTrade,
    updateTrade,
    deleteTrade,
    deleteTrades
  } = useTradingStore();

  // Use trades prop directly - these are already filtered by account in App.tsx

  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [sortField, setSortField] = useState<keyof Trade>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'win' | 'loss'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [tradesPerPage, setTradesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState<string | null>(null);

  // Reset pagination when trades change (e.g., after import)
  useEffect(() => {
    setCurrentPage(1);
    setSelectedTrades([]);
  }, [trades.length]);

  // Filter and sort trades
  const filteredTrades = trades
    .filter(trade => {
      const matchesStatus = filterStatus === 'all' || trade.outcome === filterStatus;
      const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (trade.notes && trade.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      const aRaw = a[sortField];
      const bRaw = b[sortField];
      const aValue = aRaw ?? (typeof aRaw === 'number' ? 0 : '');
      const bValue = bRaw ?? (typeof bRaw === 'number' ? 0 : '');

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredTrades.length / tradesPerPage);
  const startIndex = (currentPage - 1) * tradesPerPage;
  const paginatedTrades = filteredTrades.slice(startIndex, startIndex + tradesPerPage);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const handleSort = (field: keyof Trade) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSelectTrade = (tradeId: string) => {
    setSelectedTrades(prev =>
      prev.includes(tradeId)
        ? prev.filter(id => id !== tradeId)
        : [...prev, tradeId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTrades.length === paginatedTrades.length) {
      setSelectedTrades([]);
    } else {
      setSelectedTrades(paginatedTrades.map(trade => trade.id));
    }
  };

  // Calculate summary metrics for filtered trades
  const summaryMetrics = {
    totalTrades: filteredTrades.length,
    winningTrades: filteredTrades.filter(t => t.outcome === 'win').length,
    losingTrades: filteredTrades.filter(t => t.outcome === 'loss').length,
    totalPnL: filteredTrades.reduce((sum, t) => sum + t.netPL, 0),
    winRate: filteredTrades.length > 0 ? (filteredTrades.filter(t => t.outcome === 'win').length / filteredTrades.length) * 100 : 0,
    avgWin: filteredTrades.filter(t => t.outcome === 'win').reduce((sum, t, _, arr) => sum + t.netPL / arr.length, 0),
    avgLoss: Math.abs(filteredTrades.filter(t => t.outcome === 'loss').reduce((sum, t, _, arr) => sum + t.netPL / arr.length, 0)),
  };

  const profitFactor = summaryMetrics.avgLoss > 0 ?
    (summaryMetrics.winningTrades * summaryMetrics.avgWin) / (summaryMetrics.losingTrades * summaryMetrics.avgLoss) : 0;

  // Export filtered trades to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'Symbol', 'Side', 'Entry Price', 'Exit Price', 'Quantity', 'Net P&L', 'Duration (min)', 'Outcome', 'Notes'];
    const csvData = [
      headers,
      ...filteredTrades.map(trade => [
        trade.date,
        trade.time || '',
        trade.symbol,
        trade.side || '',
        trade.entryPrice.toString(),
        trade.exitPrice.toString(),
        trade.quantity.toString(),
        trade.netPL.toString(),
        trade.duration.toString(),
        trade.outcome,
        trade.notes || ''
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle add/edit trade
  const handleOpenAddModal = () => {
    setEditingTrade(null);
    setShowTradeModal(true);
  };

  const handleOpenEditModal = (trade: Trade) => {
    setEditingTrade(trade);
    setShowTradeModal(true);
  };

  const handleCloseModal = () => {
    setShowTradeModal(false);
    setEditingTrade(null);
  };

  const handleSubmitTrade = (tradeData: Omit<Trade, 'id'>) => {
    if (editingTrade) {
      updateTrade(editingTrade.id, tradeData);
    } else {
      addTrade(tradeData);
    }
    handleCloseModal();
  };

  // Handle delete
  const handleDeleteClick = (tradeId: string) => {
    setTradeToDelete(tradeId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (tradeToDelete) {
      deleteTrade(tradeToDelete);
      setTradeToDelete(null);
    }
    setShowDeleteConfirm(false);
  };

  const handleDeleteSelected = () => {
    if (selectedTrades.length > 0) {
      deleteTrades(selectedTrades);
      setSelectedTrades([]);
    }
  };

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
        {/* Header with Summary Metrics */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-zinc-100">Trade Log</h2>
              {hasImportedData && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500/20 text-emerald-500 rounded-full text-sm border border-emerald-500/30">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span>Live Data</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 border border-white/5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 transition-all disabled:opacity-50"
              >
                <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
                <span>Refresh</span>
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center space-x-2 px-4 py-2 border border-white/5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
              <button
                onClick={handleOpenAddModal}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Add Trade</span>
              </button>
            </div>
          </div>

          {/* Summary Metrics Row */}
          <div className="grid grid-cols-6 gap-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-zinc-400 mb-1">Net Cumulative P&L</div>
              <div className={clsx(
                'text-xl font-bold',
                summaryMetrics.totalPnL >= 0 ? 'text-zinc-50' : 'text-rose-500'
              )}>
                {formatCurrency(summaryMetrics.totalPnL)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-zinc-400 mb-1">Profit Factor</div>
              <div className="text-xl font-bold text-zinc-100">
                {profitFactor.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-zinc-400 mb-1">Win %</div>
              <div className="text-xl font-bold text-zinc-100">
                {summaryMetrics.winRate.toFixed(1)}%
              </div>
              <div className="flex justify-center mt-1">
                <div className="flex space-x-1 text-xs">
                  <span className="text-emerald-500">{summaryMetrics.winningTrades}W</span>
                  <span className="text-rose-500">{summaryMetrics.losingTrades}L</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-zinc-400 mb-1">Avg Win/Loss</div>
              <div className="text-xl font-bold text-zinc-100">
                {summaryMetrics.avgLoss > 0 ? (summaryMetrics.avgWin / summaryMetrics.avgLoss).toFixed(2) : '0.00'}
              </div>
              <div className="flex justify-center space-x-2 mt-1 text-xs">
                <span className="text-emerald-500">{formatCurrency(summaryMetrics.avgWin)}</span>
                <span className="text-rose-500">-{formatCurrency(summaryMetrics.avgLoss)}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-zinc-400 mb-1">Total Trades</div>
              <div className="text-xl font-bold text-zinc-100">
                {summaryMetrics.totalTrades}
              </div>
              {hasImportedData && (
                <div className="text-xs text-emerald-500 mt-1">Imported</div>
              )}
            </div>
            <div className="text-center">
              <div className="text-sm text-zinc-400 mb-1">Expectancy</div>
              <div className={clsx(
                'text-xl font-bold',
                summaryMetrics.totalTrades > 0 && summaryMetrics.totalPnL / summaryMetrics.totalTrades >= 0
                  ? 'text-emerald-500' : 'text-rose-500'
              )}>
                {summaryMetrics.totalTrades > 0 ? formatCurrency(summaryMetrics.totalPnL / summaryMetrics.totalTrades) : '$0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search symbols or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-[#242838] border border-white/10 rounded-lg text-zinc-100 placeholder-[#8B94A7] focus:outline-none focus:border-emerald-500/30 transition-all w-64"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'win' | 'loss')}
                  className="appearance-none bg-[#242838] border border-white/10 rounded-lg px-4 py-2 pr-8 text-zinc-100 focus:outline-none focus:border-emerald-500/30 transition-all"
                >
                  <option value="all">All Trades</option>
                  <option value="win">Winning Trades</option>
                  <option value="loss">Losing Trades</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>

              {/* Date Range */}
              <button className="flex items-center space-x-2 px-4 py-2 border border-white/10 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 transition-all">
                <Calendar className="h-4 w-4" />
                <span>Date Range</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              <button className="flex items-center space-x-2 px-4 py-2 border border-white/10 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 transition-all">
                <Filter className="h-4 w-4" />
                <span>More Filters</span>
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-400">
                {startIndex + 1}-{Math.min(startIndex + tradesPerPage, filteredTrades.length)} of {filteredTrades.length} trades
              </span>
            </div>
          </div>
        </div>

        {/* Trade Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4">
                  <input
                    type="checkbox"
                    checked={selectedTrades.length === paginatedTrades.length && paginatedTrades.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-white/10 bg-[#242838] text-emerald-500 focus:ring-[#3BF68A]"
                  />
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center space-x-1 text-zinc-400 hover:text-zinc-100 text-sm font-medium"
                  >
                    <span>Date</span>
                    {sortField === 'date' && (
                      sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="text-left p-4">
                  <span className="text-zinc-400 text-sm font-medium">Time</span>
                </th>
                <th className="text-left p-4">
                  <button
                    onClick={() => handleSort('symbol')}
                    className="flex items-center space-x-1 text-zinc-400 hover:text-zinc-100 text-sm font-medium"
                  >
                    <span>Symbol</span>
                  </button>
                </th>
                <th className="text-center p-4">
                  <span className="text-zinc-400 text-sm font-medium">Side</span>
                </th>
                <th className="text-center p-4">
                  <span className="text-zinc-400 text-sm font-medium">Status</span>
                </th>
                <th className="text-right p-4">
                  <span className="text-zinc-400 text-sm font-medium">Quantity</span>
                </th>
                <th className="text-right p-4">
                  <button
                    onClick={() => handleSort('netPL')}
                    className="flex items-center space-x-1 text-zinc-400 hover:text-zinc-100 text-sm font-medium"
                  >
                    <span>Net P&L</span>
                    {sortField === 'netPL' && (
                      sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4">
                  <span className="text-zinc-400 text-sm font-medium">Duration</span>
                </th>
                <th className="text-center p-4">
                  <span className="text-zinc-400 text-sm font-medium">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-white/5/50 hover:bg-gradient-to-r hover:from-[#3BF68A]/5 hover:to-[#A78BFA]/5 transition-all duration-200"
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedTrades.includes(trade.id)}
                      onChange={() => handleSelectTrade(trade.id)}
                      className="rounded border-white/10 bg-[#242838] text-emerald-500 focus:ring-[#3BF68A]"
                    />
                  </td>
                  <td className="p-4 text-zinc-400 text-sm">
                    {formatDate(trade.date)}
                  </td>
                  <td className="p-4 text-zinc-400 text-sm">
                    {trade.time || '--'}
                  </td>
                  <td className="p-4 text-zinc-100 text-sm font-medium">
                    {trade.symbol}
                  </td>
                  <td className="p-4 text-center">
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      trade.side === 'Long'
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-500 border border-rose-500/30/30'
                    )}>
                      {trade.side || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      trade.outcome === 'win'
                        ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-500 border border-rose-500/30/30'
                    )}>
                      {trade.outcome.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-right text-zinc-400 text-sm">
                    {trade.quantity.toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <span className={clsx(
                      'text-sm font-semibold',
                      trade.netPL >= 0
                        ? 'text-emerald-500'
                        : 'text-rose-500'
                    )}>
                      {formatCurrency(trade.netPL)}
                    </span>
                  </td>
                  <td className="p-4 text-center text-zinc-400 text-sm">
                    {formatDuration(trade.duration)}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(trade)}
                        className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
                        title="Edit trade"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(trade.id)}
                        className="p-1 text-zinc-400 hover:text-rose-500 transition-colors"
                        title="Delete trade"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-6 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-zinc-400">Trades per page:</span>
              <select
                value={tradesPerPage}
                onChange={(e) => {
                  setTradesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#242838] border border-white/10 rounded px-3 py-1 text-zinc-100 text-sm focus:outline-none focus:border-emerald-500/30"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-white/10 rounded text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={clsx(
                        'px-3 py-1 rounded text-sm transition-all',
                        currentPage === page
                          ? 'bg-white text-zinc-950 hover:bg-zinc-200 font-medium'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#242838]'
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-white/10 rounded text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>

            <div className="text-sm text-zinc-400">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        </div>
      </div>

      {/* Trade Form Modal */}
      <TradeFormModal
        isOpen={showTradeModal}
        onClose={handleCloseModal}
        onSubmit={handleSubmitTrade}
        trade={editingTrade}
        mode={editingTrade ? 'edit' : 'add'}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div
            className="relative w-full max-w-md mx-4 rounded-2xl border border-white/5 p-6"
            
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-full bg-rose-500/20">
                <AlertTriangle className="h-6 w-6 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Delete Trade</h3>
            </div>
            <p className="text-zinc-400 mb-6">
              Are you sure you want to delete this trade? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-white/5 text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/30 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-lg bg-rose-500 text-white font-medium hover:opacity-90 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};