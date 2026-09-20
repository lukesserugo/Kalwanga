'use client';

import Link from 'next/link';
import {
  ChartBarSquareIcon,
  DocumentChartBarIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline';

const REPORTS = [
  {
    href: '/admin/bookkeeping/reports/balance-sheet',
    title: 'Balance Sheet',
    description: 'Assets, liabilities, and equity at a point in time',
    icon: ScaleIcon,
    color: 'blue',
  },
  {
    href: '/admin/bookkeeping/reports/income-statement',
    title: 'Income Statement',
    description: 'Revenue, costs, and profit over a period',
    icon: ChartBarSquareIcon,
    color: 'green',
  },
  {
    href: '/admin/bookkeeping/reports/trial-balance',
    title: 'Trial Balance',
    description: 'Summary of all account balances with balance check',
    icon: DocumentChartBarIcon,
    color: 'purple',
  },
];

const ICON_COLORS: Record<string, string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  purple: 'text-purple-600 dark:text-purple-400',
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Financial Reports
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Standard accounting reports
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <Icon className={`w-8 h-8 mb-3 ${ICON_COLORS[r.color]}`} />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {r.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {r.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
