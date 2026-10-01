// packages/backend/src/controllers/cartController.ts

import type { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cartService.js';
import checkoutService from '../services/checkoutService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { realtimeService } from '../services/realtimeService.js';
import { z } from 'zod';

const cartService = new CartService();

// ============================================
// CANONICAL PAYMENT METHODS
// ============================================

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

const mergeGuestCartSchema = z.object({
  guestCartId: z.string().min(1, 'Guest cart ID is required'),
});

// ============================================
// HELPERS
// ============================================

function getUserId(req: Request): string | undefined {
  const user = (req as any).user;
  return user?.id || user?.userId;
}

function getDisplayCurrency(req: Request): string | undefined {
  const raw = req.headers['x-display-currency'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.toUpperCase();
}

async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

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

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

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

  async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);

      const cart = await cartService.getCartForRequest(
        userId,
        businessUnitId,
        displayCurrency,
      );

      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  },

  async getCartById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);

      const cart = await cartService.getCartById(
        id,
        businessUnitId,
        displayCurrency,
      );
      if (!cart) throw new AppError('Cart not found', 404);

      res.status(200).json({ success: true, data: cart });
    } catch (error) {
      next(error);
    }
  },

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

  async getCartSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.findActiveCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      if (!cart) {
        const stub = await cartService.getCartForRequest(
          userId,
          businessUnitId,
          displayCurrency,
        );

        return res.status(200).json({
          success: true,
          data: {
            id: '',
            itemCount: 0,
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            currency: stub.currency,
            currencySymbol: stub.currencySymbol,
            items: [],
          },
        });
      }

      const summary = await cartService.getCartSummary(
        cart.id,
        displayCurrency,
      );

      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // ITEM MUTATIONS
  // ============================================

  async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);

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
        displayCurrency,
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
        displayCurrency,
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

  async addMultipleItems(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const { items } = addMultipleItemsSchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.addMultipleItemsToCart(
        cart.id,
        items,
        userId,
        businessUnitId,
        displayCurrency,
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

  async updateItemQuantity(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { itemId } = req.params;

      if (!userId) throw new AppError('User ID is required', 400);

      const validatedData = updateQuantitySchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.updateCartItemQuantity(
        cart.id,
        itemId,
        validatedData.quantity,
        businessUnitId,
        displayCurrency,
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

  async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { itemId } = req.params;

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.removeItemFromCart(
        cart.id,
        itemId,
        displayCurrency,
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

  async clearCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.clearCart(
        cart.id,
        displayCurrency,
      );

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

  async applyDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { discount, discountType } = applyDiscountSchema.parse(
        req.body,
      );

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.applyDiscount(
        cart.id,
        discount,
        discountType,
        displayCurrency,
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

  async applyPromotion(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { promotionCode } = applyPromotionSchema.parse(req.body);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.applyPromotion(
        cart.id,
        promotionCode,
        displayCurrency,
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

  async applyLoyaltyPoints(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { customerId, points } = applyLoyaltyPointsSchema.parse(
        req.body,
      );

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.applyLoyaltyPoints(
        cart.id,
        customerId,
        points,
        displayCurrency,
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

  async associateCustomer(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { customerId } = associateCustomerSchema.parse(req.body);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.associateCustomer(
        cart.id,
        customerId,
        displayCurrency,
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

  async updateCartNotes(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { notes } = updateCartNotesSchema.parse(req.body);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const updatedCart = await cartService.updateCartNotes(
        cart.id,
        notes,
        displayCurrency,
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

  async getCartSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const settings = await cartService.getCartSettings(businessUnitId);

      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  },

  async updateCartSettings(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const data = (req.body ?? {}) as Record<string, unknown>;

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

  async syncCart(req: Request, res: Response, next: NextFunction) {
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
  // MERGE GUEST CART
  // ============================================

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

      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const cart = await cartService.getCartForRequest(
        userId,
        businessUnitId,
        displayCurrency,
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
  // CHECKOUT
  // ============================================
  //
  // ⚠ `checkoutService.js` is imported as a DEFAULT export. In
  //   this deployment, that module re-exports the `SaleService`
  //   class. The controller therefore calls only methods that
  //   `SaleService` actually exposes:
  //
  //     • `createSaleFromCart(cartId, userId, paymentBlock)`
  //       — records the already-tendered cart as a sale.
  //     • `getSaleById(id)`
  //       — re-reads the sale with its full relation graph so the
  //         response shape matches what consumers expect.
  //
  //   If `checkoutService.js` is later replaced with a real
  //   `CheckoutService` that exposes `processCheckout`, swap the
  //   two calls below back. Until then this handler resolves
  //   against the class that is actually exported.
  
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      if (!userId) throw new AppError('User ID is required', 400);

      const displayCurrency = getDisplayCurrency(req);
      const validatedData = checkoutSchema.parse(req.body);

      const businessUnitId = await getBusinessUnitId(req);

      // Load the cart with its items so we can validate ownership and
      // snapshot the line data in the same transaction.
      const cart = await prisma.cart.findUnique({
        where: { id: validatedData.cartId },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          customer: true,
        },
      });

      if (!cart) throw new AppError('Cart not found', 404);

      if (cart.userId !== userId) {
        throw new AppError('Cart does not belong to this user', 403);
      }

      if (cart.status && cart.status !== 'ACTIVE') {
        throw new AppError(
          `Cart is not active (status: ${cart.status}). Please start a new cart.`,
          400,
        );
      }

      if (!cart.items || cart.items.length === 0) {
        throw new AppError('Cart is empty', 400);
      }

      // Idempotency: if the caller supplied a key and a sale already
      // exists with that key, return the existing sale without
      // writing anything.
      if (validatedData.idempotencyKey) {
        const existing = await prisma.sale.findUnique({
          where: { idempotencyKey: validatedData.idempotencyKey },
        });
        if (existing) {
          const fullSale = await prisma.sale.findUnique({
            where: { id: existing.id },
            include: {
              customer: true,
              items: {
                include: { product: true, variant: true },
              },
              payments: true,
              businessUnit: true,
              receipt: true,
              cashRegister: true,
              cashRegisterSession: true,
            },
          });
          return res.status(200).json({
            success: true,
            data: fullSale,
            message: 'Checkout completed successfully',
          });
        }
      }

      // Resolve ledger currency from the cart's BU. This mirrors the
      // exact walk used by `cartService.resolveCartCurrency` and
      // `paymentService.resolveCurrency`.
      const buRecord = await prisma.businessUnit.findUnique({
        where: { id: cart.businessUnitId },
        select: { currency: true },
      });
      const ledgerCurrency =
        (buRecord?.currency && buRecord.currency.trim().length > 0
          ? buRecord.currency.trim().toUpperCase()
          : null) ??
        process.env.DEFAULT_CURRENCY ??
        'UGX';

      // Normalize the audit-only display currency against the ledger.
      const normalizedDisplayCurrency =
        displayCurrency && displayCurrency !== ledgerCurrency
          ? displayCurrency
          : null;

      const result = await prisma.$transaction(async (tx) => {
        // Totals come from the cart row — `cartService` keeps them
        // authoritative via `recalculateCart` on every mutation.
        const subtotal = cart.subtotal ?? 0;
        const tax = cart.tax ?? 0;
        const discount = cart.discount ?? 0;
        const total = cart.total ?? 0;

        const paidAmount =
          validatedData.paidAmount !== undefined &&
          validatedData.paidAmount !== null
            ? validatedData.paidAmount
            : total;
        const changeAmount = Math.max(0, paidAmount - total);

        const receiptNumber = `RCP-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase()}`;

        // 1) Create the Sale.
        const sale = await tx.sale.create({
          data: {
            receiptNumber,
            subtotal,
            tax,
            discount,
            total,
            paidAmount,
            changeAmount,
            notes: validatedData.notes ?? null,
            businessUnitId: cart.businessUnitId,
            userId,
            customerId:
              validatedData.customerId ?? cart.customerId ?? null,
            cashRegisterId: validatedData.cashRegisterId ?? null,
            cashRegisterSessionId:
              validatedData.cashRegisterSessionId ?? null,
            status: 'COMPLETED',
            saleDate: new Date(),
            idempotencyKey: validatedData.idempotencyKey ?? null,
          },
        });

        // 2) Snapshot each line onto the Sale.
        for (const item of cart.items) {
          const unitPrice =
            item.variant?.price ?? item.product?.unitPrice ?? item.unitPrice ?? 0;
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              variantId: item.variantId ?? null,
              quantity: item.quantity,
              unitPrice,
              discount: 0,
              total: unitPrice * item.quantity,
              notes: item.notes ?? null,
            },
          });
        }

        // 3) Record the payment. `currency` is required by the schema.
        await tx.payment.create({
          data: {
            amount: paidAmount,
            currency: ledgerCurrency,
            displayCurrency: normalizedDisplayCurrency,
            paymentMethod: validatedData.paymentMethod as any,
            status: 'PAID',
            saleId: sale.id,
            userId,
            cashRegisterId: validatedData.cashRegisterId ?? null,
            cashRegisterSessionId:
              validatedData.cashRegisterSessionId ?? null,
            processedAt: new Date(),
            reference: `PAY-${receiptNumber}`,
            metadata: {
              currency: ledgerCurrency,
              displayCurrency: normalizedDisplayCurrency,
              source: 'cartController.checkout',
            },
          },
        });

        // 4) Empty the cart. `customerId` is a relation, disconnect
        //    clears it; the scalar columns are reset to zero.
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.cart.update({
          where: { id: cart.id },
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
            notes: null,
            customer: { disconnect: true },
            status: 'ACTIVE',
            updatedAt: new Date(),
          },
        });

        // 5) Return the sale with the same relation graph the front
        //    end already renders from the detail endpoint.
        const fullSale = await tx.sale.findUnique({
          where: { id: sale.id },
          include: {
            customer: true,
            items: {
              include: { product: true, variant: true },
            },
            payments: true,
            businessUnit: true,
            receipt: true,
            cashRegister: true,
            cashRegisterSession: true,
          },
        });

        return fullSale;
      });

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

  async transferCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { fromUserId, toUserId } = transferCartSchema.parse(
        req.body,
      );

      if (!userId) throw new AppError('User ID is required', 400);

      const result = await cartService.transferCart(
        fromUserId,
        toUserId,
        businessUnitId,
        displayCurrency,
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

  async splitCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);
      const { items } = splitCartSchema.parse(req.body);

      if (!userId) throw new AppError('User ID is required', 400);

      const result = await cartService.splitCart(
        userId,
        items,
        businessUnitId,
        displayCurrency,
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

  async saveCartForLater(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const cart = await cartService.getOrCreateCart(
        userId,
        businessUnitId,
        displayCurrency,
      );

      const result = await cartService.saveCartForLater(
        cart.id,
        displayCurrency,
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Cart saved for later',
      });
    } catch (error) {
      next(error);
    }
  },

  async restoreSavedCart(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const displayCurrency = getDisplayCurrency(req);

      if (!userId) throw new AppError('User ID is required', 400);

      const { savedCartId } = restoreSavedCartSchema.parse(req.body);

      const result = await cartService.restoreSavedCart(
        savedCartId,
        userId,
        businessUnitId,
        displayCurrency,
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