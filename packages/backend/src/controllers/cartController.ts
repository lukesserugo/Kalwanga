// D:\Projects\Kalwanga\packages\backend\src\controllers\cartController.ts

import type { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cartService.js';
import { CheckoutService } from '../services/checkoutService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { realtimeService } from '../services/realtimeService.js';
import { z } from 'zod';

const cartService = new CartService();
const checkoutService = new CheckoutService();

// ============================================
// CANONICAL PAYMENT METHODS
// ============================================
//
// Mirrors `CANONICAL_PAYMENT_METHODS` in `../utils/validators.ts`. Kept
// local to the controller to avoid a circular import; the two must stay
// in sync. Any change to the backend-wide set should be applied here too.
//
// NOTE: `EXCHANGE` and `STORE_CREDIT` are valid POS "payment" methods
// when a customer exchanges goods or spends store credit; they are
// distinct from `RefundMethod` values but appear in the same UI menu.

const CANONICAL_PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'EMV',
  'MOBILE_MONEY',
  'MOBILE',
  'MPESA',
  'BANK_TRANSFER',
  'BANK',
  'GIFT_CARD',
  'GIFT',
  'LOYALTY_POINTS',
  'LOYALTY',
  'WALLET',
  'STORE_CREDIT',
  'EXCHANGE',
  'SPLIT',
  'MIXED',
  'OTHER',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
  'CHECK',
] as const;

const CANONICAL_PAYMENT_METHODS_SET = new Set<string>(
  CANONICAL_PAYMENT_METHODS,
);

const paymentMethodSchema = z
  .string()
  .min(1, 'Payment method is required')
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => CANONICAL_PAYMENT_METHODS_SET.has(v), {
    message: `Unsupported payment method. Accepted: ${CANONICAL_PAYMENT_METHODS.join(
      ', ',
    )}`,
  });

// ============================================
// VALIDATION SCHEMAS
// ============================================

const addItemSchema = z.object({
  productId: z
    .string()
    .min(1, 'Product ID is required')
    .refine(
      (val) => {
        const trimmed = val.trim();
        return trimmed.length > 0 && !trimmed.includes(' ');
      },
      { message: 'Invalid product ID format' },
    ),
  variantId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (v === null || v === undefined) return undefined;
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }),
  quantity: z
    .number()
    .int()
    .positive('Quantity must be positive')
    .default(1),
  notes: z.string().optional(),
});

const addMultipleItemsSchema = z.object({
  items: z.array(addItemSchema).min(1, 'At least one item is required'),
});

const updateQuantitySchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
});

const applyDiscountSchema = z.object({
  discount: z.number().min(0, 'Discount cannot be negative'),
  discountType: z
    .enum(['PERCENTAGE', 'FIXED'])
    .optional()
    .default('FIXED'),
});

const applyLoyaltyPointsSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  points: z.number().int().positive('Points must be positive'),
});

const associateCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
});

/**
 * `idempotencyKey` accepts any non-empty string. `Sale.idempotencyKey`
 * is a `String? @unique` column, not a UUID — POS clients commonly send
 * composite keys like `pos-<terminalId>-<seq>`. A `.uuid()` check would
 * reject those silently.
 */
const idempotencyKeySchema = z
  .string()
  .min(1, 'Idempotency key must not be empty')
  .max(255, 'Idempotency key is too long');

const checkoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: paymentMethodSchema,
  paidAmount: z.number().nonnegative('Paid amount must be zero or greater'),
  discount: z.number().min(0).optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  notes: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
  applyLoyaltyPoints: z.boolean().optional().default(false),
  businessUnitId: z.string().optional(),
  idempotencyKey: idempotencyKeySchema.optional(),
});

const applyPromotionSchema = z.object({
  promotionCode: z.string().min(1, 'Promotion code is required'),
});

const updateCartNotesSchema = z.object({
  notes: z.string().optional(),
});

const transferCartSchema = z.object({
  fromUserId: z.string().min(1, 'Source user ID is required'),
  toUserId: z.string().min(1, 'Target user ID is required'),
});

const splitCartSchema = z.object({
  items: z
    .array(
      z.object({
        cartItemId: z.string().min(1, 'Cart item ID is required'),
        quantity: z
          .number()
          .int()
          .positive('Quantity must be positive'),
        targetUserId: z.string().min(1, 'Target user ID is required'),
      }),
    )
    .min(1, 'At least one item split is required'),
});

const restoreSavedCartSchema = z.object({
  savedCartId: z.string().min(1, 'Saved cart ID is required'),
});

/**
 * Body accepted by `POST /cart/merge-guest`.
 *
 * Called by the frontend after login when it holds a guest cart id.
 * The merge is idempotent — a second call for the same pair is a
 * no-op — so the client can fire it without worrying about retries.
 */
const mergeGuestCartSchema = z.object({
  guestCartId: z.string().min(1, 'Guest cart ID is required'),
});

// ============================================
// HELPERS
// ============================================

/**
 * Extract the authenticated user's ID from the request in a
 * shape-agnostic way. The auth middleware has historically populated
 * either `req.user.id` or `req.user.userId` depending on the route,
 * so both are checked.
 */
function getUserId(req: Request): string | undefined {
  const user = (req as any).user;
  return user?.id || user?.userId;
}

/**
 * Resolve the effective business unit ID for a request.
 *
 * Explicit header / body / query value is checked FIRST, then the
 * user's own unit, then the most recent active unit, then a
 * bootstrapped default. The bootstrap path should never run in
 * production — it exists so a fresh dev database can accept its first
 * cart without manual seeding.
 */
async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  // 1. Explicit override (header > body > query)
  const explicit =
    (req.headers['x-business-unit-id'] as string | undefined) ||
    (req.body?.businessUnitId as string | undefined) ||
    (req.query?.businessUnitId as string | undefined);

  if (
    explicit &&
    explicit !== 'default' &&
    explicit !== 'default-business-unit'
  ) {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: explicit },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) {
      return exists.id;
    }
    console.warn(
      `⚠️ Explicit businessUnitId "${explicit}" not found or inactive, falling back`,
    );
  }

  // 2. User's own unit
  const userBu =
    user?.businessUnitId ||
    user?.businessUnits?.[0]?.businessUnitId ||
    user?.businessUnits?.[0]?.id;

  if (userBu && userBu !== 'default') {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: userBu },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) {
      return exists.id;
    }
  }

  // 3. Fallback: most recent active unit
  try {
    const businessUnit = await prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (businessUnit) {
      console.log(
        `✅ getBusinessUnitId: falling back to "${businessUnit.name}" (${businessUnit.id})`,
      );
      return businessUnit.id;
    }

    // 4. Bootstrap a default company + unit (dev-only path)
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Default Company',
          email: 'default@company.com',
          phone: '+0000000000',
          isActive: true,
        },
      });
    }

    // `code` is `@unique`. Retry on collision — the previous
    // `Date.now().slice(-6)` had a real chance of colliding twice in
    // the same second and would 500 the request.
    const companyId = company.id;
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = `${Date.now().toString().slice(-6)}${attempt}`;
      const code = `BU-${suffix}`;
      const existing = await prisma.businessUnit.findUnique({
        where: { code },
        select: { id: true },
      });
      if (existing) continue;

      const newBusinessUnit = await prisma.businessUnit.create({
        data: {
          name: 'Default Business Unit',
          code,
          isActive: true,
          companyId,
        },
      });
      return newBusinessUnit.id;
    }

    throw new AppError(
      'Failed to bootstrap business unit after multiple attempts',
      500,
    );
  } catch (error) {
    console.error('❌ Failed to resolve business unit:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to resolve business unit ID', 500);
  }
}

/**
 * Fire-and-forget real-time event. Wrapped so a failure here never
 * propagates to the caller.
 */
async function safeEmitEvent(
  eventName: string,
  data: any,
): Promise<void> {
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
    console.warn(
      `Failed to emit cart real-time event ${eventName}:`,
      error,
    );
  }
}

/**
 * Convert a ZodError to the standard 400 response shape.
 *
 * NOTE: `ZodError.issues` is the canonical field; `.errors` is a
 * deprecated alias in Zod 3.22+. Preferring `.issues` avoids a
 * future break when the alias is removed.
 */
function zodErrorResponse(error: z.ZodError): {
  success: false;
  message: string;
  errors: Array<{ field: string; message: string }>;
} {
  return {
    success: false,
    message: 'Validation error',
    errors: error.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  };
}

/**
 * Escape a value for CSV output. Wraps in quotes when the value
 * contains a comma, quote, newline, or carriage return, and doubles
 * any embedded quotes.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize one CSV row from an array of raw values.
 */
function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

/**
 * Reject `__proto__` / `constructor` / `prototype` keys before
 * spreading an untrusted object into Prisma.
 */
function assertSafeObjectKeys(
  obj: Record<string, unknown>,
  allowed: Set<string>,
): void {
  for (const key of Object.keys(obj)) {
    if (
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    ) {
      throw new AppError(
        `Disallowed key in settings payload: ${key}`,
        400,
      );
    }
    if (!allowed.has(key)) {
      throw new AppError(`Unknown settings field: ${key}`, 400);
    }
  }
}

/**
 * Whitelist of fields a client may set on `CartSettings`.
 */
const CART_SETTINGS_ALLOWED_KEYS = new Set<string>([
  'allowGuestCheckout',
  'requireCustomerForReturn',
  'maxCartItems',
  'cartExpiryHours',
  'discountEnabled',
  'maxDiscountPercentage',
  'maxDiscountAmount',
  'autoApplyPromotions',
  'loyaltyPointsEnabled',
  'pointsPerDollar',
  'minPointsForRedeem',
  'maxPointsPerOrder',
  'reserveStockOnAdd',
  'reserveStockMinutes',
  'lowStockThreshold',
  'defaultPaymentMethod',
  'allowPartialPayment',
  'requireSignature',
  'taxInclusive',
  'freeShippingThreshold',
  'shippingCost',
  'taxRate',
  'notifyOnAbandonedCart',
  'abandonedCartHours',
  'notifyOnLowStock',
  'currencyCode',
  'currencySymbol',
  'showStockBadge',
  'showVariantImages',
  'isActive',
]);

// ============================================
// CART CONTROLLER
// ============================================

export const cartController = {
  // ============================================
  // READ
  // ============================================

  /**
   * GET /cart
   *
   * Read-only. Returns the user's active cart, or an empty synthetic
   * cart when none exists. Never creates a row.
   *
   * ⚠ Creating on GET was the source of the 409 storm: the shopper
   *    already had a cart row (often a guest cart that survived
   *    login), the unique constraint `(userId, businessUnitId)`
   *    fired on the redundant INSERT, and every retry from the
   *    frontend re-hit the same failure.
   *
   * The frontend sees a cart-shaped object either way, so it never
   * has to branch on "no cart exists". The synthetic stub has
   * `id: ''`; callers that try to mutate it should treat that as
   * "not yet created" and let the mutation endpoint lazily create
   * one via `getOrCreateCart`.
   */
  async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getCartForRequest(
        userId,
        businessUnitId,
      );

      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /cart/:id
   */
  async getCartById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getCartById(id, businessUnitId);
      if (!cart) throw new AppError('Cart not found', 404);

      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /cart/count
   */
  async getCartCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const count = await cartService.getCartCount(
        userId,
        businessUnitId,
      );

      res.status(200).json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /cart/summary
   *
   * Read-only. When there is no active cart, returns a zeroed
   * summary rather than materializing one.
   */
  async getCartSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.findActiveCart(
        userId,
        businessUnitId,
      );

      if (!cart) {
        return res.status(200).json({
          success: true,
          data: {
            id: '',
            itemCount: 0,
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            items: [],
          },
        });
      }

      const summary = await cartService.getCartSummary(cart.id);

      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // ITEM MUTATIONS
  // ============================================

  /**
   * POST /cart/items
   */
  async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      let validatedData;
      try {
        validatedData = addItemSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json(zodErrorResponse(validationError));
        }
        throw validationError;
      }

      const productId = String(validatedData.productId).trim();
      if (!productId || productId.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
          errors: [
            { field: 'productId', message: 'Product ID is required' },
          ],
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          isActive: true,
          unitPrice: true,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product with ID "${productId}" not found`,
        });
      }

      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Product is not active',
        });
      }

      // Mutation path: lazily create the cart. `getOrCreateCart` is
      // race-safe now — a concurrent create no longer 409s.
      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.addItemToCart(
        cart.id,
        {
          productId,
          variantId: validatedData.variantId ?? undefined,
          quantity: validatedData.quantity,
          notes: validatedData.notes,
        },
        userId,
        businessUnitId,
      );

      await safeEmitEvent('cart:item-added', {
        cartId: cart.id,
        userId,
        productId,
        variantId: validatedData.variantId ?? null,
        quantity: validatedData.quantity,
      });

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Item added to cart',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  /**
   * POST /cart/items/bulk
   */
  async addMultipleItems(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const { items } = addMultipleItemsSchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.addMultipleItemsToCart(
        cart.id,
        items,
        userId,
        businessUnitId,
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: `${items.length} items added to cart`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  /**
   * PUT /cart/items/:itemId
   */
  async updateItemQuantity(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { itemId } = req.params;

      if (!userId) throw new AppError('User ID is required', 400);

      const validatedData = updateQuantitySchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.updateCartItemQuantity(
        cart.id,
        itemId,
        validatedData.quantity,
        businessUnitId,
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message:
          validatedData.quantity === 0
            ? 'Item removed from cart'
            : 'Cart updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  /**
   * DELETE /cart/items/:itemId
   */
  async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { itemId } = req.params;

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.removeItemFromCart(
        cart.id,
        itemId,
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Item removed from cart',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /cart
   */
  async clearCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.clearCart(cart.id);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Cart cleared',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // DISCOUNTS & LOYALTY
  // ============================================

  /**
   * POST /cart/discount
   */
  async applyDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { discount, discountType } = applyDiscountSchema.parse(
        req.body,
      );

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.applyDiscount(
        cart.id,
        discount,
        discountType,
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: `${
          discountType === 'PERCENTAGE' ? 'Percentage' : 'Fixed'
        } discount applied`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  /**
   * POST /cart/promotion
   */
  async applyPromotion(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { promotionCode } = applyPromotionSchema.parse(req.body);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.applyPromotion(
        cart.id,
        promotionCode,
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Promotion applied successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  /**
   * POST /cart/loyalty
   */
  async applyLoyaltyPoints(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { customerId, points } = applyLoyaltyPointsSchema.parse(
        req.body,
      );

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.applyLoyaltyPoints(
        cart.id,
        customerId,
        points,
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: `${points} loyalty points applied`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  // ============================================
  // CUSTOMER & NOTES
  // ============================================

  /**
   * POST /cart/customer
   */
  async associateCustomer(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { customerId } = associateCustomerSchema.parse(req.body);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.associateCustomer(
        cart.id,
        customerId,
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Customer associated with cart',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  /**
   * PATCH /cart/notes
   */
  async updateCartNotes(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { notes } = updateCartNotesSchema.parse(req.body);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const updatedCart = await cartService.updateCartNotes(
        cart.id,
        notes,
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Cart notes updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  // ============================================
  // SETTINGS
  // ============================================

  /**
   * GET /cart/settings
   */
  async getCartSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const settings = await cartService.getCartSettings(businessUnitId);

      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /cart/settings
   */
  async updateCartSettings(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const data = (req.body ?? {}) as Record<string, unknown>;

      // Reject unknown / prototype-pollution keys before touching Prisma.
      assertSafeObjectKeys(data, CART_SETTINGS_ALLOWED_KEYS);

      const settings = await cartService.updateCartSettings(
        businessUnitId,
        data,
      );

      res.status(200).json({
        success: true,
        data: settings,
        message: 'Cart settings updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // SYNC
  // ============================================

  /**
   * POST /cart/sync
   *
   * Read-only when there is no cart: returns `{ valid: true, issues: [] }`
   * without materializing a row. When a cart exists, reconciles it
   * against current inventory.
   */
  async syncCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.findActiveCart(
        userId,
        businessUnitId,
      );

      // No cart → nothing to reconcile. Return the empty success shape
      // rather than creating a row on a read-adjacent endpoint.
      if (!cart) {
        return res.status(200).json({
          success: true,
          data: { valid: true, issues: [] },
          message: 'Cart is in sync with inventory',
        });
      }

      const syncResult = await cartService.syncCartWithInventory(
        cart.id,
        businessUnitId,
      );

      res.status(200).json({
        success: true,
        data: syncResult,
        message: syncResult.valid
          ? 'Cart is in sync with inventory'
          : 'Cart has inventory issues',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // MERGE GUEST CART (post-login reconciliation)
  // ============================================

  /**
   * POST /cart/merge-guest
   *
   * Called by the frontend immediately after login when it holds a
   * guest cart id in local storage. Merges the guest cart's items
   * into the authenticated user's cart and marks the guest cart
   * ABANDONED.
   *
   * Idempotent: a second call for the same pair is a no-op. The
   * frontend can fire this without worrying about retries.
   *
   * This endpoint exists so the frontend doesn't have to embed the
   * merge into `/auth/sync` — some auth flows aren't ours to modify,
   * and the guest cart id lives client-side.
   */
  async mergeGuestCart(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      const { guestCartId } = mergeGuestCartSchema.parse(req.body);

      await cartService.mergeGuestCartIntoUserCart(guestCartId, userId);

      // Return the user's cart post-merge so the caller can render
      // immediately without a follow-up GET.
      const businessUnitId = await getBusinessUnitId(req);
      const cart = await cartService.getCartForRequest(
        userId,
        businessUnitId,
      );

      res.status(200).json({
        success: true,
        data: cart,
        message: 'Guest cart merged',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  // ============================================
  // CHECKOUT (delegates to canonical path)
  // ============================================

  /**
   * POST /cart/checkout
   *
   * Backward-compatibility shim. The canonical checkout endpoint is
   * `POST /checkout` handled by `checkoutController.createCheckout`.
   * Both ultimately call `CheckoutService.processCheckout`, so there
   * is exactly one implementation of the money math and inventory   * mutation.
   */
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      const validatedData = checkoutSchema.parse(req.body);

      const result = await checkoutService.processCheckout(
        {
          cartId: validatedData.cartId,
          customerId: validatedData.customerId,
          paymentMethod: validatedData.paymentMethod,
          paidAmount: validatedData.paidAmount,
          discount: validatedData.discount,
          notes: validatedData.notes,
          cashRegisterId: validatedData.cashRegisterId,
          cashRegisterSessionId: validatedData.cashRegisterSessionId,
          applyLoyaltyPoints: validatedData.applyLoyaltyPoints,
          businessUnitId: validatedData.businessUnitId,
          idempotencyKey: validatedData.idempotencyKey,
        },
        userId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout completed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  // ============================================
  // TRANSFER / SPLIT / SAVE / RESTORE
  // ============================================

  /**
   * POST /cart/transfer
   */
  async transferCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { fromUserId, toUserId } = transferCartSchema.parse(
        req.body,
      );

      if (!userId) throw new AppError('User ID is required', 400);

      const result = await cartService.transferCart(
        fromUserId,
        toUserId,
        businessUnitId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Cart transferred successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  /**
   * POST /cart/split
   */
  async splitCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { items } = splitCartSchema.parse(req.body);

      if (!userId) throw new AppError('User ID is required', 400);

      const result = await cartService.splitCart(
        userId,
        items,
        businessUnitId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Cart split successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  /**
   * POST /cart/save-for-later
   */
  async saveCartForLater(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

      const result = await cartService.saveCartForLater(cart.id);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Cart saved for later',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /cart/restore
   */
  async restoreSavedCart(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const { savedCartId } = restoreSavedCartSchema.parse(req.body);

      const result = await cartService.restoreSavedCart(
        savedCartId,
        userId,
        businessUnitId,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Saved cart restored successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  },

  // ============================================
  // HISTORY / ANALYTICS
  // ============================================

  /**
   * GET /cart/history
   */
  async getCartHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      if (!userId) throw new AppError('User ID is required', 400);

      const result = await cartService.getCartHistory({
        userId,
        businessUnitId,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
      });

      res.status(200).json({
        success: true,
        data: result.carts,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /cart/analytics
   */
  async getCartAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const analytics = await cartService.getCartAnalytics({
        businessUnitId,
        startDate: startDate
          ? new Date(startDate as string)
          : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.status(200).json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /cart/abandoned
   */
  async getAbandonedCarts(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { hours = 24, minValue, page, limit } = req.query;

      const result = await cartService.getAbandonedCarts({
        businessUnitId,
        hours: parseInt(hours as string) || 24,
        minValue: minValue ? parseFloat(minValue as string) : undefined,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
      });

      res.status(200).json({
        success: true,
        data: result.carts,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // EXPORTS
  // ============================================

  /**
   * POST /cart/history/export
   */
  async exportCartHistory(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const {
        dateRange = 'week',
        startDate,
        endDate,
        status,
        includeItems = true,
      } = req.body;

      const { start, end } = computeDateRange(dateRange, startDate, endDate);

      const carts = await prisma.cart.findMany({
        where: {
          businessUnitId,
          createdAt: { gte: start, lte: end },
          ...(status && status !== 'all' ? { status } : {}),
        },
        include: {
          items: includeItems
            ? { include: { product: true, variant: true } }
            : false,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      const rows: string[] = [];
      rows.push('Cart History Export');
      rows.push(`Generated: ${new Date().toLocaleString()}`);
      rows.push('');
      rows.push(
        csvRow([
          'Cart ID',
          'Status',
          'User',
          'Email',
          'Items',
          'Subtotal',
          'Total',
          'Created At',
        ]),
      );

      carts.forEach((cart: any) => {
        const user = cart.user || {};
        const itemsCount = cart.items?.length || 0;
        rows.push(
          csvRow([
            cart.id,
            cart.status,
            `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            user.email || '',
            itemsCount,
            cart.subtotal || 0,
            cart.total || 0,
            new Date(cart.createdAt).toLocaleString(),
          ]),
        );
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cart-history-${
          new Date().toISOString().split('T')[0]
        }.csv"`,
      );
      res.send(rows.join('\n'));
    } catch (error) {
      console.error('Export cart history error:', error);
      next(error);
    }
  },

  /**
   * POST /cart/abandoned/export
   */
  async exportAbandonedCarts(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const {
        hours = 24,
        minValue,
        status,
        includeCustomerDetails = true,
      } = req.body;

      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const carts = await prisma.cart.findMany({
        where: {
          businessUnitId,
          status: 'ACTIVE',
          updatedAt: { lt: cutoffDate },
          ...(minValue ? { total: { gte: minValue } } : {}),
          ...(status && status !== 'all' ? { status } : {}),
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unitPrice: true,
                },
              },
              variant: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          customer: includeCustomerDetails,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10000,
      });

      const rows: string[] = [];
      rows.push('Abandoned Carts Export');
      rows.push(`Generated: ${new Date().toLocaleString()}`);
      rows.push(`Abandoned for: ${hours} hours`);
      rows.push('');
      rows.push(
        csvRow([
          'Cart ID',
          'User',
          'Email',
          'Items',
          'Total',
          'Abandoned At',
          'Hours Abandoned',
        ]),
      );

      carts.forEach((cart: any) => {
        const user = cart.user || {};
        const hoursAbandoned = Math.floor(
          (Date.now() - new Date(cart.updatedAt).getTime()) /
            (1000 * 60 * 60),
        );
        const itemsCount = cart.items?.length || 0;
        rows.push(
          csvRow([
            cart.id,
            `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            user.email || '',
            itemsCount,
            cart.total || 0,
            new Date(cart.updatedAt).toLocaleString(),
            hoursAbandoned,
          ]),
        );
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="abandoned-carts-${
          new Date().toISOString().split('T')[0]
        }.csv"`,
      );
      res.send(rows.join('\n'));
    } catch (error) {
      console.error('Export abandoned carts error:', error);
      next(error);
    }
  },

  /**
   * POST /cart/analytics/export
   */
  async exportAnalytics(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const {
        dateRange = 'week',
        startDate,
        endDate,
        includeSummary = true,
        includeDetailedData = true,
      } = req.body;

      const { start, end } = computeDateRange(dateRange, startDate, endDate);

      const analytics = await cartService.getCartAnalytics({
        businessUnitId,
        startDate: start,
        endDate: end,
      });

      let detailedData: any[] = [];
      if (includeDetailedData) {
        detailedData = await prisma.cart.findMany({
          where: {
            businessUnitId,
            createdAt: { gte: start, lte: end },
          },
          include: {
            items: {
              include: { product: true, variant: true },
            },
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

      const rows: string[] = [];

      if (includeSummary) {
        rows.push('Cart Analytics Summary');
        rows.push(csvRow(['Total Carts', analytics.totalCarts]));
        rows.push(csvRow(['Active Carts', analytics.activeCarts]));
        rows.push(csvRow(['Abandoned Carts', analytics.abandonedCarts]));
        rows.push(csvRow(['Average Items', analytics.averageItems]));
        rows.push(csvRow(['Average Value', analytics.averageValue]));
        rows.push(
          csvRow(['Conversion Rate', `${analytics.conversionRate}%`]),
        );
        rows.push('');
      }

      if (detailedData.length > 0) {
        rows.push('Detailed Cart Data');
        rows.push(
          csvRow([
            'Cart ID',
            'Status',
            'User',
            'Customer',
            'Items',
            'Subtotal',
            'Total',
            'Created At',
          ]),
        );
        detailedData.forEach((cart: any) => {
          const user = cart.user || {};
          const customer = cart.customer || {};
          rows.push(
            csvRow([
              cart.id,
              cart.status,
              `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              `${customer.firstName || ''} ${
                customer.lastName || ''
              }`.trim(),
              cart.items?.length || 0,
              cart.subtotal || 0,
              cart.total || 0,
              new Date(cart.createdAt).toLocaleString(),
            ]),
          );
        });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cart-analytics-${
          new Date().toISOString().split('T')[0]
        }.csv"`,
      );
      res.send(rows.join('\n'));
    } catch (error) {
      console.error('Export error:', error);
      next(error);
    }
  },
};

// ============================================
// MODULE-LEVEL EXPORT HELPERS
// ============================================

/**
 * Resolve a date range name + optional custom dates into a concrete
 * `[start, end]` pair. Used by every export endpoint.
 */
function computeDateRange(
  dateRange: string,
  startDate?: string,
  endDate?: string,
): { start: Date; end: Date } {
  if (dateRange === 'custom' && startDate && endDate) {
    return {
      start: new Date(startDate),
      end: new Date(endDate),
    };
  }

  const end = new Date();
  const start = new Date();

  switch (dateRange) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }

  return { start, end };
}

export default cartController;
