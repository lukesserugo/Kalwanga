// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\notifications\page.tsx

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  ShoppingCart,
  Package,
  ClipboardList,
  CreditCard,
  Users,
  Settings,
  Sparkles,
  Clock,
  Truck,
  Receipt,
  Search,
  X,
  Loader2,
  Inbox,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Circle,
} from 'lucide-react';

import { notificationService } from '../../../../services/notificationService';
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationStats,
} from '../../../../types/notification';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_METADATA,
  NOTIFICATION_PRIORITY_METADATA,
} from '../../../../types/notification';
import { toast } from '../../../../utils/toast-manager';
import { useConfirm } from '../../../../components/notifications/ConfirmProvider';
import { NotificationDetailDrawer } from '../../../../components/notifications/NotificationDetailDrawer';
import {
  ConnectionStatusPill,
} from '../../../../components/notifications/ConnectionStatusPill';
import { useNotificationStream } from '../../../../hooks/useNotificationStream';

const PAGE_SIZE = 20;

function normalizeStats(
  stats: Partial<NotificationStats> | null | undefined,
): NotificationStats {
  return {
    total: stats?.total ?? 0,
    unread: stats?.unread ?? 0,
    read: stats?.read ?? 0,
    byType: stats?.byType ?? {},
    byDate: stats?.byDate ?? {},
    ...(stats as Partial<NotificationStats>),
  } as NotificationStats;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year:
        date.getFullYear() !== new Date().getFullYear()
          ? 'numeric'
          : undefined,
    });
  } catch {
    return '—';
  }
}

function formatFullTimestamp(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  'shopping-cart': ShoppingCart,
  package: Package,
  'clipboard-list': ClipboardList,
  'credit-card': CreditCard,
  user: Users,
  settings: Settings,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle2,
  info: Info,
  'alert-circle': AlertCircle,
  'x-circle': XCircle,
  sparkles: Sparkles,
  bell: Bell,
  truck: Truck,
  receipt: Receipt,
  clock: Clock,
};

function getTypeIcon(type: NotificationType) {
  const metadata = NOTIFICATION_TYPE_METADATA[type];
  const key = metadata?.iconKey ?? 'bell';
  return ICON_MAP[key] ?? Bell;
}

function getTypeLabel(type: NotificationType): string {
  return NOTIFICATION_TYPE_METADATA[type]?.label ?? type;
}

function getPriorityMeta(priority: NotificationPriority) {
  return (
    NOTIFICATION_PRIORITY_METADATA[priority] ?? {
      label: 'Medium',
      accent: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-300',
    }
  );
}

// --- Grouping by date ---
type DateGroup = 'Today' | 'Yesterday' | 'This week' | 'Earlier';

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date();
  const date = new Date(dateStr);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 6 * 86_400_000;
  const t = date.getTime();

  if (t >= startOfToday) return 'Today';
  if (t >= startOfYesterday) return 'Yesterday';
  if (t >= startOfWeek) return 'This week';
  return 'Earlier';
}

function groupByDate(
  items: Notification[],
): Array<{ group: DateGroup; items: Notification[] }> {
  const order: DateGroup[] = ['Today', 'Yesterday', 'This week', 'Earlier'];
  const buckets: Record<DateGroup, Notification[]> = {
    Today: [],
    Yesterday: [],
    'This week': [],
    Earlier: [],
  };
  for (const item of items) {
    buckets[getDateGroup(item.createdAt)].push(item);
  }
  return order
    .filter((g) => buckets[g].length > 0)
    .map((g) => ({ group: g, items: buckets[g] }));
}

// --- Highlight helper ---
function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const target = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(target, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark
        key={idx}
        className="bg-orange-200 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200 rounded px-0.5"
      >
        {text.slice(idx, idx + target.length)}
      </mark>,
    );
    i = idx + target.length;
  }
  return parts;
}

export default function NotificationsPage() {
  const confirm = useConfirm();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'ALL'>(
    'ALL',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<
    'createdAt' | 'priority' | 'type'
  >('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [drawerNotification, setDrawerNotification] =
    useState<Notification | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Stream
  const handleStream = useCallback(
    (notification: Notification) => {
      setNotifications((prev) => {
        // Skip if already in list
        if (prev.some((n) => n.id === notification.id)) return prev;
        // Only inject if on page 1 with no filters (default view)
        if (page === 1 && !unreadOnly && typeFilter === 'ALL' && !debouncedSearch) {
          return [notification, ...prev].slice(0, PAGE_SIZE);
        }
        return prev;
      });
      setStats((prev) =>
        prev
          ? {
              ...prev,
              total: prev.total + 1,
              unread: prev.unread + 1,
            }
          : prev,
      );
      setTotalCount((prev) => prev + 1);
    },
    [page, unreadOnly, typeFilter, debouncedSearch],
  );

  const { status: streamStatus, reconnect } = useNotificationStream({
    onNotification: handleStream,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchNotifications = useCallback(
    async (mode: 'initial' | 'refresh' | 'refetch' = 'refetch') => {
      try {
        if (mode === 'initial') setLoading(true);
        else if (mode === 'refresh') setRefreshing(true);
        else setRefetching(true);

        const params: Record<string, any> = {
          page,
          limit: PAGE_SIZE,
          sortBy,
          sortOrder,
        };
        if (unreadOnly) params.unreadOnly = true;
        if (typeFilter !== 'ALL') params.type = typeFilter;
        if (debouncedSearch) params.search = debouncedSearch;

        const [listResult, statsResult] = await Promise.all([
          notificationService.getNotifications(params),
          notificationService.getStats().catch(() => null),
        ]);

        if (!isMountedRef.current) return;

        setNotifications(listResult.data);
        setTotalCount(listResult.total);
        setTotalPages(listResult.totalPages || 1);
        if (statsResult) setStats(normalizeStats(statsResult));

        setSelectedIds(new Set());
      } catch (error: any) {
        console.error('Failed to fetch notifications:', error);
        if (!isMountedRef.current) return;
        toast.error(
          error?.response?.data?.message || 'Failed to load notifications',
        );
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          setRefetching(false);
        }
      }
    },
    [page, unreadOnly, typeFilter, debouncedSearch, sortBy, sortOrder],
  );

  useEffect(() => {
    void fetchNotifications(loading ? 'initial' : 'refetch');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, unreadOnly, typeFilter, debouncedSearch, sortBy, sortOrder]);

  const unreadInView = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const readInView = useMemo(
    () => notifications.filter((n) => n.isRead).length,
    [notifications],
  );

  const totalUnread = stats?.unread ?? unreadInView;

  const allSelected = useMemo(
    () =>
      notifications.length > 0 &&
      notifications.every((n) => selectedIds.has(n.id)),
    [notifications, selectedIds],
  );

  const someSelected = selectedIds.size > 0 && !allSelected;

  const grouped = useMemo(() => groupByDate(notifications), [notifications]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      setWorkingId(id);
      await notificationService.markAsRead(id);
      if (!isMountedRef.current) return;
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setStats((prev) =>
        prev
          ? {
              ...prev,
              unread: Math.max(0, prev.unread - 1),
              read: prev.read + 1,
            }
          : prev,
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || 'Failed to mark as read',
      );
    } finally {
      if (isMountedRef.current) setWorkingId(null);
    }
  }, []);

  const handleMarkAsUnread = useCallback(async (id: string) => {
    try {
      setWorkingId(id);
      await notificationService.markAsUnread(id);
      if (!isMountedRef.current) return;
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isRead: false, readAt: null } : n,
        ),
      );
      setStats((prev) =>
        prev
          ? {
              ...prev,
              unread: prev.unread + 1,
              read: Math.max(0, prev.read - 1),
            }
          : prev,
      );
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || 'Failed to mark as unread',
      );
    } finally {
      if (isMountedRef.current) setWorkingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      setWorkingId(id);
      await notificationService.deleteNotification(id);
      if (!isMountedRef.current) return;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Notification deleted');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || 'Failed to delete notification',
      );
    } finally {
      if (isMountedRef.current) setWorkingId(null);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    const ok = await confirm({
      title: 'Mark all as read?',
      description:
        'This will mark every unread notification as read. You cannot undo this.',
      tone: 'info',
      confirmLabel: 'Mark all read',
    });
    if (!ok) return;

    try {
      setBulkWorking(true);
      await notificationService.markAllAsRead();
      if (!isMountedRef.current) return;
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: n.readAt ?? new Date().toISOString(),
        })),
      );
      setStats((prev) =>
        prev ? { ...prev, unread: 0, read: prev.total } : prev,
      );
      toast.success('All notifications marked as read');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || 'Failed to mark all as read',
      );
    } finally {
      if (isMountedRef.current) setBulkWorking(false);
    }
  }, [confirm]);

  const handleBulkMarkRead = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      setBulkWorking(true);
      await notificationService.markMultipleAsRead(ids);
      if (!isMountedRef.current) return;
      setNotifications((prev) =>
        prev.map((n) =>
          selectedIds.has(n.id)
            ? {
                ...n,
                isRead: true,
                readAt: n.readAt ?? new Date().toISOString(),
              }
            : n,
        ),
      );
      setStats((prev) =>
        prev
          ? {
              ...prev,
              unread: Math.max(0, prev.unread - ids.length),
              read: prev.read + ids.length,
            }
          : prev,
      );
      setSelectedIds(new Set());
      toast.success(`${ids.length} notifications marked as read`);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || 'Failed to mark selected as read',
      );
    } finally {
      if (isMountedRef.current) setBulkWorking(false);
    }
  }, [selectedIds]);

  const handleBulkMarkUnread = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      setBulkWorking(true);
      await Promise.allSettled(
        ids.map((id) => notificationService.markAsUnread(id)),
      );
      if (!isMountedRef.current) return;
      setNotifications((prev) =>
        prev.map((n) =>
          selectedIds.has(n.id)
            ? { ...n, isRead: false, readAt: null }
            : n,
        ),
      );
      setStats((prev) =>
        prev
          ? {
              ...prev,
              unread: prev.unread + ids.length,
              read: Math.max(0, prev.read - ids.length),
            }
          : prev,
      );
      setSelectedIds(new Set());
      toast.success(`${ids.length} notifications marked as unread`);
    } catch {
      toast.error('Failed to mark selected as unread');
    } finally {
      if (isMountedRef.current) setBulkWorking(false);
    }
  }, [selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const ok = await confirm({
      title: `Delete ${ids.length} notification${ids.length === 1 ? '' : 's'}?`,
      description: 'This action cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    try {
      setBulkWorking(true);
      const results = await Promise.allSettled(
        ids.map((id) => notificationService.deleteNotification(id)),
      );

      if (!isMountedRef.current) return;

      const succeeded = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const failed = results.length - succeeded;

      setNotifications((prev) =>
        prev.filter((n) => !selectedIds.has(n.id)),
      );
      setTotalCount((prev) => Math.max(0, prev - succeeded));
      setSelectedIds(new Set());

      if (failed === 0) {
        toast.success(`${succeeded} notifications deleted`);
      } else {
        toast.warning(
          `${succeeded} deleted, ${failed} failed. Resyncing…`,
        );
        void fetchNotifications('refetch');
      }
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      if (isMountedRef.current) setBulkWorking(false);
    }
  }, [selectedIds, confirm, fetchNotifications]);

  const handleDeleteAll = useCallback(async () => {
    const ok = await confirm({
      title: 'Delete all notifications?',
      description:
        'Every notification will be permanently removed. This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete all',
    });
    if (!ok) return;

    try {
      setBulkWorking(true);
      await notificationService.deleteAllNotifications();
      if (!isMountedRef.current) return;
      setNotifications([]);
      setTotalCount(0);
      setTotalPages(1);
      setPage(1);
      setStats(normalizeStats(null));
      setSelectedIds(new Set());
      toast.success('All notifications deleted');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          'Failed to delete all notifications',
      );
    } finally {
      if (isMountedRef.current) setBulkWorking(false);
    }
  }, [confirm]);

  const handleClearFilters = useCallback(() => {
    setUnreadOnly(false);
    setTypeFilter('ALL');
    setSearchQuery('');
    setPage(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === notifications.length) return new Set();
      return new Set(notifications.map((n) => n.id));
    });
  }, [notifications]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages) return;
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [totalPages],
  );

  const hasActiveFilters =
    unreadOnly || typeFilter !== 'ALL' || searchQuery.trim().length > 0;

  const emptyTitle = hasActiveFilters
    ? unreadOnly && typeFilter !== 'ALL'
      ? `No unread ${getTypeLabel(typeFilter as NotificationType)} notifications`
      : unreadOnly
      ? 'No unread notifications'
      : typeFilter !== 'ALL'
      ? `No ${getTypeLabel(typeFilter as NotificationType)} notifications`
      : 'No notifications match your filters'
    : 'No notifications yet';

  const emptyDescription = hasActiveFilters
    ? 'Try clearing the filters or changing the search.'
    : "When something happens in your store, you'll see it here.";

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-14 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            <div className="lg:col-span-3 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md">
            <Bell className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Notifications
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap items-center gap-2">
              {totalUnread > 0 ? (
                <>
                  <span className="inline-flex items-center gap-1 font-medium text-orange-600 dark:text-orange-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                    </span>
                    {totalUnread} unread
                  </span>
                  {totalCount > 0 && (
                    <span className="text-gray-400 dark:text-gray-500">
                      · {totalCount} total
                    </span>
                  )}
                </>
              ) : (
                <>You're all caught up</>
              )}
              <ConnectionStatusPill
                status={streamStatus}
                onRetry={reconnect}
              />
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/notifications/settings"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Notification settings"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>

          <button
            type="button"
            onClick={() => fetchNotifications('refresh')}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>

          {totalUnread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={bulkWorking}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </button>
          )}

          {totalCount > 0 && (
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={bulkWorking}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete All
            </button>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search notifications…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setPage(1);
              }}
              className="w-3.5 h-3.5 rounded text-orange-500 border-gray-300 dark:border-gray-600 focus:ring-orange-500 bg-white dark:bg-gray-800"
            />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Unread only
            </span>
          </label>

          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split(':') as [
                typeof sortBy,
                typeof sortOrder,
              ];
              setSortBy(by);
              setSortOrder(order);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none text-xs text-gray-700 dark:text-gray-300"
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="priority:desc">Priority (high → low)</option>
            <option value="type:asc">Type (A → Z)</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto custom-scrollbar">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <TypeTab
            active={typeFilter === 'ALL'}
            onClick={() => {
              setTypeFilter('ALL');
              setPage(1);
            }}
            label="All"
            count={stats?.total ?? totalCount}
          />
          {NOTIFICATION_TYPES.map((type) => {
            const count = stats?.byType?.[type];
            return (
              <TypeTab
                key={type}
                active={typeFilter === type}
                onClick={() => {
                  setTypeFilter(type);
                  setPage(1);
                }}
                label={getTypeLabel(type)}
                count={count}
              />
            );
          })}
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Overview
            </h2>
            <div className="space-y-3">
              <StatRow
                icon={Inbox}
                label="Total"
                value={stats?.total ?? totalCount}
                accent="text-gray-600 dark:text-gray-300"
              />
              <StatRow
                icon={Circle}
                label="Unread"
                value={totalUnread}
                accent="text-orange-600 dark:text-orange-400"
                filled
              />
              <StatRow
                icon={CheckCheck}
                label="Read"
                value={stats?.read ?? readInView}
                accent="text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>

          {stats?.byType && Object.keys(stats.byType).length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                By type
              </h2>
              <div className="space-y-2">
                {Object.entries(stats.byType)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([type, count]) => {
                    const meta =
                      NOTIFICATION_TYPE_METADATA[type as NotificationType];
                    if (!meta) return null;
                    const Icon = getTypeIcon(type as NotificationType);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setTypeFilter(type as NotificationType);
                          setPage(1);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                          typeFilter === type
                            ? 'bg-orange-50 dark:bg-orange-950/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br ${meta.accent} text-white shrink-0`}
                        >
                          <Icon className="w-3 h-3" />
                        </span>
                        <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                          {meta.label}
                        </span>
                        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                          {count}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </aside>

        <main className="lg:col-span-3 space-y-3">
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-gray-900 dark:bg-gray-800 text-white shadow-lg"
              >
                <span className="text-sm font-medium px-1">
                  {selectedIds.size} selected
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleBulkMarkRead}
                  disabled={bulkWorking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark read
                </button>
                <button
                  type="button"
                  onClick={handleBulkMarkUnread}
                  disabled={bulkWorking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Circle className="w-3.5 h-3.5" />
                  Mark unread
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkWorking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/10 text-xs font-medium transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {notifications.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded text-orange-500 border-gray-300 dark:border-gray-600 focus:ring-orange-500 bg-white dark:bg-gray-800"
                  aria-label="Select all notifications on this page"
                />
                <span>Select all on page</span>
              </label>
              <span className="flex-1" />
              {refetching && (
                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Updating
                </span>
              )}
              {hasActiveFilters && !refetching && (
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  Filtered view
                </span>
              )}
            </div>
          )}

          {notifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-12 text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/40 mb-4">
                <Inbox className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {emptyTitle}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                {emptyDescription}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
                >
                  <X className="w-4 h-4" />
                  Clear filters
                </button>
              )}
            </motion.div>
          ) : (
            <div
              className={`space-y-5 transition-opacity ${
                refetching ? 'opacity-60' : 'opacity-100'
              }`}
            >
              {grouped.map((bucket) => (
                <section key={bucket.group}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">
                    {bucket.group}
                  </h3>
                  <div className="space-y-2.5">
                    {bucket.items.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        selected={selectedIds.has(notification.id)}
                        working={workingId === notification.id}
                        searchQuery={debouncedSearch}
                        onOpen={() => setDrawerNotification(notification)}
                        onToggleSelect={() =>
                          toggleSelect(notification.id)
                        }
                        onMarkRead={() =>
                          handleMarkAsRead(notification.id)
                        }
                        onMarkUnread={() =>
                          handleMarkAsUnread(notification.id)
                        }
                        onDelete={() => handleDelete(notification.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-6 px-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                Showing{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {(page - 1) * PAGE_SIZE + 1}
                </span>
                –
                <span className="font-medium text-gray-900 dark:text-white">
                  {Math.min(page * PAGE_SIZE, totalCount)}
                </span>{' '}
                of{' '}
                <span className="font-medium text-gray-900 dark:text-white">
                  {totalCount}
                </span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <div className="flex items-center gap-1 px-1">
                  {generatePageNumbers(page, totalPages).map((p, i) =>
                    p === '…' ? (
                      <span
                        key={`gap-${i}`}
                        className="px-1 text-xs text-gray-400"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePageChange(p as number)}
                        className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${
                          p === page
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <NotificationDetailDrawer
        notification={drawerNotification}
        open={Boolean(drawerNotification)}
        onClose={() => setDrawerNotification(null)}
        onMarkRead={handleMarkAsRead}
        onMarkUnread={handleMarkAsUnread}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fbbf24;
          border-radius: 2px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #b45309;
        }
      `}</style>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface NotificationRowProps {
  notification: Notification;
  selected: boolean;
  working: boolean;
  searchQuery: string;
  onOpen: () => void;
  onToggleSelect: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}

function NotificationRow({
  notification,
  selected,
  working,
  searchQuery,
  onOpen,
  onToggleSelect,
  onMarkRead,
  onMarkUnread,
  onDelete,
}: NotificationRowProps) {
  const Icon = getTypeIcon(notification.type);
  const meta = NOTIFICATION_TYPE_METADATA[notification.type];
  const priorityMeta = getPriorityMeta(notification.priority);
  const isUnread = !notification.isRead;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className={`group relative bg-white dark:bg-gray-900 rounded-2xl border shadow-sm transition-all hover:shadow-md cursor-pointer ${
        isUnread
          ? 'border-l-4 border-l-orange-500 border-gray-200 dark:border-gray-800'
          : 'border-gray-200 dark:border-gray-800'
      } ${selected ? 'ring-2 ring-orange-400/50' : ''}`}
      onClick={(e) => {
        // Don't open drawer when clicking interactive children.
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, label')) return;
        onOpen();
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <label
          className="flex items-center pt-0.5 cursor-pointer select-none shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="w-4 h-4 rounded text-orange-500 border-gray-300 dark:border-gray-600 focus:ring-orange-500 bg-white dark:bg-gray-800"
            aria-label={`Select notification: ${notification.title}`}
          />
        </label>

        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${
            meta?.accent ?? 'from-gray-500 to-gray-700'
          } text-white shadow-sm shrink-0`}
        >
          <Icon className="w-4.5 h-4.5" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`font-semibold truncate ${
                isUnread
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {highlight(notification.title, searchQuery)}
            </p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gradient-to-br ${
                meta?.accent ?? 'from-gray-500 to-gray-700'
              } text-white shrink-0`}
            >
              {meta?.label ?? notification.type}
            </span>
            {notification.priority !== 'MEDIUM' && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${priorityMeta.accent} ${priorityMeta.text} shrink-0`}
              >
                {priorityMeta.label}
              </span>
            )}
            {isUnread && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                New
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 break-words line-clamp-2">
            {highlight(notification.message, searchQuery)}
          </p>

          {notification.data &&
            hasPayloadPreview(notification.type) && (
              <PayloadPreview
                type={notification.type}
                data={notification.data}
              />
            )}

          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            <span title={formatFullTimestamp(notification.createdAt)}>
              {formatRelativeTime(notification.createdAt)}
            </span>
            {notification.readAt && (
              <>
                <span>·</span>
                <span
                  title={`Read ${formatFullTimestamp(notification.readAt)}`}
                >
                  Read {formatRelativeTime(notification.readAt)}
                </span>
              </>
            )}
            {notification.link && (
              <>
                <span>·</span>
                <Link
                  href={notification.link}
                  className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open <ExternalLink className="w-3 h-3" />
                </Link>
              </>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isUnread ? (
            <button
              type="button"
              onClick={onMarkRead}
              disabled={working}
              className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
              title="Mark as read"
            >
              {working ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onMarkUnread}
              disabled={working}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="Mark as unread"
            >
              {working ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onDelete}
            disabled={working}
            className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
            title="Delete"
          >
            {working ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function hasPayloadPreview(type: NotificationType): boolean {
  return (
    type === 'LOW_STOCK' ||
    type === 'PURCHASE_ORDER' ||
    type === 'SHIFT' ||
    type === 'SALE'
  );
}

function PayloadPreview({
  type,
  data,
}: {
  type: NotificationType;
  data: Record<string, any>;
}) {
  const chips: Array<{ label: string; value: string }> = [];

  if (type === 'LOW_STOCK') {
    if (data.currentStock !== undefined)
      chips.push({ label: 'Stock', value: String(data.currentStock) });
    if (data.reorderPoint !== undefined)
      chips.push({ label: 'Reorder', value: String(data.reorderPoint) });
    if (data.productName)
      chips.push({ label: 'Product', value: String(data.productName) });
  }

  if (type === 'PURCHASE_ORDER') {
    if (data.poNumber)
      chips.push({ label: 'PO #', value: String(data.poNumber) });
    if (data.supplierName)
      chips.push({ label: 'Supplier', value: String(data.supplierName) });
    if (data.amount !== undefined)
      chips.push({
        label: 'Amount',
        value: `$${Number(data.amount).toFixed(2)}`,
      });
  }

  if (type === 'SHIFT') {
    if (data.action)
      chips.push({ label: 'Action', value: String(data.action) });
    if (data.shiftId)
      chips.push({ label: 'Shift', value: String(data.shiftId).slice(0, 8) });
  }

  if (type === 'SALE') {
    if (data.receiptNumber)
      chips.push({ label: 'Receipt', value: String(data.receiptNumber) });
    if (data.total !== undefined)
      chips.push({
        label: 'Total',
        value: `$${Number(data.total).toFixed(2)}`,
      });
    if (data.customerName)
      chips.push({ label: 'Customer', value: String(data.customerName) });
    if (data.cashierName)
      chips.push({ label: 'Cashier', value: String(data.cashierName) });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-700 dark:text-gray-300"
        >
          <span className="text-gray-400 dark:text-gray-500">
            {chip.label}:
          </span>
          <span className="font-medium tabular-nums">{chip.value}</span>
        </span>
      ))}
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  accent,
  filled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
  filled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        className={`w-3.5 h-3.5 ${accent}`}
        {...(filled ? { fill: 'currentColor' } : {})}
      />
      <span className="flex-1 text-xs text-gray-600 dark:text-gray-400">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${accent}`}>
        {value}
      </span>
    </div>
  );
}

function TypeTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${
            active
              ? 'bg-white/25 text-white'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400'
          }`}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

function generatePageNumbers(
  current: number,
  total: number,
): Array<number | '…'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | '…'> = [1];
  if (current > 3) pages.push('…');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
