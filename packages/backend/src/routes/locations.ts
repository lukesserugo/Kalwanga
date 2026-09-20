// packages/backend/src/routes/locations.ts

import { Router } from 'express';
import { locationController } from '../controllers/locationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireInventoryPermission } from '../middleware/inventoryPermissions.js';
import { UserRole } from '../generated/prisma/index.js';
import { PERMISSION_CATALOGUE } from '../lib/permissions.js';

const router = Router();

// All location routes require authentication
router.use(requireAuth);

// ============================================
// STATIC GET ROUTES
// ============================================
//
// ⚠️ Ordering matters: these MUST be declared before `/:id` below,
// otherwise Express will match "settings" and "reports" as ids.

/**
 * Fetch location settings for the caller's business unit.
 * Returns 404 when the BU has no settings row yet — the client
 * applies defaults in that case.
 * GET /api/locations/settings
 */
router.get(
  '/settings',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  locationController.getSettings
);

/**
 * Upsert location settings for the caller's business unit.
 * PUT /api/locations/settings
 */
router.put(
  '/settings',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EDIT),
  locationController.updateSettings
);

/**
 * Per-location aggregates: item count, total quantity, total value,
 * low-stock count.
 * GET /api/locations/reports
 */
router.get(
  '/reports',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  locationController.getReports
);

/**
 * Stream locations as a downloadable file (csv / xlsx / json / pdf).
 * GET /api/locations/export
 */
router.get(
  '/export',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  locationController.export
);

// ============================================
// POST ROUTES
// ============================================

/**
 * Bulk-create locations from an array of rows (parsed client-side
 * from a CSV the user uploaded).
 * POST /api/locations/import
 */
router.post(
  '/import',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_CREATE),
  locationController.import
);

/**
 * Create a new location.
 * POST /api/locations
 */
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_CREATE),
  locationController.create
);

// ============================================
// DYNAMIC ROUTES
// ============================================
//
// Everything below uses `:id` and MUST come after the static GETs.

/**
 * List locations for the caller's business unit.
 * GET /api/locations
 */
router.get(
  '/',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  locationController.list
);

/**
 * Get a single location by id.
 * GET /api/locations/:id
 */
router.get(
  '/:id',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  locationController.getById
);

/**
 * Update a location.
 * PATCH /api/locations/:id
 */
router.patch(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EDIT),
  locationController.update
);

/**
 * Soft delete a location.
 * DELETE /api/locations/:id
 */
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_DELETE),
  locationController.remove
);

export default router;
