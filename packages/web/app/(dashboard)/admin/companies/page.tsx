// packages/web/app/(dashboard)/admin/companies/page.tsx

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Building,
  Edit,
  Trash2,
  Users,
  Briefcase,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Grid,
  List,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  Globe,
  ArrowUpDown,
  Copy,
  Check,
} from 'lucide-react';
import { companyService } from '../../../../services/companyService';
import { toast } from '../../../../utils/toast-manager';
import { formatDistanceToNow } from 'date-fns';

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  taxId?: string | null;
  currency: string;
  timezone: string;
  logo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    businessUnits: number;
    users: number;
    customers: number;
    suppliers: number;
  };
}

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const RESERVED_ROUTE_IDS = new Set([
  'settings',
  'default',
  'search',
  'email',
  'by-business-unit',
  'ensure-user',
  'bulk',
  'export',
  'activity',
  'stats',
  'business-units',
  'default-business-unit',
  'new',
  'edit',
]);

function isReservedRouteId(id: string | undefined | null): boolean {
  if (!id) return false;
  return RESERVED_ROUTE_IDS.has(id);
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt'>(
    'name'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 12,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ✅ Track the last successfully-fetched params to prevent redundant fetches
  const lastFetchKeyRef = useRef<string>('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ✅ Fetch function — no longer depends on the entire `pagination` object
  const loadCompanies = useCallback(
    async (force = false) => {
      const currentKey = JSON.stringify({
        search: debouncedSearch || '',
        page: pagination.page,
        limit: pagination.limit,
        isActive:
          filterStatus === 'all' ? 'all' : filterStatus === 'active',
      });

      if (!force && currentKey === lastFetchKeyRef.current) {
        return;
      }
      lastFetchKeyRef.current = currentKey;

      try {
        setLoading(true);
        const result = await companyService.getAll({
          search: debouncedSearch || undefined,
          limit: pagination.limit,
          page: pagination.page,
          isActive:
            filterStatus === 'all' ? undefined : filterStatus === 'active',
        });

        setCompanies(result.data || []);

        // ✅ Only update pagination if the values actually changed
        setPagination((prev) => {
          const next = {
            total: result.total || 0,
            page: result.page || 1,
            totalPages: result.totalPages || 1,
            limit: result.limit || prev.limit,
          };
          if (
            prev.total === next.total &&
            prev.page === next.page &&
            prev.totalPages === next.totalPages &&
            prev.limit === next.limit
          ) {
            return prev;
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to load companies:', error);
        toast.error('Failed to load companies');
      } finally {
        setLoading(false);
      }
    },
    [
      debouncedSearch,
      filterStatus,
      pagination.page,
      pagination.limit,
    ]
  );

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  // Reset to page 1 when the search or filter changes
  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [debouncedSearch, filterStatus]);

  // Client-side sort of the current page
  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a: any, b: any) => {
      const valA = a[sortBy] ?? '';
      const valB = b[sortBy] ?? '';
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sortOrder === 'asc'
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA);
    });
  }, [companies, sortBy, sortOrder]);

  const handleDelete = async (id: string, name: string) => {
    if (isReservedRouteId(id)) {
      toast.error('Cannot delete: invalid company ID');
      return;
    }

    const company = companies.find((c) => c.id === id);
    const hasAssociations =
      (company?._count?.businessUnits || 0) > 0 ||
      (company?._count?.users || 0) > 0 ||
      (company?._count?.customers || 0) > 0;

    const confirmMessage = hasAssociations
      ? `This company "${name}" has ${company?._count?.businessUnits || 0} business units and ${company?._count?.users || 0} users. It will be archived (soft deleted). Continue?`
      : `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      setDeletingId(id);
      const result = await companyService.delete(id);
      toast.success(result.message || 'Company deleted successfully');
      // ✅ Force a refetch to bypass the dedupe guard
      await loadCompanies(true);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete company');
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (
    text: string,
    label: string,
    key: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        <XCircle className="w-3 h-3" />
        Inactive
      </span>
    );
  };

  const isInitialLoading =
    loading && pagination.page === 1 && companies.length === 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Companies
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {pagination.total} {pagination.total === 1 ? 'company' : 'companies'}{' '}
            in your organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/companies/new"
            prefetch={false}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors shadow-sm focus-ring"
          >
            <Plus className="w-4 h-4" />
            Add Company
          </Link>
        </div>
      </div>

      <div className="card-brand p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')
            }
            className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'name' | 'createdAt' | 'updatedAt')
            }
            className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 dark:text-white"
            aria-label="Sort by field"
          >
            <option value="name">Sort by Name</option>
            <option value="createdAt">Sort by Created</option>
            <option value="updatedAt">Sort by Updated</option>
          </select>

          <button
            type="button"
            onClick={() =>
              setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
            }
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            aria-label="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors focus-ring ${
                viewMode === 'grid'
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors border-l border-gray-300 dark:border-gray-600 focus-ring ${
                viewMode === 'list'
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title="List view"
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadCompanies(true)}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${
                loading ? 'animate-spin' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600 dark:text-brand-400" />
        </div>
      ) : sortedCompanies.length === 0 ? (
        <div className="text-center py-12 card-brand">
          <Building className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            No Companies Found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {search
              ? 'Try adjusting your search terms'
              : 'Get started by creating your first company'}
          </p>
          {!search && (
            <Link
              href="/admin/companies/new"
              prefetch={false}
              className="inline-block mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors focus-ring"
            >
              Create Company
            </Link>
          )}
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="inline-block mt-4 text-brand-600 dark:text-brand-400 hover:underline focus-ring rounded"
            >
              Clear search
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCompanies.map((company) => {
            const invalidId = isReservedRouteId(company.id);
            const copiedThis = copiedKey === `grid-${company.id}`;

            return (
              <div
                key={company.id}
                className="card-brand p-6 hover:shadow-card-hover transition-shadow group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 bg-brand-50 dark:bg-brand-900/30 rounded-xl flex-shrink-0">
                      {company.logo ? (
                        <img
                          src={company.logo}
                          alt={company.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <Building className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3
                        className="font-semibold text-gray-900 dark:text-white truncate"
                        title={company.name}
                      >
                        {company.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {company.email}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(company.isActive)}
                </div>

                <div className="mb-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                    ID:
                  </span>
                  <code className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate flex-1">
                    {company.id}
                  </code>
                  <button
                    type="button"
                    onClick={(e) =>
                      copyToClipboard(
                        company.id,
                        'Company ID',
                        `grid-${company.id}`,
                        e
                      )
                    }
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 focus-ring"
                    title="Copy Company ID"
                    aria-label="Copy Company ID"
                  >
                    {copiedThis ? (
                      <Check className="w-3 h-3 text-success-500" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  {company.phone && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      {company.phone}
                    </p>
                  )}
                  {company.address && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                      <span className="truncate">{company.address}</span>
                    </p>
                  )}
                  <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    {company.currency} • {company.timezone}
                  </p>
                </div>

                <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    <Briefcase className="w-3.5 h-3.5" />
                    {company._count?.businessUnits || 0} Units
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    <Users className="w-3.5 h-3.5" />
                    {company._count?.users || 0} Users
                  </span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDistanceToNow(new Date(company.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <div className="flex gap-1">
                    {invalidId ? (
                      <span
                        className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
                        title="Invalid ID — action disabled"
                      >
                        <Eye className="w-3.5 h-3.5 text-gray-400" />
                      </span>
                    ) : (
                      <Link
                        href={`/admin/companies/${company.id}`}
                        prefetch={false}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </Link>
                    )}
                    {invalidId ? (
                      <span
                        className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
                        title="Invalid ID — action disabled"
                      >
                        <Edit className="w-3.5 h-3.5 text-gray-400" />
                      </span>
                    ) : (
                      <Link
                        href={`/admin/companies/${company.id}/edit`}
                        prefetch={false}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                        title="Edit"
                      >
                        <Edit className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(company.id, company.name)}
                      disabled={deletingId === company.id || invalidId}
                      className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                      title={invalidId ? 'Invalid ID — action disabled' : 'Delete'}
                      aria-label="Delete company"
                    >
                      {deletingId === company.id ? (
                        <Loader2 className="w-3.5 h-3.5 text-danger-500 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-danger-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card-brand p-0 overflow-hidden">
          <div className="overflow-x-auto sidebar-scroll">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Company ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Units
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Users
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedCompanies.map((company) => {
                  const invalidId = isReservedRouteId(company.id);
                  const copiedThis = copiedKey === `list-${company.id}`;

                  return (
                    <tr
                      key={company.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                            {company.logo ? (
                              <img
                                src={company.logo}
                                alt={company.name}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <Building className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {company.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {company.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-gray-600 dark:text-gray-400">
                            {company.id}
                          </code>
                          <button
                            type="button"
                            onClick={(e) =>
                              copyToClipboard(
                                company.id,
                                'Company ID',
                                `list-${company.id}`,
                                e
                              )
                            }
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                            title="Copy Company ID"
                            aria-label="Copy Company ID"
                          >
                            {copiedThis ? (
                              <Check className="w-3 h-3 text-success-500" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {company.email}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(company.isActive)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                        {company._count?.businessUnits || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                        {company._count?.users || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                        {new Date(company.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {invalidId ? (
                            <span
                              className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
                              title="Invalid ID — action disabled"
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                            </span>
                          ) : (
                            <Link
                              href={`/admin/companies/${company.id}`}
                              prefetch={false}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                              title="View"
                            >
                              <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </Link>
                          )}
                          {invalidId ? (
                            <span
                              className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
                              title="Invalid ID — action disabled"
                            >
                              <Edit className="w-4 h-4 text-gray-400" />
                            </span>
                          ) : (
                            <Link
                              href={`/admin/companies/${company.id}/edit`}
                              prefetch={false}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(company.id, company.name)
                            }
                            disabled={deletingId === company.id || invalidId}
                            className="p-1.5 hover:bg-danger-100 dark:hover:bg-danger-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                            title={
                              invalidId ? 'Invalid ID — action disabled' : 'Delete'
                            }
                            aria-label="Delete company"
                          >
                            {deletingId === company.id ? (
                              <Loader2 className="w-4 h-4 text-danger-500 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-danger-500" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.max(1, prev.page - 1),
                }))
              }
              disabled={pagination.page === 1}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.min(prev.totalPages, prev.page + 1),
                }))
              }
              disabled={pagination.page === pagination.totalPages}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
