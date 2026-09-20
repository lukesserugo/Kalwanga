// D:\Projects\Kalwanga\packages\backend\src\routes\notifications.ts

import { Router } from 'express';
import { notificationController } from '../controllers/notificationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

// ============================================================
// ROUTE ORDERING
// ============================================================
//
// Express matches in declaration order. Any literal-prefixed route
// (`/stats`, `/unread-count`, `/preferences`, `/templates`, …) must
// come BEFORE the parameterized `/:id` routes, or it will be captured
// as an id and the literal handler will never run.
//
// The same applies to sub-paths like `/:id/read` — those capture the
// first segment as an id, so they must come after every route whose
// first segment is a literal.

// ============================================
// COLLECTION-LEVEL GETS (literal prefixes)
// ============================================

/**
 * Get notifications with pagination and filtering
 * GET /notifications
 * Query params: page, limit, unreadOnly, type, search
 */
router.get('/', notificationController.getNotifications);

/**
 * Get notification statistics
 * GET /notifications/stats
 * Returns: total, unread, read, byType
 */
router.get('/stats', notificationController.getStats);

/**
 * Get detailed statistics with trends
 * GET /notifications/stats/detailed
 * Returns: total, unread, byType, byPriority, trend.daily/weekly/monthly
 */
router.get('/stats/detailed', notificationController.getDetailedStats);

/**
 * Get unread count
 * GET /notifications/unread-count
 * Returns: { count: number }
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * Get count by type
 * GET /notifications/count-by-type
 * Returns: Record<string, number>
 */
router.get('/count-by-type', notificationController.getCountByType);

/**
 * Get count by priority
 * GET /notifications/count-by-priority
 * Returns: Record<string, number>
 */
router.get('/count-by-priority', notificationController.getCountByPriority);

// ============================================
// PREFERENCES (literal prefix — must be before /:id)
// ============================================

/**
 * Get notification preferences
 * GET /notifications/preferences
 */
router.get('/preferences', notificationController.getPreferences);

/**
 * Update notification preferences
 * PUT /notifications/preferences
 * Body: { email?, push?, inApp?, types? }
 */
router.put('/preferences', notificationController.updatePreferences);

/**
 * Reset notification preferences to defaults
 * POST /notifications/preferences/reset
 */
router.post('/preferences/reset', notificationController.resetPreferences);

// ============================================
// TEMPLATES (literal prefix — must be before /:id)
// ============================================

/**
 * Get notification templates
 * GET /notifications/templates
 */
router.get('/templates', notificationController.getTemplates);

/**
 * Render a template with variables
 * POST /notifications/templates/render
 * Body: { templateId, variables }
 *
 * Declared before /templates/:id so "render" isn't captured as an id.
 */
router.post(
  '/templates/render',
  notificationController.renderTemplate,
);

/**
 * Get notification template by ID
 * GET /notifications/templates/:id
 */
router.get('/templates/:id', notificationController.getTemplateById);

/**
 * Create notification template
 * POST /notifications/templates
 * Access: ADMIN or SUPER_ADMIN only
 */
router.post(
  '/templates',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.createTemplate,
);

/**
 * Update notification template
 * PUT /notifications/templates/:id
 * Access: ADMIN or SUPER_ADMIN only
 */
router.put(
  '/templates/:id',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.updateTemplate,
);

/**
 * Delete notification template
 * DELETE /notifications/templates/:id
 * Access: ADMIN or SUPER_ADMIN only
 */
router.delete(
  '/templates/:id',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.deleteTemplate,
);

// ============================================
// BULK OPERATIONS (literal prefix — must be before /:id)
// ============================================

/**
 * Mark multiple notifications as read
 * PUT /notifications/mark-read
 * Body: { ids: string[] }
 */
router.put('/mark-read', notificationController.markMultipleAsRead);

/**
 * Mark all notifications as read
 * PUT /notifications/read-all
 */
router.put('/read-all', notificationController.markAllAsRead);

/**
 * Delete all read notifications
 * DELETE /notifications/read
 *
 * Declared before /:id so "read" isn't captured as an id.
 */
router.delete('/read', notificationController.deleteReadNotifications);

/**
 * Bulk create notifications
 * POST /notifications/bulk
 * Access: ADMIN or SUPER_ADMIN only
 * Body: { notifications: Array<{ title, message, type, userId?, link?, data? }> }
 */
router.post(
  '/bulk',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.bulkCreateNotifications,
);

// ============================================
// STREAM (literal prefix — must be before /:id)
// ============================================

/**
 * Real-time notification stream (SSE)
 * GET /notifications/stream
 * Returns: Server-Sent Events stream
 */
router.get('/stream', notificationController.notificationStream);

// ============================================
// ADMIN / SYSTEM OPERATIONS (literal prefixes)
// ============================================

/**
 * Create a new notification
 * POST /notifications
 * Access: ADMIN or SUPER_ADMIN only
 * Body: { title, message, type, userId?, link?, data?, priority? }
 */
router.post(
  '/',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.createNotification,
);

/**
 * Send a notification (legacy alias for POST /)
 * POST /notifications/send
 * Access: ADMIN or SUPER_ADMIN only
 *
 * Kept because the client's notificationService may still call it.
 * If you want to drop it, remove this block and search the client
 * for `/notifications/send`.
 */
router.post(
  '/send',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.sendNotification,
);

/**
 * Send low stock alert
 * POST /notifications/low-stock
 * Access: ADMIN or SUPER_ADMIN only
 *
 * The service also calls this internally via sendLowStockAlert().
 * The HTTP endpoint exists for admin-triggered manual alerts.
 */
router.post(
  '/low-stock',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.sendLowStockAlert,
);

/**
 * Send sale notification
 * POST /notifications/sale
 * Access: ADMIN or SUPER_ADMIN only
 */
router.post(
  '/sale',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.sendSaleNotification,
);

/**
 * Process notification queue
 * POST /notifications/process-queue
 * Access: SUPER_ADMIN only
 */
router.post(
  '/process-queue',
  requireRole(['SUPER_ADMIN']),
  notificationController.processQueue,
);

/**
 * Clean expired notifications
 * POST /notifications/clean
 * Access: SUPER_ADMIN only
 *
 * The Notification model has no expiresAt column, so this is a
 * no-op that returns { count: 0 }. Kept for API compatibility.
 */
router.post(
  '/clean',
  requireRole(['SUPER_ADMIN']),
  notificationController.cleanExpired,
);

/**
 * Archive old notifications
 * POST /notifications/archive
 * Access: SUPER_ADMIN only
 * Body: { daysOld?: number }  (default 90)
 */
router.post(
  '/archive',
  requireRole(['SUPER_ADMIN']),
  notificationController.archiveOld,
);

// ============================================
// PARAMETERIZED ROUTES (must be LAST)
// ============================================
//
// Every route below captures the first segment as `:id`. Anything
// declared after this point with a literal first segment will never
// be reached.

/**
 * Mark notification as unread
 * PUT /notifications/:id/unread
 *
 * Declared before /:id/read so the more specific pattern wins.
 */
router.put('/:id/unread', notificationController.markAsUnread);

/**
 * Mark notification as read
 * PUT /notifications/:id/read
 */
router.put('/:id/read', notificationController.markAsRead);

/**
 * Get notification by ID
 * GET /notifications/:id
 */
router.get('/:id', notificationController.getNotificationById);

/**
 * Delete notification
 * DELETE /notifications/:id
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * Delete all notifications for the current user
 * DELETE /notifications
 *
 * Declared after /:id so a bare DELETE / falls through to this
 * handler rather than being captured as an id.
 */
router.delete('/', notificationController.deleteAllNotifications);

export default router;
