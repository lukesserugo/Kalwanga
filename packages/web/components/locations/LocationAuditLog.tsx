'use client';

// packages/web/components/locations/LocationAuditLog.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../utils/toast-manager';
import { formatDate } from '../../utils/formatters';
import LocationBUSelector from './LocationBUSelector';
import LocationDataTable, { type Column } from './LocationDataTable';

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  severity: string;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
  changes?: any;
  ipAddress?: string | null;
}

interface LocationAuditLogProps {
  initialBusinessUnitId?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  INFO: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  MEDIUM: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
  HIGH: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  CRITICAL: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
};

export function LocationAuditLog({ initialBusinessUnitId }: LocationAuditLogProps) {
  const [businessUnitId, setBusinessUnitId] = useState(initialBusinessUnitId ?? '');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    if (!businessUnitId) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const raw = await api.get<any>('/audit-logs', {
        params: {
          businessUnitId,
          entityType: 'Location',
          limit: 200,
          ...(actionFilter ? { action: actionFilter } : {}),
        },
      });
      const list: AuditRow[] =
        raw?.data?.items ?? raw?.data ?? raw?.items ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load location audit log:', err);
      toast.error(err?.message || 'Failed to load audit log');
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.entityName ?? '').toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.user?.email ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns: Column<AuditRow>[] = [
    {
      key: 'when',
      header: 'When',
      render: (r) => (
        <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">
          {formatDate(r.createdAt)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {r.action}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Location',
      hideBelow: 'sm',
      render: (r) => (
        <span className="text-gray-600 dark:text-gray-400">
          {r.entityName ?? r.entityId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      hideBelow: 'md',
      render: (r) =>
        r.user ? (
          <span className="text-gray-600 dark:text-gray-400">
            {r.user.firstName} {r.user.lastName}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">System</span>
        ),
    },
    {
      key: 'severity',
      header: 'Severity',
      hideBelow: 'lg',
      render: (r) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-2xs font-medium ${
            SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.INFO
          }`}
        >
          {r.severity}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <LocationBUSelector value={businessUnitId} onChange={setBusinessUnitId} />

        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, location, or user…"
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`px-3 py-2 border rounded-lg text-sm transition duration-250 inline-flex items-center gap-1.5 focus-ring ${
            showFilters || actionFilter
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-250 disabled:opacity-50 focus-ring"
          title="Refresh"
          aria-label="Refresh audit log"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 flex flex-wrap items-center gap-3 animate-slide-down">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250"
          >
            <option value="">All actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="VIEW">View</option>
          </select>
          {actionFilter && (
            <button
              type="button"
              onClick={() => setActionFilter('')}
              className="text-sm text-danger-600 hover:text-danger-700 dark:text-danger-400 flex items-center gap-1 transition duration-250 focus-ring rounded"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      )}

      {!businessUnitId ? (
        <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-warning-500 mx-auto mb-2" />
          <p className="text-sm text-warning-700 dark:text-warning-300">
            Select a business unit to view its audit log.
          </p>
        </div>
      ) : (
        <LocationDataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="No location activity recorded yet."
        />
      )}
    </div>
  );
}

export default LocationAuditLog;
