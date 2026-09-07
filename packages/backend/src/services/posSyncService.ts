// src/services/posService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { CartService } from './cartService.js';
import { CheckoutService } from './checkoutService.js';
import { SaleService } from './saleService.js';
import { ProductService } from './productService.js';
import { CustomerService } from './customerService.js';
import { PaymentService } from './paymentService.js';
import { InventoryService } from './inventoryService.js';
import { NotificationService } from './notificationService.js';
import { realtimeService } from './realtimeService.js';
import { generateReceiptNumber, calculateTotal } from '../utils/helpers.js';
import * as crypto from 'crypto';
import { logger } from '../lib/logger.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface POSItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
}

interface POSCheckoutData {
  cartId: string;
  customerId?: string;
  paymentMethod: string;
  paidAmount: number;
  discount?: number;
  notes?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  applyLoyaltyPoints?: boolean;
  tipAmount?: number;
}

interface POSCustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
  companyId: string;
}

interface POSSummary {
  cart: any;
  inventoryStatus: any;
  hasIssues: boolean;
  issues: string[];
  summary: {
    itemCount: number;
    totalItems: number;
    totalValue: number;
    subtotal: number;
    tax: number;
    discount: number;
  };
}

interface POSRegisterStatus {
  sessions: any[];
  totalOpenSessions: number;
  totalCash: number;
  totalSales: number;
  totalRevenue: number;
}

interface POSStats {
  today: {
    revenue: number;
    sales: number;
    averageTicket: number;
    itemsSold: number;
  };
  cartCount: number;
  activeSessions: number;
  lowStockCount: number;
  pendingOrders: number;
}

// ============================================
// POS SERVICE CLASS
// ============================================

export class POSService extends BaseService {
  private cartService: CartService;
  private checkoutService: CheckoutService;
  private saleService: SaleService;
  private productService: ProductService;
  private customerService: CustomerService;
  private paymentService: PaymentService;
  private inventoryService: InventoryService;
  private notificationService: NotificationService;

  constructor() {
    super();
    this.cartService = new CartService();
    this.checkoutService = new CheckoutService();
    this.saleService = new SaleService();
    this.productService = new ProductService();
    this.customerService = new CustomerService();
    this.paymentService = new PaymentService();
    this.inventoryService = new InventoryService();
    this.notificationService = new NotificationService();
    
    logger.info('POSService initialized with all dependencies');
  }

  // ============================================
  // CART OPERATIONS
  // ============================================

  /**
   * Get or create POS cart using CartService
   */
  async getCart(userId: string, businessUnitId: string) {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      return await this.cartService.getOrCreateCart(userId, businessUnitId);
    } catch (error) {
      this.handleError(error, 'POSService.getCart');
    }
  }

  /**
   * Get cart with full details and inventory status
   */
  async getCartDetails(userId: string, businessUnitId: string) {
    try {
      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const syncResult = await this.cartService.syncCartWithInventory(
        cart.id,
        businessUnitId
      );

      const fullCart = await this.prisma.cart.findUnique({
        where: { id: cart.id },
        include: {
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
                  inventory: {
                    where: { businessUnitId },
                    select: {
                      id: true,
                      quantity: true,
                      reserved: true,
                      reorderPoint: true,
                      location: true,
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
            orderBy: { createdAt: 'asc' },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              loyaltyPoints: true,
              totalSpent: true,
            },
          },
        },
      });

      if (!fullCart) {
        throw new AppError('Cart not found', 404);
      }

      const itemsWithStock = fullCart.items.map((item: any) => {
        const inventory = item.product.inventory;
        const availableStock = inventory
          ? Math.max(0, inventory.quantity - (inventory.reserved || 0))
          : 0;

        return {
          ...item,
          availableStock,
          isAvailable: availableStock >= item.quantity,
        };
      });

      return {
        cart: {
          ...fullCart,
          items: itemsWithStock,
        },
        inventoryStatus: syncResult,
      };
    } catch (error) {
      this.handleError(error, 'POSService.getCartDetails');
    }
  }

  /**
   * Clear POS cart using CartService
   */
  async clearCart(userId: string, businessUnitId: string) {
    try {
      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      const updatedCart = await this.cartService.clearCart(cart.id);

      (realtimeService as any).emitCartUpdated?.(updatedCart, businessUnitId);

      return updatedCart;
    } catch (error) {
      this.handleError(error, 'POSService.clearCart');
    }
  }

  /**
   * Add item to cart using CartService
   */
  async addItem(userId: string, businessUnitId: string, item: POSItem) {
    try {
      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const updatedCart = await this.cartService.addItemToCart(
        cart.id,
        item,
        userId,
        businessUnitId
      );

      (realtimeService as any).emitCartUpdated?.(updatedCart, businessUnitId);

      return updatedCart;
    } catch (error) {
      this.handleError(error, 'POSService.addItem');
    }
  }

  /**
   * Add multiple items to cart using CartService
   */
  async addMultipleItems(userId: string, businessUnitId: string, items: POSItem[]) {
    try {
      if (!items || items.length === 0) {
        throw new AppError('At least one item is required', 400);
      }

      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const updatedCart = await this.cartService.addMultipleItemsToCart(
        cart.id,
        items,
        userId,
        businessUnitId
      );

      (realtimeService as any).emitCartUpdated?.(updatedCart, businessUnitId);

      return updatedCart;
    } catch (error) {
      this.handleError(error, 'POSService.addMultipleItems');
    }
  }

  /**
   * Update cart item quantity using CartService
   */
  async updateItemQuantity(
    userId: string,
    businessUnitId: string,
    itemId: string,
    quantity: number
  ) {
    try {
      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const updatedCart = await this.cartService.updateCartItemQuantity(
        cart.id,
        itemId,
        quantity,
        businessUnitId
      );

      (realtimeService as any).emitCartUpdated?.(updatedCart, businessUnitId);

      return updatedCart;
    } catch (error) {
      this.handleError(error, 'POSService.updateItemQuantity');
    }
  }

  /**
   * Remove item from cart using CartService
   */
  async removeItem(userId: string, businessUnitId: string, itemId: string) {
    try {
      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const updatedCart = await this.cartService.removeItemFromCart(cart.id, itemId);

      (realtimeService as any).emitCartUpdated?.(updatedCart, businessUnitId);

      return updatedCart;
    } catch (error) {
      this.handleError(error, 'POSService.removeItem');
    }
  }

  /**
   * Apply discount to cart using CartService
   */
  async applyDiscount(userId: string, businessUnitId: string, discount: number) {
    try {
      if (discount < 0) {
        throw new AppError('Discount cannot be negative', 400);
      }

      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const updatedCart = await this.cartService.applyDiscount(cart.id, discount);

      (realtimeService as any).emitCartUpdated?.(updatedCart, businessUnitId);

      return updatedCart;
    } catch (error) {
      this.handleError(error, 'POSService.applyDiscount');
    }
  }

  /**
   * Apply loyalty points to cart using CartService
   */
  async applyLoyaltyPoints(userId: string, businessUnitId: string, customerId: string, points: number) {
    try {
      if (!customerId || points <= 0) {
        throw new AppError('Valid customer ID and points are required', 400);
      }

      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const updatedCart = await this.cartService.applyLoyaltyPoints(
        cart.id,
        customerId,
        points
      );

      (realtimeService as any).emitCartUpdated?.(updatedCart, businessUnitId);

      return updatedCart;
    } catch (error) {
      this.handleError(error, 'POSService.applyLoyaltyPoints');
    }
  }

  /**
   * Associate customer with cart using CartService
   */
  async associateCustomer(userId: string, businessUnitId: string, customerId: string) {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const updatedCart = await this.cartService.associateCustomer(cart.id, customerId);

      (realtimeService as any).emitCartUpdated?.(updatedCart, businessUnitId);

      return updatedCart;
    } catch (error) {
      this.handleError(error, 'POSService.associateCustomer');
    }
  }

  // ============================================
  // CHECKOUT OPERATIONS
  // ============================================

  /**
   * Process POS checkout using CheckoutService
   */
  async processCheckout(userId: string, businessUnitId: string, data: POSCheckoutData) {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit are required', 400);
      }

      const validMethods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD'];
      if (!validMethods.includes(data.paymentMethod)) {
        throw new AppError(`Invalid payment method. Must be one of: ${validMethods.join(', ')}`, 400);
      }

      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);

      if (cart.items.length === 0) {
        throw new AppError('Cart is empty', 400);
      }

      const result = await this.checkoutService.processCheckout(
        {
          cartId: cart.id,
          customerId: data.customerId,
          paymentMethod: data.paymentMethod,
          paidAmount: data.paidAmount,
          discount: data.discount,
          notes: data.notes,
          cashRegisterId: data.cashRegisterId,
          cashRegisterSessionId: data.cashRegisterSessionId,
          applyLoyaltyPoints: data.applyLoyaltyPoints,
        },
        userId
      );

      (realtimeService as any).emitSaleCreated?.(result.sale, businessUnitId);
      (realtimeService as any).emitCartUpdated?.({ ...cart, items: [] }, businessUnitId);

      if (result.sale.total >= 1000) {
        try {
          await this.notificationService.sendSaleNotification(businessUnitId, result.sale.id);
        } catch (notifError) {
          logger.warn('Failed to send sale notification:', notifError);
        }
      }

      return result;
    } catch (error) {
      this.handleError(error, 'POSService.processCheckout');
    }
  }

  // ============================================
  // PRODUCT OPERATIONS
  // ============================================

  /**
   * Search products using ProductService
   */
  async searchProducts(businessUnitId: string, query: string, category?: string, limit: number = 10) {
    try {
      if (!query || query.trim().length === 0) {
        throw new AppError('Search query is required', 400);
      }

      const products = await this.productService.searchProducts({
        query,
        category,
        businessUnitId,
      });

      return products.slice(0, limit).map((product: any) => {
        const inventory = product.inventory;

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unitPrice: product.unitPrice,
          costPrice: product.costPrice,
          images: product.images || [],
          category: product.category?.name || null,
          categoryId: product.category?.id || null,
          inventory: inventory ? {
            id: inventory.id,
            quantity: inventory.quantity,
            reserved: inventory.reserved || 0,
            available: Math.max(0, inventory.quantity - (inventory.reserved || 0)),
            location: inventory.location,
          } : null,
          variants: product.variants || [],
          isAvailable: inventory
            ? (inventory.quantity - (inventory.reserved || 0)) > 0
            : false,
        };
      });
    } catch (error) {
      this.handleError(error, 'POSService.searchProducts');
    }
  }

  /**
   * Get product by barcode using ProductService
   */
  async getProductByBarcode(businessUnitId: string, barcode: string) {
    try {
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      const product = await this.productService.getProductByBarcode(barcode, businessUnitId);

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const inventory = product.inventory;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unitPrice: product.unitPrice,
        costPrice: product.costPrice,
        images: product.images || [],
        category: product.category?.name || null,
        inventory: inventory ? {
          id: inventory.id,
          quantity: inventory.quantity,
          reserved: inventory.reserved || 0,
          available: Math.max(0, inventory.quantity - (inventory.reserved || 0)),
        } : null,
        variants: product.variants || [],
        isAvailable: inventory
          ? (inventory.quantity - (inventory.reserved || 0)) > 0
          : false,
      };
    } catch (error) {
      this.handleError(error, 'POSService.getProductByBarcode');
    }
  }

  /**
   * Get product by SKU using ProductService
   */
  async getProductBySku(businessUnitId: string, sku: string) {
    try {
      if (!sku) {
        throw new AppError('SKU is required', 400);
      }

      const product = await this.productService.getProductBySku(sku, businessUnitId);

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const inventory = product.inventory;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unitPrice: product.unitPrice,
        images: product.images || [],
        category: product.category?.name || null,
        inventory: inventory ? {
          quantity: inventory.quantity,
          reserved: inventory.reserved || 0,
          available: Math.max(0, inventory.quantity - (inventory.reserved || 0)),
        } : null,
        variants: product.variants || [],
      };
    } catch (error) {
      this.handleError(error, 'POSService.getProductBySku');
    }
  }

  /**
   * Get popular products
   */
  async getPopularProducts(businessUnitId: string, limit: number = 10) {
    try {
      const popularItems = await this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: {
            businessUnitId,
            status: { not: 'CANCELLED' },
            saleDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        _sum: {
          quantity: true,
          total: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: limit,
      });

      const productIds = popularItems.map((p: any) => p.productId);
      
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
          businessUnitId,
        },
        include: {
          inventory: {
            where: { businessUnitId },
            select: {
              quantity: true,
              reserved: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return products.map((product: any) => {
        const popularItem = popularItems.find((p: any) => p.productId === product.id);
        const inventory = product.inventory;

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.unitPrice,
          images: product.images || [],
          category: product.category?.name || null,
          inventory: inventory ? {
            available: Math.max(0, inventory.quantity - (inventory.reserved || 0)),
          } : { available: 0 },
          soldCount: popularItem?._sum.quantity || 0,
          revenue: popularItem?._sum.total || 0,
        };
      });
    } catch (error) {
      this.handleError(error, 'POSService.getPopularProducts');
    }
  }

  // ============================================
  // CUSTOMER OPERATIONS
  // ============================================

  /**
   * Search customers using CustomerService
   */
  async searchCustomers(query: string, limit: number = 10) {
    try {
      if (!query || query.trim().length === 0) {
        throw new AppError('Search query is required', 400);
      }

      const result = await this.customerService.getAllCustomers({
        search: query,
        page: 1,
        limit,
      });

      return result.customers.map((customer: any) => ({
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        loyaltyPoints: customer.loyaltyPoints || 0,
        totalSpent: customer.totalSpent || 0,
        lastPurchaseAt: customer.lastPurchaseAt,
        isActive: customer.isActive,
      }));
    } catch (error) {
      this.handleError(error, 'POSService.searchCustomers');
    }
  }

  /**
   * Get customer by ID using CustomerService
   */
  async getCustomer(customerId: string) {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await this.customerService.getCustomerById(customerId);

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      return {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
        phoneNumber: customer.phoneNumber,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        zipCode: customer.zipCode,
        country: customer.country,
        loyaltyPoints: customer.loyaltyPoints || 0,
        totalSpent: customer.totalSpent || 0,
        lastPurchaseAt: customer.lastPurchaseAt,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
      };
    } catch (error) {
      this.handleError(error, 'POSService.getCustomer');
    }
  }

  /**
   * Create customer using CustomerService
   */
  async createCustomer(data: POSCustomerData) {
    try {
      const customer = await this.customerService.createCustomer({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country || 'Uganda',
        notes: data.notes,
        companyId: data.companyId,
      });

      (realtimeService as any).emitCustomerUpdated?.(customer, data.companyId);

      return {
        ...customer,
        fullName: `${customer.firstName} ${customer.lastName}`.trim(),
      };
    } catch (error) {
      this.handleError(error, 'POSService.createCustomer');
    }
  }

  // ============================================
  // SUMMARY AND STATISTICS OPERATIONS
  // ============================================

  /**
   * Get POS summary
   */
  async getSummary(userId: string, businessUnitId: string): Promise<POSSummary> {
    try {
      const cart = await this.cartService.getOrCreateCart(userId, businessUnitId);
      
      const syncResult = await this.cartService.syncCartWithInventory(cart.id, businessUnitId);

      const fullCart = await this.prisma.cart.findUnique({
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
                },
              },
            },
          },
        },
      });

      const itemCount = fullCart?.items?.length || 0;
      const totalItems = fullCart?.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;

      return {
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
      };
    } catch (error) {
      this.handleError(error, 'POSService.getSummary');
    }
  }

  /**
   * Get cash register status
   */
  async getRegisterStatus(businessUnitId: string): Promise<POSRegisterStatus> {
    try {
      const sessions = await this.prisma.cashRegisterSession.findMany({
        where: {
          cashRegister: {
            businessUnitId,
          },
          status: 'OPEN',
        },
        include: {
          cashRegister: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          openedAt: 'desc',
        },
      });

      const sessionsWithSummary = await Promise.all(
        sessions.map(async (session: any) => {
          const sales = await this.prisma.sale.findMany({
            where: {
              cashRegisterSessionId: session.id,
            },
            select: {
              total: true,
              paidAmount: true,
              status: true,
              saleDate: true,
            },
          });

          const totalSales = sales.length;
          const totalRevenue = sales.reduce((sum: number, sale: any) => sum + sale.total, 0);
          const totalPaid = sales.reduce((sum: number, sale: any) => sum + sale.paidAmount, 0);

          return {
            id: session.id,
            status: session.status,
            openedAt: session.openedAt,
            startingBalance: session.startingBalance,
            cashRegister: {
              id: session.cashRegister.id,
              name: session.cashRegister.name,
              currentBalance: session.cashRegister.cashBalance,
            },
            user: session.user,
            summary: {
              totalSales,
              totalRevenue,
              totalPaid,
              expectedEndingBalance: session.startingBalance + totalPaid,
              difference: (session.startingBalance + totalPaid) - session.cashRegister.cashBalance,
            },
          };
        })
      );

      const totalCash = sessionsWithSummary.reduce(
        (sum: number, session: any) => sum + session.cashRegister.currentBalance, 
        0
      );
      const totalSales = sessionsWithSummary.reduce(
        (sum: number, session: any) => sum + session.summary.totalSales, 
        0
      );
      const totalRevenue = sessionsWithSummary.reduce(
        (sum: number, session: any) => sum + session.summary.totalRevenue, 
        0
      );

      return {
        sessions: sessionsWithSummary,
        totalOpenSessions: sessionsWithSummary.length,
        totalCash,
        totalSales,
        totalRevenue,
      };
    } catch (error) {
      this.handleError(error, 'POSService.getRegisterStatus');
    }
  }

  /**
   * Get POS statistics
   */
  async getStats(userId: string, businessUnitId: string): Promise<POSStats> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [todaySales, cartCount, activeSessions, lowStockCount, pendingOrders] = await Promise.all([
        this.prisma.sale.findMany({
          where: {
            businessUnitId,
            saleDate: {
              gte: today,
              lt: tomorrow,
            },
            status: { not: 'CANCELLED' },
          },
          include: {
            items: true,
          },
        }),
        this.prisma.cart.count({
          where: {
            businessUnitId,
            userId,
          },
        }),
        this.prisma.cashRegisterSession.count({
          where: {
            cashRegister: {
              businessUnitId,
            },
            status: 'OPEN',
          },
        }),
        this.prisma.inventory.count({
          where: {
            businessUnitId,
            quantity: { lte: 10 },
          },
        }),
        this.prisma.order.count({
          where: {
            businessUnitId,
            status: 'PENDING',
          },
        }),
      ]);

      const totalRevenue = todaySales.reduce((sum: number, sale: any) => sum + sale.total, 0);
      const totalSales = todaySales.length;
      const itemsSold = todaySales.reduce(
        (sum: number, sale: any) => sum + sale.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0),
        0
      );

      return {
        today: {
          revenue: totalRevenue,
          sales: totalSales,
          averageTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
          itemsSold,
        },
        cartCount,
        activeSessions,
        lowStockCount,
        pendingOrders,
      };
    } catch (error) {
      this.handleError(error, 'POSService.getStats');
    }
  }

  /**
   * Get POS transaction history
   */
  async getTransactions(businessUnitId: string, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;

      const [sales, total] = await Promise.all([
        this.prisma.sale.findMany({
          where: {
            businessUnitId,
          },
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
              },
            },
          },
          orderBy: {
            saleDate: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.sale.count({
          where: {
            businessUnitId,
          },
        }),
      ]);

      return {
        sales,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.handleError(error, 'POSService.getTransactions');
    }
  }
}

// ============================================
// EXPORT DEFAULT
// ============================================

export const posService = new POSService();
export default POSService;
