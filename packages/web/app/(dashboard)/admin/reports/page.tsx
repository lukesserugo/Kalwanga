// packages/web/app/(dashboard)/admin/reports/page.tsx

'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  RefreshCw,
  Trash2,
  Loader2,
  Lock,
  Search,
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { useAuth } from '../../../../hooks/useAuth';
import { reportService } from '../../../../services/reportService';
import { toast } from '../../../../utils/toast-manager';
import { PermissionResource } from '../../../../types/enums';
import { ReportForm } from '../../../../components/reports/ReportForm';
import { ReportViewer } from '../../../../components/reports/ReportViewer';
import type { Report } from '../../../../types/report';

// ============================================
// HELPERS
// ============================================
//
// The backend's `reportController.listReports` responds with:
//
//   { success, data: Report[], pagination: {...} }
//
// The frontend `reportService.listReports` returns whatever the `api`
// client surfaces, which depends on how the client is configured:
//
//   • the array directly                       → [Report, ...]
//   • `{ success, data, pagination }`          → wrapped envelope
//   • `{ data: { success, data, pagination }}` → double-wrapped
//   • `{ reports: [...] }`                     → alternate key
//
// This helper normalizes all four shapes into a flat `Report[]`.

function extractReportArray(response: any): Report[] {
  if (!response) return [];
  if (Array.isArray(response)) return response as Report[];

  if (typeof response === 'object') {
    if (
      response.data &&
      typeof response.data === 'object' &&
      !Array.isArray(response.data) &&
      Array.isArray(response.data.data)
    ) {
      return response.data.data as Report[];
    }
    if (Array.isArray(response.data)) {
      return response.data as Report[];
    }
    if (Array.isArray(response.reports)) {
      return response.reports as Report[];
    }
  }

  return [];
}

/**
 * Sentinel business-unit / company ids the backend treats as
 * "resolve this for me from req.user". We must never send them as
 * literal values.
 */
const SENTINEL_IDS = new Set([
  'default',
  'default-company',
  'default-company-id',
  'default-business-unit',
  'undefined',
  'null',
  '',
]);

function sanitizeId(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (SENTINEL_IDS.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

/**
 * Deduplicate an array of strings without relying on `Set` iteration
 * semantics that require `--downlevelIteration` or `target: es2015+`.
 *
 * ⚠ `[...new Set(arr)]` fails with TS2802 when the project's `target`
 *   is below `es2015` and `downlevelIteration` is off — the same class
 *   of error we hit in `cart/analytics/page.tsx`. Using `Array.from`
 *   works with any target because `Array.from` is a function call, not
 *   a spread-into-array literal.
 *
 * Returns `string[]` and filters out falsy entries (`undefined` from
 * reports whose `type` field is missing).
 */
function uniqueReportTypes(reports: Report[]): string[] {
  const seen = new Set<string>();
  for (const report of reports) {
    const type = report.type;
    if (type) seen.add(String(type));
  }
  return Array.from(seen);
}

// ============================================
// PAGE
// ============================================

export default function ReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canView, canManage } = usePermission();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>(
    'generate',
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const canViewReports =
    canView(PermissionResource.REPORT) ||
    canManage(PermissionResource.REPORT);

  // ────────────────────────────────────────────────────────────
  // Resolve businessUnitId / companyId for ReportForm.
  // ────────────────────────────────────────────────────────────

  const resolvedBusinessUnitId = useMemo(() => {
    const fromUser =
      (user as any)?.businessUnitId ||
      (user as any)?.businessUnits?.[0]?.businessUnitId ||
      (user as any)?.businessUnits?.[0]?.id;

    return sanitizeId(fromUser) ?? '';
  }, [user]);

  const resolvedCompanyId = useMemo(() => {
    const fromUser = (user as any)?.companyId;
    return sanitizeId(fromUser) ?? '';
  }, [user]);

  // ────────────────────────────────────────────────────────────
  // Data loading
  // ────────────────────────────────────────────────────────────

  const loadReports = useCallback(
    async (showLoading = true) => {
      if (!canViewReports) {
        setLoading(false);
        return;
      }

      try {
        if (showLoading) setLoading(true);

        const response = await reportService.listReports({ limit: 100 });
        const list = extractReportArray(response);
        setReports(list);
      } catch (error) {
        console.error('Failed to load reports:', error);
        setReports([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canViewReports],
  );

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReports(false);
    toast.success('Reports refreshed');
  };

  // ────────────────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!reportToDelete) return;
    setDeleting(true);
    try {
      await reportService.deleteReport(reportToDelete.id);
      toast.success('Report deleted');
      setShowDeleteModal(false);
      setReportToDelete(null);
      await loadReports(false);
    } catch (err: any) {
      console.error('Failed to delete report:', err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to delete report',
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (report: Report) => {
    try {
      const blob = await reportService.downloadReport(report.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${report.name || 'report'}.${report.format || 'json'}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (err: any) {
      console.error('Failed to download report:', err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to download report',
      );
    }
  };

  // ────────────────────────────────────────────────────────────
  // Derived
  // ────────────────────────────────────────────────────────────

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((report) => {
      if (q) {
        const name = (report.name || '').toLowerCase();
        const type = (report.type || '').toLowerCase();
        if (!name.includes(q) && !type.includes(q)) return false;
      }
      if (filterType !== 'all' && report.type !== filterType) {
        return false;
      }
      return true;
    });
  }, [reports, searchQuery, filterType]);

  /**
   * All distinct report types present in the current data set,
   * plus the synthetic `'all'` bucket the filter UI renders first.
   *
   * ⚠ `uniqueReportTypes` uses `Array.from(set)` rather than
   *   `[...set]` so this compiles with any `target` / without
   *   `--downlevelIteration`.
   */
  const reportTypes = useMemo<string[]>(
    () => ['all', ...uniqueReportTypes(reports)],
    [reports],
  );

  // ────────────────────────────────────────────────────────────
  // Auth gate
  // ────────────────────────────────────────────────────────────

  if (!canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don't have permission to view reports.
        </p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6 max-w-container mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-brand-500 dark:text-brand-400" />
            Reports
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Generate and manage business reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-250 focus-ring disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh reports"
          >
            <RefreshCw
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${
                refreshing ? 'animate-spin' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('generate')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition duration-250 focus-ring ${
            activeTab === 'generate'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Generate Report
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition duration-250 focus-ring ${
            activeTab === 'history'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Report History{' '}
          <span className="tabular-nums">({reports.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'generate' ? (
        <ReportForm
          businessUnitId={resolvedBusinessUnitId}
          companyId={resolvedCompanyId}
        />
      ) : (
        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="card-brand shadow-soft p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search reports..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 transition duration-250"
                  />
                </div>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 cursor-pointer transition duration-250"
              >
                <option
                  value="all"
                  className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  All Types
                </option>
                {reportTypes
                  .filter((t) => t !== 'all')
                  .map((type) => (
                    <option
                      key={type}
                      value={type}
                      className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {String(type).toUpperCase()}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Reports List */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600 dark:text-brand-400" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="card-brand shadow-soft p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery || filterType !== 'all'
                  ? 'No reports match your filters'
                  : 'No reports generated yet'}
              </p>
            </div>
          ) : (
            <ReportViewer
              reports={filteredReports}
              loading={loading}
              onDownload={handleDownload}
              onDelete={(report) => {
                setReportToDelete(report);
                setShowDeleteModal(true);
              }}
              onView={(report) => {
                router.push(`/admin/reports/${report.id}`);
              }}
            />
          )}
        </div>
      )}

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && reportToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
          >
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Delete Report
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete{' '}
                  <strong className="text-gray-900 dark:text-white">
                    {reportToDelete.name}
                  </strong>
                  ?
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-xl transition duration-250 flex items-center gap-2 disabled:opacity-50 focus-ring"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
