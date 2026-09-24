// D:\Projects\Kalwanga\packages\backend\src\routes\pos.ts

import { Router } from 'express';
import { posController } from '../controllers/posController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../generated/prisma/index.js';

const router = Router();

// All POS routes require authentication
router.use(requireAuth);

// ⚠️ ORDERING RULES FOR THIS FILE:
//   1. All static GET routes BEFORE parameterized GET routes.
//   2. All static POST/PUT/DELETE routes BEFORE `/:id` variants.
// Violating these will cause `/products/search` to match `/products/:id`,
// `/cart/details` to match nothing useful, etc.
//
// ─────────────────────────────────────────────────────────────────
//  IDEMPOTENCY CONTRACT
// ─────────────────────────────────────────────────────────────────
//  The only route on this router that creates a sale — and therefore
//  the only one that supports idempotency — is:
//
//      POST /api/pos/checkout
//
//  It honors an `Idempotency-Key` HTTP header (or an `idempotencyKey`
//  body field as a fallback). Sending the same key twice within any
//  time window returns the original sale — no duplicate row, no
//  double inventory decrement, no double loyalty award.
//
//  Related routers that expose the same contract:
//      POST /api/sales               (saleController.createSale)
//      POST /api/sales/checkout      (saleController.createSaleFromCart)
//      POST /api/sales/pos/checkout  (posController.checkout)  ← this one
//
//  Logic lives in:
//      • PosController.getIdempotencyKey
//      • SaleController.getIdempotencyKey
//      • SaleService.findSaleByIdempotencyKey / withIdempotency
//      • sales.idempotencyKey (nullable, unique index)
//
//  Routes on this router that do NOT support idempotency (by design):
//      * every cart-mutation and item-mutation route — they act on the
//        current cart, and repeating them is idempotent at the cart
//        level (setting the same discount twice is the same as once)
//      * every GET route — reads have no side effects
//
//  Those do not need keys.
//
// ─────────────────────────────────────────────────────────────────
//  PROMOTION / LOYALTY ATTRIBUTION
// ─────────────────────────────────────────────────────────────────
//  POST /api/pos/checkout accepts optional promotion / loyalty
//  passthrough fields in the request body, which are persisted on the
//  resulting `Sale` row so every POS sale self-documents its discount
//  source:
//
//      discountType       PERCENTAGE | FIXED | LOYALTY | MANUAL
//                         (must be one of the four Prisma enum
//                          members; inferred by the service when
//                          omitted; unknown values are dropped by
//                          the controller before reaching the DB)
//      promotionCode      the code that was applied, if any
//      promotionDiscount  the promotion's currency contribution
//
//  snake_case aliases (`discount_type`, `promotion_code`,
//  `promotion_discount`) are also accepted. String numerics for
//  `promotionDiscount` are coerced.
//
//  The loyalty side is already handled by `applyLoyaltyPoints: true`
//  in the same payload — the service computes `loyaltyPointsUsed` and
//  `loyaltyDiscount` and persists them on the sale alongside the
//  promotion columns.
//
//  Corresponding columns on `Sale` (Prisma field names):
//      discountType, promotionCode, promotionDiscount,
//      loyaltyPointsUsed, loyaltyDiscount
//
//  ⚠ `discountType` maps to the Postgres enum `"DiscountType"`,
//    defined in `prisma/schema.prisma`:
//
//        enum DiscountType {
//          PERCENTAGE
//          FIXED
//          LOYALTY
//          MANUAL
//        }
//
//    Do NOT send values outside this set. The `PromotionType` enum on
//    the `Promotion` model has additional members
//    (BUY_X_GET_Y, FREE_SHIPPING, BOGO, BUNDLE, TIERED); those
//    describe the *shape* of a promotion, not how the resulting
//    discount is attributed on a `Sale`.
// ─────────────────────────────────────────────────────────────────

// ============================================
// CART ROUTES
// ============================================

router.get('/cart', posController.getCart);
router.get('/cart/details', posController.getCartDetails);
router.delete('/cart', posController.clearCart);

// ============================================
// CART MODIFIER ROUTES
// ============================================

router.post(
  '/cart/discount',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.applyDiscount
);

router.post(
  '/cart/loyalty',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.applyLoyaltyPoints
);

router.post(
  '/cart/customer',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.associateCustomer
);

router.delete(
  '/cart/discount',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.removeDiscount
);

// ============================================
// ITEM ROUTES
// ============================================

router.post(
  '/items',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.addItem
);

router.post(
  '/items/bulk',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.addMultipleItems
);

router.put(
  '/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.updateItem
);

router.delete(
  '/items/:itemId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.removeItem
);

// ============================================
// CHECKOUT ROUTES
// ============================================

/**
 * POST /api/pos/checkout
 *
 * Idempotent via `Idempotency-Key` header (or `idempotencyKey` body field).
 *
 * Accepts optional promotion / loyalty passthrough fields:
 *   `discountType` (PERCENTAGE | FIXED | LOYALTY | MANUAL),
 *   `promotionCode`, `promotionDiscount` — plus their snake_case
 *   aliases. Persisted on the resulting `Sale` row.
 */
router.post(
  '/checkout',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.checkout
);

router.get(
  '/checkout/summary',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.getCheckoutSummary
);

// ============================================
// PRODUCT ROUTES
// ============================================

router.get('/products/search', posController.searchProducts);
router.get('/products/barcode/:barcode', posController.getProductByBarcode);
router.get('/products/sku/:sku', posController.getProductBySku);

router.get(
  '/products/:id',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.getProductById
);

// ============================================
// CUSTOMER ROUTES
// ============================================

router.get('/customers/search', posController.searchCustomers);
router.get('/customers/:id', posController.getCustomer);

router.post(
  '/customers',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.createCustomer
);

// ============================================
// SUMMARY & STATUS ROUTES
// ============================================

router.get('/summary', posController.getSummary);
router.get('/register/status', posController.getRegisterStatus);

router.get(
  '/stats',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  posController.getStats
);

router.get(
  '/transactions',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]),
  posController.getTransactions
);

// ============================================
// RECEIPT ROUTES
// ============================================

router.get(
  '/receipt/:saleId',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.getReceipt
);

router.get(
  '/receipt/number/:receiptNumber',
  requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]),
  posController.getReceiptByNumber
);

export default router;
