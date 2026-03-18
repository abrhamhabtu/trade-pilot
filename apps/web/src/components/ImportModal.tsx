'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, X, CheckCircle, Download, Info } from 'lucide-react';
import { useAccountStore } from '../store/accountStore';
import { Trade } from '../store/tradingStore';
import { toast } from '../store/toastStore';
import clsx from 'clsx';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetAccountId?: string | null;
  onImportComplete?: (trades: Trade[]) => void;
}

// Parse numeric values safely
const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Parse ProjectX date format
const parseProjectXDate = (dateTimeStr: string): { date: string; time: string } => {
  if (!dateTimeStr) {
    return { date: new Date().toISOString().split('T')[0], time: '10:00 AM' };
  }

  try {
    const parts = dateTimeStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1];

    const [month, day, year] = datePart.split('/');
    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    const [hours, minutes] = timePart.split(':');
    const hour = parseInt(hours);
    let displayHour = hour;
    let ampm = 'AM';

    if (hour === 0) {
      displayHour = 12;
      ampm = 'AM';
    } else if (hour === 12) {
      displayHour = 12;
      ampm = 'PM';
    } else if (hour > 12) {
      displayHour = hour - 12;
      ampm = 'PM';
    }

    const formattedTime = `${displayHour}:${minutes} ${ampm}`;

    return { date: formattedDate, time: formattedTime };
  } catch {
    return { date: new Date().toISOString().split('T')[0], time: '10:00 AM' };
  }
};

// Parse ProjectX duration format
const parseProjectXDuration = (durationStr: string): number => {
  if (!durationStr) return 30;

  try {
    const [timePart] = durationStr.split('.');
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + (seconds > 30 ? 1 : 0);
    return Math.max(1, totalMinutes);
  } catch {
    return 30;
  }
};

// Detect ProjectX format
const isProjectXFormat = (columns: string[]): boolean => {
  const projectXColumns = ['ContractName', 'EnteredAt', 'ExitedAt', 'EntryPrice', 'ExitPrice', 'PnL', 'Size', 'Type'];
  const matchCount = projectXColumns.filter(col => columns.includes(col)).length;
  return matchCount >= 5;
};

// Detect Tradovate format
const isTradovateFormat = (columns: string[]): boolean => {
  const tradovateColumns = ['orderId', 'execId', 'contractId', 'action', 'qty', 'price', 'filledQty', 'avgFillPrice'];
  const altColumns = ['Account', 'B/S', 'Contract', 'Product', 'Qty', 'Price', 'P/L'];
  const matchCount = tradovateColumns.filter(col => columns.some(c => c.toLowerCase().includes(col.toLowerCase()))).length;
  const altMatchCount = altColumns.filter(col => columns.some(c => c.includes(col))).length;
  return matchCount >= 4 || altMatchCount >= 4;
};

// Detect NinjaTrader format
const isNinjaTraderFormat = (columns: string[]): boolean => {
  const ninjaColumns = ['Instrument', 'Market pos.', 'Qty', 'Entry price', 'Exit price', 'Profit', 'Commission'];
  const altColumns = ['Entry time', 'Exit time', 'Entry name', 'Exit name'];
  const matchCount = ninjaColumns.filter(col => columns.some(c => c.includes(col))).length;
  const altMatchCount = altColumns.filter(col => columns.some(c => c.includes(col))).length;
  return matchCount >= 4 || (matchCount >= 2 && altMatchCount >= 2);
};

// Detect TradingView format
const isTradingViewFormat = (columns: string[]): boolean => {
  const tvColumns = ['Time', 'Action', 'Realized P&L', 'Balance'];
  const matchCount = tvColumns.filter(col => columns.some(c => c.includes(col))).length;
  return matchCount >= 2;
};

// Detect TopOne Futures format
const isTopOneFuturesFormat = (columns: string[]): boolean => {
  const topOneColumns = ['Ticket #', 'Symbol', 'Side', 'Open Time', 'Close Time', 'Close Price', 'PnL', 'Lots', 'Commissions'];
  const matchCount = topOneColumns.filter(col => columns.some(c => c.includes(col))).length;
  return matchCount >= 5;
};

// Calculate realistic duration
const calculateRealisticDuration = (netPL: number): number => {
  const absPL = Math.abs(netPL);
  let baseDuration: number;

  if (absPL < 50) {
    baseDuration = Math.random() * 15 + 5;
  } else if (absPL < 200) {
    baseDuration = Math.random() * 60 + 15;
  } else if (absPL < 500) {
    baseDuration = Math.random() * 120 + 30;
  } else {
    baseDuration = Math.random() * 240 + 60;
  }

  const variance = baseDuration * 0.3;
  const finalDuration = baseDuration + (Math.random() - 0.5) * variance;

  return Math.max(5, Math.round(finalDuration));
};

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  targetAccountId,
  onImportComplete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { accounts, addTradesToAccount } = useAccountStore();
  const [dragActive, setDragActive] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importResults, setImportResults] = useState<{
    totalRows: number;
    successfulImports: number;
    skippedDuplicates: number;
    errors: string[];
    trades: Trade[];
  } | null>(null);

  const targetAccount = accounts.find(a => a.id === targetAccountId);

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

  const processProjectXData = (data: any[]): { trades: Trade[]; errors: string[] } => {
    const trades: Trade[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      try {
        const contractName = row['ContractName'] || '';
        const enteredAt = row['EnteredAt'] || '';
        const entryPrice = parseNumber(row['EntryPrice']);
        const exitPrice = parseNumber(row['ExitPrice']);
        const fees = parseNumber(row['Fees']) || 0;
        const pnl = parseNumber(row['PnL']);
        const size = parseNumber(row['Size']) || 1;
        const type = row['Type'] || 'Long';
        const tradeDuration = row['TradeDuration'] || '';
        const commissions = parseNumber(row['Commissions']) || 0;

        // Skip rows without contract name - but allow pnl of 0 (rare but possible)
        if (!contractName) return;

        const { date, time } = parseProjectXDate(enteredAt);
        let duration = parseProjectXDuration(tradeDuration);
        if (duration === 0 || duration === 30) {
          duration = calculateRealisticDuration(pnl);
        }

        const side: 'Long' | 'Short' = type.toLowerCase() === 'short' ? 'Short' : 'Long';
        const totalFees = fees + commissions;

        // PnL from Topstep/ProjectX is gross P&L - subtract fees to get net
        const netPnL = pnl - totalFees;

        trades.push({
          id: `import-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          date,
          symbol: contractName,
          entryPrice: Math.round(entryPrice * 1000000) / 1000000,
          exitPrice: Math.round(exitPrice * 1000000) / 1000000,
          quantity: size,
          netPL: Math.round(netPnL * 100) / 100,
          duration,
          outcome: netPnL > 0 ? 'win' : 'loss',
          time,
          side,
          commission: Math.round(totalFees * 100) / 100,
          notes: ''
        });
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    return { trades, errors };
  };

  const processTradingViewData = (data: any[]): { trades: Trade[]; errors: string[] } => {
    const trades: Trade[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      try {
        const timeValue = row['Time'];
        const realizedPL = row['Realized P&L (value)'];
        const actionValue = row['Action'];

        if (!realizedPL || realizedPL === 0 || !actionValue) return;

        const netPL = parseNumber(realizedPL);
        if (netPL === 0) return;

        // Parse date
        let date = new Date().toISOString().split('T')[0];
        let time = '10:00 AM';

        if (timeValue) {
          const [datePart, timePart] = timeValue.split(' ');
          if (datePart) date = datePart;
          if (timePart) {
            const [hours, minutes] = timePart.split(':');
            const hour = parseInt(hours);
            let displayHour = hour;
            let ampm = 'AM';
            if (hour === 0) { displayHour = 12; ampm = 'AM'; }
            else if (hour === 12) { displayHour = 12; ampm = 'PM'; }
            else if (hour > 12) { displayHour = hour - 12; ampm = 'PM'; }
            time = `${displayHour}:${minutes} ${ampm}`;
          }
        }

        // Extract symbol
        let symbol = 'FUTURES';
        const cmeMatch = actionValue.match(/CME_MINI:([A-Z]+\d{4})/);
        if (cmeMatch) symbol = cmeMatch[1];

        // Determine side
        let side: 'Long' | 'Short' = 'Long';
        if (actionValue.toLowerCase().includes('close short')) side = 'Short';

        const duration = calculateRealisticDuration(netPL);

        trades.push({
          id: `import-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          date,
          symbol,
          entryPrice: 5000,
          exitPrice: 5000 + (netPL / 100),
          quantity: 1,
          netPL: Math.round(netPL * 100) / 100,
          duration,
          outcome: netPL > 0 ? 'win' : 'loss',
          time,
          side,
          commission: 0,
          notes: ''
        });
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    return { trades, errors };
  };

  const processTradovateData = (data: any[]): { trades: Trade[]; errors: string[] } => {
    const trades: Trade[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      try {
        // Tradovate exports can have various column names
        const symbol = row['Contract'] || row['contractId'] || row['Product'] || 'FUTURES';
        const pnl = row['P/L'] || row['Profit'] || row['realizedPnl'] || 0;
        const qty = row['Qty'] || row['qty'] || row['filledQty'] || 1;
        const entryPrice = row['Entry Price'] || row['avgFillPrice'] || row['price'] || 0;
        const exitPrice = row['Exit Price'] || row['price'] || 0;
        const commission = row['Commission'] || row['commission'] || row['Fees'] || 0;
        const dateTime = row['Date'] || row['timestamp'] || row['Time'] || '';
        const action = row['B/S'] || row['action'] || row['Side'] || '';

        const netPL = parseNumber(pnl);
        if (netPL === 0 && !symbol) return;

        // Parse date/time
        let date = new Date().toISOString().split('T')[0];
        let time = '10:00 AM';

        if (dateTime) {
          try {
            const dateObj = new Date(dateTime);
            if (!isNaN(dateObj.getTime())) {
              date = dateObj.toISOString().split('T')[0];
              const hours = dateObj.getHours();
              const minutes = dateObj.getMinutes().toString().padStart(2, '0');
              const ampm = hours >= 12 ? 'PM' : 'AM';
              const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
              time = `${displayHour}:${minutes} ${ampm}`;
            }
          } catch {
            // Use defaults
          }
        }

        // Determine side
        let side: 'Long' | 'Short' = 'Long';
        const actionLower = action.toString().toLowerCase();
        if (actionLower.includes('sell') || actionLower.includes('short') || actionLower === 's') {
          side = 'Short';
        }

        const duration = calculateRealisticDuration(netPL);
        const totalCommission = parseNumber(commission);

        trades.push({
          id: `import-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          date,
          symbol: symbol.toString(),
          entryPrice: parseNumber(entryPrice),
          exitPrice: parseNumber(exitPrice),
          quantity: parseNumber(qty),
          netPL: Math.round((netPL - totalCommission) * 100) / 100,
          duration,
          outcome: (netPL - totalCommission) > 0 ? 'win' : 'loss',
          time,
          side,
          commission: Math.round(totalCommission * 100) / 100,
          notes: ''
        });
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    return { trades, errors };
  };

  const processNinjaTraderData = (data: any[]): { trades: Trade[]; errors: string[] } => {
    const trades: Trade[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      try {
        // NinjaTrader column names
        const instrument = row['Instrument'] || row['Symbol'] || '';
        const profit = row['Profit'] || row['Net profit'] || row['P&L'] || 0;
        const qty = row['Qty'] || row['Quantity'] || 1;
        const entryPrice = row['Entry price'] || row['Avg entry'] || 0;
        const exitPrice = row['Exit price'] || row['Avg exit'] || 0;
        const commission = row['Commission'] || row['Comm'] || 0;
        const entryTime = row['Entry time'] || row['Time'] || '';
        const marketPos = row['Market pos.'] || row['Position'] || row['Side'] || '';

        if (!instrument) return;

        const netPL = parseNumber(profit);
        const totalCommission = parseNumber(commission);

        // Parse date/time from entry time
        let date = new Date().toISOString().split('T')[0];
        let time = '10:00 AM';

        if (entryTime) {
          try {
            const dateObj = new Date(entryTime);
            if (!isNaN(dateObj.getTime())) {
              date = dateObj.toISOString().split('T')[0];
              const hours = dateObj.getHours();
              const minutes = dateObj.getMinutes().toString().padStart(2, '0');
              const ampm = hours >= 12 ? 'PM' : 'AM';
              const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
              time = `${displayHour}:${minutes} ${ampm}`;
            }
          } catch {
            // Use defaults
          }
        }

        // Determine side from market position
        let side: 'Long' | 'Short' = 'Long';
        const posLower = marketPos.toString().toLowerCase();
        if (posLower.includes('short') || posLower.includes('sell') || posLower === 's') {
          side = 'Short';
        }

        const duration = calculateRealisticDuration(netPL);

        trades.push({
          id: `import-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          date,
          symbol: instrument.toString(),
          entryPrice: parseNumber(entryPrice),
          exitPrice: parseNumber(exitPrice),
          quantity: parseNumber(qty),
          netPL: Math.round((netPL - totalCommission) * 100) / 100,
          duration,
          outcome: (netPL - totalCommission) > 0 ? 'win' : 'loss',
          time,
          side,
          commission: Math.round(totalCommission * 100) / 100,
          notes: ''
        });
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    return { trades, errors };
  };

  const processTopOneFuturesData = (data: any[]): { trades: Trade[]; errors: string[] } => {
    const trades: Trade[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      try {
        // TopOne Futures column names
        const ticketId = row['Ticket #'] || row['Ticket'] || '';
        const symbol = row['Symbol'] || '';
        const side = row['Side'] || '';
        const closeTimeStr = row['Close Time'] || '';
        const openPrice = row['Open Price'] || 0;
        const closePrice = row['Close Price'] || 0;
        const durationStr = row['Duration'] || '';
        const pnl = row['PnL'] || row['Pnl'] || row['P&L'] || 0;
        const lots = row['Lots'] || row['Qty'] || 1;
        const commission = row['Commissions'] || row['Commission'] || 0;

        // Must have symbol to be a valid trade - allow missing ticketId but require symbol
        if (!symbol) return;

        // Parse numeric values
        const grossPL = parseNumber(pnl);
        const totalCommission = parseNumber(commission);

        // TopOne PnL is GROSS (before commissions) - subtract to get net like ProjectX
        const netPL = grossPL - totalCommission;

        // Parse TopOne date format: DD/MM/YYYY HH:MM:SS
        let date = new Date().toISOString().split('T')[0];
        let time = '10:00 AM';

        if (closeTimeStr) {
          try {
            // Format: DD/MM/YYYY HH:MM:SS (in UTC - TopOne uses UTC)
            const parts = closeTimeStr.split(' ');
            const datePart = parts[0];
            const timePart = parts[1];

            if (datePart && timePart) {
              const [day, month, year] = datePart.split('/');
              const [hours, minutes] = timePart.split(':');

              if (day && month && year && hours && minutes) {
                // Create date in UTC
                const utcDate = new Date(Date.UTC(
                  parseInt(year),
                  parseInt(month) - 1, // Month is 0-indexed
                  parseInt(day),
                  parseInt(hours),
                  parseInt(minutes)
                ));

                // Convert to Pacific time - subtract 8 hours (PST) or 7 hours (PDT)
                // For simplicity, using fixed offset of 8 hours (PST)
                const pacificOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
                const pacificDate = new Date(utcDate.getTime() - pacificOffset);

                // Get date in YYYY-MM-DD format
                date = pacificDate.toISOString().split('T')[0];

                // Get time in 12-hour format
                const pacificHour = pacificDate.getUTCHours();
                const pacificMinutes = pacificDate.getUTCMinutes();
                let displayHour = pacificHour;
                let ampm = 'AM';

                if (pacificHour === 0) { displayHour = 12; ampm = 'AM'; }
                else if (pacificHour === 12) { displayHour = 12; ampm = 'PM'; }
                else if (pacificHour > 12) { displayHour = pacificHour - 12; ampm = 'PM'; }

                time = `${displayHour}:${pacificMinutes.toString().padStart(2, '0')} ${ampm}`;
              }
            }
          } catch {
            // Use defaults
          }
        }

        // Determine side - BUY = Long, SELL = Short
        let tradeSide: 'Long' | 'Short' = 'Long';
        const sideLower = side.toString().toLowerCase();
        if (sideLower.includes('sell') || sideLower.includes('short') || sideLower === 's') {
          tradeSide = 'Short';
        }

        // Parse duration - format like "7m 20s" or "14m 25s" or "2m 40s"
        let duration = 30;
        if (durationStr) {
          try {
            const minMatch = durationStr.match(/(\d+)m/);
            const secMatch = durationStr.match(/(\d+)s/);
            const minutes = minMatch ? parseInt(minMatch[1]) : 0;
            const seconds = secMatch ? parseInt(secMatch[1]) : 0;
            duration = minutes + (seconds > 30 ? 1 : 0);
            if (duration === 0) duration = 1;
          } catch {
            duration = calculateRealisticDuration(netPL);
          }
        }

        trades.push({
          id: `import-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          date,
          symbol: symbol.toString(),
          entryPrice: parseNumber(openPrice),
          exitPrice: parseNumber(closePrice),
          quantity: parseNumber(lots),
          netPL: Math.round(netPL * 100) / 100,
          duration,
          outcome: netPL > 0 ? 'win' : 'loss',
          time,
          side: tradeSide,
          commission: Math.round(totalCommission * 100) / 100,
          notes: ticketId ? `Ticket: ${ticketId}` : ''
        });
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    return { trades, errors };
  };

  const handleFileImport = async (file: File) => {
    setImportStatus('processing');
    setImportResults(null);

    try {
      // Validate file
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit');
      }

      let data: any[] = [];

      if (file.name.endsWith('.csv')) {
        const Papa = await import('papaparse');

        await new Promise<void>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              data = results.data;
              resolve();
            },
            error: (error) => reject(new Error(`CSV parsing error: ${error.message}`))
          });
        });
      } else {
        const XLSX = await import('xlsx');

        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const arrayData = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(arrayData, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              data = XLSX.utils.sheet_to_json(worksheet);
              resolve();
            } catch (err) {
              reject(new Error(`Excel parsing error: ${err instanceof Error ? err.message : 'Unknown error'}`));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsArrayBuffer(file);
        });
      }

      if (!data || data.length === 0) {
        throw new Error('No data found in file');
      }

      const columns = Object.keys(data[0]);
      let result: { trades: Trade[]; errors: string[] };

      // Detect format and process accordingly
      // Check TopOne Futures first since it has very specific column names
      if (isTopOneFuturesFormat(columns)) {
        result = processTopOneFuturesData(data);
      } else if (isProjectXFormat(columns)) {
        result = processProjectXData(data);
      } else if (isTradovateFormat(columns)) {
        result = processTradovateData(data);
      } else if (isNinjaTraderFormat(columns)) {
        result = processNinjaTraderData(data);
      } else if (isTradingViewFormat(columns)) {
        result = processTradingViewData(data);
      } else {
        // Fallback to TradingView parser as it's most flexible
        result = processTradingViewData(data);
      }

      if (result.trades.length === 0) {
        throw new Error('No valid trades found in file. Please check the file format.');
      }

      // Add trades to target account with filename for import history
      let added = result.trades.length;
      let skipped = 0;
      if (targetAccountId) {
        const result2 = addTradesToAccount(targetAccountId, result.trades, file.name);
        added = result2.added;
        skipped = result2.skipped;
      }

      // Call the callback if provided
      if (onImportComplete) {
        onImportComplete(result.trades);
      }

      setImportStatus('success');
      setImportResults({
        totalRows: data.length,
        successfulImports: added,
        skippedDuplicates: skipped,
        errors: result.errors.slice(0, 10),
        trades: result.trades
      });

      if (skipped > 0) {
        toast.success(`Imported ${added} new trades · ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped`);
      } else {
        toast.success(`Successfully imported ${added} trades from ${file.name}`);
      }

    } catch (error) {
      console.error('Error importing trades:', error);
      setImportStatus('error');
      setImportResults({
        totalRows: 0,
        successfulImports: 0,
        skippedDuplicates: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        trades: []
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="rounded-xl border border-white/5 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"

      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">Import Trades</h2>
            <p className="text-zinc-400 text-sm">
              {targetAccount
                ? `Importing to: ${targetAccount.name}`
                : 'Upload from TradingView, Topstep, TopOne Futures, or other platforms'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-[#172035] rounded-lg transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {importStatus === 'idle' && (
            <>
              {/* Target Account Badge */}
              {targetAccount && (
                <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-lg">
                      📈
                    </div>
                    <div>
                      <p className="text-zinc-100 font-medium">{targetAccount.name}</p>
                      <p className="text-zinc-400 text-sm">{targetAccount.broker} • {targetAccount.trades.length} trades</p>
                    </div>
                  </div>
                </div>
              )}

              {/* File Upload Area */}
              <div
                className={clsx(
                  'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer',
                  dragActive
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={handleFileSelect}
              >
                <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                  <Upload className="h-8 w-8 text-emerald-500" />
                </div>

                <h3 className="text-zinc-100 text-lg font-semibold mb-2">
                  Drop your file here or click to browse
                </h3>

                <p className="text-zinc-400 text-sm mb-4">
                  Supports TradingView, ProjectX (Topstep, TopOne Futures), and more
                </p>

                <button
                  type="button"
                  className="inline-flex items-center px-6 py-3 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all duration-200"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Choose File
                </button>
              </div>

              {/* File Requirements */}
              <div className="mt-6 p-4 bg-[#172035]/50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-zinc-100 font-medium mb-2">Supported Platforms</h4>
                    <ul className="text-zinc-400 text-sm space-y-1">
                      <li>• <strong>TradingView:</strong> Export from Account History</li>
                      <li>• <strong>Tradovate:</strong> Reports → Trade Activity → Export</li>
                      <li>• <strong>NinjaTrader:</strong> Control Center → Account Data → Export</li>
                      <li>• <strong>ProjectX Prop Firms:</strong> Topstep, TopOne Futures, and others</li>
                      <li>• <strong>Formats:</strong> CSV, XLSX, XLS (max 10MB, auto-detected)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Sample File Download */}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-zinc-400 text-sm">Need help formatting your data?</span>
                <button
                  onClick={downloadSampleFile}
                  className="flex items-center space-x-2 px-4 py-2 border border-white/5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 transition-all text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Sample CSV</span>
                </button>
              </div>
            </>
          )}

          {importStatus === 'processing' && (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500/30 border-t-transparent" />
              </div>
              <h3 className="text-zinc-100 text-lg font-semibold mb-2">Processing your trades...</h3>
              <p className="text-zinc-400 text-sm">This may take a few moments depending on file size</p>
            </div>
          )}

          {importStatus === 'success' && importResults && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-zinc-100 text-lg font-semibold mb-2">Import Successful!</h3>
              <p className="text-zinc-400 text-sm mb-6">
                {targetAccount
                  ? `Trades have been added to ${targetAccount.name}`
                  : 'Your trades have been imported and processed'}
              </p>

              <div className="bg-[#172035]/50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-zinc-400">Total Rows:</span>
                    <span className="text-zinc-100 ml-2 font-medium">{importResults.totalRows}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">New Trades Added:</span>
                    <span className="text-emerald-400 ml-2 font-semibold">{importResults.successfulImports}</span>
                  </div>
                  {importResults.skippedDuplicates > 0 && (
                    <div className="col-span-2 flex items-center space-x-2 mt-1 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <span className="text-amber-400 text-xs">⚠</span>
                      <span className="text-amber-400 text-xs font-medium">
                        {importResults.skippedDuplicates} trade{importResults.skippedDuplicates !== 1 ? 's' : ''} skipped — already in your account
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={resetImport}
                  className="flex-1 px-4 py-2 border border-white/5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 transition-all"
                >
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all"
                >
                  View Dashboard
                </button>
              </div>
            </div>
          )}

          {importStatus === 'error' && importResults && (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-rose-500" />
              </div>
              <h3 className="text-zinc-100 text-lg font-semibold mb-2">Import Failed</h3>
              <p className="text-zinc-400 text-sm mb-6">There were issues processing your file</p>

              {importResults.errors.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/30/20 rounded-lg p-4 mb-6 text-left">
                  <h4 className="text-rose-500 font-medium mb-2">Errors:</h4>
                  <ul className="text-zinc-400 text-sm space-y-1">
                    {importResults.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={resetImport}
                  className="flex-1 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 font-medium rounded-lg hover:opacity-90 transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-white/5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-emerald-500/50 transition-all"
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
