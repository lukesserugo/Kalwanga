// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\stock-count\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, RefreshCw, Search,
  Check, X, Loader2, Lock, AlertCircle,
  Calendar, User, Package, Edit, Trash2,
  ArrowLeft, Save, Filter, ChevronDown, ChevronUp,
  Clock, Building, Users, FileText, Printer,
  Download, Eye, MoreVertical, TrendingUp, TrendingDown,
  Award, Star, Globe, Archive, Hash, Tag,
  DollarSign, Percent, Weight, Image as ImageIcon,
  Link2, ExternalLink, Copy
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate, formatCurrency, formatNumber } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import { inventoryService } from '../../../../../services/inventoryService';

// ============================================
// TYPES
// ============================================

interface StockCountSession {
  id: string;
  name: string;
  location: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  expectedItems: number;
  countedItems: number;
  discrepancies: number;
  accuracy: number;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  businessUnitId: string;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
  tags?: string[];
  notes?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface StockCountItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images?: string[];
  };
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  notes?: string;
  status: 'PENDING' | 'COUNTED' | 'VERIFIED' | 'DISCREPANCY';
  countedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  countedAt?: string;
}

interface StockCountFilters {
  search: string;
  status: string;
  location: string;
  dateFrom: string;
  dateTo: string;
  priority: string;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Loader2 },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: Check },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: X },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300' },
  MEDIUM: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

// ============================================
// SUB-COMPONENTS
// ============================================

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority?: string }> = ({ priority }) => {
  if (!priority) return null;
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtext?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
}> = ({ label, value, icon: Icon, color, subtext, trend }) => {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
    yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colorClasses[color]?.bg || colorClasses.blue.bg} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color]?.text || colorClasses.blue.text} mt-1`}>
            {value}
          </p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${
              trend.direction === 'up' ? 'text-green-600 dark:text-green-400' :
              trend.direction === 'down' ? 'text-red-600 dark:text-red-400' :
              'text-gray-400'
            }`}>
              {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
              <span>{trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg bg-white dark:bg-gray-700/50`}>
          <Icon className={`w-5 h-5 ${colorClasses[color]?.text || colorClasses.blue.text}`} />
        </div>
      </div>
    </motion.div>
  );
};

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-48" />
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function StockCountPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StockCountSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<StockCountSession[]>([]);
  const [filters, setFilters] = useState<StockCountFilters>({
    search: '',
    status: '',
    location: '',
    dateFrom: '',
    dateTo: '',
    priority: '',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<StockCountSession | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    expectedItems: 0,
    priority: 'MEDIUM' as StockCountSession['priority'],
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<StockCountSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  const canManageInventory = hasPermission(`${PermissionResource.INVENTORY}:manage`) || user?.role === 'SUPER_ADMIN';

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You need to be logged in to manage stock counts.</p>
      </div>
    );
  }

  if (!canManageInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to manage stock counts. Please contact your administrator.
        </p>
        <button
          onClick={() => router.push('/admin/inventory')}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Inventory
        </button>
      </div>
    );
  }

  // ============================================
  // DATA LOADING
  // ============================================

  const loadSessions = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Load sessions from API
      // const data = await inventoryService.getStockCountSessions(businessUnitId);
      
      // Mock data for development
      const mockSessions: StockCountSession[] = [
        {
          id: '1',
          name: 'Warehouse Count Q1 2024',
          location: 'Warehouse',
          status: 'COMPLETED',
          expectedItems: 150,
          countedItems: 148,
          discrepancies: 2,
          accuracy: 98.7,
          createdBy: { id: '1', firstName: 'John', lastName: 'Doe' },
          assignedTo: { id: '2', firstName: 'Jane', lastName: 'Smith' },
          createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          startedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          businessUnitId,
          priority: 'HIGH',
          tags: ['quarterly', 'warehouse'],
        },
        {
          id: '2',
          name: 'Store A Inventory',
          location: 'Store A',
          status: 'IN_PROGRESS',
          expectedItems: 80,
          countedItems: 45,
          discrepancies: 3,
          accuracy: 56.3,
          createdBy: { id: '1', firstName: 'John', lastName: 'Doe' },
          assignedTo: { id: '3', firstName: 'Bob', lastName: 'Johnson' },
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          startedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          businessUnitId,
          priority: 'CRITICAL',
          tags: ['store', 'monthly'],
        },
        {
          id: '3',
          name: 'Monthly Stock Take',
          location: 'All Locations',
          status: 'PENDING',
          expectedItems: 230,
          countedItems: 0,
          discrepancies: 0,
          accuracy: 0,
          createdBy: { id: '1', firstName: 'John', lastName: 'Doe' },
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          businessUnitId,
          priority: 'MEDIUM',
          tags: ['monthly'],
        },
        {
          id: '4',
          name: 'Year-End Inventory',
          location: 'Distribution Center',
          status: 'CANCELLED',
          expectedItems: 320,
          countedItems: 0,
          discrepancies: 0,
          accuracy: 0,
          createdBy: { id: '1', firstName: 'John', lastName: 'Doe' },
          createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          businessUnitId,
          priority: 'LOW',
          tags: ['yearly'],
        },
      ];

      setSessions(mockSessions);
      setFilteredSessions(mockSessions);
      
    } catch (error: any) {
      console.error('Failed to load stock count sessions:', error);
      const errorMsg = error?.message || 'Failed to load stock count sessions';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    toast.success('Stock count sessions refreshed');
  };

  // ============================================
  // FILTERING
  // ============================================

  const applyFilters = useCallback(() => {
    let filtered = [...sessions];

    if (filters.search.trim()) {
      const query = filters.search.toLowerCase().trim();
      filtered = filtered.filter(session =>
        session.name.toLowerCase().includes(query) ||
        session.location.toLowerCase().includes(query)
      );
    }

    if (filters.status) {
      filtered = filtered.filter(session => session.status === filters.status);
    }

    if (filters.location) {
      filtered = filtered.filter(session =>
        session.location.toLowerCase().includes(filters.location.toLowerCase())
      );
    }

    if (filters.priority) {
      filtered = filtered.filter(session => session.priority === filters.priority);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(session => new Date(session.createdAt) >= new Date(filters.dateFrom));
    }

    if (filters.dateTo) {
      filtered = filtered.filter(session => new Date(session.createdAt) <= new Date(filters.dateTo));
    }

    setFilteredSessions(filtered);
  }, [sessions, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  const handleCreate = async () => {
    if (!formData.name || !formData.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // await inventoryService.createStockCountSession({ ...formData, businessUnitId });
      toast.success('Stock count session created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', location: '', expectedItems: 0, priority: 'MEDIUM', notes: '' });
      await loadSessions();
    } catch (error: any) {
      console.error('Failed to create session:', error);
      const errorMsg = error?.message || 'Failed to create stock count session';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!sessionToDelete) return;

    setDeleting(true);
    setError(null);
    try {
      // await inventoryService.deleteStockCountSession(sessionToDelete.id);
      toast.success('Stock count session deleted successfully');
      setShowDeleteModal(false);
      setSessionToDelete(null);
      await loadSessions();
    } catch (error: any) {
      console.error('Failed to delete session:', error);
      const errorMsg = error?.message || 'Failed to delete stock count session';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  // ✅ FIXED: Renamed from getStats to statsData to avoid confusion
  const statsData = useMemo(() => {
    const total = sessions.length;
    const pending = sessions.filter(s => s.status === 'PENDING').length;
    const inProgress = sessions.filter(s => s.status === 'IN_PROGRESS').length;
    const completed = sessions.filter(s => s.status === 'COMPLETED').length;
    const cancelled = sessions.filter(s => s.status === 'CANCELLED').length;
    const avgAccuracy = completed > 0 
      ? sessions.filter(s => s.status === 'COMPLETED').reduce((sum, s) => sum + s.accuracy, 0) / completed
      : 0;
    const totalDiscrepancies = sessions.reduce((sum, s) => sum + s.discrepancies, 0);

    return {
      total,
      pending,
      inProgress,
      completed,
      cancelled,
      avgAccuracy,
      totalDiscrepancies,
    };
  }, [sessions]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadSessions();
    }
  }, [isAuthenticated, businessUnitId, loadSessions]);

  // ============================================
  // RENDER
  // ============================================

  if (loading && !refreshing) {
    return <LoadingSkeleton />;
  }

  const hasActiveFilters = filters.search || filters.status || filters.location || filters.priority || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-800/30 rounded transition"
          >
            <X className="w-4 h-4 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ClipboardList className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" />
            Stock Count
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sessions.length} sessions • {statsData.inProgress} in progress • {statsData.completed} completed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setFormData({ name: '', location: '', expectedItems: 0, priority: 'MEDIUM', notes: '' });
              setShowCreateModal(true);
            }}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 sm:gap-2 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Count</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Sessions"
          value={statsData.total}
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          label="In Progress"
          value={statsData.inProgress}
          icon={Loader2}
          color="yellow"
        />
        <StatCard
          label="Completed"
          value={statsData.completed}
          icon={Check}
          color="green"
        />
        <StatCard
          label="Avg Accuracy"
          value={statsData.avgAccuracy.toFixed(1) + '%'}
          icon={Award}
          color="purple"
          subtext={`${statsData.totalDiscrepancies} discrepancies found`}
        />
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search sessions..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Priority</option>
                  {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Filter by location..."
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">to</span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setFilters({
                        search: '',
                        status: '',
                        location: '',
                        dateFrom: '',
                        dateTo: '',
                        priority: '',
                      });
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ClipboardList className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {sessions.length === 0 ? 'No stock count sessions' : 'No sessions match your filters'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {sessions.length === 0 ? 'Create your first stock count session' : 'Try adjusting your filters'}
          </p>
          {sessions.length === 0 && (
            <button
              onClick={() => {
                setFormData({ name: '', location: '', expectedItems: 0, priority: 'MEDIUM', notes: '' });
                setShowCreateModal(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              New Count
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/inventory/stock-count/${session.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-white truncate">{session.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5" />
                    {session.location}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2">
                  <StatusBadge status={session.status} />
                  {session.priority && <PriorityBadge priority={session.priority} />}
                </div>
              </div>

              {/* Progress */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Progress</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {session.expectedItems > 0
                      ? Math.round((session.countedItems / session.expectedItems) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((session.countedItems / (session.expectedItems || 1)) * 100, 100)}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-2 rounded-full ${
                      session.status === 'COMPLETED' ? 'bg-green-500' :
                      session.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                      session.status === 'CANCELLED' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expected</p>
                  <p className="font-medium text-gray-900 dark:text-white">{session.expectedItems}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Counted</p>
                  <p className="font-medium text-gray-900 dark:text-white">{session.countedItems}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Accuracy</p>
                  <p className={`font-medium ${
                    session.accuracy >= 95 ? 'text-green-600 dark:text-green-400' :
                    session.accuracy >= 80 ? 'text-yellow-600 dark:text-yellow-400' :
                    session.accuracy > 0 ? 'text-red-600 dark:text-red-400' :
                    'text-gray-400'
                  }`}>
                    {session.accuracy > 0 ? session.accuracy.toFixed(1) + '%' : '-'}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3" />
                  <span>{session.createdBy.firstName} {session.createdBy.lastName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(session.createdAt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-2 flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => router.push(`/inventory/stock-count/${session.id}`)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="View Details"
                >
                  <Eye className="w-4 h-4 text-gray-500" />
                </button>
                {session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Edit functionality
                        toast.info('Edit functionality coming soon');
                      }}
                      className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-blue-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(session);
                        setShowDeleteModal(true);
                      }}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New Stock Count</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Session Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Warehouse Count Q1 2024"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Warehouse, Store A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expected Items
                  </label>
                  <input
                    type="number"
                    value={formData.expectedItems}
                    onChange={(e) => setFormData({ ...formData, expectedItems: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as StockCountSession['priority'] })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !formData.name || !formData.location}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Create Session
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && sessionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Stock Count</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{sessionToDelete.name}</strong>?
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                  This action cannot be undone. All associated data will be permanently removed.
                </p>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Session
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
