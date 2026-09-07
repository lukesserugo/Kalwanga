// D:\Projects\Kalwanga\packages\backend\src\routes\userInvitations.ts

import { Router } from 'express';
import { userInvitationController } from '../controllers/userInvitationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Get invitation by token (public)
router.get(
  '/users/invite/token/:token',
  userInvitationController.getInvitationByToken
);

// Accept invitation (public)
router.post(
  '/users/invite/accept/:token',
  userInvitationController.acceptInvitation
);

// Decline invitation (public)
router.post(
  '/users/invite/decline/:token',
  userInvitationController.declineInvitation
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Get invitation by ID (Authenticated)
router.get(
  '/users/invite/:id',
  requireAuth,
  userInvitationController.getInvitationById
);

// Get invitation templates (Authenticated)
router.get(
  '/users/invite/templates',
  requireAuth,
  userInvitationController.getInvitationTemplates
);

// ============================================
// ADMIN/SUPERADMIN ROUTES
// ============================================

// Invite a single user (Admin/SuperAdmin)
router.post(
  '/users/invite',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.inviteUser
);

// Invite multiple users (Admin/SuperAdmin)
router.post(
  '/users/invite/batch',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.inviteUsers
);

// Resend invitation (Admin/SuperAdmin)
router.post(
  '/users/invite/:id/resend',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.resendInvitation
);

// Cancel invitation (Admin/SuperAdmin)
router.post(
  '/users/invite/:id/cancel',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.cancelInvitation
);

// Get all invitations (Admin/SuperAdmin)
router.get(
  '/users/invitations',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.getInvitations
);

// Get invitation statistics (Admin/SuperAdmin)
router.get(
  '/users/invitations/stats',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.getInvitationStats
);

// Create invitation template (Admin/SuperAdmin)
router.post(
  '/users/invite/templates',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.createInvitationTemplate
);

// Update invitation template (Admin/SuperAdmin)
router.put(
  '/users/invite/templates/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.updateInvitationTemplate
);

// Delete invitation template (Admin/SuperAdmin)
router.delete(
  '/users/invite/templates/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.deleteInvitationTemplate
);

// Delete invitation (Admin/SuperAdmin)
router.delete(
  '/users/invite/:id',
  requireAuth,
  requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  userInvitationController.deleteInvitation
);

// ============================================
// SUPERADMIN ONLY ROUTES
// ============================================

// Clear expired invitations (SuperAdmin only)
router.delete(
  '/users/invitations/expired',
  requireAuth,
  requireRole([UserRole.SUPER_ADMIN]),
  userInvitationController.clearExpiredInvitations
);

export default router;
