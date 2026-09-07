// src/app/dashboard/shifts/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../../../services/api';
import { useToast } from '../../../../hooks/useToast';
import { formatCurrency } from '../../../../utils/helpers';

interface Shift {
  id: string;
  cashRegister: { name: string };
  user: { firstName: string; lastName: string };
  openedAt: string;
  closedAt: string | null;
  startingBalance: number;
  endingBalance: number | null;
  expectedEndingBalance: number | null;
  status: string;
}

// Define API response structure
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export default function ShiftsPage() {
  const { showToast } = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get<ApiResponse<Shift[]>>('/shifts/all');
      setShifts(response.data || []);
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Failed to load shifts', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Shifts</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Register</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opened</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Starting</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ending</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {shifts.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No shifts found</td></tr>
            ) : (
              shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">{shift.cashRegister?.name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm">{shift.user?.firstName} {shift.user?.lastName}</td>
                  <td className="px-6 py-4 text-sm">{new Date(shift.openedAt).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">{shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'Open'}</td>
                  <td className="px-6 py-4 text-sm">{formatCurrency(shift.startingBalance)}</td>
                  <td className="px-6 py-4 text-sm">{shift.endingBalance ? formatCurrency(shift.endingBalance) : 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${shift.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {shift.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
