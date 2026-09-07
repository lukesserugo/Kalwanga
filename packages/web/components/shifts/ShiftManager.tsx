// src/components/shifts/ShiftManager.tsx
import React, { useState, useEffect } from 'react';
import {
  Clock, DollarSign, User, Calendar, CheckCircle,
  XCircle, AlertCircle, RefreshCw, Plus,
  TrendingUp, TrendingDown, Printer,
  ShoppingBag // Add ShoppingBag import
} from 'lucide-react';
import { shiftService } from '../../services/shiftService';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';

// Define types
interface CashRegister {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  cashBalance: number;
  businessUnitId: string;
}

interface CashRegisterSession {
  id: string;
  cashRegisterId: string;
  cashRegister?: CashRegister;
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  endingBalance?: number;
  expectedEndingBalance?: number;
  discrepancy?: number;
  discrepancyReason?: string;
  notes?: string;
  status: string;
  sales?: Array<{ id: string; total: number }>;
  payments?: Array<{ id: string; amount: number; paymentMethod: string }>;
  cashTransactions?: Array<{ id: string; type: string; amount: number }>;
}

export function ShiftManager() {
  const [currentShift, setCurrentShift] = useState<CashRegisterSession | null>(null);
  const [shifts, setShifts] = useState<CashRegisterSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [openData, setOpenData] = useState({
    cashRegisterId: '',
    startingBalance: 0,
  });
  const [closeData, setCloseData] = useState({
    endingBalance: 0,
    notes: '',
  });
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [selectedShift, setSelectedShift] = useState<CashRegisterSession | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shift, allShifts, registerList] = await Promise.all([
        shiftService.getCurrentShift(),
        shiftService.getAllShifts(),
        shiftService.getRegisters(),
      ]);
      setCurrentShift(shift);
      setShifts(allShifts || []);
      setRegisters(registerList || []);
    } catch (error) {
      console.error('Failed to load shift data:', error);
      toast.error('Failed to load shift data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async () => {
    if (!openData.cashRegisterId || openData.startingBalance < 0) {
      toast.warning('Please fill in all fields');
      return;
    }
    try {
      await shiftService.startShift({
        cashRegisterId: openData.cashRegisterId,
        startingBalance: openData.startingBalance,
      });
      toast.success('Shift opened successfully');
      setShowOpenModal(false);
      loadData();
    } catch (error) {
      toast.error('Failed to open shift');
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    if (closeData.endingBalance < 0) {
      toast.warning('Please enter a valid ending balance');
      return;
    }
    try {
      await shiftService.endShift(currentShift.id, {
        endingBalance: closeData.endingBalance,
        notes: closeData.notes,
      });
      toast.success('Shift closed successfully');
      setShowCloseModal(false);
      loadData();
    } catch (error) {
      toast.error('Failed to close shift');
    }
  };

  const getShiftStats = (shift: CashRegisterSession) => {
    const sales = shift.sales || [];
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
    const cashPayments = shift.payments?.filter((p: any) => p.paymentMethod === 'CASH') || [];
    const cashReceived = cashPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    return { totalSales, totalRevenue, cashReceived };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-gray-600 mt-1">Manage cash register shifts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {!currentShift ? (
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Open Shift
            </button>
          ) : (
            <button
              onClick={() => setShowCloseModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Close Shift
            </button>
          )}
        </div>
      </div>

      {/* Current Shift Card */}
      {currentShift ? (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6" />
                <h2 className="text-xl font-bold">Current Shift</h2>
                <span className="px-2 py-1 bg-green-500 rounded-full text-xs font-medium">
                  OPEN
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-8">
                <div>
                  <p className="text-blue-200 text-sm">Cash Register</p>
                  <p className="text-lg font-semibold">
                    {currentShift.cashRegister?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Started</p>
                  <p className="text-lg font-semibold">
                    {new Date(currentShift.openedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-blue-200 text-sm">Starting Balance</p>
                  <p className="text-lg font-semibold">
                    ${currentShift.startingBalance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-sm">Cashier</p>
              <p className="text-lg font-semibold">
                {currentShift.user?.firstName} {currentShift.user?.lastName}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-xl p-6 text-center mb-6">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No shift currently open</p>
          <p className="text-sm text-gray-400">Open a new shift to start</p>
        </div>
      )}

      {/* Shift Stats */}
      {currentShift && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Sales</p>
                <p className="text-xl font-bold">{getShiftStats(currentShift).totalSales}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-xl font-bold">
                  ${getShiftStats(currentShift).totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Cash Received</p>
                <p className="text-xl font-bold">
                  ${getShiftStats(currentShift).cashReceived.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Shifts */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Recent Shifts</h3>
        </div>
        <div className="divide-y">
          {shifts.slice(0, 5).map((shift) => (
            <div key={shift.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    shift.status === 'OPEN' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {shift.status === 'OPEN' ? (
                      <Clock className="w-5 h-5 text-green-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {shift.cashRegister?.name || 'Register'} - {shift.status}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        Opened: {new Date(shift.openedAt).toLocaleString()}
                      </span>
                      {shift.closedAt && (
                        <span>
                          Closed: {new Date(shift.closedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Starting Balance</p>
                    <p className="font-medium">${shift.startingBalance.toFixed(2)}</p>
                  </div>
                  {shift.endingBalance !== undefined && shift.endingBalance !== null && (
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Ending Balance</p>
                      <p className="font-medium">${shift.endingBalance.toFixed(2)}</p>
                    </div>
                  )}
                  {shift.discrepancy !== undefined && shift.discrepancy !== null && (
                    <div className={`text-right ${
                      shift.discrepancy === 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <p className="text-sm">Discrepancy</p>
                      <p className="font-medium">
                        {shift.discrepancy === 0 ? '✓' : `${shift.discrepancy > 0 ? '+' : ''}${shift.discrepancy.toFixed(2)}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Open Shift Modal */}
      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Open Shift"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cash Register *
            </label>
            <select
              value={openData.cashRegisterId}
              onChange={(e) => setOpenData({ ...openData, cashRegisterId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Register</option>
              {registers.map((reg) => (
                <option key={reg.id} value={reg.id}>{reg.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Starting Balance *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="number"
                value={openData.startingBalance}
                onChange={(e) => setOpenData({ ...openData, startingBalance: parseFloat(e.target.value) || 0 })}
                step="0.01"
                min="0"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowOpenModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleOpenShift}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Open Shift
            </button>
          </div>
        </div>
      </Modal>

      {/* Close Shift Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Close Shift"
      >
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Starting Balance</span>
              <span className="font-medium">${currentShift?.startingBalance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-600">Total Sales</span>
              <span className="font-medium">{currentShift ? getShiftStats(currentShift).totalSales : 0}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-600">Revenue</span>
              <span className="font-medium">${currentShift ? getShiftStats(currentShift).totalRevenue.toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-600">Cash Received</span>
              <span className="font-medium">${currentShift ? getShiftStats(currentShift).cashReceived.toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex justify-between mt-2 pt-2 border-t font-bold">
              <span>Expected Balance</span>
              <span>
                ${(currentShift?.startingBalance || 0 + (currentShift ? getShiftStats(currentShift).cashReceived : 0)).toFixed(2)}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ending Balance *
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="number"
                value={closeData.endingBalance}
                onChange={(e) => setCloseData({ ...closeData, endingBalance: parseFloat(e.target.value) || 0 })}
                step="0.01"
                min="0"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={closeData.notes}
              onChange={(e) => setCloseData({ ...closeData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Any notes about this shift..."
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowCloseModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseShift}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Close Shift
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
