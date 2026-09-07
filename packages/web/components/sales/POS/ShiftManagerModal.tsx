'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  DollarSign,
  Calendar,
  Users,
  RefreshCw,
  LogOut,
  Play,
  Pause,
  StopCircle
} from 'lucide-react';
import { useToast } from '../../common/Toast';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';

interface Shift {
  id: string;
  cashRegisterId: string;
  cashRegisterName: string;
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  endingBalance?: number;
  expectedEndingBalance?: number;
  discrepancy?: number;
  status: 'OPEN' | 'CLOSED' | 'VOID' | 'PENDING';
  userId: string;
  userName: string;
}

interface ShiftManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, data?: any) => void;
}

export function ShiftManagerModal({
  isOpen,
  onClose,
  onAction,
}: ShiftManagerModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [endingBalance, setEndingBalance] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadShiftData();
    }
  }, [isOpen]);

  const loadShiftData = async () => {
    setLoading(true);
    try {
      // Mock data for demo
      const mockShift: Shift = {
        id: 'shift-1',
        cashRegisterId: 'reg-1',
        cashRegisterName: 'Main Register',
        openedAt: new Date().toISOString(),
        startingBalance: 100.00,
        status: 'OPEN',
        userId: 'user-1',
        userName: 'John Doe',
      };
      setCurrentShift(mockShift);

      const mockHistory: Shift[] = [
        {
          id: 'shift-2',
          cashRegisterId: 'reg-1',
          cashRegisterName: 'Main Register',
          openedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          startingBalance: 100.00,
          endingBalance: 1250.50,
          expectedEndingBalance: 1245.00,
          discrepancy: 5.50,
          status: 'CLOSED',
          userId: 'user-1',
          userName: 'John Doe',
        },
        {
          id: 'shift-3',
          cashRegisterId: 'reg-1',
          cashRegisterName: 'Main Register',
          openedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
          startingBalance: 100.00,
          endingBalance: 980.25,
          expectedEndingBalance: 980.25,
          discrepancy: 0,
          status: 'CLOSED',
          userId: 'user-2',
          userName: 'Jane Smith',
        },
      ];
      setShiftHistory(mockHistory);
    } catch (error) {
      console.error('Failed to load shift data:', error);
      showToast('Failed to load shift data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartShift = () => {
    if (startingBalance < 0) {
      showToast('Please enter a valid starting balance', 'warning');
      return;
    }

    setIsStarting(true);
    setTimeout(() => {
      const newShift: Shift = {
        id: `shift-${Date.now()}`,
        cashRegisterId: 'reg-1',
        cashRegisterName: 'Main Register',
        openedAt: new Date().toISOString(),
        startingBalance,
        status: 'OPEN',
        userId: 'user-1',
        userName: 'John Doe',
      };
      setCurrentShift(newShift);
      setShiftHistory([newShift, ...shiftHistory]);
      onAction('start_shift', { startingBalance });
      showToast(`Shift started with ${formatCurrency(startingBalance)}`, 'success');
      setIsStarting(false);
    }, 500);
  };

  const handleCloseShift = () => {
    if (endingBalance < 0) {
      showToast('Please enter a valid ending balance', 'warning');
      return;
    }

    setIsClosing(true);
    setTimeout(() => {
      if (currentShift) {
        const closedShift: Shift = {
          ...currentShift,
          closedAt: new Date().toISOString(),
          endingBalance,
          expectedEndingBalance: endingBalance,
          status: 'CLOSED',
        };
        setCurrentShift(null);
        setShiftHistory([closedShift, ...shiftHistory.filter(s => s.id !== currentShift.id)]);
        onAction('close_shift', { endingBalance });
        showToast(`Shift closed with ${formatCurrency(endingBalance)}`, 'success');
      }
      setIsClosing(false);
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Shift Manager
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage cash register shifts
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <span className="ml-2 text-gray-500 dark:text-gray-400">Loading...</span>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Current Shift Status */}
            <div className={`p-4 rounded-lg border ${currentShift ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Current Shift Status
                  </p>
                  {currentShift ? (
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-semibold text-green-600 dark:text-green-400">Open</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        since {formatDateTime(currentShift.openedAt)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <AlertCircle className="w-5 h-5 text-gray-500" />
                      <span className="font-semibold text-gray-600 dark:text-gray-400">No Active Shift</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {currentShift && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Starting Balance</p>
                  )}
                  {currentShift && (
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(currentShift.startingBalance)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Start Shift Form */}
            {!currentShift && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Start New Shift</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Starting Balance
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={startingBalance || ''}
                        onChange={(e) => setStartingBalance(parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleStartShift}
                    disabled={isStarting}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 disabled:opacity-50 mt-6"
                  >
                    {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {isStarting ? 'Starting...' : 'Start Shift'}
                  </button>
                </div>
              </div>
            )}

            {/* Close Shift Form */}
            {currentShift && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Close Shift</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Ending Balance
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={endingBalance || ''}
                        onChange={(e) => setEndingBalance(parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCloseShift}
                    disabled={isClosing}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 mt-6"
                  >
                    {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <StopCircle className="w-4 h-4" />}
                    {isClosing ? 'Closing...' : 'Close Shift'}
                  </button>
                </div>
              </div>
            )}

            {/* Shift History */}
            <div>
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Shift History
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {shiftHistory.length > 0 ? (
                  shiftHistory.map((shift) => (
                    <ShiftHistoryItem key={shift.id} shift={shift} />
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No shift history available
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// SHIFT HISTORY ITEM
// ============================================

function ShiftHistoryItem({ shift }: { shift: Shift }) {
  const isOpen = shift.status === 'OPEN';
  const isClosed = shift.status === 'CLOSED';
  const hasDiscrepancy = shift.discrepancy && shift.discrepancy !== 0;

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isOpen ? (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs font-medium flex items-center gap-1">
              <Play className="w-3 h-3" />
              Open
            </span>
          ) : isClosed ? (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium flex items-center gap-1">
              <StopCircle className="w-3 h-3" />
              Closed
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full text-xs font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {shift.status}
            </span>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {formatDateTime(shift.openedAt)}
          </span>
          {shift.closedAt && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              → {formatDateTime(shift.closedAt)}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatCurrency(shift.endingBalance || shift.startingBalance)}
          </p>
          {hasDiscrepancy && (
            <p className={`text-xs ${shift.discrepancy! > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {shift.discrepancy! > 0 ? '+' : ''}{formatCurrency(shift.discrepancy!)}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">{shift.userName}</p>
        </div>
      </div>
    </div>
  );
}
