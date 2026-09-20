'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { bookkeepingService } from '../../../../../../services/bookkeepingService';
import { useToast } from '../../../../../../hooks/useToast';
import { formatCurrency } from '../../../../../../utils/helpers';

export default function IncomeStatementPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await bookkeepingService.generateIncomeStatement({
        businessUnitId: '',
        startDate,
        endDate,
      });
      setData(res);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const report = data?.data || data || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Income Statement
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Revenue, costs, and profit for a period
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Start
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            End
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <ArrowPathIcon className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <Section title="Revenue">
            <Row label="Total Revenue" value={report.totalRevenue || 0} />
            <Row label="Less: Discounts" value={-(report.totalDiscount || 0)} />
            <Row label="Less: Tax" value={-(report.totalTax || 0)} />
            <Row
              label="Net Revenue"
              value={report.netRevenue || 0}
              bold
              tone="positive"
            />
          </Section>

          <Section title="Costs">
            <Row
              label="Cost of Goods Sold"
              value={-((report.totalRevenue || 0) - (report.grossProfit || 0))}
            />
            <Row
              label="Gross Profit"
              value={report.grossProfit || 0}
              bold
              tone="positive"
            />
          </Section>

          <Section title="Bottom Line">
            <Row
              label="Net Profit"
              value={report.netProfit || 0}
              bold
              tone={(report.netProfit || 0) >= 0 ? 'positive' : 'negative'}
            />
          </Section>

          {report.totalTransactions !== undefined && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">
                  Transactions
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {report.totalTransactions}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">
                  Average transaction
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(report.averageTransaction || 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {title}
      </h3>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: number;
  bold?: boolean;
  tone?: 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'negative'
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-900 dark:text-white';

  return (
    <div
      className={`flex justify-between ${
        bold ? 'font-bold pt-2 border-t border-gray-200 dark:border-gray-700' : ''
      }`}
    >
      <dt className={bold ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}>
        {label}
      </dt>
      <dd className={`font-mono ${toneClass}`}>{formatCurrency(value)}</dd>
    </div>
  );
}
