// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\payment-providers\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Edit, Trash2, RefreshCw, Loader2,
  CreditCard, Banknote, Wallet, Building, Gift, Star,
  Smartphone, Landmark, QrCode, CheckCircle, XCircle,
  AlertCircle, Shield, Zap, TrendingUp, TrendingDown,
  Search, Filter, ChevronDown, ChevronUp, X,
  Settings, Power, PowerOff, Eye, EyeOff,
  Copy, Download, Printer, Calendar, Clock,
  DollarSign, Percent, Tag, Layers, Box,
  Check, AlertTriangle, Info, HelpCircle,
  Globe, Shield as ShieldIcon, Lock, Unlock
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import { useThemeStore } from '../../../../stores/themeStore';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { paymentService, PaymentProviderStatus, CreatePaymentProviderRequest, UpdatePaymentProviderRequest } from '../../../../../services/paymentService';

// ============================================
// TYPES
// ============================================

interface PaymentProvider extends PaymentProviderStatus {
  id: string;
  provider: string;
  name: string;
  code: string;
  type: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  isActive: boolean;
  isHealthy: boolean;
  configured: boolean;
  transactions24h: number;
  volume24h: number;
  transactions7d: number;
  volume7d: number;
  transactions30d: number;
  volume30d: number;
  config: {
    name: string;
    type: string;
    supportedCurrencies: string[];
    supportedMethods: string[];
    description?: string;
    icon?: string;
    minAmount?: number;
    maxAmount?: number;
    feePercentage?: number;
    feeFixed?: number;
  };
  settings?: Record<string, any>;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateProviderData {
  name: string;
  code: string;
  type: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  config: {
    name: string;
    type: string;
    supportedCurrencies: string[];
    supportedMethods: string[];
    description?: string;
    icon?: string;
    minAmount?: number;
    maxAmount?: number;
    feePercentage?: number;
    feeFixed?: number;
  };
}

interface UpdateProviderData {
  name?: string;
  isActive?: boolean;
  config?: {
    name?: string;
    type?: string;
    supportedCurrencies?: string[];
    supportedMethods?: string[];
    description?: string;
    icon?: string;
    minAmount?: number;
    maxAmount?: number;
    feePercentage?: number;
    feeFixed?: number;
  };
  settings?: Record<string, any>;
  order?: number;
}

// ============================================
// CONSTANTS - EXACT PROVIDER IMAGE URLs
// ============================================

const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  PAYSTACK: 'https://paystack.com/assets/images/logo.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL: 'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE: 'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER: 'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PROVIDER_DARK_IMAGE_URLS: Record<string, string> = {
  STRIPE: 'https://stripe.com/img/v3/home/social.png',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg',
  FLUTTERWAVE: 'https://flutterwave.com/images/logo/flyer.png',
  PAYSTACK: 'https://paystack.com/assets/images/logo-white.png',
  SQUARE: 'https://squareup.com/icons/square_logo.svg',
  MTN: 'https://www.mtn.co.ug/wp-content/uploads/2023/05/mtn-logo.png',
  AIRTEL: 'https://www.airtel.in/static-assets/new-home/img/airtel-red-logo.svg',
  TIGO: 'https://www.tigo.com.tz/sites/default/files/tigo-logo.png',
  VODAFONE: 'https://www.vodafone.com/content/dam/vodcom/Images/Logo/vodafone_logo_red.png',
  CASH: 'https://cdn-icons-png.flaticon.com/512/2331/2331970.png',
  MOBILE_MONEY: 'https://cdn-icons-png.flaticon.com/512/545/545245.png',
  BANK_TRANSFER: 'https://cdn-icons-png.flaticon.com/512/2845/2845813.png',
  GIFT_CARD: 'https://cdn-icons-png.flaticon.com/512/3144/3144456.png',
  LOYALTY_POINTS: 'https://cdn-icons-png.flaticon.com/512/1828/1828665.png',
};

const PROVIDER_ICONS: Record<string, any> = {
  CASH: Banknote,
  STRIPE: CreditCard,
  MOBILE_MONEY: Smartphone,
  BANK_TRANSFER: Landmark,
  GIFT_CARD: Gift,
  LOYALTY_POINTS: Star,
  PAYPAL: CreditCard,
  FLUTTERWAVE: CreditCard,
  PAYSTACK: CreditCard,
  SQUARE: CreditCard,
  MTN: Smartphone,
  AIRTEL: Smartphone,
  TIGO: Smartphone,
  VODAFONE: Smartphone,
};

const PROVIDER_COLORS: Record<string, string> = {
  CASH: 'from-green-500 to-emerald-600',
  STRIPE: 'from-blue-500 to-indigo-600',
  MOBILE_MONEY: 'from-orange-500 to-amber-600',
  BANK_TRANSFER: 'from-purple-500 to-violet-600',
  GIFT_CARD: 'from-pink-500 to-rose-600',
  LOYALTY_POINTS: 'from-yellow-500 to-amber-600',
  PAYPAL: 'from-blue-400 to-sky-500',
  FLUTTERWAVE: 'from-emerald-500 to-teal-600',
  PAYSTACK: 'from-cyan-500 to-blue-600',
  SQUARE: 'from-gray-700 to-gray-900',
  MTN: 'from-yellow-500 to-amber-600',
  AIRTEL: 'from-red-500 to-rose-600',
  TIGO: 'from-blue-500 to-indigo-600',
  VODAFONE: 'from-red-600 to-red-800',
};

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  HYBRID: 'Hybrid',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  unhealthy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  configured: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  not_configured: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  online: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  offline: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300',
  hybrid: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentProvidersPage() {
  const router = useRouter();
  const { isDark } = useThemeStore();
  const { canView, canManage } = usePermission();
  
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [submitting, setSubmitting] = useState(false);
  
  // Form state for add provider
  const [newProvider, setNewProvider] = useState<CreateProviderData>({
    name: '',
    code: '',
    type: 'ONLINE',
    config: {
      name: '',
      type: 'online',
      supportedCurrencies: ['USD'],
      supportedMethods: [],
      description: '',
      icon: '💳',
      minAmount: 0,
      maxAmount: 10000,
      feePercentage: 0,
      feeFixed: 0,
    },
  });

  // Form state for settings
  const [settingsData, setSettingsData] = useState<UpdateProviderData>({});

  const canManageProviders = canManage(PermissionResource.PAYMENT) || canManage(PermissionResource.SETTINGS);
  const canViewProviders = canView(PermissionResource.PAYMENT) || canView(PermissionResource.SETTINGS);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      
      // Use the payment service to fetch providers
      const response = await paymentService.getPaymentProviders();
      
      if (response.success && response.data) {
        // Map the response data to our provider type
        const mappedProviders = response.data.map((p: any) => ({
          ...p,
          id: p.id || `provider_${p.provider}`,
          provider: p.provider,
          name: p.name || p.provider,
          code: p.code || p.provider,
          type: p.type || 'ONLINE',
          isActive: p.isActive !== undefined ? p.isActive : true,
          isHealthy: p.isHealthy !== undefined ? p.isHealthy : true,
          configured: p.configured !== undefined ? p.configured : false,
          transactions24h: p.transactions24h || 0,
          volume24h: p.volume24h || 0,
          transactions7d: p.transactions7d || 0,
          volume7d: p.volume7d || 0,
          transactions30d: p.transactions30d || 0,
          volume30d: p.volume30d || 0,
          config: p.config || {
            name: p.name || p.provider,
            type: p.type?.toLowerCase() || 'online',
            supportedCurrencies: ['USD'],
            supportedMethods: [],
            description: `${p.provider} payment provider`,
            icon: '💳',
            minAmount: 0,
            maxAmount: 100000,
            feePercentage: 0,
            feeFixed: 0,
          },
          settings: p.settings || {},
          order: p.order || 0,
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString(),
        }));
        
        setProviders(mappedProviders);
        
        if (mappedProviders.length === 0) {
          toast.info('No payment providers found. Create your first provider.');
        }
      } else {
        setProviders([]);
        toast.info('No payment providers configured yet.');
      }
    } catch (error: any) {
      console.error('Failed to fetch payment providers:', error);
      
      // Handle 404 gracefully
      if (error?.response?.status === 404) {
        toast.info('Payment providers endpoint not found. Please set up your payment providers.');
        setProviders([]);
      } else if (error?.response?.status === 401) {
        toast.error('Authentication required. Please log in again.');
      } else {
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load payment providers';
        toast.error(errorMessage);
        setProviders([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProviders();
    toast.success('Providers refreshed');
  };

  // ============================================
  // FILTERS & SEARCH
  // ============================================

  const filteredProviders = useMemo(() => {
    let filtered = providers;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.code?.toLowerCase().includes(query) ||
        p.provider?.toLowerCase().includes(query)
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.type === filterType);
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'active') {
        filtered = filtered.filter(p => p.isActive);
      } else if (filterStatus === 'inactive') {
        filtered = filtered.filter(p => !p.isActive);
      } else if (filterStatus === 'healthy') {
        filtered = filtered.filter(p => p.isHealthy);
      } else if (filterStatus === 'unhealthy') {
        filtered = filtered.filter(p => !p.isHealthy);
      }
    }

    return filtered;
  }, [providers, searchQuery, filterType, filterStatus]);

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  // Create a new payment provider
  const handleAddProvider = async () => {
    try {
      // Validate required fields
      if (!newProvider.name.trim()) {
        toast.error('Provider name is required');
        return;
      }
      if (!newProvider.code.trim()) {
        toast.error('Provider code is required');
        return;
      }

      setSubmitting(true);

      // Prepare the data for the API
      const providerData: CreatePaymentProviderRequest = {
        provider: newProvider.code.toUpperCase(),
        name: newProvider.name,
        code: newProvider.code.toUpperCase(),
        type: newProvider.type,
        isActive: true,
        isHealthy: true,
        configured: true,
        config: {
          name: newProvider.config.name || newProvider.name,
          type: newProvider.config.type || newProvider.type.toLowerCase(),
          supportedCurrencies: newProvider.config.supportedCurrencies,
          supportedMethods: newProvider.config.supportedMethods,
          description: newProvider.config.description,
          icon: newProvider.config.icon || '💳',
          minAmount: newProvider.config.minAmount,
          maxAmount: newProvider.config.maxAmount,
          feePercentage: newProvider.config.feePercentage,
          feeFixed: newProvider.config.feeFixed,
        },
        currencies: newProvider.config.supportedCurrencies,
        order: providers.length + 1,
      };

      // Send to API using payment service
      const response = await paymentService.createPaymentProvider(providerData);
      
      if (response.success && response.data) {
        // Add new provider to local state
        const newProviderData: PaymentProvider = {
          ...response.data,
          id: response.data.id || `provider_${response.data.provider}`,
          provider: response.data.provider,
          name: response.data.name || response.data.provider,
          code: response.data.code || response.data.provider,
          type: response.data.type || 'ONLINE',
          isActive: response.data.isActive !== undefined ? response.data.isActive : true,
          isHealthy: response.data.isHealthy !== undefined ? response.data.isHealthy : true,
          configured: response.data.configured !== undefined ? response.data.configured : true,
          transactions24h: response.data.transactions24h || 0,
          volume24h: response.data.volume24h || 0,
          transactions7d: response.data.transactions7d || 0,
          volume7d: response.data.volume7d || 0,
          transactions30d: response.data.transactions30d || 0,
          volume30d: response.data.volume30d || 0,
          config: response.data.config || providerData.config,
          settings: response.data.settings || {},
          order: response.data.order || providers.length + 1,
          createdAt: response.data.createdAt || new Date().toISOString(),
          updatedAt: response.data.updatedAt || new Date().toISOString(),
        };
        
        setProviders(prev => [...prev, newProviderData]);
        toast.success('Provider added successfully');
      } else {
        toast.error(response.message || 'Failed to add provider');
      }
      
      setShowProviderModal(false);
      
      // Reset form
      setNewProvider({
        name: '',
        code: '',
        type: 'ONLINE',
        config: {
          name: '',
          type: 'online',
          supportedCurrencies: ['USD'],
          supportedMethods: [],
          description: '',
          icon: '💳',
          minAmount: 0,
          maxAmount: 10000,
          feePercentage: 0,
          feeFixed: 0,
        },
      });
      
    } catch (error: any) {
      console.error('Failed to add provider:', error);
      
      if (error?.response?.status === 404) {
        toast.error('Payment providers API not available. Please contact support.');
      } else if (error?.response?.status === 400) {
        const errorMessage = error?.response?.data?.message || 'Validation error. Please check your input.';
        toast.error(errorMessage);
      } else {
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to add provider';
        toast.error(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Update an existing provider
  const handleUpdateProvider = async () => {
    if (!selectedProvider) return;
    
    try {
      setSubmitting(true);
      
      const response = await paymentService.updatePaymentProvider(selectedProvider.id, settingsData);
      
      if (response.success && response.data) {
        // Update local state
        const updatedProvider: PaymentProvider = {
          ...selectedProvider,
          ...response.data,
          config: {
            ...selectedProvider.config,
            ...(response.data.config || {}),
          },
        };
        
        setProviders(prev => prev.map(p =>
          p.id === selectedProvider.id ? updatedProvider : p
        ));
        
        toast.success('Settings updated successfully');
      } else {
        toast.error(response.message || 'Failed to update provider');
      }
      
      setShowSettingsModal(false);
      setSelectedProvider(null);
      setSettingsData({});
      
    } catch (error: any) {
      console.error('Failed to update provider:', error);
      
      if (error?.response?.status === 404) {
        toast.error('Payment providers API not available. Please contact support.');
      } else if (error?.response?.status === 400) {
        const errorMessage = error?.response?.data?.message || 'Validation error. Please check your input.';
        toast.error(errorMessage);
      } else {
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update provider';
        toast.error(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle provider active status
  const handleToggleProvider = async (providerId: string) => {
    try {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return;

      setSubmitting(true);

      const response = await paymentService.togglePaymentProvider(providerId, !provider.isActive);
      
      if (response.success) {
        // Update local state
        setProviders(prev => prev.map(p =>
          p.id === providerId ? { ...p, isActive: !p.isActive } : p
        ));
        
        toast.success(`Provider ${provider.isActive ? 'deactivated' : 'activated'} successfully`);
      } else {
        toast.error(response.message || 'Failed to toggle provider');
      }
    } catch (error: any) {
      console.error('Failed to toggle provider:', error);
      
      if (error?.response?.status === 404) {
        toast.error('Payment providers API not available. Please contact support.');
      } else {
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to toggle provider';
        toast.error(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a provider
  const handleDeleteProvider = async () => {
    if (!selectedProvider) return;
    
    try {
      setSubmitting(true);
      
      const response = await paymentService.deletePaymentProvider(selectedProvider.id);
      
      if (response.success) {
        setProviders(prev => prev.filter(p => p.id !== selectedProvider.id));
        setShowDeleteModal(false);
        setSelectedProvider(null);
        
        toast.success('Provider deleted successfully');
      } else {
        toast.error(response.message || 'Failed to delete provider');
      }
    } catch (error: any) {
      console.error('Failed to delete provider:', error);
      
      if (error?.response?.status === 404) {
        toast.error('Payment providers API not available. Please contact support.');
      } else {
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete provider';
        toast.error(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================
  // UI HELPERS
  // ============================================

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getProviderIcon = (providerCode: string) => {
    const Icon = PROVIDER_ICONS[providerCode] || CreditCard;
    return Icon;
  };

  const getProviderColor = (providerCode: string) => {
    return PROVIDER_COLORS[providerCode] || 'from-blue-500 to-purple-600';
  };

  const getProviderImageUrl = (providerCode: string): string => {
    return isDark && PROVIDER_DARK_IMAGE_URLS[providerCode] 
      ? PROVIDER_DARK_IMAGE_URLS[providerCode] 
      : PROVIDER_IMAGE_URLS[providerCode] || '';
  };

  const getTypeLabel = (type: string) => {
    return PROVIDER_TYPE_LABELS[type] || type;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // ============================================
  // PERMISSION CHECK
  // ============================================

  if (!canViewProviders) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to manage payment providers.</p>
        <button
          onClick={() => router.push('/admin/dashboard')}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading payment providers...</p>
        </div>
      </div>
    );
  }

  // Render provider card
  const renderProviderCard = (provider: PaymentProvider, index: number) => {
    const ProviderIcon = getProviderIcon(provider.provider);
    const imageUrl = getProviderImageUrl(provider.provider);
    const isActive = provider.isActive && provider.isHealthy && provider.configured;
    
    return (
      <motion.div
        key={provider.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`group rounded-xl overflow-hidden border transition-all duration-300 ${
          isActive
            ? isDark
              ? 'bg-gray-800 border-blue-500/50 hover:border-blue-400'
              : 'bg-white border-blue-300 hover:border-blue-500 shadow-md hover:shadow-xl'
            : isDark
              ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
              : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-lg'
        }`}
      >
        {/* Header */}
        <div className={`p-4 bg-gradient-to-r ${getProviderColor(provider.provider)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm p-1">
                  <Image
                    src={imageUrl}
                    alt={provider.name}
                    width={40}
                    height={40}
                    className="rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        const fallback = document.createElement('span');
                        fallback.className = 'text-white text-2xl';
                        fallback.textContent = provider.config?.icon || '💳';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <ProviderIcon className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h3 className="text-white font-semibold text-lg">{provider.name}</h3>
                <p className="text-white/70 text-sm">{provider.code}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white`}>
                {getTypeLabel(provider.type)}
              </span>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${provider.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-white/70">{provider.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">24h Transactions</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{provider.transactions24h || 0}</p>
            </div>
            <div className={`p-2 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">24h Volume</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(provider.volume24h || 0)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(provider.config?.supportedCurrencies || []).map((currency) => (
              <span key={currency} className={`px-2 py-0.5 rounded text-xs font-medium ${
                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
              }`}>
                {currency}
              </span>
            ))}
          </div>

          {provider.config?.description && (
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} line-clamp-2`}>
              {provider.config.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              {provider.configured ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Configured
                </span>
              ) : (
                <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Not Configured
                </span>
              )}
              {provider.isHealthy ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Healthy
                </span>
              ) : (
                <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Unhealthy
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {canManageProviders && (
                <>
                  <button
                    onClick={() => handleToggleProvider(provider.id)}
                    disabled={submitting}
                    className={`p-1.5 rounded-lg transition ${
                      isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    } disabled:opacity-50`}
                    title={provider.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {provider.isActive ? (
                      <PowerOff className="w-4 h-4 text-red-500" />
                    ) : (
                      <Power className="w-4 h-4 text-green-500" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProvider(provider);
                      setSettingsData({
                        name: provider.name,
                        config: provider.config,
                        settings: provider.settings,
                        order: provider.order,
                      });
                      setShowSettingsModal(true);
                    }}
                    className={`p-1.5 rounded-lg transition ${
                      isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                    title="Settings"
                  >
                    <Settings className="w-4 h-4 text-blue-500" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProvider(provider);
                      setShowDeleteModal(true);
                    }}
                    className={`p-1.5 rounded-lg transition ${
                      isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render provider row (list view)
  const renderProviderRow = (provider: PaymentProvider) => {
    const ProviderIcon = getProviderIcon(provider.provider);
    const imageUrl = getProviderImageUrl(provider.provider);
    
    return (
      <tr key={provider.id} className={`${isDark ? 'bg-gray-800 hover:bg-gray-700/50' : 'bg-white hover:bg-gray-50'} transition-colors`}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {imageUrl ? (
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-r ${getProviderColor(provider.provider)} flex items-center justify-center p-1">
                <Image
                  src={imageUrl}
                  alt={provider.name}
                  width={32}
                  height={32}
                  className="rounded object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      const fallback = document.createElement('span');
                      fallback.className = 'text-white text-xl';
                      fallback.textContent = provider.config?.icon || '💳';
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${getProviderColor(provider.provider)} flex items-center justify-center`}>
                <ProviderIcon className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{provider.name}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{provider.code}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(provider.type?.toLowerCase() || '')}`}>
            {getTypeLabel(provider.type)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${getStatusColor(provider.isActive ? 'active' : 'inactive')}`}>
              {provider.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${getStatusColor(provider.isHealthy ? 'healthy' : 'unhealthy')}`}>
              {provider.isHealthy ? 'Healthy' : 'Unhealthy'}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatCurrency(provider.volume24h || 0)}
          </p>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {provider.transactions24h || 0} transactions
          </p>
        </td>
        <td className="px-4 py-3 text-right">
          <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatCurrency(provider.volume30d || 0)}
          </p>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {provider.transactions30d || 0} transactions
          </p>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {(provider.config?.supportedCurrencies || []).map((currency) => (
              <span key={currency} className={`px-2 py-0.5 rounded text-xs font-medium ${
                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
              }`}>
                {currency}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {canManageProviders && (
              <>
                <button
                  onClick={() => handleToggleProvider(provider.id)}
                  disabled={submitting}
                  className={`p-1.5 rounded-lg transition ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  } disabled:opacity-50`}
                  title={provider.isActive ? 'Deactivate' : 'Activate'}
                >
                  {provider.isActive ? (
                    <PowerOff className="w-4 h-4 text-red-500" />
                  ) : (
                    <Power className="w-4 h-4 text-green-500" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setSelectedProvider(provider);
                    setSettingsData({
                      name: provider.name,
                      config: provider.config,
                      settings: provider.settings,
                      order: provider.order,
                    });
                    setShowSettingsModal(true);
                  }}
                  className={`p-1.5 rounded-lg transition ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-4 h-4 text-blue-500" />
                </button>
                <button
                  onClick={() => {
                    setSelectedProvider(provider);
                    setShowDeleteModal(true);
                  }}
                  className={`p-1.5 rounded-lg transition ${
                    isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'} transition-colors duration-300`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/dashboard')}
            className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} flex items-center gap-3`}>
              <CreditCard className="w-7 h-7 text-blue-500" />
              Payment Providers
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage your payment providers and their configurations
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 rounded-lg transition ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-white hover:bg-gray-100 text-gray-700'} border ${isDark ? 'border-gray-700' : 'border-gray-300'} disabled:opacity-50`}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Box className="w-4 h-4" />
            </button>
          </div>
          {canManageProviders && (
            <button
              onClick={() => setShowProviderModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Provider
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Providers', value: providers.length, icon: CreditCard, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
          { label: 'Active', value: providers.filter(p => p.isActive).length, icon: CheckCircle, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
          { label: 'Healthy', value: providers.filter(p => p.isHealthy).length, icon: Shield, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
          { label: '24h Volume', value: `$${formatNumber(providers.reduce((sum, p) => sum + (p.volume24h || 0), 0))}`, icon: TrendingUp, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
        ].map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-6 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
                <p className={`text-2xl font-bold mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm ${
                isDark
                  ? 'bg-gray-700 text-white placeholder-gray-400'
                  : 'bg-gray-100 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`px-4 py-2 rounded-lg border text-sm ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="all">All Types</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="HYBRID">Hybrid</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-4 py-2 rounded-lg border text-sm ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="healthy">Healthy</option>
            <option value="unhealthy">Unhealthy</option>
          </select>
          {(searchQuery || filterType !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setFilterStatus('all');
              }}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Providers Grid/List */}
      {filteredProviders.length === 0 ? (
        <div className={`text-center py-12 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <CreditCard className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>No providers found</h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {providers.length === 0 ? 'No payment providers configured yet' : 'Try adjusting your filters or search terms'}
          </p>
          {providers.length === 0 && canManageProviders && (
            <button
              onClick={() => setShowProviderModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Add your first provider
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider, index) => renderProviderCard(provider, index))}
        </div>
      ) : (
        <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <table className="w-full">
            <thead className={`${isDark ? 'bg-gray-800' : 'bg-gray-50'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Provider
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Type
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Status
                </th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  24h Volume
                </th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  30d Volume
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Currencies
                </th>
                <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredProviders.map(renderProviderRow)}
            </tbody>
          </table>
        </div>
      )}

      {/* Provider Stats Summary */}
      {filteredProviders.length > 0 && (
        <div className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Providers</p>
              <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{filteredProviders.length}</p>
            </div>
            <div>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total 24h Volume</p>
              <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(filteredProviders.reduce((sum, p) => sum + (p.volume24h || 0), 0))}
              </p>
            </div>
            <div>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total 30d Volume</p>
              <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formatCurrency(filteredProviders.reduce((sum, p) => sum + (p.volume30d || 0), 0))}
              </p>
            </div>
            <div>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Avg. Fee</p>
              <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {(filteredProviders.reduce((sum, p) => sum + (p.config?.feePercentage || 0), 0) / filteredProviders.length).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Provider Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`max-w-md w-full rounded-xl shadow-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Delete Provider</h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>This action cannot be undone</p>
                </div>
              </div>
              <p className={`text-gray-600 dark:text-gray-300 mb-6`}>
                Are you sure you want to delete <strong className={isDark ? 'text-white' : 'text-gray-900'}>{selectedProvider.name}</strong>?
                This will permanently remove the provider and all associated data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className={`px-4 py-2 border rounded-lg transition ${
                    isDark
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProvider}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Provider Modal */}
      <AnimatePresence>
        {showProviderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`max-w-lg w-full rounded-xl shadow-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'} max-h-[90vh] overflow-y-auto`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Payment Provider</h3>
                <button
                  onClick={() => setShowProviderModal(false)}
                  className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Provider Name *
                  </label>
                  <input
                    type="text"
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="e.g., Stripe"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Provider Code *
                  </label>
                  <input
                    type="text"
                    value={newProvider.code}
                    onChange={(e) => setNewProvider({ ...newProvider, code: e.target.value.toUpperCase() })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="e.g., STRIPE"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Type
                  </label>
                  <select
                    value={newProvider.type}
                    onChange={(e) => setNewProvider({ ...newProvider, type: e.target.value as 'ONLINE' | 'OFFLINE' | 'HYBRID' })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="ONLINE">Online</option>
                    <option value="OFFLINE">Offline</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description
                  </label>
                  <textarea
                    value={newProvider.config.description || ''}
                    onChange={(e) => setNewProvider({
                      ...newProvider,
                      config: { ...newProvider.config, description: e.target.value }
                    })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="Brief description of the provider"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Min Amount
                    </label>
                    <input
                      type="number"
                      value={newProvider.config.minAmount || 0}
                      onChange={(e) => setNewProvider({
                        ...newProvider,
                        config: { ...newProvider.config, minAmount: parseFloat(e.target.value) || 0 }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Max Amount
                    </label>
                    <input
                      type="number"
                      value={newProvider.config.maxAmount || 0}
                      onChange={(e) => setNewProvider({
                        ...newProvider,
                        config: { ...newProvider.config, maxAmount: parseFloat(e.target.value) || 0 }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Fee Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newProvider.config.feePercentage || 0}
                      onChange={(e) => setNewProvider({
                        ...newProvider,
                        config: { ...newProvider.config, feePercentage: parseFloat(e.target.value) || 0 }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Fixed Fee
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newProvider.config.feeFixed || 0}
                      onChange={(e) => setNewProvider({
                        ...newProvider,
                        config: { ...newProvider.config, feeFixed: parseFloat(e.target.value) || 0 }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Supported Currencies (comma separated)
                  </label>
                  <input
                    type="text"
                    value={newProvider.config.supportedCurrencies.join(', ')}
                    onChange={(e) => setNewProvider({
                      ...newProvider,
                      config: {
                        ...newProvider.config,
                        supportedCurrencies: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                      }
                    })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="USD, EUR, GBP"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowProviderModal(false)}
                    className={`px-4 py-2 border rounded-lg transition ${
                      isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProvider}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add Provider
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && selectedProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`max-w-2xl w-full rounded-xl shadow-xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'} max-h-[90vh] overflow-y-auto`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedProvider.name} Settings
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Configure provider settings and preferences
                  </p>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Provider Name
                  </label>
                  <input
                    type="text"
                    value={settingsData.name || ''}
                    onChange={(e) => setSettingsData({ ...settingsData, name: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Min Amount
                    </label>
                    <input
                      type="number"
                      value={settingsData.config?.minAmount || 0}
                      onChange={(e) => setSettingsData({
                        ...settingsData,
                        config: { ...settingsData.config, minAmount: parseFloat(e.target.value) || 0 }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Max Amount
                    </label>
                    <input
                      type="number"
                      value={settingsData.config?.maxAmount || 0}
                      onChange={(e) => setSettingsData({
                        ...settingsData,
                        config: { ...settingsData.config, maxAmount: parseFloat(e.target.value) || 0 }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Fee Percentage (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settingsData.config?.feePercentage || 0}
                      onChange={(e) => setSettingsData({
                        ...settingsData,
                        config: { ...settingsData.config, feePercentage: parseFloat(e.target.value) || 0 }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Fixed Fee
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settingsData.config?.feeFixed || 0}
                      onChange={(e) => setSettingsData({
                        ...settingsData,
                        config: { ...settingsData.config, feeFixed: parseFloat(e.target.value) || 0 }
                      })}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Supported Currencies (comma separated)
                  </label>
                  <input
                    type="text"
                    value={(settingsData.config?.supportedCurrencies || []).join(', ')}
                    onChange={(e) => setSettingsData({
                      ...settingsData,
                      config: {
                        ...settingsData.config,
                        supportedCurrencies: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                      }
                    })}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="USD, EUR, GBP"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className={`px-4 py-2 border rounded-lg transition ${
                      isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateProvider}
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Settings
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
