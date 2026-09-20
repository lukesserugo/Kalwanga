// D:\Projects\Kalwanga\packages\backend\src\routes\products.ts

import { Router } from 'express';
import { productController } from '../controllers/productController.js';
import { requireAuth } from '../middleware/auth.js';
import { requireInventoryPermission } from '../middleware/inventoryPermissions.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  updateProductSchema,
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
// PUBLIC ROUTES — no auth required
// ============================================
//
// ⚠️ ORDER MATTERS. Express matches top-to-bottom. Every static
//    sub-path under `/public/*` MUST be declared BEFORE the dynamic
//    `/public/:id` route, or a request to `/public/categories`
//    resolves to `getPublicProductById('categories')` and returns
//    `500 Invalid product ID format`.
//
// Everything below `router.use(requireAuth)` inherits the auth
// middleware and must NOT be relied on for anonymous storefront
// traffic.

/**
 * Health check for the products route.
 * GET /products/health
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Products route is healthy',
    timestamp: new Date().toISOString(),
    routesCount: 73,
  });
});

/**
 * Public: list products (auto-hides out-of-stock items).
 * GET /products/public
 */
router.get('/public', productController.getPublicProducts);

/**
 * Public: categories for the storefront.
 * GET /products/public/categories
 *
 * ⚠️ MUST come before `/public/:id`.
 */
router.get(
  '/public/categories',
  productController.getPublicCategories,
);

/**
 * Public: products inside a public category.
 * GET /products/public/categories/:id/products
 *
 * ⚠️ MUST come before `/public/:id`.
 */
router.get(
  '/public/categories/:id/products',
  productController.getPublicCategoryProducts,
);

/**
 * Public: featured products.
 * GET /products/public/featured
 */
router.get(
  '/public/featured',
  productController.getPublicFeatured,
);

/**
 * Public: new arrivals.
 * GET /products/public/new-arrivals
 */
router.get(
  '/public/new-arrivals',
  productController.getPublicNewArrivals,
);

/**
 * Public: search.
 * GET /products/public/search
 */
router.get(
  '/public/search',
  productController.getPublicSearch,
);

/**
 * Public: single product by id.
 * GET /products/public/:id
 *
 * ⚠️ MUST be the LAST `/public/*` route declared. Anything after
 *    this is unreachable for anonymous requests.
 */
router.get(
  '/public/:id',
  productController.getPublicProductById,
);

// ============================================
// AUTH — everything below requires a token
// ============================================

router.use(requireAuth);

// ============================================
// DEBUG (development only)
// ============================================

if (process.env.NODE_ENV !== 'production') {
  router.get('/debug', (req: any, res: any) => {
    const user = req.user || null;
    res.json({
      success: true,
      message: 'Products route is working',
      user: user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
            businessUnitId: user.businessUnitId,
            companyId: user.companyId,
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  });
}

// ============================================
// AUTHENTICATED ROUTES — static before dynamic
// ============================================
//
// Every static single-segment or multi-segment path (e.g.
// `/featured`, `/categories/tree`, `/variants/barcode/:barcode`)
// MUST be declared before any dynamic sibling (`/:id`,
// `/categories/:id`, `/variants/:variantId`). Otherwise Express
// resolves the dynamic one first.

// ============================================
// SKU CHECK
// ============================================

/**
 * Check if a SKU already exists.
 * GET /products/check-sku/:sku
 * Query: ?businessUnitId=xxx&excludeProductId=xxx
 */
router.get(
  '/check-sku/:sku',
  requireInventoryPermission('inventory:view'),
  productController.checkSKUExists,
);

// ============================================
// STATIC PRODUCT LISTS
// ============================================

/**
 * List products with filtering and pagination.
 * GET /products
 */
router.get(
  '/',
  requireInventoryPermission('inventory:view'),
  productController.getAllProducts,
);

/**
 * Featured products.
 * GET /products/featured
 */
router.get(
  '/featured',
  requireInventoryPermission('inventory:view'),
  productController.getFeaturedProducts,
);

/**
 * Popular products.
 * GET /products/popular
 */
router.get(
  '/popular',
  requireInventoryPermission('inventory:view'),
  productController.getPopularProducts,
);

/**
 * Newly arrived products.
 * GET /products/new-arrivals
 */
router.get(
  '/new-arrivals',
  requireInventoryPermission('inventory:view'),
  productController.getNewArrivals,
);

/**
 * Full-text search.
 * GET /products/search
 */
router.get(
  '/search',
  requireInventoryPermission('inventory:view'),
  productController.searchProducts,
);

/**
 * Distinct product tags with counts.
 * GET /products/tags
 */
router.get(
  '/tags',
  requireInventoryPermission('inventory:view'),
  productController.getTags,
);

/**
 * Aggregate product statistics.
 * GET /products/statistics
 */
router.get(
  '/statistics',
  requireInventoryPermission('inventory:view'),
  productController.getProductStatistics,
);

/**
 * Products missing a barcode.
 * GET /products/no-barcode
 */
router.get(
  '/no-barcode',
  requireInventoryPermission('inventory:view'),
  productController.getProductsWithoutBarcode,
);

/**
 * Look up a product by SKU.
 * GET /products/sku/:sku
 */
router.get(
  '/sku/:sku',
  requireInventoryPermission('inventory:view'),
  productController.getProductBySku,
);

/**
 * Look up a product by barcode.
 * GET /products/barcode/:barcode
 */
router.get(
  '/barcode/:barcode',
  requireInventoryPermission('inventory:view'),
  productController.getProductByBarcode,
);

// ============================================
// BARCODE UTILITIES
// ============================================

/**
 * Generate a unique barcode without associating it to a product.
 * POST /products/barcode/generate
 */
router.post(
  '/barcode/generate',
  requireInventoryPermission('inventory:edit'),
  productController.generateUniqueBarcode,
);

/**
 * Render a barcode image from a string.
 * POST /products/barcode/image
 */
router.post(
  '/barcode/image',
  requireInventoryPermission('inventory:view'),
  productController.generateBarcodeImage,
);

/**
 * Render a QR code from arbitrary data.
 * POST /products/qrcode
 */
router.post(
  '/qrcode',
  requireInventoryPermission('inventory:view'),
  productController.generateQRCode,
);

/**
 * Check whether a barcode is available.
 * POST /products/barcode/validate
 */
router.post(
  '/barcode/validate',
  requireInventoryPermission('inventory:view'),
  validateRequest(validateBarcodeSchema),
  productController.validateBarcode,
);

/**
 * Generate barcodes for a batch of products.
 * POST /products/barcode/bulk-generate
 */
router.post(
  '/barcode/bulk-generate',
  requireInventoryPermission('inventory:edit'),
  productController.bulkGenerateBarcodes,
);

/**
 * Resolve a barcode (or variant SKU) to a product / variant.
 * POST /products/barcode/scan
 */
router.post(
  '/barcode/scan',
  requireInventoryPermission('inventory:view'),
  productController.scanBarcode,
);

// ============================================
// VARIANTS — static paths MUST come first
// ============================================
//
// `/variants/barcode/:barcode` and `/variants/sku/:sku` are
// two-segment paths; `/variants/:variantId` is one segment. If the
// dynamic one is declared first, the two-segment lookups are
// unreachable.
//
// Order below: barcode → sku → bulk → :variantId.

/**
 * Variant by barcode.
 * GET /products/variants/barcode/:barcode
 */
router.get(
  '/variants/barcode/:barcode',
  requireInventoryPermission('inventory:view'),
  productController.getVariantByBarcode,
);

/**
 * Variant by SKU.
 * GET /products/variants/sku/:sku
 */
router.get(
  '/variants/sku/:sku',
  requireInventoryPermission('inventory:view'),
  productController.getVariantBySku,
);

/**
 * Delete variants in bulk.
 * POST /products/variants/bulk/delete
 */
router.post(
  '/variants/bulk/delete',
  requireInventoryPermission('inventory:delete'),
  productController.bulkDeleteVariants,
);

/**
 * Variant by id.
 * GET /products/variants/:variantId
 */
router.get(
  '/variants/:variantId',
  requireInventoryPermission('inventory:view'),
  productController.getVariantById,
);

/**
 * Update a variant.
 * PUT /products/variants/:variantId
 */
router.put(
  '/variants/:variantId',
  requireInventoryPermission('inventory:edit'),
  validateRequest(updateVariantSchema),
  productController.updateVariant,
);

/**
 * Delete a variant.
 * DELETE /products/variants/:variantId
 */
router.delete(
  '/variants/:variantId',
  requireInventoryPermission('inventory:delete'),
  productController.deleteVariant,
);

/**
 * Set a variant's stock to an exact quantity.
 * PATCH /products/variants/:variantId/stock
 */
router.patch(
  '/variants/:variantId/stock',
  requireInventoryPermission('inventory:edit'),
  validateRequest(updateVariantStockSchema),
  productController.updateVariantStock,
);

// ============================================
// REVIEWS — static single-segment routes
// ============================================

/**
 * Update a review.
 * PUT /products/reviews/:reviewId
 */
router.put(
  '/reviews/:reviewId',
  requireInventoryPermission('inventory:edit'),
  productController.updateProductReview,
);

/**
 * Delete a review.
 * DELETE /products/reviews/:reviewId
 */
router.delete(
  '/reviews/:reviewId',
  requireInventoryPermission('inventory:delete'),
  productController.deleteProductReview,
);

/**
 * Mark a review as verified.
 * PATCH /products/reviews/:reviewId/verify
 */
router.patch(
  '/reviews/:reviewId/verify',
  requireInventoryPermission('inventory:edit'),
  productController.verifyReview,
);

/**
 * Mark a review as helpful.
 * POST /products/reviews/:reviewId/helpful
 */
router.post(
  '/reviews/:reviewId/helpful',
  requireInventoryPermission('inventory:view'),
  productController.markReviewHelpful,
);

/**
 * Report a review.
 * POST /products/reviews/:reviewId/report
 */
router.post(
  '/reviews/:reviewId/report',
  requireInventoryPermission('inventory:view'),
  productController.reportReview,
);

// ============================================
// CATEGORIES — static paths before dynamic
// ============================================

/**
 * Category tree (nested).
 * GET /products/categories/tree
 *
 * ⚠️ MUST come before `/categories/:id`.
 */
router.get(
  '/categories/tree',
  requireInventoryPermission('inventory:view'),
  productController.getCategoryTree,
);

/**
 * All categories for the current BU.
 * GET /products/categories
 */
router.get(
  '/categories',
  requireInventoryPermission('inventory:view'),
  productController.getCategories,
);

/**
 * Create a category.
 * POST /products/categories
 */
router.post(
  '/categories',
  requireInventoryPermission('inventory:manage_categories'),
  validateRequest(createCategorySchema),
  productController.createCategory,
);

/**
 * Products in a category.
 * GET /products/categories/:id/products
 *
 * ⚠️ MUST come before `/categories/:id`.
 */
router.get(
  '/categories/:id/products',
  requireInventoryPermission('inventory:view'),
  productController.getCategoryProducts,
);

/**
 * Category by id.
 * GET /products/categories/:id
 */
router.get(
  '/categories/:id',
  requireInventoryPermission('inventory:view'),
  productController.getCategoryById,
);

/**
 * Update a category.
 * PUT /products/categories/:id
 */
router.put(
  '/categories/:id',
  requireInventoryPermission('inventory:manage_categories'),
  validateRequest(updateCategorySchema),
  productController.updateCategory,
);

/**
 * Delete a category.
 * DELETE /products/categories/:id
 */
router.delete(
  '/categories/:id',
  requireInventoryPermission('inventory:manage_categories'),
  productController.deleteCategory,
);

// ============================================
// SUPPLIERS
// ============================================

/**
 * All suppliers for the current company.
 * GET /products/suppliers
 */
router.get(
  '/suppliers',
  requireInventoryPermission('inventory:view'),
  productController.getSuppliers,
);

/**
 * Create a supplier.
 * POST /products/suppliers
 */
router.post(
  '/suppliers',
  requireInventoryPermission('inventory:manage_suppliers'),
  validateRequest(createSupplierSchema),
  productController.createSupplier,
);

/**
 * Products for a supplier.
 * GET /products/suppliers/:id/products
 *
 * ⚠️ MUST come before `/suppliers/:id`.
 */
router.get(
  '/suppliers/:id/products',
  requireInventoryPermission('inventory:view'),
  productController.getSupplierProducts,
);

/**
 * Supplier by id.
 * GET /products/suppliers/:id
 */
router.get(
  '/suppliers/:id',
  requireInventoryPermission('inventory:view'),
  productController.getSupplierById,
);

/**
 * Update a supplier.
 * PUT /products/suppliers/:id
 */
router.put(
  '/suppliers/:id',
  requireInventoryPermission('inventory:manage_suppliers'),
  validateRequest(updateSupplierSchema),
  productController.updateSupplier,
);

/**
 * Delete a supplier.
 * DELETE /products/suppliers/:id
 */
router.delete(
  '/suppliers/:id',
  requireInventoryPermission('inventory:manage_suppliers'),
  productController.deleteSupplier,
);

// ============================================
// WISHLIST
// ============================================
//
// `requireAuth` is already applied at the router level above. No
// per-route override needed.
//
// ⚠️ `/wishlist/count` and `/wishlist/ids` are static — they MUST
//    come before `/wishlist/:productId/check` and
//    `/wishlist/:productId`.

/**
 * Wishlist count.
 * GET /products/wishlist/count
 */
router.get('/wishlist/count', productController.getWishlistCount);

/**
 * Just the product ids in the wishlist.
 * GET /products/wishlist/ids
 */
router.get('/wishlist/ids', productController.getWishlistProductIds);

/**
 * Get the current user's wishlist.
 * GET /products/wishlist
 */
router.get('/wishlist', productController.getWishlist);

/**
 * Clear the wishlist.
 * DELETE /products/wishlist
 */
router.delete('/wishlist', productController.clearWishlist);

/**
 * Is a product in the wishlist?
 * GET /products/wishlist/:productId/check
 */
router.get(
  '/wishlist/:productId/check',
  productController.checkWishlist,
);

/**
 * Toggle a product in / out of the wishlist.
 * POST /products/wishlist/:productId
 */
router.post('/wishlist/:productId', productController.toggleWishlist);

// ============================================
// RECENTLY VIEWED
// ============================================

/**
 * Recently viewed products for the current user.
 * GET /products/recently-viewed
 */
router.get('/recently-viewed', productController.getRecentlyViewed);

/**
 * Clear recently viewed.
 * DELETE /products/recently-viewed
 */
router.delete(
  '/recently-viewed',
  productController.clearRecentlyViewed,
);

/**
 * Record a product view.
 * POST /products/recently-viewed/:productId
 */
router.post(
  '/recently-viewed/:productId',
  productController.addRecentlyViewed,
);

// ============================================
// COMPARE / EXPORT / IMPORT
// ============================================

/**
 * Compare multiple products side by side.
 * POST /products/compare
 */
router.post(
  '/compare',
  requireInventoryPermission('inventory:view'),
  productController.compareProducts,
);

/**
 * Export products as CSV / JSON.
 * GET /products/export
 */
router.get(
  '/export',
  requireInventoryPermission('inventory:view'),
  productController.exportProducts,
);

/**
 * Download the CSV import template.
 * GET /products/import/template
 *
 * ⚠️ MUST come before `/import` if `/import` ever gains a dynamic
 *    sibling. Safe here because `/import` is a POST and this is a GET.
 */
router.get(
  '/import/template',
  requireInventoryPermission('inventory:view'),
  productController.downloadImportTemplate,
);

/**
 * Import products from a CSV payload.
 * POST /products/import
 */
router.post(
  '/import',
  requireInventoryPermission('inventory:create'),
  productController.importProducts,
);

// ============================================
// DYNAMIC /:id ROUTES — MUST come last
// ============================================
//
// Everything below uses `:id` as the first dynamic segment. If any
// static single-segment route above were declared after these,
// Express would resolve them to `getProductById('<static-name>')`.

/**
 * Create a product.
 * POST /products
 *
 * ⚠️ `createProductSchema` uses `.refine()`, which produces a
 *    ZodEffects instance that `validateRequest` cannot consume. The
 *    controller validates inline instead.
 */
router.post(
  '/',
  requireInventoryPermission('inventory:create'),
  productController.createProduct,
);

/**
 * Product by id.
 * GET /products/:id
 */
router.get(
  '/:id',
  requireInventoryPermission('inventory:view'),
  productController.getProductById,
);

/**
 * Update a product.
 * PUT /products/:id
 */
router.put(
  '/:id',
  requireInventoryPermission('inventory:edit'),
  validateRequest(updateProductSchema),
  productController.updateProduct,
);

/**
 * Delete a product (soft delete by default).
 * DELETE /products/:id
 */
router.delete(
  '/:id',
  requireInventoryPermission('inventory:delete'),
  productController.deleteProduct,
);

/**
 * Unlink a product from its inventory without deleting either.
 * POST /products/:id/unlink-inventory
 */
router.post(
  '/:id/unlink-inventory',
  requireInventoryPermission('inventory:edit'),
  productController.unlinkProductFromInventory,
);

/**
 * Related products.
 * GET /products/:id/related
 */
router.get(
  '/:id/related',
  requireInventoryPermission('inventory:view'),
  productController.getRelatedProducts,
);

/**
 * Generate a barcode for a product.
 * POST /products/:id/barcode
 */
router.post(
  '/:id/barcode',
  requireInventoryPermission('inventory:edit'),
  validateRequest(generateBarcodeSchema),
  productController.generateBarcode,
);

/**
 * Get a product's barcode info.
 * GET /products/:id/barcode
 */
router.get(
  '/:id/barcode',
  requireInventoryPermission('inventory:view'),
  productController.getProductBarcode,
);

/**
 * Get a product's barcode image.
 * GET /products/:id/barcode/image
 */
router.get(
  '/:id/barcode/image',
  requireInventoryPermission('inventory:view'),
  productController.getBarcodeImage,
);

/**
 * Get a product's QR code.
 * GET /products/:id/qrcode
 */
router.get(
  '/:id/qrcode',
  requireInventoryPermission('inventory:view'),
  productController.getProductQRCode,
);

/**
 * Associate a barcode with a product.
 * POST /products/:id/barcode/associate
 */
router.post(
  '/:id/barcode/associate',
  requireInventoryPermission('inventory:edit'),
  validateRequest(associateBarcodeSchema),
  productController.associateBarcode,
);

/**
 * Add a variant to a product.
 * POST /products/:id/variants
 */
router.post(
  '/:id/variants',
  requireInventoryPermission('inventory:edit'),
  validateRequest(createVariantSchema),
  productController.addVariant,
);

/**
 * Bulk create variants for a product.
 * POST /products/:id/variants/bulk
 */
router.post(
  '/:id/variants/bulk',
  requireInventoryPermission('inventory:edit'),
  validateRequest(bulkCreateVariantsSchema),
  productController.bulkCreateVariants,
);

/**
 * List variants for a product.
 * GET /products/:id/variants
 */
router.get(
  '/:id/variants',
  requireInventoryPermission('inventory:view'),
  productController.getProductVariants,
);

/**
 * Review stats for a product.
 * GET /products/:id/reviews/stats
 *
 * ⚠️ MUST come before `/:id/reviews` — different segment count, but
 *    declared first for consistency with the rest of the file.
 */
router.get(
  '/:id/reviews/stats',
  requireInventoryPermission('inventory:view'),
  productController.getReviewStats,
);

/**
 * Export a product's reviews.
 * GET /products/:id/reviews/export
 */
router.get(
  '/:id/reviews/export',
  requireInventoryPermission('inventory:view'),
  productController.exportProductReviews,
);

/**
 * List reviews for a product.
 * GET /products/:id/reviews
 */
router.get(
  '/:id/reviews',
  requireInventoryPermission('inventory:view'),
  productController.getProductReviews,
);

/**
 * Create a review for a product.
 * POST /products/:id/reviews
 */
router.post(
  '/:id/reviews',
  requireInventoryPermission('inventory:view'),
  validateRequest(createProductReviewSchema),
  productController.createProductReview,
);

// ============================================
// FALLBACK 404
// ============================================
//
// Reached only when no route above matched. Kept terse so we don't
// leak the full route table to unauth'd scanners in production.

router.use((req: any, res: any) => {
  res.status(404).json({
    success: false,
    message: 'Product route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

export default router;
