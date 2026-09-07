// D:\Projects\Kalwanga\packages\backend\src\routes\userActivity.ts

import { Router } from 'express';
import { userActivityController } from '../controllers/userActivityController.js';
import { userActivityService } from '../services/userActivityService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ============================================
// ACTIVITY CRUD ROUTES
// ============================================

// Create a new activity (Authenticated)
router.post(
  '/activities',
  requireAuth,
  userActivityController.createActivity
);

// Create multiple activities (Authenticated)
router.post(
  '/activities/batch',
  requireAuth,
  userActivityController.createActivitiesBatch
);

// Get all activities (Admin/SuperAdmin)
router.get(
  '/activities',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userActivityController.getActivities
);

// Get activity statistics (Admin/SuperAdmin)
router.get(
  '/activities/stats',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userActivityController.getActivityStats
);

// Get activity by ID (Authenticated)
router.get(
  '/activities/:id',
  requireAuth,
  userActivityController.getActivityById
);

// Update activity (Admin/SuperAdmin)
router.put(
  '/activities/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userActivityController.updateActivity
);

// Delete activity (Admin/SuperAdmin)
router.delete(
  '/activities/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userActivityController.deleteActivity
);

// Clear activities (Admin/SuperAdmin)
router.delete(
  '/activities',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userActivityController.clearActivities
);

export default router;
