// D:\Projects\Kalwanga\packages\web\components\shifts\CurrentShiftCard.tsx
'use client';

import { useState, ChangeEvent } from 'react';
import {
  Clock,
  DollarSign,
  Receipt,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
} from 'lucide-react';
import Card from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
} from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface Shift {
  id: string;
  cashRegisterId?: string;
  cashRegister?: {
    name: string;
  };
  user?: {
    firstName: string;
    lastName: string;
  };
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  endingBalance?: number;
  expectedBalance?: number;
  totalSales?: number;
  totalRevenue?: number;
  cashReceived?: number;
  [key: string]: any;
}

interface CurrentShiftCardProps {
  shift: Shift;
  onEndShift: (id: string, data: any) => Promise<void>;
  onAddCash: (amount: number, description?: string) => Promise<void>;
  onRemoveCash: (amount: number, description?: string) => Promise<void>;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CurrentShiftCard({
  shift,
  onEndShift,
  onAddCash,
  onRemoveCash,
}: CurrentShiftCardProps) {
  const [showEndShiftDialog, setShowEndShiftDialog] = useState<boolean>(false);
  const [endingBalance, setEndingBalance] = useState<string>('');
  const [endingNotes, setEndingNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showCashDialog, setShowCashDialog] = useState<boolean>(false);
  const [cashAction, setCashAction] = useState<'add' | 'remove'>('add');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashDescription, setCashDescription] = useState<string>('');

  if (!shift) return null;

  // ============================================
  // HANDLERS
  // ============================================

  const handleEndShift = async () => {
    const amount = parseFloat(endingBalance);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid ending balance');
      return;
    }
    setLoading(true);
    try {
      await onEndShift(shift.id, {
        endingBalance: amount,
        notes: endingNotes || undefined,
      });
      setShowEndShiftDialog(false);
      setEndingBalance('');
      setEndingNotes('');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCashAction = async () => {
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    try {
      if (cashAction === 'add') {
        await onAddCash(amount, cashDescription || undefined);
      } else {
        await onRemoveCash(amount, cashDescription || undefined);
      }
      setShowCashDialog(false);
      setCashAmount('');
      setCashDescription('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleEndingBalanceChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEndingBalance(e.target.value);
  };

  const handleEndingNotesChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEndingNotes(e.target.value);
  };

  const handleCashAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCashAmount(e.target.value);
  };

  const handleCashDescriptionChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCashDescription(e.target.value);
  };

  // ============================================
  // DERIVED
  // ============================================

  const expectedBalance = shift.expectedBalance || shift.startingBalance || 0;
  const duration = shift.openedAt
    ? (Date.now() - new Date(shift.openedAt).getTime()) / 1000
    : 0;

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      <Card className="p-6 card-brand shadow-soft animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-success-50 dark:bg-success-900/30 rounded-lg p-3">
              <Clock className="h-6 w-6 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Current Shift
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {shift.cashRegister?.name || shift.cashRegisterId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="px-3 py-1">
              <CheckCircle className="w-3 h-3 mr-1" />
              Open
            </Badge>
            <Button
              variant="destructive"
              onClick={() => setShowEndShiftDialog(true)}
              className="bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl transition duration-250 focus-ring shadow-brand"
            >
              <XCircle className="w-4 h-4 mr-2" />
              End Shift
            </Button>
          </div>
        </div>

        {/* Meta tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-transparent dark:border-gray-700 transition duration-250">
            <p className="text-2xs text-gray-500 dark:text-gray-400 eyebrow">Cashier</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {shift.user?.firstName} {shift.user?.lastName}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-transparent dark:border-gray-700 transition duration-250">
            <p className="text-2xs text-gray-500 dark:text-gray-400 eyebrow">Started</p>
            <p className="font-medium text-sm tabular-nums text-gray-900 dark:text-white">
              {formatDateTime(shift.openedAt)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-transparent dark:border-gray-700 transition duration-250">
            <p className="text-2xs text-gray-500 dark:text-gray-400 eyebrow">
              Duration
            </p>
            <p className="font-medium tabular-nums text-gray-900 dark:text-white">
              {formatDuration(duration)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center border border-transparent dark:border-gray-700 transition duration-250">
            <p className="text-2xs text-gray-500 dark:text-gray-400 eyebrow">
              Starting Balance
            </p>
            <p className="font-medium tabular-nums text-gray-900 dark:text-white">
              {formatCurrency(shift.startingBalance || 0)}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-primary-50 dark:bg-primary-900/30 rounded-xl p-3 text-center border border-transparent dark:border-primary-900/50 transition duration-250">
            <p className="text-2xs text-gray-500 dark:text-gray-400 eyebrow">
              Total Sales
            </p>
            <p className="text-xl font-bold tabular-nums text-primary-700 dark:text-primary-300">
              {shift.totalSales || 0}
            </p>
          </div>
          <div className="bg-success-50 dark:bg-success-900/30 rounded-xl p-3 text-center border border-transparent dark:border-success-900/50 transition duration-250">
            <p className="text-2xs text-gray-500 dark:text-gray-400 eyebrow">Revenue</p>
            <p className="text-xl font-bold tabular-nums text-success-700 dark:text-success-300">
              {formatCurrency(shift.totalRevenue || 0)}
            </p>
          </div>
          <div className="bg-secondary-50 dark:bg-secondary-900/30 rounded-xl p-3 text-center border border-transparent dark:border-secondary-900/50 transition duration-250">
            <p className="text-2xs text-gray-500 dark:text-gray-400 eyebrow">
              Cash Received
            </p>
            <p className="text-xl font-bold tabular-nums text-secondary-700 dark:text-secondary-300">
              {formatCurrency(shift.cashReceived || 0)}
            </p>
          </div>
          <div className="bg-brand-50 dark:bg-brand-900/30 rounded-xl p-3 text-center border border-transparent dark:border-brand-900/50 transition duration-250">
            <p className="text-2xs text-gray-500 dark:text-gray-400 eyebrow">
              Expected Balance
            </p>
            <p className="text-xl font-bold tabular-nums text-brand-700 dark:text-brand-300">
              {formatCurrency(expectedBalance)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition duration-250 focus-ring"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Cash Management
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl shadow-card">
              <DropdownMenuItem
                onClick={() => {
                  setCashAction('add');
                  setShowCashDialog(true);
                }}
                className="text-gray-700 dark:text-gray-300 focus:bg-gray-100 dark:focus:bg-gray-700 focus-ring"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Cash
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCashAction('remove');
                  setShowCashDialog(true);
                }}
                className="text-gray-700 dark:text-gray-300 focus:bg-gray-100 dark:focus:bg-gray-700 focus-ring"
              >
                <Minus className="w-4 h-4 mr-2" />
                Remove Cash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition duration-250 focus-ring"
          >
            <Receipt className="w-4 h-4 mr-2" />
            View Sales
          </Button>
        </div>
      </Card>

      {/* ============================================ */}
      {/* END SHIFT DIALOG                              */}
      {/* ============================================ */}
      <Dialog open={showEndShiftDialog} onOpenChange={setShowEndShiftDialog}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-2xl shadow-card animate-slide-down">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              End Shift
            </DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Finalize the current shift and close the register.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-warning-50 dark:bg-warning-900/20 rounded-xl p-3 border border-transparent dark:border-warning-900/50 animate-slide-down">
              <p className="text-sm tabular-nums text-warning-800 dark:text-warning-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Expected balance: {formatCurrency(expectedBalance)}
              </p>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="endingBalance"
                className="text-gray-700 dark:text-gray-300"
              >
                Ending Balance *
              </Label>
              <Input
                id="endingBalance"
                type="number"
                placeholder="0.00"
                value={endingBalance}
                onChange={handleEndingBalanceChange}
                min="0"
                step="0.01"
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="endingNotes"
                className="text-gray-700 dark:text-gray-300"
              >
                Notes (optional)
              </Label>
              <Input
                id="endingNotes"
                placeholder="Any notes about this shift"
                value={endingNotes}
                onChange={handleEndingNotesChange}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEndShiftDialog(false)}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition duration-250 focus-ring"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndShift}
              disabled={loading}
              className="bg-gradient-to-r from-danger-600 to-brand-accent-500 hover:from-danger-700 hover:to-brand-accent-600 text-white rounded-xl transition duration-250 disabled:opacity-50 focus-ring shadow-brand"
            >
              {loading ? 'Ending...' : 'End Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* CASH DIALOG                                   */}
      {/* ============================================ */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-2xl shadow-card animate-slide-down">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              {cashAction === 'add' ? 'Add' : 'Remove'} Cash
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
                onChange={handleCashAmountChange}
                min="0.01"
                step="0.01"
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
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
                onChange={handleCashDescriptionChange}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCashDialog(false)}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition duration-250 focus-ring"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCashAction}
              className="btn-brand"
            >
              {cashAction === 'add' ? 'Add' : 'Remove'} Cash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CurrentShiftCard;
