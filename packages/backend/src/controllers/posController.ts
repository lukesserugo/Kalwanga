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
// VALIDATION SCHEMAS
// ============================================

const posAddItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
});

const posUpdateItemSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
});

const posCheckoutSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD']),
  paidAmount: z.number().positive('Paid amount must be positive'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
});

const posSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.number().int().min(1).max(100).default(10),
});

const posCreateCustomerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  address: z.string().optional(),
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

// ============================================
// POS CONTROLLER
// ============================================

export const posController = {
  // ============================================
  // CART OPERATIONS
  // ============================================

  async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      const validatedData = posAddItemSchema.parse(req.body);
      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.addItemToCart(cart.id, validatedData, userId, businessUnitId);

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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      const validatedData = posBulkAddItemsSchema.parse(req.body);
      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.addMultipleItemsToCart(
        cart.id, validatedData.items, userId, businessUnitId
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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;
      const { itemId } = req.params;
      const validatedData = posUpdateItemSchema.parse(req.body);

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.updateCartItemQuantity(
        cart.id, itemId, validatedData.quantity, businessUnitId
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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;
      const { itemId } = req.params;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;
      const validatedData = posApplyDiscountSchema.parse(req.body);

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;
      const validatedData = posApplyLoyaltySchema.parse(req.body);

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.applyLoyaltyPoints(
        cart.id, validatedData.customerId, validatedData.points
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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;
      const { customerId } = req.body;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await cartService.associateCustomer(cart.id, customerId);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Customer associated with cart',
      });
    } catch (error) {
      next(error);
    }
  },

  async removeDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

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

  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      const validatedData = posCheckoutSchema.parse(req.body);
      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      if (cart.items.length === 0) {
        throw new AppError('Cart is empty', 400);
      }

      const result = await checkoutService.processCheckout(
        {
          cartId: cart.id,
          customerId: validatedData.customerId,
          paymentMethod: validatedData.paymentMethod,
          paidAmount: validatedData.paidAmount,
          discount: validatedData.discount,
          notes: validatedData.notes,
          cashRegisterId: validatedData.cashRegisterId,
          cashRegisterSessionId: validatedData.cashRegisterSessionId,
          applyLoyaltyPoints: validatedData.applyLoyaltyPoints,
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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

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
      const user = (req as any).user;
      const businessUnitId = user?.businessUnitId;
      const { query, limit = '10', category } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit is required', 400);
      }

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
      const user = (req as any).user;
      const businessUnitId = user?.businessUnitId;
      const { barcode } = req.params;

      if (!businessUnitId) {
        throw new AppError('Business unit is required', 400);
      }

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
      const user = (req as any).user;
      const businessUnitId = user?.businessUnitId;
      const { sku } = req.params;

      if (!businessUnitId) {
        throw new AppError('Business unit is required', 400);
      }

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
      const user = (req as any).user;
      const businessUnitId = user?.businessUnitId;
      const { id } = req.params;

      if (!businessUnitId) {
        throw new AppError('Business unit is required', 400);
      }

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
      const businessUnitId = user?.businessUnitId;
      const validatedData = posCreateCustomerSchema.parse(req.body);

      if (!businessUnitId) {
        throw new AppError('Business unit is required', 400);
      }

      const customer = await customerService.createCustomer({
        ...validatedData,
        companyId: businessUnitId,
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
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

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
      const totalItems = fullCart?.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;

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
      const user = (req as any).user;
      const businessUnitId = user?.businessUnitId;

      if (!businessUnitId) {
        throw new AppError('Business unit is required', 400);
      }

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

      if (sessions.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No open cash register sessions found',
        });
      }

      const sessionsWithSummary = await Promise.all(
        sessions.map(async (session: any) => {
          const sales = await prisma.sale.findMany({
            where: { cashRegisterSessionId: session.id },
            select: { total: true, paidAmount: true, status: true },
          });

          const totalSales = sales.length;
          const totalRevenue = sales.reduce((sum: number, sale: any) => sum + sale.total, 0);
          const totalPaid = sales.reduce((sum: number, sale: any) => sum + sale.paidAmount, 0);

          return {
            ...session,
            summary: {
              totalSales,
              totalRevenue,
              totalPaid,
              expectedEndingBalance: session.startingBalance + totalPaid,
            },
          };
        })
      );

      res.status(200).json({
        success: true,
        data: sessionsWithSummary,
      });
    } catch (error) {
      next(error);
    }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = user?.businessUnitId;

      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todaySales = await prisma.sale.findMany({
        where: {
          businessUnitId,
          saleDate: { gte: today, lt: tomorrow },
        },
      });

      const totalRevenue = todaySales.reduce((sum: number, sale: any) => sum + sale.total, 0);
      const totalSales = todaySales.length;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      const cartCount = await prisma.cart.count({
        where: { businessUnitId, userId },
      });

      const activeSession = await prisma.cashRegisterSession.count({
        where: {
          cashRegister: { businessUnitId },
          status: 'OPEN',
        },
      });

      res.status(200).json({
        success: true,
        data: {
          today: { revenue: totalRevenue, sales: totalSales, averageTicket },
          cartCount,
          activeSession,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const businessUnitId = user?.businessUnitId;
      const { page = '1', limit = '20' } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit is required', 400);
      }

      const skip = (Number(page) - 1) * Number(limit);

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
                product: {
                  select: { id: true, name: true, sku: true },
                },
              },
            },
            payments: true,
          },
          orderBy: { saleDate: 'desc' },
          skip,
          take: Number(limit),
        }),
        prisma.sale.count({ where: { businessUnitId } }),
      ]);

      res.status(200).json({
        success: true,
        data: sales,
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          limit: Number(limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // RECEIPT OPERATIONS (NEW)
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
