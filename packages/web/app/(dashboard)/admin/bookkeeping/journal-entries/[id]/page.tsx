'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { bookkeepingService } from '../../../../../../services/bookkeepingService';
import { useToast } from '../../../../../../hooks/useToast';
import { formatCurrency } from '../../../../../../utils/helpers';

export default function JournalEntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { showToast } = useToast();
  const [entry, setEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await bookkeepingService.getJournalEntryById(id);
      setEntry(res);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load entry', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVoid = async () => {
    if (!confirm('Void this entry? A reversing entry will be created.')) return;
    setVoiding(true);
    try {
      await bookkeepingService.voidJournalEntry(id);
      showToast('Entry voided', 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Failed to void', 'error');
    } finally {
      setVoiding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <ArrowPathIcon className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Entry not found.</p>
        <Link
          href="/admin/bookkeeping/journal-entries"
          className="text-blue-600 dark:text-blue-400 text-sm mt-2 inline-block"
        >
          ← Back to entries
        </Link>
      </div>
    );
  }

  const totalDebit = (entry.lines || []).reduce(
    (s: number, l: any) => s + (l.debit || 0),
    0
  );
  const totalCredit = (entry.lines || []).reduce(
    (s: number, l: any) => s + (l.credit || 0),
    0
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/bookkeeping/journal-entries"
        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to entries
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <p className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
              {entry.entryNumber}
            </p>
            <p className="text-gray-900 dark:text-white mt-1">
              {entry.description}
            </p>
            {entry.reference && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Reference: {entry.reference}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
            <p className="text-gray-900 dark:text-white font-medium">
              {new Date(entry.date).toLocaleDateString()}
            </p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {entry.status || 'POSTED'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="text-left py-3">Account</th>
                <th className="text-left py-3">Description</th>
                <th className="text-right py-3">Debit</th>
                <th className="text-right py-3">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(entry.lines || []).map((line: any) => (
                <tr
                  key={line.id}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="py-3">
                    <span className="font-mono text-xs text-gray-500 mr-2">
                      {line.account?.code}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {line.account?.name}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 dark:text-gray-400">
                    {line.description || '—'}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
              <tr className="font-semibold">
                <td colSpan={2} className="py-3 text-right text-gray-700 dark:text-gray-300">
                  Totals
                </td>
                <td className="py-3 text-right font-mono text-green-600 dark:text-green-400">
                  {formatCurrency(totalDebit)}
                </td>
                <td className="py-3 text-right font-mono text-red-600 dark:text-red-400">
                  {formatCurrency(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {entry.status !== 'VOIDED' && entry.status !== 'VOID' && (
          <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handleVoid}
              disabled={voiding}
              className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {voiding ? 'Voiding…' : 'Void entry'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
