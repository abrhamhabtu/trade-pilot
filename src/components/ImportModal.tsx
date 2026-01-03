import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, X, CheckCircle, Download, Info } from 'lucide-react';
import { useTradingStore } from '../store/tradingStore';
import clsx from 'clsx';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importTrades, isLoading } = useTradingStore();
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importResults, setImportResults] = useState<{
    totalRows: number;
    successfulImports: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileImport(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileImport(file);
    }
  };

  const handleFileImport = async (file: File) => {
    setImportStatus('processing');
    setImportResults(null);

    try {
      const result = await importTrades(file);
      setImportStatus('success');
      setImportResults(result);
    } catch (error) {
      console.error('Error importing trades:', error);
      setImportStatus('error');
      setImportResults({
        totalRows: 0,
        successfulImports: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSampleFile = () => {
    const sampleData = [
      ['Date', 'Time', 'Symbol', 'Side', 'Quantity', 'Entry Price', 'Exit Price', 'Net P&L', 'Commission', 'Duration (min)', 'Notes'],
      ['2025-06-20', '10:30 AM', 'AAPL', 'Long', '100', '150.25', '152.80', '255.00', '2.00', '45', 'VWAP bounce'],
      ['2025-06-20', '2:15 PM', 'MSFT', 'Short', '50', '420.50', '418.20', '115.00', '1.50', '30', 'Resistance rejection'],
      ['2025-06-19', '11:45 AM', 'TSLA', 'Long', '25', '185.60', '183.40', '-55.00', '1.25', '25', 'Stop loss hit']
    ];

    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_trades.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setImportStatus('idle');
    setImportResults(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-xl border border-[#1F2937] max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        style={{
          background: 'linear-gradient(135deg, #15181F 0%, #1A1D25 100%)'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#1F2937] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#E5E7EB] mb-2">Import Trades from TradingView</h2>
            <p className="text-[#8B94A7] text-sm">Upload your account history to sync trading data</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8B94A7] hover:text-[#E5E7EB] hover:bg-[#1F2937] rounded-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {importStatus === 'idle' && (
            <>
              {/* File Upload Area */}
              <div
                className={clsx(
                  'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer',
                  dragActive 
                    ? 'border-[#3BF68A] bg-[#3BF68A]/5' 
                    : 'border-[#1F2937] hover:border-[#3BF68A]/50 hover:bg-[#3BF68A]/5'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleFileSelect}
              >
                <div className="mx-auto w-16 h-16 bg-[#3BF68A]/10 rounded-full flex items-center justify-center mb-4">
                  <Upload className="h-8 w-8 text-[#3BF68A]" />
                </div>
                
                <h3 className="text-[#E5E7EB] text-lg font-semibold mb-2">
                  Drop your file here or click to browse
                </h3>
                
                <p className="text-[#8B94A7] text-sm mb-4">
                  Upload CSV or Excel files from TradingView, MetaTrader, or other platforms
                </p>
                
                <button
                  type="button"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 transition-all duration-200"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Choose File
                </button>
              </div>

              {/* File Requirements */}
              <div className="mt-6 p-4 bg-[#1F2937]/50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-[#3BF68A] mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-[#E5E7EB] font-medium mb-2">File Requirements</h4>
                    <ul className="text-[#8B94A7] text-sm space-y-1">
                      <li>• <strong>Supported formats:</strong> CSV, XLSX, XLS</li>
                      <li>• <strong>Required columns:</strong> Date, Symbol, Entry Price, Exit Price, Net P&L</li>
                      <li>• <strong>Optional columns:</strong> Time, Side, Quantity, Commission, Duration, Notes</li>
                      <li>• <strong>Date format:</strong> YYYY-MM-DD, MM/DD/YYYY, or DD/MM/YYYY</li>
                      <li>• <strong>Max file size:</strong> 10MB</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Sample File Download */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[#8B94A7] text-sm">Need help formatting your data?</span>
                <button
                  onClick={downloadSampleFile}
                  className="flex items-center space-x-2 px-4 py-2 border border-[#1F2937] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 transition-all text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Sample CSV</span>
                </button>
              </div>
            </>
          )}

          {importStatus === 'processing' && (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-[#3BF68A]/10 rounded-full flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#3BF68A] border-t-transparent" />
              </div>
              <h3 className="text-[#E5E7EB] text-lg font-semibold mb-2">Processing your trades...</h3>
              <p className="text-[#8B94A7] text-sm">This may take a few moments depending on file size</p>
            </div>
          )}

          {importStatus === 'success' && importResults && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-[#3BF68A]/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-[#3BF68A]" />
              </div>
              <h3 className="text-[#E5E7EB] text-lg font-semibold mb-2">Import Successful!</h3>
              <p className="text-[#8B94A7] text-sm mb-6">Your trades have been imported and processed</p>
              
              <div className="bg-[#1F2937]/50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#8B94A7]">Total Rows:</span>
                    <span className="text-[#E5E7EB] ml-2 font-medium">{importResults.totalRows}</span>
                  </div>
                  <div>
                    <span className="text-[#8B94A7]">Successful Imports:</span>
                    <span className="text-[#3BF68A] ml-2 font-medium">{importResults.successfulImports}</span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={resetImport}
                  className="flex-1 px-4 py-2 border border-[#1F2937] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 transition-all"
                >
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 transition-all"
                >
                  View Dashboard
                </button>
              </div>
            </div>
          )}

          {importStatus === 'error' && importResults && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-[#F45B69]/10 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-[#F45B69]" />
              </div>
              <h3 className="text-[#E5E7EB] text-lg font-semibold mb-2">Import Failed</h3>
              <p className="text-[#8B94A7] text-sm mb-6">There were issues processing your file</p>
              
              {importResults.errors.length > 0 && (
                <div className="bg-[#F45B69]/10 border border-[#F45B69]/20 rounded-lg p-4 mb-6 text-left">
                  <h4 className="text-[#F45B69] font-medium mb-2">Errors:</h4>
                  <ul className="text-[#8B94A7] text-sm space-y-1">
                    {importResults.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={resetImport}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#3BF68A] to-[#A78BFA] text-black font-medium rounded-lg hover:opacity-90 transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-[#1F2937] rounded-lg text-[#8B94A7] hover:text-[#E5E7EB] hover:border-[#3BF68A]/50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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