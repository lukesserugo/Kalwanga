// src/services/purchaseOrderService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';

// Enhanced types
interface POItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

interface CreatePOData {
  supplierId: string;
  items: POItemInput[];
  notes?: string;
  expectedDelivery?: Date;
  businessUnitId: string;
  userId: string;
  paymentTerms?: string;
  shippingAddress?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

interface ReceivePOData {
  receivedQuantities: Array<{
    itemId: string;
    quantity: number;
    notes?: string;
    batchNumber?: string;
    expiryDate?: Date;
  }>;
}

// Fixed POResponse interface with null support
interface POResponse {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  notes?: string | null; // Fixed: Added null
  supplierId: string;
  businessUnitId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  expectedDelivery?: Date | null; // Fixed: Added null
  receivedAt?: Date | null; // Fixed: Added null
  cancelledAt?: Date | null; // Fixed: Added null
  items: any[];
  supplier?: any;
  user?: any;
  itemCount?: number;
  totalQuantity?: number;
  receivedQuantity?: number;
  supplierName?: string;
  supplierTotalOrders?: number;
}

export class PurchaseOrderService extends BaseService {
  /**
   * Get all purchase orders with comprehensive filtering
   */
  async getAllPurchaseOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: string;
    businessUnitId?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    priority?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        supplierId,
        businessUnitId,
        search,
        startDate,
        endDate,
        priority,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = params;

      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(100, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: Prisma.PurchaseOrderWhereInput = {
        ...(status && { status: status as any }),
        ...(supplierId && { supplierId }),
        ...(businessUnitId && { businessUnitId }),
        ...(priority && { priority: priority as any }),
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            lte: endDate,
          },
        }),
        ...(search && {
          OR: [
            { orderNumber: { contains: search, mode: 'insensitive' as const } },
            { supplier: { name: { contains: search, mode: 'insensitive' as const } } },
            { notes: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      };

      const validSortFields = ['createdAt', 'updatedAt', 'orderNumber', 'total', 'status', 'expectedDelivery'];
      const orderBy: any = validSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { createdAt: 'desc' };

      const [orders, total, stats] = await Promise.all([
        this.prisma.purchaseOrder.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy,
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
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
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: { items: true },
            },
          },
        }),
        this.prisma.purchaseOrder.count({ where }),
        this.getPOStats(where),
      ]);

      // Enhance orders with computed fields
      const enhancedOrders = orders.map((order: any) => ({
        ...order,
        itemCount: order._count?.items || 0,
        totalQuantity: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        receivedQuantity: order.items.reduce((sum: number, item: any) => sum + (item.receivedQuantity || 0), 0),
        supplierName: order.supplier?.name || 'Unknown Supplier',
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
      this.handleError(error, 'PurchaseOrderService.getAllPurchaseOrders');
    }
  }

  /**
   * Get purchase order statistics
   */
  private async getPOStats(where: Prisma.PurchaseOrderWhereInput) {
    try {
      const [statusCounts, totalValue, pendingCount, receivedCount, cancelledCount] = await Promise.all([
        this.prisma.purchaseOrder.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.purchaseOrder.aggregate({
          where,
          _sum: { total: true },
        }),
        this.prisma.purchaseOrder.count({
          where: { ...where, status: 'PENDING' },
        }),
        this.prisma.purchaseOrder.count({
          where: { ...where, status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] } },
        }),
        this.prisma.purchaseOrder.count({
          where: { ...where, status: 'CANCELLED' },
        }),
      ]);

      return {
        totalValue: totalValue._sum.total || 0,
        pendingCount,
        receivedCount,
        cancelledCount,
        statusBreakdown: statusCounts.map((s: any) => ({
          status: s.status,
          count: s._count._all,
        })),
      };
    } catch (error) {
      logger.warn('Failed to get PO stats:', error);
      return {
        totalValue: 0,
        pendingCount: 0,
        receivedCount: 0,
        cancelledCount: 0,
        statusBreakdown: [],
      };
    }
  }

  /**
   * Get purchase order by ID with full details
   */
  async getPurchaseOrderById(id: string): Promise<POResponse> {
    try {
      if (!id) {
        throw new AppError('Purchase order ID is required', 400);
      }

      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: {
            include: {
              _count: {
                select: {
                  purchaseOrders: true,
                  products: true,
                },
              },
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
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          businessUnit: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      });

      if (!po) {
        throw new AppError('Purchase order not found', 404);
      }

      return {
        ...po,
        itemCount: po._count?.items || 0,
        totalQuantity: po.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        receivedQuantity: po.items.reduce((sum: number, item: any) => sum + (item.receivedQuantity || 0), 0),
        supplierName: po.supplier?.name || 'Unknown Supplier',
        supplierTotalOrders: po.supplier?._count?.purchaseOrders || 0,
      };
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.getPurchaseOrderById');
    }
  }

  /**
   * Get purchase order by number
   */
  async getPurchaseOrderByNumber(orderNumber: string) {
    try {
      if (!orderNumber) {
        throw new AppError('Order number is required', 400);
      }

      const po = await this.prisma.purchaseOrder.findUnique({
        where: { orderNumber },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!po) {
        throw new AppError('Purchase order not found', 404);
      }

      return po;
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.getPurchaseOrderByNumber');
    }
  }

  /**
   * Create purchase order with comprehensive validation
   */
  async createPurchaseOrder(data: CreatePOData): Promise<any> {
    try {
      // Validate required fields
      if (!data.supplierId) {
        throw new AppError('Supplier ID is required', 400);
      }
      if (!data.items || data.items.length === 0) {
        throw new AppError('At least one item is required', 400);
      }
      if (!data.businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (!data.userId) {
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

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Verify supplier exists
        const supplier = await tx.supplier.findUnique({
          where: { id: data.supplierId },
        });

        if (!supplier) {
          throw new AppError('Supplier not found', 404);
        }

        if (!supplier.isActive) {
          throw new AppError('Supplier is not active', 400);
        }

        // Verify business unit exists
        const businessUnit = await tx.businessUnit.findUnique({
          where: { id: data.businessUnitId },
        });

        if (!businessUnit) {
          throw new AppError('Business unit not found', 404);
        }

        // Generate unique order number
        const orderNumber = await this.generateUniqueOrderNumber(tx);

        // Calculate totals
        const subtotal = data.items.reduce((sum: number, item: POItemInput) => sum + (item.quantity * item.unitPrice), 0);
        const taxRate = 0.18; // 18% VAT default
        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        // Create purchase order
        const po = await tx.purchaseOrder.create({
          data: {
            orderNumber,
            supplierId: data.supplierId,
            status: 'PENDING',
            priority: data.priority || 'MEDIUM',
            subtotal,
            tax,
            total,
            notes: data.notes,
            expectedDelivery: data.expectedDelivery,
            paymentTerms: data.paymentTerms,
            shippingAddress: data.shippingAddress,
            businessUnitId: data.businessUnitId,
            userId: data.userId,
          },
          include: {
            supplier: true,
            items: true,
          },
        });

        // Create PO items
        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new AppError(`Product ${item.productId} not found`, 404);
          }

          await tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: po.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
              receivedQuantity: 0,
              notes: item.notes,
            },
          });
        }

        // Create audit log (simplified - removed changes field)
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'PURCHASE_ORDER',
            entityId: po.id,
            entityName: orderNumber,
            userId: data.userId,
            businessUnitId: data.businessUnitId,
          } as any,
        });

        // Get complete PO with items
        const completePO = await tx.purchaseOrder.findUnique({
          where: { id: po.id },
          include: {
            supplier: true,
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
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        // Emit realtime event
        try {
          (realtimeService as any).emitPurchaseOrderCreated?.(completePO, data.businessUnitId);
        } catch (wsError) {
          logger.warn('Failed to emit PO created event:', wsError);
        }

        // Send notification
        try {
          await notificationService.sendPurchaseOrderNotification(
            data.businessUnitId,
            orderNumber,
            supplier.name,
            total
          );
        } catch (notifError) {
          logger.warn('Failed to send PO notification:', notifError);
        }

        return completePO;
      });
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.createPurchaseOrder');
    }
  }

  /**
   * Generate unique order number
   */
  private async generateUniqueOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    let orderNumber: string;
    let counter = 0;

    do {
      orderNumber = `PO-${Date.now().toString().slice(-8)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      counter++;
      if (counter > 100) {
        throw new AppError('Failed to generate unique order number', 500);
      }
    } while (await tx.purchaseOrder.findUnique({ where: { orderNumber } }));

    return orderNumber;
  }

  /**
   * Update purchase order
   */
  async updatePurchaseOrder(id: string, data: any, userId: string) {
    try {
      if (!id) {
        throw new AppError('Purchase order ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const po = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!po) {
          throw new AppError('Purchase order not found', 404);
        }

        if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
          throw new AppError(`Cannot update purchase order with status: ${po.status}`, 400);
        }

        const { id: _, createdAt, updatedAt, ...updateData } = data;

        const updatedPO = await tx.purchaseOrder.update({
          where: { id },
          data: {
            ...updateData,
            updatedAt: new Date(),
          },
          include: {
            supplier: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        // Create audit log (simplified)
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'PURCHASE_ORDER',
            entityId: id,
            entityName: po.orderNumber,
            userId,
            businessUnitId: po.businessUnitId,
          } as any,
        });

        return updatedPO;
      });
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.updatePurchaseOrder');
    }
  }

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(id: string, userId: string, reason?: string) {
    try {
      if (!id) {
        throw new AppError('Purchase order ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const po = await tx.purchaseOrder.findUnique({
          where: { id },
          include: {
            supplier: true,
            items: true,
          },
        });

        if (!po) {
          throw new AppError('Purchase order not found', 404);
        }

        if (po.status === 'RECEIVED') {
          throw new AppError('Cannot cancel received purchase order', 400);
        }

        if (po.status === 'CANCELLED') {
          throw new AppError('Purchase order is already cancelled', 400);
        }

        const cancelledPO = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledBy: userId,
            cancelReason: reason || 'No reason provided',
            notes: po.notes
              ? `${po.notes}\nCancelled: ${reason || 'No reason provided'}`
              : `Cancelled: ${reason || 'No reason provided'}`,
          },
          include: {
            supplier: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        // Create audit log (simplified)
        await tx.auditLog.create({
          data: {
            action: 'CANCEL',
            entityType: 'PURCHASE_ORDER',
            entityId: id,
            entityName: po.orderNumber,
            userId,
            businessUnitId: po.businessUnitId,
          } as any,
        });

        try {
          (realtimeService as any).emitPurchaseOrderCreated?.(cancelledPO, po.businessUnitId);
        } catch (wsError) {
          logger.warn('Failed to emit PO cancelled event:', wsError);
        }

        return cancelledPO;
      });
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.cancelPurchaseOrder');
    }
  }

  /**
   * Receive purchase order (update inventory)
   */
  async receivePurchaseOrder(id: string, data: ReceivePOData, businessUnitId: string, userId: string) {
    try {
      if (!id) {
        throw new AppError('Purchase order ID is required', 400);
      }
      if (!data.receivedQuantities || data.receivedQuantities.length === 0) {
        throw new AppError('At least one received quantity is required', 400);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const po = await tx.purchaseOrder.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            supplier: true,
          },
        });

        if (!po) {
          throw new AppError('Purchase order not found', 404);
        }

        if (po.status === 'CANCELLED') {
          throw new AppError('Cannot receive cancelled purchase order', 400);
        }

        if (po.status === 'RECEIVED') {
          throw new AppError('Purchase order already received', 400);
        }

        for (const received of data.receivedQuantities) {
          const poItem = po.items.find((item: any) => item.id === received.itemId);
          
          if (!poItem) {
            throw new AppError(`Item ${received.itemId} not found in purchase order`, 400);
          }

          const remainingToReceive = poItem.quantity - (poItem.receivedQuantity || 0);
          if (received.quantity > remainingToReceive) {
            throw new AppError(
              `Cannot receive ${received.quantity} for item ${poItem.product.name}. Remaining: ${remainingToReceive}`,
              400
            );
          }

          let inventory = await tx.inventory.findFirst({
            where: {
              productId: poItem.productId,
              variantId: poItem.variantId || null,
              businessUnitId,
            },
          });

          let inventoryId: string;

          if (inventory) {
            const updatedInventory = await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: { increment: received.quantity },
                lastUpdated: new Date(),
              },
            });
            inventoryId = updatedInventory.id;
          } else {
            const product = await tx.product.findUnique({
              where: { id: poItem.productId },
            });

            const newInventory = await tx.inventory.create({
              data: {
                productId: poItem.productId,
                variantId: poItem.variantId || null,
                businessUnitId,
                quantity: received.quantity,
                reserved: 0,
                reorderPoint: product?.minStock || 5,
                reorderQuantity: Math.max(product?.minStock || 5, 10),
                location: 'Warehouse',
              },
            });
            inventoryId = newInventory.id;
          }

          await tx.inventoryTransaction.create({
            data: {
              transactionType: 'PURCHASE' as any,
              quantity: received.quantity,
              notes: `Received from PO ${po.orderNumber}${received.notes ? ` - ${received.notes}` : ''}`,
              reference: po.orderNumber,
              productId: poItem.productId,
              variantId: poItem.variantId || null,
              inventoryId,
              businessUnitId,
              userId,
              purchaseOrderId: po.id,
              transactionDate: new Date(),
            },
          });

          await tx.purchaseOrderItem.update({
            where: { id: received.itemId },
            data: {
              receivedQuantity: { increment: received.quantity },
            } as any,
          });

          try {
            (realtimeService as any).emitInventoryUpdated?.(
              { productId: poItem.productId, quantity: received.quantity },
              businessUnitId
            );
          } catch (wsError) {
            logger.warn('Failed to emit inventory update:', wsError);
          }
        }

        const updatedItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: id },
        });

        const allReceived = updatedItems.every((item: any) => 
          (item.receivedQuantity || 0) >= item.quantity
        );

        const finalPO = await tx.purchaseOrder.update({
          where: { id },
          data: {
            status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
            receivedAt: allReceived ? new Date() : null,
            receivedBy: userId,
          },
          include: {
            supplier: true,
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

        // Create audit log (simplified)
        await tx.auditLog.create({
          data: {
            action: 'RECEIVE',
            entityType: 'PURCHASE_ORDER',
            entityId: id,
            entityName: po.orderNumber,
            userId,
            businessUnitId,
          } as any,
        });

        try {
          (realtimeService as any).emitPurchaseOrderReceived?.(finalPO, businessUnitId);
        } catch (wsError) {
          logger.warn('Failed to emit PO received event:', wsError);
        }

        return finalPO;
      });
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.receivePurchaseOrder');
    }
  }

  /**
   * Get purchase orders by supplier
   */
  async getPurchaseOrdersBySupplier(supplierId: string, params?: { page?: number; limit?: number }) {
    try {
      const { page = 1, limit = 20 } = params || {};
      const skip = (page - 1) * limit;

      const [orders, total] = await Promise.all([
        this.prisma.purchaseOrder.findMany({
          where: { supplierId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
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
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        this.prisma.purchaseOrder.count({ where: { supplierId } }),
      ]);

      return {
        orders,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.getPurchaseOrdersBySupplier');
    }
  }

  /**
   * Get purchase orders by product
   */
  async getPurchaseOrdersByProduct(productId: string) {
    try {
      const orders = await this.prisma.purchaseOrder.findMany({
        where: {
          items: {
            some: { productId },
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            where: { productId },
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
        orderBy: { createdAt: 'desc' },
      });

      return orders;
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.getPurchaseOrdersByProduct');
    }
  }

  /**
   * Get pending purchase orders
   */
  async getPendingPurchaseOrders(businessUnitId: string) {
    try {
      return await this.prisma.purchaseOrder.findMany({
        where: {
          businessUnitId,
          status: 'PENDING',
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
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
        orderBy: { expectedDelivery: 'asc' },
      });
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.getPendingPurchaseOrders');
    }
  }

  /**
   * Get purchase order summary
   */
  async getPurchaseOrderSummary(businessUnitId: string, startDate?: Date, endDate?: Date) {
    try {
      const where: Prisma.PurchaseOrderWhereInput = {
        businessUnitId,
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            lte: endDate,
          },
        }),
      };

      const [total, pending, received, cancelled, totalValue] = await Promise.all([
        this.prisma.purchaseOrder.count({ where }),
        this.prisma.purchaseOrder.count({ where: { ...where, status: 'PENDING' } }),
        this.prisma.purchaseOrder.count({ where: { ...where, status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] } } }),
        this.prisma.purchaseOrder.count({ where: { ...where, status: 'CANCELLED' } }),
        this.prisma.purchaseOrder.aggregate({
          where,
          _sum: { total: true },
        }),
      ]);

      return {
        total,
        pending,
        received,
        cancelled,
        totalValue: totalValue._sum.total || 0,
      };
    } catch (error) {
      this.handleError(error, 'PurchaseOrderService.getPurchaseOrderSummary');
    }
  }
}

export const purchaseOrderService = new PurchaseOrderService();
