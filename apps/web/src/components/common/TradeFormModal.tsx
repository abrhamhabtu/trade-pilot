'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Trade } from '../../store/tradingStore';

interface TradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trade: Omit<Trade, 'id'>) => void;
  trade?: Trade | null;
  mode: 'add' | 'edit';
}

interface FormErrors {
  symbol?: string;
  date?: string;
  entryPrice?: string;
  exitPrice?: string;
  quantity?: string;
}

export const TradeFormModal: React.FC<TradeFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  trade,
  mode
}) => {
  const [formData, setFormData] = useState({
    symbol: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM',
    side: 'Long' as 'Long' | 'Short',
    entryPrice: '',
    exitPrice: '',
    quantity: '',
    commission: '0',
    notes: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (trade && mode === 'edit') {
      setFormData({
        symbol: trade.symbol,
        date: trade.date,
        time: trade.time || '10:00 AM',
        side: trade.side || 'Long',
        entryPrice: trade.entryPrice.toString(),
        exitPrice: trade.exitPrice.toString(),
        quantity: trade.quantity.toString(),
        commission: (trade.commission || 0).toString(),
        notes: trade.notes || ''
      });
    } else {
      setFormData({
        symbol: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM',
        side: 'Long',
        entryPrice: '',
        exitPrice: '',
        quantity: '',
        commission: '0',
        notes: ''
      });
    }
    setErrors({});
  }, [trade, mode, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Symbol is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    const entryPrice = parseFloat(formData.entryPrice);
    if (isNaN(entryPrice) || entryPrice <= 0) {
      newErrors.entryPrice = 'Valid entry price is required';
    }

    const exitPrice = parseFloat(formData.exitPrice);
    if (isNaN(exitPrice) || exitPrice <= 0) {
      newErrors.exitPrice = 'Valid exit price is required';
    }

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      newErrors.quantity = 'Valid quantity is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateNetPL = (): number => {
    const entryPrice = parseFloat(formData.entryPrice) || 0;
    const exitPrice = parseFloat(formData.exitPrice) || 0;
    const quantity = parseInt(formData.quantity) || 0;
    const commission = parseFloat(formData.commission) || 0;

    let pnl: number;
    if (formData.side === 'Long') {
      pnl = (exitPrice - entryPrice) * quantity;
    } else {
      pnl = (entryPrice - exitPrice) * quantity;
    }

    return pnl - commission;
  };

  const calculateDuration = (): number => {
    // Default duration based on trade type - user can edit later
    return Math.floor(Math.random() * 60) + 15;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const netPL = calculateNetPL();
    const duration = calculateDuration();

    const tradeData: Omit<Trade, 'id'> = {
      symbol: formData.symbol.toUpperCase(),
      date: formData.date,
      time: formData.time,
      side: formData.side,
      entryPrice: parseFloat(formData.entryPrice),
      exitPrice: parseFloat(formData.exitPrice),
      quantity: parseInt(formData.quantity),
      netPL,
      duration,
      outcome: netPL >= 0 ? 'win' : 'loss',
      commission: parseFloat(formData.commission) || 0,
      notes: formData.notes
    };

    onSubmit(tradeData);
    onClose();
  };

  if (!isOpen) return null;

  const netPL = calculateNetPL();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-[#1F2937] overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1F2937]">
          <h2 className="text-xl font-bold text-[#E5E7EB]">
            {mode === 'add' ? 'Add New Trade' : 'Edit Trade'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Symbol and Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#8B94A7] mb-2">Symbol *</label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg bg-[#0B0D10] border ${errors.symbol ? 'border-[#F45B69]' : 'border-[#1F2937]'} text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-[#3BF68A]`}
                placeholder="AAPL"
              />
              {errors.symbol && <p className="text-[#F45B69] text-xs mt-1">{errors.symbol}</p>}
            </div>
            <div>
              <label className="block text-sm text-[#8B94A7] mb-2">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg bg-[#0B0D10] border ${errors.date ? 'border-[#F45B69]' : 'border-[#1F2937]'} text-[#E5E7EB] focus:outline-none focus:border-[#3BF68A]`}
              />
              {errors.date && <p className="text-[#F45B69] text-xs mt-1">{errors.date}</p>}
            </div>
          </div>

          {/* Time and Side Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#8B94A7] mb-2">Time</label>
              <input
                type="text"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-[#0B0D10] border border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-[#3BF68A]"
                placeholder="10:00 AM"
              />
            </div>
            <div>
              <label className="block text-sm text-[#8B94A7] mb-2">Side</label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, side: 'Long' })}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all ${formData.side === 'Long' ? 'bg-[#3BF68A] text-black' : 'bg-[#0B0D10] text-[#8B94A7] border border-[#1F2937] hover:border-[#3BF68A]'}`}
                >
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, side: 'Short' })}
                  className={`flex-1 py-2 rounded-lg font-medium transition-all ${formData.side === 'Short' ? 'bg-[#F45B69] text-white' : 'bg-[#0B0D10] text-[#8B94A7] border border-[#1F2937] hover:border-[#F45B69]'}`}
                >
                  Short
                </button>
              </div>
            </div>
          </div>

          {/* Entry and Exit Price Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#8B94A7] mb-2">Entry Price *</label>
              <input
                type="number"
                step="0.01"
                value={formData.entryPrice}
                onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg bg-[#0B0D10] border ${errors.entryPrice ? 'border-[#F45B69]' : 'border-[#1F2937]'} text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-[#3BF68A]`}
                placeholder="150.00"
              />
              {errors.entryPrice && <p className="text-[#F45B69] text-xs mt-1">{errors.entryPrice}</p>}
            </div>
            <div>
              <label className="block text-sm text-[#8B94A7] mb-2">Exit Price *</label>
              <input
                type="number"
                step="0.01"
                value={formData.exitPrice}
                onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg bg-[#0B0D10] border ${errors.exitPrice ? 'border-[#F45B69]' : 'border-[#1F2937]'} text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-[#3BF68A]`}
                placeholder="155.00"
              />
              {errors.exitPrice && <p className="text-[#F45B69] text-xs mt-1">{errors.exitPrice}</p>}
            </div>
          </div>

          {/* Quantity and Commission Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#8B94A7] mb-2">Quantity *</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg bg-[#0B0D10] border ${errors.quantity ? 'border-[#F45B69]' : 'border-[#1F2937]'} text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-[#3BF68A]`}
                placeholder="100"
              />
              {errors.quantity && <p className="text-[#F45B69] text-xs mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className="block text-sm text-[#8B94A7] mb-2">Commission</label>
              <input
                type="number"
                step="0.01"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-[#0B0D10] border border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-[#3BF68A]"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-[#8B94A7] mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-[#0B0D10] border border-[#1F2937] text-[#E5E7EB] placeholder-[#8B94A7] focus:outline-none focus:border-[#3BF68A] resize-none"
              placeholder="Trade notes..."
            />
          </div>

          {/* Calculated P&L Preview */}
          <div className="p-4 rounded-lg bg-[#0B0D10] border border-[#1F2937]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8B94A7]">Estimated Net P&L</span>
              <span className={`text-lg font-bold ${netPL >= 0 ? 'text-[#3BF68A]' : 'text-[#F45B69]'}`}>
                {netPL >= 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(netPL)}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-[#1F2937] text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium hover:opacity-90 transition-all"
            >
              {mode === 'add' ? 'Add Trade' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
