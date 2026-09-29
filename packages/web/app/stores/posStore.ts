// D:\Projects\Kalwanga\packages\web\app\stores\posStore.ts
import { create } from 'zustand';

// The store lives at app/stores/, so services are one level up.
import { saleService } from '../../services/saleService';
import type {
  Cart,
  CartItem,
  PosCheckoutData,
  PaymentMethod,
  DiscountType,
} from '../../services/saleService';

// ⚠ Import each type from the module that declares it.
//
// `types/index.ts` imports `Sale` and `SaleItem` from `./sale` for
// local use but does not re-export them, so `import { Sale } from
// '../../types'` fails with TS2459. Until that barrel is updated,
// import `Sale` from its source module. `Customer` *is* re-exported
// from the barrel, but importing it from `./customer` keeps every
// type import in this file pointed at a single, unambiguous source.
import type { Sale } from '../../types/sale';
import type { Customer } from '../../types/customer';

// ============================================
// ERROR EXTRACTION
// ============================================
//
// The backend emits errors in several shapes:
//   1. `{ error: { message } }`          ← AppError (most common)
//   2. `{ error: string }`
//   3. `{ message }`
//   4. `{ errors: [{ field, message }] }` ← Zod validation
//   5. `error.message`                    ← axios / JS
//
// The `api` client already logs all of these in dev. The store
// collapses them to one string for inline display.

function extractErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';

  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return String(error);
}

// ============================================
// CART NORMALIZATION
// ============================================
//
// `saleService` returns a fully-populated `Cart`. Defensive defaults
// guard against a backend that omits a field when it's zero (e.g.,
// no discount → key absent). Normalizing once at the boundary means
// the rest of the store can trust the shape.

interface CartSnapshot {
  cart: Cart | null;
  cartItems: CartItem[];
  cartSubtotal: number;
  cartTax: number;
  cartDiscount: number;
  cartTotal: number;
}

const EMPTY_CART_SNAPSHOT: CartSnapshot = {
  cart: null,
  cartItems: [],
  cartSubtotal: 0,
  cartTax: 0,
  cartDiscount: 0,
  cartTotal: 0,
};

function snapshotCart(cart: Cart | null | undefined): CartSnapshot {
  if (!cart) return { ...EMPTY_CART_SNAPSHOT };

  const c = cart as any;
  return {
    cart,
    cartItems: Array.isArray(c.items) ? c.items : [],
    cartSubtotal: Number(c.subtotal ?? 0),
    cartTax: Number(c.tax ?? 0),
    cartDiscount: Number(c.discount ?? 0),
    cartTotal: Number(c.total ?? 0),
  };
}

// ============================================
// STORE TYPES
// ============================================

interface POSState {
  // ── Cart state ──────────────────────────────
  cart: Cart | null;
  cartItems: CartItem[];
  cartTotal: number;
  cartSubtotal: number;
  cartTax: number;
  cartDiscount: number;

  // ── UI state ────────────────────────────────
  isLoading: boolean;
  isCheckoutOpen: boolean;
  isCustomerSearchOpen: boolean;
  isDiscountModalOpen: boolean;

  /**
   * Last error surfaced by any cart / checkout action. Cleared on
   * the next successful action, or explicitly via `clearError`.
   * Components can render this inline without wrapping every store
   * call in their own try/catch.
   */
  lastError: string | null;

  // ── Customer ────────────────────────────────
  selectedCustomer: Customer | null;

  // ── Search ──────────────────────────────────
  searchQuery: string;
  searchResults: unknown[];

  // ── Actions ─────────────────────────────────
  loadCart: () => Promise<void>;

  addItem: (
    productId: string,
    quantity?: number,
    variantId?: string,
  ) => Promise<void>;

  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;

  applyDiscount: (discount: number) => Promise<void>;
  applyLoyaltyPoints: (customerId: string, points: number) => Promise<void>;

  selectCustomer: (customer: Customer | null) => Promise<void>;

  setSearchQuery: (query: string) => void;
  setSearchResults: (results: unknown[]) => void;

  openCheckout: () => void;
  closeCheckout: () => void;
  openCustomerSearch: () => void;
  closeCustomerSearch: () => void;
  openDiscountModal: () => void;
  closeDiscountModal: () => void;

  processCheckout: (paymentData: PosCheckoutData) => Promise<Sale>;

  clearError: () => void;
  reset: () => void;
}

// ============================================
// STORE
// ============================================

export const usePOSStore = create<POSState>((set) => {
  /**
   * Monotonic id for cart-loading actions. Two concurrent `loadCart`
   * calls (React 18 StrictMode double-invoke in dev, or a manual
   * refresh racing an initial mount) can otherwise apply the older
   * response last. Only the highest id's response is kept.
   */
  let cartRequestId = 0;

  /**
   * Single funnel for applying a `Cart` payload to state.
   *
   * Every action that receives a Cart from `saleService` routes
   * through here, so the six cart fields can only be updated in one
   * place. `applyDiscount` in the previous version updated five of
   * them and silently dropped `cartItems`.
   */
  const applyCart = (
    cart: Cart | null | undefined,
    extra: Partial<POSState> = {},
  ): void => {
    set({
      ...snapshotCart(cart),
      lastError: null,
      ...extra,
    });
  };

  /**
   * Wraps a cart-mutating call: sets `isLoading`, clears the previous
   * error, invokes `fn`, applies the returned Cart (if any), records
   * the error on failure, and re-throws.
   *
   * Re-throwing is deliberate: a caller that wants to branch on the
   * failure (e.g. close a modal only on success) still can. Callers
   * that just want the inline banner read `lastError`.
   */
  const runCartAction = async (
    fn: () => Promise<Cart | null | undefined>,
    extra: Partial<POSState> = {},
  ): Promise<void> => {
    set({ isLoading: true, lastError: null });
    try {
      const cart = await fn();
      applyCart(cart ?? null, extra);
    } catch (error) {
      const message = extractErrorMessage(error);
      console.error('[POSStore] cart action failed:', message);
      set({ lastError: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  };

  return {
    // ── Initial state ───────────────────────
    cart: null,
    cartItems: [],
    cartTotal: 0,
    cartSubtotal: 0,
    cartTax: 0,
    cartDiscount: 0,

    isLoading: false,
    isCheckoutOpen: false,
    isCustomerSearchOpen: false,
    isDiscountModalOpen: false,

    lastError: null,

    selectedCustomer: null,

    searchQuery: '',
    searchResults: [],

    // ── Cart actions ────────────────────────

    /**
     * GET /sales/pos/cart
     *
     * The `api` client attaches `x-business-unit-id` from
     * localStorage, so no query param is required.
     */
    loadCart: async () => {
      const requestId = ++cartRequestId;
      set({ isLoading: true, lastError: null });
      try {
        const cart = await saleService.getPosCart();

        // Stale-response guard: a newer loadCart started while this
        // one was in flight. Drop this result.
        if (requestId !== cartRequestId) return;

        applyCart(cart);
      } catch (error) {
        if (requestId !== cartRequestId) return;

        const message = extractErrorMessage(error);
        console.error('[POSStore] loadCart failed:', message);
        set({ lastError: message });
        // Deliberately NOT rethrown: a failed cart load on mount
        // should not crash the tree. The error is on `lastError`.
      } finally {
        if (requestId === cartRequestId) {
          set({ isLoading: false });
        }
      }
    },

    /**
     * POST /sales/pos/items
     */
    addItem: async (productId, quantity = 1, variantId) => {
      await runCartAction(() =>
        saleService.addPosItem({ productId, quantity, variantId }),
      );
    },

    /**
     * PUT /sales/pos/items/:itemId
     */
    updateQuantity: async (itemId, quantity) => {
      await runCartAction(() =>
        saleService.updatePosItem(itemId, { quantity }),
      );
    },

    /**
     * DELETE /sales/pos/items/:itemId
     */
    removeItem: async (itemId) => {
      await runCartAction(() => saleService.removePosItem(itemId));
    },

    /**
     * DELETE /sales/pos/cart
     *
     * `clearPosCart` returns `{ message }`, not a Cart. After a
     * successful clear, the local snapshot is dropped regardless of
     * what the server returns.
     */
    clearCart: async () => {
      set({ isLoading: true, lastError: null });
      try {
        await saleService.clearPosCart();
        applyCart(null);
      } catch (error) {
        const message = extractErrorMessage(error);
        console.error('[POSStore] clearCart failed:', message);
        set({ lastError: message });
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    /**
     * POST /sales/pos/cart/discount
     *
     * Closes the discount modal in the same `set` as the cart
     * update, so the modal and the new totals render in one pass.
     */
    applyDiscount: async (discount) => {
      await runCartAction(
        () => saleService.applyPosDiscount(discount),
        { isDiscountModalOpen: false },
      );
    },

    /**
     * POST /sales/pos/cart/loyalty-points
     *
     * Mirrors to `Sale.loyaltyPointsUsed` / `Sale.loyaltyDiscount`
     * at checkout time.
     */
    applyLoyaltyPoints: async (customerId, points) => {
      await runCartAction(() =>
        saleService.applyPosLoyaltyPoints(customerId, points),
      );
    },

    /**
     * POST /sales/pos/cart/customer
     *
     * Previously fire-and-forget: the response was assigned to
     * `cart` without going through a reducer, so `cartItems` and
     * the totals silently desynced. Now it's a first-class action.
     */
    selectCustomer: async (customer) => {
      // Optimistically reflect the selection so the UI updates
      // immediately — the cart sync below is what actually persists.
      set({ selectedCustomer: customer });

      if (!customer) return;

      await runCartAction(() =>
        saleService.associatePosCustomer(customer.id),
      );
    },

    // ── Search ──────────────────────────────

    setSearchQuery: (query) => {
      set({ searchQuery: query });
    },

    setSearchResults: (results) => {
      set({ searchResults: results });
    },

    // ── UI toggles ──────────────────────────

    openCheckout: () => set({ isCheckoutOpen: true }),
    closeCheckout: () => set({ isCheckoutOpen: false }),

    openCustomerSearch: () => set({ isCustomerSearchOpen: true }),
    closeCustomerSearch: () => set({ isCustomerSearchOpen: false }),

    openDiscountModal: () => set({ isDiscountModalOpen: true }),
    closeDiscountModal: () => set({ isDiscountModalOpen: false }),

    // ── Checkout ────────────────────────────

    /**
     * POST /sales/pos/checkout
     *
     * `saleService.posCheckout` extracts `idempotencyKey` from the
     * body and sends it as the `Idempotency-Key` header, matching the
     * backend controller contract. Callers should reuse the same key
     * on every retry of the same logical sale — see
     * `saleService.generateIdempotencyKey()`.
     *
     * On success the local cart is dropped, the selected customer is
     * cleared (so the next sale doesn't inherit it), and the checkout
     * modal closes — all in one `set`.
     */
    processCheckout: async (paymentData) => {
      set({ isLoading: true, lastError: null });
      try {
        const sale = await saleService.posCheckout(paymentData);

        set({
          ...EMPTY_CART_SNAPSHOT,
          isCheckoutOpen: false,
          selectedCustomer: null,
          lastError: null,
        });

        return sale;
      } catch (error) {
        const message = extractErrorMessage(error);
        console.error('[POSStore] processCheckout failed:', message);
        set({ lastError: message });
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    // ── Misc ────────────────────────────────

    clearError: () => set({ lastError: null }),

    reset: () => {
      // Bump the request id so any in-flight loadCart is dropped —
      // otherwise it would arrive after the reset and repopulate the
      // cart with stale data.
      cartRequestId++;
      set({
        ...EMPTY_CART_SNAPSHOT,

        isLoading: false,
        isCheckoutOpen: false,
        isCustomerSearchOpen: false,
        isDiscountModalOpen: false,

        lastError: null,

        selectedCustomer: null,

        searchQuery: '',
        searchResults: [],
      });
    },
  };
});
