'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { bookkeepingService } from '../../../../../../services/bookkeepingService';
import { useToast } from '../../../../../../hooks/useToast';
import { formatCurrency } from '../../../../../../utils/helpers';

export default function TrialBalancePage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await bookkeepingService.generateTrialBalance('');
      setData(res);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <ArrowPathIcon className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const summary = data?.summary || {};
  const totalDebits = summary.totalDebits ?? rows.reduce((s: number, r: any) => s + (r.debit || 0), 0);
  const totalCredits = summary.totalCredits ?? rows.reduce((s: number, r: any) => s + (r.credit || 0), 0);
  const isBalanced = summary.isBalanced ?? Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Trial Balance
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Summary of all account balances
        </p>
      </div>

      <div
        className={`p-4 rounded-lg border ${
          isBalanced
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
      >
        <p
          className={`font-medium ${
            isBalanced
              ? 'text-green-800 dark:text-green-400'
              : 'text-red-800 dark:text-red-400'
          }`}
        >
          {isBalanced
            ? '✓ Books are balanced'
            : `⚠️ Out of balance by ${formatCurrency(Math.abs(totalDebits - totalCredits))}`}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {['Code', 'Account', 'Type', 'Debit', 'Credit', 'Balance'].map((h) => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase ${
                      ['Debit', 'Credit', 'Balance'].includes(h)
                        ? 'text-right'
                        : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No data
                  </td>
                </tr>
              ) : (
                rows.map((r: any) => (
                  <tr key={r.id || r.code}>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-gray-400">
                      {r.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                      {r.name}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                      {r.type}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm">
                      {r.debit > 0 ? formatCurrency(r.debit) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm">
                      {r.credit > 0 ? formatCurrency(r.credit) : '—'}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-mono text-sm font-semibold ${
                        r.balance > 0
                          ? 'text-green-600 dark:text-green-400'
                          : r.balance < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {formatCurrency(r.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
              <tr className="font-bold">
                <td colSpan={3} className="px-6 py-3 text-right text-gray-900 dark:text-white">
                  Totals
                </td>
                <td className="px-6 py-3 text-right font-mono text-green-600 dark:text-green-400">
                  {formatCurrency(totalDebits)}
                </td>
                <td className="px-6 py-3 text-right font-mono text-red-600 dark:text-red-400">
                  {formatCurrency(totalCredits)}
                </td>
                <td className="px-6 py-3 text-right font-mono">
                  {formatCurrency(totalDebits - totalCredits)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
