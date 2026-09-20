// D:\Projects\Kalwanga\packages\web\components\shifts\ShiftStats.tsx
'use client';

import { DollarSign, Clock, Users, BarChart3 } from 'lucide-react';
import Card from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatDuration } from '../../utils/formatters';

interface ShiftStatsProps {
  stats: {
    totalShifts: number;
    openShifts: number;
    closedShifts: number;
    totalRevenue: number;
    averageShiftDuration: number;
    averageShiftRevenue: number;
    topCashiers: Array<{
      userId: string;
      userName: string;
      shiftCount: number;
      totalRevenue: number;
    }>;
  };
  currentShift: any;
}

export function ShiftStats({ stats, currentShift }: ShiftStatsProps) {
  const hasOpenShifts = (stats?.openShifts || 0) > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Revenue */}
      <Card className="card-brand p-4 shadow-soft transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="bg-brand-100 dark:bg-brand-950/40 rounded-lg p-2">
            <DollarSign className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Revenue
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(stats?.totalRevenue || 0)}
            </p>
          </div>
        </div>
        <div className="mt-2 text-2xs text-gray-500 dark:text-gray-400">
          {stats?.totalShifts || 0} shifts completed
        </div>
      </Card>

      {/* Active Shifts */}
      <Card className="card-brand p-4 shadow-soft transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg p-2 transition-colors duration-200 ${
              hasOpenShifts
                ? 'bg-success-100 dark:bg-success-950/40'
                : 'bg-gray-100 dark:bg-gray-700/50'
            }`}
          >
            <Clock
              className={`h-5 w-5 ${
                hasOpenShifts
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            />
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Active Shifts
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white flex items-center flex-wrap gap-2 tabular-nums">
              {stats?.openShifts || 0}
              {currentShift && (
                <Badge variant="success" className="text-2xs">
                  Your shift active
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="mt-2 text-2xs text-gray-500 dark:text-gray-400">
          {stats?.closedShifts || 0} shifts closed
        </div>
      </Card>

      {/* Avg Shift Revenue */}
      <Card className="card-brand p-4 shadow-soft transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="bg-secondary-100 dark:bg-secondary-950/40 rounded-lg p-2">
            <BarChart3 className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Avg Shift Revenue
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(stats?.averageShiftRevenue || 0)}
            </p>
          </div>
        </div>
        <div className="mt-2 text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
          Avg duration: {formatDuration(stats?.averageShiftDuration || 0)}
        </div>
      </Card>

      {/* Top Cashiers */}
      <Card className="card-brand p-4 shadow-soft transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="bg-brand-accent-100 dark:bg-brand-accent-950/40 rounded-lg p-2">
            <Users className="h-5 w-5 text-brand-accent-600 dark:text-brand-accent-400" />
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Top Cashiers
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {stats?.topCashiers?.[0]?.userName?.split(' ')[0] || 'N/A'}
            </p>
          </div>
        </div>
        <div className="mt-2 text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
          {stats?.topCashiers?.length || 0} active cashiers
        </div>
      </Card>
    </div>
  );
}

export default ShiftStats;
