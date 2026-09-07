// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\suppliers\[id]\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Edit, Trash2, Truck, Mail, Phone, MapPin,
  User, Star, StarHalf, Package, Building, Loader2, Lock,
  Calendar, ShoppingBag, AlertCircle, X, Globe, DollarSign,
  Clock, CheckCircle, XCircle, CreditCard, TrendingUp,
  Users, FileText, ExternalLink, Copy, Printer, Database,
  ChevronDown, ChevronUp, Info, HelpCircle
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { supplierService } from '../../../../../services/supplierService';
import { companyService } from '../../../../../services/companyService';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate, formatCurrency } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import { api } from '../../../../../services/api';

// ============================================
// TYPES
// ============================================

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}

interface SupplierDetail {
  id: string;
  name: string;
  contactPerson?: string | null;
  email: string;
  phone: string;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  rating?: number | null;
  isActive: boolean;
  businessUnitId: string;
  businessUnitName?: string;
  companyId?: string;
  companyName?: string;
  productCount?: number;
  totalSpent?: number;
  totalPurchases?: number;
  lastOrderDate?: string | null;
  createdAt: string;
  updatedAt: string;
  website?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  creditLimit?: number | null;
  completedOrders?: number;
  pendingOrders?: number;
  averageOrderValue?: number;
  products?: Array<{
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
  }>;
  purchaseOrders?: Array<{
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const InfoCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ label, value, icon }) => (
  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400 py-1.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
    {icon && <span className="flex-shrink-0 mt-0.5">{icon}</span>}
    <span className="text-sm flex-1">{label}:</span>
    <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value || '-'}</span>
  </div>
);

const StatBadge: React.FC<{
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
}> = ({ label, value, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    gray: 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClasses[color]}`}>
      {icon}
      <span className="text-xs font-medium">{label}:</span>
      <span className="text-xs font-bold">{value}</span>
    </div>
  );
};

const ProductsTable: React.FC<{ products: any[] }> = ({ products }) => {
  if (!products || products.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No products from this supplier</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">SKU</th>
            <th className="px-3 py-2 font-medium text-right">Price</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {products.slice(0, 10).map((product) => (
            <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <td className="px-3 py-2 text-gray-900 dark:text-white">{product.name}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono">{product.sku || 'N/A'}</td>
              <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                {formatCurrency(product.unitPrice || 0)}
              </td>
            </tr>
          ))}
        </tbody>
        {products.length > 10 && (
          <tfoot>
            <tr>
              <td colSpan={3} className="px-3 py-2 text-center text-gray-400 text-xs">
                Showing 10 of {products.length} products
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

const OrdersTable: React.FC<{ orders: any[] }> = ({ orders }) => {
  if (!orders || orders.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No purchase orders from this supplier</p>;
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'COMPLETED': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      'PENDING': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      'CANCELLED': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      'APPROVED': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      'DRAFT': 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
      'RECEIVED': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      'PARTIALLY_RECEIVED': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="px-3 py-2 font-medium">Order #</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium text-right">Total</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {orders.slice(0, 10).map((order) => (
            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{order.orderNumber}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</td>
              <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                {formatCurrency(order.total || 0)}
              </td>
              <td className="px-3 py-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {order.status || 'DRAFT'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        {orders.length > 10 && (
          <tfoot>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-center text-gray-400 text-xs">
                Showing 10 of {orders.length} orders
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();
  const { canEdit, canDelete, canManage, isLoading: permissionLoading } = usePermission();
  
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    contact: true,
    business: true,
    products: true,
    orders: true,
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const companyId = useMemo(() => user?.companyId || 'default', [user]);
  
  const canEditSupplier = useMemo(() => 
    canEdit(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER),
    [canEdit, canManage]
  );
  const canDeleteSupplier = useMemo(() => 
    canDelete(PermissionResource.SUPPLIER) || canManage(PermissionResource.SUPPLIER),
    [canDelete, canManage]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && id) {
      loadSupplier();
      fetchCompanies();
    }
  }, [id, isClient]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const response: any = await api.get('/companies');
      let companiesData: Company[] = [];
      
      if (response) {
        if (Array.isArray(response)) {
          companiesData = response;
        } else if (response.data) {
          const data = response.data;
          if (Array.isArray(data)) {
            companiesData = data;
          } else if (data.data && Array.isArray(data.data)) {
            companiesData = data.data;
          } else if (data.companies && Array.isArray(data.companies)) {
            companiesData = data.companies;
          }
        } else if (response.companies && Array.isArray(response.companies)) {
          companiesData = response.companies;
        }
      }
      
      const activeCompanies = companiesData.filter((c: Company) => c.isActive !== false);
      setCompanies(activeCompanies);
      
      // Store company ID if not already stored
      if (activeCompanies.length > 0 && !localStorage.getItem('companyId')) {
        const firstCompany = activeCompanies[0];
        companyService.setCompanyId(firstCompany.id);
        localStorage.setItem('companyId', firstCompany.id);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadSupplier = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supplierService.getSupplierById(id, companyId);
      
      // Get the company name from the fetched companies
      const company = companies.find((c: Company) => c.id === data.companyId);
      if (company) {
        data.companyName = company.name;
      }
      
      setSupplier(data);
    } catch (error: any) {
      console.error('Failed to load supplier:', error);
      if (error?.response?.status === 404) {
        setError('Supplier not found');
      } else {
        setError('Failed to load supplier. Please try again.');
      }
      toast.error('Failed to load supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!supplier) return;
    setDeleting(true);
    try {
      await supplierService.deleteSupplier(supplier.id, companyId);
      toast.success('Supplier deleted successfully');
      router.push('/admin/catalog/suppliers');
    } catch (error: any) {
      console.error('Failed to delete supplier:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete supplier';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const renderStars = (rating: number = 0) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        ))}
        {hasHalfStar && <StarHalf className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="w-4 h-4 text-gray-300 dark:text-gray-600" />
        ))}
        {rating > 0 && (
          <span className="text-sm text-gray-500 ml-1">{rating.toFixed(1)}</span>
        )}
      </div>
    );
  };

  // Loading state
  if (permissionLoading || !isClient || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading supplier...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !supplier) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-6xl mb-4">🚚</div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {error || 'Supplier not found'}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          The supplier you're looking for doesn't exist or has been removed.
        </p>
        <Link
          href="/admin/catalog/suppliers"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Suppliers
        </Link>
      </div>
    );
  }

  // Calculate stats
  const totalPurchases = supplier.totalPurchases || supplier.totalSpent || 0;
  const completedOrders = supplier.completedOrders || 0;
  const pendingOrders = supplier.pendingOrders || 0;
  const averageOrderValue = supplier.averageOrderValue || 0;
  const productCount = supplier.productCount || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/catalog/suppliers"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
                  {supplier.name}
                </h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  supplier.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700/50 dark:text-gray-400'
                }`}>
                  {supplier.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {renderStars(supplier.rating || 0)}
                {supplier.businessUnitName && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Building className="w-4 h-4" />
                    {supplier.businessUnitName}
                  </span>
                )}
                {supplier.contactPerson && (
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {supplier.contactPerson}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => window.print()}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            {canEditSupplier && (
              <Link
                href={`/admin/suppliers/${id}/edit`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
            )}
            {canDeleteSupplier && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBadge
            label="Products"
            value={productCount}
            icon={<Package className="w-3 h-3" />}
            color="blue"
          />
          <StatBadge
            label="Total Spent"
            value={formatCurrency(totalPurchases)}
            icon={<DollarSign className="w-3 h-3" />}
            color="green"
          />
          <StatBadge
            label="Completed Orders"
            value={completedOrders}
            icon={<CheckCircle className="w-3 h-3" />}
            color="purple"
          />
          <StatBadge
            label="Pending Orders"
            value={pendingOrders}
            icon={<Clock className="w-3 h-3" />}
            color="yellow"
          />
        </div>

        {/* Company Information Card */}
        <InfoCard
          title="Company Information"
          icon={<Database className="w-5 h-5 text-indigo-500" />}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
              <span className="text-sm text-gray-500 dark:text-gray-400">Company ID:</span>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-gray-900 dark:text-white">
                  {supplier.companyId || 'N/A'}
                </code>
                {supplier.companyId && (
                  <button
                    onClick={() => copyToClipboard(supplier.companyId!)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy Company ID"
                  >
                    <Copy className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
            {supplier.companyName && (
              <InfoRow
                label="Company Name"
                value={supplier.companyName}
                icon={<Building className="w-4 h-4 text-gray-400" />}
              />
            )}
            <InfoRow
              label="Business Unit"
              value={supplier.businessUnitName || supplier.businessUnitId || 'N/A'}
              icon={<Building className="w-4 h-4 text-gray-400" />}
            />
          </div>
        </InfoCard>

        {/* Contact Information */}
        <InfoCard
          title="Contact Information"
          icon={<Mail className="w-5 h-5 text-blue-500" />}
        >
          <div className="space-y-1">
            {supplier.contactPerson && (
              <InfoRow
                label="Contact Person"
                value={supplier.contactPerson}
                icon={<User className="w-4 h-4 text-gray-400" />}
              />
            )}
            <InfoRow
              label="Email"
              value={
                <a href={`mailto:${supplier.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                  {supplier.email}
                </a>
              }
              icon={<Mail className="w-4 h-4 text-gray-400" />}
            />
            <InfoRow
              label="Phone"
              value={
                <a href={`tel:${supplier.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                  {supplier.phone}
                </a>
              }
              icon={<Phone className="w-4 h-4 text-gray-400" />}
            />
            {supplier.address && (
              <InfoRow
                label="Address"
                value={supplier.address}
                icon={<MapPin className="w-4 h-4 text-gray-400" />}
              />
            )}
            {supplier.website && (
              <InfoRow
                label="Website"
                value={
                  <a
                    href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {supplier.website}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                }
                icon={<Globe className="w-4 h-4 text-gray-400" />}
              />
            )}
          </div>
        </InfoCard>

        {/* Business Information */}
        <InfoCard
          title="Business Information"
          icon={<Building className="w-5 h-5 text-purple-500" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              {supplier.taxId && (
                <InfoRow label="Tax ID" value={supplier.taxId} />
              )}
              {supplier.paymentTerms && (
                <InfoRow label="Payment Terms" value={supplier.paymentTerms} />
              )}
              {supplier.deliveryTerms && (
                <InfoRow label="Delivery Terms" value={supplier.deliveryTerms} />
              )}
            </div>
            <div className="space-y-1">
              {supplier.creditLimit !== undefined && supplier.creditLimit !== null && supplier.creditLimit > 0 && (
                <InfoRow label="Credit Limit" value={formatCurrency(supplier.creditLimit)} />
              )}
              {averageOrderValue > 0 && (
                <InfoRow label="Avg. Order Value" value={formatCurrency(averageOrderValue)} />
              )}
              <InfoRow label="Created" value={formatDate(supplier.createdAt)} />
              <InfoRow label="Updated" value={formatDate(supplier.updatedAt)} />
            </div>
          </div>
        </InfoCard>

        {/* Notes */}
        {supplier.notes && (
          <InfoCard
            title="Notes"
            icon={<FileText className="w-5 h-5 text-yellow-500" />}
          >
            <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{supplier.notes}</p>
          </InfoCard>
        )}

        {/* Products Section */}
        <InfoCard
          title={`Products (${productCount})`}
          icon={<Package className="w-5 h-5 text-blue-500" />}
        >
          <div className="mt-2">
            <ProductsTable products={supplier.products || []} />
            {productCount > 10 && (
              <Link
                href={`/admin/suppliers/${id}/products`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View all products
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </InfoCard>

        {/* Orders Section */}
        <InfoCard
          title={`Purchase Orders (${(supplier.purchaseOrders || []).length})`}
          icon={<ShoppingBag className="w-5 h-5 text-green-500" />}
        >
          <div className="mt-2">
            <OrdersTable orders={supplier.purchaseOrders || []} />
            {(supplier.purchaseOrders || []).length > 10 && (
              <Link
                href={`/admin/suppliers/${id}/orders`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View all orders
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </InfoCard>

        {/* Delete Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
              >
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Supplier</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{supplier.name}</strong>?
                  {productCount > 0 && (
                    <span className="block mt-2 text-red-600">
                      ⚠️ This supplier has {productCount} associated product{productCount !== 1 ? 's' : ''}.
                    </span>
                  )}
                  {totalPurchases > 0 && (
                    <span className="block mt-1 text-yellow-600">
                      💰 Total purchases: {formatCurrency(totalPurchases)}
                    </span>
                  )}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {deleting ? 'Deleting...' : 'Delete Supplier'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
