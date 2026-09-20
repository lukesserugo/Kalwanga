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

const CANONICAL_PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'CREDIT_CARD',
  'DEBIT_CARD',
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
    .transform((v) => v ?? undefined),
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
  idempotencyKey: z.string().uuid().optional(),
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

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the effective business unit ID for a request.
 *
 * Explicit header / body / query value is checked FIRST, then the user's
 * own unit, then the most recent active unit, then a bootstrapped
 * default. The bootstrap path should never run in production — it
 * exists so a fresh dev database can accept its first cart without
 * manual seeding.
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

    const newBusinessUnit = await prisma.businessUnit.create({
      data: {
        name: 'Default Business Unit',
        code: `BU-${Date.now().toString().slice(-6)}`,
        isActive: true,
        companyId: company.id,
      },
    });

    return newBusinessUnit.id;
  } catch (error) {
    console.error('❌ Failed to resolve business unit:', error);
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
 * Convert a ZodError to the standard 400 response shape. Every handler
 * that parses a body uses this — the shape was duplicated ~10 times
 * before.
 */
function zodErrorResponse(error: z.ZodError): {
  success: false;
  message: string;
  errors: Array<{ field: string; message: string }>;
} {
  return {
    success: false,
    message: 'Validation error',
    errors: error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  };
}

// ============================================
// CART CONTROLLER
// ============================================

export const cartController = {
  // ============================================
  // READ
  // ============================================

  /**
   * GET /cart
   */
  async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
   */
  async getCartSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const data = req.body;

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
   */
  async syncCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
      );

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
  // CHECKOUT (delegates to canonical path)
  // ============================================

  /**
   * POST /cart/checkout
   *
   * Backward-compatibility shim. The canonical checkout endpoint is
   * `POST /checkout` handled by `checkoutController.createCheckout`.
   * Both ultimately call `CheckoutService.processCheckout`, so there
   * is exactly one implementation of the money math and inventory
   * mutation.
   *
   * Kept here so older clients that POST to `/cart/checkout` continue
   * to work. New clients should use `POST /checkout`.
   */
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { savedCartId } = req.body;

      if (!userId) throw new AppError('User ID is required', 400);
      if (!savedCartId) {
        throw new AppError('Saved cart ID is required', 400);
      }

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
      const userId = (req as any).user?.id || (req as any).user?.userId;
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
        format = 'csv',
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
        'Cart ID,Status,User,Email,Items,Subtotal,Total,Created At',
      );

      carts.forEach((cart: any) => {
        const user = cart.user || {};
        const itemsCount = cart.items?.length || 0;
        rows.push(
          `${cart.id},${cart.status},${user.firstName || ''} ${
            user.lastName || ''
          },${user.email || ''},${itemsCount},${cart.subtotal || 0},${
            cart.total || 0
          },${new Date(cart.createdAt).toLocaleString()}`,
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
        'Cart ID,User,Email,Items,Total,Abandoned At,Hours Abandoned',
      );

      carts.forEach((cart: any) => {
        const user = cart.user || {};
        const hoursAbandoned = Math.floor(
          (Date.now() - new Date(cart.updatedAt).getTime()) /
            (1000 * 60 * 60),
        );
        const itemsCount = cart.items?.length || 0;
        rows.push(
          `${cart.id},${user.firstName || ''} ${
            user.lastName || ''
          },${user.email || ''},${itemsCount},${cart.total || 0},${new Date(
            cart.updatedAt,
          ).toLocaleString()},${hoursAbandoned}`,
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
        rows.push(`Total Carts,${analytics.totalCarts}`);
        rows.push(`Active Carts,${analytics.activeCarts}`);
        rows.push(`Abandoned Carts,${analytics.abandonedCarts}`);
        rows.push(`Average Items,${analytics.averageItems}`);
        rows.push(`Average Value,${analytics.averageValue}`);
        rows.push(`Conversion Rate,${analytics.conversionRate}%`);
        rows.push('');
      }

      if (detailedData.length > 0) {
        rows.push('Detailed Cart Data');
        rows.push(
          'Cart ID,Status,User,Customer,Items,Subtotal,Total,Created At',
        );
        detailedData.forEach((cart: any) => {
          const user = cart.user || {};
          const customer = cart.customer || {};
          rows.push(
            `${cart.id},${cart.status},${user.firstName || ''} ${
              user.lastName || ''
            },${customer.firstName || ''} ${
              customer.lastName || ''
            },${cart.items?.length || 0},${cart.subtotal || 0},${
              cart.total || 0
            },${new Date(cart.createdAt).toLocaleString()}`,
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
