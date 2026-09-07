// D:\Projects\Kalwanga\packages\backend\src\routes\auth.ts

import { Router } from 'express';
import { authController } from '../controllers/authController.js';

const router = Router();

// ============================================
// PUBLIC ROUTES - No authentication required
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
// PROTECTED ROUTES - Authentication required
// ============================================

// User profile
router.get('/me', authController.getCurrentUser);
router.post('/logout', authController.logout);

// Password change
router.post('/change-password', authController.changePassword);

// 2FA setup
router.post('/setup-2fa', authController.setup2FA);

// Sessions
router.get('/sessions', authController.getSessions);
router.delete('/sessions/:sessionId', authController.revokeSession);

// ============================================
// ADMIN ROUTES - Admin/SuperAdmin only
// ============================================

// User management
router.get('/users', authController.getAllUsers);
router.get('/users/:userId', authController.getUserById);
router.put('/users/:userId', authController.updateUser);
router.patch('/users/:userId/role', authController.updateUserRole);
router.delete('/users/:userId', authController.deleteUser);

// User activation/deactivation
router.post('/activate/:userId', authController.activateUser);
router.post('/deactivate/:userId', authController.deactivateUser);

export default router;
