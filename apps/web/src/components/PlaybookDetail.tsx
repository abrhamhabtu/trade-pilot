'use client';

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Share2, 
  Star, 
  Edit, 
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  BarChart3,
  Clock,
  Activity,
  Calendar,
  Filter,
  Download
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

interface PlaybookDetailProps {
  playbookId: string;
  onBack: () => void;
}

export const PlaybookDetail: React.FC<PlaybookDetailProps> = ({ playbookId, onBack }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'excluded' | 'missed' | 'backtesting' | 'notes'>('overview');

  // Mock data for VWAP Support & Resistance playbook
  const playbookData = {
    id: '1',
    name: 'VWAP Support & Resistance',
    description: 'Trading bounces off VWAP with volume confirmation and tight risk management',
    category: 'support_resistance',
    isShared: true,
    isFavorite: true,
    
    // Performance metrics
    netPL: 48937.03,
    trades: 40,
    winRate: 70.0,
    profitFactor: 19.67,
    missedTrades: 1,
    expectancy: 1223.43,
    
    // Additional metrics
    rulesFollowed: 100,
    averageWinner: 1841.36,
    averageLoser: -218.41,
    largestProfit: 7539.19,
    largestLoss: -1405.00,
    winnerRMultiple: 2.07,
    loserRMultiple: -0.70,
    totalRMultiple: 0.68,
    
    // Chart data
    cumulativePL: [
      { date: '06/2022', value: 0 },
      { date: '07/2022', value: 2500 },
      { date: '08/2022', value: 4200 },
      { date: '09/2022', value: 3800 },
      { date: '10/2022', value: 6500 },
      { date: '11/2022', value: 8200 },
      { date: '12/2022', value: 12400 },
      { date: '01/2023', value: 15800 },
      { date: '02/2023', value: 18200 },
      { date: '03/2023', value: 22100 },
      { date: '04/2023', value: 28500 },
      { date: '05/2023', value: 35200 },
      { date: '06/2023', value: 42800 },
      { date: '07/2023', value: 48937 }
    ]
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'rules', label: 'Playbook rules' },
    { id: 'excluded', label: 'Excluded trades' },
    { id: 'missed', label: 'Missed trades' },
    { id: 'backtesting', label: 'Backtesting analysis' },
    { id: 'notes', label: 'Notes' }
  ];

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
        {/* Header */}
        <div className="p-6 border-b border-[#1F2937]">
          {/* Breadcrumb and Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="flex items-center space-x-2 text-[#8B94A7] hover:text-[#E5E7EB] transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Playbook</span>
              </button>
              <span className="text-[#8B94A7]">/</span>
              <span className="text-[#8B94A7] text-sm">Supply/...</span>
              <span className="text-[#8B94A7]">/</span>
              <span className="text-[#E5E7EB] text-sm font-medium">Overview</span>
            </div>

            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-4 py-2 border border-[#1F2937] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 transition-all">
                <Share2 className="h-4 w-4" />
                <span className="text-sm">Share</span>
              </button>
            </div>
          </div>

          {/* Playbook Title and Info */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-[#E5E7EB]">{playbookData.name}</h1>
                {playbookData.isFavorite && <Star className="h-5 w-5 text-[#F59E0B] fill-current" />}
                {playbookData.isShared && <Share2 className="h-5 w-5 text-[#3BF68A]" />}
              </div>
              <p className="text-[#8B94A7] text-sm max-w-2xl">{playbookData.description}</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="p-2 text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937] rounded-lg transition-all">
                <Edit className="h-4 w-4" />
              </button>
              <button className="p-2 text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937] rounded-lg transition-all">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'text-sm font-medium pb-3 border-b-2 transition-all duration-200',
                  activeTab === tab.id
                    ? 'text-[#E5E7EB] border-[#3BF68A]'
                    : 'text-[#8B94A7] hover:text-[#E5E7EB] border-transparent'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <>
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-6 gap-6 mb-8">
                {/* Net P&L */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Net P&L</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent">
                    {formatCurrency(playbookData.netPL)}
                  </div>
                </div>

                {/* Trades */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Trades</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#E5E7EB]">
                    {playbookData.trades}
                  </div>
                </div>

                {/* Win Rate */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Win rate %</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#E5E7EB]">
                    {playbookData.winRate.toFixed(0)}%
                  </div>
                </div>

                {/* Profit Factor */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Profit factor</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#E5E7EB]">
                    {playbookData.profitFactor.toFixed(2)}
                  </div>
                </div>

                {/* Missed Trades */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Missed trades</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#E5E7EB]">
                    {playbookData.missedTrades}
                  </div>
                </div>

                {/* Expectancy */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Expectancy</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] bg-clip-text text-transparent">
                    {formatCurrency(playbookData.expectancy)}
                  </div>
                </div>
              </div>

              {/* Secondary Metrics Grid */}
              <div className="grid grid-cols-6 gap-6 mb-8">
                {/* Rules Followed */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Rules followed</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#E5E7EB]">
                    {playbookData.rulesFollowed}%
                  </div>
                </div>

                {/* Average Winner */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Average winner</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#3BF68A]">
                    {formatCurrency(playbookData.averageWinner)}
                  </div>
                </div>

                {/* Average Loser */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Average loser</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#F45B69]">
                    {formatCurrency(playbookData.averageLoser)}
                  </div>
                </div>

                {/* Largest Profit */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Largest profit</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#3BF68A]">
                    {formatCurrency(playbookData.largestProfit)}
                  </div>
                </div>

                {/* Largest Loss */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Largest loss</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#F45B69]">
                    {formatCurrency(playbookData.largestLoss)}
                  </div>
                </div>

                {/* Winner R Multiple */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Winner R Multiple</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#E5E7EB]">
                    {playbookData.winnerRMultiple.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Additional Metrics Row */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Loser R Multiple */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Loser R Multiple</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#E5E7EB]">
                    {playbookData.loserRMultiple.toFixed(2)}
                  </div>
                </div>

                {/* Total R Multiple */}
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 mb-2">
                    <span className="text-[#8B94A7] text-sm font-medium">Total R Multiple</span>
                    <div className="w-3 h-3 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#E5E7EB]">
                    {playbookData.totalRMultiple.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-[#E5E7EB] text-lg font-semibold">Daily net cumulative P&L</h3>
                    <div className="w-4 h-4 rounded-full bg-[#1F2937] flex items-center justify-center cursor-help">
                      <span className="text-[#8B94A7] text-xs">?</span>
                    </div>
                  </div>
                </div>
                
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={playbookData.cumulativePL} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="playbookGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3BF68A" stopOpacity={0.4}/>
                          <stop offset="50%" stopColor="#A78BFA" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3BF68A" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="playbookStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3BF68A" />
                          <stop offset="100%" stopColor="#A78BFA" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#8B94A7', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#8B94A7', fontSize: 12 }}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)',
                          border: '1px solid #3BF68A',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        labelStyle={{ color: '#E5E7EB' }}
                        formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'P&L']}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="url(#playbookStroke)"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#playbookGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* Other tab content placeholders */}
          {activeTab === 'rules' && (
            <div className="text-center py-20">
              <h3 className="text-xl font-bold text-[#E5E7EB] mb-4">Playbook Rules</h3>
              <p className="text-[#8B94A7]">Define your entry, exit, and risk management rules...</p>
            </div>
          )}

          {activeTab === 'excluded' && (
            <div className="text-center py-20">
              <h3 className="text-xl font-bold text-[#E5E7EB] mb-4">Excluded Trades</h3>
              <p className="text-[#8B94A7]">Trades that didn't follow the playbook rules...</p>
            </div>
          )}

          {activeTab === 'missed' && (
            <div className="text-center py-20">
              <h3 className="text-xl font-bold text-[#E5E7EB] mb-4">Missed Trades</h3>
              <p className="text-[#8B94A7]">Opportunities that matched your criteria but weren't taken...</p>
            </div>
          )}

          {activeTab === 'backtesting' && (
            <div className="text-center py-20">
              <h3 className="text-xl font-bold text-[#E5E7EB] mb-4">Backtesting Analysis</h3>
              <p className="text-[#8B94A7]">Historical performance analysis and optimization...</p>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="text-center py-20">
              <h3 className="text-xl font-bold text-[#E5E7EB] mb-4">Notes</h3>
              <p className="text-[#8B94A7]">Your observations and insights about this strategy...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
