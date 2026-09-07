'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Edit, Trash2, Mail, Phone, MapPin,
  Award, TrendingUp, ShoppingBag, Calendar, Clock,
  Star, Users, DollarSign, Loader2, Gift, User,
  RefreshCw, Package, CreditCard
} from 'lucide-react';
// FIXED: Corrected import paths (5 levels up from [id] folder)
import { customerService } from '../../../../../services/customerService';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

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

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  averageOrder: number;
  lastPurchase: string | null;
}

interface Sale {
  id: string;
  receiptNumber: string;
  total: number;
  saleDate: string;
  items?: Array<{ id: string; quantity: number; total: number; productName?: string }>;
}

interface LoyaltyHistoryEntry {
  id: string;
  points: number;
  type: string;
  notes?: string;
  createdAt: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { canView, canEdit, canDelete, canManage } = usePermission();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyHistoryEntry[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchases' | 'loyalty'>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(10);
  const [loyaltyAction, setLoyaltyAction] = useState<'add' | 'redeem'>('add');

  const canViewCustomer = canView(PermissionResource.CUSTOMER) || canManage(PermissionResource.CUSTOMER);
  const canEditCustomer = canEdit(PermissionResource.CUSTOMER) || canManage(PermissionResource.CUSTOMER);
  const canDeleteCustomer = canDelete(PermissionResource.CUSTOMER) || canManage(PermissionResource.CUSTOMER);

  const loadData = useCallback(async (showLoading = true) => {
    if (!canViewCustomer) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      
      const [customerData, statsData, salesData] = await Promise.all([
        customerService.getCustomerById(id),
        customerService.getCustomerStats(id),
        customerService.getAllCustomers({ page: 1, limit: 10 }), // For loyalty history (mock)
      ]);
      
      setCustomer(customerData);
      setStats(statsData);
      
      // Extract sales from customer data if available
      const customerSales = (customerData as any).sales || [];
      setSales(customerSales);
      
      // Extract loyalty history from customer data if available
      const loyalty = (customerData as any).loyaltyHistory || [];
      setLoyaltyHistory(loyalty);
      
    } catch (error) {
      console.error('Failed to load customer:', error);
      toast.error('Failed to load customer');
      setCustomer(null);
      setSales([]);
      setLoyaltyHistory([]);
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, canViewCustomer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
    toast.success('Customer refreshed');
  };

  const handleDelete = async () => {
    if (!customer) return;
    setDeleting(true);
    try {
      await customerService.deleteCustomer(customer.id);
      toast.success('Customer deleted successfully');
      setShowDeleteModal(false);
      router.push('/admin/customers');
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const handleLoyaltyUpdate = async () => {
    if (!customer) return;
    try {
      if (loyaltyAction === 'add') {
        await customerService.addLoyaltyPoints(customer.id, loyaltyPoints);
        toast.success(`${loyaltyPoints} loyalty points added`);
      } else {
        await customerService.redeemLoyaltyPoints(customer.id, loyaltyPoints);
        toast.success(`${loyaltyPoints} loyalty points redeemed`);
      }
      setShowLoyaltyModal(false);
      loadData(false);
    } catch (error) {
      console.error('Failed to update loyalty points:', error);
      toast.error('Failed to update loyalty points');
    }
  };

  const getLoyaltyTier = (points: number) => {
    if (points >= 1000) return { label: 'Platinum', color: 'bg-purple-100 text-purple-700', icon: Star };
    if (points >= 500) return { label: 'Gold', color: 'bg-yellow-100 text-yellow-700', icon: Award };
    if (points >= 200) return { label: 'Silver', color: 'bg-gray-100 text-gray-700', icon: Award };
    return { label: 'Bronze', color: 'bg-orange-100 text-orange-700', icon: Award };
  };

  if (!canViewCustomer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Users className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to view this customer.</p>
        <Link href="/admin/customers" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg">
          Back to Customers
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">👤</div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Customer not found</h2>
        <Link href="/admin/customers" className="mt-4 inline-block text-blue-600">
          Back to Customers
        </Link>
      </div>
    );
  }

  const tier = getLoyaltyTier(customer.loyaltyPoints || 0);
  const TierIcon = tier.icon;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold">
              {customer.firstName?.[0]}{customer.lastName?.[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {customer.firstName} {customer.lastName}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {customer.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {customer.phoneNumber}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {canEditCustomer && (
            <Link
              href={`/admin/customers/${customer.id}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Link>
          )}
          {canDeleteCustomer && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Loyalty Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100">Loyalty Status</p>
            <div className="flex items-center gap-3 mt-1">
              <TierIcon className="w-8 h-8" />
              <h2 className="text-2xl font-bold">{tier.label}</h2>
            </div>
            <p className="text-blue-100 mt-1">{customer.loyaltyPoints || 0} points</p>
          </div>
          <div className="text-right">
            <p className="text-blue-100">Total Spent</p>
            <p className="text-2xl font-bold">{formatCurrency(customer.totalSpent)}</p>
          </div>
        </div>
        <div className="mt-4 w-full bg-blue-500/30 rounded-full h-2">
          <div
            className="bg-white h-2 rounded-full transition-all"
            style={{ width: `${Math.min((customer.loyaltyPoints || 0) / 10, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Orders</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats?.totalOrders || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Average Order</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats?.averageOrder || 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last Purchase</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {stats?.lastPurchase ? formatDate(stats.lastPurchase) : 'Never'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Member Since</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatDate(customer.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <nav className="flex gap-4">
            {(['overview', 'purchases', 'loyalty'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {customer.address && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Address</h3>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <MapPin className="w-4 h-4" />
                    {customer.address}
                    {customer.city && `, ${customer.city}`}
                    {customer.state && `, ${customer.state}`}
                    {customer.zipCode && ` ${customer.zipCode}`}
                    {customer.country && `, ${customer.country}`}
                  </div>
                </div>
              )}
              {customer.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Notes</h3>
                  <p className="text-gray-700 dark:text-gray-300">{customer.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'purchases' && (
            <div>
              {sales.length > 0 ? (
                <div className="space-y-3">
                  {sales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <div>
                        <p className="font-medium">#{sale.receiptNumber}</p>
                        <p className="text-sm text-gray-500">{formatDate(sale.saleDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(sale.total)}</p>
                        <p className="text-sm text-gray-500">{sale.items?.length || 0} items</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No purchase history</p>
              )}
            </div>
          )}

          {activeTab === 'loyalty' && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowLoyaltyModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  Manage Points
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500">Current Points</p>
                    <p className="text-2xl font-bold">{customer.loyaltyPoints || 0}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500">Points to Next Tier</p>
                    <p className="text-2xl font-bold">
                      {customer.loyaltyPoints < 200 ? 200 - (customer.loyaltyPoints || 0) :
                       customer.loyaltyPoints < 500 ? 500 - (customer.loyaltyPoints || 0) :
                       customer.loyaltyPoints < 1000 ? 1000 - (customer.loyaltyPoints || 0) : 0}
                    </p>
                  </div>
                </div>
                {loyaltyHistory.length > 0 && (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {loyaltyHistory.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className={`font-medium ${entry.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {entry.points > 0 ? '+' : ''}{entry.points} points
                          </p>
                          <p className="text-sm text-gray-500">{entry.notes || entry.type}</p>
                        </div>
                        <p className="text-sm text-gray-400">{formatDate(entry.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
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
                <h3 className="text-lg font-bold mb-2">Delete Customer</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong>{customer.firstName} {customer.lastName}</strong>?
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

      {/* Loyalty Modal */}
      <AnimatePresence>
        {showLoyaltyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowLoyaltyModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-lg font-bold mb-4">Manage Loyalty Points</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Action</label>
                  <select
                    value={loyaltyAction}
                    onChange={(e) => setLoyaltyAction(e.target.value as 'add' | 'redeem')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="add">Add Points</option>
                    <option value="redeem">Redeem Points</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Points</label>
                  <input
                    type="number"
                    value={loyaltyPoints}
                    onChange={(e) => setLoyaltyPoints(parseInt(e.target.value) || 0)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowLoyaltyModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLoyaltyUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
