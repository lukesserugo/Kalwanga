// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\shifts\current\page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, RefreshCw, AlertCircle, User } from 'lucide-react';
import { useShifts } from '../../../../../hooks/useShifts';
import { CurrentShiftCard } from '../../../../../components/shifts/CurrentShiftCard';
import { NoActiveShiftCard } from '../../../../../components/shifts/NoActiveShiftCard';
import { ShiftsDashboardSkeleton } from '../../../../../components/shifts/ShiftsDashboardSkeleton';
import { Button } from '../../../../../components/ui/Button';
import Card from '../../../../../components/ui/Card';
import { Badge } from '../../../../../components/ui/Badge';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDateTime } from '../../../../../utils/formatters';

// ============================================
// PAGE
// ============================================

export default function CurrentShiftPage() {
  const router = useRouter();

  const {
    currentShift,
    registers,
    isLoading,
    fetchCurrentShift,
    fetchRegisters,
    fetchStats,
    endShift,
    addCash,
    removeCash,
  } = useShifts();

  const [refreshing, setRefreshing] = useState(false);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = useCallback(async () => {
    try {
      await Promise.all([
        fetchCurrentShift(),
        fetchRegisters(),
        fetchStats(),
      ]);
    } catch (error) {
      console.error('Failed to load current shift:', error);
    }
  }, [fetchCurrentShift, fetchRegisters, fetchStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      toast.success('Current shift refreshed');
    } finally {
      setRefreshing(false);
    }
  };

  // ============================================
  // DERIVED — is someone else's shift open?
  // ============================================
  //
  // `currentShift` only reflects THIS user's open session. If it's
  // null but some register has `isOpen === true`, another user is
  // currently on shift. Show a distinct card so the page doesn't
  // tell the user "no active shift" when one clearly exists.

  const otherUserShift = useMemo(() => {
    if (currentShift) return null;
    return (
      registers.find(
        (r: any) =>
          r.isOpen === true ||
          (r.currentSession && r.currentSession.id)
      ) || null
    );
  }, [currentShift, registers]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleEndShift = useCallback(
    async (
      id: string,
      data: { endingBalance: number; notes?: string }
    ): Promise<void> => {
      try {
        await endShift(id, data);
        toast.success('Shift ended successfully');
        await loadData();
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to end shift';
        toast.error(message);
        throw error;
      }
    },
    [endShift, loadData]
  );

  const handleAddCash = useCallback(
    async (amount: number, description?: string): Promise<void> => {
      if (!currentShift) throw new Error('No active shift');
      try {
        await addCash(currentShift.id, { amount, description });
        toast.success('Cash added successfully');
        await loadData();
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to add cash';
        toast.error(message);
        throw error;
      }
    },
    [currentShift, addCash, loadData]
  );

  const handleRemoveCash = useCallback(
    async (amount: number, description?: string): Promise<void> => {
      if (!currentShift) throw new Error('No active shift');
      try {
        await removeCash(currentShift.id, { amount, description });
        toast.success('Cash removed successfully');
        await loadData();
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Failed to remove cash';
        toast.error(message);
        throw error;
      }
    },
    [currentShift, removeCash, loadData]
  );

  // ============================================
  // RENDER
  // ============================================

  if (isLoading && !currentShift && registers.length === 0) {
    return <ShiftsDashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-200">
      <div className="max-w-5xl mx-auto space-y-6">
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
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Current Shift
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  Manage the currently active shift
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

        {/* Content — three states */}
        {currentShift ? (
          <CurrentShiftCard
            shift={currentShift}
            onEndShift={handleEndShift}
            onAddCash={handleAddCash}
            onRemoveCash={handleRemoveCash}
          />
        ) : otherUserShift ? (
          <OtherUserShiftCard
            register={otherUserShift}
            onGoToRegisters={() => router.push('/admin/shifts/registers/manage')}
            onGoToHistory={() => router.push('/admin/shifts/history')}
          />
        ) : (
          <NoActiveShiftCard />
        )}
      </div>
    </div>
  );
}

// ============================================
// LOCAL SUB-COMPONENT — other user's shift
// ============================================
//
// Not exported. Lives here because it's specific to this page.
// If you need it elsewhere, lift it into `components/shifts/`.

function OtherUserShiftCard({
  register,
  onGoToRegisters,
  onGoToHistory,
}: {
  register: any;
  onGoToRegisters: () => void;
  onGoToHistory: () => void;
}) {
  const session = register.currentSession;
  const user = register.sessionUser;

  return (
    <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start gap-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 flex-shrink-0">
          <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Shift in progress by another user
            </h2>
            <Badge variant="warning">In Use</Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            You don't have an active shift, but{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {register.name}
            </span>{' '}
            is currently open by another cashier. You cannot start a new
            shift until that one is closed.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Register
              </p>
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {register.name}
              </p>
              <p className="text-xs text-gray-400 font-mono">
                {register.code}
              </p>
            </div>
            {user && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cashier
                </p>
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
              </div>
            )}
            {session?.openedAt && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Opened
                </p>
                <p className="font-medium text-sm text-gray-900 dark:text-white">
                  {formatDateTime(session.openedAt)}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={onGoToRegisters}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Go to Registers
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onGoToHistory}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              View Shift History
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
