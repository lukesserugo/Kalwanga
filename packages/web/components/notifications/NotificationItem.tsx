// D:\Projects\Kalwanga\packages\web\components\notifications\NotificationItem.tsx

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell,
  Check,
  Trash2,
  Loader2,
  Circle,
  ExternalLink,
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
} from 'lucide-react';

import type {
  Notification,
  NotificationPriority,
  NotificationType,
} from '../../types/notification';
import {
  NOTIFICATION_TYPE_METADATA,
  NOTIFICATION_PRIORITY_METADATA,
} from '../../types/notification';

// ============================================
// ICON MAP
// ============================================

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

// ============================================
// HELPERS
// ============================================

export function getNotificationIcon(
  type: NotificationType,
): React.ComponentType<{ className?: string }> {
  const metadata = NOTIFICATION_TYPE_METADATA[type];
  const key = metadata?.iconKey ?? 'bell';
  return ICON_MAP[key] ?? Bell;
}

export function getPriorityMeta(priority: NotificationPriority) {
  return (
    NOTIFICATION_PRIORITY_METADATA[priority] ?? {
      label: 'Medium',
      accent: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-300',
    }
  );
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
      chips.push({
        label: 'Shift',
        value: String(data.shiftId).slice(0, 8),
      });
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

// ============================================
// COMPONENT
// ============================================

export interface NotificationItemProps {
  notification: Notification;
  selected?: boolean;
  working?: boolean;
  searchQuery?: string;
  selectable?: boolean;
  showPayload?: boolean;
  onOpen?: () => void;
  onToggleSelect?: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function NotificationItem({
  notification,
  selected = false,
  working = false,
  searchQuery = '',
  selectable = true,
  showPayload = true,
  onOpen,
  onToggleSelect,
  onMarkRead,
  onMarkUnread,
  onDelete,
  className = '',
}: NotificationItemProps) {
  const Icon = getNotificationIcon(notification.type);
  const meta = NOTIFICATION_TYPE_METADATA[notification.type];
  const priorityMeta = getPriorityMeta(notification.priority);
  const isUnread = !notification.isRead;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a, label, select, textarea')) {
      return;
    }
    onOpen?.();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      onClick={handleClick}
      className={`group relative bg-white dark:bg-gray-900 rounded-2xl border shadow-sm transition-all hover:shadow-md ${
        onOpen ? 'cursor-pointer' : ''
      } ${
        isUnread
          ? 'border-l-4 border-l-orange-500 border-gray-200 dark:border-gray-800'
          : 'border-gray-200 dark:border-gray-800'
      } ${selected ? 'ring-2 ring-orange-400/50' : ''} ${className}`}
    >
      <div className="flex items-start gap-3 p-4">
        {selectable && (
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
        )}

        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br ${
            meta?.accent ?? 'from-gray-500 to-gray-700'
          } text-white shadow-sm shrink-0`}
        >
          <Icon className="w-4 h-4" />
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

          {showPayload &&
            notification.data &&
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

        {(onMarkRead || onMarkUnread || onDelete) && (
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {onMarkRead &&
              onMarkUnread &&
              (isUnread ? (
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
              ))}

            {onDelete && (
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
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default NotificationItem;
