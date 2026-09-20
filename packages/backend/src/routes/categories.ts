// packages/backend/src/routes/categories.ts

import { Router } from 'express';
import { categoryController } from '../controllers/categoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (NO AUTH)
// Must be registered before requireAuth.
// ============================================

router.get('/public', categoryController.getPublicCategories);
router.get(
  '/public/tree/:businessUnitId',
  categoryController.getPublicCategoryTree,
);
router.get(
  '/public/:id/with-products',
  categoryController.getPublicCategoryWithProducts,
);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

router.use(requireAuth);

// --- Specific (must precede /:id) ---

router.get('/tree/:businessUnitId', categoryController.getCategoryTree);
router.get('/stats/:businessUnitId', categoryController.getCategoryStatistics);
router.get('/by-name', categoryController.getCategoryByName);
router.get('/by-slug/:slug', categoryController.getCategoryBySlug);

router.get('/:id/with-products', categoryController.getCategoryWithProducts);
router.get('/:id/products', categoryController.getCategoryProducts);
router.get('/:parentId/subcategories', categoryController.getSubcategories);

// --- General list ---

router.get('/', categoryController.getAllCategories);

// --- Write ---

router.post(
  '/bulk-delete',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  categoryController.bulkDeleteCategories,
);

router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  categoryController.createCategory,
);

// --- Dynamic (must come last) ---

router.get('/:id', categoryController.getCategoryById);

router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  categoryController.updateCategory,
);

router.patch(
  '/:id/status',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  categoryController.toggleCategoryStatus,
);

router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  categoryController.deleteCategory,
);

export default router;
