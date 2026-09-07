// D:\Projects\Kalwanga\packages\backend\src\routes\inventory.ts

import { Router } from 'express';
import { inventoryController } from '../controllers/inventoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireInventoryPermission } from '../middleware/inventoryPermissions.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All inventory routes require authentication
router.use(requireAuth);

// ============================================
// IMPORTANT: Route ordering matters in Express!
// More specific routes must come BEFORE generic routes
// ============================================

// ============================================
// GET ENDPOINTS - Reference Data (Highest Priority)
// ============================================

/**
 * Get categories for dropdown
 * GET /api/inventory/categories
 */
router.get(
  '/categories',
  requireInventoryPermission('inventory:view'),
  inventoryController.getCategories
);

/**
 * Get suppliers for dropdown
 * GET /api/inventory/suppliers
 */
router.get(
  '/suppliers',
  requireInventoryPermission('inventory:view'),
  inventoryController.getSuppliers
);

// ============================================
// GET ENDPOINTS - Inventory Items (before generic :id routes)
// ============================================

/**
 * Get inventory items with optional filtering
 * GET /api/inventory/items
 * Query params: page, limit, search, withoutProduct
 */
router.get(
  '/items',
  requireInventoryPermission('inventory:view'),
  inventoryController.getInventoryItems
);

// ============================================
// GET ENDPOINTS - Reports & Analytics
// ============================================

/**
 * Get inventory summary
 * GET /api/inventory/summary
 */
router.get(
  '/summary',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:view_reports'),
  inventoryController.getInventorySummary
);

/**
 * Get inventory statistics
 * GET /api/inventory/stats
 */
router.get(
  '/stats',
  requireInventoryPermission('inventory:view_reports'),
  inventoryController.getInventoryStats
);

/**
 * Get inventory value
 * GET /api/inventory/value
 */
router.get(
  '/value',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:view_reports'),
  inventoryController.getInventoryValue
);

/**
 * Get category summary
 * GET /api/inventory/category-summary
 */
router.get(
  '/category-summary',
  requireInventoryPermission('inventory:view_reports'),
  inventoryController.getCategorySummary
);

/**
 * Get total items count
 * GET /api/inventory/total
 */
router.get(
  '/total',
  requireInventoryPermission('inventory:view_reports'),
  inventoryController.getTotalItems
);

/**
 * Get low stock items
 * GET /api/inventory/low-stock
 */
router.get(
  '/low-stock',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:view_low_stock'),
  inventoryController.getLowStockItems
);

/**
 * Get out of stock items
 * GET /api/inventory/out-of-stock
 */
router.get(
  '/out-of-stock',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:view_low_stock'),
  inventoryController.getOutOfStockItems
);

/**
 * Get inventory transactions
 * GET /api/inventory/transactions
 */
router.get(
  '/transactions',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:view_audit'),
  inventoryController.getInventoryTransactions
);

/**
 * Get stock movements / audit trail
 * GET /api/inventory/movements
 */
router.get(
  '/movements',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:view_audit'),
  inventoryController.getStockMovements
);

/**
 * Search products in inventory
 * GET /api/inventory/search
 */
router.get(
  '/search',
  requireInventoryPermission('inventory:view'),
  inventoryController.searchProducts
);

/**
 * Get all inventory (no pagination)
 * GET /api/inventory/all
 */
router.get(
  '/all',
  requireInventoryPermission('inventory:view'),
  inventoryController.getAllInventory
);

/**
 * Export inventory data
 * GET /api/inventory/export
 */
router.get(
  '/export',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:export'),
  inventoryController.exportInventory
);

/**
 * Export inventory to file
 * GET /api/inventory/export/file
 */
router.get(
  '/export/file',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:export'),
  inventoryController.exportInventoryToFile
);

// ============================================
// GET ENDPOINTS - Filter by Product Attributes
// ============================================

/**
 * Get inventory by product ID
 * GET /api/inventory/product/:productId
 */
router.get(
  '/product/:productId',
  requireInventoryPermission('inventory:view'),
  inventoryController.getInventoryByProduct
);

/**
 * Get inventory by barcode
 * GET /api/inventory/barcode/:barcode
 */
router.get(
  '/barcode/:barcode',
  requireInventoryPermission('inventory:view'),
  inventoryController.getInventoryByBarcode
);

/**
 * Get inventory by SKU
 * GET /api/inventory/sku/:sku
 */
router.get(
  '/sku/:sku',
  requireInventoryPermission('inventory:view'),
  inventoryController.getInventoryBySku
);

/**
 * Get inventory by location
 * GET /api/inventory/location/:location
 */
router.get(
  '/location/:location',
  requireInventoryPermission('inventory:view'),
  inventoryController.getInventoryByLocation
);

/**
 * Get inventory by category
 * GET /api/inventory/category/:category
 */
router.get(
  '/category/:category',
  requireInventoryPermission('inventory:view'),
  inventoryController.getInventoryByCategory
);

// ============================================
// POST ENDPOINTS - Create Operations
// ============================================

/**
 * Create new inventory item
 * POST /api/inventory/items
 */
router.post(
  '/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE]),
  requireInventoryPermission('inventory:create'),
  inventoryController.createItem
);

/**
 * Create product with inventory
 * POST /api/inventory/products
 */
router.post(
  '/products',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:create'),
  inventoryController.createProduct
);

/**
 * Create inventory (legacy)
 * POST /api/inventory
 */
router.post(
  '/',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:create'),
  inventoryController.createInventory
);

/**
 * Bulk create items
 * POST /api/inventory/bulk/items
 */
router.post(
  '/bulk/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:import'),
  inventoryController.bulkCreateItems
);

/**
 * Bulk create items (legacy)
 * POST /api/inventory/bulk
 */
router.post(
  '/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:import'),
  inventoryController.bulkCreateItems
);

/**
 * Bulk generate barcodes
 * POST /api/inventory/bulk/generate-barcodes
 */
router.post(
  '/bulk/generate-barcodes',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:edit'),
  inventoryController.bulkGenerateInventoryBarcodes
);

/**
 * Transfer stock between locations
 * POST /api/inventory/transfer
 */
router.post(
  '/transfer',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:transfer'),
  inventoryController.transferStock
);

/**
 * Scan inventory
 * POST /api/inventory/scan
 */
router.post(
  '/scan',
  requireInventoryPermission('inventory:view'),
  inventoryController.scanInventory
);

// ============================================
// POST ENDPOINTS - Stock Operations
// ============================================

/**
 * Reserve stock
 * POST /api/inventory/reserve
 */
router.post(
  '/reserve',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE]),
  requireInventoryPermission('inventory:adjust'),
  inventoryController.reserveStock
);

/**
 * Release reserved stock
 * POST /api/inventory/release
 */
router.post(
  '/release',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE]),
  requireInventoryPermission('inventory:adjust'),
  inventoryController.releaseReservedStock
);

/**
 * Issue inventory item
 * POST /api/inventory/items/:id/issue
 */
router.post(
  '/items/:id/issue',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE]),
  requireInventoryPermission('inventory:issue'),
  inventoryController.issueItem
);

/**
 * Return issued inventory item
 * POST /api/inventory/items/:id/return
 */
router.post(
  '/items/:id/return',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE]),
  requireInventoryPermission('inventory:issue'),
  inventoryController.returnItem
);

/**
 * Restock inventory item
 * POST /api/inventory/items/:id/restock
 */
router.post(
  '/items/:id/restock',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE]),
  requireInventoryPermission('inventory:restock'),
  inventoryController.restockItem
);

// ============================================
// POST ENDPOINTS - Barcode/QR with ID Parameter
// ============================================

/**
 * Generate barcode for inventory item
 * POST /api/inventory/:id/generate-barcode
 */
router.post(
  '/:id/generate-barcode',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:edit'),
  inventoryController.generateInventoryBarcode
);

/**
 * Generate QR code for inventory item
 * POST /api/inventory/:id/generate-qr
 */
router.post(
  '/:id/generate-qr',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:edit'),
  inventoryController.generateInventoryQRCode
);

// ============================================
// PATCH ENDPOINTS - Partial Updates
// ============================================

/**
 * Bulk update stock quantities
 * PATCH /api/inventory/bulk/stock
 */
router.patch(
  '/bulk/stock',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:adjust'),
  inventoryController.bulkUpdateStock
);

/**
 * Update stock quantity
 * PATCH /api/inventory/items/:id/stock
 */
router.patch(
  '/items/:id/stock',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE]),
  requireInventoryPermission('inventory:adjust'),
  inventoryController.updateStock
);

// ============================================
// PUT ENDPOINTS - Full Updates
// ============================================

/**
 * Update inventory item
 * PUT /api/inventory/items/:id
 */
router.put(
  '/items/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:edit'),
  inventoryController.updateItem
);

/**
 * Update inventory (legacy)
 * PUT /api/inventory/:id
 */
router.put(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:edit'),
  inventoryController.updateInventory
);

/**
 * Update product
 * PUT /api/inventory/products/:id
 */
router.put(
  '/products/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  requireInventoryPermission('inventory:edit'),
  inventoryController.updateProduct
);

// ============================================
// DELETE ENDPOINTS
// ============================================

/**
 * Delete inventory item (specific route)
 * DELETE /api/inventory/items/:id
 */
router.delete(
  '/items/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission('inventory:delete'),
  inventoryController.deleteItem
);

/**
 * Bulk delete items
 * DELETE /api/inventory/bulk/items
 */
router.delete(
  '/bulk/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission('inventory:delete'),
  inventoryController.bulkDeleteItems
);

/**
 * Delete product (legacy)
 * DELETE /api/inventory/products/:id
 */
router.delete(
  '/products/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission('inventory:delete'),
  inventoryController.deleteProduct
);

// ============================================
// GENERIC ROUTES (must be LAST)
// ============================================

/**
 * Get all inventory with pagination
 * GET /api/inventory
 */
router.get(
  '/',
  requireInventoryPermission('inventory:view'),
  inventoryController.getInventory
);

/**
 * Get single inventory item by ID
 * GET /api/inventory/:id
 */
router.get(
  '/:id',
  requireInventoryPermission('inventory:view'),
  inventoryController.getInventoryItemById
);

/**
 * Legacy delete
 * DELETE /api/inventory/:id
 */
router.delete(
  '/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]),
  requireInventoryPermission('inventory:delete'),
  inventoryController.deleteItem
);

export default router;
