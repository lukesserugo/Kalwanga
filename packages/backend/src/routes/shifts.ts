// D:\Projects\Kalwanga\packages\backend\src\routes\shifts.ts

import { Router } from 'express';
import { shiftController } from '../controllers/shiftController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
// Fix: Import UserRole from the correct path
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All shift routes require authentication
router.use(requireAuth);

// ============================================
// GET endpoints - Shift Retrieval
// ============================================

// Get all shifts with pagination and filters
router.get('/', shiftController.getAllShifts);

// Get shift by ID
router.get('/:id', shiftController.getShiftById);

// Get shift summary by ID
router.get('/:id/summary', shiftController.getShiftSummary);

// Get current shift by cash register
router.get('/current/:cashRegisterId', shiftController.getCurrentShift);

// Get shift statistics
router.get('/stats', shiftController.getShiftStats);

// ============================================
// POST endpoints - Shift Management
// ============================================

// Start a new shift
router.post(
  '/start',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  shiftController.startShift
);

// End a shift
router.post(
  '/:id/end',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  shiftController.endShift
);

// Add cash to register
router.post(
  '/:id/add-cash',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  shiftController.addCash
);

// Remove cash from register
router.post(
  '/:id/remove-cash',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  shiftController.removeCash
);

export default router;
