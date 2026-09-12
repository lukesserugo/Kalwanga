// packages/backend/src/routes/shift.ts
import { Router } from 'express';
import { shiftController } from '../controllers/shiftController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All shift routes require authentication
router.use(requireAuth);

// ============================================
// REGISTER MANAGEMENT ROUTES
// ============================================

router.get('/register/current', shiftController.getCurrentShiftForUser);
router.get('/registers', shiftController.getRegisters);
router.get('/registers/:id', shiftController.getRegisterById);
router.get('/registers/:id/status', shiftController.getRegisterStatus);

router.post(
  '/registers',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  shiftController.createRegister
);

router.put(
  '/registers/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  shiftController.updateRegister
);

router.delete(
  '/registers/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  shiftController.deleteRegister
);

// ============================================
// SHIFT MANAGEMENT ROUTES
// ⚠️ ORDER MATTERS: Specific routes MUST come before /:id
// ============================================

// 1. Root
router.get('/', shiftController.getAllShifts);

// 2. ✅ Specific routes (MUST be before /:id)
router.get('/current/:cashRegisterId', shiftController.getCurrentShift);
router.get('/stats', shiftController.getShiftStats);

// 3. Nested routes (safe - different path depth)
router.get('/:id/summary', shiftController.getShiftSummary);

// 4. ⚠️ Generic dynamic route — MUST BE LAST among GET routes
router.get('/:id', shiftController.getShiftById);

// ============================================
// SHIFT OPERATIONS
// ============================================

router.post(
  '/start',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  shiftController.startShift
);

router.post(
  '/:id/end',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  shiftController.endShift
);

router.post(
  '/:id/add-cash',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  shiftController.addCash
);

router.post(
  '/:id/remove-cash',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  shiftController.removeCash
);

export default router;
