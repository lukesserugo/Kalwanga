'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Eye,
  Search,
  User,
  Building2,
  Store,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import Card from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
} from '../../utils/formatters';

interface Shift {
  id: string;
  status: string;
  openedAt: string;
  closedAt?: string | null;
  startingBalance: number;
  endingBalance?: number | null;
  expectedEndingBalance?: number | null;
  discrepancy?: number | null;
  notes?: string | null;

  // Assigned user
  assignedUserId?: string;
  assignedUserName?: string;
  assignedUserEmail?: string | null;
  assignedUserRole?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    role?: string;
  };

  // Register
  registerName?: string;
  registerCode?: string;
  cashRegister?: {
    id: string;
    name: string;
    code: string;
  };

  // Business Unit
  businessUnitName?: string;
  businessUnitCode?: string;

  // Computed
  totalSales?: number;
  totalRevenue?: number;
  cashReceived?: number;
  duration?: number;

  [key: string]: any;
}

interface ShiftHistoryProps {
  shifts?: Shift[];
  onViewShift?: (shift: Shift) => void;
  onScopeChange?: (scope: 'mine' | 'businessUnit' | 'all') => void;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalPages?: number;
  total?: number;
  scope?: 'mine' | 'businessUnit' | 'all';
  isLoading?: boolean;
}

export function ShiftHistory({
  shifts = [],
  onViewShift,
  onScopeChange,
  onPageChange,
  currentPage = 1,
  totalPages = 1,
  total = 0,
  scope = 'businessUnit',
  isLoading = false,
}: ShiftHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [localPage, setLocalPage] = useState(currentPage);

  // Reset local page when the current page prop changes
  useEffect(() => {
    setLocalPage(currentPage);
  }, [currentPage]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const matchesSearch = searchTerm
        ? [
            shift.assignedUserName,
            shift.user?.firstName,
            shift.user?.lastName,
            shift.registerName,
            shift.cashRegister?.name,
            shift.businessUnitName,
            shift.id,
          ]
            .filter(Boolean)
            .some((field) =>
              String(field).toLowerCase().includes(searchTerm.toLowerCase())
            )
        : true;

      const matchesStatus =
        statusFilter === 'all' ||
        shift.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [shifts, searchTerm, statusFilter]);

  const handlePageChange = (newPage: number) => {
    setLocalPage(newPage);
    onPageChange?.(newPage);
  };

  if (!isLoading && shifts.length === 0) {
    return (
      <Card className="p-8 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-soft">
        <div className="text-gray-400 dark:text-gray-500">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-50 dark:bg-brand-950/40 flex items-center justify-center">
            <Clock className="w-8 h-8 text-brand-500 dark:text-brand-400" />
          </div>
          <p className="text-lg text-gray-900 dark:text-white">
            No shifts recorded yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start a shift to begin tracking
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-soft">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <Input
              placeholder="Search shifts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-48 md:w-64 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-brand-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus-visible:ring-brand-500">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          {/* Scope selector */}
          {onScopeChange && (
            <Select
              value={scope}
              onValueChange={(v) =>
                onScopeChange(v as 'mine' | 'businessUnit' | 'all')
              }
            >
              <SelectTrigger className="w-40 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus-visible:ring-brand-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <SelectItem value="mine">My Shifts</SelectItem>
                <SelectItem value="businessUnit">This Business Unit</SelectItem>
                <SelectItem value="all">All Business Units</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="focus-ring">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" className="focus-ring">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Shift
              </th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Assigned To
              </th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Register
              </th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Business Unit
              </th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Opened
              </th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Revenue
              </th>
              <th className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredShifts.map((shift) => {
              const isOpen = shift.status === 'OPEN';
              const userName =
                shift.assignedUserName ||
                (shift.user
                  ? `${shift.user.firstName} ${shift.user.lastName}`.trim()
                  : 'Unknown');
              const registerName =
                shift.registerName ||
                shift.cashRegister?.name ||
                'Unknown';
              const businessUnit =
                shift.businessUnitName || 'N/A';

              return (
                <tr
                  key={shift.id}
                  className="hover:bg-brand-50/40 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300">
                    {shift.id.slice(0, 8)}
                  </td>

                  {/* ✅ Assigned user */}
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-white text-2xs font-semibold flex-shrink-0 shadow-brand">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-900 dark:text-white font-medium truncate">
                          {userName}
                        </p>
                        {shift.assignedUserRole && (
                          <p className="text-2xs text-gray-400 dark:text-gray-500 truncate">
                            {shift.assignedUserRole}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Register */}
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <span>{registerName}</span>
                    </div>
                  </td>

                  {/* Business unit */}
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <span>{businessUnit}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                    {formatDateTime(shift.openedAt)}
                  </td>

                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                    {shift.duration
                      ? formatDuration(shift.duration)
                      : shift.closedAt
                      ? formatDuration(
                          (new Date(shift.closedAt).getTime() -
                            new Date(shift.openedAt).getTime()) /
                            1000
                        )
                      : formatDuration(
                          (Date.now() -
                            new Date(shift.openedAt).getTime()) /
                            1000
                        )}
                  </td>

                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(shift.totalRevenue || 0)}
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant={isOpen ? 'success' : 'secondary'}>
                      {shift.status}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewShift?.(shift)}
                      aria-label={`View shift ${shift.id.slice(0, 8)}`}
                      className="focus-ring"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            Showing{' '}
            {Math.min(
              total || filteredShifts.length,
              (localPage - 1) * 50 + 1
            )}{' '}
            to{' '}
            {Math.min(localPage * 50, total || filteredShifts.length)} of{' '}
            {total || filteredShifts.length} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(1, localPage - 1))}
              disabled={localPage === 1}
              className="focus-ring"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Page {localPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                handlePageChange(Math.min(totalPages, localPage + 1))
              }
              disabled={localPage === totalPages}
              className="focus-ring"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
