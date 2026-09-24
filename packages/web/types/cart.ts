// D:\Projects\Kalwanga\packages\web\types\cart.ts

/**
 * Single source of truth for cart shapes on the web client.
 *
 * `services/cartService.ts` re-exports these — do NOT redefine `Cart`
 * or `CartItem` there. Component code and service code must agree, and
 * the only way to guarantee that is one definition.
 *
 * These mirror the *response* shape of `packages/backend`'s
 * `CartService.formatCartResponse`. Two invariants from the backend:
 *
 *   - `CartItem.variantId` is `undefined` when there is no variant.
 *     The backend never returns `null` here. Clients may *send* `null`
 *     when adding items (see `CartItemInput`), but they never receive it.
 *
 *   - `CartItem.variant.attributes` is `Json` in Postgres, so the
 *     backend types it as `any`. We narrow to `Record<string, unknown>`
 *     on the client to force callers to assert before use.
 */

export type CartStatus = 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED';

export type CartDiscountType = 'PERCENTAGE' | 'FIXED';

export interface CartCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
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
  attributes: Record<string, unknown>;
}

export interface CartItem {
  id: string;
  productId: string;
  product: CartItemProduct;

  /**
   * `undefined` when the line is a plain product (no variant).
   * NOTE: the backend normalizes `null` → `undefined` before persisting,
   * so the response never contains `null`. Clients that *send* `null`
   * are accommodated by `CartItemInput.variantId` below.
   */
  variantId?: string;
  variant?: CartItemVariant;

  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  availableStock: number;
  isInStock: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerId?: string;
  customer?: CartCustomer;
  businessUnitId: string;
  userId: string;
  notes?: string;
  status: CartStatus;
  itemCount: number;
  discountType?: CartDiscountType;
  promotionCode?: string;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
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
// SECONDARY RESPONSE TYPES
// ============================================

export interface CartSummaryItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  variantName?: string;
}

export interface CartSummary {
  id: string;
  itemCount: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: CartSummaryItem[];
}

export interface CartCountResponse {
  count: number;
}

export interface CartHistoryResponse {
  carts: Cart[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface SyncResult {
  valid: boolean;
  issues: string[];
}

export interface SplitCartResult {
  sourceCart: Cart;
  targetCarts: Cart[];
}
