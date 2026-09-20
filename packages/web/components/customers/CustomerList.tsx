// src/components/customers/CustomerList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Users,
  Star,
  Mail,
  Phone,
  MapPin,
  Filter,
  Download,
  Upload,
  Award,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
  isActive: boolean;
  loyaltyPoints: number;
  totalSpent: number;
  lastPurchaseAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    isActive: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(
    null,
  );
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyData, setLoyaltyData] = useState({
    points: 0,
    action: 'add',
  });

  useEffect(() => {
    loadCustomers();
  }, [filters, pagination.page]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
      };

      if (filters.isActive !== '') {
        params.isActive = filters.isActive === 'true';
      }

      const result = await customerService.getAllCustomers(params);
      setCustomers(result.data || []);
      setPagination({
        ...pagination,
        total: result.total || 0,
        totalPages: result.totalPages || 1,
      });
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Failed to load customers');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await customerService.deleteCustomer(id);
      toast.success('Customer deleted');
      loadCustomers();
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const handleLoyaltyUpdate = async () => {
    if (!selectedCustomer) return;
    try {
      if (loyaltyData.action === 'add') {
        await customerService.addLoyaltyPoints(
          selectedCustomer,
          loyaltyData.points,
        );
        toast.success(`${loyaltyData.points} points added`);
      } else {
        await customerService.redeemLoyaltyPoints(
          selectedCustomer,
          loyaltyData.points,
        );
        toast.success(`${loyaltyData.points} points redeemed`);
      }
      setShowLoyaltyModal(false);
      loadCustomers();
    } catch (error) {
      toast.error('Failed to update loyalty points');
    }
  };

  const getLoyaltyTier = (points: number) => {
    if (points >= 1000)
      return { label: 'Platinum', color: 'secondary' };
    if (points >= 500) return { label: 'Gold', color: 'warning' };
    if (points >= 200) return { label: 'Silver', color: 'gray' };
    return { label: 'Bronze', color: 'brand' };
  };

  const columns = [
    {
      key: 'customer',
      header: 'Customer',
      render: (customer: Customer) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-semibold">
            {customer.firstName[0]}
            {customer.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {customer.firstName} {customer.lastName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {customer.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (customer: Customer) => (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 tabular-nums">
          <Phone className="w-4 h-4" />
          {customer.phoneNumber}
        </div>
      ),
    },
    {
      key: 'loyalty',
      header: 'Loyalty',
      render: (customer: Customer) => {
        const tier = getLoyaltyTier(customer.loyaltyPoints || 0);
        return (
          <div>
            <p className="font-medium text-gray-900 dark:text-white tabular-nums">
              {customer.loyaltyPoints || 0} pts
            </p>
            <span
              className={`px-2 py-0.5 rounded-full text-2xs font-medium bg-${tier.color}-100 text-${tier.color}-700`}
            >
              {tier.label}
            </span>
          </div>
        );
      },
    },
    {
      key: 'spent',
      header: 'Total Spent',
      render: (customer: Customer) => (
        <span className="font-medium text-gray-900 dark:text-white tabular-nums">
          ${customer.totalSpent?.toFixed(2) || '0.00'}
        </span>
      ),
    },
    {
      key: 'lastPurchase',
      header: 'Last Purchase',
      render: (customer: Customer) => (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 tabular-nums">
          <Calendar className="w-4 h-4" />
          {customer.lastPurchaseAt
            ? new Date(customer.lastPurchaseAt).toLocaleDateString()
            : 'Never'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (customer: Customer) => (
        <span
          className={`px-2 py-1 rounded-full text-2xs font-medium ${
            customer.isActive
              ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
              : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
          }`}
        >
          {customer.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (customer: Customer) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedCustomer(customer.id);
              setShowLoyaltyModal(true);
            }}
            className="p-1 hover:bg-warning-100 dark:hover:bg-warning-900/20 rounded transition-colors focus-ring"
            title="Manage Loyalty"
          >
            <Award className="w-4 h-4 text-warning-600 dark:text-warning-400" />
          </button>
          <Link
            to={`/customers/${customer.id}`}
            className="p-1 hover:bg-brand-100 dark:hover:bg-brand-900/20 rounded transition-colors focus-ring"
          >
            <Eye className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </Link>
          <Link
            to={`/customers/${customer.id}/edit`}
            className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
          >
            <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </Link>
          <button
            onClick={() => {
              setSelectedCustomer(customer.id);
              setShowDeleteModal(true);
            }}
            className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/20 rounded transition-colors focus-ring"
          >
            <Trash2 className="w-4 h-4 text-danger-600 dark:text-danger-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Customers
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your customer relationships
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors focus-ring">
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors focus-ring">
            <Download className="w-4 h-4" />
            Export
          </button>
          <Link
            to="/customers/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card-brand !p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow"
              />
            </div>
          </div>
          <select
            value={filters.isActive}
            onChange={(e) =>
              setFilters({ ...filters, isActive: e.target.value })
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card-brand !p-0 overflow-hidden">
        <Table columns={columns} data={customers} loading={loading} />
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Customer"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this customer? This action cannot
            be undone.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="btn-secondary focus-ring"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedCustomer) {
                  handleDelete(selectedCustomer);
                }
                setShowDeleteModal(false);
              }}
              className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors focus-ring"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Loyalty Modal */}
      <Modal
        isOpen={showLoyaltyModal}
        onClose={() => setShowLoyaltyModal(false)}
        title="Manage Loyalty Points"
      >
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Action
              </label>
              <select
                value={loyaltyData.action}
                onChange={(e) =>
                  setLoyaltyData({ ...loyaltyData, action: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow"
              >
                <option value="add">Add Points</option>
                <option value="redeem">Redeem Points</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Points
              </label>
              <input
                type="number"
                value={loyaltyData.points}
                onChange={(e) =>
                  setLoyaltyData({
                    ...loyaltyData,
                    points: parseInt(e.target.value) || 0,
                  })
                }
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white tabular-nums focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowLoyaltyModal(false)}
              className="btn-secondary focus-ring"
            >
              Cancel
            </button>
            <button
              onClick={handleLoyaltyUpdate}
              className="px-4 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all focus-ring"
            >
              Update Points
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CustomerList;
