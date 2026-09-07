import { Router } from 'express';
import { notificationController } from '../controllers/notificationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

// ============================================
// NOTIFICATION ENDPOINTS
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
 * Get unread count
 * GET /notifications/unread-count
 * Returns: { count: number }
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * Get notification by ID
 * GET /notifications/:id
 */
router.get('/:id', notificationController.getNotificationById);

/**
 * Mark notification as read
 * PUT /notifications/:id/read
 */
router.put('/:id/read', notificationController.markAsRead);

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
 * Delete notification
 * DELETE /notifications/:id
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * Delete all notifications
 * DELETE /notifications
 * Access: Requires authentication
 */
router.delete('/', notificationController.deleteAllNotifications);

/**
 * Create a new notification (for system use)
 * POST /notifications
 * Access: ADMIN or SUPER_ADMIN only
 * Body: { title, message, type, userId?, link?, data? }
 */
router.post(
  '/',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.createNotification
);

/**
 * Bulk create notifications
 * POST /notifications/bulk
 * Access: ADMIN or SUPER_ADMIN only
 * Body: { notifications: Array<{ title, message, type, userId?, link?, data? }> }
 */
router.post(
  '/bulk',
  requireRole(['ADMIN', 'SUPER_ADMIN']),
  notificationController.bulkCreateNotifications
);

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
 * Real-time notification stream (SSE)
 * GET /notifications/stream
 * Returns: Server-Sent Events stream
 */
router.get('/stream', notificationController.notificationStream);

export default router;
