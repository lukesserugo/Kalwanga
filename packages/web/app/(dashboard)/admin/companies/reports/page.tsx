// packages/web/app/(dashboard)/admin/companies/reports/page.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  UsersIcon,
  UserGroupIcon,
  TruckIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  ChartPieIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

import { companyService } from '../../../../../services/companyService';
import { useToast } from '../../../../../hooks/useToast';
import SummaryCards from '../../../../../components/bookkeeping/SummaryCards';
import CompanyReportsTable from '../../../../../components/companies/CompanyReportsTable';
import CompanyGrowthChart from '../../../../../components/companies/CompanyGrowthChart';
import CompanyCurrencyBreakdown from '../../../../../components/companies/CompanyCurrencyBreakdown';

// ============================================
// TYPES
// ============================================

interface CompanyReportRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  currency: string;
  createdAt: string;
  businessUnitCount: number;
  userCount: number;
  customerCount: number;
  supplierCount: number;
}

interface CompanyReports {
  totalCompanies: number;
  activeCompanies: number;
  inactiveCompanies: number;
  totalBusinessUnits: number;
  totalUsers: number;
  totalCustomers: number;
  totalSuppliers: number;
  totalProducts: number;
  totalRevenue: number;
  totalSales: number;
  companiesByCurrency: Array<{ currency: string; count: number }>;
  companiesByMonth: Array<{ month: string; count: number }>;
  companies: CompanyReportRow[];
  period: { startDate: string | null; endDate: string | null } | null;
  generatedAt: string;
}

type RangeKey = '30d' | '90d' | '12m' | 'ytd' | 'all' | 'custom';

// ============================================
// PAGE
// ============================================

export default function CompanyReportsPage() {
  const { showToast } = useToast();
  const [reports, setReports] = useState<CompanyReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<RangeKey>('12m');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  // Stable refs — same pattern used elsewhere to avoid dep churn
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Reset the run-once guard per component mount
  const didFetchRef = useRef(false);

  const buildRange = useCallback((): { startDate?: string; endDate?: string } => {
    const now = new Date();
    const end = now.toISOString();
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

    switch (range) {
      case '30d': {
        const s = new Date(now);
        s.setDate(s.getDate() - 30);
        return { startDate: startOfDay(s), endDate: end };
      }
      case '90d': {
        const s = new Date(now);
        s.setDate(s.getDate() - 90);
        return { startDate: startOfDay(s), endDate: end };
      }
      case '12m': {
        const s = new Date(now);
        s.setFullYear(s.getFullYear() - 1);
        return { startDate: startOfDay(s), endDate: end };
      }
      case 'ytd': {
        const s = new Date(now.getFullYear(), 0, 1);
        return { startDate: s.toISOString(), endDate: end };
      }
      case 'custom': {
        return {
          startDate: customStart || undefined,
          endDate: customEnd || undefined,
        };
      }
      case 'all':
      default:
        return {};
    }
  }, [range, customStart, customEnd]);

  const fetchReports = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      else setRefreshing(true);
      try {
        const rangeParams = buildRange();
        const result = await companyService.getReports({
          ...rangeParams,
          includeInactive,
        });
        setReports(result);
      } catch (err: any) {
        showToastRef.current(
          err?.response?.data?.message || err?.message || 'Failed to load reports',
          'error'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildRange, includeInactive]
  );

  // Initial load — run once per mount. Subsequent reloads happen
  // when the user changes a filter, not because of React churn.
  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when the user changes a filter (after the initial mount).
  const filtersRef = useRef({ range, includeInactive, customStart, customEnd });
  useEffect(() => {
    const prev = filtersRef.current;
    const changed =
      prev.range !== range ||
      prev.includeInactive !== includeInactive ||
      prev.customStart !== customStart ||
      prev.customEnd !== customEnd;
    if (!changed) return;
    filtersRef.current = { range, includeInactive, customStart, customEnd };
    fetchReports({ silent: true });
  }, [range, includeInactive, customStart, customEnd, fetchReports]);

  const handleRefresh = () => fetchReports({ silent: true });

  const handleExport = async () => {
    try {
      const blob = await companyService.exportCompanies({
        format: 'csv',
        isActive: includeInactive ? undefined : true,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `company-reports-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Report exported', 'success');
    } catch (err: any) {
      showToast(
        err?.response?.data?.message || err?.message || 'Export failed',
        'error'
      );
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Company Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Aggregate insights across every company in your workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 focus-ring"
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 focus-ring"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-brand p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FunnelIcon className="w-4 h-4" />
            <span className="font-medium">Filters</span>
          </div>

          {/* Range chips */}
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { key: '30d', label: '30 days' },
                { key: '90d', label: '90 days' },
                { key: '12m', label: '12 months' },
                { key: 'ytd', label: 'YTD' },
                { key: 'all', label: 'All time' },
                { key: 'custom', label: 'Custom' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors focus-ring ${
                  range === opt.key
                    ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Include inactive */}
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
            />
            Include inactive
          </label>

          {reports?.period && (
            <span className="ml-auto text-3xs text-gray-400 dark:text-gray-500 tabular-nums">
              {reports.period.startDate
                ? new Date(reports.period.startDate).toLocaleDateString()
                : '…'}{' '}
              –{' '}
              {reports.period.endDate
                ? new Date(reports.period.endDate).toLocaleDateString()
                : 'now'}
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && !reports && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse"
            >
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error / empty */}
      {!loading && !reports && (
        <div className="card-brand p-12 text-center">
          <ExclamationTriangleIcon className="w-10 h-10 mx-auto text-warning-500" />
          <p className="mt-3 text-gray-900 dark:text-white font-medium">
            Could not load reports
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Try refreshing the page or adjusting your filters.
          </p>
          <button
            type="button"
            onClick={() => fetchReports()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 focus-ring"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {reports && (
        <>
          {/* Summary cards */}
          <SummaryCards
            columns={4}
            cards={[
              {
                label: 'Total Companies',
                value: reports.totalCompanies,
                tone: 'default',
                subtitle: `${reports.activeCompanies} active · ${reports.inactiveCompanies} inactive`,
              },
              {
                label: 'Business Units',
                value: reports.totalBusinessUnits,
                tone: 'default',
                subtitle: `across ${reports.totalCompanies} companies`,
              },
              {
                label: 'Users',
                value: reports.totalUsers,
                tone: 'default',
                subtitle: `${reports.totalCustomers} customers`,
              },
              {
                label: 'Products',
                value: reports.totalProducts,
                tone: 'default',
                subtitle: `${reports.totalSuppliers} suppliers`,
              },
            ]}
          />

          <SummaryCards
            columns={2}
            cards={[
              {
                label: 'Total Revenue',
                value: reports.totalRevenue,
                tone: 'positive',
                subtitle: `${reports.totalSales} completed sales`,
              },
              {
                label: 'Average Sale',
                value:
                  reports.totalSales > 0
                    ? reports.totalRevenue / reports.totalSales
                    : 0,
                tone: 'default',
                subtitle:
                  reports.totalSales > 0
                    ? `over ${reports.totalSales} transactions`
                    : 'no sales in range',
              },
            ]}
          />

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 card-brand p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    Company Growth
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    New companies per month (last 12 months)
                  </p>
                </div>
              </div>
              <CompanyGrowthChart data={reports.companiesByMonth} />
            </div>

            <div className="card-brand p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <ChartPieIcon className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
                    By Currency
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Distribution of companies
                  </p>
                </div>
              </div>
              <CompanyCurrencyBreakdown data={reports.companiesByCurrency} />
            </div>
          </div>

          {/* Table */}
          <div className="card-brand p-0 overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Companies
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                  {reports.companies.length}{' '}
                  {reports.companies.length === 1 ? 'company' : 'companies'}
                </p>
              </div>
            </div>
            <CompanyReportsTable rows={reports.companies} />
          </div>

          {/* Footer meta */}
          <div className="text-center text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            Generated at {new Date(reports.generatedAt).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
