// src/services/orderService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';
import { notificationService } from './notificationService.js';
import { generateOrderNumber, calculateTotal } from '../utils/helpers.js';
import { logger } from '../lib/logger.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface OrderItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  notes?: string;
}

interface CreateOrderData {
  items: OrderItemInput[];
  customerId?: string;
  discount?: number;
  tax?: number;
  notes?: string;
  businessUnitId: string;
  expectedDeliveryDate?: Date;
  shippingAddress?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

interface UpdateOrderData {
  status?: string;
  notes?: string;
  priority?: string;
  shippingAddress?: string;
  expectedDeliveryDate?: Date;
}

interface OrderResponse {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  businessUnitId: string;
  userId: string;
  customerId?: string;
  createdAt: Date;
  updatedAt: Date;
  items: any[];
  customer?: any;
  user?: any;
  payment?: any;
  sale?: any;
  itemCount?: number;
  totalQuantity?: number;
}

// ============================================
// ORDER SERVICE CLASS
// ============================================

export class OrderService extends BaseService {
  /**
   * Safely emit new order event
   */
  private safeEmitNewOrder(order: any, businessUnitId: string): void {
    try {
      logger.info(`📦 New order: ${order?.orderNumber || order?.id} - ${businessUnitId}`);
      if (typeof (realtimeService as any).emitOrderCreated === 'function') {
        (realtimeService as any).emitOrderCreated(order, businessUnitId);
      } else {
        (realtimeService as any).emitPurchaseOrderCreated?.(order, businessUnitId);
      }
    } catch (error) {
      logger.warn('Failed to emit new order event:', error);
    }
  }

  /**
   * Safely emit order status change event
   */
  private safeEmitOrderStatusChange(orderId: string, status: string, businessUnitId: string): void {
    try {
      logger.info(`📦 Order ${orderId} status changed to ${status}`);
      if (typeof (realtimeService as any).emitOrderStatusChanged === 'function') {
        (realtimeService as any).emitOrderStatusChanged({ id: orderId, status }, businessUnitId);
      } else {
        (realtimeService as any).emitPurchaseOrderReceived?.({ id: orderId, status }, businessUnitId);
      }
    } catch (error) {
      logger.warn('Failed to emit order status change:', error);
    }
  }

  /**
   * Generate unique order number
   */
  private async generateUniqueOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    let orderNumber: string;
    let counter = 0;
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6);
    
    do {
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      orderNumber = `${prefix}-${timestamp}-${random}`;
      counter++;
      if (counter > 100) {
        throw new AppError('Failed to generate unique order number', 500);
      }
    } while (await tx.order.findUnique({ where: { orderNumber } }));
    
    return orderNumber;
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      'PENDING': ['PROCESSING', 'CANCELLED', 'ON_HOLD'],
      'PROCESSING': ['COMPLETED', 'CANCELLED', 'ON_HOLD'],
      'COMPLETED': ['REFUNDED'],
      'CANCELLED': [],
      'REFUNDED': [],
      'ON_HOLD': ['PENDING', 'PROCESSING', 'CANCELLED'],
    };

    if (currentStatus === newStatus) return;

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new AppError(
        `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ') || 'none'}`,
        400
      );
    }
  }

  /**
   * Release reserved inventory for cancelled order
   */
  private async releaseReservedInventory(tx: Prisma.TransactionClient, order: any): Promise<void> {
    const orderItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
    });

    for (const item of orderItems) {
      const inventory = await tx.inventory.findFirst({
        where: {
          productId: item.productId,
          variantId: item.variantId || null,
          businessUnitId: order.businessUnitId,
        },
      });

      if (inventory && inventory.reserved > 0) {
        const releaseQuantity = Math.min(item.quantity, inventory.reserved);
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            reserved: { decrement: releaseQuantity },
            available: { increment: releaseQuantity },
          },
        });
      }
    }
  }

  /**
   * Deduct inventory for completed order
   */
  private async deductInventoryForOrder(tx: Prisma.TransactionClient, order: any): Promise<void> {
    const orderItems = await tx.orderItem.findMany({
      where: { orderId: order.id },
    });

    for (const item of orderItems) {
      const inventory = await tx.inventory.findFirst({
        where: {
          productId: item.productId,
          variantId: item.variantId || null,
          businessUnitId: order.businessUnitId,
        },
      });

      if (inventory) {
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: { decrement: item.quantity },
            reserved: { decrement: Math.min(item.quantity, inventory.reserved) },
            available: { decrement: Math.max(0, item.quantity - inventory.reserved) },
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'SALE',
            quantity: -item.quantity,
            notes: `Order ${order.orderNumber} completed`,
            productId: item.productId,
            variantId: item.variantId || null,
            inventoryId: inventory.id,
            businessUnitId: order.businessUnitId,
            userId: order.userId,
            saleId: order.saleId,
          },
        });
      }
    }
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Get all orders with pagination and filters
   */
  async getAllOrders(params: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    customerId?: string;
    userId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    priority?: string;
    paymentStatus?: string;
    minTotal?: number;
    maxTotal?: number;
    includeDeleted?: boolean;
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        businessUnitId,
        customerId,
        userId,
        status,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        priority,
        minTotal,
        maxTotal,
        includeDeleted = false,
      } = params;
      
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(100, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = {};

      // Business unit filter
      if (businessUnitId) {
        where.businessUnitId = businessUnitId;
      }

      // Customer filter
      if (customerId) {
        where.customerId = customerId;
      }

      // User filter
      if (userId) {
        where.userId = userId;
      }

      // Status filter
      if (status) {
        where.status = status as any;
      }

      // Priority filter
      if (priority) {
        where.priority = priority as any;
      }

      // Amount filters
      if (minTotal !== undefined) {
        where.total = { gte: minTotal };
      }
      if (maxTotal !== undefined) {
        where.total = { ...(where.total as any), lte: maxTotal };
      }

      // Date range filter
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      // Exclude deleted
      if (!includeDeleted) {
        where.status = { not: 'DELETED' };
      }

      // Search filter
      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customer: { firstName: { contains: search, mode: 'insensitive' } } },
          { customer: { lastName: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      const validSortFields = ['createdAt', 'updatedAt', 'orderNumber', 'total', 'status'];
      const orderBy: any = validSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { createdAt: 'desc' };

      const [orders, total, stats] = await Promise.all([
        this.prisma.order.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy,
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                loyaltyLevel: true,
                loyaltyPoints: true,
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
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    barcode: true,
                    unitPrice: true,
                    images: true,
                    category: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                variant: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    price: true,
                    attributes: true,
                  },
                },
              },
            },
            payment: {
              select: {
                id: true,
                paymentMethod: true,
                amount: true,
                status: true,
                reference: true,
              },
            },
            sale: {
              select: {
                id: true,
                receiptNumber: true,
                status: true,
                total: true,
              },
            },
            _count: {
              select: { items: true },
            },
          },
        }),
        this.prisma.order.count({ where }),
        this.getOrderStats(where),
      ]);

      const enhancedOrders = orders.map((order: any) => ({
        ...order,
        itemCount: order._count?.items || 0,
        totalQuantity: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        customerName: order.customer 
          ? `${order.customer.firstName} ${order.customer.lastName}`.trim() 
          : 'Guest',
        hasSale: !!order.sale,
        hasPayment: !!order.payment,
      }));

      return {
        orders: enhancedOrders,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
        stats,
      };
    } catch (error) {
      this.handleError(error, 'OrderService.getAllOrders');
    }
  }

  /**
   * Get order statistics
   */

  private async getOrderStats(where: any) {
    try {
      const [statusCounts, totalValue, pendingCount, completedCount] = await Promise.all([
        this.prisma.order.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.order.aggregate({
          where,
          _sum: { total: true },
        }),
        this.prisma.order.count({
          where: { ...where, status: 'PENDING' },
        }),
        this.prisma.order.count({
          where: { ...where, status: 'COMPLETED' },
        }),
      ]);

      return {
        totalValue: totalValue._sum.total || 0,
        pendingCount,
        completedCount,
        statusBreakdown: statusCounts.map((s: any) => ({
          status: s.status,
          count: s._count._all,
        })),
      };
    } catch (error) {
      logger.warn('Failed to get order stats:', error);
      return {
        totalValue: 0,
        pendingCount: 0,
        completedCount: 0,
        statusBreakdown: [],
      };
    }
  }

  /**
   * Get order by ID with full details
   */
  async getOrderById(id: string): Promise<OrderResponse> {
    try {
      if (!id) {
        throw new AppError('Order ID is required', 400);
      }

      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          customer: {
            include: {
              _count: {
                select: {
                  orders: true,
                  sales: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  unitPrice: true,
                  costPrice: true,
                  images: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  attributes: true,
                },
              },
            },
          },
          payment: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          sale: {
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                    },
                  },
                },
              },
              payments: true,
              customer: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          businessUnit: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.quantity, 0);

      return {
        ...order,
        itemCount: order._count?.items || 0,
        totalQuantity,
        customerName: order.customer 
          ? `${order.customer.firstName} ${order.customer.lastName}`.trim() 
          : 'Guest',
        customerTotalOrders: order.customer?._count?.orders || 0,
        customerTotalSales: order.customer?._count?.sales || 0,
      } as OrderResponse;
    } catch (error) {
      this.handleError(error, 'OrderService.getOrderById');
    }
  }

  /**
   * Get order by number
   */
  async getOrderByNumber(orderNumber: string) {
    try {
      if (!orderNumber) {
        throw new AppError('Order number is required', 400);
      }

      const order = await this.prisma.order.findUnique({
        where: { orderNumber },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
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
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unitPrice: true,
                  barcode: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                },
              },
            },
          },
          payment: true,
          sale: {
            select: {
              id: true,
              receiptNumber: true,
              status: true,
            },
          },
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      return order;
    } catch (error) {
      this.handleError(error, 'OrderService.getOrderByNumber');
    }
  }

  /**
   * Create order with comprehensive validation
   */
  async createOrder(data: CreateOrderData, userId: string) {
    try {
      if (!data.items || data.items.length === 0) {
        throw new AppError('At least one order item is required', 400);
      }
      if (!data.businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      // Validate items
      for (const item of data.items) {
        if (!item.productId) {
          throw new AppError('Product ID is required for all items', 400);
        }
        if (!item.quantity || item.quantity <= 0) {
          throw new AppError('Quantity must be positive for all items', 400);
        }
        if (item.unitPrice < 0) {
          throw new AppError('Unit price cannot be negative', 400);
        }
      }

      return await this.prisma.$transaction(async (tx: any) => {
        // Generate unique order number
        const orderNumber = await this.generateUniqueOrderNumber(tx);
        
        // Calculate totals
        const subtotal = data.items.reduce((sum: number, item: OrderItemInput) => 
          sum + (item.quantity * item.unitPrice) - (item.discount || 0), 0
        );
        const totalDiscount = data.discount || 0;
        const totalTax = data.tax || 0;
        const total = subtotal + totalTax - totalDiscount;

        if (total < 0) {
          throw new AppError('Order total cannot be negative', 400);
        }

        // Validate products and inventory
        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: {
              inventory: {
                where: { businessUnitId: data.businessUnitId },
              },
            },
          });

          if (!product) {
            throw new AppError(`Product ${item.productId} not found`, 404);
          }

          if (!product.isActive) {
            throw new AppError(`Product ${product.name} is not active`, 400);
          }

          const inventory = product.inventory?.[0];
          if (inventory) {
            const availableStock = inventory.quantity - inventory.reserved;
            if (availableStock < item.quantity) {
              throw new AppError(
                `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`,
                400
              );
            }
          } else {
            throw new AppError(`No inventory found for ${product.name} in this location`, 400);
          }
        }

        // Create order
        const order = await tx.order.create({
          data: {
            orderNumber,
            status: 'PENDING',
            subtotal,
            tax: totalTax,
            discount: totalDiscount,
            total,
            notes: data.notes,
            businessUnitId: data.businessUnitId,
            userId,
            customerId: data.customerId,
          },
        });

        // Create order items and reserve inventory
        for (const item of data.items) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: (item.quantity * item.unitPrice) - (item.discount || 0),
              notes: item.notes,
            },
          });

          // Reserve inventory
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              variantId: item.variantId || null,
              businessUnitId: data.businessUnitId,
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                reserved: { increment: item.quantity },
                available: { decrement: item.quantity },
              },
            });
          }
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'ORDER',
            entityId: order.id,
            userId: userId,
            entityName: orderNumber,
            changes: {
              total,
              items: data.items.length,
              customerId: data.customerId,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        // Emit event and send notification
        this.safeEmitNewOrder(order, data.businessUnitId);

        try {
          await notificationService.sendPurchaseOrderNotification(
            data.businessUnitId,
            orderNumber,
            data.customerId || 'Guest',
            total
          );
        } catch (notifError) {
          logger.warn('Failed to send notification:', notifError);
        }

        // Return created order with details
        return await tx.order.findUnique({
          where: { id: order.id },
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
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
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
          },
        });
      });
    } catch (error) {
      this.handleError(error, 'OrderService.createOrder');
    }
  }

  /**
   * Update order
   */
  async updateOrder(id: string, data: UpdateOrderData, userId: string) {
    try {
      if (!id) {
        throw new AppError('Order ID is required', 400);
      }

      const existingOrder = await this.prisma.order.findUnique({
        where: { id },
      });

      if (!existingOrder) {
        throw new AppError('Order not found', 404);
      }

      const updateData: any = {};
      
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.priority) updateData.priority = data.priority as any;
      if (data.shippingAddress) updateData.shippingAddress = data.shippingAddress;
      if (data.expectedDeliveryDate) updateData.expectedDeliveryDate = data.expectedDeliveryDate;

      if (data.status) {
        this.validateStatusTransition(existingOrder.status, data.status);
        updateData.status = data.status as any;
      }

      const order = await this.prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });

      // Create audit log
      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'ORDER',
          entityId: order.id,
          userId: userId,
          entityName: order.orderNumber,
          changes: updateData,
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      this.safeEmitOrderStatusChange(id, order.status, order.businessUnitId);

      return order;
    } catch (error) {
      this.handleError(error, 'OrderService.updateOrder');
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id: string, status: string, userId: string, notes?: string) {
    try {
      if (!id) {
        throw new AppError('Order ID is required', 400);
      }
      if (!status) {
        throw new AppError('Status is required', 400);
      }

      const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ON_HOLD'];
      if (!validStatuses.includes(status)) {
        throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const order = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!order) {
          throw new AppError('Order not found', 404);
        }

        this.validateStatusTransition(order.status, status);

        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            status: status as any,
            notes: notes 
              ? `${order.notes || ''}\n[${new Date().toISOString()}] Status changed to ${status}: ${notes}`
              : `${order.notes || ''}\n[${new Date().toISOString()}] Status changed to ${status}`,
          },
          include: {
            customer: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        // Handle inventory based on status change
        if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
          await this.releaseReservedInventory(tx, order);
        }

        if (status === 'COMPLETED' && order.status !== 'COMPLETED') {
          await this.deductInventoryForOrder(tx, order);
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'ORDER',
            entityId: order.id,
            userId: userId,
            entityName: order.orderNumber,
            changes: { 
              oldStatus: order.status,
              newStatus: status,
              notes: notes,
            },
            severity: status === 'CANCELLED' ? 'HIGH' : 'INFO',
            createdAt: new Date(),
          },
        });

        this.safeEmitOrderStatusChange(id, status, order.businessUnitId);

        return updatedOrder;
      });
    } catch (error) {
      this.handleError(error, 'OrderService.updateOrderStatus');
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(id: string, userId: string, reason?: string) {
    try {
      if (!id) {
        throw new AppError('Order ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const order = await tx.order.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!order) {
          throw new AppError('Order not found', 404);
        }

        if (order.status === 'COMPLETED') {
          throw new AppError('Completed orders cannot be cancelled', 400);
        }

        if (order.status === 'CANCELLED') {
          throw new AppError('Order is already cancelled', 400);
        }

        // Release reserved inventory
        await this.releaseReservedInventory(tx, order);

        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            notes: order.notes
              ? `${order.notes}\n[${new Date().toISOString()}] Cancelled: ${reason || 'No reason provided'}`
              : `[${new Date().toISOString()}] Cancelled: ${reason || 'No reason provided'}`,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'DELETE',
            entityType: 'ORDER',
            entityId: order.id,
            userId: userId,
            entityName: order.orderNumber,
            changes: { reason: reason || 'No reason provided' },
            severity: 'HIGH',
            createdAt: new Date(),
          },
        });

        this.safeEmitOrderStatusChange(id, 'CANCELLED', order.businessUnitId);

        return updatedOrder;
      });
    } catch (error) {
      this.handleError(error, 'OrderService.cancelOrder');
    }
  }

  /**
   * Add item to order
   */
  async addItemToOrder(orderId: string, itemData: OrderItemInput, userId: string) {
    try {
      if (!orderId) {
        throw new AppError('Order ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          throw new AppError('Order not found', 404);
        }

        if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
          throw new AppError(`Cannot add items to ${order.status.toLowerCase()} order`, 400);
        }

        // Validate product
        const product = await tx.product.findUnique({
          where: { id: itemData.productId },
          include: {
            inventory: {
              where: { businessUnitId: order.businessUnitId },
            },
          },
        });

        if (!product) {
          throw new AppError('Product not found', 404);
        }

        if (!product.isActive) {
          throw new AppError(`Product ${product.name} is not active`, 400);
        }

        // Check stock
        const inventory = product.inventory?.[0];
        if (inventory) {
          const availableStock = inventory.quantity - inventory.reserved;
          if (availableStock < itemData.quantity) {
            throw new AppError(
              `Insufficient stock for ${product.name}. Available: ${availableStock}`,
              400
            );
          }
        }

        // Create order item
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: itemData.productId,
            variantId: itemData.variantId || null,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            discount: itemData.discount || 0,
            total: (itemData.quantity * itemData.unitPrice) - (itemData.discount || 0),
            notes: itemData.notes,
          },
        });

        // Reserve inventory
        if (inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              reserved: { increment: itemData.quantity },
              available: { decrement: itemData.quantity },
            },
          });
        }

        // Update order totals
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: order.id },
        });

        const newSubtotal = orderItems.reduce((sum: number, item: any) => sum + item.total, 0);
        const newTotal = newSubtotal + order.tax - order.discount;

        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: newSubtotal,
            total: newTotal,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'ORDER_ITEM',
            entityId: orderItem.id,
            userId: userId,
            entityName: order.orderNumber,
            changes: {
              productId: itemData.productId,
              quantity: itemData.quantity,
              unitPrice: itemData.unitPrice,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        return await this.getOrderById(orderId);
      });
    } catch (error) {
      this.handleError(error, 'OrderService.addItemToOrder');
    }
  }

  /**
   * Update order item
   */
  async updateOrderItem(orderId: string, itemId: string, data: any, userId: string) {
    try {
      if (!orderId || !itemId) {
        throw new AppError('Order ID and Item ID are required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          throw new AppError('Order not found', 404);
        }

        if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
          throw new AppError(`Cannot update items in ${order.status.toLowerCase()} order`, 400);
        }

        const orderItem = await tx.orderItem.findUnique({
          where: { id: itemId },
          include: { product: true },
        });

        if (!orderItem) {
          throw new AppError('Order item not found', 404);
        }

        if (orderItem.orderId !== orderId) {
          throw new AppError('Order item does not belong to this order', 400);
        }

        // Update inventory reservation
        const inventory = await tx.inventory.findFirst({
          where: {
            productId: orderItem.productId,
            variantId: orderItem.variantId || null,
            businessUnitId: order.businessUnitId,
          },
        });

        if (inventory && data.quantity) {
          const quantityDiff = data.quantity - orderItem.quantity;
          if (quantityDiff > 0) {
            const availableStock = inventory.quantity - inventory.reserved;
            if (availableStock < quantityDiff) {
              throw new AppError(`Insufficient stock. Available: ${availableStock}`, 400);
            }
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                reserved: { increment: quantityDiff },
                available: { decrement: quantityDiff },
              },
            });
          } else if (quantityDiff < 0) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                reserved: { decrement: Math.abs(quantityDiff) },
                available: { increment: Math.abs(quantityDiff) },
              },
            });
          }
        }

        // Update order item
        const updatedItem = await tx.orderItem.update({
          where: { id: itemId },
          data: {
            quantity: data.quantity,
            unitPrice: data.unitPrice,
            discount: data.discount,
            notes: data.notes,
            total: (data.quantity * data.unitPrice) - (data.discount || 0),
          },
        });

        // Update order totals
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: order.id },
        });

        const newSubtotal = orderItems.reduce((sum: number, item: any) => sum + item.total, 0);
        const newTotal = newSubtotal + order.tax - order.discount;

        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: newSubtotal,
            total: newTotal,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'ORDER_ITEM',
            entityId: itemId,
            userId: userId,
            entityName: order.orderNumber,
            changes: {
              oldQuantity: orderItem.quantity,
              newQuantity: data.quantity,
              oldUnitPrice: orderItem.unitPrice,
              newUnitPrice: data.unitPrice,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        return await this.getOrderById(orderId);
      });
    } catch (error) {
      this.handleError(error, 'OrderService.updateOrderItem');
    }
  }

  /**
   * Remove order item
   */
  async removeOrderItem(orderId: string, itemId: string, userId: string) {
    try {
      if (!orderId || !itemId) {
        throw new AppError('Order ID and Item ID are required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
        });

        if (!order) {
          throw new AppError('Order not found', 404);
        }

        if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
          throw new AppError(`Cannot remove items from ${order.status.toLowerCase()} order`, 400);
        }

        const orderItem = await tx.orderItem.findUnique({
          where: { id: itemId },
        });

        if (!orderItem) {
          throw new AppError('Order item not found', 404);
        }

        if (orderItem.orderId !== orderId) {
          throw new AppError('Order item does not belong to this order', 400);
        }

        // Release reserved inventory
        const inventory = await tx.inventory.findFirst({
          where: {
            productId: orderItem.productId,
            variantId: orderItem.variantId || null,
            businessUnitId: order.businessUnitId,
          },
        });

        if (inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              reserved: { decrement: orderItem.quantity },
              available: { increment: orderItem.quantity },
            },
          });
        }

        // Delete order item
        await tx.orderItem.delete({
          where: { id: itemId },
        });

        // Update order totals
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: order.id },
        });

        const newSubtotal = orderItems.reduce((sum: number, item: any) => sum + item.total, 0);
        const newTotal = newSubtotal + order.tax - order.discount;

        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: newSubtotal,
            total: newTotal,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'DELETE',
            entityType: 'ORDER_ITEM',
            entityId: itemId,
            userId: userId,
            entityName: order.orderNumber,
            changes: {
              productId: orderItem.productId,
              quantity: orderItem.quantity,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        return await this.getOrderById(orderId);
      });
    } catch (error) {
      this.handleError(error, 'OrderService.removeOrderItem');
    }
  }

  /**
   * Convert order to sale
   */
  async convertOrderToSale(orderId: string, userId: string) {
    try {
      if (!orderId) {
        throw new AppError('Order ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            customer: true,
            payment: true,
          },
        });

        if (!order) {
          throw new AppError('Order not found', 404);
        }

        if (order.status === 'COMPLETED') {
          throw new AppError('Order is already completed', 400);
        }

        if (order.status === 'CANCELLED') {
          throw new AppError('Cancelled orders cannot be converted to sale', 400);
        }

        // Generate receipt number
        let receiptNumber: string;
        let counter = 0;
        do {
          receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          counter++;
          if (counter > 100) {
            throw new AppError('Failed to generate unique receipt number', 500);
          }
        } while (await tx.sale.findUnique({ where: { receiptNumber } }));

        // Create sale
        const sale = await tx.sale.create({
          data: {
            receiptNumber,
            subtotal: order.subtotal,
            tax: order.tax,
            discount: order.discount,
            total: order.total,
            paidAmount: order.payment?.amount || order.total,
            changeAmount: 0,
            notes: `Converted from order ${order.orderNumber}`,
            businessUnitId: order.businessUnitId,
            userId,
            customerId: order.customerId,
            orderId: order.id,
            status: 'COMPLETED',
            saleDate: new Date(),
          },
        });

        // Create sale items
        for (const item of order.items) {
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.total,
              notes: item.notes,
            },
          });
        }

        // Update order status
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'COMPLETED',
            saleId: sale.id,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'SALE',
            entityId: sale.id,
            userId: userId,
            entityName: receiptNumber,
            changes: {
              orderId: orderId,
              orderNumber: order.orderNumber,
              total: sale.total,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        this.safeEmitOrderStatusChange(orderId, 'COMPLETED', order.businessUnitId);

        return sale;
      });
    } catch (error) {
      this.handleError(error, 'OrderService.convertOrderToSale');
    }
  }

  /**
   * Get order history
   */
  async getOrderHistory(orderId: string) {
    try {
      if (!orderId) {
        throw new AppError('Order ID is required', 400);
      }

      const history = await this.prisma.auditLog.findMany({
        where: { 
          entityType: 'ORDER', 
          entityId: orderId,
        },
        include: {
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
      });

      return history;
    } catch (error) {
      this.handleError(error, 'OrderService.getOrderHistory');
    }
  }

  /**
   * Get order timeline
   */
  async getOrderTimeline(orderId: string) {
    try {
      if (!orderId) {
        throw new AppError('Order ID is required', 400);
      }

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          payment: true,
          sale: true,
        },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // Build timeline events
      const timeline: any[] = [
        {
          id: `created-${order.id}`,
          type: 'CREATED',
          title: 'Order Created',
          description: `Order ${order.orderNumber} was created`,
          timestamp: order.createdAt,
          user: order.user,
        },
      ];

      if (order.payment) {
        timeline.push({
          id: `payment-${order.payment.id}`,
          type: 'PAYMENT',
          title: 'Payment Recorded',
          description: `Payment of $${order.payment.amount} via ${order.payment.paymentMethod}`,
          timestamp: order.payment.processedAt || order.updatedAt,
          payment: order.payment,
        });
      }

      if (order.status === 'PROCESSING') {
        timeline.push({
          id: `processing-${order.id}`,
          type: 'PROCESSING',
          title: 'Order Processing',
          description: 'Order is being processed',
          timestamp: order.updatedAt,
        });
      }

      if (order.status === 'COMPLETED') {
        timeline.push({
          id: `completed-${order.id}`,
          type: 'COMPLETED',
          title: 'Order Completed',
          description: `Order ${order.orderNumber} was completed`,
          timestamp: order.updatedAt,
        });
      }

      if (order.status === 'CANCELLED') {
        timeline.push({
          id: `cancelled-${order.id}`,
          type: 'CANCELLED',
          title: 'Order Cancelled',
          description: `Order ${order.orderNumber} was cancelled`,
          timestamp: order.updatedAt,
        });
      }

      if (order.sale) {
        timeline.push({
          id: `sale-${order.sale.id}`,
          type: 'SALE',
          title: 'Converted to Sale',
          description: `Order converted to sale ${order.sale.receiptNumber}`,
          timestamp: order.sale.saleDate || order.updatedAt,
          sale: order.sale,
        });
      }

      // Sort by timestamp (oldest first)
      timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return timeline;
    } catch (error) {
      this.handleError(error, 'OrderService.getOrderTimeline');
    }
  }

  /**
   * Get orders by date range
   */
  async getOrdersByDateRange(params: {
    businessUnitId?: string;
    startDate: Date;
    endDate: Date;
  }) {
    try {
      const { businessUnitId, startDate, endDate } = params;

      if (startDate > endDate) {
        throw new AppError('Start date must be before end date', 400);
      }

      const where: any = {
        createdAt: { gte: startDate, lte: endDate },
        status: { not: 'DELETED' },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      return await this.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
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
                },
              },
            },
          },
          payment: true,
          sale: {
            select: {
              id: true,
              receiptNumber: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.handleError(error, 'OrderService.getOrdersByDateRange');
    }
  }

  /**
   * Bulk update order status
   */
  async bulkUpdateStatus(orderIds: string[], status: string, userId: string, notes?: string) {
    try {
      if (!orderIds || orderIds.length === 0) {
        throw new AppError('Order IDs are required', 400);
      }

      const result = await this.prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: {
          status: status as any,
          notes: notes 
            ? `${notes}\nBulk update at ${new Date().toISOString()}`
            : `Bulk update at ${new Date().toISOString()}`,
        },
      });

      // Create audit logs for each updated order
      for (const orderId of orderIds) {
        await this.prisma.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'ORDER',
            entityId: orderId,
            userId: userId,
            entityName: orderId,
            changes: {
              bulkStatusUpdate: status,
              notes: notes,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });
      }

      return {
        updated: result.count,
        failed: orderIds.length - result.count,
      };
    } catch (error) {
      this.handleError(error, 'OrderService.bulkUpdateStatus');
    }
  }

  /**
   * Delete order (soft delete)
   */
  async deleteOrder(orderId: string, userId: string) {
    try {
      // Use CANCELLED instead of DELETED if DELETED doesn't exist in enum
      return await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });
    } catch (error) {
      this.handleError(error, 'OrderService.deleteOrder');
    }
  }

  /**
   * Bulk delete orders
   */
  async bulkDeleteOrders(orderIds: string[], userId: string) {
    try {
      if (!orderIds || orderIds.length === 0) {
        throw new AppError('Order IDs are required', 400);
      }

      // Use CANCELLED instead of DELETED if DELETED doesn't exist in enum
      const result = await this.prisma.order.updateMany({
        where: { id: { in: orderIds } },
        data: { status: 'CANCELLED' },
      });

      return {
        deleted: result.count,
        failed: orderIds.length - result.count,
      };
    } catch (error) {
      this.handleError(error, 'OrderService.bulkDeleteOrders');
    }
  }

  /**
   * Get order analytics
   */
  async getOrderAnalytics(params: {
    businessUnitId?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    try {
      const { businessUnitId, startDate, endDate, groupBy = 'day' } = params;

      const where: any = {
        status: { not: 'DELETED' },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const orders = await this.prisma.order.findMany({
        where,
        include: {
          items: true,
          customer: true,
          payment: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const totalRevenue = orders.reduce((sum: number, o: any) => sum + o.total, 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Order status distribution
      const statusDistribution: Record<string, number> = {};
      orders.forEach((order: any) => {
        statusDistribution[order.status] = (statusDistribution[order.status] || 0) + 1;
      });

      // Daily/monthly trend
      const trend: Record<string, { revenue: number; count: number }> = {};
      orders.forEach((order: any) => {
        let key: string;
        const date = new Date(order.createdAt);
        switch (groupBy) {
          case 'day':
            key = date.toISOString().split('T')[0];
            break;
          case 'week': {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            break;
          }
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            key = date.toISOString().split('T')[0];
        }
        if (!trend[key]) trend[key] = { revenue: 0, count: 0 };
        trend[key].revenue += order.total;
        trend[key].count += 1;
      });

      // Customer insights
      const customerOrders: Record<string, { count: number; total: number }> = {};
      orders.forEach((order: any) => {
        const key = order.customerId || 'guest';
        if (!customerOrders[key]) customerOrders[key] = { count: 0, total: 0 };
        customerOrders[key].count += 1;
        customerOrders[key].total += order.total;
      });

      const returningCustomers = Object.values(customerOrders).filter(c => c.count > 1).length;
      const totalCustomers = Object.keys(customerOrders).filter(k => k !== 'guest').length;

      return {
        summary: {
          totalOrders,
          totalRevenue,
          averageOrderValue,
          totalCustomers,
          returningCustomers,
          repeatRate: totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0,
        },
        statusDistribution,
        trend: Object.entries(trend).map(([date, data]) => ({
          date,
          revenue: data.revenue,
          count: data.count,
          average: data.count > 0 ? data.revenue / data.count : 0,
        })),
        customerInsights: {
          totalCustomers,
          newCustomers: totalCustomers - returningCustomers,
          returningCustomers,
        },
        recentOrders: orders.slice(-5),
      };
    } catch (error) {
      this.handleError(error, 'OrderService.getOrderAnalytics');
    }
  }

  /**
   * Get order fulfillment status
   */
  async getOrderFulfillmentStatus(businessUnitId?: string) {
    try {
      const where: any = {
        status: { notIn: ['COMPLETED', 'CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const [pending, processing, onHold, total] = await Promise.all([
        this.prisma.order.count({ where: { ...where, status: 'PENDING' } }),
        this.prisma.order.count({ where: { ...where, status: 'PROCESSING' } }),
        this.prisma.order.count({ where: { ...where, status: 'ON_HOLD' } }),
        this.prisma.order.count({ where }),
      ]);

      return {
        pending,
        processing,
        onHold,
        total,
        completionRate: total > 0 ? ((total - pending) / total) * 100 : 0,
        status: total === 0 ? 'All Clear' : pending > 5 ? 'Heavy Load' : 'Normal',
      };
    } catch (error) {
      this.handleError(error, 'OrderService.getOrderFulfillmentStatus');
    }
  }
}

export default OrderService;
