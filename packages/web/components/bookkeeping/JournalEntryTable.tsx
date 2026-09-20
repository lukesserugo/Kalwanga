// packages/web/components/bookkeeping/JournalEntryTable.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/helpers';

// ============================================
// TYPES
// ============================================

export interface JournalEntryRowLine {
  id: string;
  debit: number;
  credit: number;
  description?: string;
  account?: {
    code: string;
    name: string;
  };
}

export interface JournalEntryRow {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string;
  status?: string;
  lines: JournalEntryRowLine[];
}

interface Props {
  entries: JournalEntryRow[];
  loading?: boolean;
}

// ============================================
// STYLES
// ============================================

const STATUS_STYLES: Record<string, string> = {
  POSTED:
    'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400',
  DRAFT:
    'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400',
  VOIDED:
    'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
  VOID: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
  APPROVED:
    'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
  REJECTED:
    'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-400',
};

// ============================================
// COMPONENT
// ============================================

export default function JournalEntryTable({ entries, loading }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <ArrowPathIcon className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="card-brand !p-12 text-center">
        <p className="text-base font-medium text-gray-900 dark:text-white">
          No journal entries yet
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Click "New Entry" above to create your first journal entry.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const lines = entry.lines || [];
        const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
        const statusKey = entry.status || 'POSTED';
        const statusClass =
          STATUS_STYLES[statusKey] ??
          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';

        return (
          <Link
            key={entry.id}
            href={`/admin/bookkeeping/journal-entries/${entry.id}`}
            className="block card-brand !p-4 shadow-soft hover:shadow-card-hover transition-shadow focus-ring"
          >
            <div>
              {/* Header */}
              <div className="flex flex-wrap justify-between items-start gap-3 mb-3">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                    {entry.entryNumber}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {entry.description}
                  </p>
                  {entry.reference && (
                    <p className="text-2xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Ref: {entry.reference}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                    {entry.date
                      ? new Date(entry.date).toLocaleDateString()
                      : '—'}
                  </p>
                  <span
                    className={`inline-block mt-1 px-2 py-1 rounded-full text-2xs ${statusClass}`}
                  >
                    {statusKey}
                  </span>
                </div>
              </div>

              {/* Lines table */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-2xs text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700">
                      <th className="text-left py-1.5">Account</th>
                      <th className="text-right py-1.5">Debit</th>
                      <th className="text-right py-1.5">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr
                        key={line.id}
                        className="border-b dark:border-gray-700 last:border-0"
                      >
                        <td className="py-1.5 text-gray-700 dark:text-gray-300">
                          {line.account ? (
                            <>
                              <span className="font-mono text-2xs text-gray-500 mr-2 tabular-nums">
                                {line.account.code}
                              </span>
                              {line.account.name}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-right font-mono text-gray-700 dark:text-gray-300 tabular-nums">
                          {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                        </td>
                        <td className="text-right font-mono text-gray-700 dark:text-gray-300 tabular-nums">
                          {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 dark:border-gray-700">
                    <tr className="font-semibold">
                      <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">
                        Total
                      </td>
                      <td className="text-right font-mono text-success-600 dark:text-success-400 tabular-nums">
                        {formatCurrency(totalDebit)}
                      </td>
                      <td className="text-right font-mono text-danger-600 dark:text-danger-400 tabular-nums">
                        {formatCurrency(totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
