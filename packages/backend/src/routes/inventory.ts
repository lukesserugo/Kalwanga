// packages/backend/src/routes/inventory.ts

import { Router } from 'express';
import { inventoryController } from '../controllers/inventoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireInventoryPermission } from '../middleware/inventoryPermissions.js';
import { UserRole } from '../generated/prisma/index.js';
import { PERMISSION_CATALOGUE } from '../lib/permissions.js';

const router = Router();

// All inventory routes require authentication.
router.use(requireAuth);

// ============================================
// ROUTE ORDERING CONTRACT
// ============================================
//
// Express matches routes in declaration order. To prevent a
// literal segment (e.g. `/all`, `/items`, `/summary`) from being
// captured by the wildcard `/:id` route, every literal route MUST
// be declared before `/:id`.
//
// Sections below are ordered accordingly:
//
//   1. Reference data          (/categories, /suppliers)
//   2. Item list + detail      (/items, /items/:id)
//   3. Reports & analytics     (/summary, /stats, /value, ...)
//   4. Literal single-segment  (/all, /search, /export, ...)
//   5. Attribute filters       (/product/:id, /barcode/:x, ...)
//   6. Writes (POST/PATCH/PUT/DELETE)
//   7. Catch-all               (/:id)  ← MUST BE LAST

// ============================================
// 1. REFERENCE DATA
// ============================================

/**
 * Get categories for dropdown.
 * GET /inventory/categories
 */
router.get(
  '/categories',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getCategories
);

/**
 * Get suppliers for dropdown.
 * GET /inventory/suppliers
 */
router.get(
  '/suppliers',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getSuppliers
);

// ============================================
// 2. ITEM LIST + DETAIL
// ============================================

/**
 * List inventory items with optional filtering.
 * GET /inventory/items
 * Query: page, limit, search, withoutProduct
 */
router.get(
  '/items',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventoryItems
);

/**
 * Get a single inventory item by ID.
 * GET /inventory/items/:id
 *
 * The frontend service `inventoryService.getInventoryItemById`
 * calls this URL. Must be declared before the catch-all `/:id`.
 */
router.get(
  '/items/:id',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventoryItemById
);

// ============================================
// 3. REPORTS & ANALYTICS
// ============================================

/**
 * Get inventory summary.
 * GET /inventory/summary
 */
router.get(
  '/summary',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_REPORTS),
  inventoryController.getInventorySummary
);

/**
 * Get inventory statistics.
 * GET /inventory/stats
 */
router.get(
  '/stats',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_REPORTS),
  inventoryController.getInventoryStats
);

/**
 * Get inventory value.
 * GET /inventory/value
 */
router.get(
  '/value',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_REPORTS),
  inventoryController.getInventoryValue
);

/**
 * Get category summary.
 * GET /inventory/category-summary
 */
router.get(
  '/category-summary',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_REPORTS),
  inventoryController.getCategorySummary
);

/**
 * Get total items count.
 * GET /inventory/total
 */
router.get(
  '/total',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_REPORTS),
  inventoryController.getTotalItems
);

/**
 * Get low stock items.
 * GET /inventory/low-stock
 */
router.get(
  '/low-stock',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_LOW_STOCK),
  inventoryController.getLowStockItems
);

/**
 * Get out of stock items.
 * GET /inventory/out-of-stock
 */
router.get(
  '/out-of-stock',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_LOW_STOCK),
  inventoryController.getOutOfStockItems
);

/**
 * Get inventory transactions.
 * GET /inventory/transactions
 */
router.get(
  '/transactions',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_AUDIT),
  inventoryController.getInventoryTransactions
);

/**
 * Get stock movements / audit trail.
 * GET /inventory/movements
 */
router.get(
  '/movements',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW_AUDIT),
  inventoryController.getStockMovements
);

/**
 * Search products in inventory.
 * GET /inventory/search
 */
router.get(
  '/search',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.searchProducts
);

// ============================================
// 4. LITERAL SINGLE-SEGMENT ROUTES
// ============================================
//
// These MUST be declared before the catch-all `/:id` at the
// bottom, otherwise `/all` would match `/:id` with id = "all".

/**
 * Get all inventory (no pagination).
 * GET /inventory/all
 */
router.get(
  '/all',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getAllInventory
);

/**
 * Export inventory data.
 * GET /inventory/export
 */
router.get(
  '/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EXPORT),
  inventoryController.exportInventory
);

/**
 * Export inventory to file.
 * GET /inventory/export/file
 */
router.get(
  '/export/file',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EXPORT),
  inventoryController.exportInventoryToFile
);

// ============================================
// 5. ATTRIBUTE FILTERS
// ============================================

/**
 * Get inventory by product ID.
 * GET /inventory/product/:productId
 */
router.get(
  '/product/:productId',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventoryByProduct
);

/**
 * Get inventory by barcode.
 * GET /inventory/barcode/:barcode
 */
router.get(
  '/barcode/:barcode',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventoryByBarcode
);

/**
 * Get inventory by SKU.
 * GET /inventory/sku/:sku
 */
router.get(
  '/sku/:sku',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventoryBySku
);

/**
 * Get inventory by location.
 * GET /inventory/location/:location
 */
router.get(
  '/location/:location',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventoryByLocation
);

/**
 * Get inventory by category.
 * GET /inventory/category/:category
 */
router.get(
  '/category/:category',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventoryByCategory
);

// ============================================
// 6. WRITES
// ============================================
//
// Literal `/bulk/*` routes MUST come before `/:id/generate-*`.

/**
 * Create new inventory item.
 * POST /inventory/items
 */
router.post(
  '/items',
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  ]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_CREATE),
  inventoryController.createItem
);

/**
 * Create product with inventory.
 * POST /inventory/products
 */
router.post(
  '/products',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_CREATE),
  inventoryController.createProduct
);

/**
 * Create inventory (legacy).
 * POST /inventory
 */
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_CREATE),
  inventoryController.createInventory
);

/**
 * Bulk create items.
 * POST /inventory/bulk/items
 */
router.post(
  '/bulk/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_IMPORT),
  inventoryController.bulkCreateItems
);

/**
 * Bulk create items (legacy).
 * POST /inventory/bulk
 */
router.post(
  '/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_IMPORT),
  inventoryController.bulkCreateItems
);

/**
 * Bulk generate barcodes.
 * POST /inventory/bulk/generate-barcodes
 */
router.post(
  '/bulk/generate-barcodes',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EDIT),
  inventoryController.bulkGenerateInventoryBarcodes
);

/**
 * Transfer stock between locations.
 * POST /inventory/transfer
 */
router.post(
  '/transfer',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_TRANSFER),
  inventoryController.transferStock
);

/**
 * Scan inventory.
 * POST /inventory/scan
 */
router.post(
  '/scan',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.scanInventory
);

/**
 * Reserve stock.
 * POST /inventory/reserve
 */
router.post(
  '/reserve',
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  ]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_ADJUST),
  inventoryController.reserveStock
);

/**
 * Release reserved stock.
 * POST /inventory/release
 */
router.post(
  '/release',
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  ]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_ADJUST),
  inventoryController.releaseReservedStock
);

/**
 * Issue inventory item.
 * POST /inventory/items/:id/issue
 */
router.post(
  '/items/:id/issue',
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  ]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_ISSUE),
  inventoryController.issueItem
);

/**
 * Return issued inventory item.
 * POST /inventory/items/:id/return
 */
router.post(
  '/items/:id/return',
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  ]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_ISSUE),
  inventoryController.returnItem
);

/**
 * Restock inventory item.
 * POST /inventory/items/:id/restock
 */
router.post(
  '/items/:id/restock',
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  ]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_RESTOCK),
  inventoryController.restockItem
);

/**
 * Generate barcode for inventory item.
 * POST /inventory/:id/generate-barcode
 */
router.post(
  '/:id/generate-barcode',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EDIT),
  inventoryController.generateInventoryBarcode
);

/**
 * Generate QR code for inventory item.
 * POST /inventory/:id/generate-qr
 */
router.post(
  '/:id/generate-qr',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EDIT),
  inventoryController.generateInventoryQRCode
);

/**
 * Bulk update stock quantities.
 * PATCH /inventory/bulk/stock
 */
router.patch(
  '/bulk/stock',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_ADJUST),
  inventoryController.bulkUpdateStock
);

/**
 * Update stock quantity.
 * PATCH /inventory/items/:id/stock
 */
router.patch(
  '/items/:id/stock',
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  ]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_ADJUST),
  inventoryController.updateStock
);

/**
 * Update inventory item.
 * PUT /inventory/items/:id
 */
router.put(
  '/items/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EDIT),
  inventoryController.updateItem
);

/**
 * Update inventory (legacy).
 * PUT /inventory/:id
 */
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EDIT),
  inventoryController.updateInventory
);

/**
 * Update product.
 * PUT /inventory/products/:id
 */
router.put(
  '/products/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_EDIT),
  inventoryController.updateProduct
);

/**
 * Delete inventory item.
 * DELETE /inventory/items/:id
 */
router.delete(
  '/items/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_DELETE),
  inventoryController.deleteItem
);

/**
 * Bulk delete items.
 * DELETE /inventory/bulk/items
 */
router.delete(
  '/bulk/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_DELETE),
  inventoryController.bulkDeleteItems
);

/**
 * Delete product (legacy).
 * DELETE /inventory/products/:id
 */
router.delete(
  '/products/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_DELETE),
  inventoryController.deleteProduct
);

// ============================================
// 7. CATCH-ALL (MUST BE LAST)
// ============================================

/**
 * Get all inventory with pagination.
 * GET /inventory
 */
router.get(
  '/',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventory
);

/**
 * Get single inventory item by ID (legacy flat path).
 * GET /inventory/:id
 *
 * Kept for backwards compatibility. New code should use
 * GET /inventory/items/:id (declared above).
 */
router.get(
  '/:id',
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW),
  inventoryController.getInventoryItemById
);

/**
 * Legacy delete.
 * DELETE /inventory/:id
 */
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_DELETE),
  inventoryController.deleteItem
);

export default router;
