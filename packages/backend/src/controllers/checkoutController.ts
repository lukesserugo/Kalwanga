// D:\Projects\Kalwanga\packages\backend\src\controllers\checkoutController.ts
// COMPLETE FIXED CONTROLLER

import { Request, Response, NextFunction } from 'express';
import { CheckoutService } from '../services/checkoutService.js';
import { CartService } from '../services/cartService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { UserRole } from '../generated/prisma/index.js';

const checkoutService = new CheckoutService();
const cartService = new CartService();

// Validation schemas
const checkoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'LOYALTY_POINTS']),
  paidAmount: z.number().positive('Paid amount must be positive'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
});

const voidCheckoutSchema = z.object({
  reason: z.string().optional(),
});

const getCheckoutsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('saleDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const addItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive(),
});

const discountSchema = z.object({
  code: z.string(),
});

export const checkoutController = {
  /**
   * Create a new checkout
   * POST /checkout
   */
  async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const validatedData = checkoutSchema.parse(req.body);

      const cart = await cartService.getCartById(validatedData.cartId);
      if (!cart) {
        throw new AppError('Cart not found', 404);
      }

      if (cart.userId !== userId) {
        throw new AppError('Cart does not belong to this user', 403);
      }

      const result = await checkoutService.processCheckout(
        validatedData,
        userId
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Checkout completed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get all checkouts with pagination
   * GET /checkout
   */
  async getCheckouts(req: Request, res: Response, next: NextFunction) {
    try {
      const params = getCheckoutsSchema.parse(req.query);
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);
      const skip = (page - 1) * limit;

      const filters: any = {};

      if (params.status) filters.status = params.status;
      if (params.paymentStatus) filters.paymentStatus = params.paymentStatus;
      if (params.customerId) filters.customerId = params.customerId;
      if (params.search) {
        filters.OR = [
          { receiptNumber: { contains: params.search, mode: 'insensitive' } },
          { customer: { firstName: { contains: params.search, mode: 'insensitive' } } },
          { customer: { lastName: { contains: params.search, mode: 'insensitive' } } },
          { user: { email: { contains: params.search, mode: 'insensitive' } } },
        ];
      }
      if (params.dateFrom || params.dateTo) {
        filters.saleDate = {};
        if (params.dateFrom) filters.saleDate.gte = new Date(params.dateFrom);
        if (params.dateTo) filters.saleDate.lte = new Date(params.dateTo);
      }

      const orderBy: any = {};
      // ✅ FIX: Use 'saleDate' instead of 'createdAt'
      orderBy[params.sortBy === 'createdAt' ? 'saleDate' : params.sortBy] = params.sortOrder;

      const result = await checkoutService.getAllCheckouts(limit, skip, filters, orderBy);

      res.status(200).json({
        success: true,
        data: result.checkouts,
        pagination: {
          total: result.total,
          page,
          totalPages: Math.ceil(result.total / limit),
          limit,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get checkout by ID
   * GET /checkout/:id
   */
  async getCheckoutById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      const checkout = await checkoutService.getCheckoutById(id);

      res.status(200).json({
        success: true,
        data: checkout,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update checkout
   * PUT /checkout/:id
   */
  async updateCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const data = req.body;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const updated = await checkoutService.updateCheckout(id, data, userId);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Checkout updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Process payment for checkout
   * POST /checkout/:id/pay
   */
  async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const { paymentMethod, amount, paymentDetails } = req.body;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      // ✅ FIX: Use the public method with correct parameters
      const result = await checkoutService.processPaymentForCheckout(id, {
        paymentMethod,
        amount,
        paymentDetails,
        userId,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Payment processed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Complete checkout
   * POST /checkout/:id/complete
   */
  async completeCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.completeCheckout(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout completed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Cancel checkout
   * POST /checkout/:id/cancel
   */
  async cancelCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const { reason } = req.body;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.cancelCheckout(id, userId, reason);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout cancelled successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get checkout summary
   * GET /checkout/:id/summary
   */
  async getCheckoutSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      const summary = await checkoutService.getCheckoutSummary(id);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get checkout receipt
   * GET /checkout/:id/receipt
   */
  async getCheckoutReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      const receipt = await checkoutService.getCheckoutReceipt(id);

      res.status(200).json({
        success: true,
        data: receipt,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send receipt via email
   * POST /checkout/:id/email-receipt
   */
  async sendReceiptEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const { email } = req.body;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.sendReceiptEmail(id, email || null, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Receipt sent successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get checkout statistics
   * GET /checkout/stats/summary
   */
  async getCheckoutStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { dateFrom, dateTo, businessUnitId } = req.query;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const stats = await checkoutService.getCheckoutStats({
        userId,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        businessUnitId: businessUnitId as string,
      });

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get checkout items
   * GET /checkout/:id/items
   */
  async getCheckoutItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      const items = await checkoutService.getCheckoutItems(id);

      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add item to checkout
   * POST /checkout/:id/items
   */
  async addCheckoutItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const data = addItemSchema.parse(req.body);

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.addCheckoutItem(id, data, userId);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Item added successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Remove item from checkout
   * DELETE /checkout/:id/items/:itemId
   */
  async removeCheckoutItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, itemId } = req.params;
      const userId = (req as any).user?.id;

      if (!id || !itemId) {
        throw new AppError('Checkout ID and Item ID are required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.removeCheckoutItem(id, itemId, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Item removed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update checkout item quantity
   * PUT /checkout/:id/items/:itemId
   */
  async updateCheckoutItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, itemId } = req.params;
      const userId = (req as any).user?.id;
      const data = updateItemSchema.parse(req.body);

      if (!id || !itemId) {
        throw new AppError('Checkout ID and Item ID are required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.updateCheckoutItem(id, itemId, data.quantity, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Item updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Apply discount to checkout
   * POST /checkout/:id/discount
   */
  async applyDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const data = discountSchema.parse(req.body);

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.applyDiscount(id, data.code, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Discount applied successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Remove discount from checkout
   * DELETE /checkout/:id/discount
   */
  async removeDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      // ✅ FIX: Use the correct method name
      const result = await checkoutService.removeDiscountFromCheckout(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Discount removed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get customer checkout history
   * GET /checkout/customer/:customerId/history
   */
  async getCustomerCheckoutHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId } = req.params;
      const { page = '1', limit = '20' } = req.query;

      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const result = await checkoutService.getCustomerCheckoutHistory(
        customerId,
        pageNum,
        limitNum
      );

      res.status(200).json({
        success: true,
        data: result.history,
        pagination: {
          total: result.total,
          page: pageNum,
          totalPages: Math.ceil(result.total / limitNum),
          limit: limitNum,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get checkout by receipt number
   * GET /checkout/receipt/:receiptNumber
   */
  async getCheckoutByReceiptNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const { receiptNumber } = req.params;

      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const checkout = await checkoutService.getCheckoutByReceiptNumber(receiptNumber);

      res.status(200).json({
        success: true,
        data: checkout,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export checkouts
   * GET /checkout/export/all
   */
  async exportCheckouts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { format = 'csv', dateFrom, dateTo, businessUnitId } = req.query;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.exportCheckouts({
        userId,
        format: format as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        businessUnitId: businessUnitId as string,
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=checkouts_${Date.now()}.csv`);
        return res.send(result);
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete checkout
   * DELETE /checkout/:id
   */
  async deleteCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!id) {
        throw new AppError('Checkout ID is required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await checkoutService.deleteCheckout(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Void checkout
   * POST /checkout/:saleId/void
   */
  async voidCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { saleId } = req.params;
      const { reason } = voidCheckoutSchema.parse(req.body || {});

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      const result = await checkoutService.voidCheckout(saleId, userId, reason);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Checkout voided successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  // ============================================
  // NEW METHODS FOR CHECKOUT MODULE
  // ============================================

  /**
   * Get checkout history with filters
   * GET /checkout/history
   */
  async getCheckoutHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { 
        page = '1', 
        limit = '20', 
        startDate, 
        endDate, 
        status,
        customerId,
        search 
      } = req.query;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      const filters: any = {};
      if (status) filters.status = status;
      if (customerId) filters.customerId = customerId;
      if (startDate || endDate) {
        filters.saleDate = {};
        if (startDate) filters.saleDate.gte = new Date(startDate as string);
        if (endDate) filters.saleDate.lte = new Date(endDate as string);
      }
      if (search) {
        filters.OR = [
          { receiptNumber: { contains: search, mode: 'insensitive' } },
          { customer: { firstName: { contains: search, mode: 'insensitive' } } },
          { customer: { lastName: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const result = await checkoutService.getAllCheckouts(limitNum, (pageNum - 1) * limitNum, filters);

      res.status(200).json({
        success: true,
        data: result.checkouts,
        pagination: {
          total: result.total,
          page: pageNum,
          totalPages: Math.ceil(result.total / limitNum),
          limit: limitNum,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get payment methods
   * GET /checkout/payment-methods
   */
  async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const paymentMethods = [
        { id: 'CASH', name: 'Cash', code: 'CASH', enabled: true, description: 'Pay with cash' },
        { id: 'CREDIT_CARD', name: 'Credit Card', code: 'CREDIT_CARD', enabled: true, description: 'Pay with credit card' },
        { id: 'DEBIT_CARD', name: 'Debit Card', code: 'DEBIT_CARD', enabled: true, description: 'Pay with debit card' },
        { id: 'MOBILE_MONEY', name: 'Mobile Money', code: 'MOBILE_MONEY', enabled: true, description: 'Pay with mobile money' },
        { id: 'BANK_TRANSFER', name: 'Bank Transfer', code: 'BANK_TRANSFER', enabled: true, description: 'Pay via bank transfer' },
        { id: 'GIFT_CARD', name: 'Gift Card', code: 'GIFT_CARD', enabled: true, description: 'Pay with gift card' },
        { id: 'LOYALTY_POINTS', name: 'Loyalty Points', code: 'LOYALTY_POINTS', enabled: true, description: 'Pay with loyalty points' },
      ];

      res.status(200).json({
        success: true,
        data: paymentMethods,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get checkout settings
   * GET /checkout/settings
   */
  async getCheckoutSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const settings = {
        allowPartialPayment: true,
        requireCustomer: false,
        requireSignature: false,
        maxDiscount: 50,
        taxInclusive: false,
        defaultPaymentMethod: 'CASH',
        receiptFooter: 'Thank you for your business!',
        loyaltyPointsEnabled: true,
        pointsPerDollar: 10,
        allowGuestCheckout: true,
        maxCartItems: 100,
        cartExpiryHours: 24,
        discountEnabled: true,
        maxDiscountPercentage: 20,
        autoApplyPromotions: false,
        reserveStockOnAdd: true,
        reserveStockMinutes: 15,
        lowStockThreshold: 5,
        freeShippingThreshold: 100,
        shippingCost: 0,
        taxRate: 8,
        notifyOnAbandonedCart: true,
        abandonedCartHours: 2,
        currencyCode: 'USD',
        currencySymbol: '$',
        showStockBadge: true,
        showVariantImages: true,
      };

      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update checkout settings
   * PUT /checkout/settings
   */
  async updateCheckoutSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const settings = req.body;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      res.status(200).json({
        success: true,
        data: settings,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export checkout data
   * GET /checkout/export
   */
  async exportCheckoutData(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      const { format = 'csv', startDate, endDate, status } = req.query;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const filters: any = {};
      if (status) filters.status = status;
      if (startDate || endDate) {
        filters.saleDate = {};
        if (startDate) filters.saleDate.gte = new Date(startDate as string);
        if (endDate) filters.saleDate.lte = new Date(endDate as string);
      }

      const result = await checkoutService.getAllCheckouts(1000, 0, filters);

      if (format === 'csv') {
        let csv = 'Receipt Number,Date,Customer,Total,Status,Payment Method\n';
        for (const checkout of result.checkouts) {
          const customerName = checkout.customer ? `${checkout.customer.firstName} ${checkout.customer.lastName}` : 'Guest';
          const paymentMethod = checkout.payments[0]?.paymentMethod || 'N/A';
          csv += `${checkout.receiptNumber},${checkout.saleDate?.toISOString() || ''},${customerName},${checkout.total},${checkout.status},${paymentMethod}\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=checkout_export_${Date.now()}.csv`);
        return res.send(csv);
      }

      res.status(200).json({
        success: true,
        data: result.checkouts,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default checkoutController;
