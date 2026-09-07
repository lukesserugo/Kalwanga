// D:\Projects\Kalwanga\packages\backend\src\controllers\saleController.ts

import { Request, Response, NextFunction } from 'express';
import { SaleService } from '../services/saleService.js';
import { AppError } from '../middleware/errorHandler.js';
import { createSaleSchema } from '../utils/validators.js';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

const saleService = new SaleService();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const cartCheckoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD']),
  paidAmount: z.number().positive('Paid amount must be positive'),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  businessUnitId: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.string().min(1, 'Status is required'),
});

const refundSchema = z.object({
  reason: z.string().optional(),
  amount: z.number().positive().optional(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    reason: z.string().optional(),
  })).optional(),
});

const cancelSchema = z.object({
  reason: z.string().optional(),
});

const voidSchema = z.object({
  reason: z.string().optional(),
});

const returnSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    reason: z.string().optional(),
  })).optional(),
});

const emailReceiptSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const bulkStatusSchema = z.object({
  saleIds: z.array(z.string()).min(1, 'At least one sale ID is required'),
  status: z.string().min(1, 'Status is required'),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;
  
  let businessUnitId = 
    user?.businessUnitId || 
    user?.businessUnits?.[0]?.businessUnitId ||
    req.body?.businessUnitId ||
    req.query?.businessUnitId;
  
  if (!businessUnitId || businessUnitId === 'default') {
    try {
      const businessUnit = await prisma.businessUnit.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      
      if (businessUnit) {
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
      
      const newBusinessUnit = await prisma.businessUnit.create({
        data: {
          name: 'Default Business Unit',
          code: 'DEFAULT',
          isActive: true,
          companyId: company.id,
        },
      });
      
      return newBusinessUnit.id;
    } catch (error) {
      console.error('❌ Failed to get/create default business unit:', error);
      throw new AppError('Failed to resolve business unit ID', 500);
    }
  }
  
  return businessUnitId as string;
}

// ============================================
// SALE CONTROLLER
// ============================================

export const saleController = {
  /**
   * Get all sales with pagination and filters
   * GET /sales
   */
  async getAllSales(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      
      const {
        page,
        limit,
        search,
        customerId,
        userId,
        startDate,
        endDate,
        status,
        paymentMethod,
        sortBy,
        sortOrder,
        minAmount,
        maxAmount,
        includeDeleted,
      } = req.query;

      const result = await saleService.getAllSales({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        businessUnitId: businessUnitId,
        customerId: customerId as string,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as string,
        paymentMethod: paymentMethod as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        minAmount: minAmount ? parseFloat(minAmount as string) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount as string) : undefined,
        includeDeleted: includeDeleted === 'true',
      });

      res.status(200).json({
        success: true,
        data: result.sales,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: limit ? parseInt(limit as string) : 10,
        },
        stats: result.stats,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sale by ID
   * GET /sales/:id
   */
  async getSaleById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const sale = await saleService.getSaleById(id);

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      res.status(200).json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sale by receipt number
   * GET /sales/receipt/:receiptNumber
   */
  async getSaleByReceiptNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const { receiptNumber } = req.params;
      const sale = await saleService.getSaleByReceiptNumber(receiptNumber);

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      res.status(200).json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new sale (legacy direct sale)
   * POST /sales
   */
  async createSale(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSaleSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const sale = await saleService.createSale(data, userId);

      res.status(201).json({
        success: true,
        data: sale,
        message: 'Sale created successfully',
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

  /**
   * Create sale from cart checkout (POS Integration)
   * POST /sales/checkout
   */
  async createSaleFromCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const validatedData = cartCheckoutSchema.parse(req.body);

      const sale = await saleService.createSaleFromCart(
        validatedData.cartId,
        userId,
        {
          paymentMethod: validatedData.paymentMethod,
          paidAmount: validatedData.paidAmount,
          cashRegisterId: validatedData.cashRegisterId,
          cashRegisterSessionId: validatedData.cashRegisterSessionId,
        }
      );

      const fullSale = await saleService.getSaleById(sale.id);

      res.status(201).json({
        success: true,
        data: fullSale,
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

  /**
   * Create sale from POS
   * POST /sales/pos
   */
  async createSaleFromPos(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const validatedData = cartCheckoutSchema.parse(req.body);

      const sale = await saleService.createSaleFromCart(
        validatedData.cartId,
        userId,
        {
          paymentMethod: validatedData.paymentMethod,
          paidAmount: validatedData.paidAmount,
          cashRegisterId: validatedData.cashRegisterId,
          cashRegisterSessionId: validatedData.cashRegisterSessionId,
        }
      );

      const fullSale = await saleService.getSaleById(sale.id);

      res.status(201).json({
        success: true,
        data: fullSale,
        message: 'POS sale completed successfully',
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

  /**
   * Refund a sale
   * POST /sales/:id/refund
   */
  async refundSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason, amount, items } = refundSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const refund = await saleService.refundSale(id, userId, reason, amount, items);

      res.status(200).json({
        success: true,
        data: refund,
        message: 'Sale refunded successfully',
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

  /**
   * Process return
   * POST /sales/:id/return
   */
  async processReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason, items } = returnSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const sale = await saleService.getSaleById(id);
      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      const result = await saleService.processReturn(id, userId, { reason, items });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Return processed successfully',
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

  /**
   * Cancel sale
   * POST /sales/:id/cancel
   */
  async cancelSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = cancelSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.cancelSale(id, userId, reason);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Sale cancelled successfully',
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

  /**
   * Void sale
   * POST /sales/:id/void
   */
  async voidSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = voidSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.voidSale(id, userId, reason);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Sale voided successfully',
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

  /**
   * Hold sale
   * POST /sales/:id/hold
   */
  async holdSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.holdSale(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Sale placed on hold',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Resume held sale
   * POST /sales/:id/resume
   */
  async resumeSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.resumeSale(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Sale resumed successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send receipt email
   * POST /sales/:id/email-receipt
   */
  async sendReceiptEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { email } = emailReceiptSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.sendReceiptEmail(id, email, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: `Receipt sent to ${email}`,
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

  /**
   * Resend receipt email
   * POST /sales/:id/resend-receipt
   */
  async resendReceiptEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.resendReceiptEmail(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Receipt resent successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales statistics
   * GET /sales/stats
   */
  async getSalesStats(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const stats = await saleService.getSalesStats({
        businessUnitId: businessUnitId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
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
   * Get sales by date range
   * GET /sales/date-range
   */
  async getSalesByDateRange(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const validatedData = dateRangeSchema.parse(req.query);
      const { startDate, endDate } = validatedData;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const sales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      res.status(200).json({
        success: true,
        data: sales,
        count: sales.length,
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

  /**
   * Get daily sales summary
   * GET /sales/daily-summary
   */
  async getDailySalesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { date } = req.query;

      if (!date) {
        throw new AppError('Date is required', 400);
      }

      const summary = await saleService.getDailySalesSummary({
        businessUnitId: businessUnitId,
        date: new Date(date as string),
      });

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get today's sales summary
   * GET /sales/today
   */
  async getTodaySalesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const summary = await saleService.getDailySalesSummary({
        businessUnitId: businessUnitId,
        date: new Date(),
      });

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export sales
   * GET /sales/export
   */
  async exportSales(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate, format = 'json' } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const sales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      });

      const exportData = sales.map((sale: any) => ({
        receiptNumber: sale.receiptNumber,
        date: sale.saleDate.toISOString(),
        customer: sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Guest',
        subtotal: sale.subtotal,
        tax: sale.tax,
        discount: sale.discount,
        total: sale.total,
        paymentMethod: sale.payments[0]?.paymentMethod || 'N/A',
        status: sale.status,
        items: sale.items?.length || 0,
      }));

      res.status(200).json({
        success: true,
        data: exportData,
        format,
        total: exportData.length,
        message: `Sales exported as ${format}`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export sales to CSV
   * GET /sales/export/csv
   */
  async exportSalesCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const sales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      const headers = ['Receipt', 'Date', 'Customer', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment', 'Status', 'Items'];
      const rows = sales.map((sale: any) => [
        sale.receiptNumber,
        sale.saleDate.toISOString().split('T')[0],
        sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Guest',
        sale.subtotal.toFixed(2),
        sale.tax.toFixed(2),
        sale.discount.toFixed(2),
        sale.total.toFixed(2),
        sale.payments[0]?.paymentMethod || 'N/A',
        sale.status,
        sale.items?.length || 0,
      ]);

      const csvContent = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sales-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export sales to Excel
   * GET /sales/export/excel
   */
  async exportSalesExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const sales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      res.status(200).json({
        success: true,
        data: sales,
        message: 'Excel export would be generated here',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export sales to PDF
   * GET /sales/export/pdf
   */
  async exportSalesPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const sales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      res.status(200).json({
        success: true,
        data: sales,
        message: 'PDF export would be generated here',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales by customer
   * GET /sales/customer/:customerId
   */
  async getSalesByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const result = await saleService.getAllSales({
        customerId,
        businessUnitId: businessUnitId,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
      });

      res.status(200).json({
        success: true,
        data: result.sales,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get customer sales stats
   * GET /sales/customer-stats/:customerId
   */
  async getCustomerSalesStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId } = req.params;

      const data = await saleService.getCustomerSalesStats(customerId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get recent sales
   * GET /sales/recent
   */
  async getRecentSales(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { limit = 10 } = req.query;

      const result = await saleService.getAllSales({
        businessUnitId: businessUnitId,
        page: 1,
        limit: parseInt(limit as string) || 10,
        sortBy: 'saleDate',
        sortOrder: 'desc',
      });

      res.status(200).json({
        success: true,
        data: result.sales,
        count: result.sales.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales by status
   * GET /sales/status/:status
   */
  async getSalesByStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      const result = await saleService.getAllSales({
        businessUnitId: businessUnitId,
        status: status,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
      });

      res.status(200).json({
        success: true,
        data: result.sales,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: limit ? parseInt(limit as string) : 10,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales by payment method
   * GET /sales/payment-methods
   */
  async getSalesByPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const data = await saleService.getSalesByPaymentMethod({
        businessUnitId: businessUnitId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales by product
   * GET /sales/product/:productId
   */
  async getSalesByProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate, limit, variantId } = req.query;

      const data = await saleService.getSalesByProduct(productId, {
        businessUnitId: businessUnitId,
        variantId: variantId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : 10,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get dashboard sales data
   * GET /sales/dashboard
   */
  async getDashboardSalesData(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const today = new Date();
      const todaySummary = await saleService.getDailySalesSummary({
        businessUnitId: businessUnitId,
        date: today,
      });

      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
      weekEnd.setHours(23, 59, 59, 999);

      const weekSales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate: weekStart,
        endDate: weekEnd,
      });

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      const monthSales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate: monthStart,
        endDate: monthEnd,
      });

      const stats = await saleService.getSalesStats({
        businessUnitId: businessUnitId,
      });

      const weekRevenue = weekSales.reduce((sum: number, sale: any) => sum + sale.total, 0);
      const monthRevenue = monthSales.reduce((sum: number, sale: any) => sum + sale.total, 0);

      res.status(200).json({
        success: true,
        data: {
          today: {
            totalSales: todaySummary.totalSales,
            totalRevenue: todaySummary.totalRevenue,
            averageTicket: todaySummary.averageTicket,
          },
          week: {
            totalSales: weekSales.length,
            totalRevenue: weekRevenue,
          },
          month: {
            totalSales: monthSales.length,
            totalRevenue: monthRevenue,
          },
          allTime: stats,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales analytics
   * GET /sales/analytics
   */
  async getSalesAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate, view } = req.query;

      const analytics = await saleService.getSalesAnalytics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        view: view as any,
        businessUnitId: businessUnitId,
      });

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get aggregated sales data
   * GET /sales/aggregate
   */
  async getAggregatedSales(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate, groupBy = 'day' } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const data = await saleService.getAggregatedSales({
        businessUnitId: businessUnitId,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
        groupBy: groupBy as any,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales comparison
   * GET /sales/compare
   */
  async getSalesComparison(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { period1Start, period1End, period2Start, period2End } = req.query;

      if (!period1Start || !period1End || !period2Start || !period2End) {
        throw new AppError('All period dates are required', 400);
      }

      const comparison = await saleService.getSalesComparison({
        businessUnitId: businessUnitId,
        period1Start: new Date(period1Start as string),
        period1End: new Date(period1End as string),
        period2Start: new Date(period2Start as string),
        period2End: new Date(period2End as string),
      });

      res.status(200).json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales forecast
   * GET /sales/forecast
   */
  async getSalesForecast(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { days = 7 } = req.query;

      const forecast = await saleService.getSalesForecast({
        businessUnitId: businessUnitId,
        days: parseInt(days as string) || 7,
      });

      res.status(200).json({
        success: true,
        data: forecast,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales summary by period
   * GET /sales/summary
   */
  async getSalesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { period = 'monthly', date } = req.query;

      const summary = await saleService.getSalesSummary({
        businessUnitId: businessUnitId,
        period: period as any,
        date: date ? new Date(date as string) : undefined,
      });

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales report by period
   * GET /sales/reports/period
   */
  async getSalesReportByPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { period = 'monthly' } = req.query;

      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case 'daily':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'weekly':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarterly':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'yearly':
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
      }

      const sales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate,
        endDate: now,
      });

      const totalRevenue = sales.reduce((sum: number, sale: any) => sum + sale.total, 0);
      const totalSales = sales.length;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      const previousPeriodStart = new Date(startDate);
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      const previousPeriodEnd = new Date(startDate);
      previousPeriodEnd.setHours(0, 0, 0, 0);

      const previousSales = await saleService.getSalesByDateRange({
        businessUnitId: businessUnitId,
        startDate: previousPeriodStart,
        endDate: previousPeriodEnd,
      });

      const previousRevenue = previousSales.reduce((sum: number, sale: any) => sum + sale.total, 0);
      const growthRate = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      res.status(200).json({
        success: true,
        data: {
          period,
          totalRevenue,
          totalSales,
          averageTicket,
          growthRate,
          sales,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales settings
   * GET /sales/settings
   */
  async getSalesSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.query;
      const settings = await saleService.getSalesSettings(companyId as string);
      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update sales settings
   * PUT /sales/settings
   */
  async updateSalesSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.query;
      const settings = await saleService.updateSalesSettings(req.body, companyId as string);
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
   * Get receipts
   * GET /sales/receipts
   */
  async getReceipts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 10;
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        businessUnitId: businessUnitId,
        receiptNumber: { not: null },
        status: { not: 'DELETED' },
      };

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { saleDate: 'desc' },
          include: {
            customer: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    images: true,
                  },
                },
                variant: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                  },
                },
              },
            },
            payments: true,
          },
        }),
        prisma.sale.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: sales,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get invoices
   * GET /sales/invoices
   */
  async getInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      const pageNum = page ? parseInt(page as string) : 1;
      const limitNum = limit ? parseInt(limit as string) : 10;
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        businessUnitId: businessUnitId,
        invoiceId: { not: null },
        status: { not: 'DELETED' },
      };

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { saleDate: 'desc' },
          include: {
            customer: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    images: true,
                  },
                },
                variant: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                  },
                },
              },
            },
            payments: true,
            invoice: true,
          },
        }),
        prisma.sale.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: sales,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get returns
   * GET /sales/returns
   */
  async getReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      const result = await saleService.getAllSales({
        businessUnitId: businessUnitId,
        status: 'RETURNED',
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        includeDeleted: false,
      });

      res.status(200).json({
        success: true,
        data: result.sales,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: limit ? parseInt(limit as string) : 10,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get refunds
   * GET /sales/refunds
   */
  async getRefunds(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      const result = await saleService.getAllSales({
        businessUnitId: businessUnitId,
        status: 'REFUNDED',
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        includeDeleted: false,
      });

      res.status(200).json({
        success: true,
        data: result.sales,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: limit ? parseInt(limit as string) : 10,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Bulk update sales status
   * PATCH /sales/bulk-status
   */
  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { saleIds, status } = bulkStatusSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.bulkUpdateStatus(saleIds, status, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: `${result.updated} sales updated successfully`,
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

  /**
   * Update sale
   * PUT /sales/:id
   */
  async updateSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.updateSale(id, updates, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Sale updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update sale status
   * PATCH /sales/:id/status
   */
  async updateSaleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = updateStatusSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.updateSaleStatus(id, status, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Sale status updated successfully',
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

  /**
   * Update sale notes
   * PATCH /sales/:id/notes
   */
  async updateSaleNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      if (notes === undefined) {
        throw new AppError('Notes are required', 400);
      }

      const result = await saleService.updateSaleNotes(id, notes, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Sale notes updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete sale (soft delete)
   * DELETE /sales/:id
   */
  async deleteSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.deleteSale(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Sale deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Bulk delete sales
   * DELETE /sales/bulk
   */
  async bulkDeleteSales(req: Request, res: Response, next: NextFunction) {
    try {
      const { saleIds } = req.body;
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!saleIds || !Array.isArray(saleIds) || saleIds.length === 0) {
        throw new AppError('Sale IDs are required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await saleService.bulkDeleteSales(saleIds, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: `${result.deleted} sales deleted successfully`,
      });
    } catch (error) {
      next(error);
    }
  },
  
  async getAbandonedCarts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { hours = 24, minValue } = req.query;
      
      // Calculate the date threshold based on hours
      const thresholdDate = new Date();
      thresholdDate.setHours(thresholdDate.getHours() - (parseInt(hours as string) || 24));
      
      // Call the service with the parameters it expects
      const result = await saleService.getAbandonedCarts({
        businessUnitId,
        startDate: thresholdDate,  // Carts older than this date are considered abandoned
        endDate: new Date(),        // Up to now
        minValue: minValue ? parseFloat(minValue as string) : undefined,
      });
      
      // The service returns an array directly
      const carts = Array.isArray(result) ? result : [];
      
      // Manual pagination since the service doesn't support it
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedCarts = carts.slice(startIndex, endIndex);
      
      res.status(200).json({
        success: true,
        data: paginatedCarts,
        pagination: {
          total: carts.length,
          page: page,
          totalPages: Math.ceil(carts.length / limit),
          limit: limit,
        },
      });
    } catch (error) {
      next(error);
    }
  }
};

export default saleController;
