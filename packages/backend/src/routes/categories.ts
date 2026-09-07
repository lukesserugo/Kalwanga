// D:\Projects\Kalwanga\packages\backend\src\routes\categories.ts

import { Router } from 'express';
import { categoryController } from '../controllers/categoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ============================================
// MIDDLEWARE - All category routes require authentication
// ============================================
router.use(requireAuth);

// ============================================
// 🔥 SPECIFIC ROUTES FIRST (MUST COME BEFORE /:id)
// ============================================

/**
 * Get category tree (hierarchical)
 * GET /categories/tree/:businessUnitId
 */
router.get('/tree/:businessUnitId', categoryController.getCategoryTree);

/**
 * Get category statistics
 * GET /categories/stats/:businessUnitId
 */
router.get('/stats/:businessUnitId', categoryController.getCategoryStatistics);

/**
 * Get category by name (query param)
 * GET /categories/by-name?name=:name&businessUnitId=:businessUnitId
 */
router.get('/by-name', categoryController.getCategoryByName);

/**
 * Get category with products
 * GET /categories/:id/with-products
 */
router.get('/:id/with-products', categoryController.getCategoryWithProducts);

/**
 * Get category products with pagination
 * GET /categories/:id/products
 */
router.get('/:id/products', categoryController.getCategoryProducts);

/**
 * Get subcategories for a parent category
 * GET /categories/:parentId/subcategories
 */
router.get('/:parentId/subcategories', categoryController.getSubcategories);

// ============================================
// 🔥 GENERAL ROUTES
// ============================================

/**
 * Get all categories with pagination and filters
 * GET /categories
 */
router.get('/', categoryController.getAllCategories);

// ============================================
// 🔥 POST ROUTES
// ============================================

/**
 * Bulk delete categories
 * POST /categories/bulk-delete
 */
router.post(
  '/bulk-delete',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  categoryController.bulkDeleteCategories
);

/**
 * Create a new category
 * POST /categories
 */
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  categoryController.createCategory
);

// ============================================
// 🔥 DYNAMIC ROUTES (MUST COME LAST)
// ============================================

/**
 * Get category by ID
 * GET /categories/:id
 */
router.get('/:id', categoryController.getCategoryById);

/**
 * Update an existing category
 * PUT /categories/:id
 */
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  categoryController.updateCategory
);

/**
 * Toggle category active status
 * PATCH /categories/:id/status
 */
router.patch(
  '/:id/status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  categoryController.toggleCategoryStatus
);

/**
 * Delete a category
 * DELETE /categories/:id
 */
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  categoryController.deleteCategory
);

export default router;
