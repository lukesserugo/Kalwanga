// D:\Projects\Kalwanga\packages\backend\src\routes\products.ts

import { Router } from 'express';
import { productController } from '../controllers/productController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireInventoryPermission } from '../middleware/inventoryPermissions.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createProductSchema,
  updateProductSchema,
  searchParamsSchema,
  createCategorySchema,
  updateCategorySchema,
  createSupplierSchema,
  updateSupplierSchema,
  createProductReviewSchema,
  generateBarcodeSchema,
  associateBarcodeSchema,
  validateBarcodeSchema,
  createVariantSchema,
  updateVariantSchema,
  bulkCreateVariantsSchema,
  updateVariantStockSchema,
} from '../utils/validators.js';

const router = Router();

// ============================================
// 🔥 AUTHENTICATION MIDDLEWARE
// All product routes require authentication
// ============================================

router.use(requireAuth);

// ============================================
// 🔥 DEBUG ROUTE (Development only)
// ============================================

if (process.env.NODE_ENV !== 'production') {
  router.get('/debug', (req: any, res: any) => {
    const user = req.user || null;
    res.json({
      success: true,
      message: 'Products route is working',
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        businessUnitId: user.businessUnitId,
        companyId: user.companyId,
      } : null,
      timestamp: new Date().toISOString(),
      routes: [
        'GET /products',
        'GET /products/:id',
        'GET /products/sku/:sku',
        'GET /products/barcode/:barcode',
        'GET /products/check-sku/:sku',
        'POST /products',
        'PUT /products/:id',
        'DELETE /products/:id',
        'POST /products/:id/unlink-inventory',
        'GET /products/featured',
        'GET /products/popular',
        'GET /products/new-arrivals',
        'GET /products/search',
        'GET /products/tags',
        'GET /products/statistics',
        'GET /products/no-barcode',
        'GET /products/:id/related',
        'POST /products/:id/barcode',
        'POST /products/barcode/generate',
        'GET /products/:id/barcode',
        'GET /products/:id/barcode/image',
        'GET /products/:id/qrcode',
        'POST /products/barcode/image',
        'POST /products/qrcode',
        'POST /products/:id/barcode/associate',
        'POST /products/barcode/validate',
        'POST /products/barcode/bulk-generate',
        'POST /products/barcode/scan',
        'POST /products/:id/variants',
        'POST /products/:id/variants/bulk',
        'GET /products/:id/variants',
        'GET /products/variants/:variantId',
        'GET /products/variants/barcode/:barcode',
        'GET /products/variants/sku/:sku',
        'PUT /products/variants/:variantId',
        'DELETE /products/variants/:variantId',
        'PATCH /products/variants/:variantId/stock',
        'POST /products/variants/bulk/delete',
        'GET /products/:id/reviews',
        'GET /products/:id/reviews/stats',
        'GET /products/:id/reviews/export',
        'POST /products/:id/reviews',
        'PUT /products/reviews/:reviewId',
        'DELETE /products/reviews/:reviewId',
        'PATCH /products/reviews/:reviewId/verify',
        'POST /products/reviews/:reviewId/helpful',
        'POST /products/reviews/:reviewId/report',
        'GET /products/categories',
        'GET /products/categories/tree',
        'GET /products/categories/:id',
        'GET /products/categories/:id/products',
        'POST /products/categories',
        'PUT /products/categories/:id',
        'DELETE /products/categories/:id',
        'GET /products/suppliers',
        'GET /products/suppliers/:id',
        'GET /products/suppliers/:id/products',
        'POST /products/suppliers',
        'PUT /products/suppliers/:id',
        'DELETE /products/suppliers/:id',
        'POST /products/bulk',
        'POST /products/bulk/delete',
        'POST /products/bulk/activate',
        'POST /products/bulk/deactivate',
        'POST /products/bulk/update-prices',
        'POST /products/bulk/update-stock',
        'POST /products/wishlist/:productId',
        'GET /products/wishlist',
        'GET /products/wishlist/:productId/check',
        'GET /products/wishlist/count',
        'GET /products/wishlist/ids',
        'DELETE /products/wishlist',
        'POST /products/recently-viewed/:productId',
        'GET /products/recently-viewed',
        'DELETE /products/recently-viewed',
        'GET /products/public',
        'POST /products/compare',
        'GET /products/export',
        'POST /products/import',
        'GET /products/import/template',
        'GET /products/health',
      ],
    });
  });
}

// ============================================
// 🔥 IMPORTANT: Route Order Matters!
// Static routes MUST come before dynamic routes
// ============================================

// ============================================
// 🔥 HEALTH CHECK
// ============================================

/**
 * Health check for products route
 * GET /products/health
 */
router.get(
  '/health',
  requireInventoryPermission('inventory:view'),
  (req: any, res: any) => {
    res.json({
      success: true,
      message: 'Products route is healthy',
      timestamp: new Date().toISOString(),
      routesCount: 73,
    });
  }
);

// ============================================
// 🔥 SKU CHECK ENDPOINT
// ============================================

/**
 * Check if SKU exists
 * GET /products/check-sku/:sku
 * Query: ?businessUnitId=xxx&excludeProductId=xxx
 */
router.get(
  '/check-sku/:sku',
  requireInventoryPermission('inventory:view'),
  productController.checkSKUExists
);

// ============================================
// 🔥 STATIC PRODUCT ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Get all products with filtering and pagination
 * GET /products
 */
router.get(
  '/',
  requireInventoryPermission('inventory:view'),
  productController.getAllProducts
);

/**
 * Get featured products
 * GET /products/featured
 */
router.get(
  '/featured',
  requireInventoryPermission('inventory:view'),
  productController.getFeaturedProducts
);

/**
 * Get popular products
 * GET /products/popular
 */
router.get(
  '/popular',
  requireInventoryPermission('inventory:view'),
  productController.getPopularProducts
);

/**
 * Get new arrivals
 * GET /products/new-arrivals
 */
router.get(
  '/new-arrivals',
  requireInventoryPermission('inventory:view'),
  productController.getNewArrivals
);

/**
 * Search products
 * GET /products/search
 */
router.get(
  '/search',
  requireInventoryPermission('inventory:view'),
  productController.searchProducts
);

/**
 * Get product tags
 * GET /products/tags
 */
router.get(
  '/tags',
  requireInventoryPermission('inventory:view'),
  productController.getTags
);

/**
 * Get product statistics
 * GET /products/statistics
 */
router.get(
  '/statistics',
  requireInventoryPermission('inventory:view'),
  productController.getProductStatistics
);

/**
 * Get products without barcode
 * GET /products/no-barcode
 */
router.get(
  '/no-barcode',
  requireInventoryPermission('inventory:view'),
  productController.getProductsWithoutBarcode
);

/**
 * Get public products (auto-hides out of stock)
 * GET /products/public
 * ✅ Public endpoint - no auth required
 */
router.get(
  '/public',
  productController.getPublicProducts
);

/**
 * Search by SKU - must come before /:id
 * GET /products/sku/:sku
 */
router.get(
  '/sku/:sku',
  requireInventoryPermission('inventory:view'),
  productController.getProductBySku
);

/**
 * Search by barcode - must come before /:id
 * GET /products/barcode/:barcode
 */
router.get(
  '/barcode/:barcode',
  requireInventoryPermission('inventory:view'),
  productController.getProductByBarcode
);

// ============================================
// 🔥 BARCODE STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Generate unique barcode (without product)
 * POST /products/barcode/generate
 */
router.post(
  '/barcode/generate',
  requireInventoryPermission('inventory:edit'),
  productController.generateUniqueBarcode
);

/**
 * Generate barcode image from string
 * POST /products/barcode/image
 */
router.post(
  '/barcode/image',
  requireInventoryPermission('inventory:view'),
  productController.generateBarcodeImage
);

/**
 * Generate QR code from data
 * POST /products/qrcode
 */
router.post(
  '/qrcode',
  requireInventoryPermission('inventory:view'),
  productController.generateQRCode
);

/**
 * Validate barcode uniqueness
 * POST /products/barcode/validate
 */
router.post(
  '/barcode/validate',
  requireInventoryPermission('inventory:view'),
  validateRequest(validateBarcodeSchema),
  productController.validateBarcode
);

/**
 * Bulk generate barcodes
 * POST /products/barcode/bulk-generate
 */
router.post(
  '/barcode/bulk-generate',
  requireInventoryPermission('inventory:edit'),
  productController.bulkGenerateBarcodes
);

/**
 * Scan barcode
 * POST /products/barcode/scan
 */
router.post(
  '/barcode/scan',
  requireInventoryPermission('inventory:view'),
  productController.scanBarcode
);

// ============================================
// 🔥 VARIANT STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Get variant by ID
 * GET /products/variants/:variantId
 */
router.get(
  '/variants/:variantId',
  requireInventoryPermission('inventory:view'),
  productController.getVariantById
);

/**
 * Get variant by barcode (or SKU)
 * GET /products/variants/barcode/:barcode
 */
router.get(
  '/variants/barcode/:barcode',
  requireInventoryPermission('inventory:view'),
  productController.getVariantByBarcode
);

/**
 * Get variant by SKU
 * GET /products/variants/sku/:sku
 */
router.get(
  '/variants/sku/:sku',
  requireInventoryPermission('inventory:view'),
  productController.getVariantBySku
);

/**
 * Update a variant
 * PUT /products/variants/:variantId
 */
router.put(
  '/variants/:variantId',
  requireInventoryPermission('inventory:edit'),
  validateRequest(updateVariantSchema),
  productController.updateVariant
);

/**
 * Delete a variant
 * DELETE /products/variants/:variantId
 */
router.delete(
  '/variants/:variantId',
  requireInventoryPermission('inventory:delete'),
  productController.deleteVariant
);

/**
 * Update variant stock
 * PATCH /products/variants/:variantId/stock
 */
router.patch(
  '/variants/:variantId/stock',
  requireInventoryPermission('inventory:edit'),
  validateRequest(updateVariantStockSchema),
  productController.updateVariantStock
);

/**
 * Bulk delete variants
 * POST /products/variants/bulk/delete
 */
router.post(
  '/variants/bulk/delete',
  requireInventoryPermission('inventory:delete'),
  productController.bulkDeleteVariants
);

// ============================================
// 🔥 REVIEW STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Update product review
 * PUT /products/reviews/:reviewId
 */
router.put(
  '/reviews/:reviewId',
  requireInventoryPermission('inventory:edit'),
  productController.updateProductReview
);

/**
 * Delete product review
 * DELETE /products/reviews/:reviewId
 */
router.delete(
  '/reviews/:reviewId',
  requireInventoryPermission('inventory:delete'),
  productController.deleteProductReview
);

/**
 * Verify product review
 * PATCH /products/reviews/:reviewId/verify
 */
router.patch(
  '/reviews/:reviewId/verify',
  requireInventoryPermission('inventory:edit'),
  productController.verifyReview
);

/**
 * Mark review as helpful
 * POST /products/reviews/:reviewId/helpful
 */
router.post(
  '/reviews/:reviewId/helpful',
  requireInventoryPermission('inventory:view'),
  productController.markReviewHelpful
);

/**
 * Report review
 * POST /products/reviews/:reviewId/report
 */
router.post(
  '/reviews/:reviewId/report',
  requireInventoryPermission('inventory:view'),
  productController.reportReview
);

// ============================================
// 🔥 CATEGORY STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Get all categories
 * GET /products/categories
 */
router.get(
  '/categories',
  requireInventoryPermission('inventory:view'),
  productController.getCategories
);

/**
 * Get category tree
 * GET /products/categories/tree
 */
router.get(
  '/categories/tree',
  requireInventoryPermission('inventory:view'),
  productController.getCategoryTree
);

/**
 * Create category
 * POST /products/categories
 */
router.post(
  '/categories',
  requireInventoryPermission('inventory:manage_categories'),
  validateRequest(createCategorySchema),
  productController.createCategory
);

/**
 * Get category by ID
 * GET /products/categories/:id
 */
router.get(
  '/categories/:id',
  requireInventoryPermission('inventory:view'),
  productController.getCategoryById
);

/**
 * Get products by category
 * GET /products/categories/:id/products
 */
router.get(
  '/categories/:id/products',
  requireInventoryPermission('inventory:view'),
  productController.getCategoryProducts
);

/**
 * Update category
 * PUT /products/categories/:id
 */
router.put(
  '/categories/:id',
  requireInventoryPermission('inventory:manage_categories'),
  validateRequest(updateCategorySchema),
  productController.updateCategory
);

/**
 * Delete category
 * DELETE /products/categories/:id
 */
router.delete(
  '/categories/:id',
  requireInventoryPermission('inventory:manage_categories'),
  productController.deleteCategory
);

// ============================================
// 🔥 SUPPLIER STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Get all suppliers
 * GET /products/suppliers
 */
router.get(
  '/suppliers',
  requireInventoryPermission('inventory:view'),
  productController.getSuppliers
);

/**
 * Create supplier
 * POST /products/suppliers
 */
router.post(
  '/suppliers',
  requireInventoryPermission('inventory:manage_suppliers'),
  validateRequest(createSupplierSchema),
  productController.createSupplier
);

/**
 * Get supplier by ID
 * GET /products/suppliers/:id
 */
router.get(
  '/suppliers/:id',
  requireInventoryPermission('inventory:view'),
  productController.getSupplierById
);

/**
 * Get products by supplier
 * GET /products/suppliers/:id/products
 */
router.get(
  '/suppliers/:id/products',
  requireInventoryPermission('inventory:view'),
  productController.getSupplierProducts
);

/**
 * Update supplier
 * PUT /products/suppliers/:id
 */
router.put(
  '/suppliers/:id',
  requireInventoryPermission('inventory:manage_suppliers'),
  validateRequest(updateSupplierSchema),
  productController.updateSupplier
);

/**
 * Delete supplier
 * DELETE /products/suppliers/:id
 */
router.delete(
  '/suppliers/:id',
  requireInventoryPermission('inventory:manage_suppliers'),
  productController.deleteSupplier
);

// ============================================
// 🔥 BULK OPERATION STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Bulk create products
 * POST /products/bulk
 */
router.post(
  '/bulk',
  requireInventoryPermission('inventory:create'),
  productController.bulkCreateProducts
);

/**
 * Bulk delete products
 * POST /products/bulk/delete
 */
router.post(
  '/bulk/delete',
  requireInventoryPermission('inventory:delete'),
  productController.bulkDeleteProducts
);

/**
 * Bulk activate products
 * POST /products/bulk/activate
 */
router.post(
  '/bulk/activate',
  requireInventoryPermission('inventory:edit'),
  productController.bulkActivateProducts
);

/**
 * Bulk deactivate products
 * POST /products/bulk/deactivate
 */
router.post(
  '/bulk/deactivate',
  requireInventoryPermission('inventory:edit'),
  productController.bulkDeactivateProducts
);

/**
 * Bulk update prices
 * POST /products/bulk/update-prices
 */
router.post(
  '/bulk/update-prices',
  requireInventoryPermission('inventory:edit'),
  productController.bulkUpdatePrices
);

/**
 * Bulk update stock
 * POST /products/bulk/update-stock
 */
router.post(
  '/bulk/update-stock',
  requireInventoryPermission('inventory:edit'),
  productController.bulkUpdateStock
);

// ============================================
// 🔥 WISHLIST STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Get wishlist
 * GET /products/wishlist
 */
router.get(
  '/wishlist',
  requireAuth,
  productController.getWishlist
);

/**
 * Get wishlist count
 * GET /products/wishlist/count
 */
router.get(
  '/wishlist/count',
  requireAuth,
  productController.getWishlistCount
);

/**
 * Get wishlist product IDs
 * GET /products/wishlist/ids
 */
router.get(
  '/wishlist/ids',
  requireAuth,
  productController.getWishlistProductIds
);

/**
 * Clear wishlist
 * DELETE /products/wishlist
 */
router.delete(
  '/wishlist',
  requireAuth,
  productController.clearWishlist
);

/**
 * Toggle wishlist
 * POST /products/wishlist/:productId
 */
router.post(
  '/wishlist/:productId',
  requireAuth,
  productController.toggleWishlist
);

/**
 * Check if in wishlist
 * GET /products/wishlist/:productId/check
 */
router.get(
  '/wishlist/:productId/check',
  requireAuth,
  productController.checkWishlist
);

// ============================================
// 🔥 RECENTLY VIEWED STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Get recently viewed
 * GET /products/recently-viewed
 */
router.get(
  '/recently-viewed',
  requireAuth,
  productController.getRecentlyViewed
);

/**
 * Clear recently viewed
 * DELETE /products/recently-viewed
 */
router.delete(
  '/recently-viewed',
  requireAuth,
  productController.clearRecentlyViewed
);

/**
 * Add to recently viewed
 * POST /products/recently-viewed/:productId
 */
router.post(
  '/recently-viewed/:productId',
  requireAuth,
  productController.addRecentlyViewed
);

// ============================================
// 🔥 COMPARE & EXPORT STATIC ENDPOINTS (Must come before /:id)
// ============================================

/**
 * Compare products
 * POST /products/compare
 */
router.post(
  '/compare',
  requireInventoryPermission('inventory:view'),
  productController.compareProducts
);

/**
 * Export products
 * GET /products/export
 */
router.get(
  '/export',
  requireInventoryPermission('inventory:view'),
  productController.exportProducts
);

/**
 * Import products
 * POST /products/import
 */
router.post(
  '/import',
  requireInventoryPermission('inventory:create'),
  productController.importProducts
);

/**
 * Download import template
 * GET /products/import/template
 */
router.get(
  '/import/template',
  requireInventoryPermission('inventory:view'),
  productController.downloadImportTemplate
);

// ============================================
// 🔥 DYNAMIC PRODUCT ENDPOINTS (Must come AFTER static routes)
// ============================================

/**
 * Create a new product
 * POST /products
 * 🔥 NOTE: createProductSchema has .refine() which makes it a ZodEffects type
 * We handle validation inside the controller instead
 */
router.post(
  '/',
  requireInventoryPermission('inventory:create'),
  productController.createProduct
);

/**
 * Get product by ID
 * GET /products/:id
 */
router.get(
  '/:id',
  requireInventoryPermission('inventory:view'),
  productController.getProductById
);

/**
 * Update a product
 * PUT /products/:id
 */
router.put(
  '/:id',
  requireInventoryPermission('inventory:edit'),
  validateRequest(updateProductSchema),
  productController.updateProduct
);

/**
 * Delete a product (soft delete)
 * DELETE /products/:id
 */
router.delete(
  '/:id',
  requireInventoryPermission('inventory:delete'),
  productController.deleteProduct
);

/**
 * Unlink product from inventory
 * POST /products/:id/unlink-inventory
 */
router.post(
  '/:id/unlink-inventory',
  requireInventoryPermission('inventory:edit'),
  productController.unlinkProductFromInventory
);

/**
 * Get related products
 * GET /products/:id/related
 */
router.get(
  '/:id/related',
  requireInventoryPermission('inventory:view'),
  productController.getRelatedProducts
);

/**
 * Generate barcode for product
 * POST /products/:id/barcode
 */
router.post(
  '/:id/barcode',
  requireInventoryPermission('inventory:edit'),
  validateRequest(generateBarcodeSchema),
  productController.generateBarcode
);

/**
 * Get barcode info for product
 * GET /products/:id/barcode
 */
router.get(
  '/:id/barcode',
  requireInventoryPermission('inventory:view'),
  productController.getProductBarcode
);

/**
 * Get barcode image
 * GET /products/:id/barcode/image
 */
router.get(
  '/:id/barcode/image',
  requireInventoryPermission('inventory:view'),
  productController.getBarcodeImage
);

/**
 * Get QR code
 * GET /products/:id/qrcode
 */
router.get(
  '/:id/qrcode',
  requireInventoryPermission('inventory:view'),
  productController.getProductQRCode
);

/**
 * Associate barcode with product
 * POST /products/:id/barcode/associate
 */
router.post(
  '/:id/barcode/associate',
  requireInventoryPermission('inventory:edit'),
  validateRequest(associateBarcodeSchema),
  productController.associateBarcode
);

/**
 * Add a variant to a product
 * POST /products/:id/variants
 */
router.post(
  '/:id/variants',
  requireInventoryPermission('inventory:edit'),
  validateRequest(createVariantSchema),
  productController.addVariant
);

/**
 * Bulk create variants
 * POST /products/:id/variants/bulk
 */
router.post(
  '/:id/variants/bulk',
  requireInventoryPermission('inventory:edit'),
  validateRequest(bulkCreateVariantsSchema),
  productController.bulkCreateVariants
);

/**
 * Get product variants
 * GET /products/:id/variants
 */
router.get(
  '/:id/variants',
  requireInventoryPermission('inventory:view'),
  productController.getProductVariants
);

/**
 * Get product reviews
 * GET /products/:id/reviews
 */
router.get(
  '/:id/reviews',
  requireInventoryPermission('inventory:view'),
  productController.getProductReviews
);

/**
 * Get review stats
 * GET /products/:id/reviews/stats
 */
router.get(
  '/:id/reviews/stats',
  requireInventoryPermission('inventory:view'),
  productController.getReviewStats
);

/**
 * Export product reviews
 * GET /products/:id/reviews/export
 */
router.get(
  '/:id/reviews/export',
  requireInventoryPermission('inventory:view'),
  productController.exportProductReviews
);

/**
 * Create product review
 * POST /products/:id/reviews
 */
router.post(
  '/:id/reviews',
  requireInventoryPermission('inventory:view'),
  validateRequest(createProductReviewSchema),
  productController.createProductReview
);

// ============================================
// 🔥 FALLBACK 404 HANDLER FOR PRODUCTS ROUTE
// ============================================

router.use((req: any, res: any) => {
  res.status(404).json({
    success: false,
    message: 'Product route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /products',
      'GET /products/:id',
      'GET /products/check-sku/:sku',
      'GET /products/sku/:sku',
      'GET /products/barcode/:barcode',
      'POST /products',
      'PUT /products/:id',
      'DELETE /products/:id',
      'POST /products/:id/unlink-inventory',
      'GET /products/featured',
      'GET /products/popular',
      'GET /products/new-arrivals',
      'GET /products/public',
      'GET /products/search',
      'GET /products/tags',
      'GET /products/statistics',
      'GET /products/no-barcode',
      'GET /products/:id/related',
      'POST /products/:id/barcode',
      'POST /products/barcode/generate',
      'GET /products/:id/barcode',
      'GET /products/:id/barcode/image',
      'GET /products/:id/qrcode',
      'POST /products/barcode/image',
      'POST /products/qrcode',
      'POST /products/:id/barcode/associate',
      'POST /products/barcode/validate',
      'POST /products/barcode/bulk-generate',
      'POST /products/barcode/scan',
      'POST /products/:id/variants',
      'POST /products/:id/variants/bulk',
      'GET /products/:id/variants',
      'GET /products/variants/:variantId',
      'GET /products/variants/barcode/:barcode',
      'GET /products/variants/sku/:sku',
      'PUT /products/variants/:variantId',
      'DELETE /products/variants/:variantId',
      'PATCH /products/variants/:variantId/stock',
      'POST /products/variants/bulk/delete',
      'GET /products/:id/reviews',
      'GET /products/:id/reviews/stats',
      'GET /products/:id/reviews/export',
      'POST /products/:id/reviews',
      'PUT /products/reviews/:reviewId',
      'DELETE /products/reviews/:reviewId',
      'PATCH /products/reviews/:reviewId/verify',
      'POST /products/reviews/:reviewId/helpful',
      'POST /products/reviews/:reviewId/report',
      'GET /products/categories',
      'GET /products/categories/tree',
      'GET /products/categories/:id',
      'GET /products/categories/:id/products',
      'POST /products/categories',
      'PUT /products/categories/:id',
      'DELETE /products/categories/:id',
      'GET /products/suppliers',
      'GET /products/suppliers/:id',
      'GET /products/suppliers/:id/products',
      'POST /products/suppliers',
      'PUT /products/suppliers/:id',
      'DELETE /products/suppliers/:id',
      'POST /products/bulk',
      'POST /products/bulk/delete',
      'POST /products/bulk/activate',
      'POST /products/bulk/deactivate',
      'POST /products/bulk/update-prices',
      'POST /products/bulk/update-stock',
      'POST /products/wishlist/:productId',
      'GET /products/wishlist',
      'GET /products/wishlist/:productId/check',
      'GET /products/wishlist/count',
      'GET /products/wishlist/ids',
      'DELETE /products/wishlist',
      'POST /products/recently-viewed/:productId',
      'GET /products/recently-viewed',
      'DELETE /products/recently-viewed',
      'POST /products/compare',
      'GET /products/export',
      'POST /products/import',
      'GET /products/import/template',
      'GET /products/health',
    ],
  });
});

export default router;
