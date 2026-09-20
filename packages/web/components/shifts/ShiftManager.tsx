// D:\Projects\Kalwanga\packages\web\components\shifts\ShiftManager.tsx
'use client';

import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  TrendingUp,
  ShoppingBag,
} from 'lucide-react';
import { shiftService } from '../../services/shiftService';
import { Button } from '../ui/Button';
import { Label } from '../ui/Label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

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

// ============================================
// MAIN COMPONENT
// ============================================

export function ShiftManager() {
  const [currentShift, setCurrentShift] = useState<CashRegisterSession | null>(
    null
  );
  const [shifts, setShifts] = useState<CashRegisterSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [openData, setOpenData] = useState({
    cashRegisterId: '',
    startingBalance: 0,
  });
  const [closeData, setCloseData] = useState({
    endingBalance: 0,
    notes: '',
  });
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [selectedShift, setSelectedShift] =
    useState<CashRegisterSession | null>(null);

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
      setShifts(allShifts?.shifts || []);
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
    const totalRevenue = sales.reduce(
      (sum: number, s: any) => sum + (s.total || 0),
      0
    );
    const cashPayments =
      shift.payments?.filter((p: any) => p.paymentMethod === 'CASH') || [];
    const cashReceived = cashPayments.reduce(
      (sum: number, p: any) => sum + p.amount,
      0
    );
    return { totalSales, totalRevenue, cashReceived };
  };

  const handleOpenDataChange = (
    e: ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setOpenData((prev) => ({
      ...prev,
      [name]: name === 'cashRegisterId' ? value : parseFloat(value) || 0,
    }));
  };

  const handleCloseDataChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCloseData((prev) => ({
      ...prev,
      [name]: name === 'endingBalance' ? parseFloat(value) || 0 : value,
    }));
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 dark:border-brand-400" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Shift Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage cash register shifts
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors duration-200 focus-ring"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            {!currentShift ? (
              <button
                onClick={() => setShowOpenModal(true)}
                className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 dark:bg-success-600 dark:hover:bg-success-700 flex items-center gap-2 transition-colors duration-200 focus-ring"
              >
                <Plus className="w-4 h-4" />
                Open Shift
              </button>
            ) : (
              <button
                onClick={() => setShowCloseModal(true)}
                className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 dark:bg-danger-600 dark:hover:bg-danger-700 flex items-center gap-2 transition-colors duration-200 focus-ring"
              >
                <XCircle className="w-4 h-4" />
                Close Shift
              </button>
            )}
          </div>
        </div>

        {/* Current Shift Card */}
        {currentShift ? (
          <div className="bg-brand-gradient-hero rounded-xl shadow-brand-lg p-6 text-white transition-colors duration-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Current Shift</h2>
                  <span className="px-2 py-1 bg-success-500 rounded-full text-2xs font-medium animate-badge-pop">
                    OPEN
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-white/70 text-sm">Cash Register</p>
                    <p className="text-lg font-semibold">
                      {currentShift.cashRegister?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">Started</p>
                    <p className="text-lg font-semibold">
                      {new Date(currentShift.openedAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">Starting Balance</p>
                    <p className="text-lg font-semibold tabular-nums">
                      ${currentShift.startingBalance.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-left lg:text-right">
                <p className="text-white/70 text-sm">Cashier</p>
                <p className="text-lg font-semibold">
                  {currentShift.user?.firstName} {currentShift.user?.lastName}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 text-center border border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <Clock className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No shift currently open
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Open a new shift to start
            </p>
          </div>
        )}

        {/* Shift Stats */}
        {currentShift && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-brand p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-100 dark:bg-brand-950/40 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <p className="text-2xs text-gray-500 dark:text-gray-400">
                    Total Sales
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {getShiftStats(currentShift).totalSales}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-brand p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success-100 dark:bg-success-950/40 rounded-lg">
                  <DollarSign className="w-5 h-5 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <p className="text-2xs text-gray-500 dark:text-gray-400">
                    Revenue
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                    ${getShiftStats(currentShift).totalRevenue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-brand p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning-100 dark:bg-warning-950/40 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                </div>
                <div>
                  <p className="text-2xs text-gray-500 dark:text-gray-400">
                    Cash Received
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                    ${getShiftStats(currentShift).cashReceived.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Shifts */}
        <div className="card-brand p-0 overflow-hidden shadow-soft">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Recent Shifts
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {shifts.slice(0, 5).map((shift) => (
              <div
                key={shift.id}
                className="p-4 hover:bg-brand-50/40 dark:hover:bg-gray-700/50 transition-colors duration-150"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        shift.status === 'OPEN'
                          ? 'bg-success-100 dark:bg-success-950/40'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      {shift.status === 'OPEN' ? (
                        <Clock className="w-5 h-5 text-success-600 dark:text-success-400" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {shift.cashRegister?.name || 'Register'} - {shift.status}
                      </p>
                      <div className="flex items-center gap-4 text-2xs text-gray-500 dark:text-gray-400">
                        <span className="tabular-nums">
                          Opened: {new Date(shift.openedAt).toLocaleString()}
                        </span>
                        {shift.closedAt && (
                          <span className="tabular-nums">
                            Closed: {new Date(shift.closedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xs text-gray-500 dark:text-gray-400">
                        Starting Balance
                      </p>
                      <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                        ${shift.startingBalance.toFixed(2)}
                      </p>
                    </div>
                    {shift.endingBalance !== undefined &&
                      shift.endingBalance !== null && (
                        <div className="text-right">
                          <p className="text-2xs text-gray-500 dark:text-gray-400">
                            Ending Balance
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                            ${shift.endingBalance.toFixed(2)}
                          </p>
                        </div>
                      )}
                    {shift.discrepancy !== undefined &&
                      shift.discrepancy !== null && (
                        <div
                          className={`text-right ${
                            shift.discrepancy === 0
                              ? 'text-success-600 dark:text-success-400'
                              : 'text-danger-600 dark:text-danger-400'
                          }`}
                        >
                          <p className="text-2xs">Discrepancy</p>
                          <p className="font-medium tabular-nums">
                            {shift.discrepancy === 0
                              ? '✓'
                              : `${shift.discrepancy > 0 ? '+' : ''}${shift.discrepancy.toFixed(2)}`}
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Shift Modal */}
      <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Open Shift
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Start a new shift for a cash register.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">
                Cash Register *
              </Label>
              <select
                name="cashRegisterId"
                value={openData.cashRegisterId}
                onChange={handleOpenDataChange}
                className="input-brand"
              >
                <option value="">Select Register</option>
                {registers.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">
                Starting Balance *
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <input
                  type="number"
                  name="startingBalance"
                  value={openData.startingBalance}
                  onChange={handleOpenDataChange}
                  step="0.01"
                  min="0"
                  className="input-brand pl-10 tabular-nums"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowOpenModal(false)}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus-ring"
            >
              Cancel
            </Button>
            <Button
              onClick={handleOpenShift}
              className="btn-brand focus-ring"
            >
              Open Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Modal */}
      <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Close Shift
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Close the current shift and finalize the register.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>Starting Balance</span>
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  ${currentShift?.startingBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between mt-1 text-gray-700 dark:text-gray-300">
                <span>Total Sales</span>
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  {currentShift ? getShiftStats(currentShift).totalSales : 0}
                </span>
              </div>
              <div className="flex justify-between mt-1 text-gray-700 dark:text-gray-300">
                <span>Revenue</span>
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  ${currentShift
                    ? getShiftStats(currentShift).totalRevenue.toFixed(2)
                    : '0.00'}
                </span>
              </div>
              <div className="flex justify-between mt-1 text-gray-700 dark:text-gray-300">
                <span>Cash Received</span>
                <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                  ${currentShift
                    ? getShiftStats(currentShift).cashReceived.toFixed(2)
                    : '0.00'}
                </span>
              </div>
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 font-bold text-gray-900 dark:text-white">
                <span>Expected Balance</span>
                <span className="tabular-nums">
                  $
                  {(
                    currentShift?.startingBalance ||
                    0 + (currentShift
                      ? getShiftStats(currentShift).cashReceived
                      : 0)
                  ).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">
                Ending Balance *
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <input
                  type="number"
                  name="endingBalance"
                  value={closeData.endingBalance}
                  onChange={handleCloseDataChange}
                  step="0.01"
                  min="0"
                  className="input-brand pl-10 tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Notes</Label>
              <textarea
                name="notes"
                value={closeData.notes}
                onChange={handleCloseDataChange}
                rows={3}
                className="input-brand"
                placeholder="Any notes about this shift..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCloseModal(false)}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus-ring"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseShift}
              className="bg-danger-600 hover:bg-danger-700 dark:bg-danger-600 dark:hover:bg-danger-700 text-white focus-ring"
            >
              Close Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ShiftManager;
