// packages/web/types/cart.ts

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
   * ── Phase 2: ISO 4217 currency code ────────────────────────────
   *
   * Resolved server-side from the cart's own business unit via
   * `currencyService.resolveForBusiness(businessUnit.currency)` —
   * the same walk used by `checkoutService` and `paymentService`.
   *
   * This is the ONLY authoritative source for what currency every
   * amount on this cart is denominated in: `subtotal`, `tax`,
   * `discount`, `total`, and every line's `unitPrice` / `total`.
   *
   * ⚠ Always pass this to `formatCurrency` as the second argument:
   *
   *     formatCurrency(cart.total, cart.currency)
   *
   *   A UGX cart that renders with a `$` is a bug this field exists
   *   to prevent. Do not hardcode a currency anywhere on the cart UI
   *   — read this field.
   *
   * The synthetic stub returned by `GET /cart` for a user with no
   * active cart carries this field too — it is resolved from the
   * caller's business unit, not left undefined. There is no case
   * where a well-formed `Cart` response lacks this field.
   */
  currency: string;

  /**
   * ── Phase 2: display symbol for `currency` ─────────────────────
   *
   * Derived server-side from the registry
   * (`currencyService.tryGetCurrency(code)?.symbol`). Falls back to
   * the ISO code itself when the registry has no symbol registered.
   *
   * ⚠ Prefer passing `currency` (the code) to `Intl.NumberFormat` —
   *   the browser's own formatting is more robust across locales
   *   than prefixing a symbol. Use this field only for contexts that
   *   cannot call `Intl` (the discount-type `<select>` in
   *   `CartSummary`, CSV exports, plain-text emails).
   *
   * Never persisted — always computed from `currency` at read time.
   * See the `CartResponse.currencySymbol` JSDoc in the backend
   * `cartService.ts` for the full rationale.
   */
  currencySymbol: string;

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
 *
 * ⚠ Currency is NEVER a client-supplied input. The cart's display
 *   currency is resolved server-side from the business unit and
 *   surfaced on the RESPONSE (see `Cart.currency`). Do not add a
 *   `currency` field here.
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

  /**
   * ── Phase 2: ISO 4217 currency code. ──────────────────────────
   *
   * Same resolution as `Cart.currency`: resolved server-side from
   * the cart's business unit. Both branches of the backend handler
   * (`GET /cart/summary` with and without an active cart) populate
   * it.
   *
   * ⚠ Marked OPTIONAL here — unlike `Cart.currency` — because
   *   pre-Phase-2 cached responses may not carry it. Callers should
   *   fall back to `'UGX'` (the registry default) rather than
   *   `'USD'`:
   *
   *     const currency = summary.currency ?? 'UGX';
   */
  currency?: string;

  /**
   * ── Phase 2: display symbol. ──────────────────────────────────
   *
   * See `Cart.currencySymbol`. Optional for the same reason as
   * `CartSummary.currency` above.
   */
  currencySymbol?: string;
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
