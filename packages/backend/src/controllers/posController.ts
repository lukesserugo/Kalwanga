// D:\Projects\Kalwanga\packages\backend\src\controllers\posController.ts

import { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cartService.js';
import { CheckoutService } from '../services/checkoutService.js';
import { SaleService } from '../services/saleService.js';
import { ProductService } from '../services/productService.js';
import { CustomerService } from '../services/customerService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const cartService = new CartService();
const checkoutService = new CheckoutService();
const saleService = new SaleService();
const productService = new ProductService();
const customerService = new CustomerService();

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the business unit ID for the current request.
 *
 * Priority:
 *   1. user.businessUnitId
 *   2. user.businessUnits[0].businessUnitId
 *   3. body.businessUnitId
 *   4. query.businessUnitId
 *   5. first active BusinessUnit in the DB
 *   6. create a default Company + BusinessUnit
 *
 * Matches the resolver in `saleController.getBusinessUnitId` so both
 * controllers behave identically under every auth-middleware configuration.
 */
async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  const candidates = [
    user?.businessUnitId,
    user?.businessUnits?.[0]?.businessUnitId,
    req.body?.businessUnitId,
    req.query?.businessUnitId,
  ].filter((v): v is string => Boolean(v) && v !== 'default');

  if (candidates.length > 0) {
    return candidates[0];
  }

  try {
    const existing = await prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (existing) return existing.id;

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

    const newBU = await prisma.businessUnit.create({
      data: {
        name: 'Default Business Unit',
        code: 'DEFAULT',
        isActive: true,
        companyId: company.id,
      },
    });

    return newBU.id;
  } catch (error) {
    console.error('❌ Failed to resolve business unit:', error);
    throw new AppError('Failed to resolve business unit ID', 500);
  }
}

/**
 * Extract the current user ID from the authenticated request.
 */
function getUserId(req: Request): string {
  const user = (req as any).user;
  const userId = user?.id || user?.userId;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }
  return userId;
}

/**
 * Extract the idempotency key for this request.
 *
 * Source order (first non-empty wins):
 *   1. `Idempotency-Key` HTTP header (canonical)
 *   2. `idempotency-key` HTTP header (lowercase variant)
 *   3. `idempotencyKey` in the request body (SDK / form clients)
 *
 * Returns `undefined` when no key is supplied — the flow then behaves
 * exactly like before (no idempotency, new sale every time).
 */
function getIdempotencyKey(req: Request): string | undefined {
  const headerKey =
    (req.headers['idempotency-key'] as string | undefined) ??
    (req.headers['Idempotency-Key'] as string | undefined);

  const bodyKey = (req.body && (req.body.idempotencyKey as string | undefined)) || undefined;

  const raw = headerKey || bodyKey;
  if (!raw) return undefined;

  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

/**
 * Canonical set of payment methods accepted by the POS / cart checkout
 * flow. Mirrors `CANONICAL_PAYMENT_METHODS` from `../utils/validators.js`.
 */
const POS_PAYMENT_METHODS = new Set<string>([
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
]);

const paymentMethodSchema = z
  .string()
  .min(1, 'Payment method is required')
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => POS_PAYMENT_METHODS.has(v), {
    message: `Unsupported payment method. Accepted: ${Array.from(POS_PAYMENT_METHODS).join(', ')}`,
  });

const posAddItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
  notes: z.string().optional(),
});

const posUpdateItemSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  notes: z.string().optional(),
});

const posCheckoutSchema = z.object({
  customerId: z.string().optional().nullable(),
  paymentMethod: paymentMethodSchema,
  // Zero is legitimate (loyalty-only / fully-discounted).
  paidAmount: z.number().nonnegative('Paid amount must be zero or greater'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  tipAmount: z.number().min(0).optional(),
  /**
   * Optional. Can also arrive via the `Idempotency-Key` HTTP header,
   * which is the preferred channel. Body fallback exists for clients
   * that can't set custom headers.
   */
  idempotencyKey: z.string().trim().min(1).max(255).optional(),
});

const posCreateCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

const posBulkAddItemsSchema = z.object({
  items: z.array(posAddItemSchema).min(1, 'At least one item is required'),
});

const posApplyDiscountSchema = z.object({
  discount: z.number().min(0, 'Discount cannot be negative'),
});

const posApplyLoyaltySchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  points: z.number().int().positive('Points must be positive'),
});

const posAssociateCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
});

// ============================================
// POS CONTROLLER
// ============================================

export const posController = {
  // ============================================
  // CART OPERATIONS
  // ============================================

  async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  },

  async getCartDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const syncResult = await cartService.syncCartWithInventory(cart.id, businessUnitId);

      const fullCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unitPrice: true,
                  images: true,
                  inventory: {
                    where: { businessUnitId },
                    select: { quantity: true, reserved: true },
                  },
                },
              },
              variant: {
                select: { id: true, name: true, sku: true, price: true },
              },
            },
          },
          customer: true,
        },
      });

      res.status(200).json({
        success: true,
        data: { cart: fullCart, inventoryStatus: syncResult },
      });
    } catch (error) {
      next(error);
    }
  },

  async clearCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.clearCart(cart.id);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Cart cleared successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // ITEM OPERATIONS
  // ============================================

  async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const validatedData = posAddItemSchema.parse(req.body);
      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.addItemToCart(
        cart.id,
        {
          productId: validatedData.productId,
          variantId: validatedData.variantId || undefined,
          quantity: validatedData.quantity,
          notes: validatedData.notes,
        },
        userId,
        businessUnitId
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Item added to cart',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  async addMultipleItems(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const validatedData = posBulkAddItemsSchema.parse(req.body);
      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      // Normalize `variantId: null` → `undefined` so the payload matches
      // CartService.addMultipleItemsToCart's `CartItemInput` type.
      const items = validatedData.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? undefined,
        quantity: item.quantity,
        notes: item.notes,
      }));

      const updatedCart = await cartService.addMultipleItemsToCart(
        cart.id,
        items,
        userId,
        businessUnitId
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: `${validatedData.items.length} items added to cart`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { itemId } = req.params;
      const validatedData = posUpdateItemSchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.updateCartItemQuantity(
        cart.id,
        itemId,
        validatedData.quantity,
        businessUnitId
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: validatedData.quantity === 0 ? 'Item removed' : 'Item updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const { itemId } = req.params;

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.removeItemFromCart(cart.id, itemId);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Item removed from cart',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CART MODIFIER OPERATIONS
  // ============================================

  async applyDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const validatedData = posApplyDiscountSchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.applyDiscount(cart.id, validatedData.discount);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: `Discount of ${validatedData.discount} applied`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  async applyLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const validatedData = posApplyLoyaltySchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.applyLoyaltyPoints(
        cart.id,
        validatedData.customerId,
        validatedData.points
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: `${validatedData.points} loyalty points applied`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  async associateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);
      const validatedData = posAssociateCustomerSchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.associateCustomer(
        cart.id,
        validatedData.customerId
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Customer associated with cart',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  async removeDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.applyDiscount(cart.id, 0);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Discount removed from cart',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CHECKOUT OPERATIONS
  // ============================================

  /**
   * POST /api/sales/pos/checkout
   *
   * Idempotent when the client supplies an `Idempotency-Key` header
   * (or `idempotencyKey` in the body). Retries with the same key return
   * the original sale — see `SaleService.createSaleFromCart`.
   */
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const validatedData = posCheckoutSchema.parse(req.body);
      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      if (cart.items.length === 0) {
        throw new AppError('Cart is empty', 400);
      }

      // ✅ Resolve the idempotency key from header (preferred) or body.
      const idempotencyKey = getIdempotencyKey(req);

      const result = await checkoutService.processCheckout(
        {
          cartId: cart.id,
          customerId: validatedData.customerId || undefined,
          paymentMethod: validatedData.paymentMethod,
          paidAmount: validatedData.paidAmount,
          discount: validatedData.discount,
          notes: validatedData.notes,
          cashRegisterId: validatedData.cashRegisterId,
          cashRegisterSessionId: validatedData.cashRegisterSessionId,
          applyLoyaltyPoints: validatedData.applyLoyaltyPoints,
          // ✅ Forward the key so the sale layer persists / dedupes on it.
          idempotencyKey,
        },
        userId
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout completed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  async getCheckoutSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const summary = await checkoutService.getCheckoutSummary(cart.id);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // PRODUCT OPERATIONS
  // ============================================

  async searchProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { query, limit = '10', category } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new AppError('Search query is required', 400);
      }

      const results = await productService.searchProducts({
        query: query as string,
        category: category as string,
        businessUnitId,
      });

      res.status(200).json({
        success: true,
        data: results.slice(0, Number(limit)),
        total: results.length,
      });
    } catch (error) {
      next(error);
    }
  },

  async getProductByBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { barcode } = req.params;

      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      const product = await productService.getProductByBarcode(barcode, businessUnitId);

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  async getProductBySku(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { sku } = req.params;

      if (!sku) {
        throw new AppError('SKU is required', 400);
      }

      const product = await productService.getProductBySku(sku, businessUnitId);

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Product ID is required', 400);
      }

      const product = await productService.getProductById(id);

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get popular products (top sellers over the last 30 days).
   *
   * GET /api/sales/pos/products/popular?limit=10
   *
   * Uses `productService.getMostPurchased` if available; otherwise falls
   * back to a direct Prisma groupBy on `saleItem`.
   */
  async getPopularProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const limit = parseInt(req.query.limit as string) || 10;
      const days = parseInt(req.query.days as string) || 30;

      const since = new Date();
      since.setDate(since.getDate() - days);

      // Prefer the service method if it exists.
      const anyProductService = productService as any;
      if (typeof anyProductService.getMostPurchased === 'function') {
        const results = await anyProductService.getMostPurchased(
          businessUnitId,
          limit,
          since
        );
        res.status(200).json({ success: true, data: results });
        return;
      }

      // Fallback: direct Prisma aggregation.
      const popularItems = await prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: {
            businessUnitId,
            status: { notIn: ['CANCELLED', 'DELETED'] },
            saleDate: { gte: since },
          },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: limit,
      });

      if (popularItems.length === 0) {
        res.status(200).json({ success: true, data: [] });
        return;
      }

      const productIds = popularItems.map((p: any) => p.productId);

      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
          businessUnitId,
        },
        include: {
          inventory: {
            where: { businessUnitId },
            select: { quantity: true, reserved: true },
          },
          category: { select: { id: true, name: true } },
        },
      });

      const result = popularItems
        .map((agg: any) => {
          const product = products.find((p: any) => p.id === agg.productId);
          if (!product) return null;

          const inv = Array.isArray(product.inventory)
            ? product.inventory[0]
            : product.inventory;
          const available = inv
            ? Math.max(0, inv.quantity - (inv.reserved || 0))
            : 0;

          return {
            id: product.id,
            name: product.name,
            sku: product.sku,
            unitPrice: product.unitPrice,
            images: product.images || [],
            category: product.category?.name || null,
            categoryId: product.category?.id || null,
            inventory: inv
              ? { available, quantity: inv.quantity, reserved: inv.reserved || 0 }
              : { available: 0, quantity: 0, reserved: 0 },
            soldCount: agg._sum?.quantity || 0,
            revenue: agg._sum?.total || 0,
          };
        })
        .filter((p: any): p is NonNullable<typeof p> => p !== null);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CUSTOMER OPERATIONS
  // ============================================

  async searchCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, limit = '10' } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new AppError('Search query is required', 400);
      }

      const result = await customerService.getAllCustomers({
        search: query as string,
        page: 1,
        limit: Number(limit),
      });

      res.status(200).json({
        success: true,
        data: result.customers,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  },

  async getCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await customerService.getCustomerById(id);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      res.status(200).json({
        success: true,
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  },

  async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const validatedData = posCreateCustomerSchema.parse(req.body);

      // Resolve companyId: prefer the user's own company, else the first
      // company in the DB. Do NOT use businessUnitId — Customer.companyId
      // is a foreign key to Company, not BusinessUnit.
      let companyId: string | undefined = user?.companyId;
      if (!companyId) {
        const company = await prisma.company.findFirst({
          select: { id: true },
        });
        companyId = company?.id;
      }

      if (!companyId) {
        throw new AppError(
          'No company found. Please set up a company before creating customers.',
          400
        );
      }

      // POS customers are walk-ins; fill in defaults where needed.
      const phoneNumber =
        validatedData.phoneNumber && validatedData.phoneNumber.trim().length > 0
          ? validatedData.phoneNumber.trim()
          : 'N/A';

      const email =
        validatedData.email && validatedData.email.trim().length > 0
          ? validatedData.email.trim()
          : `walkin-${Date.now()}@pos.local`;

      const customer = await customerService.createCustomer({
        firstName: validatedData.firstName.trim(),
        lastName: validatedData.lastName.trim(),
        email,
        phoneNumber,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zipCode: validatedData.zipCode,
        country: validatedData.country || 'Uganda',
        notes: validatedData.notes,
        companyId,
      });

      res.status(201).json({
        success: true,
        data: customer,
        message: 'Customer created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  // ============================================
  // SUMMARY OPERATIONS
  // ============================================

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const syncResult = await cartService.syncCartWithInventory(cart.id, businessUnitId);

      const fullCart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, unitPrice: true },
              },
            },
          },
        },
      });

      const itemCount = fullCart?.items?.length || 0;
      const totalItems =
        fullCart?.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) ||
        0;

      res.status(200).json({
        success: true,
        data: {
          cart: fullCart,
          inventoryStatus: syncResult,
          hasIssues: !syncResult.valid,
          issues: syncResult.issues || [],
          summary: {
            itemCount,
            totalItems,
            totalValue: fullCart?.total || 0,
            subtotal: fullCart?.subtotal || 0,
            tax: fullCart?.tax || 0,
            discount: fullCart?.discount || 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getRegisterStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const sessions = await prisma.cashRegisterSession.findMany({
        where: {
          cashRegister: { businessUnitId },
          status: 'OPEN',
        },
        include: {
          cashRegister: true,
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { openedAt: 'desc' },
      });

      const sessionsWithSummary = await Promise.all(
        sessions.map(async (session: any) => {
          const sales = await prisma.sale.findMany({
            where: { cashRegisterSessionId: session.id },
            select: { total: true, paidAmount: true, status: true },
          });

          const totalSales = sales.length;
          const totalRevenue = sales.reduce(
            (sum: number, sale: any) => sum + sale.total,
            0
          );
          const totalPaid = sales.reduce(
            (sum: number, sale: any) => sum + sale.paidAmount,
            0
          );

          return {
            id: session.id,
            status: session.status,
            openedAt: session.openedAt,
            startingBalance: session.startingBalance,
            cashRegister: {
              id: session.cashRegister.id,
              name: session.cashRegister.name,
              code: session.cashRegister.code,
              currentBalance: session.cashRegister.cashBalance,
            },
            user: session.user,
            summary: {
              totalSales,
              totalRevenue,
              totalPaid,
              expectedEndingBalance: session.startingBalance + totalPaid,
            },
          };
        })
      );

      const totalCash = sessionsWithSummary.reduce(
        (sum: number, s: any) => sum + (s.cashRegister.currentBalance || 0),
        0
      );
      const totalSales = sessionsWithSummary.reduce(
        (sum: number, s: any) => sum + s.summary.totalSales,
        0
      );
      const totalRevenue = sessionsWithSummary.reduce(
        (sum: number, s: any) => sum + s.summary.totalRevenue,
        0
      );

      res.status(200).json({
        success: true,
        data: {
          sessions: sessionsWithSummary,
          totalOpenSessions: sessionsWithSummary.length,
          totalCash,
          totalSales,
          totalRevenue,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = await getBusinessUnitId(req);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [todaySales, cartCount, activeSessions, lowStockCount, pendingOrders] =
        await Promise.all([
          prisma.sale.findMany({
            where: {
              businessUnitId,
              saleDate: { gte: today, lt: tomorrow },
              status: { notIn: ['CANCELLED', 'DELETED'] },
            },
            include: { items: true },
          }),
          prisma.cart.count({
            where: { businessUnitId, userId },
          }),
          prisma.cashRegisterSession.count({
            where: {
              cashRegister: { businessUnitId },
              status: 'OPEN',
            },
          }),
          prisma.inventory.count({
            where: {
              businessUnitId,
              quantity: { lte: 10 },
            },
          }),
          prisma.order.count({
            where: {
              businessUnitId,
              status: 'PENDING',
            },
          }),
        ]);

      const totalRevenue = todaySales.reduce(
        (sum: number, sale: any) => sum + sale.total,
        0
      );
      const totalSales = todaySales.length;
      const itemsSold = todaySales.reduce(
        (sum: number, sale: any) =>
          sum + sale.items.reduce((s: number, i: any) => s + i.quantity, 0),
        0
      );

      res.status(200).json({
        success: true,
        data: {
          today: {
            revenue: totalRevenue,
            sales: totalSales,
            averageTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
            itemsSold,
          },
          cartCount,
          activeSessions,
          lowStockCount,
          pendingOrders,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where: { businessUnitId },
          include: {
            customer: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
                variant: { select: { id: true, name: true, sku: true } },
              },
            },
            payments: true,
          },
          orderBy: { saleDate: 'desc' },
          skip,
          take: limit,
        }),
        prisma.sale.count({ where: { businessUnitId } }),
      ]);

      res.status(200).json({
        success: true,
        data: sales,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // RECEIPT OPERATIONS
  // ============================================

  async getReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const { saleId } = req.params;

      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      const sale = await checkoutService.getSaleWithReceipt(saleId);

      res.status(200).json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  },

  async getReceiptByNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const { receiptNumber } = req.params;

      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const sale = await checkoutService.getReceiptByNumber(receiptNumber);

      res.status(200).json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default posController;
