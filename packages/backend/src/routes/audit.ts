// D:\Projects\Kalwanga\packages\backend\src\routes\audit.ts

import { Router } from 'express';
import { auditController } from '../controllers/auditController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All audit routes require authentication
router.use(requireAuth);

// ============================================
// GET ROUTES
// ============================================

/**
 * Get audit logs with pagination and filters
 * GET /audit
 */
router.get(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  auditController.getAuditLogs
);

/**
 * Get audit statistics
 * GET /audit/stats
 */
router.get(
  '/stats',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  auditController.getAuditStats
);

/**
 * Get recent audit logs for dashboard
 * GET /audit/recent
 */
router.get(
  '/recent',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  auditController.getRecentAuditLogs
);

/**
 * Get audit logs by entity
 * GET /audit/entity/:entityType/:entityId
 */
router.get(
  '/entity/:entityType/:entityId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  auditController.getAuditLogsByEntity
);

/**
 * Export audit logs
 * GET /audit/export
 */
router.get(
  '/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  auditController.exportAuditLogs
);

/**
 * Get single audit log entry
 * GET /audit/:id
 */
router.get(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  auditController.getAuditLogById
);

// ============================================
// POST ROUTES
// ============================================

/**
 * Create audit log entry (internal)
 * POST /audit
 */
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  auditController.createAuditLog
);

export default router;
