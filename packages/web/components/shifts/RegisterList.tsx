// D:\Projects\Kalwanga\packages\web\components\shifts\RegisterList.tsx
'use client';

import { useState } from 'react';
import {
  Edit,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
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

interface RegisterListProps {
  registers: Register[];
  currentShift?: Shift | null;
  onEdit: (register: Register) => void;
  onDelete: (id: string) => void;
  onStartShift: (register: Register) => void;
  onEndShift: (id: string, data: { endingBalance: number; notes?: string }) => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RegisterList({
  registers,
  currentShift,
  onEdit,
  onDelete,
  onStartShift,
  onEndShift,
}: RegisterListProps) {
  const [page, setPage] = useState<number>(1);
  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(registers.length / itemsPerPage));

  const safePage = Math.min(page, totalPages);
  const paginatedRegisters = registers.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Name
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Code
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Balance
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Cashier
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedRegisters.map((register: Register) => {
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
                hasOwnSession &&
                currentShift?.cashRegisterId === register.id;

              return (
                <tr
                  key={register.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {register.name}
                      </span>
                      {!register.isActive && (
                        <Badge variant="destructive" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {register.code}
                  </td>

                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {formatCurrency(register.cashBalance || 0)}
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant={isOpen ? 'success' : 'secondary'}>
                      {isOpen ? 'Open' : 'Closed'}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {sessionUser
                      ? `${sessionUser.firstName} ${sessionUser.lastName}`
                      : '-'}
                    {isOpen && openedAt && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 block">
                        since {formatDateTime(openedAt)}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!isOpen ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onStartShift(register)}
                          disabled={!register.isActive}
                          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Start
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
                          className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          End
                        </Button>
                      ) : (
                        <Badge variant="warning">In Use</Badge>
                      )}

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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(safePage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(safePage * itemsPerPage, registers.length)} of{' '}
            {registers.length} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handlePageChange(Math.min(totalPages, safePage + 1))
              }
              disabled={safePage === totalPages}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RegisterList;
