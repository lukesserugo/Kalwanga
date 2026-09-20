// packages/web/components/bookkeeping/JournalEntryForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

// ============================================
// TYPES
// ============================================

interface FormLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    date: string;
    description: string;
    reference?: string;
    lines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      description?: string;
    }>;
  }) => Promise<void>;
  accounts: Account[];
}

// ============================================
// COMPONENT
// ============================================

export default function JournalEntryForm({
  open,
  onClose,
  onSubmit,
  accounts,
}: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<FormLine[]>([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setReference('');
      setLines([
        { accountId: '', debit: 0, credit: 0, description: '' },
        { accountId: '', debit: 0, credit: 0, description: '' },
      ]);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const addLine = () => {
    setLines([
      ...lines,
      { accountId: '', debit: 0, credit: 0, description: '' },
    ]);
  };

  const removeLine = (i: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, idx) => idx !== i));
  };

  const updateLine = (i: number, patch: Partial<FormLine>) => {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) return setError('Description is required');
    if (lines.length < 2) return setError('At least two lines required');
    if (lines.some((l) => !l.accountId))
      return setError('Every line must have an account');
    if (!isBalanced)
      return setError(
        `Debits (${totalDebit.toFixed(
          2
        )}) must equal credits (${totalCredit.toFixed(2)})`
      );

    setSubmitting(true);
    try {
      await onSubmit({
        date,
        description: description.trim(),
        reference: reference.trim() || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit || 0,
          credit: l.credit || 0,
          description: l.description || undefined,
        })),
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center p-4 bg-black/50 overflow-y-auto animate-fade-in">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            New Journal Entry
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Date + Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reference
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
                className="input-brand"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this entry for?"
              className="input-brand"
            />
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Lines *
              </label>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors focus-ring rounded"
              >
                <PlusIcon className="w-4 h-4" />
                Add line
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <select
                    value={line.accountId}
                    onChange={(e) =>
                      updateLine(i, { accountId: e.target.value })
                    }
                    className="col-span-12 sm:col-span-5 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Debit"
                    value={line.debit || ''}
                    onChange={(e) =>
                      updateLine(i, {
                        debit: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="col-span-6 sm:col-span-3 px-2 py-1.5 text-sm text-right font-mono tabular-nums border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Credit"
                    value={line.credit || ''}
                    onChange={(e) =>
                      updateLine(i, {
                        credit: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="col-span-6 sm:col-span-3 px-2 py-1.5 text-sm text-right font-mono tabular-nums border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    disabled={lines.length <= 2}
                    className="col-span-12 sm:col-span-1 flex items-center justify-center text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded disabled:opacity-30 transition-colors focus-ring"
                    title="Remove line"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    placeholder="Line note (optional)"
                    value={line.description}
                    onChange={(e) =>
                      updateLine(i, { description: e.target.value })
                    }
                    className="col-span-12 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Balance summary */}
          <div
            className={`p-3 rounded-lg border ${
              isBalanced
                ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800'
                : 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800'
            }`}
          >
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">Debits</span>
              <span className="font-mono font-medium text-gray-900 dark:text-white tabular-nums">
                {totalDebit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-700 dark:text-gray-300">Credits</span>
              <span className="font-mono font-medium text-gray-900 dark:text-white tabular-nums">
                {totalCredit.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="font-medium text-gray-900 dark:text-white">
                {isBalanced ? '✓ Balanced' : '⚠️ Not balanced'}
              </span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  isBalanced
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-warning-600 dark:text-warning-400'
                }`}
              >
                {(totalDebit - totalCredit).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-sm text-danger-700 dark:text-danger-400 animate-slide-down">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary focus-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isBalanced}
              className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 text-sm transition-all focus-ring"
            >
              {submitting ? 'Creating…' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
