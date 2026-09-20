// src/services/guestCartService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';

// ============================================
// TYPES
// ============================================

export interface GuestCartItemInput {
  productId: string;
  variantId?: string | null;
  quantity?: number;
}

/**
 * Shape returned to the controller. Mirrors what `loadCart` produced
 * in the old controller — a Cart with its items and each item's
 * product/variant images eager-loaded.
 */
export type GuestCart = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        product: { include: { images: true } };
        variant: { include: { images: true } };
      };
    };
  };
}>;

// ============================================
// SERVICE
// ============================================

export class GuestCartService extends BaseService {
  /**
   * Resolve the session row and confirm it hasn't expired.
   * Returns the session's cart id (or null) without loading the cart.
   */
  private async readSession(sessionId: string): Promise<{
    id: string;
    cartId: string | null;
    expiresAt: Date;
  }> {
    const session = await this.prisma.guestSession.findUnique({
      where: { id: sessionId },
      select: { id: true, cartId: true, expiresAt: true },
    });

    if (!session) {
      throw new AppError('Guest session not found', 404);
    }
    if (session.expiresAt < new Date()) {
      throw new AppError('Guest session expired', 401);
    }

    return session;
  }

  /**
   * Load the guest's cart with items + product/variant images.
   * Returns null when the session exists but has no cart yet.
   */
  async getCart(sessionId: string): Promise<GuestCart | null> {
    const session = await this.prisma.guestSession.findUnique({
      where: { id: sessionId },
      include: {
        cart: {
          include: {
            items: {
              include: {
                product: { include: { images: true } },
                variant: { include: { images: true } },
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) return null;
    return session.cart ?? null;
  }

  /**
   * Item count for the guest's cart. Reads only what's needed.
   */
  async getCartCount(sessionId: string): Promise<number> {
    const session = await this.prisma.guestSession.findUnique({
      where: { id: sessionId },
      select: {
        expiresAt: true,
        cart: { select: { _count: { select: { items: true } } } },
      },
    });

    if (!session || session.expiresAt < new Date()) return 0;
    return session.cart?._count.items ?? 0;
  }

  /**
   * Resolve the guest's cart, creating one on first write.
   */
  async ensureCart(sessionId: string): Promise<GuestCart> {
    const session = await this.readSession(sessionId);

    if (session.cartId) {
      const existing = await this.prisma.cart.findUnique({
        where: { id: session.cartId },
        include: {
          items: {
            include: {
              product: { include: { images: true } },
              variant: { include: { images: true } },
            },
          },
        },
      });
      if (existing) return existing;
    }

    const businessUnitId = await this.resolveGuestBusinessUnitId();

    const created = await this.prisma.cart.create({
      data: {
        userId: `guest_${sessionId}`,
        businessUnitId,
        status: 'ACTIVE',
      },
      include: {
        items: {
          include: {
            product: { include: { images: true } },
            variant: { include: { images: true } },
          },
        },
      },
    });

    await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: { cartId: created.id },
    });

    return created;
  }

  /**
   * Add an item — merges into an existing row for the same
   * (productId, variantId) pair rather than creating a duplicate.
   */
  async addItem(
    sessionId: string,
    input: GuestCartItemInput,
  ): Promise<GuestCart | null> {
    const { productId, variantId, quantity = 1 } = input;

    if (!productId) {
      throw new AppError('productId is required', 400);
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      throw new AppError('quantity must be at least 1', 400);
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, unitPrice: true, isActive: true, deletedAt: true },
    });

    if (!product) throw new AppError('Product not found', 404);
    if (!product.isActive || product.deletedAt) {
      throw new AppError('Product is not available', 400);
    }

    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, isActive: true },
      });
      if (!variant) throw new AppError('Variant not found', 404);
      if (variant.productId !== productId) {
        throw new AppError('Variant does not belong to this product', 400);
      }
      if (!variant.isActive) {
        throw new AppError('Variant is not available', 400);
      }
    }

    const cart = await this.ensureCart(sessionId);
    const resolvedVariantId = variantId ?? null;

    const existing = await this.prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: resolvedVariantId,
      },
    });

    if (existing) {
      const nextQty = existing.quantity + qty;
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: nextQty,
          total: nextQty * existing.unitPrice,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          variantId: resolvedVariantId,
          quantity: qty,
          unitPrice: product.unitPrice,
          total: qty * product.unitPrice,
        },
      });
    }

    return this.getCart(sessionId);
  }

  /**
   * Set an item's quantity to an exact value. Rejects unknown items
   * and items that don't belong to the caller's cart.
   */
  async updateItem(
    sessionId: string,
    itemId: string,
    quantity: number,
  ): Promise<GuestCart | null> {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      throw new AppError('quantity must be at least 1', 400);
    }

    const cart = await this.ensureCart(sessionId);

    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      select: { id: true, unitPrice: true },
    });

    if (!item) throw new AppError('Cart item not found', 404);

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: qty,
        total: qty * item.unitPrice,
      },
    });

    return this.getCart(sessionId);
  }

  /**
   * Remove one item. `deleteMany` keeps this idempotent — removing an
   * item that's already gone returns success, matching the old
   * controller's behavior.
   */
  async removeItem(
    sessionId: string,
    itemId: string,
  ): Promise<GuestCart | null> {
    const cart = await this.ensureCart(sessionId);

    await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });

    return this.getCart(sessionId);
  }

  /**
   * Empty the cart. Leaves the Cart row itself in place so the
   * session's `cartId` stays valid for the next write.
   */
  async clearCart(sessionId: string): Promise<void> {
    const cart = await this.getCart(sessionId);
    if (!cart) return;

    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Guests land on the most recently created active business unit.
   * In multi-tenant setups the caller can swap this for an explicit
   * BU lookup keyed off a subdomain, header, or query param.
   */
  private async resolveGuestBusinessUnitId(): Promise<string> {
    const bu = await this.prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!bu) {
      throw new AppError('No active business unit available', 500);
    }
    return bu.id;
  }
}

export const guestCartService = new GuestCartService();
