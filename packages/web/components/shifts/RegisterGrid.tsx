// D:\Projects\Kalwanga\packages\web\components\shifts\RegisterGrid.tsx
'use client';

import { useState } from 'react';
import {
  Edit,
  Trash2,
  Clock,
  DollarSign,
  Plus,
  Minus,
  MoreVertical,
  User,
  Calendar,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import type { Register, Shift } from '../../types/register';

// ============================================
// TYPES
// ============================================

interface RegisterGridProps {
  registers: Register[];
  currentShift?: Shift | null;
  onEdit: (register: Register) => void;
  onDelete: (id: string) => void;
  onStartShift: (register: Register) => void;
  onEndShift: (id: string, data: { endingBalance: number; notes?: string }) => void;
  onAddCash: (register: Register, amount: number, description?: string) => void;
  onRemoveCash: (register: Register, amount: number, description?: string) => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RegisterGrid({
  registers,
  currentShift,
  onEdit,
  onDelete,
  onStartShift,
  onEndShift,
  onAddCash,
  onRemoveCash,
}: RegisterGridProps) {
  const [cashModal, setCashModal] = useState<{
    register: Register;
    type: 'add' | 'remove';
  } | null>(null);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashDescription, setCashDescription] = useState<string>('');

  const handleCashSubmit = () => {
    if (!cashModal) return;
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (cashModal.type === 'add') {
      onAddCash(cashModal.register, amount, cashDescription || undefined);
    } else {
      onRemoveCash(cashModal.register, amount, cashDescription || undefined);
    }

    setCashModal(null);
    setCashAmount('');
    setCashDescription('');
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {registers.map((register: Register) => {
          const hasOwnSession = !!register.currentSession?.id;
          const isOpen =
            hasOwnSession ||
            register.isOpen === true ||
            currentShift?.cashRegisterId === register.id;

          const sessionUser =
            register.sessionUser ||
            (isOpen && currentShift?.cashRegisterId === register.id
              ? register.sessionUser
              : undefined);

          const openedAt =
            register.currentSession?.openedAt ||
            (currentShift?.cashRegisterId === register.id
              ? currentShift.openedAt
              : undefined);

          const canEnd =
            hasOwnSession && currentShift?.cashRegisterId === register.id;

          return (
            <div
              key={register.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 transition-colors duration-200 hover:shadow-md"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {register.name}
                    </h3>
                    {!register.isActive && (
                      <Badge variant="destructive" className="text-xs shrink-0">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                    {register.code}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  >
                    <DropdownMenuItem
                      onClick={() => onEdit(register)}
                      className="text-gray-700 dark:text-gray-300 focus:bg-gray-100 dark:focus:bg-gray-700"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
                      onClick={() => onDelete(register.id)}
                      disabled={isOpen}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status Badge */}
              <div className="mb-3">
                <Badge variant={isOpen ? 'success' : 'secondary'}>
                  {isOpen ? 'Open' : 'Closed'}
                </Badge>
              </div>

              {/* Balance */}
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(register.cashBalance || 0)}
                </span>
              </div>

              {/* Session Info */}
              {isOpen && (
                <div className="space-y-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
                  {sessionUser && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      <span>
                        {sessionUser.firstName} {sessionUser.lastName}
                      </span>
                    </div>
                  )}
                  {openedAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>since {formatDateTime(openedAt)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-4">
                {!isOpen ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStartShift(register)}
                    disabled={!register.isActive}
                    className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Start Shift
                  </Button>
                ) : canEnd && currentShift ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onEndShift(currentShift.id, {
                        endingBalance: register.cashBalance,
                      })
                    }
                    className="flex-1 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    End Shift
                  </Button>
                ) : (
                  <Badge variant="warning" className="flex-1 justify-center">
                    In Use
                  </Badge>
                )}
              </div>

              {/* Cash Actions (only when open) */}
              {isOpen && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCashModal({ register, type: 'add' })}
                    className="flex-1 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Cash
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCashModal({ register, type: 'remove' })}
                    className="flex-1 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    <Minus className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cash Modal */}
      {cashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {cashModal.type === 'add' ? 'Add Cash' : 'Remove Cash'} —{' '}
              {cashModal.register.name}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={cashDescription}
                  onChange={(e) => setCashDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Reason for transaction"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCashModal(null);
                    setCashAmount('');
                    setCashDescription('');
                  }}
                  className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCashSubmit}
                  disabled={!cashAmount || parseFloat(cashAmount) <= 0}
                  className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
                >
                  {cashModal.type === 'add' ? 'Add Cash' : 'Remove Cash'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RegisterGrid;
