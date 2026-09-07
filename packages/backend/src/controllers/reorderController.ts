// src/controllers/reorderController.ts
import { Request, Response, NextFunction } from 'express';
import { reorderService } from '../services/reorderService.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

// Validation schemas
const createReorderSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be positive').optional(),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

const updateReorderSchema = z.object({
  quantity: z.number().int().positive('Quantity must be positive').optional(),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED']).optional(),
});

export const reorderController = {
  /**
   * Check and create reorder orders
   * POST /reorder/check
   */
  async checkAndCreateReorderOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const count = await reorderService.checkAndCreateReorderOrders(businessUnitId);

      res.status(200).json({
        success: true,
        data: { lowStockItems: count },
        message: count > 0 
          ? `${count} low stock items found, reorder orders created` 
          : 'No low stock items found',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Start inventory monitor
   * POST /reorder/monitor/start
   */
  async startInventoryMonitor(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { intervalMinutes = 30 } = req.body;

      if (intervalMinutes < 5) {
        throw new AppError('Interval must be at least 5 minutes', 400);
      }

      const interval = await reorderService.startInventoryMonitor(businessUnitId);

      // Store interval reference (in a real implementation, this would be in a service registry)
      (req as any).app.locals.reorderMonitorInterval = interval;
      (req as any).app.locals.reorderMonitorBusinessUnitId = businessUnitId;
      (req as any).app.locals.reorderMonitorStartedAt = new Date();

      res.status(200).json({
        success: true,
        data: {
          started: true,
          businessUnitId: businessUnitId || 'all',
          intervalMinutes,
          startedAt: new Date(),
        },
        message: 'Inventory monitor started',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Stop inventory monitor
   * POST /reorder/monitor/stop
   */
  async stopInventoryMonitor(req: Request, res: Response, next: NextFunction) {
    try {
      const interval = (req as any).app.locals.reorderMonitorInterval;

      if (!interval) {
        throw new AppError('No active inventory monitor found', 404);
      }

      reorderService.stopInventoryMonitor(interval);

      // Clear interval reference
      (req as any).app.locals.reorderMonitorInterval = null;
      (req as any).app.locals.reorderMonitorBusinessUnitId = null;
      (req as any).app.locals.reorderMonitorStartedAt = null;

      res.status(200).json({
        success: true,
        message: 'Inventory monitor stopped',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get monitor status
   * GET /reorder/monitor/status
   */
  async getMonitorStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const interval = (req as any).app.locals.reorderMonitorInterval;
      const businessUnitId = (req as any).app.locals.reorderMonitorBusinessUnitId;
      const startedAt = (req as any).app.locals.reorderMonitorStartedAt;

      res.status(200).json({
        success: true,
        data: {
          active: !!interval,
          businessUnitId: businessUnitId || 'all',
          startedAt: startedAt || null,
          uptime: startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get low stock items
   * GET /reorder/low-stock
   */
  async getLowStockItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { threshold } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const where: any = {
        businessUnitId,
        quantity: {
          lte: threshold ? parseInt(threshold as string) : prisma.inventory.fields.reorderPoint,
        },
      };

      const lowStockItems = await prisma.inventory.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unitPrice: true,
              costPrice: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
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
        orderBy: {
          quantity: 'asc',
        },
      });

      // FIXED: Use product.id instead of productId
      res.status(200).json({
        success: true,
        data: lowStockItems.map(item => ({
          id: item.id,
          productId: item.product?.id || null,
          productName: item.product?.name || 'Unknown',
          sku: item.product?.sku || 'N/A',
          currentQuantity: item.quantity,
          reorderPoint: item.reorderPoint,
          reorderQuantity: item.reorderQuantity,
          deficit: Math.max(0, item.reorderPoint - item.quantity),
          supplier: item.product?.supplier || null,
          severity: item.quantity === 0 
            ? 'CRITICAL' 
            : item.quantity < item.reorderPoint / 2 
              ? 'HIGH' 
              : 'MEDIUM',
        })),
        count: lowStockItems.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get out of stock items
   * GET /reorder/out-of-stock
   */
  async getOutOfStockItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const outOfStockItems = await prisma.inventory.findMany({
        where: {
          businessUnitId,
          quantity: 0,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      // FIXED: Map items with productId from relation
      const formattedItems = outOfStockItems.map(item => ({
        ...item,
        productId: item.product?.id || null,
        productName: item.product?.name || 'Unknown',
        sku: item.product?.sku || 'N/A',
        supplier: item.product?.supplier || null,
      }));

      res.status(200).json({
        success: true,
        data: formattedItems,
        count: formattedItems.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get reorder recommendations
   * GET /reorder/recommendations
   */
  async getReorderRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      // Get low stock items with sales history to calculate recommended quantities
      const lowStockItems = await prisma.inventory.findMany({
        where: {
          businessUnitId,
          quantity: { lte: prisma.inventory.fields.reorderPoint },
        },
        include: {
          product: {
            include: {
              saleItems: {
                where: {
                  sale: {
                    saleDate: {
                      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                    },
                  },
                },
                select: {
                  quantity: true,
                },
              },
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // FIXED: Added null checks for item.product
      const recommendations = lowStockItems.map(item => {
        const product = item.product;
        
        // Calculate average daily sales
        const totalSold = product?.saleItems?.reduce((sum, si) => sum + si.quantity, 0) || 0;
        const avgDailySales = totalSold / 30;
        
        // Calculate recommended reorder quantity (30 days of supply)
        const recommendedQuantity = Math.max(
          item.reorderQuantity || 10,
          Math.ceil(avgDailySales * 30)
        );

        return {
          productId: product?.id || '',
          productName: product?.name || 'Unknown',
          sku: product?.sku || 'N/A',
          currentQuantity: item.quantity,
          reorderPoint: item.reorderPoint,
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          recommendedQuantity,
          supplier: product?.supplier || null,
          urgency: item.quantity === 0 
            ? 'URGENT' 
            : item.quantity < item.reorderPoint / 2 
              ? 'HIGH' 
              : 'MEDIUM',
        };
      });

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create manual reorder order
   * POST /reorder/create
   */
  async createReorderOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, id: userId } = (req as any).user || {};
      const data = createReorderSchema.parse(req.body);

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      // Get product with inventory
      const product = await prisma.product.findUnique({
        where: { id: data.productId },
        include: {
          inventory: true,
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // FIXED: inventory is a single object, not an array
      const inventory = product.inventory;
      if (!inventory) {
        throw new AppError('Product has no inventory record', 400);
      }

      const reorderQuantity = data.quantity || inventory.reorderQuantity || 10;
      const supplierId = data.supplierId || product.supplierId;

      if (!supplierId) {
        throw new AppError('No supplier found for this product', 400);
      }

      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      // Check if there's already a pending PO
      const existingPO = await prisma.purchaseOrder.findFirst({
        where: {
          businessUnitId,
          status: { in: ['DRAFT', 'PENDING'] },
          items: { some: { productId: data.productId } },
        },
      });

      if (existingPO) {
        throw new AppError(`Pending purchase order already exists: ${existingPO.orderNumber}`, 400);
      }

      const orderNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const po = await prisma.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId,
          status: 'DRAFT',
          priority: data.priority || 'MEDIUM',
          total: reorderQuantity * (product.costPrice || product.unitPrice || 0),
          notes: data.notes || `Auto-generated reorder for ${product.name}`,
          businessUnitId,
          userId,
          items: {
            create: {
              productId: data.productId,
              quantity: reorderQuantity,
              unitPrice: product.costPrice || product.unitPrice || 0,
              total: reorderQuantity * (product.costPrice || product.unitPrice || 0),
            },
          },
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

      res.status(201).json({
        success: true,
        data: po,
        message: 'Reorder order created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get reorder history
   * GET /reorder/history
   */
  async getReorderHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { page = 1, limit = 20, status } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const where: any = {
        businessUnitId,
        notes: { contains: 'reorder', mode: 'insensitive' },
      };
      if (status) where.status = status;

      const [orders, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
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
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.purchaseOrder.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: orders,
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          limit: Number(limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get reorder statistics
   * GET /reorder/stats
   */
  async getReorderStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const [lowStock, outOfStock, pendingOrders, totalInventory] = await Promise.all([
        prisma.inventory.count({
          where: {
            businessUnitId,
            quantity: { lte: prisma.inventory.fields.reorderPoint, gt: 0 },
          },
        }),
        prisma.inventory.count({
          where: {
            businessUnitId,
            quantity: 0,
          },
        }),
        prisma.purchaseOrder.count({
          where: {
            businessUnitId,
            status: { in: ['DRAFT', 'PENDING'] },
          },
        }),
        prisma.inventory.count({
          where: { businessUnitId },
        }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          lowStockItems: lowStock,
          outOfStockItems: outOfStock,
          pendingReorderOrders: pendingOrders,
          totalInventoryItems: totalInventory,
          reorderRate: totalInventory > 0 ? ((lowStock + outOfStock) / totalInventory) * 100 : 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
