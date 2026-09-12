'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Play,
  StopCircle,
  History,
  TrendingUp,
  CreditCard,
  Wallet,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Printer,
  FileText,
  User,
  Building,
  Coins,
  Receipt,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { formatCurrency, formatDate, formatTime, formatDuration } from '../../../utils/formatters';
import { shiftService } from '../../../services/shiftService';
import { toast } from '../../../utils/toast-manager';
import { useAuth } from '../../../hooks/useAuth';

// ============================================
// TYPES
// ============================================

interface Shift {
  id: string;
  cashRegisterId: string;
  cashRegister: {
    id: string;
    name: string;
    code: string;
  };
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  endingBalance?: number;
  expectedEndingBalance?: number;
  discrepancy?: number;
  status: 'OPEN' | 'CLOSED' | 'VOID' | 'PENDING';
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  notes?: string;
  summary?: {
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    cashReceived?: number;
    cardReceived?: number;
    mobileReceived?: number;
    otherReceived?: number;
    cashOut?: number;
    cashIn?: number;
  };
  sales?: any[];
  payments?: any[];
  cashTransactions?: any[];
}

interface Register {
  id: string;
  name: string;
  code: string;
  cashBalance: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING' | 'SUSPENDED';
  isActive: boolean;
  currentSessionId?: string;
}

interface ShiftStats {
  totalShifts: number;
  openShifts: number;
  closedShifts: number;
  totalRevenue: number;
  averageShiftDuration: number;
  averageShiftRevenue: number;
  topCashiers: Array<{
    userId: string;
    userName: string;
    shiftCount: number;
    totalRevenue: number;
  }>;
}

interface ShiftManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftChanged?: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ShiftManagerModal({
  isOpen,
  onClose,
  onShiftChanged,
}: ShiftManagerModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [shiftStats, setShiftStats] = useState<ShiftStats | null>(null);
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('');
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [endingBalance, setEndingBalance] = useState<number>(0);
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'stats'>('current');
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAllShiftData();
    }
  }, [isOpen]);

  // Auto-select first register
  useEffect(() => {
    if (registers.length > 0 && !selectedRegisterId) {
      // Prefer open register, otherwise first active one
      const openRegister = registers.find(r => r.status === 'OPEN');
      setSelectedRegisterId(openRegister?.id || registers[0].id);
    }
  }, [registers]);

  const loadAllShiftData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCurrentShift(),
        loadRegisters(),
        loadShiftHistory(),
        loadShiftStats(),
      ]);
    } catch (error) {
      console.error('Failed to load shift data:', error);
      toast.error('Failed to load shift data');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentShift = async () => {
    try {
      const shift = await shiftService.getCurrentShift();
      if (shift) {
        setCurrentShift(shift as Shift);
      } else {
        setCurrentShift(null);
      }
    } catch (error) {
      console.error('Failed to load current shift:', error);
      setCurrentShift(null);
    }
  };

  const loadRegisters = async () => {
    try {
      const data = await shiftService.getRegisters({ isActive: true });
      setRegisters(data || []);
    } catch (error) {
      console.error('Failed to load registers:', error);
      setRegisters([]);
    }
  };

  const loadShiftHistory = async () => {
    try {
      const result = await shiftService.getAllShifts({
        page: 1,
        limit: 20,
      });
      // Map the response to match Shift interface
      const mappedShifts = (result?.shifts || []).map((shift: any) => ({
        ...shift,
        cashRegister: shift.cashRegister || {
          id: shift.cashRegisterId,
          name: 'Unknown',
          code: 'N/A'
        }
      }));
      setShiftHistory(mappedShifts);
    } catch (error) {
      console.error('Failed to load shift history:', error);
      setShiftHistory([]);
    }
  };

  const loadShiftStats = async () => {
    try {
      const stats = await shiftService.getShiftStats();
      setShiftStats(stats || null);
    } catch (error) {
      console.error('Failed to load shift stats:', error);
      setShiftStats(null);
    }
  };

  const handleStartShift = async () => {
    if (!selectedRegisterId) {
      toast.warning('Please select a register');
      return;
    }

    if (startingBalance < 0) {
      toast.warning('Starting balance cannot be negative');
      return;
    }

    setIsStarting(true);
    try {
      const result = await shiftService.startShift({
        cashRegisterId: selectedRegisterId,
        startingBalance: startingBalance,
        notes: shiftNotes || undefined,
      });

      if (result) {
        toast.success(`Shift started with ${formatCurrency(startingBalance)}`);
        setStartingBalance(0);
        setShiftNotes('');
        await loadAllShiftData();
        onShiftChanged?.();
      }
    } catch (error: any) {
      console.error('Failed to start shift:', error);
      toast.error(error.message || 'Failed to start shift');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) {
      toast.warning('No active shift to close');
      return;
    }

    if (endingBalance < 0) {
      toast.warning('Ending balance cannot be negative');
      return;
    }

    setIsClosing(true);
    try {
      const result = await shiftService.endShift(currentShift.id, {
        endingBalance: endingBalance,
        notes: shiftNotes || 'Shift closed',
      });

      if (result) {
        toast.success(`Shift closed with ${formatCurrency(endingBalance)}`);
        setEndingBalance(0);
        setShiftNotes('');
        await loadAllShiftData();
        onShiftChanged?.();
      }
    } catch (error: any) {
      console.error('Failed to close shift:', error);
      toast.error(error.message || 'Failed to close shift');
    } finally {
      setIsClosing(false);
    }
  };

  const handleRefresh = () => {
    loadAllShiftData();
    toast.info('Shift data refreshed');
  };

  const toggleShiftExpand = (shiftId: string) => {
    setExpandedShiftId(expandedShiftId === shiftId ? null : shiftId);
  };

  const formatDurationString = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: React.ElementType }> = {
      OPEN: { label: 'Open', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
      CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: CheckCircle },
      VOID: { label: 'Void', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: AlertCircle },
      PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
    };
    const config = configs[status] || configs.PENDING;
    const Icon = config.icon;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <span>Shift Manager</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage cash register shifts and track daily performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <span className="ml-3 text-gray-500 dark:text-gray-400 text-lg">Loading shift data...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('current')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'current'
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  Current Shift
                </span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'history'
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <History className="w-4 h-4" />
                  History
                </span>
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'stats'
                    ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Statistics
                </span>
              </button>
            </div>

            {/* Tab Content: Current Shift */}
            {activeTab === 'current' && (
              <div className="space-y-6">
                {/* Current Shift Status Card */}
                <div className={`rounded-xl border p-6 ${
                  currentShift 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Shift Status
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {currentShift ? (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-lg font-semibold text-green-700 dark:text-green-300">
                                Active
                              </span>
                            </div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              since {formatTime(currentShift.openedAt)}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-gray-400 rounded-full" />
                              <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                                No Active Shift
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {currentShift && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Starting Balance</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(currentShift.startingBalance)}
                        </p>
                      </div>
                    )}
                  </div>

                  {currentShift && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-green-200 dark:border-green-800/50">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Register</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {currentShift.cashRegister?.name || 'Unknown'}
                          <span className="text-sm text-gray-400 ml-2">
                            #{currentShift.cashRegister?.code || 'N/A'}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Cashier</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {currentShift.user?.firstName || 'Unknown'} {currentShift.user?.lastName || ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatDuration(Math.floor((Date.now() - new Date(currentShift.openedAt).getTime()) / 1000))}
                        </p>
                      </div>
                    </div>
                  )}

                  {currentShift && currentShift.summary && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-green-200 dark:border-green-800/50">
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sales</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {currentShift.summary.totalSales || 0}
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(currentShift.summary.totalRevenue || 0)}
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Ticket</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(currentShift.summary.averageTicket || 0)}
                        </p>
                      </div>
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Expected Balance</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {formatCurrency(currentShift.expectedEndingBalance || currentShift.startingBalance)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Start Shift Form */}
                {!currentShift && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Play className="w-5 h-5 text-green-500" />
                      Start New Shift
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Select Register <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedRegisterId}
                          onChange={(e) => setSelectedRegisterId(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">Select a register...</option>
                          {registers.map((reg) => (
                            <option key={reg.id} value={reg.id}>
                              {reg.name} ({reg.code}) - {reg.status}
                            </option>
                          ))}
                        </select>
                        {registers.length === 0 && (
                          <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
                            No registers available. Please create a register first.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Starting Balance <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={startingBalance || ''}
                            onChange={(e) => setStartingBalance(parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Notes (optional)
                        </label>
                        <input
                          type="text"
                          value={shiftNotes}
                          onChange={(e) => setShiftNotes(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Add notes for this shift..."
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleStartShift}
                        disabled={isStarting || !selectedRegisterId}
                        className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center gap-2 disabled:opacity-50 font-medium shadow-sm"
                      >
                        {isStarting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        {isStarting ? 'Starting...' : 'Start Shift'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Close Shift Form */}
                {currentShift && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <StopCircle className="w-5 h-5 text-red-500" />
                      Close Active Shift
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Ending Balance <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={endingBalance || ''}
                            onChange={(e) => setEndingBalance(parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="0.00"
                            autoFocus
                          />
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Expected: {formatCurrency(currentShift.expectedEndingBalance || currentShift.startingBalance)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Notes (optional)
                        </label>
                        <input
                          type="text"
                          value={shiftNotes}
                          onChange={(e) => setShiftNotes(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Closing notes..."
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleCloseShift}
                        disabled={isClosing}
                        className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all flex items-center gap-2 disabled:opacity-50 font-medium shadow-sm"
                      >
                        {isClosing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <StopCircle className="w-4 h-4" />
                        )}
                        {isClosing ? 'Closing...' : 'Close Shift'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content: History */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Shift History
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {shiftHistory.length} shifts
                  </span>
                </div>

                {shiftHistory.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700">
                    <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No shift history available</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Start your first shift to begin tracking</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shiftHistory.map((shift) => (
                      <ShiftHistoryItem
                        key={shift.id}
                        shift={shift}
                        isExpanded={expandedShiftId === shift.id}
                        onToggle={() => toggleShiftExpand(shift.id)}
                        onRefresh={loadAllShiftData}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab Content: Statistics */}
            {activeTab === 'stats' && shiftStats && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Shifts"
                    value={shiftStats.totalShifts}
                    icon={Clock}
                    color="blue"
                  />
                  <StatCard
                    label="Open Shifts"
                    value={shiftStats.openShifts}
                    icon={Play}
                    color="green"
                  />
                  <StatCard
                    label="Total Revenue"
                    value={formatCurrency(shiftStats.totalRevenue)}
                    icon={DollarSign}
                    color="purple"
                  />
                  <StatCard
                    label="Avg. Shift Revenue"
                    value={formatCurrency(shiftStats.averageShiftRevenue)}
                    icon={TrendingUp}
                    color="orange"
                  />
                </div>

                {/* Additional Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Average Shift Duration</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {shiftStats.averageShiftDuration > 0 
                        ? `${Math.floor(shiftStats.averageShiftDuration / 3600)}h ${Math.floor((shiftStats.averageShiftDuration % 3600) / 60)}m`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Closed Shifts</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {shiftStats.closedShifts}
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        / {shiftStats.totalShifts}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Top Cashiers */}
                {shiftStats.topCashiers && shiftStats.topCashiers.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      Top Cashiers
                    </h4>
                    <div className="space-y-2">
                      {shiftStats.topCashiers.map((cashier, index) => (
                        <div
                          key={cashier.userId}
                          className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400">
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {cashier.userName}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {cashier.shiftCount} shifts
                            </span>
                          </div>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(cashier.totalRevenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

// ============================================
// SHIFT HISTORY ITEM
// ============================================

interface ShiftHistoryItemProps {
  shift: Shift;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}

function ShiftHistoryItem({ shift, isExpanded, onToggle, onRefresh }: ShiftHistoryItemProps) {
  const isOpen = shift.status === 'OPEN';
  const isClosed = shift.status === 'CLOSED';
  const hasDiscrepancy = shift.discrepancy && shift.discrepancy !== 0;

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; color: string }> = {
      OPEN: { label: 'Open', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
      CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
      VOID: { label: 'Void', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
      PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
    };
    return configs[status] || configs.PENDING;
  };

  const formatDurationString = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5 text-gray-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-white">
                Shift #{shift.id.slice(-6).toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(shift.status).color}`}>
                {getStatusBadge(shift.status).label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(shift.openedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(shift.openedAt)}
              </span>
              {shift.closedAt && (
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  {formatTime(shift.closedAt)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {shift.user?.firstName || 'Unknown'} {shift.user?.lastName || ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-bold text-gray-900 dark:text-white">
              {formatCurrency(shift.endingBalance || shift.startingBalance)}
            </p>
            {hasDiscrepancy && (
              <p className={`text-xs ${shift.discrepancy! > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {shift.discrepancy! > 0 ? '+' : ''}{formatCurrency(shift.discrepancy!)}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {shift.summary?.totalSales || 0} sales
            </p>
          </div>
          <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Starting Balance</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(shift.startingBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ending Balance</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(shift.endingBalance || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
              <p className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(shift.summary?.totalRevenue || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {shift.closedAt 
                  ? formatDurationString(shift.openedAt, shift.closedAt)
                  : formatDurationString(shift.openedAt)
                }
              </p>
            </div>
          </div>

          {/* Payment Breakdown */}
          {shift.summary && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Payment Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="flex items-center gap-1 text-sm">
                  <Wallet className="w-3 h-3 text-green-500" />
                  <span className="text-gray-600 dark:text-gray-400">Cash:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(shift.summary.cashReceived || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <CreditCard className="w-3 h-3 text-blue-500" />
                  <span className="text-gray-600 dark:text-gray-400">Card:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(shift.summary.cardReceived || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Smartphone className="w-3 h-3 text-purple-500" />
                  <span className="text-gray-600 dark:text-gray-400">Mobile:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(shift.summary.mobileReceived || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Banknote className="w-3 h-3 text-orange-500" />
                  <span className="text-gray-600 dark:text-gray-400">Other:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(shift.summary.otherReceived || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {shift.notes && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{shift.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ICON COMPONENTS
// ============================================

const Smartphone = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className || "w-4 h-4"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 0V3h3V1.5m-3 0V3h3V1.5" />
  </svg>
);

const Banknote = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className || "w-4 h-4"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.21 1.53-.09 1.99-.548l2.392-2.392a2.25 2.25 0 00-.548-1.99A60.07 60.07 0 0018.75 2.25H5.25a60.07 60.07 0 00-2.101 15.797c-.21.727.09 1.53.548 1.99l2.392 2.392a2.25 2.25 0 001.99.548 60.07 60.07 0 0115.797-2.101" />
  </svg>
);

export default ShiftManagerModal;
