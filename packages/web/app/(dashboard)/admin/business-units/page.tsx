// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\business-units\page.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Building,
  Edit,
  Trash2,
  Users,
  Package,
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
  Store,
  Warehouse,
  Home,
  ArrowUpDown,
} from 'lucide-react';
import { businessUnitService } from '../../../../services/businessUnitService';
import { toast } from '../../../../utils/toast-manager';
import { formatDistanceToNow } from 'date-fns';

// Types
interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  type?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products?: number;
    users?: number;
    userBusinessUnits?: number;
    sales?: number;
    inventory?: number;
  };
}

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export default function BusinessUnitsPage() {
  const router = useRouter();
  const [units, setUnits] = useState<BusinessUnit[]>([]);
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
  const [refreshing, setRefreshing] = useState(false);

  const loadUnits = useCallback(async () => {
    try {
      setLoading(true);
      const result = await businessUnitService.getAllBusinessUnits({
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

      setUnits(sortedData);
      setPagination({
        total: result.total || 0,
        page: result.page || 1,
        totalPages: result.totalPages || 1,
        limit: result.limit || 12,
      });
    } catch (error) {
      console.error('Failed to load business units:', error);
      toast.error('Failed to load business units');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, sortBy, sortOrder, pagination.page, pagination.limit]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUnits();
    setRefreshing(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!id || id === 'default') {
      toast.error('Invalid business unit ID');
      return;
    }
    
    const unit = units.find(u => u.id === id);
    const productCount = unit?._count?.products || 0;
    const userCount = unit?._count?.userBusinessUnits || unit?._count?.users || 0;
    const hasAssociations = productCount > 0 || userCount > 0;
    
    const confirmMessage = hasAssociations
      ? `This business unit "${name}" has ${productCount} products and ${userCount} users. It will be archived (soft deleted). Continue?`
      : `Are you sure you want to permanently delete "${name}"? This action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) return;
    
    try {
      setDeletingId(id);
      const result = await businessUnitService.deleteBusinessUnit(id);
      toast.success(result.message || 'Business unit deleted successfully');
      await loadUnits();
    } catch (error: any) {
      console.error('Failed to delete:', error);
      toast.error(error?.message || 'Failed to delete business unit');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    const validIds = selectedIds.filter(id => id && id !== 'default');
    if (validIds.length === 0) {
      toast.error('No valid business unit IDs selected');
      return;
    }
    
    if (!window.confirm(`Delete ${validIds.length} selected business units?`)) return;
    
    try {
      const result = await businessUnitService.bulkDeleteBusinessUnits(validIds);
      const totalProcessed = (result.deletedCount || 0) + (result.softDeletedCount || 0);
      toast.success(`Processed ${totalProcessed} business units`);
      setSelectedIds([]);
      await loadUnits();
    } catch (error: any) {
      console.error('Failed to bulk delete:', error);
      toast.error(error?.message || 'Failed to delete business units');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === units.length && units.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(units.map(u => u.id));
    }
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

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'HEADQUARTERS': return <Home className="w-4 h-4" />;
      case 'WAREHOUSE': return <Warehouse className="w-4 h-4" />;
      case 'STORE': return <Store className="w-4 h-4" />;
      case 'BRANCH': return <Building className="w-4 h-4" />;
      default: return <Building className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type?: string) => {
    if (!type) return 'Store';
    const labels: Record<string, string> = {
      HEADQUARTERS: 'Headquarters',
      BRANCH: 'Branch',
      WAREHOUSE: 'Warehouse',
      STORE: 'Store',
    };
    return labels[type] || type;
  };

  if (loading && pagination.page === 1 && units.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Business Units</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {pagination.total} {pagination.total === 1 ? 'business unit' : 'business units'} across your organization
          </p>
        </div>
        <Link
          href="/admin/business-units/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Business Unit
        </Link>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
              />
            </div>
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as any);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white transition-colors"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white transition-colors"
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
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedIds.length} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {units.length === 0 && !loading ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Building className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Business Units Found</h3>
          <p className="text-gray-500 dark:text-gray-400">
            {search ? 'Try adjusting your search terms' : 'Get started by creating your first business unit'}
          </p>
          {!search && (
            <Link
              href="/admin/business-units/new"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Business Unit
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
        // Grid View
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {units.map((unit) => (
            <div
              key={unit.id}
              className={`group bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all hover:shadow-md ${
                selectedIds.includes(unit.id) 
                  ? 'border-blue-500 ring-2 ring-blue-500/50' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Select Checkbox */}
              <div className="p-3 pb-0">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(unit.id)}
                  onChange={() => toggleSelect(unit.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-900 transition-colors"
                />
              </div>

              <div className="p-4 pt-2">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
                      <span className="text-blue-600 dark:text-blue-400">
                        {getTypeIcon(unit.type)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate" title={unit.name}>
                        {unit.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{unit.code}</p>
                    </div>
                  </div>
                  {getStatusBadge(unit.isActive)}
                </div>

                <div className="space-y-1.5 mb-3 text-sm">
                  {unit.address && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                      <span className="truncate text-xs">{unit.address}</span>
                    </p>
                  )}
                  {unit.phone && (
                    <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5 text-xs">
                      <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                      <span>{unit.phone}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {unit._count?.userBusinessUnits || unit._count?.users || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    {unit._count?.products || 0}
                  </span>
                  {unit._count?.sales !== undefined && unit._count.sales > 0 && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      {unit._count.sales}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDistanceToNow(new Date(unit.createdAt), { addSuffix: true })}
                  </span>
                  <div className="flex gap-0.5">
                    <Link
                      href={`/admin/business-units/${unit.id}`}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </Link>
                    <Link
                      href={`/admin/business-units/${unit.id}/edit`}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </Link>
                    <button
                      onClick={() => handleDelete(unit.id, unit.name)}
                      disabled={deletingId === unit.id}
                      className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === unit.id ? (
                        <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === units.length && units.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-900"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name / Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Users</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Products</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit, index) => (
                  <tr
                    key={unit.id}
                    className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      selectedIds.includes(unit.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    } ${index % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(unit.id)}
                        onChange={() => toggleSelect(unit.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-900"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{unit.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{unit.code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(unit.isActive)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {unit._count?.userBusinessUnits || unit._count?.users || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{unit._count?.products || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(unit.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/business-units/${unit.id}`}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                        <Link
                          href={`/admin/business-units/${unit.id}/edit`}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </Link>
                        <button
                          onClick={() => handleDelete(unit.id, unit.name)}
                          disabled={deletingId === unit.id}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === unit.id ? (
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
