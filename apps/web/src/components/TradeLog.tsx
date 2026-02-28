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
      const aValue = a[sortField];
      const bValue = b[sortField];
      
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
      className="rounded-xl border border-[#1F2937] hover:border-transparent hover:shadow-lg transition-all duration-200 relative overflow-hidden group"
      style={{
        background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
      }}
    >
      {/* Gradient border on hover */}
      <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#3BF68A]/0 to-[#A78BFA]/0 group-hover:from-[#3BF68A]/50 group-hover:to-[#A78BFA]/50 transition-all duration-200">
        <div 
          className="w-full h-full rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header with Summary Metrics */}
        <div className="p-6 border-b border-[#1F2937]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-[#E5E7EB]">Trade Log</h2>
              {hasImportedData && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-[#3BF68A]/20 text-[#3BF68A] rounded-full text-sm border border-[#3BF68A]/30">
                  <div className="w-2 h-2 bg-[#3BF68A] rounded-full animate-pulse"></div>
                  <span>Live Data</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={refreshData}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 border border-[#1F2937] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 transition-all disabled:opacity-50"
              >
                <RefreshCw className={clsx('h-4 w-4', isLoading && 'animate-spin')} />
                <span>Refresh</span>
              </button>
              <button 
                onClick={exportToCSV}
                className="flex items-center space-x-2 px-4 py-2 border border-[#1F2937] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
              <button
                onClick={handleOpenAddModal}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Add Trade</span>
              </button>
            </div>
          </div>

          {/* Summary Metrics Row */}
          <div className="grid grid-cols-6 gap-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-[#8B94A7] mb-1">Net Cumulative P&L</div>
              <div className={clsx(
                'text-xl font-bold',
                summaryMetrics.totalPnL >= 0 ? 'bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent' : 'text-[#F45B69]'
              )}>
                {formatCurrency(summaryMetrics.totalPnL)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-[#8B94A7] mb-1">Profit Factor</div>
              <div className="text-xl font-bold text-[#E5E7EB]">
                {profitFactor.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-[#8B94A7] mb-1">Win %</div>
              <div className="text-xl font-bold text-[#E5E7EB]">
                {summaryMetrics.winRate.toFixed(1)}%
              </div>
              <div className="flex justify-center mt-1">
                <div className="flex space-x-1 text-xs">
                  <span className="text-[#3BF68A]">{summaryMetrics.winningTrades}W</span>
                  <span className="text-[#F45B69]">{summaryMetrics.losingTrades}L</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-[#8B94A7] mb-1">Avg Win/Loss</div>
              <div className="text-xl font-bold text-[#E5E7EB]">
                {summaryMetrics.avgLoss > 0 ? (summaryMetrics.avgWin / summaryMetrics.avgLoss).toFixed(2) : '0.00'}
              </div>
              <div className="flex justify-center space-x-2 mt-1 text-xs">
                <span className="text-[#3BF68A]">{formatCurrency(summaryMetrics.avgWin)}</span>
                <span className="text-[#F45B69]">-{formatCurrency(summaryMetrics.avgLoss)}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-[#8B94A7] mb-1">Total Trades</div>
              <div className="text-xl font-bold text-[#E5E7EB]">
                {summaryMetrics.totalTrades}
              </div>
              {hasImportedData && (
                <div className="text-xs text-[#3BF68A] mt-1">Imported</div>
              )}
            </div>
            <div className="text-center">
              <div className="text-sm text-[#8B94A7] mb-1">Expectancy</div>
              <div className={clsx(
                'text-xl font-bold',
                summaryMetrics.totalTrades > 0 && summaryMetrics.totalPnL / summaryMetrics.totalTrades >= 0 
                  ? 'text-[#3BF68A]' : 'text-[#F45B69]'
              )}>
                {summaryMetrics.totalTrades > 0 ? formatCurrency(summaryMetrics.totalPnL / summaryMetrics.totalTrades) : '$0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="p-6 border-b border-[#1F2937]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#8B94A7]" />
                <input
                  type="text"
                  placeholder="Search symbols or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-[#1F2937] border border-[#374151] rounded-lg text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-[#3BF68A] transition-all w-64"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'win' | 'loss')}
                  className="appearance-none bg-[#1F2937] border border-[#374151] rounded-lg px-4 py-2 pr-8 text-[#E5E7EB] focus:outline-none focus:border-[#3BF68A] transition-all"
                >
                  <option value="all">All Trades</option>
                  <option value="win">Winning Trades</option>
                  <option value="loss">Losing Trades</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#8B94A7] pointer-events-none" />
              </div>

              {/* Date Range */}
              <button className="flex items-center space-x-2 px-4 py-2 border border-[#374151] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 transition-all">
                <Calendar className="h-4 w-4" />
                <span>Date Range</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              <button className="flex items-center space-x-2 px-4 py-2 border border-[#374151] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 transition-all">
                <Filter className="h-4 w-4" />
                <span>More Filters</span>
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-[#8B94A7]">
                {startIndex + 1}-{Math.min(startIndex + tradesPerPage, filteredTrades.length)} of {filteredTrades.length} trades
              </span>
            </div>
          </div>
        </div>

        {/* Trade Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F2937]">
                <th className="text-left p-4">
                  <input
                    type="checkbox"
                    checked={selectedTrades.length === paginatedTrades.length && paginatedTrades.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-[#374151] bg-[#1F2937] text-[#3BF68A] focus:ring-[#3BF68A]"
                  />
                </th>
                <th className="text-left p-4">
                  <button 
                    onClick={() => handleSort('date')}
                    className="flex items-center space-x-1 text-[#8B94A7] hover:text-[#E5E7EB] text-sm font-medium"
                  >
                    <span>Date</span>
                    {sortField === 'date' && (
                      sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="text-left p-4">
                  <span className="text-[#8B94A7] text-sm font-medium">Time</span>
                </th>
                <th className="text-left p-4">
                  <button 
                    onClick={() => handleSort('symbol')}
                    className="flex items-center space-x-1 text-[#8B94A7] hover:text-[#E5E7EB] text-sm font-medium"
                  >
                    <span>Symbol</span>
                  </button>
                </th>
                <th className="text-center p-4">
                  <span className="text-[#8B94A7] text-sm font-medium">Side</span>
                </th>
                <th className="text-center p-4">
                  <span className="text-[#8B94A7] text-sm font-medium">Status</span>
                </th>
                <th className="text-right p-4">
                  <span className="text-[#8B94A7] text-sm font-medium">Quantity</span>
                </th>
                <th className="text-right p-4">
                  <button 
                    onClick={() => handleSort('netPL')}
                    className="flex items-center space-x-1 text-[#8B94A7] hover:text-[#E5E7EB] text-sm font-medium"
                  >
                    <span>Net P&L</span>
                    {sortField === 'netPL' && (
                      sortDirection === 'asc' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
                <th className="text-center p-4">
                  <span className="text-[#8B94A7] text-sm font-medium">Duration</span>
                </th>
                <th className="text-center p-4">
                  <span className="text-[#8B94A7] text-sm font-medium">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-[#1F2937]/50 hover:bg-gradient-to-r hover:from-[#3BF68A]/5 hover:to-[#A78BFA]/5 transition-all duration-200"
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedTrades.includes(trade.id)}
                      onChange={() => handleSelectTrade(trade.id)}
                      className="rounded border-[#374151] bg-[#1F2937] text-[#3BF68A] focus:ring-[#3BF68A]"
                    />
                  </td>
                  <td className="p-4 text-[#8B94A7] text-sm">
                    {formatDate(trade.date)}
                  </td>
                  <td className="p-4 text-[#8B94A7] text-sm">
                    {trade.time || '--'}
                  </td>
                  <td className="p-4 text-[#E5E7EB] text-sm font-medium">
                    {trade.symbol}
                  </td>
                  <td className="p-4 text-center">
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      trade.side === 'Long' 
                        ? 'bg-[#3BF68A]/20 text-[#3BF68A] border border-[#3BF68A]/30'
                        : 'bg-[#F45B69]/20 text-[#F45B69] border border-[#F45B69]/30'
                    )}>
                      {trade.side || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      trade.outcome === 'win' 
                        ? 'bg-[#3BF68A]/20 text-[#3BF68A] border border-[#3BF68A]/30'
                        : 'bg-[#F45B69]/20 text-[#F45B69] border border-[#F45B69]/30'
                    )}>
                      {trade.outcome.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-right text-[#8B94A7] text-sm">
                    {trade.quantity.toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <span className={clsx(
                      'text-sm font-semibold',
                      trade.netPL >= 0 
                        ? 'text-[#3BF68A]' 
                        : 'text-[#F45B69]'
                    )}>
                      {formatCurrency(trade.netPL)}
                    </span>
                  </td>
                  <td className="p-4 text-center text-[#8B94A7] text-sm">
                    {formatDuration(trade.duration)}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(trade)}
                        className="p-1 text-[#8B94A7] hover:text-[#E5E7EB] transition-colors"
                        title="Edit trade"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(trade.id)}
                        className="p-1 text-[#8B94A7] hover:text-[#F45B69] transition-colors"
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
        <div className="p-6 border-t border-[#1F2937]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-[#8B94A7]">Trades per page:</span>
              <select
                value={tradesPerPage}
                onChange={(e) => {
                  setTradesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#1F2937] border border-[#374151] rounded px-3 py-1 text-[#E5E7EB] text-sm focus:outline-none focus:border-[#3BF68A]"
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
                className="px-3 py-1 border border-[#374151] rounded text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                          ? 'bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium'
                          : 'text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937]'
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
                className="px-3 py-1 border border-[#374151] rounded text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>

            <div className="text-sm text-[#8B94A7]">
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
            className="relative w-full max-w-md mx-4 rounded-2xl border border-[#1F2937] p-6"
            style={{
              background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
            }}
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-full bg-[#F45B69]/20">
                <AlertTriangle className="h-6 w-6 text-[#F45B69]" />
              </div>
              <h3 className="text-lg font-bold text-[#E5E7EB]">Delete Trade</h3>
            </div>
            <p className="text-[#8B94A7] mb-6">
              Are you sure you want to delete this trade? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 rounded-lg bg-[#F45B69] text-white font-medium hover:opacity-90 transition-all"
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