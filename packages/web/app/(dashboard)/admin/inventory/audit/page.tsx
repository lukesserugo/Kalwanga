// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\inventory\audit\page.tsx

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Clock, User, Package, Edit, Trash2,
  Plus, Filter, RefreshCw, Search, Download,
  ChevronLeft, ChevronRight, Eye, FileText,
  ArrowUp, Lock, AlertCircle, X,
  CheckCircle, AlertTriangle, Info,
  Barcode, QrCode, Scan, Printer, Copy,
  Link2, Database, Calendar, Building2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { auditService, AuditEntry, AuditFilters, AuditPagination } from '../../../../../services/auditService';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';

// ============================================
// CONSTANTS
// ============================================

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'VIEW', label: 'View' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'APPROVE', label: 'Approve' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'BARCODE_GENERATE', label: 'Barcode Generate' },
  { value: 'BARCODE_SCAN', label: 'Barcode Scan' },
  { value: 'BARCODE_ASSOCIATE', label: 'Barcode Associate' },
  { value: 'QR_CODE_GENERATE', label: 'QR Code Generate' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'DOWNLOAD', label: 'Download' },
];

const ENTITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'USER', label: 'User' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'BUSINESS_UNIT', label: 'Business Unit' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'SALE', label: 'Sale' },
  { value: 'SALE_ITEM', label: 'Sale Item' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'ORDER', label: 'Order' },
  { value: 'RETURN', label: 'Return' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'NOTIFICATION', label: 'Notification' },
  { value: 'SETTINGS', label: 'Settings' },
  { value: 'AUDIT_LOG', label: 'Audit Log' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'INFO', label: 'Info', color: 'text-brand-500' },
  { value: 'LOW', label: 'Low', color: 'text-success-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-warning-500' },
  { value: 'HIGH', label: 'High', color: 'text-brand-500' },
  { value: 'CRITICAL', label: 'Critical', color: 'text-brand-accent-500' },
];

const BARCODE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Has Barcode' },
  { value: 'false', label: 'No Barcode' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export default function AuditPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission } = usePermission();

  const loadingRef = useRef(false);
  const initialLoadRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<AuditFilters>({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    hasBarcode: undefined,
    severity: '',
  });
  const [pagination, setPagination] = useState<AuditPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';
  const companyId = user?.companyId || '';

  const canViewAudit =
    hasPermission(`${PermissionResource.INVENTORY}:view_audit`) ||
    hasPermission(`${PermissionResource.INVENTORY}:manage`) ||
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN';

  const loadAuditLog = useCallback(async (showLoading = true) => {
    if (loadingRef.current) {
      console.log('⏭️ Skipping load - already loading');
      return;
    }

    loadingRef.current = true;

    try {
      if (showLoading) setLoading(true);
      if (!showLoading) setRefreshing(true);

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (businessUnitId) params.businessUnitId = businessUnitId;
      if (companyId) params.companyId = companyId;
      if (filter.action) params.action = filter.action;
      if (filter.entityType) params.entityType = filter.entityType;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate) params.endDate = filter.endDate;
      if (filter.severity) params.severity = filter.severity;

      if (
        filter.hasBarcode !== undefined &&
        filter.hasBarcode !== null &&
        filter.hasBarcode !== ''
      ) {
        params.hasBarcode = filter.hasBarcode === 'true' ? true : false;
      }
      if (searchQuery) params.search = searchQuery;

      console.log('📤 Fetching audit log with params:', params);

      const response = await auditService.getAuditLogs(params);

      console.log('📥 Audit log response:', response);

      setEntries(response.data || []);
      setPagination({
        page: response.page || 1,
        limit: response.limit || 20,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
      });

      initialLoadRef.current = true;
    } catch (error: any) {
      console.error('Failed to load audit log:', error);

      if (error?.response?.status === 404) {
        toast.info('Audit endpoint not available');
        setEntries([]);
        setPagination((prev) => ({
          ...prev,
          total: 0,
          totalPages: 1,
        }));
      } else {
        toast.error(error?.response?.data?.message || 'Failed to load audit log');
        setEntries([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [pagination.page, pagination.limit, filter, searchQuery, businessUnitId, companyId]);

  const loadStats = useCallback(async () => {
    if (!companyId) {
      console.log('⏭️ Skipping stats load - no companyId available');
      setStats(null);
      return;
    }

    if (loadingStats) return;
    setLoadingStats(true);
    try {
      console.log('📤 Fetching audit stats with companyId:', companyId);
      const statsData = await auditService.getAuditStats({ companyId });
      console.log('📥 Audit stats response:', statsData);
      setStats(statsData);
    } catch (error) {
      console.warn('Failed to load audit stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }, [companyId, loadingStats]);

  useEffect(() => {
    if (!initialLoadRef.current) {
      loadAuditLog();
      loadStats();
    }
  }, [loadAuditLog, loadStats]);

  useEffect(() => {
    if (initialLoadRef.current) {
      loadAuditLog();
    }
  }, [pagination.page, filter, searchQuery, loadAuditLog]);

  const handleRefresh = async () => {
    await loadAuditLog(false);
    await loadStats();
    toast.success('Audit log refreshed');
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    setFilter((prev) => ({
      ...prev,
      [key]: value === '' ? undefined : value,
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilter({
      action: '',
      entityType: '',
      startDate: '',
      endDate: '',
      hasBarcode: undefined,
      severity: '',
    });
    setSearchQuery('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleCopyBarcode = async (barcode: string) => {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopiedBarcode(barcode);
      toast.success('Barcode copied');
      setTimeout(() => setCopiedBarcode(null), 2000);
    } catch {
      toast.error('Failed to copy barcode');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: any = {
        format: 'csv',
      };

      if (businessUnitId) params.businessUnitId = businessUnitId;
      if (companyId) params.companyId = companyId;
      if (filter.action) params.action = filter.action;
      if (filter.entityType) params.entityType = filter.entityType;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate) params.endDate = filter.endDate;
      if (filter.severity) params.severity = filter.severity;
      if (
        filter.hasBarcode !== undefined &&
        filter.hasBarcode !== null &&
        filter.hasBarcode !== ''
      ) {
        params.hasBarcode = filter.hasBarcode === 'true' ? true : false;
      }
      if (searchQuery) params.search = searchQuery;

      const blob = await auditService.exportAuditLogs(params);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Audit log exported successfully');
    } catch (error) {
      console.error('Failed to export audit log:', error);
      toast.error('Failed to export audit log');
    } finally {
      setExporting(false);
    }
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleViewDetails = (entry: AuditEntry) => {
    setSelectedEntry(entry);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedEntry(null);
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      CREATE: 'bg-success-100 text-success-800 dark:bg-success-950/30 dark:text-success-300',
      UPDATE: 'bg-brand-100 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300',
      DELETE: 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-950/30 dark:text-brand-accent-300',
      VIEW: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      EXPORT: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-950/30 dark:text-secondary-300',
      IMPORT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300',
      APPROVE: 'bg-success-100 text-success-800 dark:bg-success-950/30 dark:text-success-300',
      REJECT: 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-950/30 dark:text-brand-accent-300',
      BARCODE_GENERATE: 'bg-teal-100 text-teal-800 dark:bg-teal-950/30 dark:text-teal-300',
      BARCODE_SCAN: 'bg-teal-100 text-teal-800 dark:bg-teal-950/30 dark:text-teal-300',
      BARCODE_ASSOCIATE: 'bg-brand-100 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300',
      QR_CODE_GENERATE: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-950/30 dark:text-secondary-300',
      LOGIN: 'bg-success-100 text-success-800 dark:bg-success-950/30 dark:text-success-300',
      LOGOUT: 'bg-brand-100 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300',
      DOWNLOAD: 'bg-secondary-100 text-secondary-800 dark:bg-secondary-950/30 dark:text-secondary-300',
    };
    return colors[action] || 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, React.ReactNode> = {
      CREATE: <Plus className="w-4 h-4" />,
      UPDATE: <Edit className="w-4 h-4" />,
      DELETE: <Trash2 className="w-4 h-4" />,
      VIEW: <Eye className="w-4 h-4" />,
      EXPORT: <Download className="w-4 h-4" />,
      IMPORT: <Plus className="w-4 h-4" />,
      APPROVE: <CheckCircle className="w-4 h-4" />,
      REJECT: <AlertCircle className="w-4 h-4" />,
      BARCODE_GENERATE: <Barcode className="w-4 h-4" />,
      BARCODE_SCAN: <Scan className="w-4 h-4" />,
      BARCODE_ASSOCIATE: <Link2 className="w-4 h-4" />,
      QR_CODE_GENERATE: <QrCode className="w-4 h-4" />,
      LOGIN: <User className="w-4 h-4" />,
      LOGOUT: <User className="w-4 h-4" />,
      DOWNLOAD: <Download className="w-4 h-4" />,
    };
    return icons[action] || <Shield className="w-4 h-4" />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      BARCODE_GENERATE: 'Barcode Generated',
      BARCODE_SCAN: 'Barcode Scanned',
      BARCODE_ASSOCIATE: 'Barcode Associated',
      QR_CODE_GENERATE: 'QR Code Generated',
    };
    return labels[action] || action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
  };

  const getSeverityColor = (severity?: string) => {
    const colors: Record<string, string> = {
      INFO: 'text-brand-500',
      LOW: 'text-success-500',
      MEDIUM: 'text-warning-500',
      HIGH: 'text-brand-500',
      CRITICAL: 'text-brand-accent-500',
    };
    return colors[severity || 'INFO'] || 'text-gray-500';
  };

  const getSeverityBadge = (severity?: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      INFO: { label: 'Info', color: 'bg-brand-100 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300' },
      LOW: { label: 'Low', color: 'bg-success-100 text-success-800 dark:bg-success-950/30 dark:text-success-300' },
      MEDIUM: { label: 'Medium', color: 'bg-warning-100 text-warning-800 dark:bg-warning-950/30 dark:text-warning-300' },
      HIGH: { label: 'High', color: 'bg-brand-100 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300' },
      CRITICAL: { label: 'Critical', color: 'bg-brand-accent-100 text-brand-accent-800 dark:bg-brand-accent-950/30 dark:text-brand-accent-300' },
    };
    return badges[severity || 'INFO'] || badges['INFO'];
  };

  const hasActiveFilters = () => {
    return !!(
      filter.action ||
      filter.entityType ||
      filter.startDate ||
      filter.endDate ||
      (filter.hasBarcode !== undefined && filter.hasBarcode !== '') ||
      filter.severity ||
      searchQuery
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filter.action) count++;
    if (filter.entityType) count++;
    if (filter.startDate) count++;
    if (filter.endDate) count++;
    if (filter.hasBarcode !== undefined && filter.hasBarcode !== '') count++;
    if (filter.severity) count++;
    if (searchQuery) count++;
    return count;
  };

  const renderBarcodeCell = (entry: AuditEntry) => {
    if (!entry.barcode) {
      return <span className="text-xs text-gray-400">No barcode</span>;
    }
    return (
      <div className="flex items-center gap-1">
        <Barcode className="w-3.5 h-3.5 text-success-500 flex-shrink-0" />
        <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate max-w-[120px]">
          {entry.barcode}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopyBarcode(entry.barcode!);
          }}
          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors focus-ring"
          title="Copy barcode"
        >
          {copiedBarcode === entry.barcode ? (
            <CheckCircle className="w-3 h-3 text-success-500" />
          ) : (
            <Copy className="w-3 h-3 text-gray-400" />
          )}
        </button>
      </div>
    );
  };

  if (!canViewAudit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
            You don't have permission to view audit logs.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-brand focus-ring"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading audit log...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-brand-500" />
            Audit Log
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
            Track all inventory changes and activities
            {pagination.total > 0 && (
              <span className="ml-2 text-sm">
                ({pagination.total} entries)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors disabled:opacity-50 focus-ring"
            aria-label="Refresh audit log"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg transition-colors relative focus-ring ${
              showFilters || hasActiveFilters()
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400'
                : 'border-gray-300 dark:border-gray-600 hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
            }`}
            aria-label="Toggle filters"
          >
            <Filter className="w-4 h-4" />
            {getActiveFilterCount() > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center tabular-nums">
                {getActiveFilterCount()}
              </span>
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || entries.length === 0}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 flex items-center gap-2 transition-colors disabled:opacity-50 focus-ring"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Actions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.totalActions}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Actions by Type</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {Object.keys(stats.actionsByType || {}).length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {stats.actionsByUser?.length || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Entities Tracked</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {stats.actionsByEntity?.length || 0}
            </p>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <AnimatePresence>
        {(showFilters || hasActiveFilters()) && (
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
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
                <select
                  value={filter.action || ''}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                >
                  {ACTION_TYPES.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.entityType || ''}
                  onChange={(e) => handleFilterChange('entityType', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                >
                  {ENTITY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.severity || ''}
                  onChange={(e) => handleFilterChange('severity', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                >
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={filter.startDate || ''}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                  <span className="text-sm text-gray-500">to</span>
                  <input
                    type="date"
                    value={filter.endDate || ''}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                  />
                </div>
                <select
                  value={
                    filter.hasBarcode !== undefined && filter.hasBarcode !== null
                      ? String(filter.hasBarcode)
                      : ''
                  }
                  onChange={(e) => handleFilterChange('hasBarcode', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                >
                  {BARCODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {hasActiveFilters() && (
                  <button
                    onClick={handleClearFilters}
                    className="px-3 py-2 text-sm text-brand-accent-600 dark:text-brand-accent-400 hover:bg-brand-accent-50 dark:hover:bg-brand-accent-950/20 rounded-lg transition-colors focus-ring"
                  >
                    <X className="w-4 h-4 inline mr-1" />
                    Clear All ({getActiveFilterCount()})
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABLE */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Barcode</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Changes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-lg font-medium">No audit entries found</p>
                    <p className="text-sm">Try adjusting your filters or search query</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const severityBadge = getSeverityBadge(entry.severity);

                  return (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-brand-50/50 dark:hover:bg-brand-950/10 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(entry)}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(
                            entry.action
                          )}`}
                        >
                          {getActionIcon(entry.action)}
                          {getActionLabel(entry.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                            {entry.entityName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{entry.entityType}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-xs">
                            {entry.user?.firstName} {entry.user?.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{renderBarcodeCell(entry)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                          {Object.keys(entry.changes || {}).length} change(s)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${severityBadge.color}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${getSeverityColor(entry.severity)}`}
                          />
                          {severityBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(entry);
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                          aria-label="View details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-brand-50 dark:hover:bg-gray-700 hover:border-brand-300 dark:hover:border-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {showDetailModal && selectedEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleCloseModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 m-4 custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-100 dark:bg-brand-950/30 rounded-lg">
                    <Shield className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Audit Entry Details
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedEntry.entityType} · {getActionLabel(selectedEntry.action)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Action
                    </p>
                    <span
                      className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(
                        selectedEntry.action
                      )}`}
                    >
                      {getActionIcon(selectedEntry.action)}
                      {getActionLabel(selectedEntry.action)}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Severity
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        getSeverityBadge(selectedEntry.severity).color
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${getSeverityColor(selectedEntry.severity)}`}
                      />
                      {getSeverityBadge(selectedEntry.severity).label}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Entity
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white mt-1">
                      {selectedEntry.entityName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedEntry.entityType}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Entity ID
                    </p>
                    <p className="font-mono text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {selectedEntry.entityId}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedEntry.user?.firstName} {selectedEntry.user?.lastName}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Timestamp
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatDate(selectedEntry.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedEntry.barcode && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Barcode Information
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <Barcode className="w-5 h-5 text-success-500" />
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                        {selectedEntry.barcode}
                      </span>
                      <button
                        onClick={() => handleCopyBarcode(selectedEntry.barcode!)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors focus-ring"
                        title="Copy barcode"
                      >
                        {copiedBarcode === selectedEntry.barcode ? (
                          <CheckCircle className="w-4 h-4 text-success-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                            JSON.stringify({ barcode: selectedEntry.barcode })
                          )}&size=200x200`;
                          window.open(qrUrl, '_blank');
                        }}
                        className="p-1 hover:bg-brand-100 dark:hover:bg-brand-950/30 rounded transition-colors focus-ring"
                        title="Generate QR Code"
                      >
                        <QrCode className="w-4 h-4 text-brand-500" />
                      </button>
                    </div>
                  </div>
                )}

                {(selectedEntry.ipAddress || selectedEntry.userAgent) && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Request Details
                    </p>
                    {selectedEntry.ipAddress && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        IP: {selectedEntry.ipAddress}
                      </p>
                    )}
                    {selectedEntry.userAgent && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-all">
                        User Agent: {selectedEntry.userAgent}
                      </p>
                    )}
                  </div>
                )}

                {selectedEntry.changes && Object.keys(selectedEntry.changes).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-500" />
                      Changes ({Object.keys(selectedEntry.changes).length})
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {Object.entries(selectedEntry.changes).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 mt-1">
                            <div className="min-w-[80px]">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Old Value</p>
                              <p className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                                {(value as any).old !== undefined && (value as any).old !== null
                                  ? String((value as any).old)
                                  : '-'}
                              </p>
                            </div>
                            <ArrowUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-[80px]">
                              <p className="text-xs text-gray-500 dark:text-gray-400">New Value</p>
                              <p className="text-sm text-success-600 dark:text-success-400 font-mono">
                                {(value as any).new !== undefined && (value as any).new !== null
                                  ? String((value as any).new)
                                  : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-ring"
                >
                  Close
                </button>
                {selectedEntry.barcode && (
                  <button
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (!printWindow) return;
                      printWindow.document.write(`
                        <html>
                          <head><title>Barcode - ${selectedEntry.entityName}</title>
                          <style>
                            body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                            .container { text-align: center; padding: 20px; }
                            .barcode-img { max-width: 300px; margin: 10px 0; }
                          </style>
                          </head>
                          <body>
                            <div class="container">
                              <h2>${selectedEntry.entityName}</h2>
                              <img src="https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
                                selectedEntry.barcode!
                              )}&code=EAN-13&dpi=96" class="barcode-img" />
                              <p>${selectedEntry.barcode}</p>
                            </div>
                            <script>window.onload = function() { window.print(); }</script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }}
                    className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 flex items-center gap-2 transition-colors shadow-brand focus-ring"
                  >
                    <Printer className="w-4 h-4" />
                    Print Barcode
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
