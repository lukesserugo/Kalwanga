'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Building2,
  MapPin,
  Users,
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  businessUnitService,
  type PaginatedResponse,
  type BulkDeleteResult,
} from '../../services/businessUnitService';
import {
  getBusinessUnitTypeLabel,
  getBusinessUnitStatusLabel,
  getBusinessUnitStatusColor,
  type BusinessUnit,
  type BusinessUnitType,
} from '../../types/businessUnit';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface ListFilters {
  search: string;
  isActive: 'all' | 'true' | 'false';
  type: 'all' | BusinessUnitType;
}

const DEFAULT_FILTERS: ListFilters = {
  search: '',
  isActive: 'all',
  type: 'all',
};

const PAGE_SIZE = 12;

// ============================================
// COMPONENT
// ============================================

export default function BusinessUnitList() {
  const router = useRouter();

  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ============================================
  // DATA FETCH
  // ============================================

  const loadBusinessUnits = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: {
        page: number;
        limit: number;
        search?: string;
        isActive?: boolean;
      } = {
        page,
        limit: PAGE_SIZE,
      };

      if (filters.search.trim()) {
        params.search = filters.search.trim();
      }

      if (filters.isActive !== 'all') {
        params.isActive = filters.isActive === 'true';
      }

      const result: PaginatedResponse<BusinessUnit> =
        await businessUnitService.getAll(params);

      setBusinessUnits(result.data);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load business units';
      setError(message);
      console.error('Failed to load business units:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadBusinessUnits();
  }, [loadBusinessUnits]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [filters.search, filters.isActive, filters.type]);

  // ============================================
  // FILTER HANDLERS
  // ============================================

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleIsActiveChange = (value: 'all' | 'true' | 'false') => {
    setFilters((prev) => ({ ...prev, isActive: value }));
  };

  const handleTypeChange = (value: 'all' | BusinessUnitType) => {
    setFilters((prev) => ({ ...prev, type: value }));
  };

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // ============================================
  // SELECTION
  // ============================================

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === businessUnits.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(businessUnits.map((u) => u.id)));
    }
  };

  const isAllSelected =
    businessUnits.length > 0 && selectedIds.size === businessUnits.length;

  // ============================================
  // DELETE HANDLERS
  // ============================================

  const handleDeleteOne = async (unit: BusinessUnit) => {
    const confirmMessage = unit._count?.products
      ? `"${unit.name}" has ${unit._count.products} products. It will be archived (soft deleted). Continue?`
      : `Are you sure you want to delete "${unit.name}"? This cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    setDeleting(true);
    try {
      const result = await businessUnitService.delete(unit.id);
      toast.success(result.message || 'Business unit deleted successfully');
      await loadBusinessUnits();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete business unit';
      toast.error(message);
    } finally {
      setDeleting(false);
      setOpenMenuId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${ids.length} business unit(s)? Business units with associated records will be archived instead of removed.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const result: BulkDeleteResult =
        await businessUnitService.bulkDeleteBusinessUnits(ids);

      if (result.errors.length > 0) {
        toast.error(
          `Deleted ${result.deletedCount + result.softDeletedCount}, but ${result.errors.length} failed`
        );
      } else {
        toast.success(
          `Deleted ${result.deletedCount} and archived ${result.softDeletedCount} business unit(s)`
        );
      }

      setSelectedIds(new Set());
      await loadBusinessUnits();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete business units';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================

  const handleCreate = () => {
    router.push('/admin/business-units/new');
  };

  const handleEdit = (id: string) => {
    router.push(`/admin/business-units/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/admin/business-units/${id}`);
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        <XCircle className="w-3 h-3" />
        Inactive
      </span>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Business Units
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 tabular-nums">
            {total} {total === 1 ? 'business unit' : 'business units'} total
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadBusinessUnits}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50 focus-ring"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all flex items-center gap-2 focus-ring"
          >
            <Plus className="w-4 h-4" />
            Add Business Unit
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-brand !p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, code, or email..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none transition-shadow"
            />
          </div>

          <select
            value={filters.isActive}
            onChange={(e) =>
              handleIsActiveChange(e.target.value as 'all' | 'true' | 'false')
            }
            className="input-brand !w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) =>
              handleTypeChange(e.target.value as 'all' | BusinessUnitType)
            }
            className="input-brand !w-auto"
          >
            <option value="all">All Types</option>
            <option value="HEADQUARTERS">Headquarters</option>
            <option value="BRANCH">Branch</option>
            <option value="WAREHOUSE">Warehouse</option>
            <option value="STORE">Store</option>
          </select>
        </div>

        {(filters.search || filters.isActive !== 'all' || filters.type !== 'all') && (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleClearFilters}
              className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition-colors focus-ring rounded"
            >
              <XCircle className="w-3.5 h-3.5" />
              Clear filters
            </button>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
              {businessUnits.length} result{businessUnits.length !== 1 ? 's' : ''} shown
            </span>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg flex items-center justify-between animate-slide-down">
          <p className="text-sm text-brand-700 dark:text-brand-300">
            <span className="font-semibold tabular-nums">{selectedIds.size}</span>{' '}
            business unit{selectedIds.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 rounded-lg transition-colors focus-ring"
            >
              Clear selection
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-sm bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 focus-ring"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl p-6 text-center animate-slide-down">
          <AlertCircle className="w-12 h-12 text-danger-600 dark:text-danger-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-danger-800 dark:text-danger-300 mb-2">
            Failed to Load Business Units
          </h3>
          <p className="text-sm text-danger-700 dark:text-danger-400 mb-4">{error}</p>
          <button
            onClick={loadBusinessUnits}
            className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors focus-ring"
          >
            Try Again
          </button>
        </div>
      ) : businessUnits.length === 0 ? (
        <div className="card-brand !p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {filters.search || filters.isActive !== 'all' || filters.type !== 'all'
              ? 'No business units match your filters'
              : 'No business units yet'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {filters.search || filters.isActive !== 'all' || filters.type !== 'all'
              ? 'Try adjusting or clearing your filters.'
              : 'Create your first business unit to get started.'}
          </p>
          {filters.search || filters.isActive !== 'all' || filters.type !== 'all' ? (
            <button
              onClick={handleClearFilters}
              className="btn-secondary focus-ring"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all inline-flex items-center gap-2 focus-ring"
            >
              <Plus className="w-4 h-4" />
              Create Business Unit
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="card-brand !p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 focus:outline-none"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Counts
                  </th>
                  <th className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {businessUnits.map((unit) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-orange-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(unit.id)}
                        onChange={() => toggleSelect(unit.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 focus:outline-none"
                        aria-label={`Select ${unit.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleView(unit.id)}
                        className="text-left group focus-ring rounded"
                      >
                        <p className="font-medium text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {unit.name}
                        </p>
                        <div className="flex items-center gap-3 text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="font-mono tabular-nums">
                            {unit.code}
                          </span>
                          {unit.address && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600">
                                ·
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {unit.address}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {getBusinessUnitTypeLabel(unit.type)}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(unit.isActive)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-2xs text-gray-600 dark:text-gray-400 tabular-nums">
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {unit._count?.products ?? 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {unit._count?.userBusinessUnits ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                      {new Date(unit.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === unit.id ? null : unit.id
                            )
                          }
                          className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                          aria-label="Actions"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>

                        {openMenuId === unit.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover border border-gray-200 dark:border-gray-700 z-20 py-1">
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleView(unit.id);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors focus-ring"
                              >
                                <Building2 className="w-3.5 h-3.5" />
                                View
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleEdit(unit.id);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors focus-ring"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteOne(unit)}
                                disabled={deleting}
                                className="w-full text-left px-3 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 flex items-center gap-2 disabled:opacity-50 transition-colors focus-ring"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - page) <= 1) return true;
                    return false;
                  })
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev !== undefined && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && (
                          <span className="px-2 text-gray-400">…</span>
                        )}
                        <button
                          onClick={() => setPage(p)}
                          disabled={loading}
                          className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 tabular-nums focus-ring ${
                            p === page
                              ? 'bg-brand-gradient text-white shadow-brand'
                              : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
