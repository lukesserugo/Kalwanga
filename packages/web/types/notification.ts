// D:\Projects\Kalwanga\packages\web\types\notification.ts

// ============================================
// CANONICAL ENUMS
// ============================================
//
// These string unions mirror the backend's Prisma enums exactly.
// Every notification that flows through the API will have one of
// these values for `type` and one of the four for `priority`.
//
// When the backend enum changes, this list must change too. The
// runtime arrays (`NOTIFICATION_TYPES`, `NOTIFICATION_PRIORITIES`)
// are exported so UI code can iterate without hardcoding.

export type NotificationType =
  | 'SALE'
  | 'INVENTORY'
  | 'ORDER'
  | 'PAYMENT'
  | 'CUSTOMER'
  | 'SYSTEM'
  | 'ALERT'
  | 'SUCCESS'
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'PROMOTION'
  | 'REMINDER'
  | 'LOW_STOCK'
  | 'PURCHASE_ORDER'
  | 'SHIFT'
  | 'RECEIPT';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';

export const NOTIFICATION_TYPES: NotificationType[] = [
  'SALE',
  'INVENTORY',
  'ORDER',
  'PAYMENT',
  'CUSTOMER',
  'SYSTEM',
  'ALERT',
  'SUCCESS',
  'INFO',
  'WARNING',
  'ERROR',
  'PROMOTION',
  'REMINDER',
  'LOW_STOCK',
  'PURCHASE_ORDER',
  'SHIFT',
  'RECEIPT',
];

export const NOTIFICATION_PRIORITIES: NotificationPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  'EMAIL',
  'SMS',
  'PUSH',
  'IN_APP',
];

// ============================================
// NOTIFICATION
// ============================================
//
// The full row shape as returned by the backend controller. Every
// column on the Prisma `Notification` model that the controller
// serializes is declared here, so consumers can rely on any of them
// without a cast.

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
  readAt?: string | null;
  link?: string | null;
  data?: Record<string, any> | null;
  userId: string;
  businessUnitId?: string | null;
  companyId?: string | null;
}

/**
 * Input shape for creating a notification. Mirrors the body the
 * `POST /notifications` endpoint accepts. Everything except
 * `title`, `message`, and `type` is optional.
 */
export interface CreateNotificationInput {
  title: string;
  message: string;
  type: NotificationType | string;
  priority?: NotificationPriority;
  link?: string | null;
  data?: Record<string, any> | null;
  userId?: string;
  businessUnitId?: string;
  companyId?: string;
}

/**
 * Partial update shape. Only used by the admin-only update path.
 */
export interface UpdateNotificationInput {
  title?: string;
  message?: string;
  type?: NotificationType | string;
  priority?: NotificationPriority;
  isRead?: boolean;
}

// ============================================
// NOTIFICATION PREFERENCE
// ============================================
//
// The backend keeps preferences in memory using explicit per-type
// flags, not a generic `(type, enabled)` row. This interface matches
// the object the service reads in `shouldSendNotification` and
// returns from `GET /notifications/preferences`.
//
// The legacy per-type interface is also exported as
// `NotificationPreferenceRow` for consumers that were built against
// the old shape — see the deprecation note below.

export interface NotificationPreference {
  userId?: string;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  lowStockAlerts?: boolean;
  saleAlerts?: boolean;
  purchaseOrderAlerts?: boolean;
  shiftAlerts?: boolean;
  systemAlerts?: boolean;
  promotionalAlerts?: boolean;
  reminderAlerts?: boolean;
  receiptAlerts?: boolean;
  emailFrequency?: 'immediate' | 'daily' | 'weekly' | 'never';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * @deprecated Use `NotificationPreference` instead.
 *
 * The old interface described a per-`(user, type)` row model that the
 * backend never implemented. It's kept as an alias so existing imports
 * don't break — but any component still typed against it should be
 * migrated to the flag-based `NotificationPreference` shape.
 */
export type NotificationPreferenceRow = {
  id: string;
  userId: string;
  type: string;
  enabled: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
};

// ============================================
// NOTIFICATION TEMPLATE
// ============================================
//
// Template shape as returned by `GET /notifications/templates`.
// Backed by an in-memory cache on the server; not a Prisma model.
// The `type` field is a NotificationType, not an arbitrary string.

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: NotificationType;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input shape for creating a template. Mirrors what
 * `POST /notifications/templates` accepts.
 */
export interface CreateNotificationTemplateInput {
  name: string;
  subject: string;
  body: string;
  type: NotificationType | string;
  variables?: string[];
  isActive?: boolean;
}

/**
 * Partial update shape for `PUT /notifications/templates/:id`.
 */
export type UpdateNotificationTemplateInput = Partial<
  CreateNotificationTemplateInput
>;

// ============================================
// NOTIFICATION GROUP
// ============================================
//
// The backend has no Group model. This interface is preserved for
// callers that reference it — but no endpoint returns this shape.
// If you don't use it, it can be removed.

export interface NotificationGroup {
  id: string;
  name: string;
  description?: string;
  notifications: Notification[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// NOTIFICATION STATS
// ============================================
//
// The `GET /notifications/stats` response. The `byDate` field is
// populated by the `/stats/detailed` endpoint, not the basic one —
// the basic one omits it. Both shapes are declared so callers can
// tell them apart.

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
  byDate: Array<{ date: string; count: number }>;
}

/**
 * The shape returned by `GET /notifications/stats/detailed`. Includes
 * a per-priority breakdown, per-channel breakdown, recent activity,
 * and three trend series.
 */
export interface DetailedNotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Array<{ type: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byChannel: Array<{ channel: string; count: number }>;
  recent: Notification[];
  trend: {
    daily: Array<{ date: string; count: number }>;
    weekly: Array<{ week: string; count: number }>;
    monthly: Array<{ month: string; count: number }>;
  };
}

// ============================================
// PAGINATED RESPONSE
// ============================================
//
// Generic pagination envelope returned by list endpoints. Includes
// an optional `unreadCount` that the notifications list endpoint
// attaches.

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  unreadCount?: number;
}

// ============================================
// NOTIFICATION PREFERENCES
// ============================================

export type EmailFrequency = 'immediate' | 'daily' | 'weekly' | 'never';

export interface NotificationPreferences {
  userId?: string;

  // Channels
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;

  // Alert types
  lowStockAlerts: boolean;
  saleAlerts: boolean;
  purchaseOrderAlerts: boolean;
  shiftAlerts: boolean;
  systemAlerts: boolean;
  promotionalAlerts: boolean;
  reminderAlerts: boolean;
  receiptAlerts: boolean;

  // Timing
  emailFrequency: EmailFrequency;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationPreferencesUpdate {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  lowStockAlerts?: boolean;
  saleAlerts?: boolean;
  purchaseOrderAlerts?: boolean;
  shiftAlerts?: boolean;
  systemAlerts?: boolean;
  promotionalAlerts?: boolean;
  reminderAlerts?: boolean;
  receiptAlerts?: boolean;
  emailFrequency?: EmailFrequency;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

// Which per-channel toggles apply to each alert type.
// In-App and Email are the two channels operators typically
// configure per-type. SMS and Push are controlled globally
// (see PreferencesChannels) since most users enable/disable
// them wholesale.
export interface AlertTypeMeta {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  iconKey: string;
}

export const ALERT_TYPE_METADATA: AlertTypeMeta[] = [
  {
    key: 'saleAlerts',
    label: 'Sales',
    description: 'New sales completed in your business unit',
    iconKey: 'shopping-cart',
  },
  {
    key: 'lowStockAlerts',
    label: 'Low Stock',
    description: 'Products at or below reorder point',
    iconKey: 'package',
  },
  {
    key: 'purchaseOrderAlerts',
    label: 'Purchase Orders',
    description: 'POs created, approved, or received',
    iconKey: 'clipboard-list',
  },
  {
    key: 'shiftAlerts',
    label: 'Shifts',
    description: 'Shift start, end, and cash discrepancies',
    iconKey: 'clock',
  },
  {
    key: 'systemAlerts',
    label: 'System',
    description: 'Account, security, and platform events',
    iconKey: 'settings',
  },
  {
    key: 'promotionalAlerts',
    label: 'Promotions',
    description: 'Marketing and promotion updates',
    iconKey: 'sparkles',
  },
  {
    key: 'reminderAlerts',
    label: 'Reminders',
    description: 'Scheduled reminders and follow-ups',
    iconKey: 'bell',
  },
  {
    key: 'receiptAlerts',
    label: 'Receipts',
    description: 'Receipts sent or printed',
    iconKey: 'receipt',
  },
];

// ============================================
// TYPE GUARDS
// ============================================
//
// Small helpers for narrowing at runtime. Useful when a response
// comes back as `unknown` and needs to be checked before use.

export function isNotificationType(
  value: unknown,
): value is NotificationType {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_TYPES as string[]).includes(value)
  );
}

export function isNotificationPriority(
  value: unknown,
): value is NotificationPriority {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_PRIORITIES as string[]).includes(value)
  );
}

export function isNotificationChannel(
  value: unknown,
): value is NotificationChannel {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_CHANNELS as string[]).includes(value)
  );
}

// ============================================
// UI METADATA
// ============================================
//
// Default presentation metadata for each notification type. Kept
// here so every component that renders a notification icon or label
// uses the same mapping. The `icon` value is a string key — the
// consumer maps it to the actual icon component from its own icon
// library, avoiding a hard dependency here.

export interface NotificationTypeMetadata {
  label: string;
  iconKey: string;
  accent: string;
}

export const NOTIFICATION_TYPE_METADATA: Record<
  NotificationType,
  NotificationTypeMetadata
> = {
  SALE: {
    label: 'Sale',
    iconKey: 'shopping-cart',
    accent: 'from-emerald-500 to-green-600',
  },
  INVENTORY: {
    label: 'Inventory',
    iconKey: 'package',
    accent: 'from-blue-500 to-sky-600',
  },
  ORDER: {
    label: 'Order',
    iconKey: 'clipboard-list',
    accent: 'from-orange-500 to-amber-600',
  },
  PAYMENT: {
    label: 'Payment',
    iconKey: 'credit-card',
    accent: 'from-indigo-500 to-violet-600',
  },
  CUSTOMER: {
    label: 'Customer',
    iconKey: 'user',
    accent: 'from-pink-500 to-rose-600',
  },
  SYSTEM: {
    label: 'System',
    iconKey: 'settings',
    accent: 'from-slate-500 to-gray-700',
  },
  ALERT: {
    label: 'Alert',
    iconKey: 'alert-triangle',
    accent: 'from-red-500 to-rose-600',
  },
  SUCCESS: {
    label: 'Success',
    iconKey: 'check-circle',
    accent: 'from-emerald-500 to-green-600',
  },
  INFO: {
    label: 'Info',
    iconKey: 'info',
    accent: 'from-blue-500 to-sky-600',
  },
  WARNING: {
    label: 'Warning',
    iconKey: 'alert-circle',
    accent: 'from-yellow-500 to-amber-600',
  },
  ERROR: {
    label: 'Error',
    iconKey: 'x-circle',
    accent: 'from-red-500 to-rose-600',
  },
  PROMOTION: {
    label: 'Promotion',
    iconKey: 'sparkles',
    accent: 'from-purple-500 to-fuchsia-600',
  },
  REMINDER: {
    label: 'Reminder',
    iconKey: 'bell',
    accent: 'from-amber-500 to-orange-600',
  },
  LOW_STOCK: {
    label: 'Low Stock',
    iconKey: 'package',
    accent: 'from-yellow-500 to-orange-600',
  },
  PURCHASE_ORDER: {
    label: 'Purchase Order',
    iconKey: 'truck',
    accent: 'from-cyan-500 to-teal-600',
  },
  SHIFT: {
    label: 'Shift',
    iconKey: 'clock',
    accent: 'from-teal-500 to-cyan-600',
  },
  RECEIPT: {
    label: 'Receipt',
    iconKey: 'receipt',
    accent: 'from-slate-500 to-gray-700',
  },
};

// ============================================
// PRIORITY METADATA
// ============================================

export interface NotificationPriorityMetadata {
  label: string;
  accent: string;
  text: string;
}

export const NOTIFICATION_PRIORITY_METADATA: Record<
  NotificationPriority,
  NotificationPriorityMetadata
> = {
  LOW: {
    label: 'Low',
    accent: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  MEDIUM: {
    label: 'Medium',
    accent: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  HIGH: {
    label: 'High',
    accent: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
  },
  URGENT: {
    label: 'Urgent',
    accent: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
};

// ============================================
// WEBSOCKET / SSE EVENT PAYLOAD
// ============================================
//
// The `GET /notifications/stream` endpoint emits two event shapes:
// a connection acknowledgment and a notification delivery. Both are
// declared here so the client handler can narrow safely.

export interface NotificationStreamConnected {
  type: 'connected';
  userId: string;
}

export interface NotificationStreamDelivery {
  type: 'notification';
  data: Notification;
}

export type NotificationStreamEvent =
  | NotificationStreamConnected
  | NotificationStreamDelivery;
