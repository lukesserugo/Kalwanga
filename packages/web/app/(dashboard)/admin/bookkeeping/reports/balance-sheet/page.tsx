'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { bookkeepingService } from '../../../../../../services/bookkeepingService';
import { useToast } from '../../../../../../hooks/useToast';
import { formatCurrency } from '../../../../../../utils/helpers';

export default function BalanceSheetPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await bookkeepingService.generateBalanceSheet('');
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

  const bs = data?.data || data || {};
  const assets = bs.assets || {};
  const liabilities = bs.liabilities || {};
  const equity = bs.equity || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Balance Sheet
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Assets, liabilities, and equity at a point in time
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Assets
          </h3>
          <dl className="space-y-3">
            <Row label="Cash" value={assets.cash || 0} />
            <Row label="Accounts Receivable" value={assets.accountsReceivable || 0} />
            <Row label="Inventory" value={assets.inventory || 0} />
            <Row label="Fixed Assets" value={assets.fixedAssets || 0} />
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold">
              <dt className="text-gray-900 dark:text-white">Total Assets</dt>
              <dd className="text-green-600 dark:text-green-400">
                {formatCurrency(assets.totalAssets || 0)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Liabilities
            </h3>
            <dl className="space-y-3">
              <Row label="Accounts Payable" value={liabilities.accountsPayable || 0} />
              <Row label="Taxes Payable" value={liabilities.taxesPayable || 0} />
              <Row label="Loans Payable" value={liabilities.loansPayable || 0} />
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold">
                <dt className="text-gray-900 dark:text-white">Total Liabilities</dt>
                <dd className="text-red-600 dark:text-red-400">
                  {formatCurrency(liabilities.totalLiabilities || 0)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Equity
            </h3>
            <dl className="space-y-3">
              <Row label="Owner's Equity" value={equity.ownerEquity || 0} />
              <Row label="Retained Earnings" value={equity.retainedEarnings || 0} />
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold">
                <dt className="text-gray-900 dark:text-white">Total Equity</dt>
                <dd className="text-blue-600 dark:text-blue-400">
                  {formatCurrency(equity.totalEquity || 0)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 flex justify-between font-bold">
        <span className="text-gray-900 dark:text-white">
          Total Liabilities + Equity
        </span>
        <span className="text-gray-900 dark:text-white">
          {formatCurrency(bs.totalLiabilitiesAndEquity || 0)}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="font-mono text-gray-900 dark:text-white">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
