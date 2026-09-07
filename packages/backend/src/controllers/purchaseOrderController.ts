// src/controllers/purchaseOrderController.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { realtimeService } from '../services/realtimeService.js';
import { notificationService } from '../services/notificationService.js';

const createPOSchema = z.object({
  supplierId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
  notes: z.string().optional(),
  expectedDelivery: z.string().datetime().optional(),
});

const receivePOSchema = z.object({
  receivedQuantities: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int().positive(),
  })).min(1),
});

export const purchaseOrderController = {
  /**
   * Get all purchase orders
   */
  async getAllPurchaseOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 20, status, supplierId, businessUnitId } = req.query;
      
      const where: any = {};
      if (status) where.status = status;
      if (supplierId) where.supplierId = supplierId;
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const [orders, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          include: {
            supplier: true,
            items: { include: { product: true } },
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.purchaseOrder.count({ where }),
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: { total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get purchase order by ID
   */
  async getPurchaseOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          items: { include: { product: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!po) throw new AppError('Purchase order not found', 404);

      res.json({ success: true, data: po });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create purchase order
   */
  async createPurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, id: userId } = req.user || {};
      const data = createPOSchema.parse(req.body);

      if (!businessUnitId) throw new AppError('Business unit required', 400);
      if (!userId) throw new AppError('User ID required', 400);

      const total = data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

      const orderNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const po = await prisma.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId: data.supplierId,
          status: 'PENDING',
          total,
          notes: data.notes,
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          businessUnitId,
          userId,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
      });

      // Notify users using notificationService instead of posSyncService
      await notificationService.sendBusinessUnitNotification(
        businessUnitId,
        'Purchase Order Created',
        `PO ${orderNumber} created for ${po.supplier.name}`,
        'PURCHASE_ORDER'
      );

      // Emit real-time event
      realtimeService.emitPurchaseOrderCreated(po, businessUnitId);

      res.status(201).json({ success: true, data: po });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return next(new AppError('Invalid PO data', 400, error.errors));
      }
      next(error);
    }
  },

  /**
   * Update purchase order
   */
  async updatePurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      const po = await prisma.purchaseOrder.update({
        where: { id },
        data,
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
      });

      res.json({ success: true, data: po });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const po = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          supplier: true,
        },
      });

      res.json({ success: true, data: po, message: 'Purchase order cancelled' });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Receive purchase order (update inventory)
   */
  async receivePurchaseOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { businessUnitId, id: userId } = req.user || {};
      const data = receivePOSchema.parse(req.body);

      if (!businessUnitId) throw new AppError('Business unit required', 400);
      if (!userId) throw new AppError('User ID required', 400);

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!po) throw new AppError('Purchase order not found', 404);

      // Update inventory for each received item
      for (const received of data.receivedQuantities) {
        const poItem = po.items.find(item => item.id === received.itemId);
        if (!poItem) throw new AppError(`Item ${received.itemId} not found in PO`, 400);

        // Find or create inventory
        const inventory = await prisma.inventory.findFirst({
          where: {
            productId: poItem.productId,
            variantId: poItem.variantId,
            businessUnitId,
          },
        });

        let inventoryId: string;

        if (inventory) {
          await prisma.inventory.update({
            where: { id: inventory.id },
            data: { quantity: { increment: received.quantity } },
          });
          inventoryId = inventory.id;
        } else {
          const newInventory = await prisma.inventory.create({
            data: {
              productId: poItem.productId,
              variantId: poItem.variantId,
              businessUnitId,
              quantity: received.quantity,
              reorderPoint: 5,
              reorderQuantity: 10,
            },
          });
          inventoryId = newInventory.id;
        }

        // Create inventory transaction
        await prisma.inventoryTransaction.create({
          data: {
            transactionType: 'PURCHASE',
            quantity: received.quantity,
            notes: `Received from PO ${po.orderNumber}`,
            reference: po.orderNumber,
            productId: poItem.productId,
            variantId: poItem.variantId,
            inventoryId,
            businessUnitId,
            userId,
            purchaseOrderId: po.id,
          },
        });

        // Update received quantity
        await prisma.purchaseOrderItem.update({
          where: { id: received.itemId },
          data: { receivedQuantity: { increment: received.quantity } },
        });
      }

      // Check if all items received
      const updatedPO = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      const allReceived = updatedPO?.items.every(item => item.receivedQuantity >= item.quantity);

      const finalPO = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
          receivedAt: allReceived ? new Date() : null,
          receivedBy: userId,
        },
        include: {
          supplier: true,
          items: { include: { product: true } },
        },
      });

      // Emit real-time event
      realtimeService.emitPurchaseOrderReceived(finalPO, businessUnitId);

      res.json({ success: true, data: finalPO, message: 'Purchase order received' });
    } catch (error) {
      next(error);
    }
  },
};
