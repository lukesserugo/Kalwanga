// src/components/sales/SaleList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Filter, Download, Eye, RefreshCw, Printer,
  DollarSign, Calendar, Users, TrendingUp, TrendingDown,
  ChevronDown, FileText, CreditCard, Clock, CheckCircle,
  XCircle, AlertCircle
} from 'lucide-react';
import { saleService } from '../../services/saleService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';

// Import the Sale type from the types folder
import type { Sale } from '../../types/sale';

interface SalesStats {
  totalRevenue: number;
  totalSales: number;
  averageTicket: number;
  todayRevenue: number;
  todaySales: number;
}

export function SaleList() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    startDate: '',
    endDate: '',
    customerId: '',
    userId: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [stats, setStats] = useState<SalesStats>({
    totalRevenue: 0,
    totalSales: 0,
    averageTicket: 0,
    todayRevenue: 0,
    todaySales: 0,
  });
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    loadSales();
    loadStats();
  }, [filters, pagination.page]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const result = await saleService.getAllSales({
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      });
      setSales(result.data || []);
      setPagination({
        ...pagination,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      });
    } catch (error) {
      console.error('Failed to load sales:', error);
      toast.error('Failed to load sales');
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await saleService.getSalesStats();
      setStats({
        totalRevenue: data.totalRevenue || 0,
        totalSales: data.totalSales || 0,
        averageTicket: data.averageTicket || 0,
        todayRevenue: data.todayRevenue || 0,
        todaySales: data.todaySales || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleRefund = async () => {
    if (!selectedSale) return;
    try {
      await saleService.refundSale(selectedSale.id, refundReason);
      toast.success('Sale refunded successfully');
      setShowRefundModal(false);
      loadSales();
      loadStats();
    } catch (error) {
      toast.error('Failed to refund sale');
    }
  };

  const handleExport = async () => {
    try {
      await saleService.exportSales({
        startDate: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: filters.endDate || new Date().toISOString().split('T')[0],
        format: 'csv',
      });
      toast.success('Sales exported successfully');
    } catch (error) {
      toast.error('Failed to export sales');
    }
  };

  const handlePrintReceipt = (sale: Sale) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Receipt #${sale.receiptNumber}</title></head>
          <body>
            <h2>Receipt #${sale.receiptNumber}</h2>
            <p>Date: ${new Date(sale.saleDate).toLocaleString()}</p>
            <table>
              ${sale.items?.map((item: any) => `
                <tr>
                  <td>${item.product?.name || 'Product'} x${item.quantity}</td>
                  <td>$${item.total.toFixed(2)}</td>
                </tr>
              `).join('') || ''}
            </table>
            <h3>Total: $${sale.total.toFixed(2)}</h3>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'green';
      case 'PENDING': return 'yellow';
      case 'REFUNDED': return 'red';
      case 'CANCELLED': return 'gray';
      default: return 'blue';
    }
  };

  const columns = [
    {
      key: 'receipt',
      header: 'Receipt',
      render: (sale: Sale) => (
        <div>
          <p className="font-medium text-gray-900">#{sale.receiptNumber}</p>
          <p className="text-sm text-gray-500">
            {new Date(sale.saleDate).toLocaleString()}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (sale: Sale) => (
        <div>
          <p className="font-medium">
            {sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Guest'}
          </p>
          {sale.customer && (
            <p className="text-sm text-gray-500">{sale.customer.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (sale: Sale) => (
        <span>{sale.items?.length || 0} items</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (sale: Sale) => (
        <div>
          <p className="font-bold text-gray-900">${sale.total.toFixed(2)}</p>
          {sale.discount > 0 && (
            <p className="text-sm text-green-600">-${sale.discount.toFixed(2)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (sale: Sale) => (
        <div>
          <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
            {sale.payments?.[0]?.paymentMethod || 'N/A'}
          </span>
          <p className="text-sm text-gray-500 mt-1">
            Paid: ${sale.paidAmount?.toFixed(2) || '0.00'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (sale: Sale) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(sale.status)}-100 text-${getStatusColor(sale.status)}-700`}>
          {sale.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (sale: Sale) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/sales/${sale.id}`}
            className="p-1 hover:bg-blue-100 rounded transition-colors"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </Link>
          <button
            onClick={() => handlePrintReceipt(sale)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <Printer className="w-4 h-4 text-gray-600" />
          </button>
          {sale.status === 'COMPLETED' && (
            <button
              onClick={() => {
                setSelectedSale(sale);
                setShowRefundModal(true);
              }}
              className="p-1 hover:bg-red-100 rounded transition-colors"
            >
              <XCircle className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-gray-600 mt-1">View and manage all sales transactions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Stats
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={loadSales}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">
              ${stats.totalRevenue?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSales || 0}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Average Ticket</p>
            <p className="text-2xl font-bold text-gray-900">
              ${stats.averageTicket?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Today's Revenue</p>
            <p className="text-2xl font-bold text-blue-600">
              ${stats.todayRevenue?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-gray-500">Today's Sales</p>
            <p className="text-2xl font-bold text-blue-600">{stats.todaySales || 0}</p>
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
                placeholder="Search by receipt number..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
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
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={sales}
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
        title="Refund Sale"
      >
        <div className="p-6">
          {selectedSale && (
            <div className="mb-4 space-y-2">
              <p className="font-medium">Receipt: #{selectedSale.receiptNumber}</p>
              <p className="text-sm text-gray-600">
                Amount: ${selectedSale.total.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">
                Date: {new Date(selectedSale.saleDate).toLocaleString()}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refund Reason
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Reason for refund..."
            />
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
