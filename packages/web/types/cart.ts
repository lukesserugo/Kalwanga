// packages/web/types/cart.ts

/**
 * Single source of truth for cart shapes on the web client.
 *
 * `services/cartService.ts` re-exports these — do NOT redefine `Cart`
 * or `CartItem` there. Component code and service code must agree, and
 * the only way to guarantee that is one definition.
 *
 * These mirror the *response* shape of `packages/backend`'s
 * `CartService.formatCartResponse`. Three invariants from the backend:
 *
 *   1. `CartItem.variantId` is `undefined` when there is no variant.
 *      The backend never returns `null` here. Clients may *send* `null`
 *      when adding items (see `CartItemInput`), but they never receive
 *      it.
 *
 *   2. `CartItem.variant.attributes` is `Json` in Postgres, so the
 *      backend types it as `any`. We narrow to `Record<string, unknown>`
 *      on the client to force callers to assert before use.
 *
 *   3. `GET /cart` returns a synthetic stub with `id: ''` when the
 *      user has no active cart. The next mutating call lazily creates
 *      a real cart and returns its actual id. See `Cart.id` below.
 */

// ============================================
// ENUMS / UNIONS
// ============================================

export type CartStatus = 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED';

/**
 * Cart-level discount category.
 *
 * Deliberately narrower than `Sale`'s `DiscountType`
 * (`'PERCENTAGE' | 'FIXED' | 'LOYALTY' | 'MANUAL'`). The cart field
 * only ever carries the first two — the backend's `applyDiscountSchema`
 * enforces exactly that (`z.enum(['PERCENTAGE', 'FIXED'])`). Loyalty
 * discounts live on the separate `loyaltyDiscount` field, and
 * promotions on `promotionDiscount`.
 */
export type CartDiscountType = 'PERCENTAGE' | 'FIXED';

// ============================================
// EMBEDDED SHAPES
// ============================================

/**
 * Customer embedded on a cart.
 *
 * The whole object is `undefined` when no customer is associated (see
 * `Cart.customer`). When it *is* present, the shape is whatever Prisma
 * returns from `include: { customer: true }` — and `Customer` in the
 * schema has `email` and `phoneNumber` as nullable string columns.
 *
 * Marking them optional here keeps the client type honest. A caller
 * reading `cart.customer.email` still has to guard, which matches the
 * runtime behaviour.
 */
export interface CartCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
}

export interface CartItemProduct {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images: string[];
}

export interface CartItemVariant {
  id: string;
  name: string;
  sku: string;
  price: number;

  /**
   * Prisma `Json` column, surfaced as `any` by the backend. Narrowed
   * to `Record<string, unknown>` on the client so callers must assert
   * before reading a specific attribute — this eliminates a class of
   * "I read `variant.attributes.size` and it was undefined at
   * runtime" bugs.
   */
  attributes: Record<string, unknown>;
}

// ============================================
// CART ITEM
// ============================================

export interface CartItem {
  id: string;
  productId: string;
  product: CartItemProduct;

  /**
   * `undefined` when the line is a plain product (no variant).
   *
   * NOTE: the backend normalizes `null` → `undefined` before
   * serializing (`formatCartResponse` does `item.variantId || undefined`),
   * so the response never contains `null`. Clients that *send* `null`
   * are accommodated by `CartItemInput.variantId` below.
   */
  variantId?: string;
  variant?: CartItemVariant;

  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;

  /**
   * Available stock for this line's product/variant, computed against
   * the CART's own business unit — not the caller's. Two carts in
   * different BUs can show different `availableStock` for the same
   * product.
   */
  availableStock: number;
  isInStock: boolean;
}

// ============================================
// CART
// ============================================

export interface Cart {
  /**
   * ⚠ Empty string when this is a synthetic stub returned by
   *   `GET /cart` for a user with no active cart. The backend's
   *   `getCartForRequest` builds the stub without creating a row;
   *   the next mutating call (`addItem`, `applyDiscount`, …) will
   *   lazily create a real cart and return its actual id.
   *
   *   Callers that navigate by id should guard against `''`:
   *
   *     if (cart.id) router.push(`/cart/${cart.id}`);
   */
  id: string;

  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;

  customerId?: string;
  customer?: CartCustomer;

  businessUnitId: string;

  /**
   * The authenticated user's id. For the synthetic stub returned by
   * `GET /cart`, this is the requesting user — no cart row exists.
   */
  userId: string;

  notes?: string;
  status: CartStatus;

  /**
   * Sum of quantities across all line items — NOT the number of line
   * items. A cart with one product × 3 returns `itemCount: 3`. Same
   * semantic as `CartCountResponse.count`.
   */
  itemCount: number;

  discountType?: CartDiscountType;
  promotionCode?: string;

  /**
   * Always populated by the backend (`cart.promotionDiscount || 0`),
   * so the wire shape is a plain `number`, not optional. The `?? 0`
   * at every read site was noise.
   */
  promotionDiscount: number;

  /**
   * Always populated by the backend. See `promotionDiscount`.
   */
  loyaltyPointsUsed: number;

  /**
   * Always populated by the backend. See `promotionDiscount`.
   */
  loyaltyDiscount: number;

  /**
   * ISO 8601 string. The backend serializes the Prisma `Date` to a
   * string via `res.json`; it never reaches the client as a `Date`.
   * Test fixtures should use `new Date().toISOString()`, not
   * `new Date()`.
   */
  createdAt: string;
  updatedAt: string;
}

// ============================================
// INPUT TYPES (client → server)
// ============================================

/**
 * Shape accepted by `POST /cart/items` and `POST /cart/items/bulk`.
 *
 * `variantId` accepts `null` at the input boundary because POS
 * quick-add sends `null` explicitly. The web service collapses it to
 * `undefined` before serializing, matching the backend controller's
 * `addItemSchema` which does the same.
 */
export interface CartItemInput {
  productId: string;
  variantId?: string | null;
  quantity?: number;
  notes?: string;
}

// ============================================
// SUMMARY
// ============================================

/**
 * Flattened line item returned by `GET /cart/summary`.
 *
 * NOTE: this shape is NOT the same as `CartItem`. The summary endpoint
 * flattens the product into `productName` and the variant into
 * `variantName`, rather than nesting them. Do not try to unify the two.
 */
export interface CartSummaryItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  variantName?: string;
}

export interface CartSummary {
  /**
   * Empty string when there is no active cart — same synthetic-stub
   * convention as `Cart.id`. See that field's doc for details.
   */
  id: string;
  itemCount: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: CartSummaryItem[];
}

// ============================================
// COUNT
// ============================================

export interface CartCountResponse {
  /**
   * Sum of quantities across all line items — NOT the number of line
   * items. A cart with one product × 3 returns `count: 3`.
   *
   * `cartService.getCartCount` returns `{ count: 0 }` on failure so a
   * broken count request never breaks the header badge.
   */
  count: number;
}

// ============================================
// HISTORY
// ============================================

export interface CartHistoryResponse {
  carts: Cart[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================
// SYNC
// ============================================

/**
 * Result of `POST /cart/sync`.
 *
 * `issues` carries human-readable strings, not machine-parseable
 * codes. A caller that wants to distinguish "out of stock" from "no
 * inventory record" would have to string-match. If you ever need to
 * branch on the kind, widen this to a discriminated union — the
 * backend strings are stable but not contracted.
 */
export interface SyncResult {
  valid: boolean;
  issues: string[];
}

// ============================================
// SPLIT
// ============================================

export interface SplitCartResult {
  sourceCart: Cart;
  targetCarts: Cart[];
}
