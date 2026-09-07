// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\customers\page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Edit, Trash2, RefreshCw, Search,
  Mail, Phone, MapPin, Star, Award, Calendar,
  Eye, Loader2, Lock, Grid, List, ArrowUpDown,
  Download, Upload, UserPlus, TrendingUp, ShoppingBag
} from 'lucide-react';
import { usePermission } from '../../../../hooks/usePermission';
import { useAuth } from '../../../../hooks/useAuth';
import { customerService } from '../../../../services/customerService';
import { toast } from '../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../utils/formatters';
import { PermissionResource } from '../../../../types/enums';
import { Customer } from '../../../../types/customer';

export default function CustomersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete, canManage } = usePermission();
  
  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortBy, setSortBy] = useState<'name' | 'spent' | 'points' | 'date'>('name');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });

  const companyId = user?.companyId || 'default';

  // Permission checks
  const canViewCustomers = canView(PermissionResource.CUSTOMER) || canManage(PermissionResource.CUSTOMER);
  const canCreateCustomers = canCreate(PermissionResource.CUSTOMER) || canManage(PermissionResource.CUSTOMER);
  const canEditCustomers = canEdit(PermissionResource.CUSTOMER) || canManage(PermissionResource.CUSTOMER);
  const canDeleteCustomers = canDelete(PermissionResource.CUSTOMER) || canManage(PermissionResource.CUSTOMER);

  // Load customers
  const loadCustomers = useCallback(async (showLoading = true) => {
    if (!canViewCustomers) {
      setLoading(false);
      return;
    }
    
    try {
      if (showLoading) setLoading(true);
      
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        companyId,
      };
      
      if (searchQuery) params.search = searchQuery;
      if (statusFilter === 'active') params.isActive = true;
      if (statusFilter === 'inactive') params.isActive = false;

      const result = await customerService.getAllCustomers(params);
      
      let customersData: Customer[] = [];
      let total = 0;
      let totalPages = 1;
      
      if (result && typeof result === 'object') {
        if ('data' in result && Array.isArray(result.data)) {
          customersData = result.data;
          total = result.total || customersData.length;
          totalPages = result.totalPages || Math.ceil(total / pagination.limit) || 1;
        } else if (Array.isArray(result)) {
          customersData = result;
          total = customersData.length;
          totalPages = 1;
        }
      }
      
      setCustomers(customersData);
      setPagination(prev => ({ ...prev, total, totalPages }));
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, canViewCustomers, searchQuery, statusFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCustomers(false);
    toast.success('Customers refreshed');
  };

  // Delete handler
  const handleDelete = async () => {
    if (!customerToDelete) return;
    setDeleting(true);
    try {
      await customerService.deleteCustomer(customerToDelete.id);
      toast.success('Customer deleted successfully');
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      loadCustomers(false);
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  // Export handler
  const handleExport = async () => {
    try {
      await customerService.exportCustomers('csv');
      toast.success('Customers exported successfully');
    } catch (error) {
      console.error('Failed to export customers:', error);
      toast.error('Failed to export customers');
    }
  };

  // Get loyalty tier
  const getLoyaltyTier = (points: number) => {
    if (points >= 1000) return { label: 'Platinum', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' };
    if (points >= 500) return { label: 'Gold', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
    if (points >= 200) return { label: 'Silver', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300' };
    return { label: 'Bronze', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
  };

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let filtered = [...customers];
    
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.firstName?.toLowerCase().includes(search) ||
        c.lastName?.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phoneNumber?.toLowerCase().includes(search)
      );
    }
    
    if (statusFilter === 'active') {
      filtered = filtered.filter(c => c.isActive);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(c => !c.isActive);
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'spent':
          comparison = (a.totalSpent || 0) - (b.totalSpent || 0);
          break;
        case 'points':
          comparison = (a.loyaltyPoints || 0) - (b.loyaltyPoints || 0);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [customers, searchQuery, statusFilter, sortBy, sortOrder]);

  // Access denied
  if (!canViewCustomers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view customers.</p>
      </div>
    );
  }

  // Loading state
  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            Customers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {pagination.total || customers.length} customers • Manage your customer relationships
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-lg p-1 border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            title="Export"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {canCreateCustomers && (
            <Link
              href="/admin/customers/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </Link>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
          >
            <option value="name">Sort by Name</option>
            <option value="spent">Sort by Spent</option>
            <option value="points">Sort by Points</option>
            <option value="date">Sort by Date</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Customers Display */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No customers found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {searchQuery ? 'Try adjusting your search' : 'Add your first customer'}
          </p>
          {canCreateCustomers && !searchQuery && (
            <Link
              href="/admin/customers/create"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add Customer
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCustomers.map((customer) => {
            const tier = getLoyaltyTier(customer.loyaltyPoints || 0);
            return (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <Link href={`/admin/customers/${customer.id}`} className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {customer.firstName?.[0]}{customer.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {customer.firstName} {customer.lastName}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{customer.email}</p>
                    </div>
                  </Link>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    {canEditCustomers && (
                      <Link
                        href={`/admin/customers/${customer.id}/edit`}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </Link>
                    )}
                    {canDeleteCustomers && (
                      <button
                        onClick={() => {
                          setCustomerToDelete(customer);
                          setShowDeleteModal(true);
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Phone className="w-3 h-3" />
                    <span>{customer.phoneNumber}</span>
                  </div>
                  {customer.city && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{customer.city}{customer.country ? `, ${customer.country}` : ''}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${tier.color}`}>
                      {tier.label}
                    </span>
                    <span className="text-xs text-gray-500">{customer.loyaltyPoints || 0} pts</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatCurrency(customer.totalSpent || 0)}
                    </p>
                    <p className="text-xs text-gray-500">Total Spent</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span className={`px-2 py-0.5 rounded-full ${
                    customer.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {customer.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Loyalty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">Total Spent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCustomers.map((customer) => {
                  const tier = getLoyaltyTier(customer.loyaltyPoints || 0);
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/customers/${customer.id}`} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                            {customer.firstName?.[0]}{customer.lastName?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {customer.firstName} {customer.lastName}
                            </p>
                            <p className="text-sm text-gray-500">{customer.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phoneNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${tier.color}`}>
                          {tier.label}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">{customer.loyaltyPoints || 0} pts</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(customer.totalSpent || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          customer.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/customers/${customer.id}`}
                            className="p-1.5 hover:bg-gray-100 rounded"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </Link>
                          {canEditCustomers && (
                            <Link
                              href={`/admin/customers/${customer.id}/edit`}
                              className="p-1.5 hover:bg-blue-100 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-blue-500" />
                            </Link>
                          )}
                          {canDeleteCustomers && (
                            <button
                              onClick={() => {
                                setCustomerToDelete(customer);
                                setShowDeleteModal(true);
                              }}
                              className="p-1.5 hover:bg-red-100 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          )}
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {customers.length} of {pagination.total} customers
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && customerToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Customer</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong>{customerToDelete.firstName} {customerToDelete.lastName}</strong>?
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
