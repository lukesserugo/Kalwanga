// D:\Projects\Kalwanga\packages\backend\src\routes\auth.ts

import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

// ============================================
// PUBLIC ROUTES — no authentication required
// ============================================

// Authentication
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);

// Password management
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Email verification
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// 2FA (public endpoints)
router.post('/verify-2fa', authController.verify2FA);

// ============================================
// PERMISSION CATALOGUE
// ============================================
//
// GET /permissions is intentionally public. It returns the catalogue
// and role map so the UI can render permission pickers before login.
// If the caller is authenticated, it also includes their resolved set.
//
// POST /check requires auth: it answers "does the current user have
// each of these permissions?" using the same resolver the middleware
// uses.

router.get('/permissions', authController.getPermissions);
router.post('/check', requireAuth, authController.checkPermissions);

// ============================================
// PROTECTED ROUTES — authentication required
// ============================================

// User profile
router.get('/me', requireAuth, authController.getCurrentUser);
router.post('/logout', requireAuth, authController.logout);

// Password change
router.post('/change-password', requireAuth, authController.changePassword);

// 2FA setup
router.post('/setup-2fa', requireAuth, authController.setup2FA);

// Sessions
router.get('/sessions', requireAuth, authController.getSessions);
router.delete(
  '/sessions/:sessionId',
  requireAuth,
  authController.revokeSession
);

// ============================================
// CLERK USER SYNC
// ============================================
//
// POST /sync idempotently provisions the local `User` row for the
// currently-authenticated Clerk user.
//
// Protected by requireAuth — the backend reads the Clerk identity
// from the verified JWT. The body may carry optional overrides
// (email, firstName, lastName, avatar) that fill in claims the JWT
// happens to omit. The controller merges JWT + body and delegates
// to authService.syncClerkUser().
//
// Behaviour:
//   • Match by clerkId       → refresh mutable profile fields.
//   • Match by email         → adopt + rebind clerkId (preserves role).
//   • No match               → create a new row.
//
// Safe to call on every login. Idempotent.

router.post('/sync', requireAuth, authController.syncClerkUser);

// ============================================
// ADMIN ROUTES — permission-gated
// ============================================

// User management
router.get(
  '/users',
  requireAuth,
  requirePermission('user:view'),
  authController.getAllUsers
);
router.get(
  '/users/:userId',
  requireAuth,
  requirePermission('user:view'),
  authController.getUserById
);
router.put(
  '/users/:userId',
  requireAuth,
  requirePermission('user:edit'),
  authController.updateUser
);
router.patch(
  '/users/:userId/role',
  requireAuth,
  requirePermission('user:role:update'),
  authController.updateUserRole
);
router.delete(
  '/users/:userId',
  requireAuth,
  requirePermission('user:delete'),
  authController.deleteUser
);

// User activation / deactivation
router.post(
  '/activate/:userId',
  requireAuth,
  requirePermission('user:activate'),
  authController.activateUser
);
router.post(
  '/deactivate/:userId',
  requireAuth,
  requirePermission('user:deactivate'),
  authController.deactivateUser
);

// ============================================
// SUPER ADMIN CREATION
// ============================================

router.post(
  '/create-superadmin',
  requireAuth,
  authController.createSuperAdmin
);

export default router;
