'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Package, ArrowRight, ArrowLeft, RefreshCw,
  Truck, Edit, AlertTriangle, CheckCircle, XCircle,
  Loader2, Eye, ChevronRight, ChevronDown, ChevronUp,
  Calendar, User, Building, Filter, Search, X,
  Activity, TrendingUp, TrendingDown, AlertCircle,
  Info, PackagePlus, PackageMinus, PackageCheck,
  PackageX,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { inventoryService } from '../../services/inventoryService';
import { toast } from '../../utils/toast-manager';
import {
  formatDate,
  formatCurrency,
  formatNumber,
} from '../../utils/formatters';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  quantity: number;
  productName: string;
  productSku?: string;
  location?: string;
  timestamp: string;
  user?: {
    id?: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  notes?: string;
  icon?: React.ElementType;
  color?: string;
  reference?: string;
  productId?: string;
  inventoryId?: string;
  businessUnitId?: string;
}

interface RecentActivityProps {
  className?: string;
  compact?: boolean;
  maxItems?: number;
  showFilters?: boolean;
  onActivityClick?: (activity: ActivityItem) => void;
  filterTypes?: string[];
}

const ACTIVITY_ICONS: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  PURCHASE: {
    icon: PackagePlus,
    color: 'text-success-500',
    label: 'Purchase',
  },
  RESTOCK: {
    icon: PackagePlus,
    color: 'text-brand-500',
    label: 'Restock',
  },
  SALE: {
    icon: PackageMinus,
    color: 'text-brand-500',
    label: 'Sale',
  },
  ISSUE: {
    icon: PackageMinus,
    color: 'text-danger-500',
    label: 'Issue',
  },
  RETURN: {
    icon: PackageCheck,
    color: 'text-secondary-500',
    label: 'Return',
  },
  ADJUSTMENT_IN: {
    icon: ArrowRight,
    color: 'text-success-500',
    label: 'Adjustment In',
  },
  ADJUSTMENT_OUT: {
    icon: ArrowLeft,
    color: 'text-danger-500',
    label: 'Adjustment Out',
  },
  TRANSFER_IN: {
    icon: ArrowRight,
    color: 'text-brand-500',
    label: 'Transfer In',
  },
  TRANSFER_OUT: {
    icon: ArrowLeft,
    color: 'text-brand-500',
    label: 'Transfer Out',
  },
  INITIAL: {
    icon: Package,
    color: 'text-gray-500',
    label: 'Initial Stock',
  },
  RESERVED: {
    icon: AlertTriangle,
    color: 'text-warning-500',
    label: 'Reserved',
  },
  RELEASED: {
    icon: CheckCircle,
    color: 'text-success-500',
    label: 'Released',
  },
};

const ACTIVITY_COLORS: Record<string, string> = {
  PURCHASE:
    'border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/10',
  RESTOCK:
    'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/10',
  SALE: 'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/10',
  ISSUE:
    'border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/10',
  RETURN:
    'border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900/10',
  ADJUSTMENT_IN:
    'border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/10',
  ADJUSTMENT_OUT:
    'border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/10',
  TRANSFER_IN:
    'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/10',
  TRANSFER_OUT:
    'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/10',
  INITIAL:
    'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50',
  RESERVED:
    'border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/10',
  RELEASED:
    'border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/10',
};

const ActivityCard: React.FC<{
  activity: ActivityItem;
  onClick?: () => void;
  compact?: boolean;
}> = ({ activity, onClick, compact = false }) => {
  const config = ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS.INITIAL;
  const Icon = config.icon;
  const colorClass = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.INITIAL;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: compact ? 1.01 : 1.02 }}
      className={`border rounded-xl p-3 hover:shadow-card-hover transition-all cursor-pointer ${colorClass} ${
        compact ? 'p-2' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-1">
            <div className="min-w-0">
              <p
                className={`font-medium text-gray-900 dark:text-white truncate ${
                  compact ? 'text-sm' : ''
                }`}
              >
                {activity.description}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-2xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {activity.productName}
                </span>
                {activity.productSku && (
                  <span className="font-mono text-gray-400 tabular-nums">
                    SKU: {activity.productSku}
                  </span>
                )}
                {activity.quantity !== 0 && (
                  <span
                    className={`font-medium tabular-nums ${
                      activity.quantity > 0
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-danger-600 dark:text-danger-400'
                    }`}
                  >
                    {activity.quantity > 0 ? '+' : ''}
                    {activity.quantity} units
                  </span>
                )}
                {activity.location && (
                  <span className="flex items-center gap-0.5">
                    <Building className="w-3 h-3" />
                    {activity.location}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-2xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" />
                {formatDate(activity.timestamp)}
              </span>
              {activity.user && (
                <p className="text-2xs text-gray-400 dark:text-gray-500 mt-0.5">
                  by {activity.user.firstName} {activity.user.lastName}
                </p>
              )}
            </div>
          </div>
          {activity.notes && !compact && (
            <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {activity.notes}
            </p>
          )}
          {activity.reference && (
            <p className="text-2xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono tabular-nums">
              Ref: {activity.reference}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const LoadingSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse border border-gray-200 dark:border-gray-700 rounded-xl p-3"
        >
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

export function RecentActivity({
  className = '',
  compact = false,
  maxItems = 10,
  showFilters = true,
  onActivityClick,
  filterTypes = [],
}: RecentActivityProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  const businessUnitId = useMemo(() => {
    const units = user?.businessUnits;
    if (units && units.length > 0) {
      const firstUnit = units[0] as any;
      return firstUnit?.businessUnitId || firstUnit?.id || '';
    }
    const userAny = user as any;
    return (
      userAny?.businessUnitId ||
      userAny?.userId ||
      localStorage.getItem('businessUnitId') ||
      ''
    );
  }, [user]);

  const loadActivities = useCallback(
    async (showLoading = true) => {
      if (!businessUnitId) {
        setLoading(false);
        return;
      }

      try {
        if (showLoading) setLoading(true);
        setError(null);

        const response = await inventoryService.getInventoryTransactions({
          businessUnitId,
          limit: 100,
        });

        const transactions = response?.data || [];

        const activityItems: ActivityItem[] = transactions.map((tx: any) => {
          const type = tx.transactionType || 'INITIAL';
          const config = ACTIVITY_ICONS[type] || ACTIVITY_ICONS.INITIAL;

          let description = type;
          switch (type) {
            case 'PURCHASE':
              description = 'Purchased stock';
              break;
            case 'RESTOCK':
              description = 'Restocked inventory';
              break;
            case 'SALE':
              description = 'Sold items';
              break;
            case 'ISSUE':
              description = 'Issued items';
              break;
            case 'RETURN':
              description = 'Returned items';
              break;
            case 'ADJUSTMENT_IN':
              description = 'Stock adjusted in';
              break;
            case 'ADJUSTMENT_OUT':
              description = 'Stock adjusted out';
              break;
            case 'TRANSFER_IN':
              description = 'Stock transferred in';
              break;
            case 'TRANSFER_OUT':
              description = 'Stock transferred out';
              break;
            case 'INITIAL':
              description = 'Initial stock setup';
              break;
            case 'RESERVED':
              description = 'Stock reserved';
              break;
            case 'RELEASED':
              description = 'Stock released';
              break;
            default:
              description = type || 'Activity';
          }

          const notes = tx.notes ?? undefined;

          return {
            id: tx.id || `tx-${Date.now()}-${Math.random()}`,
            type: type,
            description: description,
            quantity: tx.quantity || 0,
            productName: tx.product?.name || 'Unknown Product',
            productSku: tx.product?.sku || 'N/A',
            location: tx.location || tx.fromLocation || undefined,
            timestamp: tx.createdAt || new Date().toISOString(),
            user: tx.user
              ? {
                  id: tx.user.id,
                  firstName: tx.user.firstName || 'System',
                  lastName: tx.user.lastName || '',
                  email: tx.user.email,
                }
              : {
                  firstName: 'System',
                  lastName: '',
                },
            notes: notes,
            icon: config.icon,
            color: config.color,
            reference: tx.reference || undefined,
            productId: tx.productId || undefined,
            inventoryId: tx.inventoryId || undefined,
            businessUnitId: tx.businessUnitId || businessUnitId,
          };
        });

        activityItems.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() -
            new Date(a.timestamp).getTime()
        );

        setActivities(activityItems);
      } catch (error: any) {
        console.error('Failed to load recent activity:', error);
        setError(error?.message || 'Failed to load activity');
        toast.error('Failed to load recent activity');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [businessUnitId]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivities(false);
    toast.success('Activity refreshed');
  };

  const filteredActivities = useMemo(() => {
    let result = activities;

    if (typeFilter !== 'all') {
      result = result.filter((a) => a.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.productName.toLowerCase().includes(query) ||
          (a.productSku && a.productSku.toLowerCase().includes(query)) ||
          (a.description && a.description.toLowerCase().includes(query)) ||
          (a.notes && a.notes.toLowerCase().includes(query))
      );
    }

    if (!showAll) {
      result = result.slice(0, maxItems);
    }

    return result;
  }, [activities, typeFilter, searchQuery, showAll, maxItems]);

  const activityTypes = useMemo(() => {
    const types = new Set<string>();
    activities.forEach((a) => types.add(a.type));
    return Array.from(types);
  }, [activities]);

  useEffect(() => {
    if (isAuthenticated && businessUnitId) {
      loadActivities();
    }
  }, [isAuthenticated, businessUnitId, loadActivities]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Please login to view activity
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-500" />
            Recent Activity
          </h3>
        </div>
        <LoadingSkeleton count={compact ? 3 : 5} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-2xl flex items-start gap-3 ${className}`}
      >
        <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-danger-700 dark:text-danger-300">
            {error}
          </p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-300 focus-ring rounded"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-brand-500" />
          Recent Activity
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400 tabular-nums">
            ({activities.length} events)
          </span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 focus-ring"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          {activities.length > maxItems && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 focus-ring rounded"
            >
              {showAll ? (
                <>
                  Show Less <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  View All ({activities.length}){' '}
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[150px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none transition-shadow"
            />
          </div>
          {activityTypes.length > 1 && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="all">All Types</option>
              {activityTypes.map((type) => (
                <option key={type} value={type}>
                  {ACTIVITY_ICONS[type]?.label || type}
                </option>
              ))}
            </select>
          )}
          {(searchQuery || typeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
              className="text-sm text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 flex items-center gap-1 focus-ring rounded"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {filteredActivities.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <Activity className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery || typeFilter !== 'all'
              ? 'No activities match your filters'
              : 'No recent activity'}
          </p>
          {!searchQuery && typeFilter === 'all' && (
            <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1">
              Activity will appear here as inventory changes occur
            </p>
          )}
        </div>
      ) : (
        <div className={`space-y-2 ${compact ? 'space-y-1.5' : ''}`}>
          {filteredActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              compact={compact}
              onClick={() => {
                if (onActivityClick) {
                  onActivityClick(activity);
                } else if (activity.productId) {
                  router.push(
                    `/admin/inventory/${activity.productId}`
                  );
                }
              }}
            />
          ))}
        </div>
      )}

      {filteredActivities.length > 0 && (
        <div className="mt-3 text-2xs text-gray-400 dark:text-gray-500 text-center tabular-nums">
          Showing {filteredActivities.length} of {activities.length}{' '}
          activities
          {businessUnitId &&
            ` • BU: ${businessUnitId.slice(0, 8)}...`}
        </div>
      )}
    </div>
  );
}

export default RecentActivity;
