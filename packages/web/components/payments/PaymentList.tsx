// src/components/payments/PaymentList.tsx
import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Eye, RefreshCw, CreditCard,
  DollarSign, Banknote, Smartphone, Wallet,
  CheckCircle, XCircle, Clock, AlertCircle,
  Download, TrendingUp
} from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';
import { PaymentMethod, PaymentStatus } from '../../types/enums';

// Define Payment type
interface Payment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  reference?: string;
  notes?: string;
  processedAt: string;
  saleId?: string;
  sale?: {
    receiptNumber: string;
  };
  userId: string;
}

interface PaymentSummary {
  totalAmount: number;
  totalCount: number;
  byMethod: {
    CASH?: number;
    CREDIT_CARD?: number;
    DEBIT_CARD?: number;
    MOBILE_MONEY?: number;
    BANK_TRANSFER?: number;
    GIFT_CARD?: number;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export function PaymentList() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    method: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundData, setRefundData] = useState({ amount: 0, reason: '' });
  const [summary, setSummary] = useState<PaymentSummary | null>(null);

  useEffect(() => {
    loadPayments();
    loadSummary();
  }, [filters, pagination.page]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      // Build params with proper types
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
      };
      
      // Only add method if it has a value
      if (filters.method) {
        params.method = filters.method as PaymentMethod;
      }
      
      // Only add status if it has a value
      if (filters.status) {
        params.status = filters.status as PaymentStatus;
      }
      
      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        params.endDate = filters.endDate;
      }

      const result = await paymentService.getPayments(params);
      setPayments(result.data || []);
      setPagination({
        ...pagination,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      });
    } catch (error) {
      console.error('Failed to load payments:', error);
      toast.error('Failed to load payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await paymentService.getPaymentSummary({
        startDate: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: filters.endDate || new Date().toISOString().split('T')[0],
      });
      setSummary(data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;
    try {
      await paymentService.refundPayment(
        selectedPayment.id,
        refundData.amount || selectedPayment.amount,
        refundData.reason
      );
      toast.success('Payment refunded successfully');
      setShowRefundModal(false);
      loadPayments();
      loadSummary();
    } catch (error) {
      toast.error('Failed to refund payment');
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'CASH': return Banknote;
      case 'CREDIT_CARD': return CreditCard;
      case 'DEBIT_CARD': return Wallet;
      case 'MOBILE_MONEY': return Smartphone;
      default: return DollarSign;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'green';
      case 'PENDING': return 'yellow';
      case 'FAILED': return 'red';
      case 'REFUNDED': return 'purple';
      case 'PARTIAL': return 'orange';
      default: return 'gray';
    }
  };

  const columns = [
    {
      key: 'payment',
      header: 'Payment',
      render: (payment: Payment) => (
        <div>
          <p className="font-medium text-gray-900">#{payment.id.slice(0, 8)}</p>
          <p className="text-sm text-gray-500">
            {new Date(payment.processedAt).toLocaleString()}
          </p>
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (payment: Payment) => {
        const Icon = getMethodIcon(payment.paymentMethod);
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-gray-600" />
            <span>{payment.paymentMethod}</span>
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payment: Payment) => (
        <span className="font-bold text-gray-900">
          ${payment.amount.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'sale',
      header: 'Sale',
      render: (payment: Payment) => (
        <span className="text-sm">
          {payment.sale?.receiptNumber || 'N/A'}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (payment: Payment) => (
        <span className="text-sm text-gray-500">
          {payment.reference || payment.transactionId || 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment: Payment) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(payment.status)}-100 text-${getStatusColor(payment.status)}-700`}>
          {payment.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (payment: Payment) => (
        <div className="flex items-center gap-2">
          {payment.status === 'PAID' && (
            <button
              onClick={() => {
                setSelectedPayment(payment);
                setRefundData({ amount: payment.amount, reason: '' });
                setShowRefundModal(true);
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
              title="Refund"
            >
              <XCircle className="w-4 h-4 text-red-600" />
            </button>
          )}
          <button
            className="p-1 hover:bg-blue-100 rounded transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600 mt-1">Manage all payment transactions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Total Payments</p>
            <p className="text-2xl font-bold text-gray-900">
              ${summary.totalAmount?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900">
              {summary.totalCount || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Cash</p>
            <p className="text-2xl font-bold text-green-600">
              ${summary.byMethod?.CASH?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Card</p>
            <p className="text-2xl font-bold text-blue-600">
              ${(summary.byMethod?.CREDIT_CARD || 0) + (summary.byMethod?.DEBIT_CARD || 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Mobile Money</p>
            <p className="text-2xl font-bold text-purple-600">
              ${summary.byMethod?.MOBILE_MONEY?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by reference..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filters.method}
            onChange={(e) => setFilters({ ...filters, method: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Methods</option>
            <option value="CASH">Cash</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="DEBIT_CARD">Debit Card</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="GIFT_CARD">Gift Card</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="PARTIAL">Partial</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={payments}
          loading={loading}
        />
        <div className="border-t border-gray-200 p-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      </div>

      {/* Refund Modal */}
      <Modal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title="Refund Payment"
      >
        <div className="p-6">
          {selectedPayment && (
            <div className="mb-4 space-y-2">
              <p className="font-medium">Payment: #{selectedPayment.id.slice(0, 8)}</p>
              <p className="text-sm text-gray-600">
                Amount: ${selectedPayment.amount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">
                Method: {selectedPayment.paymentMethod}
              </p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refund Amount
              </label>
              <input
                type="number"
                value={refundData.amount}
                onChange={(e) => setRefundData({ ...refundData, amount: parseFloat(e.target.value) || 0 })}
                step="0.01"
                min="0"
                max={selectedPayment?.amount}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason
              </label>
              <textarea
                value={refundData.reason}
                onChange={(e) => setRefundData({ ...refundData, reason: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Reason for refund..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowRefundModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRefund}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Process Refund
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
