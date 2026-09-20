// src/app/dashboard/cash-registers/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../../../services/api';
import { useToast } from '../../../../hooks/useToast';
import { formatCurrency } from '../../../../utils/helpers';

// ============================================
// TYPES
// ============================================

interface CashRegister {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  cashBalance: number;
  sessions: Array<{
    id: string;
    status: string;
    startingBalance: number;
    endingBalance: number;
    openedAt: string;
    closedAt: string;
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ShiftStartResponse {
  success: boolean;
  data: {
    id: string;
    cashRegisterId: string;
    startingBalance: number;
    openedAt: string;
    status: string;
  };
  message?: string;
}

interface ShiftEndResponse {
  success: boolean;
  data: {
    id: string;
    cashRegisterId: string;
    startingBalance: number;
    endingBalance: number;
    closedAt: string;
    status: string;
  };
  message?: string;
}

// ============================================
// COMPONENT
// ============================================

export default function CashRegistersPage() {
  const { showToast } = useToast();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStartShift, setShowStartShift] = useState<string | null>(null);
  const [showEndShift, setShowEndShift] = useState<string | null>(null);
  const [startingBalance, setStartingBalance] = useState(0);
  const [endingBalance, setEndingBalance] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================
  // DATA FETCHING
  // ============================================
  //
  // ⚠️ The `/cash-registers` endpoint is not yet registered on the
  //    backend. When it returns 404, we degrade gracefully: render
  //    the empty state instead of toasting an error and flooding the
  //    console. The moment the backend route lands, this page will
  //    populate automatically — no frontend change required.

  const fetchRegisters = useCallback(async () => {
    try {
      setLoading(true);

      // The api service returns the unwrapped body. Depending on the
      // route's shape it may come back as:
      //   • { success, data: CashRegister[] }
      //   • { success, data: { cashRegisters: CashRegister[] } }
      //   • a bare CashRegister[]
      // Normalise all three cases.
      const response = await apiService.get<any>('/cash-registers');

      let list: CashRegister[] = [];
      if (Array.isArray(response)) {
        list = response;
      } else if (Array.isArray(response?.data)) {
        list = response.data;
      } else if (Array.isArray(response?.data?.cashRegisters)) {
        list = response.data.cashRegisters;
      } else if (Array.isArray(response?.cashRegisters)) {
        list = response.cashRegisters;
      }

      setRegisters(list);
    } catch (error: any) {
      // ✅ Graceful 404 handling: the route doesn't exist yet. Treat
      //    it as "no registers configured" instead of an error.
      if (error?.response?.status === 404) {
        setRegisters([]);
        return;
      }

      // Any other failure is genuinely worth surfacing.
      showToast(
        error?.response?.data?.message || 'Failed to load registers',
        'error'
      );
      setRegisters([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRegisters();
  }, [fetchRegisters]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleStartShift = async (registerId: string) => {
    try {
      setIsSubmitting(true);
      const response = await apiService.post<ShiftStartResponse>('/shifts/start', {
        cashRegisterId: registerId,
        startingBalance,
      });
      if (response.success) {
        showToast('Shift started successfully', 'success');
        setShowStartShift(null);
        setStartingBalance(0);
        fetchRegisters();
      } else {
        showToast(response.message || 'Failed to start shift', 'error');
      }
    } catch (error: any) {
      showToast(
        error?.response?.data?.message || 'Failed to start shift',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndShift = async (sessionId: string) => {
    try {
      setIsSubmitting(true);
      const response = await apiService.post<ShiftEndResponse>(
        `/shifts/${sessionId}/end`,
        { endingBalance }
      );
      if (response.success) {
        showToast('Shift ended successfully', 'success');
        setShowEndShift(null);
        setEndingBalance(0);
        fetchRegisters();
      } else {
        showToast(response.message || 'Failed to end shift', 'error');
      }
    } catch (error: any) {
      showToast(
        error?.response?.data?.message || 'Failed to end shift',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-brand-600 rounded-full"></div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cash Registers</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {registers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No cash registers found
          </div>
        ) : (
          registers.map((register) => {
            const openSession = register.sessions?.find(
              (s) => s.status === 'OPEN'
            );
            return (
              <div key={register.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{register.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">
                      {register.code}
                    </p>
                  </div>
                  <span
                    className={`w-3 h-3 rounded-full ${
                      openSession ? 'bg-success-500' : 'bg-gray-300'
                    }`}
                  />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Balance</span>
                    <span className="font-bold tabular-nums">
                      {formatCurrency(register.cashBalance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span
                      className={
                        register.isActive ? 'text-success-600' : 'text-brand-accent-600'
                      }
                    >
                      {register.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {openSession ? (
                  <button
                    onClick={() => {
                      setShowEndShift(openSession.id);
                      setEndingBalance(register.cashBalance);
                    }}
                    className="w-full bg-brand-accent-600 text-white py-2 rounded-lg hover:bg-brand-accent-700 focus-ring transition-colors shadow-brand"
                  >
                    End Shift
                  </button>
                ) : (
                  <button
                    onClick={() => setShowStartShift(register.id)}
                    className="w-full bg-success-600 text-white py-2 rounded-lg hover:bg-success-700 focus-ring transition-colors shadow-brand"
                  >
                    Start Shift
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Start Shift Modal */}
      {showStartShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-xl font-bold mb-4">Start Shift</h3>
            <label className="block text-sm font-medium mb-1">
              Starting Balance
            </label>
            <input
              type="number"
              value={startingBalance}
              onChange={(e) =>
                setStartingBalance(parseFloat(e.target.value) || 0)
              }
              className="w-full px-4 py-2 border rounded-lg text-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none transition-colors tabular-nums"
              step="0.01"
              min="0"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowStartShift(null)}
                className="flex-1 py-2 bg-gray-200 rounded-lg focus-ring hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStartShift(showStartShift)}
                disabled={isSubmitting}
                className="flex-1 py-2 bg-success-600 text-white rounded-lg disabled:opacity-50 focus-ring hover:bg-success-700 transition-colors shadow-brand"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Shift Modal */}
      {showEndShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-xl font-bold mb-4">End Shift</h3>
            <label className="block text-sm font-medium mb-1">
              Ending Balance
            </label>
            <input
              type="number"
              value={endingBalance}
              onChange={(e) =>
                setEndingBalance(parseFloat(e.target.value) || 0)
              }
              className="w-full px-4 py-2 border rounded-lg text-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none transition-colors tabular-nums"
              step="0.01"
              min="0"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEndShift(null)}
                className="flex-1 py-2 bg-gray-200 rounded-lg focus-ring hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEndShift(showEndShift)}
                disabled={isSubmitting}
                className="flex-1 py-2 bg-brand-accent-600 text-white rounded-lg disabled:opacity-50 focus-ring hover:bg-brand-accent-700 transition-colors shadow-brand"
              >
                End Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
