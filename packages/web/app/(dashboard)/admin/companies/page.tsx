// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\companies\page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Building,
  Edit,
  Trash2,
  Users,
  Briefcase,
  DollarSign,
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
  Mail,
  Globe,
  ArrowUpDown,
  Filter,
  MoreVertical,
  Download,
  Upload,
  Settings,
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

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'updatedAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 12,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, [search, filterStatus, sortBy, sortOrder, pagination.page]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const result = await companyService.getAll({
        search: search || undefined,
        limit: pagination.limit,
        page: pagination.page,
        isActive: filterStatus === 'all' ? undefined : filterStatus === 'active',
      });
      
      let sortedData = result.data || [];
      sortedData.sort((a: any, b: any) => {
        const valA = a[sortBy] || '';
        const valB = b[sortBy] || '';
        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });

      setCompanies(sortedData);
      setPagination({
        total: result.total || 0,
        page: result.page || 1,
        totalPages: result.totalPages || 1,
        limit: result.limit || 12,
      });
    } catch (error) {
      console.error('Failed to load companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const company = companies.find(c => c.id === id);
    const hasAssociations = (company?._count?.businessUnits || 0) > 0 || 
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
      await loadCompanies();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete company');
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
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

  if (loading && pagination.page === 1) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Companies</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {pagination.total} {pagination.total === 1 ? 'company' : 'companies'} in your organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/companies/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Company
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
          >
            <option value="name">Sort by Name</option>
            <option value="createdAt">Sort by Created</option>
            <option value="updatedAt">Sort by Updated</option>
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>

          {/* View Toggle */}
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors border-l border-gray-300 dark:border-gray-600 ${
                viewMode === 'list' 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={loadCompanies}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      {companies.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Building className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Companies Found</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {search ? 'Try adjusting your search terms' : 'Get started by creating your first company'}
          </p>
          {!search && (
            <Link
              href="/admin/companies/new"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Company
            </Link>
          )}
          {search && (
            <button
              onClick={() => setSearch('')}
              className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <div
              key={company.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
                    {company.logo ? (
                      <img src={company.logo} alt={company.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={company.name}>
                      {company.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{company.email}</p>
                  </div>
                </div>
                {getStatusBadge(company.isActive)}
              </div>

              {/* Company ID - Quick Copy */}
              <div className="mb-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-1.5">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">ID:</span>
                <code className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate flex-1">{company.id}</code>
                <button
                  onClick={(e) => copyToClipboard(company.id, 'Company ID', e)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                  title="Copy Company ID"
                >
                  {copied === 'Company ID' ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Details */}
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

              {/* Stats */}
              <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Briefcase className="w-3.5 h-3.5" />
                  {company._count?.businessUnits || 0} Units
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Users className="w-3.5 h-3.5" />
                  {company._count?.users || 0} Users
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDistanceToNow(new Date(company.createdAt), { addSuffix: true })}
                </span>
                <div className="flex gap-1">
                  <Link
                    href={`/admin/companies/${company.id}`}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  </Link>
                  <Link
                    href={`/admin/companies/${company.id}/edit`}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  </Link>
                  <button
                    onClick={() => handleDelete(company.id, company.name)}
                    disabled={deletingId === company.id}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === company.id ? (
                      <Loader2 className="w-3.5 h-3.5 text-red-500 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Company ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Units</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Users</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          {company.logo ? (
                            <img src={company.logo} alt={company.name} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{company.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{company.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-gray-600 dark:text-gray-400">{company.id}</code>
                        <button
                          onClick={(e) => copyToClipboard(company.id, 'Company ID', e)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Copy Company ID"
                        >
                          {copied === 'Company ID' ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{company.email}</td>
                    <td className="px-4 py-3">{getStatusBadge(company.isActive)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{company._count?.businessUnits || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{company._count?.users || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(company.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link
                          href={`/admin/companies/${company.id}`}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                        <Link
                          href={`/admin/companies/${company.id}/edit`}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                        <button
                          onClick={() => handleDelete(company.id, company.name)}
                          disabled={deletingId === company.id}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === company.id ? (
                            <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
