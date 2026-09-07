// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\companies\components\CompanyDetail.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Users,
  Briefcase,
  DollarSign,
  Clock,
  Calendar,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Settings,
  TrendingUp,
  Package,
  ShoppingBag,
  UserPlus,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { companyService } from '../../../../../services/companyService';
import { toast } from '../../../../../utils/toast-manager';
import { formatDistanceToNow } from 'date-fns';

interface CompanyDetailProps {
  id: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  type: string;
  isActive: boolean;
  address?: string;
  phone?: string;
  email?: string;
  _count?: {
    products: number;
    users: number;
    sales: number;
  };
}

interface CompanyStats {
  totalUsers: number;
  totalBusinessUnits: number;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalCustomers: number;
  totalSuppliers: number;
}

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  taxId?: string | null;
  currency: string;
  timezone: string;
  logo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats?: CompanyStats;
  businessUnits?: BusinessUnit[];
  users?: any[];
  _count?: {
    businessUnits: number;
    users: number;
    customers: number;
    suppliers: number;
    invoices: number;
    giftCards: number;
    promotions: number;
  };
}

export function CompanyDetail({ id }: CompanyDetailProps) {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadCompany();
    }
  }, [id]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await companyService.getById(id);
      setCompany(data);
      
      // Store company ID for future use
      if (data?.id) {
        companyService.setCompanyId(data.id);
        localStorage.setItem('companyId', data.id);
      }
    } catch (error) {
      console.error('Failed to load company:', error);
      toast.error('Failed to load company details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!company) return;

    const hasAssociations = (company._count?.businessUnits || 0) > 0 ||
      (company._count?.users || 0) > 0 ||
      (company._count?.customers || 0) > 0;

    const confirmMessage = hasAssociations
      ? `This company has ${company._count?.businessUnits || 0} business units and ${company._count?.users || 0} users. It will be archived (soft deleted). Continue?`
      : 'Are you sure you want to permanently delete this company? This action cannot be undone.';

    if (!window.confirm(confirmMessage)) return;

    try {
      setDeleting(true);
      const result = await companyService.delete(id);
      toast.success(result.message || 'Company deleted successfully');
      router.push('/admin/companies');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete company');
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <Building className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Company Not Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">The company you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => router.push('/admin/companies')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Back to Companies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/companies')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                {company.logo ? (
                  <img src={company.logo} alt={company.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{company.name}</h1>
                <p className="text-gray-600 dark:text-gray-400">{company.email}</p>
              </div>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            company.isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {company.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => copyToClipboard(company.id, 'Company ID')}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            {copied === 'Company ID' ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-gray-700 dark:text-gray-300">Copy ID</span>
          </button>
          <Link
            href={`/admin/companies/${company.id}/edit`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {company.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Business Units"
            value={company.stats.totalBusinessUnits || company._count?.businessUnits || 0}
            icon={Briefcase}
            color="text-blue-600"
          />
          <StatCard
            label="Users"
            value={company.stats.totalUsers || company._count?.users || 0}
            icon={Users}
            color="text-green-600"
          />
          <StatCard
            label="Revenue"
            value={`${company.currency || '$'}${(company.stats.totalRevenue || 0).toLocaleString()}`}
            icon={DollarSign}
            color="text-yellow-600"
          />
          <StatCard
            label="Customers"
            value={company.stats.totalCustomers || company._count?.customers || 0}
            icon={UserPlus}
            color="text-purple-600"
          />
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Company Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Company Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-900 dark:text-white">{company.email}</span>
              <button
                onClick={() => copyToClipboard(company.email, 'Email')}
                className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {copied === 'Email' ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-gray-900 dark:text-white">{company.phone}</span>
              <button
                onClick={() => copyToClipboard(company.phone, 'Phone')}
                className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {copied === 'Phone' ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
            {company.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-900 dark:text-white">{company.address}</span>
              </div>
            )}
            {company.taxId && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 dark:text-gray-500 font-mono">#</span>
                <span className="text-gray-900 dark:text-white">{company.taxId}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-400 dark:text-gray-500">ID:</span>
              <span className="text-gray-900 dark:text-white font-mono text-xs">{company.id}</span>
              <button
                onClick={() => copyToClipboard(company.id, 'Company ID')}
                className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {copied === 'Company ID' ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Additional Information</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Currency</span>
              <span className="font-medium text-gray-900 dark:text-white">{company.currency}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Timezone</span>
              <span className="font-medium text-gray-900 dark:text-white">{company.timezone}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Created</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatDistanceToNow(new Date(company.createdAt), { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Last Updated</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatDistanceToNow(new Date(company.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Business Units Section */}
      {company.businessUnits && company.businessUnits.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Business Units</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {company.businessUnits.length} active business unit{company.businessUnits.length > 1 ? 's' : ''}
              </p>
            </div>
            <Link
              href={`/admin/business-units/new?companyId=${company.id}`}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Unit
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {company.businessUnits.map((unit) => (
              <div
                key={unit.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{unit.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{unit.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        unit.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {unit.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{unit.type}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => copyToClipboard(unit.id, 'Business Unit ID')}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Copy ID"
                    >
                      {copied === 'Business Unit ID' ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                {unit.address && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{unit.address}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{unit._count?.products || 0} Products</span>
                  <span>{unit._count?.users || 0} Users</span>
                  <span>{unit._count?.sales || 0} Sales</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href={`/admin/business-units/new?companyId=${company.id}`}
            className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <Briefcase className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Business Unit</span>
          </Link>
          <Link
            href={`/admin/users/new?companyId=${company.id}`}
            className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <Users className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add User</span>
          </Link>
          <Link
            href={`/admin/companies/${company.id}/settings`}
            className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <Settings className="w-6 h-6 text-gray-500 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Settings</span>
          </Link>
          <Link
            href={`/admin/reports?companyId=${company.id}`}
            className="p-4 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <TrendingUp className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reports</span>
          </Link>
        </div>
      </div>

      {/* Supplier Creation Helper */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">Company ID Ready</h4>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              Use this Company ID when creating suppliers:
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg text-xs font-mono text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                {company.id}
              </code>
              <button
                onClick={() => copyToClipboard(company.id, 'Company ID')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 text-sm"
              >
                {copied === 'Company ID' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
