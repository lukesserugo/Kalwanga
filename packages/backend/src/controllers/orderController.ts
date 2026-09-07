// src/controllers/orderController.ts

import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/orderService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { realtimeService } from '../services/realtimeService.js';
import { notificationService } from '../services/notificationService.js';
import { z } from 'zod';

// Create singleton instance
const orderService = new OrderService();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    variantId: z.string().optional(),
    quantity: z.number().int().positive('Quantity must be positive'),
    unitPrice: z.number().positive('Unit price must be positive'),
    discount: z.number().min(0).optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
  customerId: z.string().optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  notes: z.string().optional(),
  businessUnitId: z.string().min(1, 'Business unit ID is required'),
  expectedDeliveryDate: z.string().datetime().optional(),
  shippingAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentTerms: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ON_HOLD']).optional(),
  notes: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  shippingAddress: z.string().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ON_HOLD']),
  notes: z.string().optional(),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

const addItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive'),
  discount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive'),
  discount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const bulkUpdateStatusSchema = z.object({
  orderIds: z.array(z.string()).min(1, 'At least one order ID is required'),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ON_HOLD']),
  notes: z.string().optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  businessUnitId: z.string().optional(),
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
// REAL-TIME EVENT HELPERS
// ============================================

/**
 * Safely emit real-time event
 */
async function safeEmitEvent(eventName: string, data: any): Promise<void> {
  try {
    if (realtimeService && typeof (realtimeService as any).emit === 'function') {
      await (realtimeService as any).emit(eventName, data);
    } else if (realtimeService && typeof (realtimeService as any).emitOrderEvent === 'function') {
      await (realtimeService as any).emitOrderEvent(eventName, data);
    } else {
      console.log(`📡 Real-time event: ${eventName}`, data);
    }
  } catch (error) {
    console.warn(`Failed to emit real-time event ${eventName}:`, error);
  }
}

// ============================================
// ORDER CONTROLLER
// ============================================

export class OrderController {
  /**
   * Get all orders with pagination and filters
   * GET /orders
   */
  async getAllOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      
      const params = {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        search: req.query.search as string | undefined,
        businessUnitId: businessUnitId,
        customerId: req.query.customerId as string | undefined,
        userId: req.query.userId as string | undefined,
        status: req.query.status as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
        priority: req.query.priority as string | undefined,
        paymentStatus: req.query.paymentStatus as string | undefined,
        minTotal: req.query.minTotal ? parseFloat(req.query.minTotal as string) : undefined,
        maxTotal: req.query.maxTotal ? parseFloat(req.query.maxTotal as string) : undefined,
        includeDeleted: req.query.includeDeleted === 'true',
      };

      const result = await orderService.getAllOrders(params);
      
      res.json({
        success: true,
        data: result?.orders || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          limit: result?.limit || 10,
          totalPages: result?.totalPages || 1,
          hasNextPage: result?.page < result?.totalPages,
          hasPreviousPage: result?.page > 1,
        },
        stats: result?.stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order by ID
   * GET /orders/:id
   */
  async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderById(id);
      
      if (!order) {
        throw new AppError('Order not found', 404);
      }
      
      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order by order number
   * GET /orders/number/:orderNumber
   */
  async getOrderByNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderNumber } = req.params;
      const order = await orderService.getOrderByNumber(orderNumber);
      
      if (!order) {
        throw new AppError('Order not found', 404);
      }
      
      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get orders by customer
   * GET /orders/customer/:customerId
   */
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

      res.json({
        success: true,
        data: result?.orders || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          limit: result?.limit || 10,
          totalPages: result?.totalPages || 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get orders by status
   * GET /orders/status/:status
   */
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

      res.json({
        success: true,
        data: result?.orders || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          limit: result?.limit || 10,
          totalPages: result?.totalPages || 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create order
   * POST /orders
   */
  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const validatedData = createOrderSchema.parse(req.body);

      const orderData = {
        items: validatedData.items,
        customerId: validatedData.customerId,
        discount: validatedData.discount || 0,
        tax: validatedData.tax || 0,
        notes: validatedData.notes,
        businessUnitId: validatedData.businessUnitId,
        expectedDeliveryDate: validatedData.expectedDeliveryDate ? new Date(validatedData.expectedDeliveryDate) : undefined,
        shippingAddress: validatedData.shippingAddress,
        paymentMethod: validatedData.paymentMethod,
        paymentTerms: validatedData.paymentTerms,
        priority: validatedData.priority || 'MEDIUM',
      };

      const order = await orderService.createOrder(orderData, userId);
      
      // Emit real-time notification using safe helper
      await safeEmitEvent('order:created', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        businessUnitId: order.businessUnitId,
      });

      res.status(201).json({
        success: true,
        data: order,
        message: 'Order created successfully',
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
  }

  /**
   * Update order
   * PUT /orders/:id
   */
  async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const validatedData = updateOrderSchema.parse(req.body);

      // Convert string date to Date object for the service
      const updateData = {
        status: validatedData.status,
        notes: validatedData.notes,
        priority: validatedData.priority,
        shippingAddress: validatedData.shippingAddress,
        expectedDeliveryDate: validatedData.expectedDeliveryDate ? new Date(validatedData.expectedDeliveryDate) : undefined,
      };

      const order = await orderService.updateOrder(id, updateData, userId);
      
      res.json({
        success: true,
        data: order,
        message: 'Order updated successfully',
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
  }

  /**
   * Update order status
   * PATCH /orders/:id/status
   */
  async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const validatedData = updateOrderStatusSchema.parse(req.body);

      const order = await orderService.updateOrderStatus(
        id, 
        validatedData.status, 
        userId, 
        validatedData.notes
      );
      
      // Emit real-time notification using safe helper
      await safeEmitEvent('order:status-updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        businessUnitId: order.businessUnitId,
      });

      res.json({
        success: true,
        data: order,
        message: `Order status updated to ${validatedData.status}`,
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
  }

  /**
   * Cancel order
   * POST /orders/:id/cancel
   */
  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const validatedData = cancelOrderSchema.parse(req.body);

      const order = await orderService.cancelOrder(id, userId, validatedData.reason);
      
      // Emit real-time notification using safe helper
      await safeEmitEvent('order:cancelled', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        businessUnitId: order.businessUnitId,
        reason: validatedData.reason,
      });

      res.json({
        success: true,
        data: order,
        message: 'Order cancelled successfully',
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
  }

  /**
   * Add item to order
   * POST /orders/:id/items
   */
  async addItemToOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const validatedData = addItemSchema.parse(req.body);

      const order = await orderService.addItemToOrder(id, validatedData, userId);
      
      res.json({
        success: true,
        data: order,
        message: 'Item added to order successfully',
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
  }

  /**
   * Update order item
   * PUT /orders/:orderId/items/:itemId
   */
  async updateOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, itemId } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const validatedData = updateItemSchema.parse(req.body);

      const order = await orderService.updateOrderItem(orderId, itemId, validatedData, userId);
      
      res.json({
        success: true,
        data: order,
        message: 'Order item updated successfully',
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
  }

  /**
   * Remove item from order
   * DELETE /orders/:orderId/items/:itemId
   */
  async removeOrderItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId, itemId } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const order = await orderService.removeOrderItem(orderId, itemId, userId);
      
      res.json({
        success: true,
        data: order,
        message: 'Order item removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Convert order to sale
   * POST /orders/:orderId/convert-to-sale
   */
  async convertOrderToSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const sale = await orderService.convertOrderToSale(orderId, userId);
      
      // Emit real-time notification using safe helper
      await safeEmitEvent('order:converted-to-sale', {
        orderId,
        saleId: sale.id,
        businessUnitId: sale.businessUnitId,
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

  /**
   * Get order history
   * GET /orders/:orderId/history
   */
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

  /**
   * Get order timeline
   * GET /orders/:orderId/timeline
   */
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

  /**
   * Get order statistics
   * GET /orders/stats
   */
  async getOrderStats(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const where: any = {};
      
      if (businessUnitId) {
        where.businessUnitId = businessUnitId;
      }

      // Remove priority from groupBy since it doesn't exist on Order model
      const [statusBreakdown, totalOrders, totalValue, recentOrders] = await Promise.all([
        prisma.order.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        prisma.order.count({ where }),
        prisma.order.aggregate({
          where,
          _sum: { total: true },
        }),
        prisma.order.findMany({
          where,
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalOrders,
          totalValue: totalValue._sum.total || 0,
          averageOrderValue: totalOrders > 0 ? (totalValue._sum.total || 0) / totalOrders : 0,
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

  /**
   * Get order by date range
   * GET /orders/date-range
   */
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
  }

  /**
   * Bulk update order status
   * PATCH /orders/bulk-status
   */
  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const validatedData = bulkUpdateStatusSchema.parse(req.body);

      const result = await orderService.bulkUpdateStatus(
        validatedData.orderIds,
        validatedData.status,
        userId,
        validatedData.notes
      );

      // Emit real-time notifications using safe helper
      await safeEmitEvent('orders:bulk-status-updated', {
        orderIds: validatedData.orderIds,
        status: validatedData.status,
        userId,
      });

      res.json({
        success: true,
        data: result,
        message: `${result.updated} orders updated successfully`,
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
  }

  /**
   * Bulk delete orders
   * DELETE /orders/bulk
   */
  async bulkDeleteOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderIds } = req.body;
      const userId = (req as any).user?.id;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        throw new AppError('Order IDs are required', 400);
      }

      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

      const result = await orderService.bulkDeleteOrders(orderIds, userId);

      res.json({
        success: true,
        data: result,
        message: `${result.deleted} orders deleted successfully`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete order (soft delete)
   * DELETE /orders/:id
   */
  async deleteOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('User ID is required', 401);
      }

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

  /**
   * Export orders
   * GET /orders/export
   */
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
        customer: order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.trim() : 'Guest',
        customerEmail: order.customer?.email || 'N/A',
        subtotal: order.subtotal,
        tax: order.tax,
        discount: order.discount,
        total: order.total,
        status: order.status,
        priority: order.priority || 'MEDIUM',
        items: order.items?.length || 0,
        totalQuantity: order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0,
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

  /**
   * Export orders to CSV
   * GET /orders/export/csv
   */
  async exportOrdersCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const orders = await orderService.getOrdersByDateRange({
        businessUnitId,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      const headers = ['Order Number', 'Date', 'Customer', 'Email', 'Subtotal', 'Tax', 'Discount', 'Total', 'Status', 'Priority', 'Items'];
      const rows = orders.map((order: any) => [
        order.orderNumber,
        order.createdAt.toISOString().split('T')[0],
        order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.trim() : 'Guest',
        order.customer?.email || 'N/A',
        order.subtotal.toFixed(2),
        order.tax.toFixed(2),
        order.discount.toFixed(2),
        order.total.toFixed(2),
        order.status,
        order.priority || 'MEDIUM',
        order.items?.length || 0,
      ]);

      const csvContent = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=orders-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export orders to Excel
   * GET /orders/export/excel
   */
  async exportOrdersExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const orders = await orderService.getOrdersByDateRange({
        businessUnitId,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      res.json({
        success: true,
        data: orders,
        message: 'Excel export would be generated here',
        count: orders.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export orders to PDF
   * GET /orders/export/pdf
   */
  async exportOrdersPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const orders = await orderService.getOrdersByDateRange({
        businessUnitId,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
      });

      res.json({
        success: true,
        data: orders,
        message: 'PDF export would be generated here',
        count: orders.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get dashboard order data
   * GET /orders/dashboard
   */
  async getDashboardOrderData(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [todayOrders, pendingOrders, processingOrders, completedOrders, totalOrders, recentOrders] = await Promise.all([
        prisma.order.count({
          where: {
            businessUnitId,
            createdAt: { gte: today },
          },
        }),
        prisma.order.count({
          where: {
            businessUnitId,
            status: 'PENDING',
          },
        }),
        prisma.order.count({
          where: {
            businessUnitId,
            status: 'PROCESSING',
          },
        }),
        prisma.order.count({
          where: {
            businessUnitId,
            status: 'COMPLETED',
          },
        }),
        prisma.order.count({
          where: {
            businessUnitId,
          },
        }),
        prisma.order.findMany({
          where: {
            businessUnitId,
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
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

  /**
   * Test notification (for debugging)
   * POST /orders/test-notification
   */
  async testNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, orderNumber } = req.body;
      
      if (!businessUnitId || !orderNumber) {
        throw new AppError('businessUnitId and orderNumber are required', 400);
      }

      await notificationService.sendPurchaseOrderNotification(
        businessUnitId,
        orderNumber,
        'Test Customer',
        100
      );

      res.json({ 
        success: true,
        message: 'Test notification sent' 
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order analytics
   * GET /orders/analytics
   */
  async getOrderAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const analytics = await orderService.getOrderAnalytics({
        businessUnitId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        groupBy: groupBy as any,
      });

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get order fulfillment status
   * GET /orders/fulfillment
   */
  async getOrderFulfillmentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      
      const status = await orderService.getOrderFulfillmentStatus(businessUnitId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const orderController = new OrderController();
