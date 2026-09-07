// src/components/customers/CustomerDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit, Trash2, Mail, Phone, MapPin,
  Award, TrendingUp, ShoppingBag, Calendar, Clock,
  Star, Users, DollarSign, Loader2, Gift
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { saleService } from '../../services/saleService';
import { toast } from '../../utils/toast-manager';

// Define types
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
    if (points >= 1000) return { label: 'Platinum', color: 'purple', icon: Star };
    if (points >= 500) return { label: 'Gold', color: 'yellow', icon: Award };
    if (points >= 200) return { label: 'Silver', color: 'gray', icon: Award };
    return { label: 'Bronze', color: 'orange', icon: Award };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Customer not found</p>
      </div>
    );
  }

  const tier = getLoyaltyTier(customer.loyaltyPoints || 0);
  const TierIcon = tier.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
              {customer.firstName[0]}{customer.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {customer.firstName} {customer.lastName}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500">
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Loyalty Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 mb-6 text-white">
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
            <p className="text-2xl font-bold">${customer.totalSpent?.toFixed(2) || '0.00'}</p>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500">Orders</p>
              <p className="text-xl font-bold">{stats?.totalOrders || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-500">Average Order</p>
              <p className="text-xl font-bold">${stats?.averageOrder?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500">Last Purchase</p>
              <p className="text-xl font-bold">
                {stats?.lastPurchase ? new Date(stats.lastPurchase).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="text-xl font-bold">
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6">
          <nav className="flex gap-4">
            {['overview', 'purchases', 'loyalty', 'notes'].map((tab) => (
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
              {/* Address */}
              {customer.address && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Address</h3>
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4" />
                    {customer.address}
                    {customer.city && `, ${customer.city}`}
                    {customer.state && `, ${customer.state}`}
                    {customer.zipCode && ` ${customer.zipCode}`}
                    {customer.country && `, ${customer.country}`}
                  </div>
                </div>
              )}

              {/* Notes */}
              {customer.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                  <p className="text-gray-700">{customer.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'purchases' && (
            <div>
              {sales.length > 0 ? (
                <div className="space-y-3">
                  {sales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div>
                        <p className="font-medium">#{sale.receiptNumber}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(sale.saleDate).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${sale.total.toFixed(2)}</p>
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
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Current Points</p>
                    <p className="text-2xl font-bold">{customer.loyaltyPoints || 0}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Points to Next Tier</p>
                    <p className="text-2xl font-bold">
                      {customer.loyaltyPoints < 200 ? 200 - (customer.loyaltyPoints || 0) :
                       customer.loyaltyPoints < 500 ? 500 - (customer.loyaltyPoints || 0) :
                       customer.loyaltyPoints < 1000 ? 1000 - (customer.loyaltyPoints || 0) :
                       0}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    💡 Earn 1 point for every $1 spent. Redeem 100 points for $1 off.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Add a note about this customer..."
                defaultValue={customer.notes || ''}
                onBlur={(e) => {
                  customerService.updateCustomer(customer.id, { notes: e.target.value });
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
