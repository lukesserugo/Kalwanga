// src/app/(dashboard)/reports/tax/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../../services/api';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency } from '../../../../../utils/formatters';

interface TaxSummary {
  period: string;
  startDate: string;
  endDate: string;
  totalTax: number;
  totalTaxable: number;
  effectiveRate: number;
  recordCount: number;
  filingStatus: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export default function TaxReportsPage() {
  const [period, setPeriod] = useState('');
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [filingStatus, setFilingStatus] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    setPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    fetchFilingStatus();
  }, []);

  const fetchFilingStatus = useCallback(async () => {
    try {
      const response = await api.get<ApiResponse<any>>('/tax/filing-status');
      if (response.success) {
        // Handle filing status data
      }
    } catch (error) {
      // Silent fail
    }
  }, []);

  const generateReport = async () => {
    if (!period) {
      toast.error('Please select a period');
      return;
    }

    try {
      setLoading(true);
      const response = await api.get<ApiResponse<TaxSummary>>('/reports/tax-filing', {
        params: { period },
      });
      setSummary(response.data);
      toast.success('Tax report generated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate tax report');
    } finally {
      setLoading(false);
    }
  };

  const handleFileTaxReturn = async () => {
    if (!summary) {
      toast.error('Please generate a report first');
      return;
    }

    if (summary.filingStatus === 'FILED') {
      toast.warning('This period has already been filed');
      return;
    }

    if (!confirm(`Are you sure you want to file tax return for ${summary.period}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.post<ApiResponse<{ message: string }>>('/tax/file', {
        period: summary.period,
      });

      if (response.success) {
        toast.success('Tax return filed successfully');
        // Refresh report
        await generateReport();
      } else {
        toast.error(response.message || 'Failed to file tax return');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to file tax return');
    } finally {
      setLoading(false);
    }
  };

  const getFilingStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
      FILED: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
      PAID: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
      OVERDUE: 'bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getFilingStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDING: 'Pending',
      FILED: 'Filed',
      PAID: 'Paid',
      OVERDUE: 'Overdue',
    };
    return labels[status] || status;
  };

  return (
    <div className="max-w-container mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Generate and manage tax filing reports
          </p>
        </div>
        {summary && summary.filingStatus !== 'FILED' && (
          <button
            onClick={handleFileTaxReturn}
            disabled={loading}
            className="btn-success"
          >
            {loading ? 'Processing...' : 'File Tax Return'}
          </button>
        )}
      </div>

      {/* Report Generator */}
      <div className="card-brand shadow-soft mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Generate Report
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tax Period
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250 tabular-nums"
            />
          </div>
          <button
            onClick={generateReport}
            disabled={loading || !period}
            className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Select a tax period to generate the report
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <div className="card-brand shadow-soft animate-slide-down">
          <div className="flex flex-wrap justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tax Summary - <span className="tabular-nums">{summary.period}</span>
            </h2>
            <span className={`px-3 py-1 rounded-full text-2xs font-medium ${getFilingStatusColor(summary.filingStatus)}`}>
              {getFilingStatusLabel(summary.filingStatus)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Taxable Amount</p>
              <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {formatCurrency(summary.totalTaxable)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Tax Collected</p>
              <p className="text-2xl font-bold tabular-nums text-brand-600 dark:text-brand-400">
                {formatCurrency(summary.totalTax)}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Effective Tax Rate</p>
              <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {summary.effectiveRate.toFixed(2)}%
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Transactions</p>
              <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {summary.recordCount}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Period Start</p>
              <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {new Date(summary.startDate).toLocaleDateString()}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Period End</p>
              <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {new Date(summary.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Filing Actions */}
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={generateReport}
                disabled={loading}
                className="btn-secondary disabled:opacity-50"
              >
                Refresh Report
              </button>
              <button
                onClick={() => {
                  // Print report
                  window.print();
                }}
                className="btn-secondary"
              >
                Print Report
              </button>
              {summary.filingStatus !== 'FILED' && (
                <button
                  onClick={handleFileTaxReturn}
                  disabled={loading}
                  className="btn-success"
                >
                  {loading ? 'Processing...' : 'File Tax Return'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!summary && !loading && (
        <div className="card-brand shadow-soft p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Report Generated
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Select a tax period and click "Generate Report" to view tax summary.
          </p>
        </div>
      )}
    </div>
  );
}
