import React, { useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useTradingStore } from '../store/tradingStore';

export const ImportTrades: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importTrades, isLoading } = useTradingStore();
  
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      await importTrades(file);
      // Show success message or notification
      console.log('Trades imported successfully');
    } catch (error) {
      console.error('Error importing trades:', error);
      // Show error message or notification
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="bg-[#15181F] rounded-xl p-6 border border-[#1F2937] hover:border-[#3BF68A]/20 transition-all duration-200">
      <div className="text-center">
        <div className="mb-4">
          <div className="mx-auto w-12 h-12 bg-[#3BF68A]/10 rounded-full flex items-center justify-center">
            <Upload className="h-6 w-6 text-[#3BF68A]" />
          </div>
        </div>
        
        <h3 className="text-[#E5E7EB] text-lg font-semibold mb-2">
          Import Trades from TradingView
        </h3>
        
        <p className="text-[#8B94A7] text-sm mb-6">
          Upload your CSV or Excel file to automatically sync your trading data
        </p>
        
        <button
          onClick={handleFileSelect}
          disabled={isLoading}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent mr-2" />
              Processing...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Choose File
            </>
          )}
        </button>
        
        <div className="mt-4 text-xs text-[#8B94A7]">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <AlertCircle className="h-3 w-3" />
            <span>Supported formats: CSV, XLSX</span>
          </div>
          <div>
            Required columns: Date, Symbol, Entry Price, Exit Price, Net P&L
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};