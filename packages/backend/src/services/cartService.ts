// src/services/cartService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';
import { computeCartTotals, round2 } from '../utils/money.js';

// ============================================
// TYPES
// ============================================

interface CartItemInput {
  productId: string;
  /**
   * Accept `null` at the service boundary so any caller (controller, POS
   * service, bulk route, test) can pass `null` without breaking the type
   * contract. Collapsed to `undefined` by `normalizeVariantId` before
   * reaching Prisma.
   */
  variantId?: string | null;
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
    if (
      realtimeService &&
      typeof (realtimeService as any).emit === 'function'
    ) {
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

function ensureCartStatus(cart: any): any {
  return {
    ...cart,
    status: cart.status || 'ACTIVE',
  };
}

/**
 * Collapse `variantId: null` → `undefined` for any shape that flows
 * into Prisma. Prisma distinguishes the two:
 *   - `undefined` → "no filter" / "leave unset"
 *   - `null`      → "column IS NULL" / "explicitly clear"
 *
 * The callers who send `null` mean "no variant" — i.e. `undefined`.
 */
function normalizeVariantId(
  variantId: string | null | undefined,
): string | undefined {
  return variantId ?? undefined;
}

/**
 * Build a Prisma `where` clause for looking up the single Inventory row
 * that belongs to a given (productId | variantId, businessUnitId).
 *
 * NOTE: In the current schema, `Inventory` has NO scalar `productId` /
 * `variantId` columns. The FK lives on the *other* side of the relation
 * (`Product.inventoryId` and `ProductVariant.inventoryId`). Prisma's
 * generated client therefore only accepts relation filters here.
 */
function inventoryWhereFor(
  productId: string,
  variantId: string | null | undefined,
  businessUnitId: string,
) {
  const normalizedVariantId = normalizeVariantId(variantId);
  return {
    ...(normalizedVariantId
      ? { variant: { id: normalizedVariantId } }
      : { product: { id: productId } }),
    businessUnitId,
  };
}

/**
 * Standard `include` shape for cart items. Hoisted so all cart reads
 * return the same projection — the select lists were duplicated across
 * half a dozen methods before.
 */
const CART_ITEM_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      unitPrice: true,
      images: true,
      taxRate: true,
      isActive: true,
    },
  },
  variant: {
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      attributes: true,
      isActive: true,
    },
  },
} as const;

// ============================================
// CART SERVICE CLASS
// ============================================

export class CartService extends BaseService {
  // ============================================
  // READ / CREATE
  // ============================================

  async getOrCreateCart(
    userId: string,
    businessUnitId: string,
  ): Promise<CartResponse> {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError('User ID and Business Unit ID are required', 400);
      }

      let cart: any = await this.prisma.cart.findFirst({
        where: { userId, businessUnitId, status: 'ACTIVE' },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
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
            status: 'ACTIVE',
          },
          include: {
            items: {
              include: CART_ITEM_INCLUDE,
            },
            customer: true,
          },
        });

        console.log(
          `✅ Cart created for user ${userId} in business unit ${businessUnitId}`,
        );
      }

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(cartWithStatus, businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.getOrCreateCart');
      throw error;
    }
  }

  async getCartById(
    cartId: string,
    businessUnitId?: string,
  ): Promise<CartResponse> {
    try {
      if (!cartId) {
        throw new AppError('Cart ID is required', 400);
      }

      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
            orderBy: { createdAt: 'asc' },
          },
          customer: true,
        },
      });

      if (!cart) {
        throw new AppError('Cart not found', 404);
      }

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(
        cartWithStatus,
        businessUnitId || cart.businessUnitId,
      );
    } catch (error) {
      this.handleError(error, 'CartService.getCartById');
      throw error;
    }
  }

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
        items: cart.items.map((item) => ({
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
      throw error;
    }
  }

  async getCartCount(userId: string, businessUnitId: string): Promise<number> {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError('User ID and Business Unit ID are required', 400);
      }

      const cart = await this.prisma.cart.findFirst({
        where: { userId, businessUnitId, status: 'ACTIVE' },
        include: { items: { select: { quantity: true } } },
      });

      if (!cart) return 0;

      return cart.items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0,
      );
    } catch (error) {
      this.handleError(error, 'CartService.getCartCount');
      throw error;
    }
  }

  // ============================================
  // ITEM MUTATIONS
  // ============================================

  /**
   * Add item to cart.
   *
   * Every path that writes an item also writes the correct unitPrice
   * from the server — never from the caller. Variants win when present.
   * Inventory availability is checked inside the same transaction so a
   * concurrent sale cannot bypass the check.
   */
  async addItemToCart(
    cartId: string,
    data: CartItemInput,
    userId: string,
    businessUnitId: string,
  ): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cart = await tx.cart.findUnique({ where: { id: cartId } });

          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          if (cart.status && cart.status !== 'ACTIVE') {
            throw new AppError(
              'Cart is not active. Please create a new cart.',
              400,
            );
          }

          if (cart.businessUnitId !== businessUnitId) {
            throw new AppError(
              'Cart belongs to a different business unit',
              400,
            );
          }

          const product = await tx.product.findUnique({
            where: { id: data.productId },
            select: {
              id: true,
              isActive: true,
              unitPrice: true,
              taxRate: true,
            },
          });

          if (!product) {
            throw new AppError('Product not found', 404);
          }

          if (!product.isActive) {
            throw new AppError('Product is not active', 400);
          }

          const variantId = normalizeVariantId(data.variantId);

          // Server-authoritative unit price.
          let unitPrice = product.unitPrice;
          if (variantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: variantId },
              select: { isActive: true, price: true },
            });

            if (!variant) {
              throw new AppError('Variant not found', 404);
            }
            if (!variant.isActive) {
              throw new AppError('Variant is not active', 400);
            }
            unitPrice = variant.price;
          }

          // Availability check inside the transaction.
          const inventory = await tx.inventory.findFirst({
            where: inventoryWhereFor(data.productId, variantId, businessUnitId),
            select: { id: true, quantity: true, reserved: true },
          });

          const availableStock = inventory
            ? Math.max(0, (inventory.quantity || 0) - (inventory.reserved || 0))
            : 0;

          if (availableStock < data.quantity) {
            throw new AppError(
              `Insufficient stock. Available: ${availableStock}`,
              400,
            );
          }

          const existingItem = await tx.cartItem.findFirst({
            where: {
              cartId,
              productId: data.productId,
              variantId: variantId ?? null,
            },
          });

          if (existingItem) {
            const newQuantity = existingItem.quantity + data.quantity;

            if (availableStock < newQuantity) {
              throw new AppError(
                `Insufficient stock. Available: ${availableStock}`,
                400,
              );
            }

            await tx.cartItem.update({
              where: { id: existingItem.id },
              data: {
                quantity: newQuantity,
                unitPrice,
                total: round2(newQuantity * unitPrice),
                notes: data.notes || existingItem.notes,
              },
            });
          } else {
            await tx.cartItem.create({
              data: {
                cartId,
                productId: data.productId,
                variantId: variantId ?? null,
                quantity: data.quantity,
                unitPrice,
                total: round2(data.quantity * unitPrice),
                notes: data.notes,
              },
            });
          }

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            businessUnitId,
          );

          await safeEmitEvent(`cart:${cartId}:updated`, {
            cartId,
            userId,
            action: 'item_added',
            productId: data.productId,
            variantId: variantId ?? null,
            quantity: data.quantity,
          });

          const cartWithStatus = ensureCartStatus(updatedCart);
          return await this.formatCartResponse(cartWithStatus, businessUnitId);
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.addItemToCart');
      throw error;
    }
  }

  /**
   * Bulk add. Each item is validated in its own sub-transaction so a
   * failure on item N does not roll back items 1..N-1. This matches
   * the previous behavior and lets the caller decide how to handle
   * partial success.
   */
  async addMultipleItemsToCart(
    cartId: string,
    items: CartItemInput[],
    userId: string,
    businessUnitId: string,
  ): Promise<CartResponse> {
    try {
      if (!items || items.length === 0) {
        throw new AppError('Items are required', 400);
      }

      for (const item of items) {
        await this.addItemToCart(cartId, item, userId, businessUnitId);
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
      throw error;
    }
  }

  /**
   * Update cart item quantity.
   *
   * Re-reads the server unit price and reapplies it, so a stale
   * `cartItem.unitPrice` cannot be exploited by editing the row
   * directly.
   */
  async updateCartItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
    businessUnitId: string,
  ): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cartItem = await tx.cartItem.findUnique({
            where: { id: itemId },
            include: {
              product: {
                select: { unitPrice: true, isActive: true },
              },
              variant: {
                select: { price: true, isActive: true },
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
            await tx.cartItem.delete({ where: { id: itemId } });
          } else {
            // Reject inactive products/variants at update time.
            if (cartItem.product.isActive === false) {
              throw new AppError('Product is no longer active', 400);
            }
            if (cartItem.variant && cartItem.variant.isActive === false) {
              throw new AppError('Variant is no longer active', 400);
            }

            const inventory = await tx.inventory.findFirst({
              where: inventoryWhereFor(
                cartItem.productId,
                cartItem.variantId,
                businessUnitId,
              ),
              select: { id: true, quantity: true, reserved: true },
            });

            const availableStock = inventory
              ? Math.max(
                  0,
                  (inventory.quantity || 0) - (inventory.reserved || 0),
                )
              : 0;

            if (availableStock < quantity) {
              throw new AppError(
                `Insufficient stock. Available: ${availableStock}`,
                400,
              );
            }

            // Server-authoritative unit price again.
            const serverUnitPrice =
              cartItem.variant?.price ?? cartItem.product.unitPrice ?? 0;

            await tx.cartItem.update({
              where: { id: itemId },
              data: {
                quantity,
                unitPrice: serverUnitPrice,
                total: round2(quantity * serverUnitPrice),
              },
            });
          }

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            businessUnitId,
          );

          await safeEmitEvent(`cart:${cartId}:updated`, {
            cartId,
            action: 'quantity_updated',
            itemId,
            quantity,
          });

          const cartWithStatus = ensureCartStatus(updatedCart);
          return await this.formatCartResponse(cartWithStatus, businessUnitId);
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.updateCartItemQuantity');
      throw error;
    }
  }

  async removeItemFromCart(
    cartId: string,
    itemId: string,
  ): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cartItem = await tx.cartItem.findUnique({
            where: { id: itemId },
          });

          if (!cartItem) {
            throw new AppError('Cart item not found', 404);
          }

          if (cartItem.cartId !== cartId) {
            throw new AppError('Cart item does not belong to this cart', 400);
          }

          await tx.cartItem.delete({ where: { id: itemId } });

          const cart = await tx.cart.findUnique({ where: { id: cartId } });
          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            cart.businessUnitId,
          );

          await safeEmitEvent(`cart:${cartId}:updated`, {
            cartId,
            action: 'item_removed',
            itemId,
          });

          const cartWithStatus = ensureCartStatus(updatedCart);
          return await this.formatCartResponse(
            cartWithStatus,
            cart.businessUnitId,
          );
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.removeItemFromCart');
      throw error;
    }
  }

  async clearCart(cartId: string): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cart = await tx.cart.findUnique({ where: { id: cartId } });

          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          await tx.cartItem.deleteMany({ where: { cartId } });

          const updatedCart = await tx.cart.update({
            where: { id: cartId },
            data: {
              subtotal: 0,
              tax: 0,
              discount: 0,
              total: 0,
              discountType: null,
              promotionCode: null,
              promotionDiscount: 0,
              loyaltyPointsUsed: 0,
              loyaltyDiscount: 0,
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
          return await this.formatCartResponse(
            cartWithStatus,
            cart.businessUnitId,
          );
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.clearCart');
      throw error;
    }
  }

  // ============================================
  // DISCOUNTS & PROMOTIONS
  // ============================================

  async applyDiscount(
    cartId: string,
    discount: number,
    discountType: 'PERCENTAGE' | 'FIXED' = 'FIXED',
  ): Promise<CartResponse> {
    try {
      if (discount < 0) {
        throw new AppError('Discount cannot be negative', 400);
      }

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cart = await tx.cart.findUnique({ where: { id: cartId } });
          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          let actualDiscount = discount;
          if (discountType === 'PERCENTAGE') {
            actualDiscount = round2((cart.subtotal * discount) / 100);
          }

          if (actualDiscount > cart.subtotal) {
            throw new AppError('Discount cannot exceed subtotal', 400);
          }

          await tx.cart.update({
            where: { id: cartId },
            data: { discountType },
          });

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            cart.businessUnitId,
            actualDiscount,
          );

          const cartWithStatus = ensureCartStatus(updatedCart);
          return await this.formatCartResponse(
            cartWithStatus,
            cart.businessUnitId,
          );
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.applyDiscount');
      throw error;
    }
  }

  async applyPromotion(
    cartId: string,
    promotionCode: string,
  ): Promise<CartResponse> {
    try {
      if (!promotionCode) {
        throw new AppError('Promotion code is required', 400);
      }

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const cart = await tx.cart.findUnique({ where: { id: cartId } });
          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

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

          if (
            promotion.maxDiscount &&
            discountAmount > promotion.maxDiscount
          ) {
            discountAmount = promotion.maxDiscount;
          }

          if (discountAmount > cart.subtotal) {
            discountAmount = cart.subtotal;
          }
          discountAmount = round2(discountAmount);

          await tx.cart.update({
            where: { id: cartId },
            data: {
              promotionCode,
              promotionDiscount: discountAmount,
            },
          });

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            cart.businessUnitId,
            discountAmount,
          );

          await safeEmitEvent(`cart:${cartId}:promotion-applied`, {
            cartId,
            promotionCode,
            discountAmount,
          });

          const cartWithStatus = ensureCartStatus(updatedCart);
          return await this.formatCartResponse(
            cartWithStatus,
            cart.businessUnitId,
          );
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.applyPromotion');
      throw error;
    }
  }

  /**
   * Redeem loyalty points against the cart.
   *
   * IMPORTANT: this method decrements `Customer.loyaltyPoints` at the
   * moment of redemption. If the cart is later cleared or abandoned
   * without a sale, the points are NOT restored. That is the current
   * product decision — a checkout that fails after this call should
   * reverse the redemption via a compensating `LoyaltyHistory` entry.
   */
  async applyLoyaltyPoints(
    cartId: string,
    customerId: string,
    points: number,
  ): Promise<CartResponse> {
    try {
      if (!customerId || points <= 0) {
        throw new AppError('Valid customer ID and points are required', 400);
      }

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { id: true, loyaltyPoints: true },
          });

          if (!customer) {
            throw new AppError('Customer not found', 404);
          }

          if ((customer.loyaltyPoints || 0) < points) {
            throw new AppError('Insufficient loyalty points', 400);
          }

          const cart = await tx.cart.findUnique({ where: { id: cartId } });
          if (!cart) {
            throw new AppError('Cart not found', 404);
          }

          // 1 point = $0.10. Cap at 50% of subtotal.
          const discountFromPoints = round2(points * 0.1);
          const maxDiscount = round2(cart.subtotal * 0.5);
          const actualDiscount = Math.min(discountFromPoints, maxDiscount);
          const actualPointsUsed = Math.ceil(actualDiscount / 0.1);

          await tx.customer.update({
            where: { id: customerId },
            data: {
              loyaltyPoints: { decrement: actualPointsUsed },
            },
          });

          await tx.loyaltyHistory.create({
            data: {
              customerId,
              points: -actualPointsUsed,
              type: 'REDEEM',
              notes: `Redeemed for cart ${cartId}`,
              userId: cart.userId,
              businessUnitId: cart.businessUnitId,
            },
          });

          await tx.cart.update({
            where: { id: cartId },
            data: {
              loyaltyPointsUsed: actualPointsUsed,
              loyaltyDiscount: actualDiscount,
            },
          });

          const updatedCart = await this.recalculateCart(
            tx,
            cartId,
            cart.businessUnitId,
            actualDiscount,
          );

          await safeEmitEvent(`cart:${cartId}:loyalty-applied`, {
            cartId,
            customerId,
            points: actualPointsUsed,
            discount: actualDiscount,
          });

          const cartWithStatus = ensureCartStatus(updatedCart);
          return await this.formatCartResponse(
            cartWithStatus,
            cart.businessUnitId,
          );
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.applyLoyaltyPoints');
      throw error;
    }
  }

  // ============================================
  // CUSTOMER & NOTES
  // ============================================

  async associateCustomer(
    cartId: string,
    customerId: string,
  ): Promise<CartResponse> {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: { customerId },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
          },
          customer: true,
        },
      });

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.associateCustomer');
      throw error;
    }
  }

  async updateCartNotes(cartId: string, notes?: string): Promise<CartResponse> {
    try {
      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: { notes: notes || '' },
        include: {
          items: {
            include: CART_ITEM_INCLUDE,
          },
          customer: true,
        },
      });

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.updateCartNotes');
      throw error;
    }
  }

  // ============================================
  // SYNC / SAVE / RESTORE / TRANSFER / SPLIT
  // ============================================

  async syncCartWithInventory(
    cartId: string,
    businessUnitId: string,
  ): Promise<{ valid: boolean; issues: string[] }> {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              product: { select: { name: true } },
            },
          },
        },
      });

      if (!cart) {
        return { valid: false, issues: ['Cart not found'] };
      }

      const issues: string[] = [];

      await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          for (const item of cart.items) {
            const inventory = await tx.inventory.findFirst({
              where: inventoryWhereFor(
                item.productId,
                item.variantId,
                businessUnitId,
              ),
              select: { id: true, quantity: true, reserved: true },
            });

            const available = inventory
              ? Math.max(
                  0,
                  (inventory.quantity || 0) - (inventory.reserved || 0),
                )
              : 0;

            if (!inventory) {
              issues.push(
                `No inventory record for ${(item as any).product?.name ?? item.productId}`,
              );
              await tx.cartItem.delete({ where: { id: item.id } });
            } else if (available === 0) {
              issues.push(
                `Out of stock: ${(item as any).product?.name ?? item.productId}`,
              );
              await tx.cartItem.delete({ where: { id: item.id } });
            } else if (available < item.quantity) {
              issues.push(
                `Insufficient stock for ${
                  (item as any).product?.name ?? item.productId
                }: ${available} available`,
              );
              await tx.cartItem.update({
                where: { id: item.id },
                data: {
                  quantity: available,
                  total: round2(available * item.unitPrice),
                },
              });
            }
          }

          await this.recalculateCart(tx, cartId, businessUnitId);
        },
      );

      return { valid: issues.length === 0, issues };
    } catch (error) {
      this.handleError(error, 'CartService.syncCartWithInventory');
      throw error;
    }
  }

  async saveCartForLater(cartId: string): Promise<CartResponse> {
    try {
      const cart = await this.prisma.cart.update({
        where: { id: cartId },
        data: { status: 'SAVED' },
        include: {
          items: { include: CART_ITEM_INCLUDE },
          customer: true,
        },
      });

      const cartWithStatus = ensureCartStatus(cart);
      return await this.formatCartResponse(cartWithStatus, cart.businessUnitId);
    } catch (error) {
      this.handleError(error, 'CartService.saveCartForLater');
      throw error;
    }
  }

  async restoreSavedCart(
    savedCartId: string,
    userId: string,
    businessUnitId: string,
  ): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const savedCart = await tx.cart.findUnique({
            where: { id: savedCartId },
            include: { items: true },
          });

          if (!savedCart) {
            throw new AppError('Saved cart not found', 404);
          }

          if (savedCart.userId !== userId) {
            throw new AppError(
              'You do not have permission to restore this cart',
              403,
            );
          }

          if (savedCart.status && savedCart.status !== 'SAVED') {
            throw new AppError('Cart is not saved', 400);
          }

          let activeCart: any = await tx.cart.findFirst({
            where: { userId, businessUnitId, status: 'ACTIVE' },
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
                status: 'ACTIVE',
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
            data: { status: 'ACTIVE' },
          });

          const updatedCart = await this.recalculateCart(
            tx,
            activeCart.id,
            businessUnitId,
          );

          const cartWithStatus = ensureCartStatus(updatedCart);
          return await this.formatCartResponse(cartWithStatus, businessUnitId);
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.restoreSavedCart');
      throw error;
    }
  }

  async transferCart(
    fromUserId: string,
    toUserId: string,
    businessUnitId: string,
  ): Promise<CartResponse> {
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const targetUser = await tx.user.findUnique({
            where: { id: toUserId },
            select: { id: true },
          });

          if (!targetUser) {
            throw new AppError('Target user not found', 404);
          }

          const sourceCart = await tx.cart.findFirst({
            where: { userId: fromUserId, businessUnitId, status: 'ACTIVE' },
          });

          if (!sourceCart) {
            throw new AppError('Source cart not found', 404);
          }

          let targetCart: any = await tx.cart.findFirst({
            where: { userId: toUserId, businessUnitId, status: 'ACTIVE' },
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
                  variantId: item.variantId ?? null,
                },
              });

              if (existingItem) {
                const newQuantity = existingItem.quantity + item.quantity;
                await tx.cartItem.update({
                  where: { id: existingItem.id },
                  data: {
                    quantity: newQuantity,
                    total: round2(newQuantity * item.unitPrice),
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

            const updatedCart = await this.recalculateCart(
              tx,
              targetCart.id,
              businessUnitId,
            );

            const cartWithStatus = ensureCartStatus(updatedCart);
            return await this.formatCartResponse(
              cartWithStatus,
              businessUnitId,
            );
          }

          // No target cart — reassign the source cart to the new user.
          const transferredCart = await tx.cart.update({
            where: { id: sourceCart.id },
            data: { userId: toUserId },
            include: {
              items: { include: CART_ITEM_INCLUDE },
              customer: true,
            },
          });

          const cartWithStatus = ensureCartStatus(transferredCart);
          return await this.formatCartResponse(cartWithStatus, businessUnitId);
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.transferCart');
      throw error;
    }
  }

  async splitCart(
    userId: string,
    splits: Array<{
      cartItemId: string;
      quantity: number;
      targetUserId: string;
    }>,
    businessUnitId: string,
  ): Promise<{ sourceCart: CartResponse; targetCarts: CartResponse[] }> {
    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const sourceCart = await tx.cart.findFirst({
            where: { userId, businessUnitId, status: 'ACTIVE' },
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
              throw new AppError(
                `Cart item ${split.cartItemId} not found`,
                404,
              );
            }

            if (cartItem.cartId !== sourceCart.id) {
              throw new AppError(
                `Cart item ${split.cartItemId} does not belong to source cart`,
                400,
              );
            }

            if (cartItem.quantity < split.quantity) {
              throw new AppError(
                `Insufficient quantity for item ${cartItem.id}`,
                400,
              );
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
                  status: 'ACTIVE',
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
                total: round2(split.quantity * cartItem.unitPrice),
                notes: cartItem.notes,
              },
            });

            if (cartItem.quantity === split.quantity) {
              await tx.cartItem.delete({ where: { id: split.cartItemId } });
            } else {
              const remainingQuantity = cartItem.quantity - split.quantity;
              await tx.cartItem.update({
                where: { id: split.cartItemId },
                data: {
                  quantity: remainingQuantity,
                  total: round2(remainingQuantity * cartItem.unitPrice),
                },
              });
            }

            processedItems.push(split.cartItemId);

            const updatedTargetCart = await this.recalculateCart(
              tx,
              targetCart.id,
              businessUnitId,
            );

            targetCarts.push(
              await this.formatCartResponse(
                ensureCartStatus(updatedTargetCart),
                businessUnitId,
              ),
            );
          }

          const updatedSourceCart = await this.recalculateCart(
            tx,
            sourceCart.id,
            businessUnitId,
          );

          return {
            sourceCart: await this.formatCartResponse(
              ensureCartStatus(updatedSourceCart),
              businessUnitId,
            ),
            targetCarts,
          };
        },
      );
    } catch (error) {
      this.handleError(error, 'CartService.splitCart');
      throw error;
    }
  }

  // ============================================
  // SETTINGS
  // ============================================

  async getCartSettings(businessUnitId: string): Promise<any> {
    let settings = await this.prisma.cartSettings.findFirst({
      where: { businessUnitId },
    });

    if (!settings) {
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

  async updateCartSettings(businessUnitId: string, data: any): Promise<any> {
    const settings = await this.prisma.cartSettings.update({
      where: { businessUnitId },
      data: { ...data, updatedAt: new Date() },
    });

    return settings;
  }

  // ============================================
  // HISTORY / ANALYTICS / EXPORT
  // ============================================

  async getAbandonedCarts(params: {
    businessUnitId: string;
    hours?: number;
    minValue?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    carts: any[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const {
        businessUnitId,
        hours = 24,
        minValue,
        page = 1,
        limit = 10,
      } = params;
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
            items: { include: { product: true } },
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
      throw error;
    }
  }

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

      const [totalCarts, cartItems, cartValues, activeCarts, abandonedCarts] =
        await Promise.all([
          this.prisma.cart.count({ where }),
          this.prisma.cartItem.aggregate({
            where: { cart: where },
            _avg: { quantity: true },
          }),
          this.prisma.cart.aggregate({
            where,
            _avg: { total: true },
          }),
          this.prisma.cart.count({
            where: { ...where, status: 'ACTIVE' },
          }),
          this.prisma.cart.count({
            where: { ...where, status: 'ABANDONED' },
          }),
        ]);

      const averageItems = cartItems._avg.quantity || 0;
      const averageValue = cartValues._avg.total || 0;
      // Conversion = non-active carts (checked out) ÷ total carts.
      const checkedOut = totalCarts - activeCarts - abandonedCarts;
      const conversionRate =
        totalCarts > 0 ? (checkedOut / totalCarts) * 100 : 0;

      return {
        totalCarts,
        activeCarts,
        abandonedCarts,
        averageItems,
        averageValue,
        conversionRate: round2(conversionRate),
      };
    } catch (error) {
      this.handleError(error, 'CartService.getCartAnalytics');
      throw error;
    }
  }

  async getCartHistory(params: {
    userId: string;
    businessUnitId: string;
    page?: number;
    limit?: number;
  }): Promise<{
    carts: any[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  }> {
    try {
      const { userId, businessUnitId, page = 1, limit = 10 } = params;
      const skip = (page - 1) * limit;

      const where = { userId, businessUnitId };

      const [carts, total] = await Promise.all([
        this.prisma.cart.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            items: { include: { product: true, variant: true } },
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
      throw error;
    }
  }

  async exportCartAnalytics(params: {
    businessUnitId: string;
    startDate: Date;
    endDate: Date;
    includeDetailedData?: boolean;
  }): Promise<{ analytics: any; detailedData: any[] }> {
    try {
      const {
        businessUnitId,
        startDate,
        endDate,
        includeDetailedData = true,
      } = params;

      const analytics = await this.getCartAnalytics({
        businessUnitId,
        startDate,
        endDate,
      });

      let detailedData: any[] = [];
      if (includeDetailedData) {
        detailedData = await this.prisma.cart.findMany({
          where: {
            businessUnitId,
            createdAt: { gte: startDate, lte: endDate },
          },
          include: {
            items: { include: { product: true, variant: true } },
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
      throw error;
    }
  }

  // ============================================
  // PRIVATE — RECALCULATION
  // ============================================

  /**
   * Recalculate cart totals from the source-of-truth prices and
   * persist both the line totals and the cart-level totals.
   *
   * Two invariants this method enforces:
   *
   *   1. `cartItem.unitPrice` always equals the current server price
   *      (variant price if present, else product unitPrice). If a
   *      caller wrote a stale or malicious price, this method
   *      overwrites it.
   *
   *   2. `cart.subtotal`, `cart.tax`, `cart.discount`, and `cart.total`
   *      are always the output of `computeCartTotals`, never
   *      accumulated by hand.
   */
  private async recalculateCart(
    tx: Prisma.TransactionClient,
    cartId: string,
    businessUnitId: string,
    discountOverride?: number,
  ) {
    const items = await tx.cartItem.findMany({
      where: { cartId },
      include: {
        product: { select: { unitPrice: true, taxRate: true } },
        variant: { select: { price: true } },
      },
    });

    // Server-authoritative unit price per line.
    const lines = items.map((item: any) => {
      const serverUnitPrice =
        item.variant?.price ?? item.product.unitPrice ?? 0;
      return {
        unitPrice: serverUnitPrice,
        quantity: item.quantity,
        taxRate: item.product.taxRate ?? 0,
      };
    });

    const cart = await tx.cart.findUnique({ where: { id: cartId } });
    if (!cart) throw new AppError('Cart not found', 404);

    const cartDiscount =
      discountOverride !== undefined
        ? discountOverride
        : cart.discount ?? 0;

    const totals = computeCartTotals(lines, cartDiscount);

    // Sync every line's stored unitPrice and total to the server value.
    // Do this unconditionally — it's cheap and it guarantees no stale
    // price survives a recalc.
    for (let i = 0; i < items.length; i++) {
      const serverUnitPrice = lines[i].unitPrice;
      const serverLineTotal = round2(serverUnitPrice * items[i].quantity);

      if (
        items[i].unitPrice !== serverUnitPrice ||
        items[i].total !== serverLineTotal
      ) {
        await tx.cartItem.update({
          where: { id: items[i].id },
          data: {
            unitPrice: serverUnitPrice,
            total: serverLineTotal,
          },
        });
      }
    }

    return await tx.cart.update({
      where: { id: cartId },
      data: {
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
      },
      include: {
        items: {
          include: CART_ITEM_INCLUDE,
          orderBy: { createdAt: 'asc' },
        },
        customer: true,
      },
    });
  }

  // ============================================
  // PRIVATE — RESPONSE SHAPING
  // ============================================

  /**
   * Format a raw Prisma cart into the API response shape.
   *
   * Enriches each line with live inventory data (availableStock,
   * isInStock). Runs one inventory query per line — acceptable for
   * POS carts which are small. If carts ever grow large, replace this
   * with a single grouped query.
   */
  private async formatCartResponse(
    cart: any,
    businessUnitId?: string,
  ): Promise<CartResponse> {
    const effectiveBusinessUnitId =
      businessUnitId || cart.businessUnitId;

    const items: CartItemResponse[] = await Promise.all(
      (cart.items || []).map(async (item: any) => {
        let availableStock = 0;
        let isInStock = false;

        try {
          const inventory = await this.prisma.inventory.findFirst({
            where: inventoryWhereFor(
              item.productId,
              item.variantId,
              effectiveBusinessUnitId,
            ),
            select: { quantity: true, reserved: true },
          });

          if (inventory) {
            availableStock = Math.max(
              0,
              (inventory.quantity || 0) - (inventory.reserved || 0),
            );
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
      }),
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
      itemCount: items.reduce(
        (sum: number, item: CartItemResponse) => sum + item.quantity,
        0,
      ),
    };
  }
}

export default CartService;
