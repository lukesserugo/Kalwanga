// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\shifts\cash\page.tsx

'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  DollarSign,
  RefreshCw,
  Plus,
  Minus,
  User,
  AlertCircle,
} from 'lucide-react';
import { useShifts } from '../../../../../hooks/useShifts';
import Card from '../../../../../components/ui/Card';
import { Button } from '../../../../../components/ui/Button';
import { Badge } from '../../../../../components/ui/Badge';
import { Input } from '../../../../../components/ui/Input';
import { Label } from '../../../../../components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../components/ui/Dialog';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDateTime } from '../../../../../utils/formatters';

// ============================================
// PAGE
// ============================================

export default function ShiftCashPage() {
  const router = useRouter();

  const {
    registers,
    isLoading,
    fetchRegisters,
    fetchCurrentShift,
    addCash,
    removeCash,
  } = useShifts();

  const [refreshing, setRefreshing] = useState(false);
  const [cashModal, setCashModal] = useState<{
    register: any;
    sessionId: string;
    type: 'add' | 'remove';
  } | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [cashDescription, setCashDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ============================================
  // DATA LOADING
  // ============================================

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(false);
      try {
        await Promise.all([fetchRegisters(), fetchCurrentShift()]);
      } catch (error) {
        console.error('Failed to load cash data:', error);
        toast.error('Failed to load cash data');
      }
    },
    [fetchRegisters, fetchCurrentShift]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
    toast.success('Cash data refreshed');
  };

  // ============================================
  // DERIVED — only registers with an open session
  // ============================================

  const openRegisters = registers.filter((r: any) => {
    return (
      r.isOpen === true ||
      (r.currentSession && r.currentSession.id) ||
      (r.sessionUser && r.currentSession)
    );
  });

  // ============================================
  // HANDLERS
  // ============================================

  const openCashModal = (register: any, type: 'add' | 'remove') => {
    const sessionId =
      register.currentSession?.id ||
      register.sessionId ||
      register.id;
    setCashModal({ register, sessionId, type });
    setCashAmount('');
    setCashDescription('');
  };

  const closeCashModal = () => {
    setCashModal(null);
    setCashAmount('');
    setCashDescription('');
  };

  const handleCashSubmit = async () => {
    if (!cashModal) return;
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      if (cashModal.type === 'add') {
        await addCash(cashModal.sessionId, {
          amount,
          description: cashDescription || undefined,
        });
        toast.success('Cash added successfully');
      } else {
        await removeCash(cashModal.sessionId, {
          amount,
          description: cashDescription || undefined,
        });
        toast.success('Cash removed successfully');
      }
      closeCashModal();
      await loadData(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to process cash transaction';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCashAmount(e.target.value);
  };

  const handleDescriptionChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCashDescription(e.target.value);
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
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
              aria-label="Back to Shifts"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-2">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Cash Management
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  Add or remove cash from open registers
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
              onClick={() => router.push('/admin/shifts/current')}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              View Current Shift
            </Button>
          </div>
        </div>

        {/* Info banner */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">Cash transactions</p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                Cash additions and removals are logged against the open
                shift session. Only registers with an active session can
                receive cash transactions.
              </p>
            </div>
          </div>
        </Card>

        {/* Open registers list */}
        {openRegisters.length === 0 ? (
          <Card className="p-12 text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <DollarSign className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              No open registers
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
              There are no active shifts. Start a shift from the registers
              tab to enable cash management.
            </p>
            <Button
              onClick={() => router.push('/admin/shifts/registers/manage')}
              className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Go to Registers
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {openRegisters.map((register: any) => {
              const session = register.currentSession;
              const user = register.sessionUser;

              return (
                <Card
                  key={register.id}
                  className="p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {register.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {register.code}
                      </p>
                    </div>
                    <Badge variant="success">Open</Badge>
                  </div>

                  {/* Cashier info */}
                  {user && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <User className="w-4 h-4" />
                      <span className="truncate">
                        {user.firstName} {user.lastName}
                      </span>
                      {session?.openedAt && (
                        <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                          since {formatDateTime(session.openedAt)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Balance */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Current Balance
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(register.cashBalance || 0)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCashModal(register, 'add')}
                      className="flex-1 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Cash
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCashModal(register, 'remove')}
                      className="flex-1 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    >
                      <Minus className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Cash dialog */}
      <Dialog
        open={cashModal !== null}
        onOpenChange={(open) => !open && closeCashModal()}
      >
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              {cashModal?.type === 'add' ? 'Add Cash' : 'Remove Cash'}
              {cashModal?.register?.name
                ? ` — ${cashModal.register.name}`
                : ''}
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Enter the amount and reason for this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label
                htmlFor="cashAmount"
                className="text-gray-700 dark:text-gray-300"
              >
                Amount
              </Label>
              <Input
                id="cashAmount"
                type="number"
                placeholder="0.00"
                value={cashAmount}
                onChange={handleAmountChange}
                min="0.01"
                step="0.01"
                autoFocus
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="cashDescription"
                className="text-gray-700 dark:text-gray-300"
              >
                Description (optional)
              </Label>
              <Input
                id="cashDescription"
                placeholder="Reason for transaction"
                value={cashDescription}
                onChange={handleDescriptionChange}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCashModal}
              disabled={submitting}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCashSubmit}
              disabled={submitting || !cashAmount || parseFloat(cashAmount) <= 0}
              className={`text-white ${
                cashModal?.type === 'add'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {submitting
                ? 'Processing...'
                : cashModal?.type === 'add'
                ? 'Add Cash'
                : 'Remove Cash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
