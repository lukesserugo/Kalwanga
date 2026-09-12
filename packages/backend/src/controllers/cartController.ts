// D:\Projects\Kalwanga\packages\backend\src\controllers\cartController.ts

import type { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cartService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { realtimeService } from '../services/realtimeService.js';
import { z } from 'zod';

const cartService = new CartService();

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
      { message: 'Invalid product ID format' }
    ),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
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
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().default('FIXED'),
});

const applyLoyaltyPointsSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  points: z.number().int().positive('Points must be positive'),
});

const associateCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
});

const checkoutSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.enum([
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'MOBILE_MONEY',
    'BANK_TRANSFER',
    'GIFT_CARD',
  ]),
  paidAmount: z.number().positive('Paid amount must be positive'),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  notes: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
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
        quantity: z.number().int().positive('Quantity must be positive'),
        targetUserId: z.string().min(1, 'Target user ID is required'),
      })
    )
    .min(1, 'At least one item split is required'),
});

// ============================================
// HELPERS
// ============================================

/**
 * Resolve the effective business unit ID for a request.
 *
 * ✅ FIXED: Explicit header / body / query value is now checked FIRST,
 *    then the user's own unit, then the most recent active unit.
 *    Previously the user's unit won over explicit params, and the
 *    `x-business-unit-id` header was ignored entirely.
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
      `⚠️ Explicit businessUnitId "${explicit}" not found or inactive, falling back`
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
        `✅ getBusinessUnitId: falling back to "${businessUnit.name}" (${businessUnit.id})`
      );
      return businessUnit.id;
    }

    // 4. Bootstrap a default company + unit
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

async function safeEmitEvent(eventName: string, data: any): Promise<void> {
  try {
    if (realtimeService && typeof (realtimeService as any).emit === 'function') {
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

// ============================================
// EXPORT HELPERS
// ============================================

function generateCSV(
  analytics: any,
  detailedData: any[],
  includeSummary: boolean
): string {
  const rows: string[] = [];

  if (includeSummary) {
    rows.push('Cart Analytics Summary');
    rows.push(`Total Carts,${analytics.totalCarts}`);
    rows.push(`Active Carts,${analytics.activeCarts}`);
    rows.push(`Abandoned Carts,${analytics.abandonedCarts}`);
    rows.push(`Average Items,${analytics.averageItems}`);
    rows.push(`Average Value,${analytics.averageValue}`);
    rows.push(`Conversion Rate,${analytics.conversionRate}%`);
    rows.push(`Today's Carts,${analytics.todayCarts}`);
    rows.push(`Today's Revenue,${analytics.todayRevenue}`);
    rows.push('');
    rows.push('Status Breakdown');
    rows.push('Status,Count,Percentage');
    analytics.statusBreakdown?.forEach((s: any) => {
      rows.push(`${s.status},${s.count},${s.percentage}%`);
    });
    rows.push('');
  }

  if (detailedData.length > 0) {
    rows.push('Detailed Cart Data');
    rows.push(
      'Cart ID,Status,User,Customer,Items,Subtotal,Total,Created At'
    );
    detailedData.forEach((cart: any) => {
      const user = cart.user || {};
      const customer = cart.customer || {};
      rows.push(
        `${cart.id},${cart.status},${user.firstName || ''} ${
          user.lastName || ''
        },${customer.firstName || ''} ${customer.lastName || ''},${
          cart.items?.length || 0
        },${cart.subtotal || 0},${cart.total || 0},${new Date(
          cart.createdAt
        ).toLocaleString()}`
      );
    });
  }

  return rows.join('\n');
}

async function generateExcel(
  analytics: any,
  detailedData: any[],
  includeSummary: boolean
): Promise<Buffer> {
  try {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    if (includeSummary) {
      const summaryData = [
        { metric: 'Total Carts', value: analytics.totalCarts },
        { metric: 'Active Carts', value: analytics.activeCarts },
        { metric: 'Abandoned Carts', value: analytics.abandonedCarts },
        { metric: 'Average Items', value: analytics.averageItems },
        { metric: 'Average Value', value: analytics.averageValue },
        {
          metric: 'Conversion Rate',
          value: `${analytics.conversionRate}%`,
        },
        { metric: "Today's Carts", value: analytics.todayCarts },
        { metric: "Today's Revenue", value: analytics.todayRevenue },
      ];
      summaryData.forEach((row) => summarySheet.addRow(row));
    }

    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };

    if (
      analytics.statusBreakdown &&
      analytics.statusBreakdown.length > 0
    ) {
      const statusSheet = workbook.addWorksheet('Status Breakdown');
      statusSheet.columns = [
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Count', key: 'count', width: 15 },
        { header: 'Percentage', key: 'percentage', width: 15 },
      ];
      analytics.statusBreakdown.forEach((s: any) => {
        statusSheet.addRow({
          status: s.status,
          count: s.count,
          percentage: `${s.percentage}%`,
        });
      });
      statusSheet.getRow(1).font = { bold: true };
      statusSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      statusSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };
    }

    if (
      analytics.categoryBreakdown &&
      analytics.categoryBreakdown.length > 0
    ) {
      const categorySheet = workbook.addWorksheet('Category Breakdown');
      categorySheet.columns = [
        { header: 'Category', key: 'category', width: 30 },
        { header: 'Count', key: 'count', width: 15 },
        { header: 'Percentage', key: 'percentage', width: 15 },
      ];
      analytics.categoryBreakdown.forEach((c: any) => {
        categorySheet.addRow({
          category: c.category,
          count: c.count,
          percentage: `${c.percentage}%`,
        });
      });
      categorySheet.getRow(1).font = { bold: true };
      categorySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      categorySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };
    }

    if (detailedData.length > 0) {
      const detailsSheet = workbook.addWorksheet('Detailed Data');
      detailsSheet.columns = [
        { header: 'Cart ID', key: 'id', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'User', key: 'user', width: 25 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Items', key: 'items', width: 10 },
        { header: 'Subtotal', key: 'subtotal', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 25 },
      ];

      detailedData.forEach((cart: any) => {
        const user = cart.user || {};
        const customer = cart.customer || {};
        detailsSheet.addRow({
          id: cart.id,
          status: cart.status,
          user:
            `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
          customer:
            `${customer.firstName || ''} ${customer.lastName || ''}`.trim() ||
            'N/A',
          items: cart.items?.length || 0,
          subtotal: cart.subtotal || 0,
          total: cart.total || 0,
          createdAt: new Date(cart.createdAt).toLocaleString(),
        });
      });

      detailsSheet.getRow(1).font = { bold: true };
      detailsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      detailsSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('Failed to generate Excel:', error);
    throw new AppError('Failed to generate Excel export', 500);
  }
}

async function generatePDF(
  analytics: any,
  detailedData: any[],
  includeSummary: boolean,
  includeCharts: boolean
): Promise<Buffer> {
  try {
    const PDFDocument = await import('pdfkit');
    const doc = new PDFDocument.default({ margin: 50 });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(24).text('Cart Analytics Report', { align: 'center' });
    doc.moveDown();
    doc
      .fontSize(12)
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    if (includeSummary) {
      doc.fontSize(18).text('Summary', { underline: true });
      doc.moveDown();

      const summaryData = [
        ['Total Carts', analytics.totalCarts.toString()],
        ['Active Carts', analytics.activeCarts.toString()],
        ['Abandoned Carts', analytics.abandonedCarts.toString()],
        ['Average Items', analytics.averageItems.toFixed(1)],
        ['Average Value', `$${analytics.averageValue.toFixed(2)}`],
        ['Conversion Rate', `${analytics.conversionRate}%`],
        ["Today's Carts", analytics.todayCarts.toString()],
        ["Today's Revenue", `$${analytics.todayRevenue.toFixed(2)}`],
      ];

      summaryData.forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`, { indent: 20 });
      });
      doc.moveDown(2);
    }

    if (analytics.statusBreakdown && analytics.statusBreakdown.length > 0) {
      doc.fontSize(18).text('Status Breakdown', { underline: true });
      doc.moveDown();

      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 200;
      const col3 = 350;

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Status', col1, tableTop);
      doc.text('Count', col2, tableTop);
      doc.text('Percentage', col3, tableTop);

      doc.font('Helvetica');
      let rowY = tableTop + 20;
      analytics.statusBreakdown.forEach((row: any) => {
        doc.text(row.status, col1, rowY);
        doc.text(row.count.toString(), col2, rowY);
        doc.text(`${row.percentage}%`, col3, rowY);
        rowY += 20;
      });
      doc.moveDown(2);
    }

    if (
      analytics.categoryBreakdown &&
      analytics.categoryBreakdown.length > 0
    ) {
      doc.fontSize(18).text('Category Breakdown', { underline: true });
      doc.moveDown();

      const tableTop = doc.y;
      const col1 = 50;
      const col2 = 250;
      const col3 = 400;

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('Category', col1, tableTop);
      doc.text('Count', col2, tableTop);
      doc.text('Percentage', col3, tableTop);

      doc.font('Helvetica');
      let rowY = tableTop + 20;
      analytics.categoryBreakdown.forEach((row: any) => {
        doc.text(row.category, col1, rowY);
        doc.text(row.count.toString(), col2, rowY);
        doc.text(`${row.percentage}%`, col3, rowY);
        rowY += 20;
      });
      doc.moveDown(2);
    }

    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(10).text(
        `Page ${i + 1} of ${pageCount}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
    }

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);
    });
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw new AppError('Failed to generate PDF export', 500);
  }
}

function getSummary(analytics: any) {
  return {
    totalCarts: analytics.totalCarts,
    activeCarts: analytics.activeCarts,
    abandonedCarts: analytics.abandonedCarts,
    averageItems: analytics.averageItems,
    averageValue: analytics.averageValue,
    conversionRate: analytics.conversionRate,
  };
}

// ============================================
// CART CONTROLLER
// ============================================

export const cartController = {
  /**
   * GET /cart
   */
  async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) {
        throw new AppError('User ID is required', 400);
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

  /**
   * GET /cart/:id
   */
  async getCartById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = await getBusinessUnitId(req);

      const cart = await cartService.getCartById(id, businessUnitId);

      if (!cart) {
        throw new AppError('Cart not found', 404);
      }

      res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /cart/count
   */
  async getCartCount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const count = await cartService.getCartCount(userId, businessUnitId);

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /cart/summary
   */
  async getCartSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const summary = await cartService.getCartSummary(cart.id);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /cart/items
   */
  async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      console.log('📥 [addItem] Request body:', JSON.stringify(req.body, null, 2));
      console.log('📥 [addItem] User ID:', userId);
      console.log('📥 [addItem] Business Unit ID:', businessUnitId);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      let validatedData;
      try {
        validatedData = addItemSchema.parse(req.body);
        console.log(
          '✅ [addItem] Validation passed:',
          JSON.stringify(validatedData, null, 2)
        );
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error(
            '❌ [addItem] Validation error:',
            validationError.errors
          );
          return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: validationError.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          });
        }
        throw validationError;
      }

      const productId = String(validatedData.productId).trim();
      if (!productId || productId.length === 0) {
        console.error('❌ [addItem] Empty productId after validation');
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
          errors: [{ field: 'productId', message: 'Product ID is required' }],
        });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, isActive: true, unitPrice: true },
      });

      if (!product) {
        console.error(`❌ [addItem] Product not found: ${productId}`);
        return res.status(404).json({
          success: false,
          message: `Product with ID "${productId}" not found`,
        });
      }

      if (!product.isActive) {
        console.error(`❌ [addItem] Product is inactive: ${productId}`);
        return res.status(400).json({
          success: false,
          message: 'Product is not active',
        });
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      console.log(`✅ [addItem] Cart retrieved/created: ${cart.id}`);

      const updatedCart = await cartService.addItemToCart(
        cart.id,
        {
          productId,
          variantId: validatedData.variantId,
          quantity: validatedData.quantity,
          notes: validatedData.notes,
        },
        userId,
        businessUnitId
      );

      console.log(`✅ [addItem] Item added to cart successfully`);

      await safeEmitEvent('cart:item-added', {
        cartId: cart.id,
        userId,
        productId,
        variantId: validatedData.variantId,
        quantity: validatedData.quantity,
      });

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Item added to cart',
      });
    } catch (error) {
      console.error('❌ [addItem] Error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /cart/items/bulk
   */
  async addMultipleItems(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const { items } = addMultipleItemsSchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      const updatedCart = await cartService.addMultipleItemsToCart(
        cart.id,
        items,
        userId,
        businessUnitId
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: `${items.length} items added to cart`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * PUT /cart/items/:itemId
   */
  async updateItemQuantity(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { itemId } = req.params;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const validatedData = updateQuantitySchema.parse(req.body);

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
        message:
          validatedData.quantity === 0
            ? 'Item removed from cart'
            : 'Cart updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * DELETE /cart/items/:itemId
   */
  async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { itemId } = req.params;

      if (!userId) {
        throw new AppError('User ID is required', 400);
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

  /**
   * DELETE /cart
   */
  async clearCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

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

  /**
   * POST /cart/discount
   */
  async applyDiscount(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { discount, discountType } = applyDiscountSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      const updatedCart = await cartService.applyDiscount(
        cart.id,
        discount,
        discountType
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
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /cart/promotion
   */
  async applyPromotion(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { promotionCode } = applyPromotionSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      const updatedCart = await cartService.applyPromotion(
        cart.id,
        promotionCode
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Promotion applied successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /cart/loyalty
   */
  async applyLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { customerId, points } = applyLoyaltyPointsSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      const updatedCart = await cartService.applyLoyaltyPoints(
        cart.id,
        customerId,
        points
      );

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: `${points} loyalty points applied`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /cart/customer
   */
  async associateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { customerId } = associateCustomerSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      const updatedCart = await cartService.associateCustomer(
        cart.id,
        customerId
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
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * PATCH /cart/notes
   */
  async updateCartNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { notes } = updateCartNotesSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      const updatedCart = await cartService.updateCartNotes(cart.id, notes);

      res.status(200).json({
        success: true,
        data: updatedCart,
        message: 'Cart notes updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * GET /cart/settings
   */
  async getCartSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      let settings = await prisma.cartSettings.findFirst({
        where: { businessUnitId },
      });

      if (!settings) {
        settings = await prisma.cartSettings.create({
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
            currencyCode: 'USD',
            currencySymbol: '$',
            showStockBadge: true,
            showVariantImages: true,
            isActive: true,
          },
        });
      }

      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /cart/settings
   */
  async updateCartSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const data = req.body;

      const settings = await prisma.cartSettings.update({
        where: { businessUnitId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      res.status(200).json({
        success: true,
        data: settings,
        message: 'Cart settings updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /cart/sync
   */
  async syncCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
      const syncResult = await cartService.syncCartWithInventory(
        cart.id,
        businessUnitId
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

  /**
   * POST /cart/checkout
   */
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const validatedData = checkoutSchema.parse(req.body);

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);

      const cartWithItems = await cartService.getCartById(
        cart.id,
        businessUnitId
      );
      if (
        !cartWithItems ||
        !cartWithItems.items ||
        cartWithItems.items.length === 0
      ) {
        throw new AppError('Cart is empty', 400);
      }

      const result = await cartService.checkoutCart(cart.id, userId, {
        customerId: validatedData.customerId,
        paymentMethod: validatedData.paymentMethod,
        paidAmount: validatedData.paidAmount,
        cashRegisterId: validatedData.cashRegisterId,
        cashRegisterSessionId: validatedData.cashRegisterSessionId,
        notes: validatedData.notes,
        tipAmount: validatedData.tipAmount,
      });

      await safeEmitEvent('cart:checked-out', {
        cartId: cart.id,
        userId,
        saleId: result.sale?.id,
        businessUnitId,
      });

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
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /cart/transfer
   */
  async transferCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { fromUserId, toUserId } = transferCartSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await cartService.transferCart(
        fromUserId,
        toUserId,
        businessUnitId
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Cart transferred successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /cart/split
   */
  async splitCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { items } = splitCartSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const result = await cartService.splitCart(userId, items, businessUnitId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Cart split successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /cart/save-for-later
   */
  async saveCartForLater(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const cart = await cartService.getOrCreateCart(userId, businessUnitId);
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
  async restoreSavedCart(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { savedCartId } = req.body;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      if (!savedCartId) {
        throw new AppError('Saved cart ID is required', 400);
      }

      const result = await cartService.restoreSavedCart(
        savedCartId,
        userId,
        businessUnitId
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

  /**
   * GET /cart/history
   */
  async getCartHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

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
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
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
   * POST /cart/history/export
   */
  async exportCartHistory(req: Request, res: Response, next: NextFunction) {
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

      let start: Date, end: Date;

      if (dateRange === 'custom' && startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date();
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
      }

      const carts = await prisma.cart.findMany({
        where: {
          businessUnitId,
          createdAt: { gte: start, lte: end },
          ...(status && status !== 'all' ? { status } : {}),
        },
        include: {
          items: includeItems
            ? {
                include: { product: true, variant: true },
              }
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

      let exportData: any;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'csv': {
          const rows: string[] = [];
          rows.push('Cart History Export');
          rows.push(`Generated: ${new Date().toLocaleString()}`);
          rows.push('');
          rows.push(
            'Cart ID,Status,User,Email,Items,Subtotal,Total,Created At'
          );

          carts.forEach((cart: any) => {
            const user = cart.user || {};
            const itemsCount = cart.items?.length || 0;
            rows.push(
              `${cart.id},${cart.status},${user.firstName || ''} ${
                user.lastName || ''
              },${user.email || ''},${itemsCount},${cart.subtotal || 0},${
                cart.total || 0
              },${new Date(cart.createdAt).toLocaleString()}`
            );
          });

          exportData = rows.join('\n');
          contentType = 'text/csv';
          filename = `cart-history-${
            new Date().toISOString().split('T')[0]
          }.csv`;
          break;
        }

        case 'json': {
          exportData = JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              dateRange: { start, end },
              total: carts.length,
              carts: carts.map((cart: any) => ({
                id: cart.id,
                status: cart.status,
                user: cart.user
                  ? `${cart.user.firstName} ${cart.user.lastName}`
                  : 'N/A',
                email: cart.user?.email || 'N/A',
                items: cart.items?.length || 0,
                subtotal: cart.subtotal,
                total: cart.total,
                createdAt: cart.createdAt,
              })),
            },
            null,
            2
          );
          contentType = 'application/json';
          filename = `cart-history-${
            new Date().toISOString().split('T')[0]
          }.json`;
          break;
        }

        case 'excel':
        case 'pdf':
        default: {
          const rows: string[] = [];
          rows.push('Cart History Export');
          rows.push(`Generated: ${new Date().toLocaleString()}`);
          rows.push('');
          rows.push(
            'Cart ID,Status,User,Email,Items,Subtotal,Total,Created At'
          );

          carts.forEach((cart: any) => {
            const user = cart.user || {};
            const itemsCount = cart.items?.length || 0;
            rows.push(
              `${cart.id},${cart.status},${user.firstName || ''} ${
                user.lastName || ''
              },${user.email || ''},${itemsCount},${cart.subtotal || 0},${
                cart.total || 0
              },${new Date(cart.createdAt).toLocaleString()}`
            );
          });

          exportData = rows.join('\n');
          contentType = 'text/csv';
          filename = `cart-history-${
            new Date().toISOString().split('T')[0]
          }.csv`;
        }
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.send(exportData);
    } catch (error) {
      console.error('Export cart history error:', error);
      next(error);
    }
  },

  /**
   * POST /cart/abandoned/export
   */
  async exportAbandonedCarts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const {
        format = 'csv',
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

      let exportData: any;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'csv': {
          const rows: string[] = [];
          rows.push('Abandoned Carts Export');
          rows.push(`Generated: ${new Date().toLocaleString()}`);
          rows.push(`Abandoned for: ${hours} hours`);
          rows.push('');
          rows.push(
            'Cart ID,User,Email,Items,Total,Abandoned At,Hours Abandoned'
          );

          carts.forEach((cart: any) => {
            const user = cart.user || {};
            const hoursAbandoned = Math.floor(
              (Date.now() - new Date(cart.updatedAt).getTime()) /
                (1000 * 60 * 60)
            );
            const itemsCount = cart.items?.length || 0;
            rows.push(
              `${cart.id},${user.firstName || ''} ${
                user.lastName || ''
              },${user.email || ''},${itemsCount},${cart.total || 0},${new Date(
                cart.updatedAt
              ).toLocaleString()},${hoursAbandoned}`
            );
          });

          exportData = rows.join('\n');
          contentType = 'text/csv';
          filename = `abandoned-carts-${
            new Date().toISOString().split('T')[0]
          }.csv`;
          break;
        }

        case 'json': {
          exportData = JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              hoursAbandoned: hours,
              minValue: minValue || null,
              total: carts.length,
              carts: carts.map((cart: any) => ({
                id: cart.id,
                user: cart.user
                  ? `${cart.user.firstName} ${cart.user.lastName}`
                  : 'N/A',
                email: cart.user?.email || 'N/A',
                items: cart.items?.map((item: any) => ({
                  product: item.product.name,
                  sku: item.product.sku,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })),
                total: cart.total,
                abandonedAt: cart.updatedAt,
                hoursAbandoned: Math.floor(
                  (Date.now() - new Date(cart.updatedAt).getTime()) /
                    (1000 * 60 * 60)
                ),
              })),
            },
            null,
            2
          );
          contentType = 'application/json';
          filename = `abandoned-carts-${
            new Date().toISOString().split('T')[0]
          }.json`;
          break;
        }

        case 'excel':
        case 'pdf':
        default: {
          const rows: string[] = [];
          rows.push('Abandoned Carts Export');
          rows.push(`Generated: ${new Date().toLocaleString()}`);
          rows.push(`Abandoned for: ${hours} hours`);
          rows.push('');
          rows.push(
            'Cart ID,User,Email,Items,Total,Abandoned At,Hours Abandoned'
          );

          carts.forEach((cart: any) => {
            const user = cart.user || {};
            const hoursAbandoned = Math.floor(
              (Date.now() - new Date(cart.updatedAt).getTime()) /
                (1000 * 60 * 60)
            );
            const itemsCount = cart.items?.length || 0;
            rows.push(
              `${cart.id},${user.firstName || ''} ${
                user.lastName || ''
              },${user.email || ''},${itemsCount},${cart.total || 0},${new Date(
                cart.updatedAt
              ).toLocaleString()},${hoursAbandoned}`
            );
          });

          exportData = rows.join('\n');
          contentType = 'text/csv';
          filename = `abandoned-carts-${
            new Date().toISOString().split('T')[0]
          }.csv`;
        }
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.send(exportData);
    } catch (error) {
      console.error('Export abandoned carts error:', error);
      next(error);
    }
  },

  /**
   * POST /cart/analytics/export
   */
  async exportAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const {
        format = 'csv',
        metrics = [],
        dateRange = 'week',
        startDate,
        endDate,
        includeSummary = true,
        includeDetailedData = true,
        includeCharts = false,
      } = req.body;

      let start: Date, end: Date;

      if (dateRange === 'custom' && startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date();
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
      }

      const analytics = await cartService.getCartAnalytics({
        businessUnitId,
        startDate: start,
        endDate: end,
      });

      let detailedData: any[] = [];
      if (includeDetailedData) {
        const carts = await prisma.cart.findMany({
          where: {
            businessUnitId,
            createdAt: {
              gte: start,
              lte: end,
            },
          },
          include: {
            items: {
              include: {
                product: true,
                variant: true,
              },
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
        detailedData = carts;
      }

      let exportData: any;
      let contentType: string;
      let filename: string;

      switch (format) {
        case 'csv': {
          const rows: string[] = [];

          if (includeSummary) {
            rows.push('Cart Analytics Summary');
            rows.push(`Total Carts,${analytics.totalCarts}`);
            rows.push(`Active Carts,${analytics.activeCarts}`);
            rows.push(`Abandoned Carts,${analytics.abandonedCarts}`);
            rows.push(`Average Items,${analytics.averageItems}`);
            rows.push(`Average Value,${analytics.averageValue}`);
            rows.push(`Conversion Rate,${analytics.conversionRate}%`);
            rows.push(`Today's Carts,${analytics.todayCarts}`);
            rows.push(`Today's Revenue,${analytics.todayRevenue}`);
            rows.push('');
            rows.push('Status Breakdown');
            rows.push('Status,Count,Percentage');
            analytics.statusBreakdown?.forEach((s: any) => {
              rows.push(`${s.status},${s.count},${s.percentage}%`);
            });
            rows.push('');
          }

          if (detailedData.length > 0) {
            rows.push('Detailed Cart Data');
            rows.push(
              'Cart ID,Status,User,Customer,Items,Subtotal,Total,Created At'
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
                },${new Date(cart.createdAt).toLocaleString()}`
              );
            });
          }

          exportData = rows.join('\n');
          contentType = 'text/csv';
          filename = `cart-analytics-${
            new Date().toISOString().split('T')[0]
          }.csv`;
          break;
        }

        case 'json': {
          exportData = JSON.stringify(
            {
              analytics,
              detailedData: includeDetailedData ? detailedData : undefined,
              summary: includeSummary
                ? {
                    totalCarts: analytics.totalCarts,
                    activeCarts: analytics.activeCarts,
                    abandonedCarts: analytics.abandonedCarts,
                    averageItems: analytics.averageItems,
                    averageValue: analytics.averageValue,
                    conversionRate: analytics.conversionRate,
                  }
                : undefined,
              exportedAt: new Date().toISOString(),
              dateRange: { start, end },
            },
            null,
            2
          );
          contentType = 'application/json';
          filename = `cart-analytics-${
            new Date().toISOString().split('T')[0]
          }.json`;
          break;
        }

        case 'excel':
        case 'pdf':
        default: {
          const rows: string[] = [];
          rows.push('Cart Analytics Report');
          rows.push(`Generated: ${new Date().toLocaleString()}`);
          rows.push(
            `Date Range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
          );
          rows.push('');
          if (includeSummary) {
            rows.push('Summary');
            rows.push(`Total Carts,${analytics.totalCarts}`);
            rows.push(`Active Carts,${analytics.activeCarts}`);
            rows.push(`Abandoned Carts,${analytics.abandonedCarts}`);
            rows.push(`Average Items,${analytics.averageItems}`);
            rows.push(`Average Value,${analytics.averageValue}`);
            rows.push(`Conversion Rate,${analytics.conversionRate}%`);
            rows.push(`Today's Carts,${analytics.todayCarts}`);
            rows.push(`Today's Revenue,${analytics.todayRevenue}`);
          }
          exportData = rows.join('\n');
          contentType = 'text/plain';
          filename = `cart-analytics-${
            new Date().toISOString().split('T')[0]
          }.txt`;
        }
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.send(exportData);
    } catch (error) {
      console.error('Export error:', error);
      next(error);
    }
  },

  /**
   * GET /cart/abandoned
   */
  async getAbandonedCarts(req: Request, res: Response, next: NextFunction) {
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
};

export default cartController;
