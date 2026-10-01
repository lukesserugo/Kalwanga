// packages/backend/src/services/cartService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';
import { computeCartTotals, round2 } from '../utils/money.js';
import { currencyService } from './currencyService.js';
import { exchangeRateService } from './exchangeRateService.js';
import { logger } from '../lib/logger.js';

// ============================================
// TYPES
// ============================================

interface CartItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  notes?: string;
}

type CartStatusValue = 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED';
type CartDiscountTypeValue = 'PERCENTAGE' | 'FIXED';

/**
 * Resolved display context for a cart response.
 *
 * Computed once per `formatCartResponse` call by
 * `resolveDisplayContext`. When `displayCurrency` is `null`, the
 * response carries no `display*` fields and the frontend falls back
 * to the ledger amounts (which are always present).
 */
interface DisplayContext {
  displayCurrency: string | null;
  rate: number | null;
  rateSource: string | null;
}

interface CartResponse {
  id: string;
  items: CartItemResponse[];
  subtotal: number;
  tax: number;
  discount: number;
  discountType?: CartDiscountTypeValue;
  promotionCode?: string;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  total: number;
  customerId?: string;
  customer?: any;
  businessUnitId: string;
  userId: string;
  notes?: string;
  status: CartStatusValue;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;

  /**
   * ISO 4217 currency code for this cart's business unit.
   *
   * Resolved server-side via `currencyService.resolveForBusiness(
   * businessUnit.currency )` — the same walk used by
   * `checkoutService.resolveBusinessUnitCurrency` and
   * `paymentService.resolveCurrency`. This is the AUTHORITATIVE
   * currency for every amount on this cart: `subtotal`, `tax`,
   * `discount`, `total`, and every line's `unitPrice` / `total`.
   *
   * The frontend MUST format using this code (e.g.
   * `formatCurrency(amount, cart.currency)`), never a hardcoded
   * one. A UGX cart that renders with a `$` is a bug this field
   * exists to prevent.
   *
   * ⚠ Phase 2: surfaced explicitly on the response. The `Cart`
   *   Prisma model has no `currency` column — the currency lives on
   *   `BusinessUnit.currency`, and this is the resolved projection
   *   of that column through the registry.
   */
  currency: string;

  /**
   * Display symbol for `currency`, derived at read time from the
   * registry (`currencyService.tryGetCurrency(code)?.symbol`).
   * Falls back to the ISO code itself when the registry has no
   * symbol registered for the code.
   *
   * ⚠ Phase 2: COMPUTED, not persisted. Phase 1 removed the
   *   `currencySymbol` column from every settings table; the same
   *   principle applies here — storing a symbol alongside a code
   *   allows the two to drift (a code change to UGX with a stale
   *   `$` symbol). The registry is the single source of truth.
   *
   * Prefer passing `currency` (the code) to `Intl.NumberFormat` —
   * the browser's own formatting is more robust across locales
   * than prefixing a symbol. Use this field only for contexts that
   * cannot call `Intl` (CSV exports, plain-text emails, the
   * discount-type `<select>` in the cart UI).
   */
  currencySymbol: string;

  // ────────────────────────────────────────────────────────────
  // Phase 3a — Tier 2 display currency fields
  // ────────────────────────────────────────────────────────────
  //
  // Populated ONLY when the payer has chosen a display currency
  // different from the ledger currency AND an FX rate is available.
  // Every field is optional. When `displayCurrency` is null, the
  // ledger amounts (`subtotal`, `total`, `items[].unitPrice`, …) are
  // the only amounts the frontend should render.
  //
  // ⚠ The ledger amounts are NEVER mutated. These `display*` fields
  //   are additive views. A `Payment` recorded from this cart always
  //   uses the ledger `total`.

  /**
   * The payer's chosen display currency, or `null` when the payer
   * has not overridden the ledger currency.
   *
   * ⚠ Distinct from `currency`. `currency` is the ledger. This is a
   *   presentation-layer view.
   */
  displayCurrency?: string | null;

  /** The FX rate applied (`ledger → display`). `null` when no rate. */
  displayRate?: number | null;

  /**
   * Where the rate came from — `'identity'`, `'direct'`, `'inverse'`,
   * `'pivot:...'`, or `'override:<id>'`. Used for audit and to help a
   * support engineer understand why a displayed amount differs from
   * what the payer expects.
   */
  displayRateSource?: string | null;

  /** Subtotal converted to `displayCurrency`. */
  displaySubtotal?: number;

  /** Tax converted to `displayCurrency`. */
  displayTax?: number;

  /** Cart-level discount converted to `displayCurrency`. */
  displayDiscount?: number;

  /** Promotion discount converted to `displayCurrency`. */
  displayPromotionDiscount?: number;

  /** Loyalty discount converted to `displayCurrency`. */
  displayLoyaltyDiscount?: number;

  /** Total converted to `displayCurrency`. */
  displayTotal?: number;

  /**
   * Per-line display amounts, in the same order as `items`.
   *
   * ⚠ A parallel array rather than inlined fields, because the
   *   number of items can change between requests and the frontend
   *   needs a stable index-based mapping. When `displayCurrency` is
   *   null, this array is omitted.
   */
  displayItems?: Array<{ unitPrice: number; total: number }>;
}

interface CartItemResponse {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images: string[];
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: any;
  };
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  availableStock: number;
  isInStock: boolean;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  metrics: string[];
  dateRange: string;
  startDate?: string;
  endDate?: string;
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetailedData: boolean;
}

export interface ExportHistoryOptions {
  format: 'csv' | 'json';
  dateRange: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  includeItems?: boolean;
}

export interface ExportAbandonedOptions {
  format: 'csv' | 'json';
  hours: number;
  minValue?: number;
  status?: string;
  includeCustomerDetails?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function safeEmitEvent(eventName: string, data: any): Promise<void> {
  try {
    if (
      realtimeService &&
      typeof (realtimeService as any).emit === 'function'
    ) {
      await (realtimeService as any).emit(eventName, data);
    } else if (
      realtimeService &&
      typeof (realtimeService as any).emitCartEvent === 'function'
    ) {
      await (realtimeService as any).emitCartEvent(eventName, data);
    } else {
      console.log(`📡 Cart real-time event: ${eventName}`, data);
    }
  } catch (error) {
    console.warn(`Failed to emit cart real-time event ${eventName}:`, error);
  }
}

function ensureCartStatus(cart: any): any {
  return {
    ...cart,
    status: (cart?.status as CartStatusValue) || 'ACTIVE',
  };
}

/**
 * Collapse `variantId: null` → `undefined` for any shape that flows
 * into Prisma. Prisma distinguishes the two:
 *   - `undefined` → "no filter" / "leave unset"
 *   - `null`      → "column IS NULL" / "explicitly clear"
 *
 * Callers who send `null` mean "no variant" — i.e. `undefined`.
 */
function normalizeVariantId(
  variantId: string | null | undefined,
): string | undefined {
  return variantId ?? undefined;
}

/**
 * Build a Prisma `where` clause for looking up the single Inventory row
 * that belongs to a given (productId | variantId, businessUnitId).
 *
 * NOTE: In the current schema, `Inventory` has NO scalar `productId` /
 * `variantId` columns. The FK lives on the *other* side of the relation
 * (`Product.inventoryId` and `ProductVariant.inventoryId`). Prisma's
 * generated client therefore only accepts relation filters here.
 *
 * ⚠ These filters only match when the FK on the product/variant side
 *    is populated. If `Product.inventoryId` is null, the query
 *    silently returns no rows and `availableStock` falls back to 0.
 *    See `ensureInventory.ts` and the backfill script for the fix.
 */
function inventoryWhereFor(
  productId: string,
  variantId: string | null | undefined,
  businessUnitId: string,
): Prisma.InventoryWhereInput {
  const normalizedVariantId = normalizeVariantId(variantId);
  return {
    businessUnitId,
    ...(normalizedVariantId
      ? { variant: { id: normalizedVariantId } }
      : { product: { id: productId } }),
  };
}

/**
 * Standard `include` shape for cart items. Hoisted so all cart reads
 * return the same projection.
 */
const CART_ITEM_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      unitPrice: true,
      images: true,
      taxRate: true,
      isActive: true,
    },
  },
  variant: {
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      attributes: true,
      isActive: true,
    },
  },
} as const;

/**
 * Prisma error code for a unique-constraint violation. Used to make
 * `getOrCreateCart` race-safe — a concurrent request may create the
 * cart between our `findFirst` and our `create`.
 */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

// ============================================
// CART SERVICE CLASS
// ============================================

export class CartService extends BaseService {
  // ============================================
  // READ / CREATE
  // ============================================

  /**
   * Read-only cart lookup for the current user + business unit.
   *
   * ⚠ This method MUST NOT create a cart. `GET /cart` calls into this
   *    path. Creating a row on a GET is what produced the 409
   *    "A record with this value already exists" storm: the shopper
   *    would already have a cart (often a guest cart that survived
   *    login), the unique constraint `(userId, businessUnitId)` would
   *    fire on the redundant INSERT, and every subsequent GET repeated
   *    the same failure.
   *
   * Returns `null` when there is no active cart. Callers are expected
   * to translate that into an empty synthetic cart — see
   * `getCartForRequest` below.
   *
   * ── Phase 3a ────────────────────────────────────────────────
   * `displayCurrencyFromRequest` is the payer's chosen display
   * currency, read by the controller from the `X-Display-Currency`
   * header. When it differs from the ledger currency and a rate is
   * available, the returned response gains `display*` fields. The
   * ledger amounts are untouched.
   */
  async findActiveCart(
    userId: string,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse | null> {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError(
          'User ID and Business Unit ID are required',
          400,
        );
      }

      const cart = await this.prisma.cart.findFirst({
        where: { userId, businessUnitId, status: 'ACTIVE' },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
            orderBy: { createdAt: 'asc' },
          },
          customer: true,
        },
      });

      if (!cart) return null;

      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (cart as any).displayCurrency ?? null,
      );

      return await this.formatCartResponse(
        ensureCartStatus(cart),
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.findActiveCart');
      throw error;
    }
  }

  /**
   * The handler for `GET /cart`.
   *
   * Returns the user's active cart, or an empty synthetic stub when
   * none exists. Never creates a row. This is the method the cart
   * controller calls for the read endpoint.
   *
   * The synthetic stub is shaped exactly like a real `CartResponse`
   * so the frontend never has to branch. `id` is the empty string;
   * callers that try to mutate should treat that as "no cart" and
   * let the mutation endpoint create one lazily.
   *
   * ⚠ Phase 2: the stub carries the resolved `currency` and
   *    `currencySymbol` for the caller's business unit, exactly like
   *    a real cart would. A brand-new user with no cart row still
   *    needs the UI to render "0.00" in the BU's own currency — the
   *    frontend must not have to fall back to a hardcoded default
   *    just because no cart row exists yet.
   *
   * ── Phase 3a ────────────────────────────────────────────────
   * The stub does NOT carry `display*` fields even when a display
   * currency is set. There is nothing to convert — the amounts are
   * zero. The frontend uses the ledger currency for the empty-state
   * render, which is correct: an empty cart has no amounts to
   * display in the payer's currency.
   */
  async getCartForRequest(
    userId: string,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    const existing = await this.findActiveCart(
      userId,
      businessUnitId,
      displayCurrencyFromRequest,
    );
    if (existing) return existing;

    const now = new Date();

    // ── Phase 2: resolve currency for the empty stub ────────
    // The stub must carry the same resolved currency a real cart
    // would, so a client rendering an empty cart gets `UGX 0`
    // rather than a hardcoded `$0.00`. Resolution goes through the
    // same registry walk as `formatCartResponse`.
    const { currency, currencySymbol } =
      await this.resolveCartCurrency(businessUnitId);

    return {
      id: '',
      items: [],
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      businessUnitId,
      userId,
      status: 'ACTIVE',
      itemCount: 0,
      promotionDiscount: 0,
      loyaltyPointsUsed: 0,
      loyaltyDiscount: 0,
      createdAt: now,
      updatedAt: now,
      currency,
      currencySymbol,
    };
  }

  /**
   * Find or create the user's active cart.
   *
   * Race-safe: if two requests try to create the cart at the same
   * time, one wins the INSERT and the other reads the winner. The
   * `(userId, businessUnitId)` unique constraint is what guarantees
   * this — we just have to stop treating it as a fatal error.
   *
   * Callers:
   *   - every mutation (`addItemToCart`, `applyDiscount`, …) uses this
   *     to lazily materialize a cart on first write
   *   - `getCartForRequest` does NOT use this; reads go through
   *     `findActiveCart` so a GET can never insert
   */
  async getOrCreateCart(
    userId: string,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError(
          'User ID and Business Unit ID are required',
          400,
        );
      }

      // Fast path: existing cart.
      const existing = await this.prisma.cart.findFirst({
        where: { userId, businessUnitId, status: 'ACTIVE' },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
            orderBy: { createdAt: 'asc' },
          },
          customer: true,
        },
      });

      if (existing) {
        const { currency } = await this.resolveCartCurrency(businessUnitId);
        const displayContext = await this.resolveDisplayContext(
          currency,
          displayCurrencyFromRequest,
          (existing as any).displayCurrency ?? null,
        );
        return await this.formatCartResponse(
          ensureCartStatus(existing),
          businessUnitId,
          displayContext,
        );
      }

      // Slow path: create. A concurrent request may have created the
      // cart between our find and our create — catch P2002 and re-read.
      let cart: any;
      try {
        cart = await this.prisma.cart.create({
          data: {
            userId,
            businessUnitId,
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            status: 'ACTIVE',
          },
          include: {
            items: {
              include: CART_ITEM_INCLUDE,
              orderBy: { createdAt: 'asc' },
            },
            customer: true,
          },
        });

        console.log(
          `✅ Cart created for user ${userId} in business unit ${businessUnitId}`,
        );
      } catch (error: any) {
        if (error?.code === PRISMA_UNIQUE_VIOLATION) {
          // Lost the race. Re-read; the winner's row is our row.
          cart = await this.prisma.cart.findFirst({
            where: { userId, businessUnitId, status: 'ACTIVE' },
            include: {
              items: {
                include: CART_ITEM_INCLUDE,
                orderBy: { createdAt: 'asc' },
              },
              customer: true,
            },
          });

          if (!cart) {
            // The constraint fired but the row isn't there — most
            // likely a soft-deleted or non-ACTIVE cart holding the
            // unique key. Fall back to reactivating it.
            const anyCart = await this.prisma.cart.findFirst({
              where: { userId, businessUnitId },
              include: {
                items: {
                  include: CART_ITEM_INCLUDE,
                  orderBy: { createdAt: 'asc' },
                },
                customer: true,
              },
            });

            if (anyCart && anyCart.status !== 'ACTIVE') {
              cart = await this.prisma.cart.update({
                where: { id: anyCart.id },
                data: { status: 'ACTIVE' },
                include: {
                  items: {
                    include: CART_ITEM_INCLUDE,
                    orderBy: { createdAt: 'asc' },
                  },
                  customer: true,
                },
              });
            } else {
              throw new AppError(
                'Cart creation conflicted with another request and the cart could not be reloaded. Please retry.',
                409,
              );
            }
          }
        } else {
          throw error;
        }
      }

      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (cart as any).displayCurrency ?? null,
      );

      return await this.formatCartResponse(
        ensureCartStatus(cart),
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.getOrCreateCart');
      throw error;
    }
  }

  /**
   * Fetch a cart by its id.
   *
   * ⚠ The response is always enriched against the CART'S OWN business
   *    unit, not the caller's. The `businessUnitId` parameter is kept
   *    on the signature only for API compatibility — an admin in BU-A
   *    fetching a cart from BU-B used to see inventory numbers
   *    computed against BU-A. `availableStock` and `isInStock` were
   *    wrong on every line.
   *
   * ⚠ Phase 2: the currency on the response is likewise the CART'S
   *    BU currency, not the caller's. An admin in BU-A viewing a
   *    BU-B cart sees BU-B's currency, which is correct — the
   *    amounts on the cart are denominated in BU-B's currency.
   *
   * ── Phase 3a ────────────────────────────────────────────────
   * `displayCurrencyFromRequest` is accepted for the payer-facing
   * path. The admin path does not pass it; an admin browsing a cart
   * sees ledger amounts, not the payer's display view.
   */
  async getCartById(
    cartId: string,
    _businessUnitId?: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      if (!cartId) {
        throw new AppError('Cart ID is required', 400);
      }

      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
            orderBy: { createdAt: 'asc' },
          },
          customer: true,
        },
      });

      if (!cart) {
        throw new AppError('Cart not found', 404);
      }

      // Enrichment must use the cart's own BU. See the method JSDoc.
      const { currency } = await this.resolveCartCurrency(
        cart.businessUnitId,
      );
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (cart as any).displayCurrency ?? null,
      );

      return await this.formatCartResponse(
        ensureCartStatus(cart),
        cart.businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.getCartById');
      throw error;
    }
  }

  /**
   * Flattened summary for `GET /cart/summary`.
   *
   * ⚠ Phase 2: `currency` and `currencySymbol` are propagated from
   *    the full cart response. A client that only hits
   *    `/cart/summary` still needs to know what currency to render
   *    the amounts in — without these fields it would fall back to a
   *    hardcoded default.
   *
   * ── Phase 3a ────────────────────────────────────────────────
   * The `display*` fields are also propagated from the full cart
   * response.
   */
  async getCartSummary(
    cartId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<any> {
    try {
      const cart = await this.getCartById(
        cartId,
        undefined,
        displayCurrencyFromRequest,
      );

      const base: any = {
        id: cart.id,
        itemCount: cart.itemCount,
        subtotal: cart.subtotal,
        tax: cart.tax,
        discount: cart.discount,
        total: cart.total,
        // ── Phase 2: currency propagated from the full cart ──
        currency: cart.currency,
        currencySymbol: cart.currencySymbol,
        items: cart.items.map((item) => ({
          id: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          variantName: item.variant?.name,
        })),
      };

      // ── Phase 3a: propagate display fields when present ──
      if (cart.displayCurrency) {
        base.displayCurrency = cart.displayCurrency;
        base.displayRate = cart.displayRate;
        base.displayRateSource = cart.displayRateSource;
        base.displaySubtotal = cart.displaySubtotal;
        base.displayTax = cart.displayTax;
        base.displayDiscount = cart.displayDiscount;
        base.displayTotal = cart.displayTotal;
      }

      return base;
    } catch (error) {
      this.handleError(error, 'CartService.getCartSummary');
      throw error;
    }
  }

  async getCartCount(userId: string, businessUnitId: string): Promise<number> {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError(
          'User ID and Business Unit ID are required',
          400,
        );
      }

      const cart = await this.prisma.cart.findFirst({
        where: { userId, businessUnitId, status: 'ACTIVE' },
        include: { items: { select: { quantity: true } } },
      });

      if (!cart) return 0;

      return cart.items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0,
      );
    } catch (error) {
      this.handleError(error, 'CartService.getCartCount');
      throw error;
    }
  }

  // ============================================
  // GUEST → USER MERGE
  // ============================================

  /**
   * Merge a guest cart into the authenticated user's cart.
   *
   * Called from `POST /cart/merge-guest` after login. Idempotent: a
   * second call for the same pair is a no-op.
   *
   * Resolution:
   *   1. Load the guest cart.
   *   2. If the guest cart already belongs to this user (i.e. it was
   *      adopted earlier), do nothing.
   *   3. If the user has no active cart, reassign the guest cart to
   *      them — one row, no item copy.
   *   4. Otherwise, add each guest line into the user's cart, summing
   *      quantities on matching (product, variant) pairs, then mark
   *      the guest cart ABANDONED.
   *
   * The transaction runs at serializable isolation so a concurrent
   * `addItemToCart` cannot slip an item between the read and the
   * write.
   *
   * ⚠ Phase 2 note: merging does NOT touch currency. Both carts
   *    belong to the same `businessUnitId` (the merge is scoped
   *    per-BU), so both already share a currency. The merged cart's
   *    resolved currency is unchanged.
   *
   * ── Phase 3a ────────────────────────────────────────────────
   * `displayCurrency` on the user's cart is preserved if it was
   * already set. The guest cart's `displayCurrency` is discarded —
   * the session-scoped preference belongs to the payer, who is now
   * authenticated, and their preference is read from
   * `Customer.preferredDisplayCurrency` on the next request.
   */
  async mergeGuestCartIntoUserCart(
    guestCartId: string,
    userId: string,
  ): Promise<void> {
    if (!guestCartId || !userId) return;

    try {
      await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const guestCart = await tx.cart.findUnique({
            where: { id: guestCartId },
            include: { items: true },
          });

          if (!guestCart) return;
          if (guestCart.userId === userId) return;
          if (guestCart.status !== 'ACTIVE') return;

          const businessUnitId = guestCart.businessUnitId;

          const userCart = await tx.cart.findFirst({
            where: { userId, businessUnitId, status: 'ACTIVE' },
            include: { items: true },
          });

          // Case 3: no user cart → adopt the guest cart wholesale.
          if (!userCart) {
            await tx.cart.update({
              where: { id: guestCart.id },
              data: {
                userId,
                // ── Phase 3a ──────────────────────────────
                // The adopting user's session-scoped display
                // currency is not stored on the cart row itself;
                // it is read from `Customer.preferredDisplayCurrency`
                // on the next authenticated request. We clear any
                // stale value the guest cart may have carried to
                // avoid a mismatch.
                displayCurrency: null,
              } as any,
            });
            return;
          }

          // Case 4: merge line items into the user's cart.
          for (const item of guestCart.items) {
            const existing = await tx.cartItem.findFirst({
              where: {
                cartId: userCart.id,
                productId: item.productId,
                variantId: item.variantId ?? null,
              },
            });

            if (existing) {
              const nextQuantity = existing.quantity + item.quantity;
              await tx.cartItem.update({
                where: { id: existing.id },
                data: {
                  quantity: nextQuantity,
                  total: round2(nextQuantity * existing.unitPrice),
                },
              });
            } else {
              await tx.cartItem.create({
                data: {
                  cartId: userCart.id,
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                  notes: item.notes,
                },
              });
            }
          }

          // Empty the guest cart and mark it abandoned so it can't be
          // reused as a guest cart, but its audit trail survives.
          await tx.cartItem.deleteMany({
            where: { cartId: guestCart.id },
          });

          await tx.cart.update({
            where: { id: guestCart.id },
            data: {
              status: 'ABANDONED',
              subtotal: 0,
              tax: 0,
              discount: 0,
              total: 0,
              // ── Phase 3a ──────────────────────────────
              // Clear the guest cart's display currency. It was
              // session-scoped and the session is ending.
              displayCurrency: null,
            } as any,
          });

          await this.recalculateCart(
            tx,
            userCart.id,
            businessUnitId,
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      // Merge failure is non-fatal for the login flow. Log and let
      // the caller continue.
      console.warn('Failed to merge guest cart into user cart:', error);
    }
  }

  // ============================================
  // ITEM MUTATIONS
  // ============================================

  /**
   * Add item to cart.
   *
   * Every path that writes an item also writes the correct unitPrice
   * from the server — never from the caller. Variants win when present.
   * Inventory availability is checked inside the same transaction so a
   * concurrent sale cannot bypass the check.
   *
   * ── Phase 3a ────────────────────────────────────────────────
   * `displayCurrencyFromRequest` is optional. When passed, the
   * returned cart carries `display*` fields. When omitted, the
   * response is ledger-only, matching Phase 2 behavior.
   */
  async addItemToCart(
    cartId: string,
    data: CartItemInput,
    userId: string,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cart = await tx.cart.findUnique({ where: { id: cartId } });

          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          if (cart.status && cart.status !== 'ACTIVE') {
            throw new AppError(
              'Cart is not active. Please create a new cart.',
              400,
            );
          }

          if (cart.businessUnitId !== businessUnitId) {
            throw new AppError(
              'Cart belongs to a different business unit',
              400,
            );
          }

          const product = await tx.product.findUnique({
            where: { id: data.productId },
            select: {
              id: true,
              isActive: true,
              unitPrice: true,
              taxRate: true,
            },
          });

          if (!product) {
            throw new AppError('Product not found', 404);
          }

          if (!product.isActive) {
            throw new AppError('Product is not active', 400);
          }

          const variantId = normalizeVariantId(data.variantId);

          // Server-authoritative unit price.
          let unitPrice = product.unitPrice;
          if (variantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: variantId },
              select: { isActive: true, price: true, productId: true },
            });

            if (!variant) {
              throw new AppError('Variant not found', 404);
            }
            if (!variant.isActive) {
              throw new AppError('Variant is not active', 400);
            }
            if (variant.productId !== data.productId) {
              throw new AppError(
                'Variant does not belong to the given product',
                400,
              );
            }
            unitPrice = variant.price;
          }

          // Availability check inside the transaction.
          const inventory = await tx.inventory.findFirst({
            where: inventoryWhereFor(
              data.productId,
              variantId,
              businessUnitId,
            ),
            select: { id: true, quantity: true, reserved: true },
          });

          const availableStock = inventory
            ? Math.max(
                0,
                (inventory.quantity || 0) - (inventory.reserved || 0),
              )
            : 0;

          if (availableStock < data.quantity) {
            console.warn(
              `[cart.addItem] Insufficient stock. ` +
                `product=${data.productId} ` +
                `variant=${variantId ?? '-'} ` +
                `bu=${businessUnitId} ` +
                `inventory=${
                  inventory
                    ? JSON.stringify({
                        id: inventory.id,
                        qty: inventory.quantity,
                        reserved: inventory.reserved,
                      })
                    : 'NOT LINKED'
                }`,
            );
            throw new AppError(
              `Insufficient stock. Available: ${availableStock}`,
              400,
            );
          }

          const existingItem = await tx.cartItem.findFirst({
            where: {
              cartId,
              productId: data.productId,
              variantId: variantId ?? null,
            },
          });

          if (existingItem) {
            const newQuantity = existingItem.quantity + data.quantity;

            if (availableStock < newQuantity) {
              console.warn(
                `[cart.addItem] Insufficient stock (existing item). ` +
                  `product=${data.productId} ` +
                  `variant=${variantId ?? '-'} ` +
                  `bu=${businessUnitId} ` +
                  `inventory=${
                    inventory
                      ? JSON.stringify({
                          id: inventory.id,
                          qty: inventory.quantity,
                          reserved: inventory.reserved,
                        })
                      : 'NOT LINKED'
                  } ` +
                  `requested=${newQuantity}`,
              );
              throw new AppError(
                `Insufficient stock. Available: ${availableStock}`,
                400,
              );
            }

            await tx.cartItem.update({
              where: { id: existingItem.id },
              data: {
                quantity: newQuantity,
                unitPrice,
                total: round2(newQuantity * unitPrice),
                notes: data.notes || existingItem.notes,
              },
            });
          } else {
            await tx.cartItem.create({
              data: {
                cartId,
                productId: data.productId,
                variantId: variantId ?? null,
                quantity: data.quantity,
                unitPrice,
                total: round2(data.quantity * unitPrice),
                notes: data.notes,
              },
            });
          }

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            businessUnitId,
          );

          await safeEmitEvent(`cart:${cartId}:updated`, {
            cartId,
            userId,
            action: 'item_added',
            productId: data.productId,
            variantId: variantId ?? null,
            quantity: data.quantity,
          });

          return updatedCart;
        },
      );

      // ── Phase 3a: resolve display context after the transaction
      //   commits. The transaction is intentionally narrow — it
      //   only touches the cart. The display resolution is a read
      //   that can happen afterward.
      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.addItemToCart');
      throw error;
    }
  }

  /**
   * Bulk add. Each item is validated in its own sub-transaction so a
   * failure on item N does not roll back items 1..N-1.
   */
  async addMultipleItemsToCart(
    cartId: string,
    items: CartItemInput[],
    userId: string,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      if (!items || items.length === 0) {
        throw new AppError('Items are required', 400);
      }

      for (const item of items) {
        await this.addItemToCart(
          cartId,
          item,
          userId,
          businessUnitId,
        );
      }

      await safeEmitEvent(`cart:${cartId}:updated`, {
        cartId,
        userId,
        action: 'items_added_bulk',
        count: items.length,
      });

      return await this.getCartById(
        cartId,
        businessUnitId,
        displayCurrencyFromRequest,
      );
    } catch (error) {
      this.handleError(error, 'CartService.addMultipleItemsToCart');
      throw error;
    }
  }

  /**
   * Update cart item quantity.
   *
   * Re-reads the server unit price and reapplies it, so a stale
   * `cartItem.unitPrice` cannot be exploited by editing the row
   * directly.
   */
  async updateCartItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cartItem = await tx.cartItem.findUnique({
            where: { id: itemId },
            include: {
              product: {
                select: { unitPrice: true, isActive: true },
              },
              variant: {
                select: { price: true, isActive: true },
              },
            },
          });

          if (!cartItem) {
            throw new AppError('Cart item not found', 404);
          }

          if (cartItem.cartId !== cartId) {
            throw new AppError(
              'Cart item does not belong to this cart',
              400,
            );
          }

          if (quantity <= 0) {
            await tx.cartItem.delete({ where: { id: itemId } });
          } else {
            if (cartItem.product.isActive === false) {
              throw new AppError('Product is no longer active', 400);
            }
            if (cartItem.variant && cartItem.variant.isActive === false) {
              throw new AppError('Variant is no longer active', 400);
            }

            const inventory = await tx.inventory.findFirst({
              where: inventoryWhereFor(
                cartItem.productId,
                cartItem.variantId,
                businessUnitId,
              ),
              select: { id: true, quantity: true, reserved: true },
            });

            const availableStock = inventory
              ? Math.max(
                  0,
                  (inventory.quantity || 0) - (inventory.reserved || 0),
                )
              : 0;

            if (availableStock < quantity) {
              console.warn(
                `[cart.updateQty] Insufficient stock. ` +
                  `product=${cartItem.productId} ` +
                  `variant=${cartItem.variantId ?? '-'} ` +
                  `bu=${businessUnitId} ` +
                  `inventory=${
                    inventory
                      ? JSON.stringify({
                          id: inventory.id,
                          qty: inventory.quantity,
                          reserved: inventory.reserved,
                        })
                      : 'NOT LINKED'
                  } ` +
                  `requested=${quantity}`,
              );
              throw new AppError(
                `Insufficient stock. Available: ${availableStock}`,
                400,
              );
            }

            const serverUnitPrice =
              cartItem.variant?.price ?? cartItem.product.unitPrice ?? 0;

            await tx.cartItem.update({
              where: { id: itemId },
              data: {
                quantity,
                unitPrice: serverUnitPrice,
                total: round2(quantity * serverUnitPrice),
              },
            });
          }

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            businessUnitId,
          );

          await safeEmitEvent(`cart:${cartId}:updated`, {
            cartId,
            action: 'quantity_updated',
            itemId,
            quantity,
          });

          return updatedCart;
        },
      );

      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.updateCartItemQuantity');
      throw error;
    }
  }

  async removeItemFromCart(
    cartId: string,
    itemId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cartItem = await tx.cartItem.findUnique({
            where: { id: itemId },
          });

          if (!cartItem) {
            throw new AppError('Cart item not found', 404);
          }

          if (cartItem.cartId !== cartId) {
            throw new AppError(
              'Cart item does not belong to this cart',
              400,
            );
          }

          await tx.cartItem.delete({ where: { id: itemId } });

          const cart = await tx.cart.findUnique({ where: { id: cartId } });
          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            cart.businessUnitId,
          );

          await safeEmitEvent(`cart:${cartId}:updated`, {
            cartId,
            action: 'item_removed',
            itemId,
          });

          return updatedCart;
        },
      );

      const businessUnitId = (result as any).businessUnitId;
      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.removeItemFromCart');
      throw error;
    }
  }

  async clearCart(
    cartId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cart = await tx.cart.findUnique({ where: { id: cartId } });

          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          await tx.cartItem.deleteMany({ where: { cartId } });

          const updatedCart = await tx.cart.update({
            where: { id: cartId },
            data: {
              subtotal: 0,
              tax: 0,
              discount: 0,
              total: 0,
              discountType: null,
              promotionCode: null,
              promotionDiscount: 0,
              loyaltyPointsUsed: 0,
              loyaltyDiscount: 0,
            },
            include: {
              items: true,
              customer: true,
            },
          });

          await safeEmitEvent(`cart:${cartId}:updated`, {
            cartId,
            action: 'cleared',
          });

          return updatedCart;
        },
      );

      const businessUnitId = (result as any).businessUnitId;
      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.clearCart');
      throw error;
    }
  }

  // ============================================
  // DISCOUNTS & PROMOTIONS
  // ============================================

  async applyDiscount(
    cartId: string,
    discount: number,
    discountType: CartDiscountTypeValue = 'FIXED',
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      if (discount < 0) {
        throw new AppError('Discount cannot be negative', 400);
      }

      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cart = await tx.cart.findUnique({ where: { id: cartId } });
          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          let actualDiscount = discount;
          if (discountType === 'PERCENTAGE') {
            actualDiscount = round2((cart.subtotal * discount) / 100);
          }

          if (actualDiscount > cart.subtotal) {
            throw new AppError('Discount cannot exceed subtotal', 400);
          }

          await tx.cart.update({
            where: { id: cartId },
            data: { discountType },
          });

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            cart.businessUnitId,
            actualDiscount,
          );

          return updatedCart;
        },
      );

      const businessUnitId = (result as any).businessUnitId;
      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.applyDiscount');
      throw error;
    }
  }

  async applyPromotion(
    cartId: string,
    promotionCode: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      if (!promotionCode) {
        throw new AppError('Promotion code is required', 400);
      }

      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cart = await tx.cart.findUnique({ where: { id: cartId } });
          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          const promotion = await tx.promotion.findFirst({
            where: {
              name: promotionCode,
              isActive: true,
              startDate: { lte: new Date() },
              endDate: { gte: new Date() },
            },
          });

          if (!promotion) {
            throw new AppError(
              'Invalid or expired promotion code',
              400,
            );
          }

          let discountAmount = 0;
          if (promotion.type === 'PERCENTAGE') {
            discountAmount = (cart.subtotal * promotion.value) / 100;
          } else if (promotion.type === 'FIXED') {
            discountAmount = promotion.value;
          }

          if (
            promotion.maxDiscount &&
            discountAmount > promotion.maxDiscount
          ) {
            discountAmount = promotion.maxDiscount;
          }

          if (discountAmount > cart.subtotal) {
            discountAmount = cart.subtotal;
          }
          discountAmount = round2(discountAmount);

          await tx.cart.update({
            where: { id: cartId },
            data: {
              promotionCode,
              promotionDiscount: discountAmount,
            },
          });

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            cart.businessUnitId,
            discountAmount,
          );

          await safeEmitEvent(`cart:${cartId}:promotion-applied`, {
            cartId,
            promotionCode,
            discountAmount,
          });

          return updatedCart;
        },
      );

      const businessUnitId = (result as any).businessUnitId;
      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.applyPromotion');
      throw error;
    }
  }

  /**
   * Redeem loyalty points against the cart.
   *
   * IMPORTANT: this method decrements `Customer.loyaltyPoints` at the
   * moment of redemption. If the cart is later cleared or abandoned
   * without a sale, the points are NOT restored. A checkout that
   * fails after this call should reverse the redemption via a
   * compensating `LoyaltyHistory` entry.
   *
   * ⚠ Phase 2 note: the redemption arithmetic (`points * 0.1`) is a
   *    hardcoded USD-derived rate. It is currency-agnostic in the
   *    sense that it operates on the cart's own `subtotal` — but the
   *    "0.1" per-point value is only meaningful on a USD-denominated
   *    cart. On a UGX cart, 1 point = 0.10 UGX is effectively zero.
   *    This is a pre-existing issue that Phase 2 does NOT fix; it is
   *    flagged here so the next maintainer knows the rate needs to
   *    come from `CartSettings` (or `LoyaltyProgram`) before this is
   *    correct on non-USD deployments.
   */
  async applyLoyaltyPoints(
    cartId: string,
    customerId: string,
    points: number,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      if (!customerId || points <= 0) {
        throw new AppError(
          'Valid customer ID and points are required',
          400,
        );
      }

      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { id: true, loyaltyPoints: true },
          });

          if (!customer) {
            throw new AppError('Customer not found', 404);
          }

          if ((customer.loyaltyPoints || 0) < points) {
            throw new AppError('Insufficient loyalty points', 400);
          }

          const cart = await tx.cart.findUnique({ where: { id: cartId } });
          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          // 1 point = $0.10. Cap at 50% of subtotal.
          // ⚠ See the method JSDoc: this rate is only meaningful on
          //   a USD-denominated cart. Non-USD deployments need the
          //   rate to come from settings.
          const discountFromPoints = round2(points * 0.1);
          const maxDiscount = round2(cart.subtotal * 0.5);
          const actualDiscount = Math.min(
            discountFromPoints,
            maxDiscount,
          );
          const actualPointsUsed = Math.ceil(actualDiscount / 0.1);

          await tx.customer.update({
            where: { id: customerId },
            data: {
              loyaltyPoints: { decrement: actualPointsUsed },
            },
          });

          await tx.loyaltyHistory.create({
            data: {
              customerId,
              points: -actualPointsUsed,
              type: 'REDEEM',
              notes: `Redeemed for cart ${cartId}`,
              userId: cart.userId,
              businessUnitId: cart.businessUnitId,
            },
          });

          await tx.cart.update({
            where: { id: cartId },
            data: {
              loyaltyPointsUsed: actualPointsUsed,
              loyaltyDiscount: actualDiscount,
            },
          });

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            cart.businessUnitId,
            actualDiscount,
          );

          await safeEmitEvent(`cart:${cartId}:loyalty-applied`, {
            cartId,
            customerId,
            points: actualPointsUsed,
            discount: actualDiscount,
          });

          return updatedCart;
        },
      );

      const businessUnitId = (result as any).businessUnitId;
      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.applyLoyaltyPoints');
      throw error;
    }
  }

  // ============================================
  // CUSTOMER & NOTES
  // ============================================

  async associateCustomer(
    cartId: string,
    customerId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: { customerId },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
          },
          customer: true,
        },
      });

      const { currency } = await this.resolveCartCurrency(
        cart.businessUnitId,
      );
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (cart as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(
        cartWithStatus,
        cart.businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.associateCustomer');
      throw error;
    }
  }

  async updateCartNotes(
    cartId: string,
    notes?: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: { notes: notes || '' },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
          },
          customer: true,
        },
      });

      const { currency } = await this.resolveCartCurrency(
        cart.businessUnitId,
      );
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (cart as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(
        cartWithStatus,
        cart.businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.updateCartNotes');
      throw error;
    }
  }

  // ============================================
  // SYNC / SAVE / RESTORE / TRANSFER / SPLIT
  // ============================================

  async syncCartWithInventory(
    cartId: string,
    businessUnitId: string,
  ): Promise<{ valid: boolean; issues: string[] }> {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              product: { select: { name: true } },
            },
          },
        },
      });

      if (!cart) {
        return { valid: false, issues: ['Cart not found'] };
      }

      const issues: string[] = [];

      await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          for (const item of cart.items) {
            const inventory = await tx.inventory.findFirst({
              where: inventoryWhereFor(
                item.productId,
                item.variantId,
                businessUnitId,
              ),
              select: { id: true, quantity: true, reserved: true },
            });

            const available = inventory
              ? Math.max(
                  0,
                  (inventory.quantity || 0) - (inventory.reserved || 0),
                )
              : 0;

            if (!inventory) {
              console.warn(
                `[cart.sync] No inventory row for ` +
                  `product=${item.productId} ` +
                  `variant=${item.variantId ?? '-'} ` +
                  `bu=${businessUnitId}`,
              );
              issues.push(
                `No inventory record for ${
                  (item as any).product?.name ?? item.productId
                }`,
              );
              await tx.cartItem.delete({ where: { id: item.id } });
            } else if (available === 0) {
              console.warn(
                `[cart.sync] Out of stock for ` +
                  `product=${item.productId} ` +
                  `inventory=${inventory.id} ` +
                  `qty=${inventory.quantity} ` +
                  `reserved=${inventory.reserved}`,
              );
              issues.push(
                `Out of stock: ${
                  (item as any).product?.name ?? item.productId
                }`,
              );
              await tx.cartItem.delete({ where: { id: item.id } });
            } else if (available < item.quantity) {
              console.warn(
                `[cart.sync] Insufficient stock for ` +
                  `product=${item.productId} ` +
                  `inventory=${inventory.id} ` +
                  `available=${available} ` +
                  `requested=${item.quantity}`,
              );
              issues.push(
                `Insufficient stock for ${
                  (item as any).product?.name ?? item.productId
                }: ${available} available`,
              );
              await tx.cartItem.update({
                where: { id: item.id },
                data: {
                  quantity: available,
                  total: round2(available * item.unitPrice),
                },
              });
            }
          }

          await this.recalculateCart(tx, cartId, businessUnitId);
        },
      );

      return { valid: issues.length === 0, issues };
    } catch (error) {
      this.handleError(error, 'CartService.syncCartWithInventory');
      throw error;
    }
  }

  async saveCartForLater(
    cartId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: { status: 'SAVED' },
        include: {
          items: { include: CART_ITEM_INCLUDE },
          customer: true,
        },
      });

      const { currency } = await this.resolveCartCurrency(
        cart.businessUnitId,
      );
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (cart as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(
        cartWithStatus,
        cart.businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.saveCartForLater');
      throw error;
    }
  }

  async restoreSavedCart(
    savedCartId: string,
    userId: string,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const savedCart = await tx.cart.findUnique({
            where: { id: savedCartId },
            include: { items: true },
          });

          if (!savedCart) {
            throw new AppError('Saved cart not found', 404);
          }

          if (savedCart.userId !== userId) {
            throw new AppError(
              'You do not have permission to restore this cart',
              403,
            );
          }

          if (savedCart.status && savedCart.status !== 'SAVED') {
            throw new AppError('Cart is not saved', 400);
          }

          let activeCart: any = await tx.cart.findFirst({
            where: { userId, businessUnitId, status: 'ACTIVE' },
          });

          if (activeCart) {
            await tx.cartItem.deleteMany({
              where: { cartId: activeCart.id },
            });
          } else {
            activeCart = await tx.cart.create({
              data: {
                userId,
                businessUnitId,
                subtotal: 0,
                tax: 0,
                discount: 0,
                total: 0,
                status: 'ACTIVE',
              },
            });
          }

          for (const item of savedCart.items) {
            await tx.cartItem.create({
              data: {
                cartId: activeCart.id,
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
                notes: item.notes,
              },
            });
          }

          await tx.cart.update({
            where: { id: savedCartId },
            data: { status: 'ACTIVE' },
          });

          const updatedCart = await this.recalculateCart(
            tx,
            activeCart.id,
            businessUnitId,
          );

          return updatedCart;
        },
      );

      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.restoreSavedCart');
      throw error;
    }
  }

  async transferCart(
    fromUserId: string,
    toUserId: string,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<CartResponse> {
    try {
      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const targetUser = await tx.user.findUnique({
            where: { id: toUserId },
            select: { id: true },
          });

          if (!targetUser) {
            throw new AppError('Target user not found', 404);
          }

          const sourceCart = await tx.cart.findFirst({
            where: {
              userId: fromUserId,
              businessUnitId,
              status: 'ACTIVE',
            },
          });

          if (!sourceCart) {
            throw new AppError('Source cart not found', 404);
          }

          let targetCart: any = await tx.cart.findFirst({
            where: {
              userId: toUserId,
              businessUnitId,
              status: 'ACTIVE',
            },
          });

          if (targetCart) {
            const sourceItems = await tx.cartItem.findMany({
              where: { cartId: sourceCart.id },
            });

            for (const item of sourceItems) {
              const existingItem = await tx.cartItem.findFirst({
                where: {
                  cartId: targetCart.id,
                  productId: item.productId,
                  variantId: item.variantId ?? null,
                },
              });

              if (existingItem) {
                const newQuantity =
                  existingItem.quantity + item.quantity;
                await tx.cartItem.update({
                  where: { id: existingItem.id },
                  data: {
                    quantity: newQuantity,
                    total: round2(newQuantity * item.unitPrice),
                  },
                });
              } else {
                await tx.cartItem.create({
                  data: {
                    cartId: targetCart.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                    notes: item.notes,
                  },
                });
              }
            }

            await tx.cartItem.deleteMany({
              where: { cartId: sourceCart.id },
            });

            await tx.cart.update({
              where: { id: sourceCart.id },
              data: {
                subtotal: 0,
                tax: 0,
                discount: 0,
                total: 0,
                status: 'ABANDONED',
              },
            });

            return await this.recalculateCart(
              tx,
              targetCart.id,
              businessUnitId,
            );
          }

          // No target cart — reassign the source cart to the new user.
          return await tx.cart.update({
            where: { id: sourceCart.id },
            data: { userId: toUserId },
            include: {
              items: { include: CART_ITEM_INCLUDE },
              customer: true,
            },
          });
        },
      );

      const { currency } = await this.resolveCartCurrency(businessUnitId);
      const displayContext = await this.resolveDisplayContext(
        currency,
        displayCurrencyFromRequest,
        (result as any).displayCurrency ?? null,
      );

      const cartWithStatus = ensureCartStatus(result);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId,
        displayContext,
      );
    } catch (error) {
      this.handleError(error, 'CartService.transferCart');
      throw error;
    }
  }

  async splitCart(
    userId: string,
    splits: Array<{
      cartItemId: string;
      quantity: number;
      targetUserId: string;
    }>,
    businessUnitId: string,
    displayCurrencyFromRequest?: string | null,
  ): Promise<{ sourceCart: CartResponse; targetCarts: CartResponse[] }> {
    try {
      const rawResult = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const sourceCart = await tx.cart.findFirst({
            where: { userId, businessUnitId, status: 'ACTIVE' },
          });

          if (!sourceCart) {
            throw new AppError('Source cart not found', 404);
          }

          const targetCartIds: string[] = [];
          const processedItems: string[] = [];

          for (const split of splits) {
            if (processedItems.includes(split.cartItemId)) {
              continue;
            }

            const cartItem = await tx.cartItem.findUnique({
              where: { id: split.cartItemId },
            });

            if (!cartItem) {
              throw new AppError(
                `Cart item ${split.cartItemId} not found`,
                404,
              );
            }

            if (cartItem.cartId !== sourceCart.id) {
              throw new AppError(
                `Cart item ${split.cartItemId} does not belong to source cart`,
                400,
              );
            }

            if (cartItem.quantity < split.quantity) {
              throw new AppError(
                `Insufficient quantity for item ${cartItem.id}`,
                400,
              );
            }

            let targetCart: any = await tx.cart.findFirst({
              where: {
                userId: split.targetUserId,
                businessUnitId,
                status: 'ACTIVE',
              },
            });

            if (!targetCart) {
              targetCart = await tx.cart.create({
                data: {
                  userId: split.targetUserId,
                  businessUnitId,
                  subtotal: 0,
                  tax: 0,
                  discount: 0,
                  total: 0,
                  status: 'ACTIVE',
                },
              });
            }

            await tx.cartItem.create({
              data: {
                cartId: targetCart.id,
                productId: cartItem.productId,
                variantId: cartItem.variantId,
                quantity: split.quantity,
                unitPrice: cartItem.unitPrice,
                total: round2(split.quantity * cartItem.unitPrice),
                notes: cartItem.notes,
              },
            });

            if (cartItem.quantity === split.quantity) {
              await tx.cartItem.delete({
                where: { id: split.cartItemId },
              });
            } else {
              const remainingQuantity =
                cartItem.quantity - split.quantity;
              await tx.cartItem.update({
                where: { id: split.cartItemId },
                data: {
                  quantity: remainingQuantity,
                  total: round2(
                    remainingQuantity * cartItem.unitPrice,
                  ),
                },
              });
            }

            processedItems.push(split.cartItemId);

            await this.recalculateCart(
              tx,
              targetCart.id,
              businessUnitId,
            );

            targetCartIds.push(targetCart.id);
          }

          await this.recalculateCart(
            tx,
            sourceCart.id,
            businessUnitId,
          );

          return {
            sourceCartId: sourceCart.id,
            targetCartIds,
          };
        },
      );

      // Re-fetch every cart through `getCartById` so the response
      // shape is identical to every other read path — same display
      // context handling, same field set. This is a small extra
      // round-trip cost for a mutation that runs once per split.
      const sourceCart = await this.getCartById(
        rawResult.sourceCartId,
        businessUnitId,
        displayCurrencyFromRequest,
      );

      const targetCarts = await Promise.all(
        rawResult.targetCartIds.map((id) =>
          this.getCartById(
            id,
            businessUnitId,
            displayCurrencyFromRequest,
          ),
        ),
      );

      return { sourceCart, targetCarts };
    } catch (error) {
      this.handleError(error, 'CartService.splitCart');
      throw error;
    }
  }

  // ============================================
  // SETTINGS
  // ============================================

  /**
   * Read the cart settings for a business unit.
   *
   * ⚠ Phase 2: Only `currencyCode` is persisted. Phase 1 removed
   *    the `currencySymbol` column from `CartSettings`; the symbol
   *    is now derived from the code at read time by the caller
   *    (frontend via `lib/currencies.ts`, backend via
   *    `currencyService.tryGetCurrency(code)?.symbol`).
   *
   *    The default `currencyCode` is resolved from the registry via
   *    `currencyService.resolveForBusiness`, keyed on the BU's own
   *    currency — NOT hardcoded to `'USD'`. That default predated
   *    the currency registry and would have labelled a UGX cart as
   *    USD on a Ugandan deployment.
   *
   *    The resolved value only applies on first creation of the
   *    settings row. Once persisted, the row is authoritative until
   *    an admin updates it.
   */
  async getCartSettings(businessUnitId: string): Promise<any> {
    let settings = await this.prisma.cartSettings.findFirst({
      where: { businessUnitId },
    });

    if (!settings) {
      // Resolve the default currency from the BU's own currency
      // (falling through to DEFAULT_CURRENCY env → registry default).
      const bu = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        select: { currency: true },
      });
      const resolvedCurrency = currencyService.resolveForBusiness(
        bu?.currency ?? null,
      );

      settings = await this.prisma.cartSettings.create({
        data: {
          businessUnitId,
          allowGuestCheckout: true,
          requireCustomerForReturn: false,
          maxCartItems: 50,
          cartExpiryHours: 24,
          discountEnabled: true,
          maxDiscountPercentage: 20,
          maxDiscountAmount: 100,
          autoApplyPromotions: true,
          loyaltyPointsEnabled: true,
          pointsPerDollar: 10,
          minPointsForRedeem: 100,
          maxPointsPerOrder: 1000,
          reserveStockOnAdd: true,
          reserveStockMinutes: 15,
          lowStockThreshold: 5,
          defaultPaymentMethod: 'CASH',
          allowPartialPayment: true,
          requireSignature: false,
          taxInclusive: false,
          freeShippingThreshold: 50,
          shippingCost: 5,
          taxRate: 8,
          notifyOnAbandonedCart: true,
          abandonedCartHours: 24,
          notifyOnLowStock: true,
          // ⚠ Phase 2: `currencySymbol` was removed here — the
          //   schema no longer stores it. Phase 1 deleted the
          //   column from `CartSettings` (and its siblings); the
          //   symbol is derivable from the code via the registry.
          //   Writing it would fail the generated Prisma client's
          //   type check and, if the client were stale, would 500
          //   the insert on the first GET /cart/settings.
          currencyCode: resolvedCurrency,
          showStockBadge: true,
          showVariantImages: true,
          isActive: true,
        },
      });
    }

    return settings;
  }

  /**
   * Update the cart settings for a business unit.
   *
   * ⚠ Phase 2: `currencySymbol` is stripped from the incoming patch
   *    before it reaches Prisma.
   *
   *    The controller's `CART_SETTINGS_ALLOWED_KEYS` whitelist (see
   *    `cartController.ts`) already drops it, but this service is
   *    also reachable from internal callers that don't go through
   *    that controller. Guarding at the persistence boundary makes
   *    the invariant hold regardless of caller: Phase 1 deleted the
   *    column, and nothing should be able to write it back.
   *
   *    `currencyCode` is the only currency field this method will
   *    persist.
   */
  async updateCartSettings(
    businessUnitId: string,
    data: any,
  ): Promise<any> {
    // ── Phase 2: strip removed fields ───────────────────────
    // `currencySymbol` no longer exists on the model. If a caller
    // (old controller version, direct internal caller, script)
    // still sends it, Prisma would either throw on the unknown
    // field or silently drop it depending on the client version.
    // Strip it here so behavior is deterministic.
    const cleanData = { ...(data ?? {}) };
    delete (cleanData as any).currencySymbol;

    const settings = await this.prisma.cartSettings.update({
      where: { businessUnitId },
      data: { ...cleanData, updatedAt: new Date() },
    });

    return settings;
  }

  // ============================================
  // HISTORY / ANALYTICS / EXPORT
  // ============================================

  async getAbandonedCarts(params: {
    businessUnitId: string;
    hours?: number;
    minValue?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    carts: any[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const {
        businessUnitId,
        hours = 24,
        minValue,
        page = 1,
        limit = 10,
      } = params;
      const skip = (page - 1) * limit;
      const cutoffDate = new Date(
        Date.now() - hours * 60 * 60 * 1000,
      );

      const where: any = {
        businessUnitId,
        status: 'ACTIVE',
        updatedAt: { lt: cutoffDate },
      };

      if (minValue) {
        where.total = { gte: minValue };
      }

      const [carts, total] = await Promise.all([
        this.prisma.cart.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            items: { include: { product: true } },
            customer: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
        this.prisma.cart.count({ where }),
      ]);

      return {
        carts,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'CartService.getAbandonedCarts');
      throw error;
    }
  }

  async getCartAnalytics(params: {
    businessUnitId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    try {
      const { businessUnitId, startDate, endDate } = params;

      const where: any = { businessUnitId };
      if (startDate) where.createdAt = { gte: startDate };
      if (endDate) {
        where.createdAt = { ...where.createdAt, lte: endDate };
      }

      const [
        totalCarts,
        cartItems,
        cartValues,
        activeCarts,
        abandonedCarts,
      ] = await Promise.all([
        this.prisma.cart.count({ where }),
        this.prisma.cartItem.aggregate({
          where: { cart: where },
          _avg: { quantity: true },
        }),
        this.prisma.cart.aggregate({
          where,
          _avg: { total: true },
        }),
        this.prisma.cart.count({
          where: { ...where, status: 'ACTIVE' },
        }),
        this.prisma.cart.count({
          where: { ...where, status: 'ABANDONED' },
        }),
      ]);

      const averageItems = cartItems._avg.quantity || 0;
      const averageValue = cartValues._avg.total || 0;
      const checkedOut = totalCarts - activeCarts - abandonedCarts;
      const conversionRate =
        totalCarts > 0 ? (checkedOut / totalCarts) * 100 : 0;

      return {
        totalCarts,
        activeCarts,
        abandonedCarts,
        averageItems,
        averageValue,
        conversionRate: round2(conversionRate),
      };
    } catch (error) {
      this.handleError(error, 'CartService.getCartAnalytics');
      throw error;
    }
  }

  async getCartHistory(params: {
    userId: string;
    businessUnitId: string;
    page?: number;
    limit?: number;
  }): Promise<{
    carts: any[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const { userId, businessUnitId, page = 1, limit = 10 } = params;
      const skip = (page - 1) * limit;

      const where = { userId, businessUnitId };

      const [carts, total] = await Promise.all([
        this.prisma.cart.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            items: { include: { product: true, variant: true } },
            customer: true,
          },
        }),
        this.prisma.cart.count({ where }),
      ]);

      return {
        carts,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'CartService.getCartHistory');
      throw error;
    }
  }

  async exportCartAnalytics(params: {
    businessUnitId: string;
    startDate: Date;
    endDate: Date;
    includeDetailedData?: boolean;
  }): Promise<{ analytics: any; detailedData: any[] }> {
    try {
      const {
        businessUnitId,
        startDate,
        endDate,
        includeDetailedData = true,
      } = params;

      const analytics = await this.getCartAnalytics({
        businessUnitId,
        startDate,
        endDate,
      });

      let detailedData: any[] = [];
      if (includeDetailedData) {
        detailedData = await this.prisma.cart.findMany({
          where: {
            businessUnitId,
            createdAt: { gte: startDate, lte: endDate },
          },
          include: {
            items: { include: { product: true, variant: true } },
            customer: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        });
      }

      return { analytics, detailedData };
    } catch (error) {
      this.handleError(error, 'CartService.exportCartAnalytics');
      throw error;
    }
  }

  // ============================================
  // PRIVATE — CURRENCY RESOLUTION
  // ============================================

  /**
   * Resolve the display currency for a business unit.
   *
   * Delegates to `currencyService.resolveForBusiness`, which walks:
   *   1. businessUnit.currency  (from DB)
   *   2. process.env.DEFAULT_CURRENCY
   *   3. registry default (currently UGX)
   *
   * This is the SAME walk used by
   * `checkoutService.resolveBusinessUnitCurrency` and
   * `paymentService.resolveCurrency`, so a cart, its checkout
   * summary, and the eventual `Payment` row all agree on what
   * currency the amounts are denominated in.
   *
   * Unknown business-unit codes are logged and skipped by
   * `resolveForBusiness` rather than throwing — a mis-seeded
   * business unit must not break a cart read.
   *
   * The symbol is derived from the code via the registry and is
   * NEVER persisted. Falls back to the ISO code itself when the
   * registry has no symbol registered for the code.
   *
   * ⚠ A read failure on the BU row (e.g. the row was deleted between
   *    the cart read and this lookup) degrades to the platform
   *    default rather than throwing. A cart whose BU vanished is
   *    already broken; failing the currency resolution on top of
   *    that would turn a degraded cart into a 500.
   */
  private async resolveCartCurrency(
    businessUnitId: string,
  ): Promise<{ currency: string; currencySymbol: string }> {
    let businessUnitCurrency: string | null = null;
    try {
      const bu = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        select: { currency: true },
      });
      businessUnitCurrency = bu?.currency ?? null;
    } catch (err) {
      console.warn(
        `[cart] Could not read currency for business unit ${businessUnitId}:`,
        err,
      );
    }

    const currency = currencyService.resolveForBusiness(
      businessUnitCurrency,
    );
    const symbol =
      currencyService.tryGetCurrency(currency)?.symbol ?? currency;

    return { currency, currencySymbol: symbol };
  }

  // ============================================
  // PRIVATE — DISPLAY CONTEXT (Phase 3a)
  // ============================================

  /**
   * Resolve the display context for a cart response.
   *
   * Precedence for the display currency:
   *   1. `displayCurrencyFromRequest` — the value the payer set in
   *      this session, sent by the frontend as `X-Display-Currency`.
   *   2. `cartDisplayCurrency` — the value stored on the cart row,
   *      persisted the last time the payer chose a currency.
   *   3. `null` — the payer has no display preference; the frontend
   *      renders ledger amounts.
   *
   * When the resolved display currency equals the ledger currency
   * (case-insensitive), the method returns `null` for everything —
   * there is nothing to convert, and the frontend should render
   * ledger amounts.
   *
   * When a rate cannot be resolved (the exchange-rate service
   * throws `503` because no rate is available for the pair), the
   * method also returns `null`. This is deliberate: a cart read
   * must not fail because FX is missing. The payer sees ledger
   * amounts, which are always correct; the display view is a
   * convenience that degrades gracefully.
   *
   * ⚠ Never throws. Every failure path returns `null` and logs.
   */
  private async resolveDisplayContext(
    ledgerCurrency: string,
    displayCurrencyFromRequest: string | null | undefined,
    cartDisplayCurrency: string | null | undefined,
  ): Promise<DisplayContext> {
    const rawTarget =
      displayCurrencyFromRequest || cartDisplayCurrency || '';
    const target = rawTarget.trim().toUpperCase();

    if (!target) {
      return { displayCurrency: null, rate: null, rateSource: null };
    }

    if (target === ledgerCurrency.toUpperCase()) {
      return { displayCurrency: null, rate: null, rateSource: null };
    }

    // Validate against the registry before attempting an FX lookup.
    // A malformed display currency (e.g. a stale localStorage value
    // from a previous version of the frontend) must not produce a
    // rate lookup against a currency that does not exist.
    if (!currencyService.tryGetCurrency(target)) {
      return { displayCurrency: null, rate: null, rateSource: null };
    }

    try {
      const resolved = await exchangeRateService.getRate(
        ledgerCurrency,
        target,
      );
      return {
        displayCurrency: target,
        rate: resolved.rate,
        rateSource: resolved.source,
      };
    } catch (err) {
      logger.warn(
        `[cart] Could not resolve display rate for ${ledgerCurrency} → ${target}: ` +
          `${err instanceof Error ? err.message : 'unknown'}`,
      );
      return { displayCurrency: null, rate: null, rateSource: null };
    }
  }

  /**
   * Compute the display-currency amounts from the ledger amounts and
   * a display context.
   *
   * Returns an object of `display*` fields, ready to be spread into
   * the response. When the context is empty (`displayCurrency ===
   * null`), returns an empty object so spreading it is a no-op.
   *
   * Rounds each display amount to the display currency's own decimal
   * precision (UGX: 0, KWD: 3, most: 2). This is the ONLY place a
   * display currency rounding occurs; every caller gets consistent
   * results.
   */
  private computeDisplayFields(
    ctx: DisplayContext,
    ledger: {
      subtotal: number;
      tax: number;
      discount: number;
      promotionDiscount: number;
      loyaltyDiscount: number;
      total: number;
      items: Array<{ unitPrice: number; total: number }>;
    },
  ): Partial<CartResponse> {
    if (!ctx.displayCurrency || ctx.rate === null || ctx.rate === undefined) {
      return {};
    }

    const meta = currencyService.tryGetCurrency(ctx.displayCurrency);
    const decimals = meta?.decimals ?? 2;
    const factor = Math.pow(10, decimals);

    const convert = (amount: number): number => {
      const raw = amount * ctx.rate!;
      return Math.round(raw * factor) / factor;
    };

    return {
      displayCurrency: ctx.displayCurrency,
      displayRate: ctx.rate,
      displayRateSource: ctx.rateSource,
      displaySubtotal: convert(ledger.subtotal),
      displayTax: convert(ledger.tax),
      displayDiscount: convert(ledger.discount),
      displayPromotionDiscount: convert(ledger.promotionDiscount),
      displayLoyaltyDiscount: convert(ledger.loyaltyDiscount),
      displayTotal: convert(ledger.total),
      displayItems: ledger.items.map((item) => ({
        unitPrice: convert(item.unitPrice),
        total: convert(item.total),
      })),
    };
  }

  // ============================================
  // PRIVATE — RECALCULATION
  // ============================================

  /**
   * Recalculate cart totals from the source-of-truth prices and
   * persist both the line totals and the cart-level totals.
   *
   * Two invariants this method enforces:
   *
   *   1. `cartItem.unitPrice` always equals the current server price
   *      (variant price if present, else product unitPrice). If a
   *      caller wrote a stale or malicious price, this method
   *      overwrites it.
   *
   *   2. `cart.subtotal`, `cart.tax`, `cart.discount`, and `cart.total`
   *      are always the output of `computeCartTotals`, never
   *      accumulated by hand.
   */
  private async recalculateCart(
    tx: Prisma.TransactionClient,
    cartId: string,
    businessUnitId: string,
    discountOverride?: number,
  ) {
    const items = await tx.cartItem.findMany({
      where: { cartId },
      include: {
        product: { select: { unitPrice: true, taxRate: true } },
        variant: { select: { price: true } },
      },
    });

    // Server-authoritative unit price per line.
    const lines = items.map((item: any) => {
      const serverUnitPrice =
        item.variant?.price ?? item.product.unitPrice ?? 0;
      return {
        unitPrice: serverUnitPrice,
        quantity: item.quantity,
        taxRate: item.product.taxRate ?? 0,
      };
    });

    const cart = await tx.cart.findUnique({ where: { id: cartId } });
    if (!cart) throw new AppError('Cart not found', 404);

    const cartDiscount =
      discountOverride !== undefined
        ? discountOverride
        : cart.discount ?? 0;

    const totals = computeCartTotals(lines, cartDiscount);

    // Sync every line's stored unitPrice and total to the server value.
    for (let i = 0; i < items.length; i++) {
      const serverUnitPrice = lines[i].unitPrice;
      const serverLineTotal = round2(
        serverUnitPrice * items[i].quantity,
      );

      if (
        items[i].unitPrice !== serverUnitPrice ||
        items[i].total !== serverLineTotal
      ) {
        await tx.cartItem.update({
          where: { id: items[i].id },
          data: {
            unitPrice: serverUnitPrice,
            total: serverLineTotal,
          },
        });
      }
    }

    return await tx.cart.update({
      where: { id: cartId },
      data: {
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
      },
      include: {
        items: {
          include: CART_ITEM_INCLUDE,
          orderBy: { createdAt: 'asc' },
        },
        customer: true,
      },
    });
  }

  // ============================================
  // PRIVATE — RESPONSE SHAPING
  // ============================================

  /**
   * Format a raw Prisma cart into the API response shape.
   *
   * Enriches each line with live inventory data (availableStock,
   * isInStock). Runs one inventory query per line — acceptable for
   * POS carts which are small. If carts ever grow large, replace this
   * with a single grouped query.
   *
   * ⚠ The `businessUnitId` parameter determines which BU's inventory
   *    the enrichment reads against. Callers must pass the CART's own
   *    BU, not the caller's. See `getCartById` for the fix that
   *    enforces this for the admin-fetch path.
   *
   * ⚠ Phase 2: this method also resolves and attaches `currency` and
   *    `currencySymbol` from the cart's own business unit, using the
   *    same registry walk as every other currency-aware code path in
   *    the backend. Callers do NOT need to resolve currency
   *    themselves — the response is always fully shaped.
   *
   * ⚠ Phase 3a: when a `displayContext` is passed with a non-null
   *    `displayCurrency`, the response additionally carries the
   *    `display*` fields. These are additive views of the ledger
   *    amounts; the ledger amounts are never modified.
   */
  private async formatCartResponse(
    cart: any,
    businessUnitId?: string,
    displayContext?: DisplayContext,
  ): Promise<CartResponse> {
    const effectiveBusinessUnitId =
      businessUnitId || cart.businessUnitId;

    const items: CartItemResponse[] = await Promise.all(
      (cart.items || []).map(async (item: any) => {
        let availableStock = 0;
        let isInStock = false;

        try {
          const inventory = await this.prisma.inventory.findFirst({
            where: inventoryWhereFor(
              item.productId,
              item.variantId,
              effectiveBusinessUnitId,
            ),
            select: { quantity: true, reserved: true },
          });

          if (inventory) {
            availableStock = Math.max(
              0,
              (inventory.quantity || 0) - (inventory.reserved || 0),
            );
            isInStock = availableStock > 0;
          }
        } catch (error) {
          console.warn(
            'Failed to get inventory for cart item:',
            error,
          );
        }

        return {
          id: item.id,
          productId: item.productId,
          product: {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            unitPrice: item.product.unitPrice,
            images: item.product.images || [],
          },
          variantId: item.variantId || undefined,
          variant: item.variant
            ? {
                id: item.variant.id,
                name: item.variant.name,
                sku: item.variant.sku,
                price: item.variant.price,
                attributes: item.variant.attributes,
              }
            : undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          notes: item.notes || undefined,
          availableStock,
          isInStock,
        };
      }),
    );

    const status = ((cart.status as string) ||
      'ACTIVE') as CartStatusValue;

    // ── Phase 2: resolve currency for this cart's BU ─────────
    // The cart has no currency column; the BU does. The same
    // `currencyService.resolveForBusiness` walk used by
    // `checkoutService` and `paymentService` is the single source
    // of truth, so the cart UI, the checkout summary, and the
    // Payment row all agree on what "50" means.
    //
    // Resolution is per-response, not per-request: an admin in BU-A
    // fetching a BU-B cart sees BU-B's currency, which is correct
    // because the amounts on that cart are denominated in BU-B's
    // currency.
    const { currency, currencySymbol } =
      await this.resolveCartCurrency(effectiveBusinessUnitId);

    // ── Phase 3a: compute display fields ─────────────────────
    // When a display context is present, add the `display*`
    // fields. The ledger amounts above are untouched. When the
    // context is empty (`displayCurrency: null`), the computed
    // object is empty and spreading it is a no-op.
    const displayFields = this.computeDisplayFields(
      displayContext ?? {
        displayCurrency: null,
        rate: null,
        rateSource: null,
      },
      {
        subtotal: cart.subtotal ?? 0,
        tax: cart.tax ?? 0,
        discount: cart.discount ?? 0,
        promotionDiscount: cart.promotionDiscount ?? 0,
        loyaltyDiscount: cart.loyaltyDiscount ?? 0,
        total: cart.total ?? 0,
        items: items.map((item) => ({
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    );

    return {
      id: cart.id,
      items,
      subtotal: cart.subtotal,
      tax: cart.tax,
      discount: cart.discount,
      discountType:
        (cart.discountType as CartDiscountTypeValue) || undefined,
      promotionCode: cart.promotionCode || undefined,
      promotionDiscount: cart.promotionDiscount || 0,
      loyaltyPointsUsed: cart.loyaltyPointsUsed || 0,
      loyaltyDiscount: cart.loyaltyDiscount || 0,
      total: cart.total,
      customerId: cart.customerId || undefined,
      customer: cart.customer || undefined,
      businessUnitId: cart.businessUnitId,
      userId: cart.userId,
      notes: cart.notes || undefined,
      status,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      itemCount: items.reduce(
        (sum: number, item: CartItemResponse) => sum + item.quantity,
        0,
      ),
      // ── Phase 2: currency fields ─────────────────────────
      currency,
      currencySymbol,
      // ── Phase 3a: display fields (empty when no override) ─
      ...displayFields,
    };
  }
}

export default CartService;
