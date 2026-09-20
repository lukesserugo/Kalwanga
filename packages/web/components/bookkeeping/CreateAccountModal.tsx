'use client';

import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { AccountRow } from './AccountsTable';

const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

const CATEGORIES = [
  'CASH',
  'ACCOUNTS_RECEIVABLE',
  'INVENTORY',
  'SALES_REVENUE',
  'SALES_TAX_PAYABLE',
  'COST_OF_GOODS_SOLD',
  'OPERATING_EXPENSE',
  'OWNER_EQUITY',
  'RETAINED_EARNINGS',
  'ACCOUNTS_PAYABLE',
  'FIXED_ASSETS',
  'DEPRECIATION',
  'PAYROLL',
  'INSURANCE',
  'UTILITIES',
  'RENT',
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    code: string;
    name: string;
    type: string;
    category: string;
    isActive?: boolean;
  }) => Promise<void>;
  initial?: AccountRow | null;
}

export default function CreateAccountModal({
  open,
  onClose,
  onSubmit,
  initial,
}: Props) {
  const isEdit = Boolean(initial);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('ASSET');
  const [category, setCategory] = useState<string>('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? '');
      setName(initial?.name ?? '');
      setType(initial?.type ?? 'ASSET');
      setCategory(initial?.category ?? 'CASH');
      setError(null);
      setSubmitting(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) return setError('Code is required');
    if (!name.trim()) return setError('Name is required');

    setSubmitting(true);
    try {
      await onSubmit({
        code: code.trim(),
        name: name.trim(),
        type,
        category,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit account' : 'New account'}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., 1300"
              className="input-brand font-mono tabular-nums"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Prepaid Expenses"
              className="input-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-brand"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-brand"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-sm text-danger-700 dark:text-danger-400 animate-slide-down">
              {error}
            </div>
          )}

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
              disabled={submitting}
              className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg text-sm disabled:opacity-50 transition-all focus-ring"
            >
              {submitting ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
