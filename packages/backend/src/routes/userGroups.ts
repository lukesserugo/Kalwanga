// D:\Projects\Kalwanga\packages\backend\src\routes\userGroups.ts

import { Router } from 'express';
import { userGroupController } from '../controllers/userGroupController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// ============================================
// USER GROUP ROUTES
// ============================================

// ============================================
// GET ROUTES (Authenticated users)
// ============================================

// Get all groups with filtering (Authenticated users)
router.get(
  '/',
  requireAuth,
  userGroupController.getGroups
);

// Get group statistics (Authenticated users)
router.get(
  '/stats',
  requireAuth,
  userGroupController.getGroupStats
);

// Get group by ID (Authenticated users)
router.get(
  '/:id',
  requireAuth,
  userGroupController.getGroupById
);

// Get group members (Authenticated users)
router.get(
  '/:id/members',
  requireAuth,
  userGroupController.getGroupMembers
);

// ============================================
// POST ROUTES (Admin/SuperAdmin only)
// ============================================

// Create a new group (Admin/SuperAdmin only)
router.post(
  '/',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userGroupController.createGroup
);

// Assign users to group (Admin/SuperAdmin only)
router.post(
  '/:id/users',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userGroupController.assignUsersToGroup
);

// ============================================
// PUT ROUTES (Admin/SuperAdmin only)
// ============================================

// Update group (Admin/SuperAdmin only)
router.put(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userGroupController.updateGroup
);

// Update group permissions (Admin/SuperAdmin only)
router.put(
  '/:id/permissions',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userGroupController.updateGroupPermissions
);

// ============================================
// DELETE ROUTES (Admin/SuperAdmin only)
// ============================================

// Delete group (Admin/SuperAdmin only)
router.delete(
  '/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userGroupController.deleteGroup
);

// Remove users from group (Admin/SuperAdmin only)
router.delete(
  '/:id/remove-users',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userGroupController.removeUsersFromGroup
);

export default router;
