'use client';

import React from 'react';
import {
  PencilSquareIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/helpers';

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  category?: string;
  isActive?: boolean;
  debit: number;
  credit: number;
  balance: number;
}

interface Props {
  accounts: AccountRow[];
  loading?: boolean;
  onEdit?: (account: AccountRow) => void;
  compact?: boolean;
}

const TYPE_STYLES: Record<string, string> = {
  ASSET:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  LIABILITY:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  EQUITY:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REVENUE:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  EXPENSE:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function AccountsTable({
  accounts,
  loading,
  onEdit,
  compact,
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <ArrowPathIcon className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  const headers = compact
    ? ['Code', 'Account', 'Type', 'Balance']
    : [
        'Code',
        'Account',
        'Category',
        'Type',
        'Debit',
        'Credit',
        'Balance',
        ...(onEdit ? [''] : []),
      ];

  const alignRight = new Set(['Debit', 'Credit', 'Balance']);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                    alignRight.has(h) ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {accounts.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  <p className="text-base font-medium">No accounts yet</p>
                  <p className="text-sm mt-1">
                    Accounts are created automatically on first visit.
                  </p>
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr
                  key={a.id || a.code}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-gray-400">
                    {a.code}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {a.name}
                  </td>
                  {!compact && (
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      {a.category || '—'}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        TYPE_STYLES[a.type] ?? 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {a.type}
                    </span>
                  </td>
                  {!compact && (
                    <>
                      <td className="px-6 py-4 text-sm text-right font-mono">
                        {a.debit > 0 ? formatCurrency(a.debit) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono">
                        {a.credit > 0 ? formatCurrency(a.credit) : '—'}
                      </td>
                    </>
                  )}
                  <td
                    className={`px-6 py-4 text-sm text-right font-mono font-semibold ${
                      a.balance > 0
                        ? 'text-green-600 dark:text-green-400'
                        : a.balance < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {formatCurrency(a.balance)}
                  </td>
                  {onEdit && (
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(a)}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Edit account"
                      >
                        <PencilSquareIcon className="w-4 h-4 text-gray-500" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
