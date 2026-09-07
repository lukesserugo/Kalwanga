// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\checkout\history\page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Search, Filter, RefreshCw, Loader2,
  Eye, Download, Printer, ChevronLeft, ChevronRight,
  Calendar, Clock, User, Mail, Phone, DollarSign,
  ShoppingBag, CreditCard, CheckCircle, XCircle,
  AlertCircle, FileText, Trash2, MoreVertical,
  ChevronDown, ChevronUp, Copy, ExternalLink
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { checkoutService } from '../../../../../services/checkoutService';
import { formatCurrency, formatDate, formatDateTime } from '../../../../../utils/formatters';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

// ✅ FIXED: Use consistent Sale interface that matches the service response
interface Sale {
  id: string;
  receiptNumber: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  notes?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  userId: string;
  userName?: string;
  businessUnitId: string;
  businessUnitName?: string;
  saleDate: string;
  createdAt: string;
  items?: any[];
  payments?: any[];
}

// ✅ FIXED: Import Lock from lucide-react directly
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400 dark:text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

export default function CheckoutHistoryPage() {
  const router = useRouter();
  const { canView, isLoading: permissionLoading } = usePermission();
  const { isDark } = useThemeStore();
  
  const [checkouts, setCheckouts] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (canView(PermissionResource.SALE)) {
      loadHistory();
    }
  }, [pagination.page, statusFilter, dateFrom, dateTo]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (search) params.search = search;

      const response = await checkoutService.getCheckoutHistory(params);
      
      // ✅ FIXED: Map response data to Sale interface
      const mappedCheckouts: Sale[] = (response.data || []).map((item: any) => ({
        id: item.id,
        receiptNumber: item.receiptNumber,
        subtotal: item.subtotal || 0,
        tax: item.tax || 0,
        discount: item.discount || 0,
        total: item.total || 0,
        paidAmount: item.paidAmount || 0,
        changeAmount: item.changeAmount || 0,
        paymentMethod: item.paymentMethod || 'N/A',
        paymentStatus: item.paymentStatus || 'N/A',
        status: item.status || 'PENDING',
        notes: item.notes,
        customerId: item.customerId,
        customerName: item.customer?.firstName ? `${item.customer.firstName} ${item.customer.lastName}` : item.customerName,
        customerEmail: item.customer?.email || item.customerEmail,
        customerPhone: item.customer?.phone || item.customerPhone,
        userId: item.userId,
        userName: item.user?.firstName ? `${item.user.firstName} ${item.user.lastName}` : item.userName,
        businessUnitId: item.businessUnitId,
        businessUnitName: item.businessUnit?.name || item.businessUnitName,
        saleDate: item.saleDate || item.createdAt,
        createdAt: item.createdAt,
        items: item.items || [],
        payments: item.payments || [],
      }));
      
      setCheckouts(mappedCheckouts);
      setPagination({
        page: response.page || 1,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        limit: response.limit || 20,
      });
    } catch (error) {
      console.error('Failed to load history:', error);
      toast.error('Failed to load checkout history');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadHistory();
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadHistory();
  };

  const handleViewDetails = (checkout: Sale) => {
    setSelectedCheckout(checkout);
    setShowDetailModal(true);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      PROCESSING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      VOIDED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!canView(PermissionResource.SALE)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <LockIcon />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view checkout history.</p>
        <button
          onClick={() => router.push('/admin/checkout')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Checkout
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/checkout')}
            className={`p-2 rounded-lg transition ${
              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Checkout History
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              View all past checkout transactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={`p-2 rounded-lg transition ${
              isDark
                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                : 'bg-white hover:bg-gray-100 text-gray-700'
            } border ${isDark ? 'border-gray-700' : 'border-gray-300'} disabled:opacity-50`}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => router.push('/admin/checkout/export')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by receipt, customer, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                isDark
                  ? 'bg-gray-700 text-white placeholder-gray-400'
                  : 'bg-gray-100 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
              showFilters || statusFilter !== 'all' || dateFrom || dateTo
                ? 'bg-blue-600 text-white'
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(statusFilter !== 'all' || dateFrom || dateTo) && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                {(statusFilter !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
              </span>
            )}
          </button>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            Search
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="all">All Status</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="VOIDED">Voided</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${
                    isDark
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDateFrom('');
                  setDateTo('');
                  setSearch('');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : checkouts.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              No checkout history found
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Try adjusting your filters or search terms
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Receipt
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Date
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Customer
                    </th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Total
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Payment
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Status
                    </th>
                    <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {checkouts.map((checkout) => (
                    <tr key={checkout.id} className={`transition-colors ${
                      isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className={`font-mono text-sm font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            #{checkout.receiptNumber}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {checkout.items?.length || 0} items
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {formatDate(checkout.saleDate || checkout.createdAt)}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {formatDateTime(checkout.saleDate || checkout.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {checkout.customerName || 'Guest'}
                          </p>
                          {checkout.customerEmail && (
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {checkout.customerEmail}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {formatCurrency(checkout.total)}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Paid: {formatCurrency(checkout.paidAmount || checkout.total)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs capitalize ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          {checkout.paymentMethod?.toLowerCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(checkout.status)}`}>
                          {checkout.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleViewDetails(checkout)}
                            className={`p-1.5 rounded-lg transition ${
                              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            }`}
                            title="View details"
                          >
                            <Eye className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/receipt/${checkout.receiptNumber}`;
                              navigator.clipboard.writeText(url);
                              toast.success('Receipt link copied');
                            }}
                            className={`p-1.5 rounded-lg transition ${
                              isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            }`}
                            title="Copy receipt link"
                          >
                            <Copy className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className={`px-4 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-wrap items-center justify-between gap-3`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className={`px-3 py-1 rounded-lg text-sm transition disabled:opacity-50 ${
                      isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                    } border`}
                  >
                    <ChevronLeft className="w-4 h-4 inline" />
                    Previous
                  </button>
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                        className={`px-3 py-1 rounded-lg text-sm transition ${
                          pagination.page === pageNum
                            ? 'bg-blue-600 text-white'
                            : isDark
                              ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                        } border`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className={`px-3 py-1 rounded-lg text-sm transition disabled:opacity-50 ${
                      isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                    } border`}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 inline" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-xl shadow-xl ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className={`sticky top-0 z-10 p-4 border-b ${
              isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            } flex items-center justify-between`}>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Receipt #{selectedCheckout.receiptNumber}
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {formatDateTime(selectedCheckout.saleDate || selectedCheckout.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className={`p-2 rounded-lg transition ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Customer Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {selectedCheckout.customerName || 'Guest'}
                    </span>
                  </div>
                  {selectedCheckout.customerEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>
                        {selectedCheckout.customerEmail}
                      </span>
                    </div>
                  )}
                  {selectedCheckout.customerPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className={isDark ? 'text-white' : 'text-gray-900'}>
                        {selectedCheckout.customerPhone}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {selectedCheckout.paymentMethod?.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Items
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(selectedCheckout.items || []).map((item, index) => (
                    <div key={index} className={`flex items-center justify-between py-2 border-b ${
                      isDark ? 'border-gray-700' : 'border-gray-100'
                    }`}>
                      <div>
                        <p className={isDark ? 'text-white' : 'text-gray-900'}>
                          {item.productName || 'Product'}
                        </p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                          {item.variantName && <span className="ml-2 text-xs">({item.variantName})</span>}
                        </p>
                      </div>
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Subtotal</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {formatCurrency(selectedCheckout.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Tax</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {formatCurrency(selectedCheckout.tax)}
                    </span>
                  </div>
                  {selectedCheckout.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedCheckout.discount)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between text-lg font-bold pt-2 border-t ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  }`}>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>Total</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      {formatCurrency(selectedCheckout.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Paid</span>
                    <span>{formatCurrency(selectedCheckout.paidAmount || selectedCheckout.total)}</span>
                  </div>
                  {selectedCheckout.changeAmount > 0 && (
                    <div className="flex justify-between text-sm text-orange-500 dark:text-orange-400">
                      <span>Change</span>
                      <span>{formatCurrency(selectedCheckout.changeAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedCheckout.notes && (
                <div className={`p-4 rounded-lg border ${
                  isDark
                    ? 'bg-yellow-900/20 border-yellow-800'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <p className={isDark ? 'text-yellow-300' : 'text-yellow-700'}>
                    {selectedCheckout.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
