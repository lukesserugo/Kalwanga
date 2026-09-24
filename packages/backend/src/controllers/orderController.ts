// D:\Projects\Kalwanga\packages\backend\src\controllers\orderController.ts

import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { realtimeService } from '../services/realtimeService.js';
import { notificationService } from '../services/notificationService.js';
import { getBusinessUnitId } from '../utils/getBusinessUnitId.js';
import { z } from 'zod';

const orderService = new OrderService();

// ============================================
// VALIDATION SCHEMAS
// ============================================
//
// ⚠ `unitPrice` and `discount` are intentionally NOT accepted on
// order items. The service derives the authoritative price from
// `Product.unitPrice` / `ProductVariant.price` at creation time.
// Accepting them from the client was a fraud vector.

const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  items: z
    .array(orderItemSchema)
    .min(1, 'At least one item is required'),
  customerId: z.string().optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  notes: z.string().optional(),
  businessUnitId: z.string().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  shippingAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentTerms: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

const updateOrderSchema = z.object({
  status: z
    .enum([
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'CANCELLED',
      'REFUNDED',
      'ON_HOLD',
    ])
    .optional(),
  notes: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  shippingAddress: z.string().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED',
    'ON_HOLD',
  ]),
  notes: z.string().optional(),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const addItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().optional(),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be positive'),
  discount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const bulkUpdateStatusSchema = z.object({
  orderIds: z.array(z.string()).min(1, 'At least one order ID is required'),
  status: z.enum([
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED',
    'ON_HOLD',
  ]),
  notes: z.string().optional(),
});

const bulkDeleteOrdersSchema = z.object({
  orderIds: z.array(z.string()).min(1, 'At least one order ID is required'),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  businessUnitId: z.string().optional(),
});

// ============================================
// HELPERS
// ============================================

/**
 * Convert a ZodError to the standard 400 response shape.
 */
function zodErrorResponse(error: z.ZodError) {
  return {
    success: false as const,
    message: 'Validation error',
    errors: error.errors.map((e: z.ZodIssue) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  };
}

async function safeEmitEvent(
  eventName: string,
  data: unknown,
): Promise<void> {
  try {
    const svc = realtimeService as any;
    if (svc && typeof svc.emit === 'function') {
      await svc.emit(eventName, data);
    } else if (svc && typeof svc.emitOrderEvent === 'function') {
      await svc.emitOrderEvent(eventName, data);
    } else {
      console.log(`📡 Real-time event: ${eventName}`, data);
    }
  } catch (error) {
    console.warn(`Failed to emit real-time event ${eventName}:`, error);
  }
}

// ============================================
// CONTROLLER
// ============================================

export class OrderController {
  // ── LIST / READ ─────────────────────────────────────────────

  async getAllOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const params = {
        page: req.query.page
          ? parseInt(req.query.page as string)
          : undefined,
        limit: req.query.limit
          ? parseInt(req.query.limit as string)
          : undefined,
        search: req.query.search as string | undefined,
        businessUnitId,
        customerId: req.query.customerId as string | undefined,
        userId: req.query.userId as string | undefined,
        status: req.query.status as string | undefined,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
        priority: req.query.priority as string | undefined,
        paymentStatus: req.query.paymentStatus as string | undefined,
        minTotal: req.query.minTotal
          ? parseFloat(req.query.minTotal as string)
          : undefined,
        maxTotal: req.query.maxTotal
          ? parseFloat(req.query.maxTotal as string)
          : undefined,
        includeDeleted: req.query.includeDeleted === 'true',
      };

      const result = await orderService.getAllOrders(params);

      const page = result?.page || 1;
      const totalPages = result?.totalPages || 1;

      res.json({
        success: true,
        data: result?.orders || [],
        pagination: {
          total: result?.total || 0,
          page,
          limit: result?.limit || 10,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        stats: result?.stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderById(id);

      if (!order) throw new AppError('Order not found', 404);

      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  async getOrderByNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber } = req.params;
      const order = await orderService.getOrderByNumber(orderNumber);

      if (!order) throw new AppError('Order not found', 404);

      res.json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  async getOrdersByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const result = await orderService.getAllOrders({
        customerId,
        businessUnitId,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
      });

      const currentPage = result?.page || 1;
      const totalPages = result?.totalPages || 1;

      res.json({
        success: true,
        data: result?.orders || [],
        pagination: {
          total: result?.total || 0,
          page: currentPage,
          limit: result?.limit || 10,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrdersByStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.params;
      const businessUnitId = await getBusinessUnitId(req);
      const { page, limit } = req.query;

      const result = await orderService.getAllOrders({
        businessUnitId,
        status,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
      });

      const currentPage = result?.page || 1;
      const totalPages = result?.totalPages || 1;

      res.json({
        success: true,
        data: result?.orders || [],
        pagination: {
          total: result?.total || 0,
          page: currentPage,
          limit: result?.limit || 10,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrdersByDateRange(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const validatedData = dateRangeSchema.parse(req.query);
      const { startDate, endDate } = validatedData;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const orders = await orderService.getOrdersByDateRange({
        businessUnitId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      res.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  async getOrderHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const history = await orderService.getOrderHistory(orderId);

      res.json({
        success: true,
        data: history,
        count: history?.length || 0,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const timeline = await orderService.getOrderTimeline(orderId);

      res.json({
        success: true,
        data: timeline,
        count: timeline?.length || 0,
      });
    } catch (error) {
      next(error);
    }
  }

  // ── STATS / DASHBOARD ───────────────────────────────────────

  async getOrderStats(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const [statusBreakdown, totalOrders, totalValue, recentOrders] =
        await Promise.all([
          prisma.order.groupBy({
            by: ['status'],
            where: { businessUnitId },
            _count: { _all: true },
          }),
          prisma.order.count({ where: { businessUnitId } }),
          prisma.order.aggregate({
            where: { businessUnitId },
            _sum: { total: true },
          }),
          prisma.order.findMany({
            where: { businessUnitId },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              customer: true,
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          }),
        ]);

      const totalRevenue = totalValue._sum.total || 0;

      res.json({
        success: true,
        data: {
          totalOrders,
          totalValue: totalRevenue,
          averageOrderValue:
            totalOrders > 0 ? totalRevenue / totalOrders : 0,
          statusBreakdown: statusBreakdown.map((s: any) => ({
            status: s.status,
            count: s._count._all,
          })),
          recentOrders,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardOrderData(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        todayOrders,
        pendingOrders,
        processingOrders,
        completedOrders,
        totalOrders,
        recentOrders,
      ] = await Promise.all([
        prisma.order.count({
          where: { businessUnitId, createdAt: { gte: today } },
        }),
        prisma.order.count({
          where: { businessUnitId, status: 'PENDING' },
        }),
        prisma.order.count({
          where: { businessUnitId, status: 'PROCESSING' },
        }),
        prisma.order.count({
          where: { businessUnitId, status: 'COMPLETED' },
        }),
        prisma.order.count({ where: { businessUnitId } }),
        prisma.order.findMany({
          where: { businessUnitId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          todayOrders,
          pendingOrders,
          processingOrders,
          completedOrders,
          totalOrders,
          recentOrders,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const analytics = await orderService.getOrderAnalytics({
        businessUnitId,
        startDate: startDate
          ? new Date(startDate as string)
          : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        groupBy: groupBy as any,
      });

      res.json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  }

  async getOrderFulfillmentStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const status =
        await orderService.getOrderFulfillmentStatus(businessUnitId);

      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  // ── CREATE ──────────────────────────────────────────────────

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const validatedData = createOrderSchema.parse(req.body);
      const businessUnitId = await getBusinessUnitId(req);

      const orderData = {
        items: validatedData.items,
        customerId: validatedData.customerId,
        discount: validatedData.discount ?? 0,
        tax: validatedData.tax ?? 0,
        notes: validatedData.notes,
        businessUnitId,
        expectedDeliveryDate: validatedData.expectedDeliveryDate
          ? new Date(validatedData.expectedDeliveryDate)
          : undefined,
        shippingAddress: validatedData.shippingAddress,
        paymentMethod: validatedData.paymentMethod,
        paymentTerms: validatedData.paymentTerms,
        priority: validatedData.priority ?? 'MEDIUM',
      };

      const order = await orderService.createOrder(orderData, userId);

      await safeEmitEvent('order:created', {
        orderId: order!.id,
        orderNumber: order!.orderNumber,
        businessUnitId: order!.businessUnitId,
      });

      res.status(201).json({
        success: true,
        data: order,
        message: 'Order created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  // ── UPDATE ──────────────────────────────────────────────────

  async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const validatedData = updateOrderSchema.parse(req.body);

      const order = await orderService.updateOrder(
        id,
        {
          status: validatedData.status,
          notes: validatedData.notes,
          priority: validatedData.priority,
          shippingAddress: validatedData.shippingAddress,
          expectedDeliveryDate: validatedData.expectedDeliveryDate
            ? new Date(validatedData.expectedDeliveryDate)
            : undefined,
        },
        userId,
      );

      res.json({
        success: true,
        data: order,
        message: 'Order updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const validatedData = updateOrderStatusSchema.parse(req.body);

      const order = await orderService.updateOrderStatus(
        id,
        validatedData.status,
        userId,
        validatedData.notes,
      );

      await safeEmitEvent('order:status-updated', {
        orderId: order!.id,
        orderNumber: order!.orderNumber,
        status: order!.status,
        businessUnitId: order!.businessUnitId,
      });

      res.json({
        success: true,
        data: order,
        message: `Order status updated to ${validatedData.status}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const validatedData = cancelOrderSchema.parse(req.body);

      const order = await orderService.cancelOrder(
        id,
        userId,
        validatedData.reason,
      );

      await safeEmitEvent('order:cancelled', {
        orderId: order!.id,
        orderNumber: order!.orderNumber,
        businessUnitId: order!.businessUnitId,
        reason: validatedData.reason,
      });

      res.json({
        success: true,
        data: order,
        message: 'Order cancelled successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const validatedData = bulkUpdateStatusSchema.parse(req.body);

      const result = await orderService.bulkUpdateStatus(
        validatedData.orderIds,
        validatedData.status,
        userId,
        validatedData.notes,
      );

      await safeEmitEvent('orders:bulk-status-updated', {
        orderIds: validatedData.orderIds,
        status: validatedData.status,
        userId,
      });

      res.json({
        success: true,
        data: result,
        message: `${result!.updated} orders updated successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  // ── ITEMS ───────────────────────────────────────────────────

  async addItemToOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const validatedData = addItemSchema.parse(req.body);

      const order = await orderService.addItemToOrder(
        id,
        validatedData,
        userId,
      );

      res.json({
        success: true,
        data: order,
        message: 'Item added to order successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  async updateOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, itemId } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const validatedData = updateItemSchema.parse(req.body);

      const order = await orderService.updateOrderItem(
        orderId,
        itemId,
        validatedData,
        userId,
      );

      res.json({
        success: true,
        data: order,
        message: 'Order item updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  async removeOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, itemId } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const order = await orderService.removeOrderItem(
        orderId,
        itemId,
        userId,
      );

      res.json({
        success: true,
        data: order,
        message: 'Order item removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ── CONVERT ─────────────────────────────────────────────────

  async convertOrderToSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const sale = await orderService.convertOrderToSale(orderId, userId);

      await safeEmitEvent('order:converted-to-sale', {
        orderId,
        saleId: sale!.id,
        businessUnitId: sale!.businessUnitId,
      });

      res.status(201).json({
        success: true,
        data: sale,
        message: 'Order converted to sale successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ── DELETE ──────────────────────────────────────────────────

  async deleteOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const result = await orderService.deleteOrder(id, userId);

      res.json({
        success: true,
        data: result,
        message: 'Order deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkDeleteOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new AppError('User ID is required', 401);

      const { orderIds } = bulkDeleteOrdersSchema.parse(req.body);

      const result = await orderService.bulkDeleteOrders(orderIds, userId);

      res.json({
        success: true,
        data: result,
        message: `${result!.deleted} orders deleted successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json(zodErrorResponse(error));
      }
      next(error);
    }
  }

  // ── EXPORTS ─────────────────────────────────────────────────

  async exportOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate, format = 'json' } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const orders = await orderService.getOrdersByDateRange({
        businessUnitId,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      });

      const exportData = orders.map((order: any) => ({
        orderNumber: order.orderNumber,
        date: order.createdAt.toISOString().split('T')[0],
        customer: order.customer
          ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
          : 'Guest',
        customerEmail: order.customer?.email || 'N/A',
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        status: order.status,
        priority: order.priority || 'MEDIUM',
        items: order.items?.length || 0,
        totalQuantity:
          order.items?.reduce(
            (sum: number, item: any) => sum + item.quantity,
            0,
          ) || 0,
      }));

      res.json({
        success: true,
        data: exportData,
        format,
        total: exportData.length,
        message: `Orders exported as ${format}`,
      });
    } catch (error) {
      next(error);
    }
  }

  async exportOrdersCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const orders = await orderService.getOrdersByDateRange({
        businessUnitId,
        startDate: startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      const headers = [
        'Order Number',
        'Date',
        'Customer',
        'Email',
        'Subtotal',
        'Tax',
        'Discount',
        'Total',
        'Status',
        'Priority',
        'Items',
      ];

      const escapeCsv = (v: unknown): string => {
        if (v === null || v === undefined) return '';
        const str = String(v);
        if (
          str.includes(',') ||
          str.includes('"') ||
          str.includes('\n') ||
          str.includes('\r')
        ) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = orders.map((order: any) => [
        order.orderNumber,
        order.createdAt.toISOString().split('T')[0],
        order.customer
          ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
          : 'Guest',
        order.customer?.email || 'N/A',
        order.subtotal.toFixed(2),
        order.tax.toFixed(2),
        order.discount.toFixed(2),
        order.total.toFixed(2),
        order.status,
        order.priority || 'MEDIUM',
        order.items?.length || 0,
      ]);

      const csvContent = [
        headers.map(escapeCsv).join(','),
        ...rows.map((row: unknown[]) => row.map(escapeCsv).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=orders-${new Date()
          .toISOString()
          .split('T')[0]}.csv`,
      );
      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ⚠ Placeholder. The backend currently returns JSON with a
   * "would be generated here" message. Kept as a route so the
   * frontend can discover the endpoint; the real xlsx generator
   * is a follow-up.
   */
  async exportOrdersExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const orders = await orderService.getOrdersByDateRange({
        businessUnitId,
        startDate: startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      res.status(501).json({
        success: false,
        message:
          'Excel export is not yet implemented. Use /orders/export/csv or /orders/export?format=json.',
        count: orders.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ⚠ Placeholder. Same as `exportOrdersExcel`.
   */
  async exportOrdersPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const orders = await orderService.getOrdersByDateRange({
        businessUnitId,
        startDate: startDate
          ? new Date(startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      res.status(501).json({
        success: false,
        message:
          'PDF export is not yet implemented. Use /orders/export/csv or /orders/export?format=json.',
        count: orders.length,
      });
    } catch (error) {
      next(error);
    }
  }

  // ── TEST ────────────────────────────────────────────────────

  async testNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, orderNumber } = req.body;

      if (!businessUnitId || !orderNumber) {
        throw new AppError(
          'businessUnitId and orderNumber are required',
          400,
        );
      }

      await notificationService.sendPurchaseOrderNotification(
        businessUnitId,
        orderNumber,
        'Test Customer',
        100,
      );

      res.json({ success: true, message: 'Test notification sent' });
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();
