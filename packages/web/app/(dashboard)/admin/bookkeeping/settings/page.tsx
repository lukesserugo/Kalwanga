'use client';

import { useState } from 'react';
import { useToast } from '../../../../../hooks/useToast';

export default function BookkeepingSettingsPage() {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [taxRate, setTaxRate] = useState('0');
  const [fiscalYearStart, setFiscalYearStart] = useState('01-01');

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: wire to actual endpoint when available
      await new Promise((r) => setTimeout(r, 500));
      showToast('Settings saved', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Bookkeeping Settings
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Tax and fiscal year configuration
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default Tax Rate (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Applied to new sales and tax calculations
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fiscal Year Start (MM-DD)
          </label>
          <input
            type="text"
            value={fiscalYearStart}
            onChange={(e) => setFiscalYearStart(e.target.value)}
            placeholder="01-01"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
