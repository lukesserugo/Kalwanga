// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\shifts\stats\page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, RefreshCw } from 'lucide-react';
import { useShifts } from '../../../../../hooks/useShifts';
import { ShiftStats } from '../../../../../components/shifts/ShiftStats';
import { Button } from '../../../../../components/ui/Button';
import { toast } from '../../../../../utils/toast-manager';

// ============================================
// PAGE
// ============================================

export default function ShiftStatsPage() {
  const router = useRouter();

  const {
    stats,
    currentShift,
    fetchStats,
    fetchCurrentShift,
  } = useShifts();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        await Promise.all([fetchStats(), fetchCurrentShift()]);
      } catch (error) {
        console.error('Failed to load shift stats:', error);
        toast.error('Failed to load shift statistics');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchStats, fetchCurrentShift]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/shifts')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 focus-ring"
              aria-label="Back to Shifts"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-secondary-50 dark:bg-secondary-900/30 rounded-lg p-2">
                <BarChart3 className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Shift Statistics
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  Revenue, durations, and top-performing cashiers
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

        {/* Stats cards. ShiftStats handles loading by rendering the
            same card structure with `0` values while stats is default. */}
        <ShiftStats stats={stats} currentShift={currentShift} />

        {/* Top cashiers table — derived from stats.topCashiers */}
        {stats?.topCashiers && stats.topCashiers.length > 0 && (
          <div className="card-brand p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Top Cashiers
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ranked by total revenue this period
              </p>
            </div>
            <div className="overflow-x-auto sidebar-scroll">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cashier
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Shifts
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {stats.topCashiers.map((cashier, index) => (
                    <tr
                      key={cashier.userId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold tabular-nums ${
                            index === 0
                              ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
                              : index === 1
                              ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              : index === 2
                              ? 'bg-brand-accent-100 text-brand-accent-700 dark:bg-brand-accent-900/30 dark:text-brand-accent-300'
                              : 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {cashier.userName}
                      </td>
                      <td className="px-6 py-3 text-sm text-right text-gray-600 dark:text-gray-300 tabular-nums">
                        {cashier.shiftCount}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white tabular-nums">
                        {formatCurrencySafe(cashier.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Small local formatter to avoid an extra import in the top block.
function formatCurrencySafe(n: number | undefined | null): string {
  const value = typeof n === 'number' ? n : 0;
  return `$${value.toFixed(2)}`;
}
