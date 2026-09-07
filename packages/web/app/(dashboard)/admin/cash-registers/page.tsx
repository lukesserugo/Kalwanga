// src/app/dashboard/cash-registers/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../../../services/api';
import { useToast } from '../../../../hooks/useToast';
import { formatCurrency } from '../../../../utils/helpers';

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

// Define API response structure
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

export default function CashRegistersPage() {
  const { showToast } = useToast();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStartShift, setShowStartShift] = useState<string | null>(null);
  const [showEndShift, setShowEndShift] = useState<string | null>(null);
  const [startingBalance, setStartingBalance] = useState(0);
  const [endingBalance, setEndingBalance] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRegisters = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get<ApiResponse<CashRegister[]>>('/cash-registers');
      setRegisters(response.data || []);
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Failed to load registers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchRegisters();
  }, [fetchRegisters]);

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
      showToast(error?.response?.data?.message || 'Failed to start shift', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndShift = async (sessionId: string) => {
    try {
      setIsSubmitting(true);
      const response = await apiService.post<ShiftEndResponse>(`/shifts/${sessionId}/end`, {
        endingBalance,
      });
      if (response.success) {
        showToast('Shift ended successfully', 'success');
        setShowEndShift(null);
        setEndingBalance(0);
        fetchRegisters();
      } else {
        showToast(response.message || 'Failed to end shift', 'error');
      }
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Failed to end shift', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cash Registers</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {registers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">No cash registers found</div>
        ) : (
          registers.map((register) => {
            const openSession = register.sessions?.find(s => s.status === 'OPEN');
            return (
              <div key={register.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{register.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{register.code}</p>
                  </div>
                  <span className={`w-3 h-3 rounded-full ${openSession ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Balance</span>
                    <span className="font-bold">{formatCurrency(register.cashBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className={register.isActive ? 'text-green-600' : 'text-red-600'}>
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
                    className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                  >
                    End Shift
                  </button>
                ) : (
                  <button
                    onClick={() => setShowStartShift(register.id)}
                    className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
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
            <label className="block text-sm font-medium mb-1">Starting Balance</label>
            <input
              type="number"
              value={startingBalance}
              onChange={(e) => setStartingBalance(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border rounded-lg text-lg"
              step="0.01"
              min="0"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowStartShift(null)} className="flex-1 py-2 bg-gray-200 rounded-lg">Cancel</button>
              <button
                onClick={() => handleStartShift(showStartShift)}
                disabled={isSubmitting}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
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
            <label className="block text-sm font-medium mb-1">Ending Balance</label>
            <input
              type="number"
              value={endingBalance}
              onChange={(e) => setEndingBalance(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border rounded-lg text-lg"
              step="0.01"
              min="0"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEndShift(null)} className="flex-1 py-2 bg-gray-200 rounded-lg">Cancel</button>
              <button
                onClick={() => handleEndShift(showEndShift)}
                disabled={isSubmitting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
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
