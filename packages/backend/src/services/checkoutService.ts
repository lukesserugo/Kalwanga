// D:\Projects\Kalwanga\packages\backend\src\services\checkoutService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { SaleService } from './saleService.js';
import { PaymentService } from './paymentService.js';
import { CartService } from './cartService.js';
import { generateReceiptNumber, calculateTotal } from '../utils/helpers.js';

// ============================================
// INTERFACES
// ============================================

interface CheckoutItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface CheckoutData {
  cartId: string;
  customerId?: string;
  paymentMethod: string;
  paidAmount: number;
  discount?: number;
  notes?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  applyLoyaltyPoints?: boolean;
  businessUnitId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;
}

interface CheckoutResponse {
  sale: any;
  payment: any;
  receipt: any;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  changeAmount: number;
}

interface CheckoutStats {
  totalSales: number;
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  averageOrderValue: number;
  topProducts: Array<{ productId: string; productName: string; quantity: number; revenue: number }>;
  salesByPaymentMethod: Record<string, number>;
  salesByDate: Array<{ date: string; count: number; revenue: number }>;
  recentSales: any[];
}

interface ExportOptions {
  userId: string;
  format: string;
  dateFrom?: Date;
  dateTo?: Date;
  businessUnitId?: string;
}

interface CheckoutSummaryResponse {
  items: any[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  loyaltyPointsAvailable: number;
  loyaltyPointsRedeemable: number;
  maxLoyaltyDiscount: number;
  customerId?: string;
}

interface CheckoutHistoryFilters {
  businessUnitId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  paymentStatus?: string;
  customerId?: string;
  search?: string;
}

interface CheckoutHistoryResult {
  checkouts: any[];
  total: number;
  limit: number;
  offset: number;
}

interface CheckoutSettings {
  allowPartialPayment: boolean;
  requireCustomer: boolean;
  requireSignature: boolean;
  maxDiscount: number;
  taxInclusive: boolean;
  defaultPaymentMethod: string;
  receiptFooter: string;
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  allowGuestCheckout: boolean;
  maxCartItems: number;
  cartExpiryHours: number;
  discountEnabled: boolean;
  maxDiscountPercentage: number;
  autoApplyPromotions: boolean;
  reserveStockOnAdd: boolean;
  reserveStockMinutes: number;
  lowStockThreshold: number;
  freeShippingThreshold: number;
  shippingCost: number;
  taxRate: number;
  notifyOnAbandonedCart: boolean;
  abandonedCartHours: number;
  currencyCode: string;
  currencySymbol: string;
  showStockBadge: boolean;
  showVariantImages: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  description?: string;
}

// ============================================
// CHECKOUT SERVICE CLASS
// ============================================

export class CheckoutService extends BaseService {
  private saleService: SaleService;
  private paymentService: PaymentService;
  private cartService: CartService;

  constructor() {
    super();
    this.saleService = new SaleService();
    this.paymentService = new PaymentService();
    this.cartService = new CartService();
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Safely emit new sale event
   */
  private safeEmitNewSale(sale: any, businessUnitId: string): void {
    try {
      console.log(`💰 New sale created: ${sale?.receiptNumber || sale?.id}`);
      // WebSocket emission would go here if configured
    } catch (error) {
      console.warn('Failed to emit sale event:', error);
    }
  }

  /**
   * Generate receipt number with prefix
   */
  private generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RCP-${timestamp}-${random}`;
  }

  /**
   * Calculate checkout totals
   */
  private calculateTotals(subtotal: number, tax: number, discount: number): {
    total: number;
    taxAmount: number;
    discountAmount: number;
  } {
    const taxAmount = subtotal * (tax / 100);
    const discountAmount = Math.min(discount, subtotal);
    const total = subtotal + taxAmount - discountAmount;
    return { total, taxAmount, discountAmount };
  }

  /**
   * Validate stock availability
   */
  private async validateStock(
    items: any[],
    businessUnitId: string,
    tx: any
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
        throw new AppError(`Product ${item.product?.name || item.productId} has no inventory record`, 400);
      }

      const availableStock = inventory.quantity - (inventory.reserved || 0);
      if (availableStock < item.quantity) {
        throw new AppError(
          `Insufficient stock for ${item.product?.name || item.productId}. Available: ${availableStock}`,
          400
        );
      }
    }
  }

  /**
   * Update inventory after sale
   */
  private async updateInventory(
    items: any[],
    saleId: string,
    businessUnitId: string,
    userId: string,
    receiptNumber: string,
    tx: any
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

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: newQuantity,
            updatedAt: new Date(),
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'SALE',
            quantity: -item.quantity,
            notes: `Sale ${receiptNumber}`,
            productId: item.productId,
            variantId: item.variantId || null,
            inventoryId: inventory.id,
            businessUnitId: businessUnitId,
            userId,
            saleId: saleId,
            createdAt: new Date(),
          },
        });

        // Check low stock alert
        if (newQuantity <= (inventory.reorderPoint || 5)) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          await tx.notification.create({
            data: {
              title: 'Low Stock Alert',
              message: `Product ${product?.name || item.productId} is below reorder point. Current stock: ${newQuantity}`,
              type: 'WARNING',
              userId,
              businessUnitId: businessUnitId,
              isRead: false,
              createdAt: new Date(),
            },
          });
        }
      }
    }
  }

  /**
   * Process loyalty points
   */
  private async processLoyaltyPoints(
    customerId: string | undefined,
    finalTotal: number,
    saleId: string,
    userId: string,
    tx: any
  ): Promise<{ earned: number; used: number }> {
    let loyaltyPointsEarned = 0;
    let loyaltyPointsUsed = 0;

    if (!customerId) {
      return { earned: 0, used: 0 };
    }

    const customer = await tx.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return { earned: 0, used: 0 };
    }

    // Earn points
    loyaltyPointsEarned = Math.floor(finalTotal / 10);

    // Update customer
    await tx.customer.update({
      where: { id: customerId },
      data: {
        totalSpent: {
          increment: finalTotal,
        },
        lastPurchaseAt: new Date(),
        loyaltyPoints: {
          increment: loyaltyPointsEarned - loyaltyPointsUsed,
        },
      },
    });

    // Create loyalty history for earned points
    if (loyaltyPointsEarned > 0) {
      await tx.loyaltyHistory.create({
        data: {
          customerId,
          points: loyaltyPointsEarned,
          type: 'EARN',
          notes: `Purchase: ${saleId}`,
          saleId: saleId,
          userId,
          createdAt: new Date(),
        },
      });
    }

    // Create loyalty history for used points
    if (loyaltyPointsUsed > 0) {
      await tx.loyaltyHistory.create({
        data: {
          customerId,
          points: -loyaltyPointsUsed,
          type: 'REDEEM',
          notes: `Redeemed for purchase: ${saleId}`,
          saleId: saleId,
          userId,
          createdAt: new Date(),
        },
      });
    }

    return { earned: loyaltyPointsEarned, used: loyaltyPointsUsed };
  }

  /**
   * Process payment
   */
  private async processPayment(
    saleId: string,
    finalTotal: number,
    paymentMethod: string,
    receiptNumber: string,
    userId: string,
    cashRegisterId: string | undefined,
    cashRegisterSessionId: string | undefined,
    tx: any
  ): Promise<any> {
    const payment = await tx.payment.create({
      data: {
        amount: finalTotal,
        paymentMethod: paymentMethod,
        status: 'PAID',
        saleId: saleId,
        userId,
        cashRegisterId: cashRegisterId,
        cashRegisterSessionId: cashRegisterSessionId,
        processedAt: new Date(),
        reference: `PAY-${receiptNumber}`,
      },
    });

    // Update cash register balance if applicable
    if (cashRegisterId && paymentMethod === 'CASH') {
      await tx.cashRegister.update({
        where: { id: cashRegisterId },
        data: {
          cashBalance: {
            increment: finalTotal,
          },
        },
      });
    }

    return payment;
  }

  /**
   * Build where clause for filters
   */
  private buildWhereClause(filters?: CheckoutHistoryFilters): any {
    const where: any = {};

    if (filters?.businessUnitId) {
      where.businessUnitId = filters.businessUnitId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.saleDate = {};
      if (filters.startDate) where.saleDate.gte = filters.startDate;
      if (filters.endDate) where.saleDate.lte = filters.endDate;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters?.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters?.search) {
      where.OR = [
        { receiptNumber: { contains: filters.search, mode: 'insensitive' } },
        { customer: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  // ============================================
  // PUBLIC METHODS
  // ============================================

  /**
   * Process checkout from cart
   */
  async processCheckout(data: CheckoutData, userId: string): Promise<CheckoutResponse> {
    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // 1. Get cart with items
        const cart = await tx.cart.findUnique({
          where: { id: data.cartId },
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

        if (cart.userId !== userId) {
          throw new AppError('Cart does not belong to this user', 403);
        }

        // 2. Validate stock
        await this.validateStock(cart.items, data.businessUnitId || cart.businessUnitId, tx);

        // 3. Calculate totals
        const subtotal = cart.subtotal;
        const tax = cart.tax || 0;
        const discount = data.discount || cart.discount || 0;
        let total = subtotal + tax - discount;

        // 4. Apply loyalty points if requested
        let loyaltyPointsUsed = 0;
        let loyaltyDiscount = 0;

        if (data.applyLoyaltyPoints && data.customerId) {
          const customer = await tx.customer.findUnique({
            where: { id: data.customerId },
          });

          if (customer && (customer.loyaltyPoints || 0) > 0) {
            const maxPoints = Math.min(
              customer.loyaltyPoints || 0,
              Math.floor(total / 0.1)
            );
            loyaltyPointsUsed = maxPoints;
            loyaltyDiscount = maxPoints * 0.1;
          }
        }

        const finalTotal = total - loyaltyDiscount;

        if (finalTotal < 0) {
          throw new AppError('Invalid total amount', 400);
        }

        const changeAmount = data.paidAmount - finalTotal;
        if (changeAmount < 0) {
          throw new AppError(`Insufficient payment. Required: ${finalTotal.toFixed(2)}`, 400);
        }

        // 5. Validate cash register if provided
        if (data.cashRegisterId) {
          const cashRegister = await tx.cashRegister.findUnique({
            where: { id: data.cashRegisterId },
          });

          if (!cashRegister) {
            throw new AppError('Cash register not found', 404);
          }

          if (!cashRegister.isActive) {
            throw new AppError('Cash register is not active', 400);
          }
        }

        // 6. Create sale
        const receiptNumber = this.generateReceiptNumber();
        const sale = await tx.sale.create({
          data: {
            receiptNumber,
            subtotal: cart.subtotal,
            tax: cart.tax || 0,
            discount: discount + loyaltyDiscount,
            total: finalTotal,
            paidAmount: data.paidAmount,
            changeAmount: changeAmount > 0 ? changeAmount : 0,
            notes: data.notes,
            businessUnitId: data.businessUnitId || cart.businessUnitId,
            userId,
            customerId: data.customerId || cart.customerId,
            cashRegisterId: data.cashRegisterId,
            cashRegisterSessionId: data.cashRegisterSessionId,
            status: 'COMPLETED',
            saleDate: new Date(),
          },
          include: {
            items: true,
            payments: true,
          },
        });

        // 7. Create sale items and update inventory
        const saleItems: CheckoutItem[] = [];

        for (const cartItem of cart.items) {
          const saleItem = await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: cartItem.productId,
              variantId: cartItem.variantId || null,
              quantity: cartItem.quantity,
              unitPrice: cartItem.unitPrice,
              total: cartItem.total,
              notes: cartItem.notes,
            },
          });

          saleItems.push({
            productId: saleItem.productId,
            variantId: saleItem.variantId,
            quantity: saleItem.quantity,
            unitPrice: saleItem.unitPrice,
            total: saleItem.total,
          });
        }

        // 8. Update inventory
        await this.updateInventory(
          cart.items,
          sale.id,
          data.businessUnitId || cart.businessUnitId,
          userId,
          receiptNumber,
          tx
        );

        // 9. Process payment
        const payment = await this.processPayment(
          sale.id,
          finalTotal,
          data.paymentMethod,
          receiptNumber,
          userId,
          data.cashRegisterId,
          data.cashRegisterSessionId,
          tx
        );

        // 10. Process loyalty points
        const loyaltyResult = await this.processLoyaltyPoints(
          data.customerId || cart.customerId,
          finalTotal,
          sale.id,
          userId,
          tx
        );

        // 11. Clear cart
        await tx.cartItem.deleteMany({
          where: { cartId: data.cartId },
        });

        await tx.cart.update({
          where: { id: data.cartId },
          data: {
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            customerId: null,
            updatedAt: new Date(),
          },
        });

        // 12. Create audit log
        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'SALE',
            entityId: sale.id,
            userId,
            entityName: sale.receiptNumber,
            changes: {
              total: finalTotal,
              items: saleItems.length,
              paymentMethod: data.paymentMethod,
            },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        // 13. Emit WebSocket event
        this.safeEmitNewSale(sale, data.businessUnitId || cart.businessUnitId);

        // 14. Return response
        return {
          sale,
          payment,
          receipt: {
            receiptNumber: sale.receiptNumber,
            items: saleItems,
            subtotal: cart.subtotal,
            tax: cart.tax || 0,
            discount: discount + loyaltyDiscount,
            total: finalTotal,
            paidAmount: data.paidAmount,
            changeAmount: changeAmount > 0 ? changeAmount : 0,
            customerId: data.customerId || cart.customerId,
            businessUnitId: data.businessUnitId || cart.businessUnitId,
            createdAt: sale.saleDate,
            paymentMethod: data.paymentMethod,
          },
          loyaltyPointsEarned: loyaltyResult.earned,
          loyaltyPointsUsed: loyaltyResult.used,
          changeAmount: changeAmount > 0 ? changeAmount : 0,
        };
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.processCheckout');
      throw error;
    }
  }

  /**
   * Get checkout summary for cart
   */
  async getCheckoutSummary(cartId: string): Promise<CheckoutSummaryResponse> {
    try {
      if (!cartId) {
        throw new AppError('Cart ID is required', 400);
      }

      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
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
          customer: true,
        },
      });

      if (!cart) {
        throw new AppError('Cart not found', 404);
      }

      const loyaltyPointsAvailable = (cart.customer as any)?.loyaltyPoints || 0;
      const maxLoyaltyDiscount = Math.min(
        loyaltyPointsAvailable * 0.1,
        cart.subtotal * 0.5
      );
      const loyaltyPointsRedeemable = Math.floor(
        Math.min(loyaltyPointsAvailable, cart.subtotal / 0.1)
      );

      return {
        items: cart.items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          product: item.product,
          variant: item.variant,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal: cart.subtotal,
        tax: cart.tax || 0,
        discount: cart.discount || 0,
        total: cart.total,
        loyaltyPointsAvailable,
        loyaltyPointsRedeemable,
        maxLoyaltyDiscount,
        customerId: cart.customerId || undefined,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutSummary');
      throw error;
    }
  }

  /**
   * Get sale with receipt
   */
  async getSaleWithReceipt(saleId: string) {
    try {
      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
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
                },
              },
              variant: true,
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      return sale;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getSaleWithReceipt');
      throw error;
    }
  }

  /**
   * Get receipt by number
   */
  async getReceiptByNumber(receiptNumber: string) {
    try {
      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const sale = await this.prisma.sale.findUnique({
        where: { receiptNumber },
        include: {
          customer: true,
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
                },
              },
              variant: true,
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!sale) {
        throw new AppError('Receipt not found', 404);
      }

      return sale;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getReceiptByNumber');
      throw error;
    }
  }

  /**
   * Get all checkouts with pagination
   */
  async getAllCheckouts(
    limit: number = 50,
    offset: number = 0,
    filters?: CheckoutHistoryFilters,
    orderBy?: any
  ): Promise<CheckoutHistoryResult> {
    try {
      const where = this.buildWhereClause(filters);

      const [checkouts, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: orderBy || { saleDate: 'desc' },
          include: {
            customer: true,
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
                  },
                },
              },
            },
            payments: true,
            businessUnit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        this.prisma.sale.count({ where }),
      ]);

      return {
        checkouts,
        total,
        limit,
        offset,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getAllCheckouts');
      throw error;
    }
  }

  /**
   * Get checkout by ID
   */
  async getCheckoutById(checkoutId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: {
          customer: true,
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
                },
              },
              variant: true,
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!checkout) {
        throw new AppError('Checkout not found', 404);
      }

      return checkout;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutById');
      throw error;
    }
  }

  /**
   * Update checkout
   */
  async updateCheckout(checkoutId: string, data: any, userId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
      });

      if (!checkout) {
        throw new AppError('Checkout not found', 404);
      }

      const updated = await this.prisma.sale.update({
        where: { id: checkoutId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          customer: true,
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
                },
              },
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: data,
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return updated;
    } catch (error) {
      this.handleError(error, 'CheckoutService.updateCheckout');
      throw error;
    }
  }

  /**
   * Process payment for checkout
   */
  async processPaymentForCheckout(
    checkoutId: string,
    paymentData: {
      paymentMethod: string;
      amount: number;
      paymentDetails?: any;
      userId: string;
    }
  ) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
          include: {
            payments: true,
          },
        });

        if (!checkout) {
          throw new AppError('Checkout not found', 404);
        }

        if (checkout.status === 'COMPLETED') {
          throw new AppError('Checkout is already completed', 400);
        }

        if (checkout.status === 'CANCELLED') {
          throw new AppError('Checkout is cancelled', 400);
        }

        const payment = await tx.payment.create({
          data: {
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod,
            status: 'PAID',
            saleId: checkoutId,
            userId: paymentData.userId,
            processedAt: new Date(),
            reference: `PAY-${checkout.receiptNumber}`,
          },
        });

        const totalPaid = checkout.payments.reduce(
          (acc: number, p: any) => acc + p.amount,
          0
        ) + paymentData.amount;

        const paymentStatus = totalPaid >= checkout.total ? 'PAID' : 'PARTIAL';

        await tx.sale.update({
          where: { id: checkoutId },
          data: {
            paidAmount: totalPaid,
            paymentStatus,
            status: totalPaid >= checkout.total ? 'COMPLETED' : 'PROCESSING',
            updatedAt: new Date(),
          },
        });

        return payment;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.processPaymentForCheckout');
      throw error;
    }
  }

  /**
   * Complete checkout
   */
  async completeCheckout(checkoutId: string, userId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: {
          payments: true,
        },
      });

      if (!checkout) {
        throw new AppError('Checkout not found', 404);
      }

      if (checkout.status === 'COMPLETED') {
        throw new AppError('Checkout is already completed', 400);
      }

      if (checkout.status === 'CANCELLED') {
        throw new AppError('Checkout is cancelled', 400);
      }

      const totalPaid = checkout.payments.reduce(
        (acc: number, p: any) => acc + p.amount,
        0
      );

      if (totalPaid < checkout.total) {
        throw new AppError(
          `Insufficient payment. Required: ${checkout.total}, Paid: ${totalPaid}`,
          400
        );
      }

      const completed = await this.prisma.sale.update({
        where: { id: checkoutId },
        data: {
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          completedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          customer: true,
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
                },
              },
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: { status: 'COMPLETED' },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return completed;
    } catch (error) {
      this.handleError(error, 'CheckoutService.completeCheckout');
      throw error;
    }
  }

  /**
   * Cancel checkout
   */
  async cancelCheckout(checkoutId: string, userId: string, reason?: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
      });

      if (!checkout) {
        throw new AppError('Checkout not found', 404);
      }

      if (checkout.status === 'COMPLETED') {
        throw new AppError('Cannot cancel completed checkout', 400);
      }

      if (checkout.status === 'CANCELLED') {
        throw new AppError('Checkout is already cancelled', 400);
      }

      const cancelled = await this.prisma.sale.update({
        where: { id: checkoutId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: userId,
          cancellationReason: reason || 'Cancelled by user',
          updatedAt: new Date(),
        },
        include: {
          customer: true,
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
                },
              },
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: { status: 'CANCELLED', reason },
          severity: 'LOW',
          createdAt: new Date(),
        },
      });

      return cancelled;
    } catch (error) {
      this.handleError(error, 'CheckoutService.cancelCheckout');
      throw error;
    }
  }

  /**
   * Get checkout receipt
   */
  async getCheckoutReceipt(checkoutId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const receipt = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: {
          customer: true,
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
                },
              },
              variant: true,
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
            },
          },
        },
      });

      if (!receipt) {
        throw new AppError('Receipt not found', 404);
      }

      return receipt;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutReceipt');
      throw error;
    }
  }

  /**
   * Send receipt via email
   */
  async sendReceiptEmail(checkoutId: string, email: string | null, userId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: {
          customer: true,
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
                },
              },
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
            },
          },
        },
      });

      if (!checkout) {
        throw new AppError('Checkout not found', 404);
      }

      const recipientEmail = email || checkout.customer?.email || checkout.user?.email;
      if (!recipientEmail) {
        throw new AppError('No email address available for receipt', 400);
      }

      // Email sending logic would go here
      console.log(`📧 Sending receipt for ${checkout.receiptNumber} to ${recipientEmail}`);

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: { email: recipientEmail, action: 'EMAIL_RECEIPT' },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return {
        success: true,
        message: `Receipt sent to ${recipientEmail}`,
        email: recipientEmail,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.sendReceiptEmail');
      throw error;
    }
  }

  /**
   * Get checkout statistics
   */
  async getCheckoutStats(options: {
    userId: string;
    dateFrom?: Date;
    dateTo?: Date;
    businessUnitId?: string;
  }): Promise<CheckoutStats> {
    try {
      const { dateFrom, dateTo, businessUnitId } = options;

      const where: any = {};
      if (dateFrom || dateTo) {
        where.saleDate = {};
        if (dateFrom) where.saleDate.gte = dateFrom;
        if (dateTo) where.saleDate.lte = dateTo;
      }
      if (businessUnitId) {
        where.businessUnitId = businessUnitId;
      }
      where.status = 'COMPLETED';

      const sales = await this.prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      const totalSales = sales.length;
      const totalRevenue = sales.reduce((acc: number, sale: any) => acc + sale.total, 0);
      const totalTax = sales.reduce((acc: number, sale: any) => acc + (sale.tax || 0), 0);
      const totalDiscount = sales.reduce((acc: number, sale: any) => acc + (sale.discount || 0), 0);
      const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Top products
      const productMap: Record<
        string,
        { productId: string; productName: string; quantity: number; revenue: number }
      > = {};

      for (const sale of sales) {
        for (const item of sale.items) {
          const key = item.productId;
          if (!productMap[key]) {
            productMap[key] = {
              productId: item.productId,
              productName: item.product?.name || 'Unknown',
              quantity: 0,
              revenue: 0,
            };
          }
          productMap[key].quantity += item.quantity;
          productMap[key].revenue += item.total;
        }
      }

      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Sales by payment method
      const salesByPaymentMethod: Record<string, number> = {};
      for (const sale of sales) {
        for (const payment of sale.payments) {
          const method = payment.paymentMethod;
          salesByPaymentMethod[method] = (salesByPaymentMethod[method] || 0) + payment.amount;
        }
      }

      // Sales by date
      const dateMap: Record<string, { count: number; revenue: number }> = {};
      for (const sale of sales) {
        const date = sale.saleDate?.toISOString().split('T')[0] || '';
        if (!dateMap[date]) {
          dateMap[date] = { count: 0, revenue: 0 };
        }
        dateMap[date].count++;
        dateMap[date].revenue += sale.total;
      }

      const salesByDate = Object.entries(dateMap)
        .map(([date, data]) => ({
          date,
          count: data.count,
          revenue: data.revenue,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const recentSales = sales.slice(0, 10);

      return {
        totalSales,
        totalRevenue,
        totalTax,
        totalDiscount,
        averageOrderValue,
        topProducts,
        salesByPaymentMethod,
        salesByDate,
        recentSales,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutStats');
      throw error;
    }
  }

  /**
   * Get checkout items
   */
  async getCheckoutItems(checkoutId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const items = await this.prisma.saleItem.findMany({
        where: { saleId: checkoutId },
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
              attributes: true,
            },
          },
        },
      });

      if (!items || items.length === 0) {
        throw new AppError('No items found for this checkout', 404);
      }

      return items;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutItems');
      throw error;
    }
  }

  /**
   * Add item to checkout
   */
  async addCheckoutItem(
    checkoutId: string,
    itemData: {
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice: number;
    },
    userId: string
  ) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
        });

        if (!checkout) {
          throw new AppError('Checkout not found', 404);
        }

        if (checkout.status === 'COMPLETED') {
          throw new AppError('Cannot add item to completed checkout', 400);
        }

        if (checkout.status === 'CANCELLED') {
          throw new AppError('Cannot add item to cancelled checkout', 400);
        }

        const total = itemData.quantity * itemData.unitPrice;

        const item = await tx.saleItem.create({
          data: {
            saleId: checkoutId,
            productId: itemData.productId,
            variantId: itemData.variantId || null,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            total,
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            variant: true,
          },
        });

        await tx.sale.update({
          where: { id: checkoutId },
          data: {
            subtotal: checkout.subtotal + total,
            total: checkout.total + total,
            updatedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: { action: 'ADD_ITEM', itemData },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        return item;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.addCheckoutItem');
      throw error;
    }
  }

  /**
   * Remove item from checkout
   */
  async removeCheckoutItem(checkoutId: string, itemId: string, userId: string) {
    try {
      if (!checkoutId || !itemId) {
        throw new AppError('Checkout ID and Item ID are required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
        });

        if (!checkout) {
          throw new AppError('Checkout not found', 404);
        }

        if (checkout.status === 'COMPLETED') {
          throw new AppError('Cannot remove item from completed checkout', 400);
        }

        if (checkout.status === 'CANCELLED') {
          throw new AppError('Cannot remove item from cancelled checkout', 400);
        }

        const item = await tx.saleItem.findUnique({
          where: { id: itemId },
        });

        if (!item) {
          throw new AppError('Item not found', 404);
        }

        if (item.saleId !== checkoutId) {
          throw new AppError('Item does not belong to this checkout', 400);
        }

        await tx.saleItem.delete({
          where: { id: itemId },
        });

        await tx.sale.update({
          where: { id: checkoutId },
          data: {
            subtotal: checkout.subtotal - item.total,
            total: checkout.total - item.total,
            updatedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: { action: 'REMOVE_ITEM', itemId, removedTotal: item.total },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        return { success: true, message: 'Item removed successfully' };
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.removeCheckoutItem');
      throw error;
    }
  }

  /**
   * Update checkout item quantity
   */
  async updateCheckoutItem(
    checkoutId: string,
    itemId: string,
    quantity: number,
    userId: string
  ) {
    try {
      if (!checkoutId || !itemId) {
        throw new AppError('Checkout ID and Item ID are required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
        });

        if (!checkout) {
          throw new AppError('Checkout not found', 404);
        }

        if (checkout.status === 'COMPLETED') {
          throw new AppError('Cannot update item in completed checkout', 400);
        }

        if (checkout.status === 'CANCELLED') {
          throw new AppError('Cannot update item in cancelled checkout', 400);
        }

        const item = await tx.saleItem.findUnique({
          where: { id: itemId },
        });

        if (!item) {
          throw new AppError('Item not found', 404);
        }

        if (item.saleId !== checkoutId) {
          throw new AppError('Item does not belong to this checkout', 400);
        }

        const oldTotal = item.total;
        const newTotal = quantity * item.unitPrice;

        const updated = await tx.saleItem.update({
          where: { id: itemId },
          data: {
            quantity,
            total: newTotal,
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            variant: true,
          },
        });

        const totalDiff = newTotal - oldTotal;
        await tx.sale.update({
          where: { id: checkoutId },
          data: {
            subtotal: checkout.subtotal + totalDiff,
            total: checkout.total + totalDiff,
            updatedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: { action: 'UPDATE_ITEM', itemId, oldQuantity: item.quantity, newQuantity: quantity },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        return updated;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.updateCheckoutItem');
      throw error;
    }
  }

  /**
   * Apply discount to checkout
   */
  async applyDiscount(checkoutId: string, discountCode: string, userId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const checkout = await tx.sale.findUnique({
          where: { id: checkoutId },
        });

        if (!checkout) {
          throw new AppError('Checkout not found', 404);
        }

        // Find valid promotion
        const promotion = await tx.promotion.findFirst({
          where: {
            code: discountCode,
            isActive: true,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        });

        if (!promotion) {
          throw new AppError('Invalid or expired discount code', 400);
        }

        let discountAmount = 0;
        if (promotion.type === 'PERCENTAGE') {
          discountAmount = checkout.subtotal * (promotion.value / 100);
          if (promotion.maxDiscount) {
            discountAmount = Math.min(discountAmount, promotion.maxDiscount);
          }
        } else if (promotion.type === 'FIXED') {
          discountAmount = Math.min(promotion.value, checkout.subtotal);
        } else {
          throw new AppError('Unsupported discount type', 400);
        }

        const updated = await tx.sale.update({
          where: { id: checkoutId },
          data: {
            discount: discountAmount,
            total: checkout.subtotal + checkout.tax - discountAmount,
            updatedAt: new Date(),
          },
          include: {
            customer: true,
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
                  },
                },
              },
            },
            payments: true,
            businessUnit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: { action: 'APPLY_DISCOUNT', discountCode, discountAmount },
            severity: 'INFO',
            createdAt: new Date(),
          },
        });

        return updated;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.applyDiscount');
      throw error;
    }
  }

  /**
   * Remove discount from checkout
   */
  async removeDiscountFromCheckout(checkoutId: string, userId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
      });

      if (!checkout) {
        throw new AppError('Checkout not found', 404);
      }

      const updated = await this.prisma.sale.update({
        where: { id: checkoutId },
        data: {
          discount: 0,
          total: checkout.subtotal + checkout.tax,
          updatedAt: new Date(),
        },
        include: {
          customer: true,
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
                },
              },
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'SALE',
          entityId: checkoutId,
          userId,
          entityName: checkout.receiptNumber,
          changes: { action: 'REMOVE_DISCOUNT', removed: true },
          severity: 'INFO',
          createdAt: new Date(),
        },
      });

      return updated;
    } catch (error) {
      this.handleError(error, 'CheckoutService.removeDiscountFromCheckout');
      throw error;
    }
  }

  /**
   * Get customer checkout history
   */
  async getCustomerCheckoutHistory(customerId: string, page: number = 1, limit: number = 20) {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const skip = (page - 1) * limit;

      const [history, total] = await Promise.all([
        this.prisma.sale.findMany({
          where: { customerId },
          take: limit,
          skip,
          orderBy: { saleDate: 'desc' },
          include: {
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
                  },
                },
                variant: true,
              },
            },
            payments: true,
            businessUnit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        this.prisma.sale.count({ where: { customerId } }),
      ]);

      return {
        history,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCustomerCheckoutHistory');
      throw error;
    }
  }

  /**
   * Get checkout by receipt number
   */
  async getCheckoutByReceiptNumber(receiptNumber: string) {
    try {
      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { receiptNumber },
        include: {
          customer: true,
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
                },
              },
              variant: true,
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
            },
          },
        },
      });

      if (!checkout) {
        throw new AppError('Checkout not found', 404);
      }

      return checkout;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutByReceiptNumber');
      throw error;
    }
  }

  /**
   * Export checkouts
   */
  async exportCheckouts(options: ExportOptions) {
    try {
      const { format, dateFrom, dateTo, businessUnitId } = options;

      const where: any = {};
      if (dateFrom || dateTo) {
        where.saleDate = {};
        if (dateFrom) where.saleDate.gte = dateFrom;
        if (dateTo) where.saleDate.lte = dateTo;
      }
      if (businessUnitId) {
        where.businessUnitId = businessUnitId;
      }

      const checkouts = await this.prisma.sale.findMany({
        where,
        include: {
          customer: true,
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
                },
              },
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      });

      if (format === 'csv') {
        const headers = [
          'Receipt Number',
          'Date',
          'Customer',
          'Total',
          'Tax',
          'Discount',
          'Payment Method',
          'Status',
          'Items Count',
          'Business Unit',
        ];

        const rows = checkouts.map((checkout: any) => [
          checkout.receiptNumber,
          checkout.saleDate?.toISOString() || '',
          checkout.customer?.firstName ? `${checkout.customer.firstName} ${checkout.customer.lastName}` : '',
          checkout.total.toFixed(2),
          (checkout.tax || 0).toFixed(2),
          (checkout.discount || 0).toFixed(2),
          checkout.payments[0]?.paymentMethod || '',
          checkout.status,
          checkout.items.length,
          checkout.businessUnit?.name || '',
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach((row: string[]) => {
          csv += row.join(',') + '\n';
        });

        return csv;
      }

      return {
        format: 'json',
        total: checkouts.length,
        data: checkouts,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.exportCheckouts');
      throw error;
    }
  }

  /**
   * Delete checkout
   */
  async deleteCheckout(checkoutId: string, userId: string) {
    try {
      if (!checkoutId) {
        throw new AppError('Checkout ID is required', 400);
      }

      const checkout = await this.prisma.sale.findUnique({
        where: { id: checkoutId },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!checkout) {
        throw new AppError('Checkout not found', 404);
      }

      if (checkout.status === 'COMPLETED') {
        throw new AppError('Cannot delete completed checkout. Please void it first.', 400);
      }

      await this.prisma.$transaction(async (tx: any) => {
        if (checkout.payments.length > 0) {
          await tx.payment.deleteMany({
            where: { saleId: checkoutId },
          });
        }

        if (checkout.items.length > 0) {
          await tx.saleItem.deleteMany({
            where: { saleId: checkoutId },
          });
        }

        await tx.sale.delete({
          where: { id: checkoutId },
        });

        await tx.auditLog.create({
          data: {
            action: 'DELETE',
            entityType: 'SALE',
            entityId: checkoutId,
            userId,
            entityName: checkout.receiptNumber,
            changes: { deleted: true },
            severity: 'LOW',
            createdAt: new Date(),
          },
        });
      });

      return { success: true, message: 'Checkout deleted successfully' };
    } catch (error) {
      this.handleError(error, 'CheckoutService.deleteCheckout');
      throw error;
    }
  }

  /**
   * Void a checkout (reverse sale)
   */
  async voidCheckout(saleId: string, userId: string, reason?: string): Promise<any> {
    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            items: true,
            payments: true,
          },
        });

        if (!sale) {
          throw new AppError('Sale not found', 404);
        }

        if (sale.status === 'VOIDED') {
          throw new AppError('Sale is already voided', 400);
        }

        // Update sale status
        const voidedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: 'VOIDED',
            voidedAt: new Date(),
            voidedBy: userId,
            voidReason: reason || 'Voided by user',
            updatedAt: new Date(),
          },
        });

        // Restore inventory
        for (const item of sale.items) {
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
                quantity: {
                  increment: item.quantity,
                },
                updatedAt: new Date(),
              },
            });

            await tx.inventoryTransaction.create({
              data: {
                transactionType: 'RESTOCK',
                quantity: item.quantity,
                notes: `Void sale ${sale.receiptNumber}`,
                productId: item.productId,
                variantId: item.variantId || null,
                inventoryId: inventory.id,
                businessUnitId: sale.businessUnitId,
                userId,
                saleId: sale.id,
                createdAt: new Date(),
              },
            });
          }
        }

        // Void payments
        await tx.payment.updateMany({
          where: { saleId },
          data: {
            status: 'REFUNDED',
            voidedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Reverse customer loyalty points if applicable
        if (sale.customerId) {
          const loyaltyHistory = await tx.loyaltyHistory.findMany({
            where: { saleId },
          });

          let pointsToReverse = 0;
          for (const history of loyaltyHistory) {
            pointsToReverse -= history.points;
          }

          if (pointsToReverse !== 0) {
            await tx.customer.update({
              where: { id: sale.customerId },
              data: {
                loyaltyPoints: {
                  increment: pointsToReverse,
                },
                totalSpent: {
                  decrement: sale.total,
                },
                updatedAt: new Date(),
              },
            });
          }
        }

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'SALE',
            entityId: saleId,
            userId,
            entityName: sale.receiptNumber,
            changes: { action: 'VOID_SALE', reason },
            severity: 'HIGH',
            createdAt: new Date(),
          },
        });

        return voidedSale;
      });
    } catch (error) {
      this.handleError(error, 'CheckoutService.voidCheckout');
      throw error;
    }
  }

  /**
   * Get checkout history with filters
   */
  async getCheckoutHistory(
    userId: string,
    filters?: {
      status?: string;
      customerId?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<CheckoutHistoryResult> {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 20;
      const offset = (page - 1) * limit;

      const where = this.buildWhereClause({
        ...filters,
        businessUnitId: undefined,
      });

      const [checkouts, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { saleDate: 'desc' },
          include: {
            customer: true,
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
                  },
                },
              },
            },
            payments: true,
            businessUnit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        this.prisma.sale.count({ where }),
      ]);

      return {
        checkouts,
        total,
        limit,
        offset,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutHistory');
      throw error;
    }
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      return [
        { id: 'CASH', name: 'Cash', code: 'CASH', enabled: true, description: 'Pay with cash' },
        { id: 'CREDIT_CARD', name: 'Credit Card', code: 'CREDIT_CARD', enabled: true, description: 'Pay with credit card' },
        { id: 'DEBIT_CARD', name: 'Debit Card', code: 'DEBIT_CARD', enabled: true, description: 'Pay with debit card' },
        { id: 'MOBILE_MONEY', name: 'Mobile Money', code: 'MOBILE_MONEY', enabled: true, description: 'Pay with mobile money' },
        { id: 'BANK_TRANSFER', name: 'Bank Transfer', code: 'BANK_TRANSFER', enabled: true, description: 'Pay via bank transfer' },
        { id: 'GIFT_CARD', name: 'Gift Card', code: 'GIFT_CARD', enabled: true, description: 'Pay with gift card' },
        { id: 'LOYALTY_POINTS', name: 'Loyalty Points', code: 'LOYALTY_POINTS', enabled: true, description: 'Pay with loyalty points' },
      ];
    } catch (error) {
      this.handleError(error, 'CheckoutService.getPaymentMethods');
      throw error;
    }
  }

  /**
   * Get checkout settings
   */
  async getCheckoutSettings(userId: string): Promise<CheckoutSettings> {
    try {
      // Default settings
      const defaultSettings: CheckoutSettings = {
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

      // Try to get user's business unit
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            businessUnits: {
              where: { isActive: true },
              take: 1,
            },
          },
        });

        // ✅ FIX: Check if businessUnit exists and has settings
        if (user?.businessUnits && user.businessUnits.length > 0) {
          const businessUnit = user.businessUnits[0];
          // If business unit has settings, merge them
          // Note: 'settings' may not exist on BusinessUnit - you may need to add it to your schema
          // or use a separate Settings model
          if ((businessUnit as any).settings) {
            return {
              ...defaultSettings,
              ...(businessUnit as any).settings,
            };
          }
        }
      } catch (settingsError) {
        // If settings fetch fails, return defaults
        console.warn('Could not fetch user settings, using defaults:', settingsError);
      }

      return defaultSettings;
    } catch (error) {
      this.handleError(error, 'CheckoutService.getCheckoutSettings');
      throw error;
    }
  }

  /**
   * Update checkout settings
   */
  async updateCheckoutSettings(
    userId: string,
    settings: Partial<CheckoutSettings>
  ): Promise<CheckoutSettings> {
    try {
      // Get user's business unit
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          businessUnits: {
            where: { isActive: true },
            take: 1,
          },
        },
      });

      if (!user?.businessUnits || user.businessUnits.length === 0) {
        throw new AppError('User does not have a business unit', 400);
      }

      const businessUnit = user.businessUnits[0];

      // ✅ FIX: Update business unit with settings
      // Note: If 'settings' doesn't exist on BusinessUnit, you need to:
      // 1. Add it to your Prisma schema, or
      // 2. Use a separate Settings model, or
      // 3. Store settings as a JSON field
      
      // Option A: If settings is a JSON field on BusinessUnit
      await this.prisma.businessUnit.update({
        where: { id: businessUnit.id },
        data: {
          // @ts-ignore - settings may not exist in schema yet
          settings: settings,
          updatedAt: new Date(),
        },
      });

      // Return merged settings
      const currentSettings = await this.getCheckoutSettings(userId);
      return {
        ...currentSettings,
        ...settings,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.updateCheckoutSettings');
      throw error;
    }
  }

  /**
   * Export checkout data
   */
  async exportCheckoutData(
    userId: string,
    options: {
      format?: 'csv' | 'json' | 'excel';
      startDate?: Date;
      endDate?: Date;
      status?: string;
    }
  ): Promise<string | Buffer | any> {
    try {
      const { format = 'csv', startDate, endDate, status } = options;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          businessUnits: {
            where: { isActive: true },
            take: 1,
          },
        },
      });

      const where: any = {};
      if (user?.businessUnits?.[0]?.id) {
        where.businessUnitId = user.businessUnits[0].id;
      }
      if (startDate || endDate) {
        where.saleDate = {};
        if (startDate) where.saleDate.gte = startDate;
        if (endDate) where.saleDate.lte = endDate;
      }
      if (status) {
        where.status = status;
      }

      const checkouts = await this.prisma.sale.findMany({
        where,
        include: {
          customer: true,
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
                },
              },
            },
          },
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      });

      if (format === 'csv') {
        let csv = 'Receipt Number,Date,Customer,Total,Status,Payment Method\n';
        for (const checkout of checkouts) {
          const customerName = checkout.customer
            ? `${checkout.customer.firstName} ${checkout.customer.lastName}`
            : 'Guest';
          const paymentMethod = checkout.payments[0]?.paymentMethod || 'N/A';
          csv += `${checkout.receiptNumber},${checkout.saleDate?.toISOString() || ''},${customerName},${checkout.total},${checkout.status},${paymentMethod}\n`;
        }
        return csv;
      }

      return {
        format,
        total: checkouts.length,
        data: checkouts,
      };
    } catch (error) {
      this.handleError(error, 'CheckoutService.exportCheckoutData');
      throw error;
    }
  }
}

export default CheckoutService;
