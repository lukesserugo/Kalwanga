// src/services/cartService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';

interface CartItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  notes?: string;
}

interface CartResponse {
  id: string;
  items: CartItemResponse[];
  subtotal: number;
  tax: number;
  discount: number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  promotionCode?: string;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  total: number;
  customerId?: string;
  customer?: any;
  businessUnitId: string;
  userId: string;
  notes?: string;
  status: 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED';
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
}

interface CartItemResponse {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images: string[];
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: any;
  };
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  availableStock: number;
  isInStock: boolean;
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  metrics: string[];
  dateRange: string;
  startDate?: string;
  endDate?: string;
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetailedData: boolean;
}

export interface ExportHistoryOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  dateRange: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  includeItems?: boolean;
}

export interface ExportAbandonedOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  hours: number;
  minValue?: number;
  status?: string;
  includeCustomerDetails?: boolean;
}


// ============================================
// HELPER FUNCTIONS
// ============================================

async function safeEmitEvent(eventName: string, data: any): Promise<void> {
  try {
    if (realtimeService && typeof (realtimeService as any).emit === 'function') {
      await (realtimeService as any).emit(eventName, data);
    } else if (realtimeService && typeof (realtimeService as any).emitCartEvent === 'function') {
      await (realtimeService as any).emitCartEvent(eventName, data);
    } else {
      console.log(`📡 Cart real-time event: ${eventName}`, data);
    }
  } catch (error) {
    console.warn(`Failed to emit cart real-time event ${eventName}:`, error);
  }
}

function ensureCartStatus(cart: any): any {
  return {
    ...cart,
    status: cart.status || 'ACTIVE',
  };
}

// ============================================
// CART SERVICE CLASS
// ============================================

export class CartService extends BaseService {
  /**
   * Get or create cart for a user
   */
  async getOrCreateCart(userId: string, businessUnitId: string): Promise<CartResponse> {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError('User ID and Business Unit ID are required', 400);
      }

      let cart: any = await this.prisma.cart.findFirst({
        where: {
          userId,
          businessUnitId,
          status: 'ACTIVE',
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
                  images: true,
                  taxRate: true,
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
          customer: true,
        },
      });

      if (!cart) {
        cart = await this.prisma.cart.create({
          data: {
            userId,
            businessUnitId,
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
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
                    images: true,
                    taxRate: true,
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
        
        console.log(`✅ Cart created for user ${userId} in business unit ${businessUnitId}`);
      }

      const cartWithStatus = ensureCartStatus(cart);
      const formattedCart = await this.formatCartResponse(cartWithStatus, businessUnitId);
      return formattedCart;
    } catch (error) {
      this.handleError(error, 'CartService.getOrCreateCart');
    }
  }

  /**
   * Get cart by ID
   */
  async getCartById(cartId: string, businessUnitId?: string): Promise<CartResponse> {
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
                  taxRate: true,
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
          customer: true,
        },
      });

      if (!cart) {
        throw new AppError('Cart not found', 404);
      }

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(cartWithStatus, businessUnitId || cart.businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.getCartById');
    }
  }

  /**
   * Get cart summary
   */
  async getCartSummary(cartId: string): Promise<any> {
    try {
      const cart = await this.getCartById(cartId);
      
      return {
        id: cart.id,
        itemCount: cart.itemCount,
        subtotal: cart.subtotal,
        tax: cart.tax,
        discount: cart.discount,
        total: cart.total,
        items: cart.items.map(item => ({
          id: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          variantName: item.variant?.name,
        })),
      };
    } catch (error) {
      this.handleError(error, 'CartService.getCartSummary');
    }
  }

  /**
   * Get product inventory
   */
  private async getProductInventory(productId: string, variantId: string | undefined, businessUnitId: string): Promise<{ quantity: number; reserved: number; available: number } | null> {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          productId,
          variantId: variantId || null,
          businessUnitId,
        },
        select: {
          quantity: true,
          reserved: true,
        },
      });

      if (!inventory) {
        return null;
      }

      return {
        quantity: inventory.quantity || 0,
        reserved: inventory.reserved || 0,
        available: Math.max(0, (inventory.quantity || 0) - (inventory.reserved || 0)),
      };
    } catch (error) {
      console.warn('Failed to get inventory:', error);
      return null;
    }
  }

  /**
   * Add item to cart
   */
  async addItemToCart(
    cartId: string,
    data: CartItemInput,
    userId: string,
    businessUnitId: string
  ): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const cart = await tx.cart.findUnique({
          where: { id: cartId },
        });

        if (!cart) {
          throw new AppError('Cart not found', 404);
        }

        if (cart.status && cart.status !== 'ACTIVE') {
          throw new AppError('Cart is not active. Please create a new cart.', 400);
        }

        // Get product with inventory
        const product = await tx.product.findUnique({
          where: { id: data.productId },
          include: {
            inventory: true,
          },
        });

        if (!product) {
          throw new AppError('Product not found', 404);
        }

        if (!product.isActive) {
          throw new AppError('Product is not active', 400);
        }

        // Get inventory
        const inventory = product.inventory;
        const availableStock = inventory ? Math.max(0, (inventory.quantity || 0) - (inventory.reserved || 0)) : 0;
        
        if (availableStock < data.quantity) {
          throw new AppError(`Insufficient stock. Available: ${availableStock}`, 400);
        }

        let unitPrice = product.unitPrice;
        if (data.variantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: data.variantId },
          });
          
          if (!variant) {
            throw new AppError('Variant not found', 404);
          }
          
          if (!variant.isActive) {
            throw new AppError('Variant is not active', 400);
          }
          
          unitPrice = variant.price;
        }

        // Check if item already exists in cart
        const existingItem = await tx.cartItem.findFirst({
          where: {
            cartId,
            productId: data.productId,
            variantId: data.variantId || null,
          },
        });

        let item;
        if (existingItem) {
          const newQuantity = existingItem.quantity + data.quantity;
          if (availableStock < newQuantity) {
            throw new AppError(`Insufficient stock. Available: ${availableStock}`, 400);
          }

          item = await tx.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: newQuantity,
              total: newQuantity * unitPrice,
              notes: data.notes || existingItem.notes,
            },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unitPrice: true,
                  images: true,
                  taxRate: true,
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
          });
        } else {
          item = await tx.cartItem.create({
            data: {
              cartId,
              productId: data.productId,
              variantId: data.variantId,
              quantity: data.quantity,
              unitPrice,
              total: data.quantity * unitPrice,
              notes: data.notes,
            },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unitPrice: true,
                  images: true,
                  taxRate: true,
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
          });
        }

        const updatedCart = await this.recalculateCart(tx, cartId, businessUnitId);

        await safeEmitEvent(`cart:${cartId}:updated`, {
          cartId,
          userId,
          action: 'item_added',
          itemId: item.id,
          productId: data.productId,
          quantity: data.quantity,
        });

        const cartWithStatus = ensureCartStatus(updatedCart);
        return await this.formatCartResponse(cartWithStatus, businessUnitId);
      });
    } catch (error) {
      this.handleError(error, 'CartService.addItemToCart');
    }
  }

  /**
   * Add multiple items to cart
   */
  async addMultipleItemsToCart(
    cartId: string,
    items: CartItemInput[],
    userId: string,
    businessUnitId: string
  ): Promise<CartResponse> {
    try {
      if (!items || items.length === 0) {
        throw new AppError('Items are required', 400);
      }

      let lastResult: CartResponse | null = null;
      for (let i = 0; i < items.length; i++) {
        lastResult = await this.addItemToCart(cartId, items[i], userId, businessUnitId);
      }

      if (!lastResult) {
        throw new AppError('Failed to add items to cart', 500);
      }

      await safeEmitEvent(`cart:${cartId}:updated`, {
        cartId,
        userId,
        action: 'items_added_bulk',
        count: items.length,
      });

      return await this.getCartById(cartId, businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.addMultipleItemsToCart');
    }
  }

  /**
   * Sync cart with inventory
   */
  async syncCartWithInventory(cartId: string, businessUnitId: string): Promise<{ valid: boolean; issues: string[] }> {
    try {
      const cart = await this.prisma.cart.findUnique({
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
            } 
          } 
        },
      });

      if (!cart) {
        return { valid: false, issues: ['Cart not found'] };
      }

      const issues: string[] = [];
      const updates: Promise<any>[] = [];

      for (const item of cart.items) {
        const inventory = item.product.inventory;
        
        const available = inventory ? Math.max(0, (inventory.quantity || 0) - (inventory.reserved || 0)) : 0;
        
        if (available === 0 && inventory) {
          issues.push(`Out of stock: ${item.product.name}`);
          updates.push(
            this.prisma.cartItem.delete({ where: { id: item.id } })
          );
        } else if (inventory && available < item.quantity) {
          issues.push(`Insufficient stock for ${item.product.name}: ${available} available`);
          updates.push(
            this.prisma.cartItem.update({
              where: { id: item.id },
              data: { 
                quantity: available,
                total: available * item.unitPrice,
              },
            })
          );
        } else if (!inventory) {
          issues.push(`No inventory record for ${item.product.name}`);
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        await this.recalculateCart(this.prisma as any, cartId, businessUnitId);
      }

      return { valid: issues.length === 0, issues };
    } catch (error) {
      this.handleError(error, 'CartService.syncCartWithInventory');
    }
  }

  /**
   * Update cart item quantity
   */
  async updateCartItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
    businessUnitId: string
  ): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const cartItem = await tx.cartItem.findUnique({
          where: { id: itemId },
          include: {
            product: {
              include: {
                inventory: true,
              },
            },
          },
        });

        if (!cartItem) {
          throw new AppError('Cart item not found', 404);
        }

        if (cartItem.cartId !== cartId) {
          throw new AppError('Cart item does not belong to this cart', 400);
        }

        if (quantity <= 0) {
          await tx.cartItem.delete({
            where: { id: itemId },
          });
        } else {
          const inventory = cartItem.product.inventory;
          const availableStock = inventory ? Math.max(0, (inventory.quantity || 0) - (inventory.reserved || 0)) : 0;
          
          if (availableStock < quantity) {
            throw new AppError(`Insufficient stock. Available: ${availableStock}`, 400);
          }

          await tx.cartItem.update({
            where: { id: itemId },
            data: {
              quantity,
              total: quantity * cartItem.unitPrice,
            },
          });
        }

        const updatedCart = await this.recalculateCart(tx, cartId, businessUnitId);

        await safeEmitEvent(`cart:${cartId}:updated`, {
          cartId,
          action: 'quantity_updated',
          itemId,
          quantity,
        });

        const cartWithStatus = ensureCartStatus(updatedCart);
        return await this.formatCartResponse(cartWithStatus, businessUnitId);
      });
    } catch (error) {
      this.handleError(error, 'CartService.updateCartItemQuantity');
    }
  }

  /**
   * Remove item from cart
   */
  async removeItemFromCart(cartId: string, itemId: string): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const cartItem = await tx.cartItem.findUnique({
          where: { id: itemId },
        });

        if (!cartItem) {
          throw new AppError('Cart item not found', 404);
        }

        if (cartItem.cartId !== cartId) {
          throw new AppError('Cart item does not belong to this cart', 400);
        }

        await tx.cartItem.delete({
          where: { id: itemId },
        });

        const cart = await tx.cart.findUnique({
          where: { id: cartId },
        });

        if (!cart) {
          throw new AppError('Cart not found', 404);
        }

        const updatedCart = await this.recalculateCart(tx, cartId, cart.businessUnitId);

        await safeEmitEvent(`cart:${cartId}:updated`, {
          cartId,
          action: 'item_removed',
          itemId,
        });

        const cartWithStatus = ensureCartStatus(updatedCart);
        return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
      });
    } catch (error) {
      this.handleError(error, 'CartService.removeItemFromCart');
    }
  }

  /**
   * Clear cart
   */
  async clearCart(cartId: string): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const cart = await tx.cart.findUnique({
          where: { id: cartId },
        });

        if (!cart) {
          throw new AppError('Cart not found', 404);
        }

        await tx.cartItem.deleteMany({
          where: { cartId },
        });

        const updatedCart = await tx.cart.update({
          where: { id: cartId },
          data: {
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
          },
          include: {
            items: true,
            customer: true,
          },
        });

        await safeEmitEvent(`cart:${cartId}:updated`, {
          cartId,
          action: 'cleared',
        });

        const cartWithStatus = ensureCartStatus(updatedCart);
        return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
      });
    } catch (error) {
      this.handleError(error, 'CartService.clearCart');
    }
  }

  /**
   * Apply discount to cart
   */
  async applyDiscount(
    cartId: string, 
    discount: number, 
    discountType: 'PERCENTAGE' | 'FIXED' = 'FIXED'
  ): Promise<CartResponse> {
    try {
      if (discount < 0) {
        throw new AppError('Discount cannot be negative', 400);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const cart = await tx.cart.findUnique({
          where: { id: cartId },
        });

        if (!cart) {
          throw new AppError('Cart not found', 404);
        }

        let actualDiscount = discount;
        if (discountType === 'PERCENTAGE') {
          actualDiscount = (cart.subtotal * discount) / 100;
        }

        if (actualDiscount > cart.subtotal) {
          throw new AppError('Discount cannot exceed subtotal', 400);
        }

        const updatedCart = await this.recalculateCart(tx, cartId, cart.businessUnitId, actualDiscount);

        await tx.cart.update({
          where: { id: cartId },
          data: {
            discountType,
          },
        });

        const cartWithStatus = ensureCartStatus(updatedCart);
        return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
      });
    } catch (error) {
      this.handleError(error, 'CartService.applyDiscount');
    }
  }

  /**
   * Apply promotion to cart
   * ✅ NEW METHOD
   */
  async applyPromotion(cartId: string, promotionCode: string): Promise<CartResponse> {
    try {
      if (!promotionCode) {
        throw new AppError('Promotion code is required', 400);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const cart = await tx.cart.findUnique({
          where: { id: cartId },
        });

        if (!cart) {
          throw new AppError('Cart not found', 404);
        }

        // Find active promotion
        const promotion = await tx.promotion.findFirst({
          where: {
            name: promotionCode,
            isActive: true,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        });

        if (!promotion) {
          throw new AppError('Invalid or expired promotion code', 400);
        }

        let discountAmount = 0;
        if (promotion.type === 'PERCENTAGE') {
          discountAmount = (cart.subtotal * promotion.value) / 100;
        } else if (promotion.type === 'FIXED') {
          discountAmount = promotion.value;
        }

        if (promotion.maxDiscount && discountAmount > promotion.maxDiscount) {
          discountAmount = promotion.maxDiscount;
        }

        if (discountAmount > cart.subtotal) {
          discountAmount = cart.subtotal;
        }

        const updatedCart = await this.recalculateCart(tx, cartId, cart.businessUnitId, discountAmount);

        await tx.cart.update({
          where: { id: cartId },
          data: {
            promotionCode: promotionCode,
            promotionDiscount: discountAmount,
          },
        });

        await safeEmitEvent(`cart:${cartId}:promotion-applied`, {
          cartId,
          promotionCode,
          discountAmount,
        });

        const cartWithStatus = ensureCartStatus(updatedCart);
        return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
      });
    } catch (error) {
      this.handleError(error, 'CartService.applyPromotion');
    }
  }

  /**
   * Apply loyalty points to cart
   * ✅ NEW METHOD
   */
  async applyLoyaltyPoints(cartId: string, customerId: string, points: number): Promise<CartResponse> {
    try {
      if (!customerId || points <= 0) {
        throw new AppError('Valid customer ID and points are required', 400);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
        });

        if (!customer) {
          throw new AppError('Customer not found', 404);
        }

        if ((customer.loyaltyPoints || 0) < points) {
          throw new AppError('Insufficient loyalty points', 400);
        }

        const cart = await tx.cart.findUnique({
          where: { id: cartId },
        });

        if (!cart) {
          throw new AppError('Cart not found', 404);
        }

        // 10 points = $1 discount
        const discountFromPoints = points * 0.1;
        const maxDiscount = cart.subtotal * 0.5; // Max 50% off

        const actualDiscount = Math.min(discountFromPoints, maxDiscount);
        const actualPointsUsed = Math.ceil(actualDiscount / 0.1);

        // Deduct points from customer
        await tx.customer.update({
          where: { id: customerId },
          data: {
            loyaltyPoints: {
              decrement: actualPointsUsed,
            },
          },
        });

        // Record loyalty history
        await tx.loyaltyHistory.create({
          data: {
            customerId,
            points: -actualPointsUsed,
            type: 'REDEEM',
            notes: `Redeemed for cart ${cartId}`,
            userId: cart.userId,
          },
        });

        const updatedCart = await this.recalculateCart(tx, cartId, cart.businessUnitId, actualDiscount);

        await tx.cart.update({
          where: { id: cartId },
          data: {
            loyaltyPointsUsed: actualPointsUsed,
            loyaltyDiscount: actualDiscount,
          },
        });

        await safeEmitEvent(`cart:${cartId}:loyalty-applied`, {
          cartId,
          customerId,
          points: actualPointsUsed,
          discount: actualDiscount,
        });

        const cartWithStatus = ensureCartStatus(updatedCart);
        return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
      });
    } catch (error) {
      this.handleError(error, 'CartService.applyLoyaltyPoints');
    }
  }

  /**
  /**
   * Export cart analytics data - returns data, not API call
   */
  async exportCartAnalytics(params: {
    businessUnitId: string;
    startDate: Date;
    endDate: Date;
    includeDetailedData?: boolean;
  }): Promise<{
    analytics: any;
    detailedData: any[];
  }> {
    try {
      const { businessUnitId, startDate, endDate, includeDetailedData = true } = params;

      // Get analytics summary
      const analytics = await this.getCartAnalytics({
        businessUnitId,
        startDate,
        endDate,
      });

      // Get detailed data if requested
      let detailedData: any[] = [];
      if (includeDetailedData) {
        detailedData = await this.prisma.cart.findMany({
          where: {
            businessUnitId,
            createdAt: {
              gte: startDate,
              lte: endDate,
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
      }

      return { analytics, detailedData };
    } catch (error) {
      this.handleError(error, 'CartService.exportCartAnalytics');
    }
  }

  /**
   * Associate customer with cart
   * ✅ NEW METHOD
   */
  async associateCustomer(cartId: string, customerId: string): Promise<CartResponse> {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: { customerId },
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
                  taxRate: true,
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

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.associateCustomer');
    }
  }

  /**
   * Update cart notes
   * ✅ NEW METHOD
   */
  async updateCartNotes(cartId: string, notes?: string): Promise<CartResponse> {
    try {
      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: { notes: notes || '' },
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
                  taxRate: true,
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

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.updateCartNotes');
    }
  }

    /**
   * Get cart settings
   * GET /cart/settings
   */
  async getCartSettings(businessUnitId: string): Promise<any> {
    // Get or create settings
    let settings = await this.prisma.cartSettings.findFirst({
      where: { businessUnitId },
    });
    
    if (!settings) {
      // Create default settings
      settings = await this.prisma.cartSettings.create({
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
    
    return settings;
  }

  /**
   * Update cart settings
   * PUT /cart/settings
   */
  async updateCartSettings(businessUnitId: string, data: any): Promise<any> {
    const settings = await this.prisma.cartSettings.update({
      where: { businessUnitId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
    
    return settings;
  }

  /**
   * Recalculate cart totals
   */
  private async recalculateCart(
    tx: Prisma.TransactionClient, 
    cartId: string, 
    businessUnitId: string,
    discountOverride?: number
  ) {
    const items = await tx.cartItem.findMany({
      where: { cartId },
      include: {
        product: {
          select: {
            unitPrice: true,
            taxRate: true,
          },
        },
        variant: {
          select: {
            price: true,
          },
        },
      },
    });

    const subtotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
    
    let tax = 0;
    for (const item of items) {
      const taxRate = (item.product as any).taxRate || 0.10;
      tax += item.total * taxRate;
    }

    const cart = await tx.cart.findUnique({
      where: { id: cartId },
    });

    if (!cart) {
      throw new AppError('Cart not found', 404);
    }

    const discount = discountOverride !== undefined ? discountOverride : cart.discount || 0;
    const total = Math.max(0, subtotal + tax - discount);

    return await tx.cart.update({
      where: { id: cartId },
      data: {
        subtotal,
        tax,
        discount,
        total,
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
                images: true,
                taxRate: true,
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
        customer: true,
      },
    });
  }

  /**
   * Format cart response
   */
  private async formatCartResponse(cart: any, businessUnitId?: string): Promise<CartResponse> {
    const items: CartItemResponse[] = await Promise.all(
      (cart.items || []).map(async (item: any) => {
        let availableStock = 0;
        let isInStock = false;
        try {
          const inventory = await this.prisma.inventory.findFirst({
            where: {
              productId: item.productId,
              variantId: item.variantId || null,
              businessUnitId: businessUnitId || cart.businessUnitId,
            },
          });
          
          if (inventory) {
            availableStock = Math.max(0, (inventory.quantity || 0) - (inventory.reserved || 0));
            isInStock = availableStock > 0;
          }
        } catch (error) {
          console.warn('Failed to get inventory for cart item:', error);
        }

        return {
          id: item.id,
          productId: item.productId,
          product: {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            unitPrice: item.product.unitPrice,
            images: item.product.images || [],
          },
          variantId: item.variantId || undefined,
          variant: item.variant
            ? {
                id: item.variant.id,
                name: item.variant.name,
                sku: item.variant.sku,
                price: item.variant.price,
                attributes: item.variant.attributes,
              }
            : undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          notes: item.notes || undefined,
          availableStock,
          isInStock,
        };
      })
    );

    const status = (cart.status as string) || 'ACTIVE';

    return {
      id: cart.id,
      items,
      subtotal: cart.subtotal,
      tax: cart.tax,
      discount: cart.discount,
      discountType: cart.discountType || undefined,
      promotionCode: cart.promotionCode || undefined,
      promotionDiscount: cart.promotionDiscount || 0,
      loyaltyPointsUsed: cart.loyaltyPointsUsed || 0,
      loyaltyDiscount: cart.loyaltyDiscount || 0,
      total: cart.total,
      customerId: cart.customerId || undefined,
      customer: cart.customer || undefined,
      businessUnitId: cart.businessUnitId,
      userId: cart.userId,
      notes: cart.notes || undefined,
      status: status as 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED',
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
      itemCount: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
    };
  }

  /**
   * Get cart count for user
   */
  async getCartCount(userId: string, businessUnitId: string): Promise<number> {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError('User ID and Business Unit ID are required', 400);
      }

      const cart = await this.prisma.cart.findFirst({
        where: {
          userId,
          businessUnitId,
          status: 'ACTIVE',
        },
        include: {
          items: true,
        },
      });

      if (!cart) {
        return 0;
      }

      return cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    } catch (error) {
      this.handleError(error, 'CartService.getCartCount');
    }
  }

  /**
   * Checkout cart
   */
  async checkoutCart(
    cartId: string, 
    userId: string,
    options: {
      customerId?: string;
      paymentMethod: string;
      paidAmount: number;
      cashRegisterId?: string;
      cashRegisterSessionId?: string;
      notes?: string;
      tipAmount?: number;
    }
  ): Promise<any> {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
                variant: {
                  include: {
                    inventory: true,
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

        if (cart.items.length === 0) {
          throw new AppError('Cart is empty', 400);
        }

        // Sync cart with inventory
        const syncResult = await this.syncCartWithInventory(cartId, cart.businessUnitId);
        if (!syncResult.valid) {
          throw new AppError(`Cart has inventory issues: ${syncResult.issues.join(', ')}`, 400);
        }

        // Calculate totals
        const subtotal = cart.items.reduce((sum: number, item: any) => sum + item.total, 0);
        const tax = cart.items.reduce((sum: number, item: any) => {
          const taxRate = item.product.taxRate || 0.10;
          return sum + (item.total * taxRate);
        }, 0);
        const total = subtotal + tax - (cart.discount || 0);

        // Create sale
        const receiptNumber = `RCP-${Date.now()}`;
        const sale = await tx.sale.create({
          data: {
            receiptNumber,
            subtotal,
            tax,
            discount: cart.discount || 0,
            total: options.paidAmount || total,
            paidAmount: options.paidAmount || total,
            changeAmount: Math.max(0, (options.paidAmount || total) - total),
            notes: options.notes || cart.notes || null,
            status: 'COMPLETED',
            saleDate: new Date(),
            businessUnitId: cart.businessUnitId,
            userId,
            customerId: options.customerId || cart.customerId || null,
            cashRegisterId: options.cashRegisterId || null,
            cashRegisterSessionId: options.cashRegisterSessionId || null,
          },
        });

        // Create sale items and update inventory
        for (const item of cart.items) {
          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              notes: item.notes,
            },
          });

          const inventory = item.product.inventory;
          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: {
                  decrement: item.quantity,
                },
                available: {
                  decrement: item.quantity,
                },
              },
            });

            await tx.inventoryTransaction.create({
              data: {
                transactionType: 'SALE',
                quantity: -item.quantity,
                notes: `Sale ${sale.receiptNumber}`,
                reference: sale.id,
                productId: item.productId,
                variantId: item.variantId || null,
                inventoryId: inventory.id,
                businessUnitId: cart.businessUnitId,
                userId,
              },
            });
          }
        }

        // Update cart status to CHECKED_OUT
        await tx.cart.update({
          where: { id: cartId },
          data: {
            status: 'CHECKED_OUT',
          },
        });

        // Delete cart items
        await tx.cartItem.deleteMany({
          where: { cartId },
        });

        await safeEmitEvent('sale:created', {
          saleId: sale.id,
          receiptNumber: sale.receiptNumber,
          total: sale.total,
          businessUnitId: sale.businessUnitId,
        });

        const updatedCart = await tx.cart.findUnique({
          where: { id: cartId },
          include: {
            items: true,
            customer: true,
          },
        });

        const cartWithStatus = ensureCartStatus(updatedCart || cart);
        
        return {
          sale,
          cart: await this.formatCartResponse(cartWithStatus, cart.businessUnitId),
          message: 'Checkout completed successfully',
        };
      });
    } catch (error) {
      this.handleError(error, 'CartService.checkoutCart');
    }
  }

  /**
   * Get abandoned carts
   */
  async getAbandonedCarts(params: {
    businessUnitId: string;
    hours?: number;
    minValue?: number;
    page?: number;
    limit?: number;
  }): Promise<{ carts: any[]; total: number; page: number; totalPages: number; limit: number }> {
    try {
      const { businessUnitId, hours = 24, minValue, page = 1, limit = 10 } = params;
      const skip = (page - 1) * limit;
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const where: any = {
        businessUnitId,
        status: 'ACTIVE',
        updatedAt: { lt: cutoffDate },
      };

      if (minValue) {
        where.total = { gte: minValue };
      }

      const [carts, total] = await Promise.all([
        this.prisma.cart.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            items: {
              include: {
                product: true,
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
        }),
        this.prisma.cart.count({ where }),
      ]);

      return {
        carts,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'CartService.getAbandonedCarts');
    }
  }

  /**
   * Get cart analytics
   */
  async getCartAnalytics(params: {
    businessUnitId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    try {
      const { businessUnitId, startDate, endDate } = params;

      const where: any = { businessUnitId };
      if (startDate) where.createdAt = { gte: startDate };
      if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };

      const [totalCarts, cartItems, cartValues] = await Promise.all([
        this.prisma.cart.count({ where }),
        this.prisma.cartItem.aggregate({
          where: { cart: where },
          _avg: { quantity: true },
        }),
        this.prisma.cart.aggregate({
          where,
          _avg: { total: true },
        }),
      ]);

      const averageItems = cartItems._avg.quantity || 0;
      const averageValue = cartValues._avg.total || 0;

      return {
        totalCarts,
        activeCarts: await this.prisma.cart.count({ where: { ...where, status: 'ACTIVE' } }),
        abandonedCarts: await this.prisma.cart.count({ where: { ...where, status: 'ABANDONED' } }),
        averageItems,
        averageValue,
        conversionRate: totalCarts > 0 ? ((totalCarts - 0) / totalCarts) * 100 : 0,
      };
    } catch (error) {
      this.handleError(error, 'CartService.getCartAnalytics');
    }
  }

  /**
   * Get cart history for a user
   */
  async getCartHistory(params: {
    userId: string;
    businessUnitId: string;
    page?: number;
    limit?: number;
  }): Promise<{ carts: any[]; total: number; page: number; totalPages: number; limit: number }> {
    try {
      const { userId, businessUnitId, page = 1, limit = 10 } = params;
      const skip = (page - 1) * limit;

      const where: any = {
        userId,
        businessUnitId,
      };

      const [carts, total] = await Promise.all([
        this.prisma.cart.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
            customer: true,
          },
        }),
        this.prisma.cart.count({ where }),
      ]);

      return {
        carts,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'CartService.getCartHistory');
    }
  }

  /**
   * Save cart for later
   */
  async saveCartForLater(cartId: string): Promise<CartResponse> {
    try {
      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: {
          status: 'SAVED',
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
                  images: true,
                  taxRate: true,
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

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.saveCartForLater');
    }
  }

  /**
   * Restore saved cart
   */
  async restoreSavedCart(savedCartId: string, userId: string, businessUnitId: string): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const savedCart = await tx.cart.findUnique({
          where: { id: savedCartId },
          include: {
            items: true,
          },
        });

        if (!savedCart) {
          throw new AppError('Saved cart not found', 404);
        }

        if (savedCart.userId !== userId) {
          throw new AppError('You do not have permission to restore this cart', 403);
        }

        if (savedCart.status && savedCart.status !== 'SAVED') {
          throw new AppError('Cart is not saved', 400);
        }

        let activeCart: any = await tx.cart.findFirst({
          where: {
            userId,
            businessUnitId,
            status: 'ACTIVE',
          },
        });

        if (activeCart) {
          await tx.cartItem.deleteMany({
            where: { cartId: activeCart.id },
          });
        } else {
          activeCart = await tx.cart.create({
            data: {
              userId,
              businessUnitId,
              subtotal: 0,
              tax: 0,
              discount: 0,
              total: 0,
            },
          });
        }

        for (const item of savedCart.items) {
          await tx.cartItem.create({
            data: {
              cartId: activeCart.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              notes: item.notes,
            },
          });
        }

        await tx.cart.update({
          where: { id: savedCartId },
          data: {
            status: 'ACTIVE',
          },
        });

        const updatedCart = await this.recalculateCart(tx, activeCart.id, businessUnitId);

        const cartWithStatus = ensureCartStatus(updatedCart);
        return await this.formatCartResponse(cartWithStatus, businessUnitId);
      });
    } catch (error) {
      this.handleError(error, 'CartService.restoreSavedCart');
    }
  }

  /**
   * Transfer cart to another user
   */
  async transferCart(fromUserId: string, toUserId: string, businessUnitId: string): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const targetUser = await tx.user.findUnique({
          where: { id: toUserId },
        });

        if (!targetUser) {
          throw new AppError('Target user not found', 404);
        }

        const sourceCart = await tx.cart.findFirst({
          where: {
            userId: fromUserId,
            businessUnitId,
            status: 'ACTIVE',
          },
        });

        if (!sourceCart) {
          throw new AppError('Source cart not found', 404);
        }

        let targetCart: any = await tx.cart.findFirst({
          where: {
            userId: toUserId,
            businessUnitId,
            status: 'ACTIVE',
          },
        });

        if (targetCart) {
          const sourceItems = await tx.cartItem.findMany({
            where: { cartId: sourceCart.id },
          });

          for (const item of sourceItems) {
            const existingItem = await tx.cartItem.findFirst({
              where: {
                cartId: targetCart.id,
                productId: item.productId,
                variantId: item.variantId || null,
              },
            });

            if (existingItem) {
              await tx.cartItem.update({
                where: { id: existingItem.id },
                data: {
                  quantity: existingItem.quantity + item.quantity,
                  total: (existingItem.quantity + item.quantity) * item.unitPrice,
                },
              });
            } else {
              await tx.cartItem.create({
                data: {
                  cartId: targetCart.id,
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                  notes: item.notes,
                },
              });
            }
          }

          await tx.cartItem.deleteMany({
            where: { cartId: sourceCart.id },
          });

          await tx.cart.update({
            where: { id: sourceCart.id },
            data: {
              subtotal: 0,
              tax: 0,
              discount: 0,
              total: 0,
              status: 'ABANDONED',
            },
          });

          const updatedCart = await this.recalculateCart(tx, targetCart.id, businessUnitId);

          const cartWithStatus = ensureCartStatus(updatedCart);
          return await this.formatCartResponse(cartWithStatus, businessUnitId);
        } else {
          const transferredCart = await tx.cart.update({
            where: { id: sourceCart.id },
            data: {
              userId: toUserId,
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
                      images: true,
                      taxRate: true,
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

          const cartWithStatus = ensureCartStatus(transferredCart);
          return await this.formatCartResponse(cartWithStatus, businessUnitId);
        }
      });
    } catch (error) {
      this.handleError(error, 'CartService.transferCart');
    }
  }

  /**
   * Split cart items
   */
  async splitCart(
    userId: string,
    splits: Array<{ cartItemId: string; quantity: number; targetUserId: string }>,
    businessUnitId: string
  ): Promise<{ sourceCart: CartResponse; targetCarts: CartResponse[] }> {
    try {
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const sourceCart = await tx.cart.findFirst({
          where: {
            userId,
            businessUnitId,
            status: 'ACTIVE',
          },
        });

        if (!sourceCart) {
          throw new AppError('Source cart not found', 404);
        }

        const targetCarts: CartResponse[] = [];
        const processedItems: string[] = [];

        for (const split of splits) {
          if (processedItems.includes(split.cartItemId)) {
            continue;
          }

          const cartItem = await tx.cartItem.findUnique({
            where: { id: split.cartItemId },
          });

          if (!cartItem) {
            throw new AppError(`Cart item ${split.cartItemId} not found`, 404);
          }

          if (cartItem.cartId !== sourceCart.id) {
            throw new AppError(`Cart item ${split.cartItemId} does not belong to source cart`, 400);
          }

          if (cartItem.quantity < split.quantity) {
            throw new AppError(`Insufficient quantity for item ${cartItem.id}`, 400);
          }

          let targetCart: any = await tx.cart.findFirst({
            where: {
              userId: split.targetUserId,
              businessUnitId,
              status: 'ACTIVE',
            },
          });

          if (!targetCart) {
            targetCart = await tx.cart.create({
              data: {
                userId: split.targetUserId,
                businessUnitId,
                subtotal: 0,
                tax: 0,
                discount: 0,
                total: 0,
              },
            });
          }

          await tx.cartItem.create({
            data: {
              cartId: targetCart.id,
              productId: cartItem.productId,
              variantId: cartItem.variantId,
              quantity: split.quantity,
              unitPrice: cartItem.unitPrice,
              total: split.quantity * cartItem.unitPrice,
              notes: cartItem.notes,
            },
          });

          if (cartItem.quantity === split.quantity) {
            await tx.cartItem.delete({
              where: { id: split.cartItemId },
            });
          } else {
            await tx.cartItem.update({
              where: { id: split.cartItemId },
              data: {
                quantity: cartItem.quantity - split.quantity,
                total: (cartItem.quantity - split.quantity) * cartItem.unitPrice,
              },
            });
          }

          processedItems.push(split.cartItemId);

          const updatedTargetCart = await this.recalculateCart(tx, targetCart.id, businessUnitId);
          const targetCartWithStatus = ensureCartStatus(updatedTargetCart);
          targetCarts.push(await this.formatCartResponse(targetCartWithStatus, businessUnitId));
        }

        const updatedSourceCart = await this.recalculateCart(tx, sourceCart.id, businessUnitId);
        const sourceCartWithStatus = ensureCartStatus(updatedSourceCart);
        const sourceCartResponse = await this.formatCartResponse(sourceCartWithStatus, businessUnitId);

        return {
          sourceCart: sourceCartResponse,
          targetCarts,
        };
      });
    } catch (error) {
      this.handleError(error, 'CartService.splitCart');
    }
  }
}

export default CartService;
