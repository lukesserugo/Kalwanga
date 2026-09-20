// src/components/customers/CustomerDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Award,
  TrendingUp,
  ShoppingBag,
  Calendar,
  Clock,
  Star,
  Users,
  DollarSign,
  Loader2,
  Gift,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { saleService } from '../../services/saleService';
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

interface Sale {
  id: string;
  receiptNumber: string;
  total: number;
  saleDate: string;
  items?: Array<{ id: string; quantity: number; total: number }>;
}

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  averageOrder: number;
  lastPurchase: string | null;
}

interface SalesResponse {
  data: Sale[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<CustomerStats | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customerData, salesData, statsData] = await Promise.all([
        customerService.getCustomerById(id!),
        saleService.getSalesByCustomer(id!),
        customerService.getCustomerStats(id!),
      ]);
      setCustomer(customerData);
      setSales((salesData as SalesResponse)?.data || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load customer data:', error);
      toast.error('Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await customerService.deleteCustomer(id!);
      toast.success('Customer deleted');
      navigate('/customers');
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const getLoyaltyTier = (points: number) => {
    if (points >= 1000)
      return { label: 'Platinum', color: 'secondary', icon: Star };
    if (points >= 500)
      return { label: 'Gold', color: 'warning', icon: Award };
    if (points >= 200)
      return { label: 'Silver', color: 'gray', icon: Award };
    return { label: 'Bronze', color: 'brand', icon: Award };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500 dark:text-gray-400">Customer not found</p>
      </div>
    );
  }

  const tier = getLoyaltyTier(customer.loyaltyPoints || 0);
  const TierIcon = tier.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            aria-label="Back to customers"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 text-2xl font-bold">
              {customer.firstName[0]}
              {customer.lastName[0]}
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
        <div className="flex gap-2">
          <Link
            to={`/customers/${customer.id}/edit`}
            className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all flex items-center gap-2 focus-ring"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Loyalty Card */}
      <div className="bg-brand-gradient rounded-2xl shadow-brand p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/85">Loyalty Status</p>
            <div className="flex items-center gap-3 mt-1">
              <TierIcon className="w-8 h-8" />
              <h2 className="text-2xl font-bold">{tier.label}</h2>
            </div>
            <p className="text-white/85 mt-1 tabular-nums">
              {customer.loyaltyPoints || 0} points
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/85">Total Spent</p>
            <p className="text-2xl font-bold tabular-nums">
              ${customer.totalSpent?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>
        <div className="mt-4 w-full bg-white/25 rounded-full h-2">
          <div
            className="bg-white h-2 rounded-full transition-all"
            style={{
              width: `${Math.min((customer.loyaltyPoints || 0) / 10, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Orders</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {stats?.totalOrders || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-success-600 dark:text-success-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Average Order
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                ${stats?.averageOrder?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last Purchase
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {stats?.lastPurchase
                  ? new Date(stats.lastPurchase).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Member Since
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card-brand !p-0 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <nav className="flex gap-4">
            {['overview', 'purchases', 'loyalty', 'notes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors capitalize focus-ring rounded-t ${
                  activeTab === tab
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Address
                  </h3>
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
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Notes
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {customer.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'purchases' && (
            <div>
              {sales.length > 0 ? (
                <div className="space-y-3">
                  {sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white font-mono tabular-nums">
                          #{sale.receiptNumber}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                          {new Date(sale.saleDate).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                          ${sale.total.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                          {sale.items?.length || 0} items
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No purchase history
                </p>
              )}
            </div>
          )}

          {activeTab === 'loyalty' && (
            <div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Current Points
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {customer.loyaltyPoints || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Points to Next Tier
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {customer.loyaltyPoints < 200
                        ? 200 - (customer.loyaltyPoints || 0)
                        : customer.loyaltyPoints < 500
                        ? 500 - (customer.loyaltyPoints || 0)
                        : customer.loyaltyPoints < 1000
                        ? 1000 - (customer.loyaltyPoints || 0)
                        : 0}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                  <p className="text-sm text-warning-700 dark:text-warning-300">
                    💡 Earn 1 point for every $1 spent. Redeem 100 points for
                    $1 off.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow"
                rows={4}
                placeholder="Add a note about this customer..."
                defaultValue={customer.notes || ''}
                onBlur={(e) => {
                  customerService.updateCustomer(customer.id, {
                    notes: e.target.value,
                  });
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerDetail;
