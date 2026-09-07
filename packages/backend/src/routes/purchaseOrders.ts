// D:\Projects\Kalwanga\packages\backend\src\routes\purchaseOrders.ts

import { Router } from 'express';
import { purchaseOrderController } from '../controllers/purchaseOrderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
// Fix: Import UserRole from the correct path
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All purchase order routes require authentication
router.use(requireAuth);

// ============================================
// GET endpoints - Purchase Order Retrieval
// ============================================

// Get all purchase orders with pagination and filters
router.get('/', purchaseOrderController.getAllPurchaseOrders);

// Get purchase order by ID
router.get('/:id', purchaseOrderController.getPurchaseOrderById);

// ============================================
// POST endpoints - Purchase Order Creation
// ============================================

// Create purchase order
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  purchaseOrderController.createPurchaseOrder
);

// ============================================
// PUT endpoints - Purchase Order Updates
// ============================================

// Update purchase order
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  purchaseOrderController.updatePurchaseOrder
);

// ============================================
// POST endpoints - Purchase Order Actions
// ============================================

// Receive purchase order (update inventory)
router.post(
  '/:id/receive',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  purchaseOrderController.receivePurchaseOrder
);

// Cancel purchase order
router.post(
  '/:id/cancel',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  purchaseOrderController.cancelPurchaseOrder
);

export default router;
