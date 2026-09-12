// D:\Projects\Kalwanga\packages\web\components\shifts\RegisterCard.tsx
'use client';

import { useState, ChangeEvent } from 'react';
import {
  MoreVertical,
  Edit,
  Trash2,
  Clock,
  DollarSign,
  Plus,
  Minus,
  User,
  Receipt,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/DropdownMenu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import type { Register, Shift } from '../../types/register';

// ============================================
// TYPES
// ============================================

interface RegisterCardProps {
  register: Register;
  currentShift?: Shift | null;
  onEdit: (register: Register) => void;
  onDelete: (id: string) => void;
  onStartShift: (register: Register) => void;
  onEndShift: (
    id: string,
    data: { endingBalance: number; notes?: string }
  ) => void;
  onAddCash: (register: Register, amount: number, description?: string) => void;
  onRemoveCash: (
    register: Register,
    amount: number,
    description?: string
  ) => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RegisterCard({
  register,
  currentShift,
  onEdit,
  onDelete,
  onStartShift,
  onEndShift,
  onAddCash,
  onRemoveCash,
}: RegisterCardProps) {
  const [showCashDialog, setShowCashDialog] = useState<boolean>(false);
  const [cashAction, setCashAction] = useState<'add' | 'remove'>('add');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashDescription, setCashDescription] = useState<string>('');

  // Derive open state from multiple signals
  const hasOwnSession = !!register.currentSession?.id;
  const isOpen =
    hasOwnSession ||
    register.isOpen === true ||
    currentShift?.cashRegisterId === register.id;

  const sessionUser = register.sessionUser;
  const currentSession = register.currentSession;
  const isCurrentUserShift =
    currentShift?.cashRegisterId === register.id;

  // Only THIS user's open shift on THIS register can be ended
  const canEnd = hasOwnSession && isCurrentUserShift;

  const handleCashAction = () => {
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (cashAction === 'add') {
      onAddCash(register, amount, cashDescription || 'Manual addition');
    } else {
      onRemoveCash(register, amount, cashDescription || 'Manual removal');
    }
    setShowCashDialog(false);
    setCashAmount('');
    setCashDescription('');
  };

  const handleCashAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCashAmount(e.target.value);
  };

  const handleCashDescriptionChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCashDescription(e.target.value);
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg truncate">
                  {register.name}
                </h3>
                {!register.isActive && (
                  <Badge variant="destructive" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500">Code: {register.code}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isOpen ? 'success' : 'secondary'}>
                {isOpen ? 'Open' : 'Closed'}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(register)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => onDelete(register.id)}
                    disabled={isOpen}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Balance</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(register.cashBalance || 0)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-medium">
                {isOpen ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-gray-600">Inactive</span>
                )}
              </p>
            </div>
          </div>

          {isOpen && sessionUser && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 rounded-lg p-2">
              <User className="h-4 w-4 text-blue-500" />
              <span>
                {sessionUser.firstName} {sessionUser.lastName}
              </span>
              {currentSession?.openedAt && (
                <span className="text-xs text-gray-400 ml-auto">
                  since {formatDateTime(currentSession.openedAt)}
                </span>
              )}
            </div>
          )}

          {currentSession?.summary && isCurrentUserShift && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm bg-green-50 rounded-lg p-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">Sales</p>
                <p className="font-medium">
                  {currentSession.summary.totalSales}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="font-medium">
                  {formatCurrency(currentSession.summary.totalRevenue)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Avg Ticket</p>
                <p className="font-medium">
                  {formatCurrency(currentSession.summary.averageTicket)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {!isOpen ? (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => onStartShift(register)}
                disabled={!register.isActive}
              >
                <Clock className="w-4 h-4 mr-1" />
                Start Shift
              </Button>
            ) : canEnd && currentShift ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() =>
                    onEndShift(currentShift.id, {
                      endingBalance: register.cashBalance,
                    })
                  }
                >
                  End Shift
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="px-2">
                      <DollarSign className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setCashAction('add');
                        setShowCashDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Cash
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setCashAction('remove');
                        setShowCashDialog(true);
                      }}
                    >
                      <Minus className="h-4 w-4 mr-2" />
                      Remove Cash
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Badge variant="warning" className="w-full justify-center">
                Shift in progress by another user
              </Badge>
            )}
          </div>

          {currentSession?.sales && currentSession.sales.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <button
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                onClick={() => {
                  // Navigate to sales
                }}
              >
                <Receipt className="h-4 w-4" />
                View {currentSession.sales.length} sales
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Cash Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cashAction === 'add' ? 'Add' : 'Remove'} Cash
            </DialogTitle>
            <DialogDescription>
              Enter the amount and reason for this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={cashAmount}
                onChange={handleCashAmountChange}
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Reason for transaction"
                value={cashDescription}
                onChange={handleCashDescriptionChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCashAction}>
              {cashAction === 'add' ? 'Add' : 'Remove'} Cash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RegisterCard;
