// src/services/saleService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateReceiptNumber, calculateTotal, calculateTax } from '../utils/helpers.js';
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface SaleItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  notes?: string;
}

interface CreateSaleData {
  items: SaleItemInput[];
  customerId?: string;
  paymentMethod: string;
  paidAmount?: number;
  discount?: number;
  taxRate?: number;
  notes?: string;
  businessUnitId: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  tipAmount?: number;
  loyaltyPointsUsed?: number;
}

interface SalePaymentData {
  paymentMethod: string;
  paidAmount: number;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  tipAmount?: number;
  applyLoyaltyPoints?: boolean;
}

interface SalesStatsResult {
  totalSales: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  averageTicket: number;
  topProducts: any[];
  totalItemsSold: number;
  totalCustomers: number;
  averageItemsPerSale: number;
}

interface ReturnItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  reason?: string;
}

interface RefundItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  reason?: string;
}

// ============================================
// SALE SERVICE CLASS
// ============================================

export class SaleService extends BaseService {
  /**
   * Safely emit new sale event
   */
  private safeEmitNewSale(sale: any, businessUnitId: string): void {
    try {
      logger.info(`💰 New sale: ${sale?.receiptNumber || sale?.id} - ${businessUnitId}`);
      (realtimeService as any).emitSaleCreated?.(sale, businessUnitId);
    } catch (error) {
      logger.warn('Failed to emit sale event:', error);
    }
  }

  /**
   * Safely emit sale update event
   */
  private safeEmitSaleUpdate(sale: any, businessUnitId: string): void {
    try {
      (realtimeService as any).emitSaleUpdated?.(sale, businessUnitId);
    } catch (error) {
      logger.warn('Failed to emit sale update event:', error);
    }
  }

  /**
   * Generate unique sale number
   */
  private generateSaleNumber(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `SALE-${timestamp}-${random}`;
  }

  /**
   * Validate stock availability
   */
  private async validateStock(
    tx: any,
    items: SaleItemInput[],
    businessUnitId: string
  ): Promise<void> {
    for (const item of items) {
      const inventory = await tx.inventory.findFirst({
        where: {
          productId: item.productId,
          variantId: item.variantId || null,
          businessUnitId: businessUnitId,
        },
      });

      if (!inventory) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        throw new AppError(
          `No inventory found for product: ${product?.name || item.productId}`,
          400
        );
      }

      const availableStock = inventory.quantity - inventory.reserved;
      if (availableStock < item.quantity) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        throw new AppError(
          `Insufficient stock for ${product?.name || item.productId}. Available: ${availableStock}, Requested: ${item.quantity}`,
          400
        );
      }
    }
  }

  /**
   * Update inventory for sale
   */
  private async updateInventoryForSale(
    tx: any,
    items: SaleItemInput[],
    businessUnitId: string,
    userId: string,
    saleId: string,
    receiptNumber: string
  ): Promise<void> {
    for (const item of items) {
      const inventory = await tx.inventory.findFirst({
        where: {
          productId: item.productId,
          variantId: item.variantId || null,
          businessUnitId: businessUnitId,
        },
      });

      if (inventory) {
        const newQuantity = inventory.quantity - item.quantity;
        const newReserved = Math.max(0, inventory.reserved - Math.min(item.quantity, inventory.reserved));

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: newQuantity,
            reserved: newReserved,
            available: newQuantity - newReserved,
            updatedAt: new Date(),
          },
        });

        // Create inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'SALE',
            quantity: -item.quantity,
            notes: `Sale ${receiptNumber}`,
            productId: item.productId,
            variantId: item.variantId || null,
            inventoryId: inventory.id,
            businessUnitId: businessUnitId,
            userId: userId,
            saleId: saleId,
            createdAt: new Date(),
          },
        });

        // Check for low stock alert
        if (newQuantity <= inventory.reorderPoint) {
          try {
            await notificationService.createNotification({
              title: 'Low Stock Alert',
              message: `Product ${item.productId} is running low. Current stock: ${newQuantity}`,
              type: 'INVENTORY',
              userId: userId,
              businessUnitId: businessUnitId,
            });
          } catch (notifError) {
            logger.warn('Failed to create low stock notification:', notifError);
          }
        }
      }
    }
  }

  /**
   * Create payment for sale
   */
  private async createSalePayment(
    tx: any,
    saleId: string,
    userId: string,
    paymentData: {
      paymentMethod: string;
      paidAmount: number;
      cashRegisterId?: string;
      cashRegisterSessionId?: string;
      reference?: string;
    }
  ): Promise<any> {
    return await tx.payment.create({
      data: {
        amount: paymentData.paidAmount,
        paymentMethod: paymentData.paymentMethod as any,
        status: 'PAID',
        saleId: saleId,
        userId: userId,
        cashRegisterId: paymentData.cashRegisterId,
        cashRegisterSessionId: paymentData.cashRegisterSessionId,
        processedAt: new Date(),
        reference: paymentData.reference || `PAY-${Date.now()}`,
      },
    });
  }

  /**
   * Update customer loyalty
   */
  private async updateCustomerLoyalty(
    tx: any,
    customerId: string,
    saleId: string,
    userId: string,
    total: number,
    receiptNumber: string,
    loyaltyPointsUsed: number = 0
  ): Promise<void> {
    const loyaltyPointsEarned = Math.floor(total / 10);

    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: {
        totalSpent: { increment: total },
        lastPurchaseAt: new Date(),
        loyaltyPoints: { increment: loyaltyPointsEarned - loyaltyPointsUsed },
        loyaltyLevel: this.calculateLoyaltyLevel((customer?.totalSpent || 0) + total),
      },
    });

    // Record loyalty history
    if (loyaltyPointsEarned > 0) {
      await tx.loyaltyHistory.create({
        data: {
          customerId: customerId,
          points: loyaltyPointsEarned,
          type: 'EARN',
          notes: `Purchase: ${receiptNumber}`,
          saleId: saleId,
          userId: userId,
          createdAt: new Date(),
        },
      });
    }

    if (loyaltyPointsUsed > 0) {
      await tx.loyaltyHistory.create({
        data: {
          customerId: customerId,
          points: -loyaltyPointsUsed,
          type: 'REDEEM',
          notes: `Redeemed for purchase: ${receiptNumber}`,
          saleId: saleId,
          userId: userId,
          createdAt: new Date(),
        },
      });
    }
  }

  /**
   * Calculate loyalty level based on total spent
   */
  private calculateLoyaltyLevel(totalSpent: number): string {
    if (totalSpent >= 10000) return 'DIAMOND';
    if (totalSpent >= 5000) return 'PLATINUM';
    if (totalSpent >= 2000) return 'GOLD';
    if (totalSpent >= 500) return 'SILVER';
    return 'BRONZE';
  }

  /**
   * Create audit log - Override BaseService method
   * This matches the BaseService signature which expects a single object parameter
   */
  protected async createAuditLog(data: {
    action: string;
    entityType: string;
    entityId: string;
    entityName?: string;
    changes?: any;
    userId?: string;
    severity?: string;
    businessUnitId?: string;
    companyId?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: data.action as any,
        entityType: data.entityType as any,
        entityId: data.entityId,
        userId: data.userId || '',
        entityName: data.entityName || '',
        changes: data.changes || {},
        severity: (data.severity || 'INFO') as any,
        businessUnitId: data.businessUnitId,
        companyId: data.companyId,
        createdAt: new Date(),
      },
    });
  }

  /**
   * Helper method to create audit log with transaction support
   */
  private async createAuditLogWithTx(
    tx: any,
    action: string,
    entityId: string,
    userId: string,
    entityName: string,
    changes: any,
    severity: string = 'INFO'
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: action as any,
        entityType: 'SALE',
        entityId: entityId,
        userId: userId,
        entityName: entityName,
        changes: changes,
        severity: severity as any,
        createdAt: new Date(),
      },
    });
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Get all sales with pagination and filters
   */
  async getAllSales(params: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    customerId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    minAmount?: number;
    maxAmount?: number;
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
        startDate,
        endDate,
        status,
        paymentMethod,
        sortBy = 'saleDate',
        sortOrder = 'desc',
        minAmount,
        maxAmount,
        includeDeleted = false,
      } = params;

      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(200, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = {};

      if (businessUnitId) {
        where.businessUnitId = businessUnitId;
      }

      if (customerId) {
        where.customerId = customerId;
      }

      if (userId) {
        where.userId = userId;
      }

      if (status) {
        where.status = status as any;
      }

      if (minAmount !== undefined) {
        where.total = { gte: minAmount };
      }
      if (maxAmount !== undefined) {
        where.total = { ...(where.total as any), lte: maxAmount };
      }

      if (startDate || endDate) {
        where.saleDate = {};
        if (startDate) where.saleDate.gte = startDate;
        if (endDate) where.saleDate.lte = endDate;
      }

      if (paymentMethod) {
        where.payments = {
          some: { paymentMethod: paymentMethod as any },
        };
      }

      if (search) {
        where.OR = [
          { receiptNumber: { contains: search, mode: 'insensitive' } },
          { customer: { firstName: { contains: search, mode: 'insensitive' } } },
          { customer: { lastName: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (!includeDeleted) {
        where.status = { not: 'DELETED' };
      }

      const validSortFields = ['saleDate', 'createdAt', 'total', 'receiptNumber', 'status'];
      const orderBy: any = validSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { saleDate: 'desc' };

      const [sales, total, stats] = await Promise.all([
        this.prisma.sale.findMany({
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
                    images: true,
                    barcode: true,
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
            payments: {
              select: {
                id: true,
                paymentMethod: true,
                amount: true,
                status: true,
                reference: true,
              },
            },
            cashRegister: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            cashRegisterSession: {
              select: {
                id: true,
                openedAt: true,
                status: true,
              },
            },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
              },
            },
            receipt: {
              select: {
                id: true,
                receiptNumber: true,
                status: true,
              },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
              },
            },
            returns: {
              select: {
                id: true,
                returnNumber: true,
                status: true,
              },
            },
            refunds: {
              select: {
                id: true,
                refundNumber: true,
                status: true,
              },
            },
            _count: {
              select: { items: true },
            },
          },
        }),
        this.prisma.sale.count({ where }),
        this.getSalesStats({ businessUnitId, startDate, endDate }),
      ]);

      const enhancedSales = sales.map((sale: any) => ({
        ...sale,
        itemCount: sale._count?.items || 0,
        totalQuantity: sale.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        customerName: sale.customer
          ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
          : 'Guest',
        cashierName: sale.user
          ? `${sale.user.firstName} ${sale.user.lastName}`.trim()
          : 'Unknown',
        paymentMethod: sale.payments?.[0]?.paymentMethod || 'N/A',
        paymentStatus: sale.payments?.[0]?.status || 'N/A',
        hasReturns: (sale.returns?.length || 0) > 0,
        hasRefunds: (sale.refunds?.length || 0) > 0,
      }));

      return {
        sales: enhancedSales,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
        stats,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getAllSales');
    }
  }

  /**
   * Get sale by ID with full details
   */
  async getSaleById(id: string) {
    try {
      if (!id) {
        throw new AppError('Sale ID is required', 400);
      }

      const sale = await this.prisma.sale.findUnique({
        where: { id },
        include: {
          customer: {
            include: {
              _count: {
                select: { sales: true },
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
                  attributes: true,
                },
              },
            },
          },
          payments: {
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
          cashRegister: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          cashRegisterSession: {
            select: {
              id: true,
              openedAt: true,
              closedAt: true,
              status: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              total: true,
              balanceDue: true,
              dueDate: true,
            },
          },
          receipt: {
            select: {
              id: true,
              receiptNumber: true,
              status: true,
              format: true,
              sentAt: true,
              printedAt: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              total: true,
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
          returns: {
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
          },
          refunds: {
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
          },
          inventoryTransactions: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
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
          },
          _count: {
            select: { items: true },
          },
        },
      });

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      const totalQuantity = sale.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
      const totalReturns = sale.returns?.reduce((sum: number, r: any) => 
        sum + r.items.reduce((s: number, i: any) => s + i.quantity, 0), 0) || 0;
      const totalRefunds = sale.refunds?.reduce((sum: number, r: any) => 
        sum + r.items.reduce((s: number, i: any) => s + i.quantity, 0), 0) || 0;

      return {
        ...sale,
        itemCount: sale._count?.items || 0,
        totalQuantity,
        totalReturns,
        totalRefunds,
        customerName: sale.customer
          ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
          : 'Guest',
        customerTotalPurchases: sale.customer?._count?.sales || 0,
        hasReturns: (sale.returns?.length || 0) > 0,
        hasRefunds: (sale.refunds?.length || 0) > 0,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSaleById');
    }
  }

  /**
   * Get sale by receipt number
   */
  async getSaleByReceiptNumber(receiptNumber: string) {
    try {
      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const sale = await this.prisma.sale.findUnique({
        where: { receiptNumber },
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
                  unitPrice: true,
                  barcode: true,
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
          payments: {
            select: {
              id: true,
              paymentMethod: true,
              amount: true,
              status: true,
              reference: true,
              processedAt: true,
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
          cashRegister: {
            select: {
              id: true,
              name: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
            },
          },
          receipt: {
            select: {
              id: true,
              receiptNumber: true,
              status: true,
            },
          },
        },
      });

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      return {
        ...sale,
        customerName: sale.customer
          ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
          : 'Guest',
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSaleByReceiptNumber');
    }
  }

  /**
   * Create a new sale (legacy direct sale)
   */
  async createSale(data: CreateSaleData, userId: string) {
    try {
      if (!data.items || data.items.length === 0) {
        throw new AppError('At least one item is required', 400);
      }
      if (!data.businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (!data.paymentMethod) {
        throw new AppError('Payment method is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        await this.validateStock(tx, data.items, data.businessUnitId);

        const receiptNumber = generateReceiptNumber();
        const subtotal = calculateTotal(data.items);
        const taxRate = data.taxRate || 0;
        const tax = calculateTax(subtotal, taxRate);
        const discount = data.discount || 0;
        const tipAmount = data.tipAmount || 0;
        const loyaltyDiscount = data.loyaltyPointsUsed ? data.loyaltyPointsUsed * 0.1 : 0;
        const total = subtotal + tax - discount - loyaltyDiscount + tipAmount;
        const paidAmount = data.paidAmount || total;
        const changeAmount = Math.max(0, paidAmount - total);

        const sale = await tx.sale.create({
          data: {
            receiptNumber,
            subtotal,
            tax,
            discount: discount + loyaltyDiscount,
            total,
            paidAmount,
            changeAmount,
            notes: data.notes,
            businessUnitId: data.businessUnitId,
            userId,
            customerId: data.customerId,
            cashRegisterId: data.cashRegisterId,
            cashRegisterSessionId: data.cashRegisterSessionId,
            status: 'COMPLETED',
            saleDate: new Date(),
          },
        });

        for (const item of data.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new AppError(`Product ${item.productId} not found`, 404);
          }

          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: (item.quantity * item.unitPrice) - (item.discount || 0),
              notes: item.notes,
            },
          });
        }

        await this.updateInventoryForSale(
          tx,
          data.items,
          data.businessUnitId,
          userId,
          sale.id,
          receiptNumber
        );

        await this.createSalePayment(tx, sale.id, userId, {
          paymentMethod: data.paymentMethod,
          paidAmount: paidAmount,
          cashRegisterId: data.cashRegisterId,
          cashRegisterSessionId: data.cashRegisterSessionId,
          reference: `PAY-${receiptNumber}`,
        });

        if (data.customerId) {
          await this.updateCustomerLoyalty(
            tx,
            data.customerId,
            sale.id,
            userId,
            total,
            receiptNumber,
            data.loyaltyPointsUsed || 0
          );
        }

        await this.createAuditLogWithTx(
          tx,
          'CREATE',
          sale.id,
          userId,
          receiptNumber,
          {
            total,
            items: data.items.length,
            paymentMethod: data.paymentMethod,
          },
          'INFO'
        );

        this.safeEmitNewSale(sale, data.businessUnitId);

        return sale;
      });
    } catch (error) {
      this.handleError(error, 'SaleService.createSale');
    }
  }

  /**
   * Create sale from cart checkout
   */
  async createSaleFromCart(
    cartId: string,
    userId: string,
    paymentData: SalePaymentData
  ) {
    try {
      if (!cartId) {
        throw new AppError('Cart ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const cart = await tx.cart.findUnique({
          where: { id: cartId },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    inventory: true,
                  },
                },
                variant: true,
              },
            },
            customer: true,
          },
        });

        if (!cart) {
          throw new AppError('Cart not found', 404);
        }

        if (cart.items.length === 0) {
          throw new AppError('Cart is empty', 400);
        }

        let total = cart.total;
        let loyaltyPointsUsed = 0;
        let loyaltyDiscount = 0;

        if (paymentData.applyLoyaltyPoints && cart.customerId) {
          const customer = await tx.customer.findUnique({
            where: { id: cart.customerId },
          });

          if (customer && (customer.loyaltyPoints || 0) > 0) {
            const maxPoints = Math.min(
              customer.loyaltyPoints || 0,
              Math.floor(total / 0.1)
            );
            loyaltyPointsUsed = maxPoints;
            loyaltyDiscount = maxPoints * 0.1;
            total -= loyaltyDiscount;
          }
        }

        const saleItems = cart.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));
        await this.validateStock(tx, saleItems, cart.businessUnitId);

        const receiptNumber = generateReceiptNumber();
        const paidAmount = paymentData.paidAmount || total;
        const changeAmount = Math.max(0, paidAmount - total);

        const sale = await tx.sale.create({
          data: {
            receiptNumber,
            subtotal: cart.subtotal,
            tax: cart.tax,
            discount: cart.discount + loyaltyDiscount,
            total,
            paidAmount,
            changeAmount,
            notes: `Checkout from cart: ${cartId}`,
            businessUnitId: cart.businessUnitId,
            userId,
            customerId: cart.customerId,
            cashRegisterId: paymentData.cashRegisterId,
            cashRegisterSessionId: paymentData.cashRegisterSessionId,
            status: 'COMPLETED',
            saleDate: new Date(),
          },
        });

        for (const cartItem of cart.items) {
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: cartItem.productId,
              variantId: cartItem.variantId || null,
              quantity: cartItem.quantity,
              unitPrice: cartItem.unitPrice,
              discount: cartItem.discount || 0,
              total: cartItem.total,
              notes: cartItem.notes,
            },
          });
        }

        await this.updateInventoryForSale(
          tx,
          saleItems,
          cart.businessUnitId,
          userId,
          sale.id,
          receiptNumber
        );

        await this.createSalePayment(tx, sale.id, userId, {
          paymentMethod: paymentData.paymentMethod,
          paidAmount: paidAmount,
          cashRegisterId: paymentData.cashRegisterId,
          cashRegisterSessionId: paymentData.cashRegisterSessionId,
          reference: `PAY-${receiptNumber}`,
        });

        if (cart.customerId) {
          await this.updateCustomerLoyalty(
            tx,
            cart.customerId,
            sale.id,
            userId,
            total,
            receiptNumber,
            loyaltyPointsUsed
          );
        }

        await tx.cartItem.deleteMany({ where: { cartId } });
        await tx.cart.update({
          where: { id: cartId },
          data: {
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            customerId: null,
          },
        });

        await this.createAuditLogWithTx(
          tx,
          'CREATE',
          sale.id,
          userId,
          receiptNumber,
          {
            total,
            items: cart.items.length,
            cartId: cartId,
            paymentMethod: paymentData.paymentMethod,
          },
          'INFO'
        );

        this.safeEmitNewSale(sale, cart.businessUnitId);

        return sale;
      });
    } catch (error) {
      this.handleError(error, 'SaleService.createSaleFromCart');
    }
  }

  /**
   * Process return
   */
  async processReturn(
    saleId: string,
    userId: string,
    data: { reason: string; items?: ReturnItemInput[] }
  ) {
    try {
      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }
      if (!data.reason) {
        throw new AppError('Return reason is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            customer: true,
          },
        });

        if (!sale) {
          throw new AppError('Sale not found', 404);
        }

        if (sale.status === 'RETURNED') {
          throw new AppError('Sale already returned', 400);
        }

        if (sale.status === 'REFUNDED') {
          throw new AppError('Cannot return a refunded sale', 400);
        }

        let returnItems = data.items || sale.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          reason: data.reason,
        }));

        let returnSubtotal = 0;
        let returnTax = 0;
        let returnTotal = 0;

        for (const item of returnItems) {
          const saleItem = sale.items.find(
            (si: any) => si.productId === item.productId && 
            (si.variantId === item.variantId || (!si.variantId && !item.variantId))
          );

          if (!saleItem) {
            throw new AppError(`Item not found in sale`, 400);
          }

          if (item.quantity > saleItem.quantity) {
            throw new AppError(
              `Cannot return more than purchased. Max: ${saleItem.quantity}`,
              400
            );
          }

          const itemTotal = (saleItem.unitPrice * item.quantity) - 
            ((saleItem.discount || 0) / saleItem.quantity * item.quantity);
          returnSubtotal += itemTotal;
        }

        const taxProportion = sale.tax / sale.subtotal;
        returnTax = returnSubtotal * taxProportion;
        returnTotal = returnSubtotal + returnTax;

        const returnNumber = `RET-${Date.now()}`;
        const returnRecord = await tx.return.create({
          data: {
            returnNumber,
            saleId: sale.id,
            customerId: sale.customerId,
            userId: userId,
            reason: data.reason,
            status: 'PENDING',
            returnType: returnItems.length === sale.items.length ? 'FULL' : 'PARTIAL',
            refundMethod: 'ORIGINAL_PAYMENT',
            subtotal: returnSubtotal,
            tax: returnTax,
            total: returnTotal,
            notes: `Return for sale ${sale.receiptNumber}`,
            companyId: sale.companyId,
            businessUnitId: sale.businessUnitId,
            createdAt: new Date(),
          },
        });

        for (const item of returnItems) {
          const saleItem = sale.items.find(
            (si: any) => si.productId === item.productId && 
            (si.variantId === item.variantId || (!si.variantId && !item.variantId))
          );

          await tx.returnItem.create({
            data: {
              returnId: returnRecord.id,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: saleItem?.unitPrice || 0,
              total: (saleItem?.unitPrice || 0) * item.quantity,
              reason: item.reason || data.reason,
              condition: 'good',
              createdAt: new Date(),
            },
          });

          const inventory = await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              variantId: item.variantId || null,
              businessUnitId: sale.businessUnitId,
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: { increment: item.quantity },
                available: { increment: item.quantity },
                updatedAt: new Date(),
              },
            });

            await tx.inventoryTransaction.create({
              data: {
                transactionType: 'RETURN',
                quantity: item.quantity,
                notes: `Return for ${sale.receiptNumber}: ${data.reason}`,
                productId: item.productId,
                variantId: item.variantId || null,
                inventoryId: inventory.id,
                businessUnitId: sale.businessUnitId,
                userId: userId,
                saleId: sale.id,
                createdAt: new Date(),
              },
            });
          }
        }

        await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'RETURNED',
            notes: sale.notes
              ? `${sale.notes}\nReturned: ${data.reason}`
              : `Returned: ${data.reason}`,
          },
        });

        if (sale.customerId) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              totalSpent: { decrement: returnTotal },
            },
          });
        }

        await this.createAuditLogWithTx(
          tx,
          'APPROVE',
          returnRecord.id,
          userId,
          returnNumber,
          {
            saleId: sale.id,
            receiptNumber: sale.receiptNumber,
            total: returnTotal,
            items: returnItems.length,
            reason: data.reason,
          },
          'HIGH'
        );

        try {
          (realtimeService as any).emitReturnCreated?.(returnRecord, sale.businessUnitId);
        } catch (wsError) {
          logger.warn('Failed to emit return event:', wsError);
        }

        return {
          return: returnRecord,
          sale: await tx.sale.findUnique({
            where: { id: saleId },
            include: {
              customer: true,
              items: true,
            },
          }),
        };
      });
    } catch (error) {
      this.handleError(error, 'SaleService.processReturn');
    }
  }

  /**
   * Refund a sale
   */
  async refundSale(
    saleId: string,
    userId: string,
    reason?: string,
    amount?: number,
    items?: RefundItemInput[]
  ) {
    try {
      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            payments: true,
            customer: true,
          },
        });

        if (!sale) {
          throw new AppError('Sale not found', 404);
        }

        if (sale.status === 'REFUNDED') {
          throw new AppError('Sale already refunded', 400);
        }

        if (sale.status === 'RETURNED') {
          throw new AppError('Cannot refund a returned sale', 400);
        }

        let refundTotal = amount || sale.total;
        let refundSubtotal = (refundTotal / sale.total) * sale.subtotal;
        let refundTax = (refundTotal / sale.total) * sale.tax;

        const refundNumber = `REF-${Date.now()}`;
        const refundRecord = await tx.refund.create({
          data: {
            refundNumber,
            saleId: sale.id,
            customerId: sale.customerId,
            userId: userId,
            reason: reason || 'No reason provided',
            status: 'PENDING',
            refundMethod: 'ORIGINAL_PAYMENT',
            refundType: refundTotal === sale.total ? 'full' : 'partial',
            subtotal: refundSubtotal,
            tax: refundTax,
            total: refundTotal,
            notes: `Refund for sale ${sale.receiptNumber}`,
            companyId: sale.companyId,
            businessUnitId: sale.businessUnitId,
            createdAt: new Date(),
          },
        });

        if (items) {
          for (const item of items) {
            const saleItem = sale.items.find(
              (si: any) => si.productId === item.productId && 
              (si.variantId === item.variantId || (!si.variantId && !item.variantId))
            );

            if (!saleItem) {
              throw new AppError(`Item not found in sale`, 400);
            }

            await tx.refundItem.create({
              data: {
                refundId: refundRecord.id,
                productId: item.productId,
                variantId: item.variantId || null,
                quantity: item.quantity,
                unitPrice: saleItem.unitPrice,
                total: saleItem.unitPrice * item.quantity,
                reason: item.reason || reason || 'No reason provided',
                createdAt: new Date(),
              },
            });

            const inventory = await tx.inventory.findFirst({
              where: {
                productId: item.productId,
                variantId: item.variantId || null,
                businessUnitId: sale.businessUnitId,
              },
            });

            if (inventory) {
              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  quantity: { increment: item.quantity },
                  available: { increment: item.quantity },
                  updatedAt: new Date(),
                },
              });

              await tx.inventoryTransaction.create({
                data: {
                  transactionType: 'RESTOCK',
                  quantity: item.quantity,
                  notes: `Refund for ${sale.receiptNumber}`,
                  productId: item.productId,
                  variantId: item.variantId || null,
                  inventoryId: inventory.id,
                  businessUnitId: sale.businessUnitId,
                  userId: userId,
                  saleId: sale.id,
                  createdAt: new Date(),
                },
              });
            }
          }
        }

        await tx.payment.create({
          data: {
            amount: -refundTotal,
            paymentMethod: 'ORIGINAL_PAYMENT',
            status: 'REFUNDED',
            saleId: sale.id,
            userId: userId,
            processedAt: new Date(),
            reference: `REFUND-${refundNumber}`,
          },
        });

        await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'REFUNDED',
            notes: sale.notes
              ? `${sale.notes}\nRefunded: ${reason || 'No reason provided'}`
              : `Refunded: ${reason || 'No reason provided'}`,
          },
        });

        if (sale.customerId) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: {
              totalSpent: { decrement: refundTotal },
            },
          });
        }

        await this.createAuditLogWithTx(
          tx,
          'APPROVE',
          refundRecord.id,
          userId,
          refundNumber,
          {
            saleId: sale.id,
            receiptNumber: sale.receiptNumber,
            total: refundTotal,
            reason: reason || 'No reason provided',
          },
          'HIGH'
        );

        return {
          refund: refundRecord,
          sale: await tx.sale.findUnique({
            where: { id: saleId },
            include: {
              customer: true,
              items: true,
            },
          }),
        };
      });
    } catch (error) {
      this.handleError(error, 'SaleService.refundSale');
    }
  }

  /**
   * Cancel sale
   */
  async cancelSale(saleId: string, userId: string, reason?: string) {
    try {
      const existingSale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });

      if (!existingSale) {
        throw new AppError('Sale not found', 404);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        for (const item of existingSale.items) {
          const inventory = await tx.inventory.findFirst({
            where: {
              productId: item.productId,
              variantId: item.variantId || null,
              businessUnitId: existingSale.businessUnitId,
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: { increment: item.quantity },
                available: { increment: item.quantity },
                updatedAt: new Date(),
              },
            });
          }
        }

        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'CANCELLED',
            notes: existingSale.notes
              ? `${existingSale.notes}\nCancelled: ${reason || 'No reason provided'}`
              : `Cancelled: ${reason || 'No reason provided'}`,
          },
        });

        await this.createAuditLogWithTx(
          tx,
          'DELETE',
          saleId,
          userId,
          existingSale.receiptNumber,
          {
            reason: reason || 'No reason provided',
            total: existingSale.total,
          },
          'MEDIUM'
        );

        return updatedSale;
      });
    } catch (error) {
      this.handleError(error, 'SaleService.cancelSale');
    }
  }

  /**
   * Void sale
   */
  async voidSale(saleId: string, userId: string, reason?: string) {
    try {
      const existingSale = await this.prisma.sale.findUnique({
        where: { id: saleId },
      });

      if (!existingSale) {
        throw new AppError('Sale not found', 404);
      }

      return await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          status: 'VOID',
          notes: existingSale.notes
            ? `${existingSale.notes}\nVoided: ${reason || 'No reason provided'}`
            : `Voided: ${reason || 'No reason provided'}`,
        },
      });
    } catch (error) {
      this.handleError(error, 'SaleService.voidSale');
    }
  }

  /**
   * Hold sale
   */
  async holdSale(saleId: string, userId: string) {
    try {
      return await this.prisma.sale.update({
        where: { id: saleId },
        data: { status: 'ON_HOLD' },
      });
    } catch (error) {
      this.handleError(error, 'SaleService.holdSale');
    }
  }

  /**
   * Resume held sale
   */
  async resumeSale(saleId: string, userId: string) {
    try {
      return await this.prisma.sale.update({
        where: { id: saleId },
        data: { status: 'COMPLETED' },
      });
    } catch (error) {
      this.handleError(error, 'SaleService.resumeSale');
    }
  }

  /**
   * Send receipt email
   */
  async sendReceiptEmail(saleId: string, email: string, userId: string) {
    try {
      if (!email) {
        throw new AppError('Email is required', 400);
      }

      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
          businessUnit: true,
          receipt: true,
        },
      });

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      logger.info(`Sending receipt email for sale ${sale.receiptNumber} to ${email}`);

      if (sale.receipt) {
        await this.prisma.receipt.update({
          where: { id: sale.receipt.id },
          data: {
            sentAt: new Date(),
            status: 'SENT',
          },
        });
      }

      return {
        saleId,
        receiptNumber: sale.receiptNumber,
        email,
        sent: true,
        timestamp: new Date(),
      };
    } catch (error) {
      this.handleError(error, 'SaleService.sendReceiptEmail');
    }
  }

  /**
   * Resend receipt email
   */
  async resendReceiptEmail(saleId: string, userId: string) {
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        include: { customer: true },
      });

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      if (!sale.customer?.email) {
        throw new AppError('Customer has no email address', 400);
      }

      return await this.sendReceiptEmail(saleId, sale.customer.email, userId);
    } catch (error) {
      this.handleError(error, 'SaleService.resendReceiptEmail');
    }
  }

  /**
   * Update sale
   */
  async updateSale(saleId: string, updates: any, userId: string) {
    try {
      const existingSale = await this.prisma.sale.findUnique({
        where: { id: saleId },
      });

      if (!existingSale) {
        throw new AppError('Sale not found', 404);
      }

      const updatedSale = await this.prisma.sale.update({
        where: { id: saleId },
        data: updates,
      });

      this.safeEmitSaleUpdate(updatedSale, updatedSale.businessUnitId);

      return updatedSale;
    } catch (error) {
      this.handleError(error, 'SaleService.updateSale');
    }
  }

  /**
   * Update sale status
   */
  async updateSaleStatus(saleId: string, status: string, userId: string) {
    try {
      const existingSale = await this.prisma.sale.findUnique({
        where: { id: saleId },
      });

      if (!existingSale) {
        throw new AppError('Sale not found', 404);
      }

      return await this.prisma.sale.update({
        where: { id: saleId },
        data: { status: status as any },
      });
    } catch (error) {
      this.handleError(error, 'SaleService.updateSaleStatus');
    }
  }

  /**
   * Update sale notes
   */
  async updateSaleNotes(saleId: string, notes: string, userId: string) {
    try {
      if (notes === undefined) {
        throw new AppError('Notes are required', 400);
      }

      return await this.prisma.sale.update({
        where: { id: saleId },
        data: { notes },
      });
    } catch (error) {
      this.handleError(error, 'SaleService.updateSaleNotes');
    }
  }

  /**
   * Delete sale (soft delete)
   */
  async deleteSale(saleId: string, userId: string) {
    try {
      return await this.prisma.sale.update({
        where: { id: saleId },
        data: { status: 'DELETED' },
      });
    } catch (error) {
      this.handleError(error, 'SaleService.deleteSale');
    }
  }

  /**
   * Bulk delete sales
   */
  async bulkDeleteSales(saleIds: string[], userId: string) {
    try {
      if (!saleIds || saleIds.length === 0) {
        throw new AppError('Sale IDs are required', 400);
      }

      const result = await this.prisma.sale.updateMany({
        where: { id: { in: saleIds } },
        data: { status: 'DELETED' },
      });

      return {
        deleted: result.count,
        failed: saleIds.length - result.count,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.bulkDeleteSales');
    }
  }

  /**
   * Bulk update sales status
   */
  async bulkUpdateStatus(saleIds: string[], status: string, userId: string) {
    try {
      if (!saleIds || saleIds.length === 0) {
        throw new AppError('Sale IDs are required', 400);
      }

      const result = await this.prisma.sale.updateMany({
        where: { id: { in: saleIds } },
        data: { status: status as any },
      });

      return {
        updated: result.count,
        failed: saleIds.length - result.count,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.bulkUpdateStatus');
    }
  }

  // ============================================
  // STATISTICS METHODS
  // ============================================

  /**
   * Get sales statistics
   */
  async getSalesStats(params: {
    businessUnitId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<SalesStatsResult> {
    try {
      const { businessUnitId, startDate, endDate } = params;

      const where: any = { status: { notIn: ['CANCELLED', 'DELETED'] } };
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (startDate || endDate) {
        where.saleDate = {};
        if (startDate) where.saleDate.gte = startDate;
        if (endDate) where.saleDate.lte = endDate;
      }

      const [stats, count, topProducts, totalCustomers] = await Promise.all([
        this.prisma.sale.aggregate({
          where,
          _sum: { total: true, subtotal: true, tax: true, discount: true },
          _count: true,
          _avg: { total: true },
        }),
        this.prisma.sale.count({ where }),
        this.prisma.saleItem.groupBy({
          by: ['productId'],
          where: { sale: where },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 10,
        }),
        this.prisma.customer.count({
          where: {
            sales: {
              some: where,
            },
          },
        }),
      ]);

      const totalSales = stats._count || 0;
      const totalRevenue = stats._sum?.total || 0;

      const topProductsWithNames = await Promise.all(
        topProducts.map(async (p: any) => {
          const product = await this.prisma.product.findUnique({
            where: { id: p.productId },
            select: { name: true, sku: true },
          });
          return {
            ...p,
            productName: product?.name || p.productId,
            productSku: product?.sku || 'N/A',
          };
        })
      );

      return {
        totalSales,
        totalRevenue,
        totalSubtotal: stats._sum?.subtotal || 0,
        totalTax: stats._sum?.tax || 0,
        totalDiscount: stats._sum?.discount || 0,
        averageTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
        topProducts: topProductsWithNames,
        totalItemsSold: topProducts.reduce(
          (sum: number, p: any) => sum + (p._sum?.quantity || 0),
          0
        ),
        totalCustomers,
        averageItemsPerSale:
          totalSales > 0
            ? topProducts.reduce(
                (sum: number, p: any) => sum + (p._sum?.quantity || 0),
                0
              ) / totalSales
            : 0,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesStats');
    }
  }

  /**
   * Get sales by date range
   */
  async getSalesByDateRange(params: {
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
        saleDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      return await this.prisma.sale.findMany({
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
          payments: {
            select: {
              id: true,
              paymentMethod: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      });
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesByDateRange');
    }
  }

  /**
   * Get daily sales summary
   */
  async getDailySalesSummary(params: { businessUnitId?: string; date: Date }) {
    try {
      const { businessUnitId, date } = params;

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const where: any = {
        saleDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const [sales, stats] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          include: {
            payments: {
              select: {
                paymentMethod: true,
                amount: true,
              },
            },
            items: {
              select: {
                quantity: true,
              },
            },
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { saleDate: 'asc' },
        }),
        this.prisma.sale.aggregate({
          where,
          _sum: { total: true },
          _count: true,
          _avg: { total: true },
        }),
      ]);

      const totalRevenue = stats._sum?.total || 0;
      const totalSales = stats._count || 0;
      const totalItems = sales.reduce(
        (sum: number, sale: any) =>
          sum + sale.items.reduce((s: number, i: any) => s + i.quantity, 0),
        0
      );
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      const paymentMethods: Record<string, { count: number; total: number }> = {};
      sales.forEach((sale: any) => {
        sale.payments.forEach((payment: any) => {
          if (!paymentMethods[payment.paymentMethod]) {
            paymentMethods[payment.paymentMethod] = { count: 0, total: 0 };
          }
          paymentMethods[payment.paymentMethod].count += 1;
          paymentMethods[payment.paymentMethod].total += payment.amount;
        });
      });

      const hourlyBreakdown = Array.from({ length: 24 }, (_, i) => {
        const hourSales = sales.filter(
          (s: any) => new Date(s.saleDate).getHours() === i
        );
        return {
          hour: i,
          count: hourSales.length,
          revenue: hourSales.reduce((sum: number, s: any) => sum + s.total, 0),
        };
      });

      return {
        date,
        totalSales,
        totalRevenue,
        totalItems,
        averageTicket,
        paymentMethods: Object.entries(paymentMethods).map(([method, data]) => ({
          method,
          count: data.count,
          total: data.total,
          percentage: totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0,
        })),
        hourlyBreakdown,
        sales,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getDailySalesSummary');
    }
  }

  /**
   * Get sales analytics
   */
  async getSalesAnalytics(params: {
    startDate?: Date;
    endDate?: Date;
    view?: 'daily' | 'weekly' | 'monthly' | 'hourly';
    businessUnitId?: string;
  }) {
    try {
      const { startDate, endDate, view = 'daily', businessUnitId } = params;

      const where: any = {
        status: { notIn: ['CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (startDate || endDate) {
        where.saleDate = {};
        if (startDate) where.saleDate.gte = startDate;
        if (endDate) where.saleDate.lte = endDate;
      }

      const sales = await this.prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          customer: true,
          payments: true,
        },
        orderBy: { saleDate: 'asc' },
      });

      const totalRevenue = sales.reduce((sum: number, s: any) => sum + s.total, 0);
      const totalSales = sales.length;
      const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

      const productSales: Record<
        string,
        { quantity: number; revenue: number; name: string }
      > = {};
      sales.forEach((sale: any) => {
        sale.items.forEach((item: any) => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              quantity: 0,
              revenue: 0,
              name: item.product.name,
            };
          }
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue += item.total;
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      const customerSales: Record<string, { count: number; total: number }> = {};
      sales.forEach((sale: any) => {
        const key = sale.customerId || 'guest';
        if (!customerSales[key]) customerSales[key] = { count: 0, total: 0 };
        customerSales[key].count += 1;
        customerSales[key].total += sale.total;
      });

      const returningCustomers = Object.values(customerSales).filter(
        (c) => c.count > 1
      ).length;
      const totalCustomers = Object.keys(customerSales).filter(
        (k) => k !== 'guest'
      ).length;

      const paymentDistribution: Record<string, number> = {};
      sales.forEach((sale: any) => {
        sale.payments.forEach((payment: any) => {
          paymentDistribution[payment.paymentMethod] =
            (paymentDistribution[payment.paymentMethod] || 0) + payment.amount;
        });
      });

      const peakHours = Array.from({ length: 24 }, (_, i) => {
        const hourSales = sales.filter(
          (s: any) => new Date(s.saleDate).getHours() === i
        );
        return {
          hour: i,
          sales: hourSales.length,
          revenue: hourSales.reduce((sum: number, s: any) => sum + s.total, 0),
        };
      });

      const categorySales: Record<string, { quantity: number; revenue: number }> = {};
      sales.forEach((sale: any) => {
        sale.items.forEach((item: any) => {
          const categoryName = item.product.category?.name || 'Uncategorized';
          if (!categorySales[categoryName]) {
            categorySales[categoryName] = { quantity: 0, revenue: 0 };
          }
          categorySales[categoryName].quantity += item.quantity;
          categorySales[categoryName].revenue += item.total;
        });
      });

      const bestCategory = Object.entries(categorySales).sort(
        (a, b) => b[1].revenue - a[1].revenue
      )[0];

      const revenueTrend = sales.map((s: any) => ({
        date: s.saleDate.toISOString().split('T')[0],
        revenue: s.total,
        sales: 1,
      }));

      return {
        revenueTrend,
        distribution: Object.entries(paymentDistribution).map(
          ([name, value]) => ({ name, value })
        ),
        peakHours,
        customerInsights: {
          totalCustomers,
          newCustomers: totalCustomers - returningCustomers,
          returningCustomers,
          repeatRate:
            totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0,
        },
        bestCategory: bestCategory?.[0] || 'N/A',
        bestCategorySales: bestCategory?.[1]?.revenue || 0,
        averageOrderValue,
        averageItems:
          sales.reduce((sum: number, s: any) => sum + s.items.length, 0) /
          (sales.length || 1),
        retentionRate:
          totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0,
        topProducts,
        totalSales,
        totalRevenue,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesAnalytics');
    }
  }

  /**
   * Get sales by payment method
   */
  async getSalesByPaymentMethod(params: {
    businessUnitId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    try {
      const { businessUnitId, startDate, endDate } = params;

      const where: any = { status: { not: 'REFUNDED' } };
      if (businessUnitId) where.sale = { businessUnitId };
      if (startDate || endDate) {
        where.processedAt = {};
        if (startDate) where.processedAt.gte = startDate;
        if (endDate) where.processedAt.lte = endDate;
      }

      const payments = await this.prisma.payment.findMany({
        where,
        select: {
          paymentMethod: true,
          amount: true,
        },
      });

      const methodMap: Record<
        string,
        { count: number; total: number; items: any[] }
      > = {};
      payments.forEach((payment: any) => {
        const method = payment.paymentMethod;
        if (!methodMap[method]) methodMap[method] = { count: 0, total: 0, items: [] };
        methodMap[method].count += 1;
        methodMap[method].total += payment.amount;
        methodMap[method].items.push(payment);
      });

      const total = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

      return Object.entries(methodMap).map(([paymentMethod, data]) => ({
        paymentMethod,
        count: data.count,
        total: data.total,
        average: data.count > 0 ? data.total / data.count : 0,
        percentage: total > 0 ? (data.total / total) * 100 : 0,
      }));
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesByPaymentMethod');
    }
  }

  /**
   * Get sales by product
   */
  async getSalesByProduct(
    productId: string,
    params?: {
      businessUnitId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      variantId?: string;
    }
  ) {
    try {
      const { businessUnitId, startDate, endDate, limit = 10, variantId } =
        params || {};

      const where: any = {
        productId,
        sale: { status: { notIn: ['CANCELLED', 'DELETED'] } },
      };
      if (variantId) where.variantId = variantId;
      if (businessUnitId) where.sale = { ...where.sale, businessUnitId };
      if (startDate || endDate) {
        where.sale = {
          ...where.sale,
          saleDate: {},
        };
        if (startDate) where.sale.saleDate.gte = startDate;
        if (endDate) where.sale.saleDate.lte = endDate;
      }

      const items = await this.prisma.saleItem.findMany({
        where,
        include: {
          sale: {
            include: {
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
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
        orderBy: { sale: { saleDate: 'desc' } },
        take: limit,
      });

      const totalQuantity = items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      );
      const totalRevenue = items.reduce(
        (sum: number, item: any) => sum + item.total,
        0
      );

      return {
        items: items.map((item: any) => ({
          date: item.sale.saleDate.toISOString().split('T')[0],
          quantity: item.quantity,
          revenue: item.total,
          customerName: item.sale.customer
            ? `${item.sale.customer.firstName} ${item.sale.customer.lastName}`.trim()
            : 'Guest',
          customerEmail: item.sale.customer?.email || 'N/A',
          variantName: item.variant?.name || 'Default',
        })),
        totalQuantity,
        totalRevenue,
        averagePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesByProduct');
    }
  }

  /**
   * Get customer sales stats
   */
  async getCustomerSalesStats(customerId: string) {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const sales = await this.prisma.sale.findMany({
        where: {
          customerId,
          status: { notIn: ['CANCELLED', 'DELETED'] },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      });

      const totalSpent = sales.reduce((sum: number, s: any) => sum + s.total, 0);
      const totalPurchases = sales.length;
      const averageTicket = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
      const firstPurchase = sales.length > 0 ? sales[sales.length - 1].saleDate : null;
      const lastPurchase = sales.length > 0 ? sales[0].saleDate : null;

      const categoryCount: Record<string, number> = {};
      const productCount: Record<string, number> = {};
      sales.forEach((sale: any) => {
        sale.items.forEach((item: any) => {
          if (item.product?.categoryId) {
            categoryCount[item.product.categoryId] =
              (categoryCount[item.product.categoryId] || 0) + item.quantity;
          }
          productCount[item.productId] =
            (productCount[item.productId] || 0) + item.quantity;
        });
      });

      const favoriteCategory = Object.entries(categoryCount).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || 'N/A';
      const favoriteProduct = Object.entries(productCount).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || 'N/A';

      const [favoriteCategoryName, favoriteProductName] = await Promise.all([
        favoriteCategory !== 'N/A'
          ? this.prisma.category.findUnique({
              where: { id: favoriteCategory },
              select: { name: true },
            })
          : null,
        favoriteProduct !== 'N/A'
          ? this.prisma.product.findUnique({
              where: { id: favoriteProduct },
              select: { name: true },
            })
          : null,
      ]);

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          loyaltyPoints: true,
          loyaltyLevel: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      const monthlyTrend = sales.reduce((acc: any, sale: any) => {
        const month = sale.saleDate.toISOString().slice(0, 7);
        if (!acc[month]) acc[month] = { revenue: 0, count: 0 };
        acc[month].revenue += sale.total;
        acc[month].count += 1;
        return acc;
      }, {});

      return {
        customer: {
          id: customerId,
          name: customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'Unknown',
          email: customer?.email || 'N/A',
          loyaltyPoints: customer?.loyaltyPoints || 0,
          loyaltyLevel: customer?.loyaltyLevel || 'BRONZE',
        },
        totalSpent,
        totalPurchases,
        averageTicket,
        firstPurchase: firstPurchase?.toISOString() || null,
        lastPurchase: lastPurchase?.toISOString() || null,
        favoriteCategory: favoriteCategoryName?.name || favoriteCategory,
        favoriteCategoryId: favoriteCategory,
        favoriteProduct: favoriteProductName?.name || favoriteProduct,
        favoriteProductId: favoriteProduct,
        monthlyTrend: Object.entries(monthlyTrend).map(([month, data]: [string, any]) => ({
          month,
          revenue: data.revenue,
          count: data.count,
        })),
        recentPurchases: sales.slice(0, 5).map((s: any) => ({
          receiptNumber: s.receiptNumber,
          total: s.total,
          date: s.saleDate.toISOString(),
          items: s.items.length,
        })),
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getCustomerSalesStats');
    }
  }

  /**
   * Get sales settings
   */
  async getSalesSettings(companyId?: string) {
    try {
      let settings = null;

      if (companyId) {
        settings = await this.prisma.salesSettings.findUnique({
          where: { companyId },
        });
      }

      if (!settings) {
        const company = await this.prisma.company.findFirst({
          where: companyId ? { id: companyId } : undefined,
        });

        if (company) {
          settings = await this.prisma.salesSettings.findUnique({
            where: { companyId: company.id },
          });
        }
      }

      if (settings) {
        return {
          taxRate: settings.taxRate,
          discountEnabled: settings.discountEnabled,
          maxDiscount: settings.maxDiscount,
          loyaltyPointsEnabled: settings.loyaltyPointsEnabled,
          pointsPerDollar: settings.pointsPerDollar,
          autoPrintReceipt: settings.autoPrintReceipt,
          emailReceipts: settings.emailReceipts,
          receiptFooter: settings.receiptFooter,
          defaultPaymentMethod: settings.defaultPaymentMethod,
          currencySymbol: settings.currencySymbol,
          currencyCode: settings.currencyCode,
          invoicePrefix: settings.invoicePrefix,
          receiptPrefix: settings.receiptPrefix,
        };
      }

      return {
        taxRate: 8,
        discountEnabled: true,
        maxDiscount: 20,
        loyaltyPointsEnabled: true,
        pointsPerDollar: 10,
        autoPrintReceipt: true,
        emailReceipts: true,
        receiptFooter: 'Thank you for your business!',
        defaultPaymentMethod: 'CASH',
        currencySymbol: '$',
        currencyCode: 'USD',
        invoicePrefix: 'INV-',
        receiptPrefix: 'RCP-',
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesSettings');
    }
  }

  /**
   * Update sales settings
   */
  async updateSalesSettings(settings: any, companyId?: string) {
    try {
      let company = await this.prisma.company.findFirst({
        where: companyId ? { id: companyId } : undefined,
      });

      if (!company) {
        company = await this.prisma.company.create({
          data: {
            name: 'Default Company',
            email: 'default@company.com',
            phone: '+0000000000',
            isActive: true,
          },
        });
      }

      const existing = await this.prisma.salesSettings.findUnique({
        where: { companyId: company.id },
      });

      const data = {
        taxRate: settings.taxRate,
        discountEnabled: settings.discountEnabled,
        maxDiscount: settings.maxDiscount,
        loyaltyPointsEnabled: settings.loyaltyPointsEnabled,
        pointsPerDollar: settings.pointsPerDollar,
        autoPrintReceipt: settings.autoPrintReceipt,
        emailReceipts: settings.emailReceipts,
        receiptFooter: settings.receiptFooter,
        defaultPaymentMethod: settings.defaultPaymentMethod,
        currencySymbol: settings.currencySymbol,
        currencyCode: settings.currencyCode,
        invoicePrefix: settings.invoicePrefix,
        receiptPrefix: settings.receiptPrefix,
        updatedAt: new Date(),
      };

      if (existing) {
        return await this.prisma.salesSettings.update({
          where: { id: existing.id },
          data,
        });
      }

      return await this.prisma.salesSettings.create({
        data: {
          ...data,
          companyId: company.id,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      this.handleError(error, 'SaleService.updateSalesSettings');
    }
  }

  /**
   * Get sales by status
   */
  async getSalesByStatus(
    status: string,
    params?: { page?: number; limit?: number; businessUnitId?: string }
  ) {
    return this.getAllSales({
      status,
      page: params?.page || 1,
      limit: params?.limit || 10,
      businessUnitId: params?.businessUnitId,
    });
  }

  /**
   * Get sales forecast
   */
  async getSalesForecast(params: { businessUnitId?: string; days?: number }) {
    try {
      const { businessUnitId, days = 7 } = params;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const where: any = {
        status: { notIn: ['CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;
      where.saleDate = { gte: startDate, lte: endDate };

      const sales = await this.prisma.sale.findMany({
        where,
        orderBy: { saleDate: 'asc' },
      });

      const dailyRevenue: Record<string, number> = {};
      sales.forEach((sale: any) => {
        const date = sale.saleDate.toISOString().split('T')[0];
        dailyRevenue[date] = (dailyRevenue[date] || 0) + sale.total;
      });

      const values = Object.values(dailyRevenue);
      const avgDailyRevenue =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;

      const sortedDates = Object.keys(dailyRevenue).sort();
      let growthRate = 0;
      if (sortedDates.length > 1) {
        const firstHalf = sortedDates.slice(0, Math.floor(sortedDates.length / 2));
        const secondHalf = sortedDates.slice(Math.floor(sortedDates.length / 2));
        const firstAvg =
          firstHalf.reduce((sum, d) => sum + dailyRevenue[d], 0) / firstHalf.length;
        const secondAvg =
          secondHalf.reduce((sum, d) => sum + dailyRevenue[d], 0) / secondHalf.length;
        growthRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
      }

      const forecast = Array.from({ length: days }, (_, i) => {
        const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        const predicted = avgDailyRevenue * (1 + (growthRate / 100) * (i + 1));
        return {
          date: date.toISOString().split('T')[0],
          predicted: Math.round(predicted * 100) / 100,
          confidence: Math.max(0.7, 0.95 - i * 0.03),
          lowerBound: Math.round(predicted * 0.85 * 100) / 100,
          upperBound: Math.round(predicted * 1.15 * 100) / 100,
        };
      });

      return {
        forecast,
        trend: growthRate > 2 ? 'up' : growthRate < -2 ? 'down' : 'stable',
        growthRate: Math.round(growthRate * 10) / 10,
        averageDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
        totalHistoricalSales: sales.length,
        period: '30 days',
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesForecast');
    }
  }

  /**
   * Get sales comparison
   */
  async getSalesComparison(params: {
    businessUnitId?: string;
    period1Start: Date;
    period1End: Date;
    period2Start: Date;
    period2End: Date;
  }) {
    try {
      const {
        businessUnitId,
        period1Start,
        period1End,
        period2Start,
        period2End,
      } = params;

      const getPeriodData = async (start: Date, end: Date) => {
        const where: any = {
          saleDate: { gte: start, lte: end },
          status: { notIn: ['CANCELLED', 'DELETED'] },
        };
        if (businessUnitId) where.businessUnitId = businessUnitId;

        const [sales, stats] = await Promise.all([
          this.prisma.sale.findMany({
            where,
            include: {
              items: true,
              customer: true,
            },
          }),
          this.prisma.sale.aggregate({
            where,
            _sum: { total: true },
            _count: true,
            _avg: { total: true },
          }),
        ]);

        const revenue = stats._sum?.total || 0;
        const total = stats._count || 0;
        const average = stats._avg?.total || 0;
        const items = sales.reduce(
          (sum: number, s: any) => sum + s.items.length,
          0
        );
        const uniqueCustomers = new Set(
          sales.filter((s: any) => s.customerId).map((s: any) => s.customerId)
        ).size;

        return {
          revenue,
          sales: total,
          average,
          items,
          uniqueCustomers,
          start,
          end,
        };
      };

      const [period1, period2] = await Promise.all([
        getPeriodData(period1Start, period1End),
        getPeriodData(period2Start, period2End),
      ]);

      return {
        period1,
        period2,
        difference: {
          revenue: period2.revenue - period1.revenue,
          sales: period2.sales - period1.sales,
          average: period2.average - period1.average,
          items: period2.items - period1.items,
          customers: period2.uniqueCustomers - period1.uniqueCustomers,
        },
        percentageChange: {
          revenue:
            period1.revenue > 0
              ? ((period2.revenue - period1.revenue) / period1.revenue) * 100
              : 0,
          sales:
            period1.sales > 0
              ? ((period2.sales - period1.sales) / period1.sales) * 100
              : 0,
          average:
            period1.average > 0
              ? ((period2.average - period1.average) / period1.average) * 100
              : 0,
          items:
            period1.items > 0
              ? ((period2.items - period1.items) / period1.items) * 100
              : 0,
          customers:
            period1.uniqueCustomers > 0
              ? ((period2.uniqueCustomers - period1.uniqueCustomers) /
                  period1.uniqueCustomers) *
                100
              : 0,
        },
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesComparison');
    }
  }

  /**
   * Get sales summary by period
   */
  async getSalesSummary(params: {
    businessUnitId?: string;
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    date?: Date;
  }) {
    try {
      const { businessUnitId, period = 'month', date = new Date() } = params;
      let startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      switch (period) {
        case 'day':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          startDate.setMonth(startDate.getMonth() - 1);
          startDate.setHours(0, 0, 0, 0);
      }

      const where: any = {
        saleDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const [sales, stats] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
            customer: true,
          },
          orderBy: { saleDate: 'desc' },
        }),
        this.prisma.sale.aggregate({
          where,
          _sum: { total: true },
          _count: true,
          _avg: { total: true },
        }),
      ]);

      const totalRevenue = stats._sum?.total || 0;
      const totalSales = stats._count || 0;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
      const totalItems = sales.reduce(
        (sum: number, s: any) => sum + s.items.length,
        0
      );
      const uniqueCustomers = new Set(
        sales.filter((s: any) => s.customerId).map((s: any) => s.customerId)
      ).size;

      const categorySales: Record<string, number> = {};
      const productSales: Record<string, number> = {};
      sales.forEach((sale: any) => {
        sale.items.forEach((item: any) => {
          if (item.product?.categoryId) {
            categorySales[item.product.categoryId] =
              (categorySales[item.product.categoryId] || 0) + item.total;
          }
          productSales[item.productId] =
            (productSales[item.productId] || 0) + item.total;
        });
      });

      const topCategory = Object.entries(categorySales).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || 'N/A';
      const topProduct = Object.entries(productSales).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || 'N/A';

      const [categoryName, productName] = await Promise.all([
        topCategory !== 'N/A'
          ? this.prisma.category.findUnique({
              where: { id: topCategory },
              select: { name: true },
            })
          : null,
        topProduct !== 'N/A'
          ? this.prisma.product.findUnique({
              where: { id: topProduct },
              select: { name: true },
            })
          : null,
      ]);

      return {
        period,
        startDate,
        endDate,
        totalRevenue,
        totalSales,
        averageTicket,
        totalItems,
        uniqueCustomers,
        topCategory: categoryName?.name || topCategory,
        topCategoryId: topCategory,
        topProduct: productName?.name || topProduct,
        topProductId: topProduct,
        categoryBreakdown: Object.entries(categorySales)
          .slice(0, 5)
          .map(([id, revenue]) => ({
            categoryId: id,
            revenue,
          })),
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesSummary');
    }
  }

  /**
   * Get aggregated sales data
   */
  async getAggregatedSales(params: {
    businessUnitId?: string;
    startDate: Date;
    endDate: Date;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
  }) {
    try {
      const {
        businessUnitId,
        startDate,
        endDate,
        groupBy = 'day',
      } = params;

      const where: any = {
        saleDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const sales = await this.prisma.sale.findMany({
        where,
        orderBy: { saleDate: 'asc' },
        include: {
          items: true,
        },
      });

      const groupedData: Record<
        string,
        {
          revenue: number;
          sales: number;
          items: number;
          average: number;
          date: Date;
        }
      > = {};

      sales.forEach((sale: any) => {
        let key: string;
        const date = new Date(sale.saleDate);

        switch (groupBy) {
          case 'hour':
            key = `${date.toISOString().split('T')[0]} ${String(date.getHours()).padStart(2, '0')}:00`;
            break;
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

        if (!groupedData[key]) {
          groupedData[key] = {
            revenue: 0,
            sales: 0,
            items: 0,
            average: 0,
            date: date,
          };
        }

        groupedData[key].revenue += sale.total;
        groupedData[key].sales += 1;
        groupedData[key].items += sale.items.length;
      });

      Object.keys(groupedData).forEach((key) => {
        groupedData[key].average =
          groupedData[key].sales > 0
            ? groupedData[key].revenue / groupedData[key].sales
            : 0;
      });

      const result = Object.entries(groupedData).map(
        ([group, data]: [string, any]) => ({
          group,
          date: data.date.toISOString(),
          revenue: data.revenue,
          sales: data.sales,
          items: data.items,
          average: data.average,
        })
      );

      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return result;
    } catch (error) {
      this.handleError(error, 'SaleService.getAggregatedSales');
    }
  }

  /**
   * Get abandoned carts
   */
  async getAbandonedCarts(params: {
    businessUnitId?: string;
    startDate?: Date;
    endDate?: Date;
    minValue?: number;
  }) {
    try {
      const {
        businessUnitId,
        startDate,
        endDate,
        minValue = 0,
      } = params;

      const where: any = {
        total: { gte: minValue },
        items: { some: {} },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (startDate || endDate) {
        where.updatedAt = {};
        if (startDate) where.updatedAt.gte = startDate;
        if (endDate) where.updatedAt.lte = endDate;
      }

      const carts = await this.prisma.cart.findMany({
        where,
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
              variant: {
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
              phoneNumber: true,
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
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      return carts.map((cart: any) => ({
        id: cart.id,
        items: cart.items.map((item: any) => ({
          productId: item.productId,
          productName: item.product.name,
          variantName: item.variant?.name || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        itemCount: cart.items.length,
        total: cart.total,
        customerId: cart.customerId,
        customerName: cart.customer
          ? `${cart.customer.firstName} ${cart.customer.lastName}`.trim()
          : 'Guest',
        customerEmail: cart.customer?.email || 'N/A',
        customerPhone: cart.customer?.phoneNumber || 'N/A',
        createdAt: cart.createdAt.toISOString(),
        updatedAt: cart.updatedAt.toISOString(),
        status: 'ABANDONED',
        abandonmentAge: Math.floor(
          (Date.now() - new Date(cart.updatedAt).getTime()) / (1000 * 60 * 60)
        ),
      }));
    } catch (error) {
      this.handleError(error, 'SaleService.getAbandonedCarts');
    }
  }

  /**
   * Get sales report by period
   */
  async getSalesReportByPeriod(params: {
    businessUnitId?: string;
    period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    date?: Date;
  }) {
    try {
      const {
        businessUnitId,
        period = 'monthly',
        date = new Date(),
      } = params;

      let startDate = new Date(date);
      let endDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      switch (period) {
        case 'daily':
          break;
        case 'weekly':
          startDate.setDate(date.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(date.getMonth() - 1);
          break;
        case 'quarterly':
          startDate.setMonth(date.getMonth() - 3);
          break;
        case 'yearly':
          startDate.setFullYear(date.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(date.getMonth() - 1);
      }

      const where: any = {
        saleDate: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const [sales, stats] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    category: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            payments: {
              select: {
                paymentMethod: true,
                amount: true,
              },
            },
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { saleDate: 'asc' },
        }),
        this.prisma.sale.aggregate({
          where,
          _sum: { total: true, subtotal: true, tax: true, discount: true },
          _count: true,
          _avg: { total: true },
        }),
      ]);

      const previousPeriodStart = new Date(startDate);
      const previousPeriodEnd = new Date(startDate);
      previousPeriodStart.setHours(0, 0, 0, 0);
      previousPeriodEnd.setHours(23, 59, 59, 999);

      switch (period) {
        case 'daily':
          previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
          break;
        case 'weekly':
          previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
          break;
        case 'monthly':
          previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
          break;
        case 'quarterly':
          previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 3);
          break;
        case 'yearly':
          previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);
          break;
        default:
          previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      }

      const prevWhere: any = {
        saleDate: { gte: previousPeriodStart, lte: previousPeriodEnd },
        status: { notIn: ['CANCELLED', 'DELETED'] },
      };
      if (businessUnitId) prevWhere.businessUnitId = businessUnitId;

      const prevStats = await this.prisma.sale.aggregate({
        where: prevWhere,
        _sum: { total: true },
        _count: true,
      });

      const totalRevenue = stats._sum?.total || 0;
      const totalSales = stats._count || 0;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
      const previousRevenue = prevStats._sum?.total || 0;
      const growthRate =
        previousRevenue > 0
          ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
          : 0;

      const paymentMethods: Record<string, number> = {};
      sales.forEach((sale: any) => {
        sale.payments.forEach((payment: any) => {
          paymentMethods[payment.paymentMethod] =
            (paymentMethods[payment.paymentMethod] || 0) + payment.amount;
        });
      });

      const dailyBreakdown = sales.map((sale: any) => ({
        date: sale.saleDate.toISOString().split('T')[0],
        revenue: sale.total,
        count: 1,
        items: sale.items.length,
      }));

      return {
        period,
        startDate,
        endDate,
        totalRevenue,
        totalSales,
        totalSubtotal: stats._sum?.subtotal || 0,
        totalTax: stats._sum?.tax || 0,
        totalDiscount: stats._sum?.discount || 0,
        averageTicket,
        growthRate: Math.round(growthRate * 10) / 10,
        previousRevenue,
        paymentMethods,
        dailyBreakdown,
        sales,
        totalItems: sales.reduce(
          (sum: number, s: any) => sum + s.items.length,
          0
        ),
        uniqueCustomers: new Set(
          sales.filter((s: any) => s.customerId).map((s: any) => s.customerId)
        ).size,
      };
    } catch (error) {
      this.handleError(error, 'SaleService.getSalesReportByPeriod');
    }
  }

  /**
   * Get today's sales summary
   */
  async getTodaySalesSummary(params: { businessUnitId?: string }) {
    try {
      const { businessUnitId } = params;
      const today = new Date();
      return await this.getDailySalesSummary({
        businessUnitId,
        date: today,
      });
    } catch (error) {
      this.handleError(error, 'SaleService.getTodaySalesSummary');
    }
  }

  /**
   * Export sales data
   */
  async exportSales(params: {
    businessUnitId?: string;
    startDate: Date;
    endDate: Date;
    format?: 'json' | 'csv' | 'excel' | 'pdf';
  }) {
    try {
      const {
        businessUnitId,
        startDate,
        endDate,
        format = 'json',
      } = params;

      const sales = await this.getSalesByDateRange({
        businessUnitId,
        startDate,
        endDate,
      });

      const exportData = sales.map((sale: any) => ({
        receiptNumber: sale.receiptNumber,
        date: sale.saleDate.toISOString().split('T')[0],
        time: sale.saleDate.toISOString().split('T')[1].slice(0, 8),
        customer: sale.customer
          ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim()
          : 'Guest',
        customerEmail: sale.customer?.email || 'N/A',
        subtotal: sale.subtotal,
        tax: sale.tax,
        discount: sale.discount,
        total: sale.total,
        paidAmount: sale.paidAmount,
        changeAmount: sale.changeAmount,
        paymentMethod: sale.payments?.[0]?.paymentMethod || 'N/A',
        status: sale.status,
        items: sale.items.length,
        totalQuantity: sale.items.reduce(
          (sum: number, item: any) => sum + item.quantity,
          0
        ),
        cashier: sale.user
          ? `${sale.user.firstName} ${sale.user.lastName}`.trim()
          : 'Unknown',
        businessUnit: sale.businessUnit?.name || 'N/A',
        notes: sale.notes || '',
      }));

      return {
        data: exportData,
        total: exportData.length,
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
        summary: {
          totalRevenue: exportData.reduce((sum, d) => sum + d.total, 0),
          totalSales: exportData.length,
          averageTicket: exportData.length > 0
            ? exportData.reduce((sum, d) => sum + d.total, 0) / exportData.length
            : 0,
          totalItems: exportData.reduce((sum, d) => sum + d.totalQuantity, 0),
        },
        format,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.handleError(error, 'SaleService.exportSales');
    }
  }
}

export default SaleService;
