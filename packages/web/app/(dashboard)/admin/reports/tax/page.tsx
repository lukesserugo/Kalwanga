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
      PENDING: 'bg-yellow-100 text-yellow-800',
      FILED: 'bg-green-100 text-green-800',
      PAID: 'bg-blue-100 text-blue-800',
      OVERDUE: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Reports</h1>
          <p className="text-gray-500 text-sm">Generate and manage tax filing reports</p>
        </div>
        {summary && summary.filingStatus !== 'FILED' && (
          <button
            onClick={handleFileTaxReturn}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'File Tax Return'}
          </button>
        )}
      </div>

      {/* Report Generator */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Period
            </label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={generateReport}
            disabled={loading || !period}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Select a tax period to generate the report
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Tax Summary - {summary.period}
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getFilingStatusColor(summary.filingStatus)}`}>
              {getFilingStatusLabel(summary.filingStatus)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Taxable Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalTaxable)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Tax Collected</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalTax)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Effective Tax Rate</p>
              <p className="text-2xl font-bold text-gray-900">{summary.effectiveRate.toFixed(2)}%</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{summary.recordCount}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Period Start</p>
              <p className="text-2xl font-bold text-gray-900">{new Date(summary.startDate).toLocaleDateString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Period End</p>
              <p className="text-2xl font-bold text-gray-900">{new Date(summary.endDate).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Filing Actions */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={generateReport}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Refresh Report
              </button>
              <button
                onClick={() => {
                  // Print report
                  window.print();
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Print Report
              </button>
              {summary.filingStatus !== 'FILED' && (
                <button
                  onClick={handleFileTaxReturn}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Generated</h3>
          <p className="text-gray-500">
            Select a tax period and click "Generate Report" to view tax summary.
          </p>
        </div>
      )}
    </div>
  );
}
