// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryAuditLog.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, Filter, X, RefreshCw, Lock,
  Eye, ChevronDown, ChevronUp, Clock, User,
  Package, Truck, DollarSign, AlertCircle,
  CheckCircle, AlertTriangle, Info, Edit,
  Trash2, Plus, Minus, ArrowUp, ArrowDown,
  Calendar, Building, Tag, MapPin, Hash,
  Download, Printer, ChevronRight, MoreVertical,
  Shield, Users, Activity, BarChart3,
  ArrowRight,   // ✅ ADDED
  ArrowUpDown,  // ✅ ADDED
  Upload,       // ✅ ADDED
  ShoppingCart, // ✅ ADDED
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import { formatDate, formatCurrency, formatNumber } from '../../utils/formatters';

// ============================================
// TYPES
// ============================================

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  entityName?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  businessUnitId: string;
  businessUnitName?: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface InventoryAuditLogProps {
  className?: string;
  maxItems?: number;
  showFilters?: boolean;
  compact?: boolean;
  onEntryClick?: (entry: AuditLogEntry) => void;
}

// ============================================
// CONSTANTS
// ============================================

const ACTION_COLORS: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  CREATE: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: Plus },
  UPDATE: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: Edit },
  DELETE: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: Trash2 },
  RESTORE: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: RefreshCw },
  TRANSFER: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: Truck },
  ADJUST: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: ArrowUpDown },
  EXPORT: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', icon: Download },
  IMPORT: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', icon: Upload },
  PURCHASE: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: ShoppingCart },
  SALE: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: DollarSign },
  RESTOCK: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: Package },
  ISSUE: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: ArrowUp },
  RETURN: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: ArrowDown },
  INITIAL: { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-700 dark:text-gray-300', icon: Package },
  UNKNOWN: { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-700 dark:text-gray-300', icon: FileText },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  RESTORE: RefreshCw,
  TRANSFER: Truck,
  ADJUST: ArrowUpDown,
  EXPORT: Download,
  IMPORT: Upload,
  PURCHASE: ShoppingCart,
  SALE: DollarSign,
  RESTOCK: Package,
  ISSUE: ArrowUp,
  RETURN: ArrowDown,
  INITIAL: Package,
  UNKNOWN: FileText,
};

// ============================================
// SUB-COMPONENTS
// ============================================

const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
  const config = ACTION_COLORS[action] || ACTION_COLORS.UNKNOWN;
  const Icon = config.icon || FileText;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {action}
    </span>
  );
};

const ChangeDiff: React.FC<{ oldValue: any; newValue: any }> = ({ oldValue, newValue }) => {
  const oldStr = typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue);
  const newStr = typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-red-600 dark:text-red-400 line-through">{oldStr}</span>
      <ArrowRight className="w-3 h-3 text-gray-400" />
      <span className="text-green-600 dark:text-green-400">{newStr}</span>
    </div>
  );
};

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="flex-1">
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
              </div>
              <div className="mt-2 flex gap-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryAuditLog({
  className = '',
  maxItems = 50,
  showFilters: propShowFilters = true,  // ✅ FIXED: Renamed to avoid duplicate
  compact = false,
  onEntryClick,
}: InventoryAuditLogProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { hasPermission } = usePermission();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);  // ✅ FIXED: Renamed to avoid duplicate
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const canViewAudit = hasPermission(`${PermissionResource.INVENTORY}:audit`) || user?.role === 'SUPER_ADMIN';
  const canExportAudit = hasPermission(`${PermissionResource.INVENTORY}:export`) || user?.role === 'SUPER_ADMIN';

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || 
                          (user?.businessUnits?.[0] as any)?.id || 
                          localStorage.getItem('businessUnitId') || '';

  // ============================================
  // DATA LOADING
  // ============================================

  const loadAuditLogs = useCallback(async () => {
    if (!businessUnitId) {
      setLoading(false);
      return;
    }
    
    if (!canViewAudit) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await inventoryService.getInventoryTransactions({
        businessUnitId,
        limit: maxItems,
      });
      
      const transactions = response?.data || [];
      
      const auditLogs: AuditLogEntry[] = transactions.map((tx: any) => ({
        id: tx.id || `log-${Date.now()}`,
        action: tx.transactionType || 'UNKNOWN',
        entity: 'InventoryTransaction',
        entityId: tx.id || '',
        entityName: tx.product?.name || 'Unknown Product',
        userId: tx.userId || tx.user?.id || 'system',
        userName: tx.user?.firstName && tx.user?.lastName 
          ? `${tx.user.firstName} ${tx.user.lastName}` 
          : tx.user?.firstName || tx.user?.lastName || 'System',
        userEmail: tx.user?.email,
        businessUnitId: tx.businessUnitId || businessUnitId,
        businessUnitName: tx.businessUnit?.name,
        changes: [
          {
            field: 'quantity',
            oldValue: tx.oldQuantity || 0,
            newValue: tx.quantity || 0,
          },
          {
            field: 'type',
            oldValue: tx.oldType || '',
            newValue: tx.transactionType || '',
          },
        ],
        metadata: {
          productId: tx.productId,
          variantId: tx.variantId,
          inventoryId: tx.inventoryId,
          reference: tx.reference,
          notes: tx.notes,
        },
        ipAddress: tx.ipAddress,
        userAgent: tx.userAgent,
        createdAt: tx.createdAt || new Date().toISOString(),
      }));
      
      auditLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setLogs(auditLogs);
      setFilteredLogs(auditLogs);
      
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
      setError(error?.message || 'Failed to load audit logs');
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessUnitId, canViewAudit, maxItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAuditLogs();
    toast.success('Audit logs refreshed');
  };

  // ============================================
  // FILTERING
  // ============================================

  useEffect(() => {
    let filtered = logs;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(log =>
        log.entityName?.toLowerCase().includes(query) ||
        log.userName.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.entity.toLowerCase().includes(query)
      );
    }
    
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }
    
    if (entityFilter !== 'all') {
      filtered = filtered.filter(log => log.entity === entityFilter);
    }
    
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      filtered = filtered.filter(log => new Date(log.createdAt) >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59);
      filtered = filtered.filter(log => new Date(log.createdAt) <= endDate);
    }
    
    setFilteredLogs(filtered);
  }, [logs, searchQuery, actionFilter, entityFilter, dateRange]);

  // ============================================
  // EXPORT
  // ============================================

  const handleExport = async () => {
    if (!canExportAudit) {
      toast.error('You do not have permission to export audit logs');
      return;
    }

    try {
      await inventoryService.exportInventory(businessUnitId, 'csv');
      toast.success('Audit logs exported successfully');
    } catch (error: any) {
      console.error('Failed to export:', error);
      toast.error(error?.message || 'Failed to export audit logs');
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueEntities = Array.from(new Set(logs.map(log => log.entity)));

  // ============================================
  // PERMISSION GUARD
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Please Login</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You need to be logged in to view audit logs.</p>
      </div>
    );
  }

  if (!canViewAudit) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You don't have permission to view audit logs.</p>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Log</h3>
          <span className="text-xs text-gray-400">({filteredLogs.length} records)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {canExportAudit && (
            <button
              onClick={handleExport}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
          {propShowFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`p-1.5 border rounded-lg transition-colors ${
                showFilterPanel ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600' : ''
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      {propShowFilters && showFilterPanel && (
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[150px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Entities</option>
              {uniqueEntities.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {(searchQuery || actionFilter !== 'all' || entityFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActionFilter('all');
                  setEntityFilter('all');
                }}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && <LoadingSkeleton count={compact ? 3 : 5} />}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Audit Log List */}
      {!loading && filteredLogs.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">No audit logs found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {searchQuery || actionFilter !== 'all' || entityFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Audit logs will appear here as inventory actions occur'}
          </p>
        </div>
      ) : !loading && filteredLogs.length > 0 ? (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogs.has(log.id);
            
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden"
              >
                <div 
                  className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${compact ? 'px-3 py-2' : ''}`}
                  onClick={() => {
                    if (isExpanded) {
                      expandedLogs.delete(log.id);
                      setExpandedLogs(new Set(expandedLogs));
                    } else {
                      expandedLogs.add(log.id);
                      setExpandedLogs(new Set(expandedLogs));
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                      <ActionBadge action={log.action} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {log.entityName || log.entity}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.userName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!compact && log.changes.length > 0 && (
                        <span className="text-xs text-gray-400">
                          {log.changes.length} change{log.changes.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Changes</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {log.changes.map((change, idx) => (
                              <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{change.field}</p>
                                <ChangeDiff oldValue={change.oldValue} newValue={change.newValue} />
                              </div>
                            ))}
                          </div>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Metadata</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(log.metadata).map(([key, value]) => (
                                  value && (
                                    <span key={key} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
                                      {key}: {String(value)}
                                    </span>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="text-xs text-gray-400">
                              <span>ID: {log.id}</span>
                              {log.ipAddress && <span className="ml-3">IP: {log.ipAddress}</span>}
                              {log.businessUnitName && <span className="ml-3">BU: {log.businessUnitName}</span>}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                                setShowDetailModal(true);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ) : null}

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
            >
              <button
                onClick={() => setShowDetailModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Audit Log Details</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(selectedLog.createdAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Action</p>
                  <ActionBadge action={selectedLog.action} />
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Entity</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedLog.entity}</p>
                  <p className="text-xs text-gray-400">{selectedLog.entityId}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">User</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedLog.userName}</p>
                  {selectedLog.userEmail && (
                    <p className="text-xs text-gray-400">{selectedLog.userEmail}</p>
                  )}
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Business Unit</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {selectedLog.businessUnitName || selectedLog.businessUnitId.slice(0, 8)}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Changes</p>
                <div className="grid grid-cols-1 gap-2">
                  {selectedLog.changes.map((change, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-600">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{change.field}</p>
                      <ChangeDiff oldValue={change.oldValue} newValue={change.newValue} />
                    </div>
                  ))}
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Metadata</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(selectedLog.metadata).map(([key, value]) => (
                      value && (
                        <span key={key} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-300">
                          {key}: {String(value)}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                {canExportAudit && (
                  <button
                    onClick={() => {
                      toast.success('Audit log entry copied');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Copy Details
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

// ============================================
// EXPORT
// ============================================

export default InventoryAuditLog;
