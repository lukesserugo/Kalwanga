// D:\Projects\Kalwanga\packages\backend\src\routes\suppliers.ts

import { Router } from 'express';
import { supplierController } from '../controllers/supplierController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All supplier routes require authentication
router.use(requireAuth);

// ============================================
// GET endpoints - Supplier Retrieval
// ============================================

// Get all suppliers with pagination and filters
router.get('/', supplierController.getAllSuppliers);

// Search suppliers
router.get('/search', supplierController.searchSuppliers);

// Get supplier by ID
router.get('/:id', supplierController.getSupplierById);

// Get supplier products
router.get('/:id/products', supplierController.getSupplierProducts);

// Get supplier purchase orders
router.get('/:id/purchase-orders', supplierController.getSupplierPurchaseOrders);
router.get('/:id/orders', supplierController.getSupplierOrderHistory);

// ============================================
// POST endpoints - Supplier Creation
// ============================================

// Create supplier
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  supplierController.createSupplier
);

// Bulk delete suppliers
router.post(
  '/bulk/delete',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  supplierController.bulkDeleteSuppliers
);

// ============================================
// PUT endpoints - Supplier Updates
// ============================================

// Update supplier
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  supplierController.updateSupplier
);

// ============================================
// PATCH endpoints - Supplier Status
// ============================================

// Toggle supplier status
router.patch(
  '/:id/status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  supplierController.toggleSupplierStatus
);

// ============================================
// DELETE endpoints - Supplier Removal
// ============================================

// Delete supplier
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  supplierController.deleteSupplier
);

export default router;
