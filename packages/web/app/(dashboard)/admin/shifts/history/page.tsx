// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\shifts\history\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, History, RefreshCw } from 'lucide-react';
import { useShifts } from '../../../../../hooks/useShifts';
import { ShiftHistory } from '../../../../../components/shifts/ShiftHistory';
import { Button } from '../../../../../components/ui/Button';
import { toast } from '../../../../../utils/toast-manager';
import type { ShiftScope } from '../../../../../types/register';

// ============================================
// PAGE
// ============================================

export default function ShiftHistoryPage() {
  const router = useRouter();

  const {
    shifts,
    shiftsTotal,
    shiftsTotalPages,
    fetchShifts,
  } = useShifts();

  const [scope, setScope] = useState<ShiftScope>('businessUnit');
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadShifts = useCallback(
    async (nextScope: ShiftScope, nextPage: number, silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        await fetchShifts({
          scope: nextScope,
          page: nextPage,
          limit: 50,
        });
      } catch (error) {
        console.error('Failed to load shift history:', error);
        toast.error('Failed to load shift history');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchShifts]
  );

  // Initial load
  useEffect(() => {
    loadShifts(scope, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload on scope change
  const handleScopeChange = (nextScope: ShiftScope) => {
    setScope(nextScope);
    setPage(1);
    loadShifts(nextScope, 1);
  };

  // Reload on page change
  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    loadShifts(scope, nextPage, true);
  };

  const handleRefresh = () => {
    loadShifts(scope, page, true);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/shifts')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              aria-label="Back to Shifts"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2">
                <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Shift History
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  Review past shifts across your business
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/shifts')}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Back to Shifts
            </Button>
          </div>
        </div>

        {/* History table — ShiftHistory already handles empty state,
            search, filters, pagination, and loading. */}
        <ShiftHistory
          shifts={shifts}
          scope={scope}
          onScopeChange={handleScopeChange}
          currentPage={page}
          totalPages={shiftsTotalPages}
          total={shiftsTotal}
          onPageChange={handlePageChange}
          onViewShift={(shift) => {
            // ShiftHistory doesn't yet have a detail view. Log for
            // now, or wire a modal later.
            console.log('View shift:', shift);
          }}
          isLoading={loading}
        />
      </div>
    </div>
  );
}
