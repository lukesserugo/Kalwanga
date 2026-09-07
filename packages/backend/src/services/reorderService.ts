// src/services/reorderService.ts
import { prisma } from '../lib/prisma.js';
import { realtimeService } from './realtimeService.js';
import { notificationService } from './notificationService.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import * as crypto from 'crypto';

// Enhanced types
interface ReorderRecommendation {
  productId: string;
  productName: string;
  sku: string;
  currentQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  avgDailySales: number;
  recommendedQuantity: number;
  supplierId?: string;
  supplierName?: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  daysOfSupply: number;
}

interface ReorderStats {
  lowStockItems: number;
  outOfStockItems: number;
  pendingReorderOrders: number;
  totalInventoryItems: number;
  reorderRate: number;
  totalReorderValue: number;
  lastCheckAt?: Date;
}

interface MonitorConfig {
  intervalMinutes: number;
  businessUnitId?: string;
  autoCreateOrders: boolean;
  notifyOnLowStock: boolean;
  minStockThreshold?: number;
}

export class ReorderService {
  private monitorIntervals: Map<string, NodeJS.Timeout> = new Map();
  private monitorConfigs: Map<string, MonitorConfig> = new Map();
  private isMonitoring: boolean = false;

  /**
   * Check inventory levels and create purchase orders automatically
   */
  async checkAndCreateReorderOrders(businessUnitId: string): Promise<number> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      logger.info(`Checking reorder levels for business unit: ${businessUnitId}`);

      // Get all low stock items
      const lowStockItems = await prisma.inventory.findMany({
        where: {
          businessUnitId,
          quantity: { lte: prisma.inventory.fields.reorderPoint },
          product: {
            isActive: true,
          },
        },
        include: {
          product: {
            include: {
              supplier: true,
              saleItems: {
                where: {
                  sale: {
                    saleDate: {
                      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                  },
                },
                select: {
                  quantity: true,
                },
              },
            },
          },
          variant: true,
        },
        orderBy: {
          quantity: 'asc',
        },
      });

      let createdOrders = 0;

      for (const item of lowStockItems) {
        try {
          // Get product ID from the product relation
          const productId = item.product?.id;
          const variantId = item.variant?.id;

          if (!productId) {
            logger.warn(`Inventory item ${item.id} has no associated product`);
            continue;
          }

          // Check if there's already a pending PO for this product
          const existingPO = await prisma.purchaseOrder.findFirst({
            where: {
              businessUnitId,
              status: { in: ['DRAFT', 'PENDING', 'APPROVED'] },
              items: { some: { productId: productId } },
            },
          });

          if (existingPO) {
            logger.debug(`Pending PO already exists for product ${productId}: ${existingPO.orderNumber}`);
            continue;
          }

          const supplierId = item.product?.supplierId;

          if (!supplierId) {
            logger.warn(`No supplier found for product ${productId}`);
            
            // FIXED: Correct parameter order - type is 4th param, data is 6th param
            // sendBusinessUnitNotification(businessUnitId, title, message, type, excludeUserId?, data?)
            await notificationService.sendBusinessUnitNotification(
              businessUnitId,
              'Reorder Alert - No Supplier',
              `Product ${item.product?.name || 'Unknown'} is low on stock but has no supplier assigned`,
              'WARNING',  // 4th parameter: type (string)
              undefined,  // 5th parameter: excludeUserId (string | undefined)
              { productId } // 6th parameter: data (object)
            );
            continue;
          }

          // Calculate reorder quantity based on sales history
          const totalSold = item.product?.saleItems?.reduce((sum, si) => sum + si.quantity, 0) || 0;
          const avgDailySales = totalSold / 30;
          const recommendedQuantity = Math.max(
            item.reorderQuantity || 10,
            Math.ceil(avgDailySales * 30)
          );

          const unitPrice = item.product?.costPrice || item.product?.unitPrice || 0;
          const total = recommendedQuantity * unitPrice;

          const orderNumber = await this.generateUniqueOrderNumber();

          // Create purchase order
          const po = await prisma.purchaseOrder.create({
            data: {
              orderNumber,
              supplierId,
              status: 'DRAFT',
              total: total,
              notes: `Auto-generated reorder for ${item.product?.name || 'Unknown'} (Current: ${item.quantity}, Reorder Point: ${item.reorderPoint})`,
              businessUnitId,
              userId: item.product?.createdBy || 'system',
              expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
              items: {
                create: {
                  productId: productId,
                  variantId: variantId || null,
                  quantity: recommendedQuantity,
                  unitPrice,
                  total,
                  notes: `Auto-reorder based on low stock (${item.quantity} remaining)`,
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

          createdOrders++;

          // Emit realtime event
          try {
            (realtimeService as any).emitPurchaseOrderCreated?.(po, businessUnitId);
          } catch (wsError) {
            logger.warn('Failed to emit PO created event:', wsError);
          }

          // FIXED: Correct parameter order - type is 4th param, data is 6th param
          // sendBusinessUnitNotification(businessUnitId, title, message, type, excludeUserId?, data?)
          try {
            await notificationService.sendBusinessUnitNotification(
              businessUnitId,
              'Reorder Alert',
              `Auto-generated PO ${po.orderNumber} for ${item.product?.name || 'Unknown'} (${recommendedQuantity} units) from ${po.supplier?.name || 'Unknown Supplier'}`,
              'ORDER',  // 4th parameter: type (string)
              undefined,  // 5th parameter: excludeUserId (string | undefined)
              { poId: po.id, productId } // 6th parameter: data (object)
            );
          } catch (notifError) {
            logger.warn('Failed to send reorder notification:', notifError);
          }

          logger.info(`Created reorder PO ${orderNumber} for product ${productId}`);
        } catch (itemError) {
          logger.error(`Failed to create reorder for product ${item.product?.id}:`, itemError);
        }
      }

      // Update last check timestamp
      await this.updateLastCheckTimestamp(businessUnitId);

      return createdOrders;
    } catch (error) {
      logger.error('Reorder check failed:', error);
      throw new AppError('Failed to check and create reorder orders', 500);
    }
  }

  /**
   * Generate unique order number
   */
  private async generateUniqueOrderNumber(): Promise<string> {
    let orderNumber: string;
    let counter = 0;

    do {
      orderNumber = `PO-${Date.now().toString().slice(-8)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      counter++;
      if (counter > 100) {
        throw new AppError('Failed to generate unique order number', 500);
      }
    } while (await prisma.purchaseOrder.findUnique({ where: { orderNumber } }));

    return orderNumber;
  }

  /**
   * Update last check timestamp
   */
  private async updateLastCheckTimestamp(businessUnitId: string) {
    try {
      // Store in company settings or a dedicated table
      await prisma.$executeRaw`
        INSERT INTO "ReorderCheck" ("id", "businessUnitId", "checkedAt", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${businessUnitId}, NOW(), NOW(), NOW())
        ON CONFLICT ("businessUnitId") 
        DO UPDATE SET "checkedAt" = NOW(), "updatedAt" = NOW()
      `;
    } catch (error) {
      logger.warn('Failed to update last check timestamp:', error);
    }
  }

  /**
   * Monitor inventory in real-time
   */
  async startInventoryMonitor(businessUnitId?: string, config?: Partial<MonitorConfig>): Promise<NodeJS.Timeout> {
    try {
      const monitorKey = businessUnitId || 'all';
      
      // Stop existing monitor if running
      if (this.monitorIntervals.has(monitorKey)) {
        this.stopInventoryMonitor(this.monitorIntervals.get(monitorKey)!);
      }

      const monitorConfig: MonitorConfig = {
        intervalMinutes: config?.intervalMinutes || 30,
        businessUnitId,
        autoCreateOrders: config?.autoCreateOrders !== undefined ? config.autoCreateOrders : true,
        notifyOnLowStock: config?.notifyOnLowStock !== undefined ? config.notifyOnLowStock : true,
        minStockThreshold: config?.minStockThreshold,
      };

      this.monitorConfigs.set(monitorKey, monitorConfig);
      this.isMonitoring = true;

      const runCheck = async () => {
        try {
          logger.info(`Running reorder check for ${monitorKey} at ${new Date().toISOString()}`);
          
          if (businessUnitId) {
            await this.checkAndCreateReorderOrders(businessUnitId);
          } else {
            const businessUnits = await prisma.businessUnit.findMany({
              where: { isActive: true },
              select: { id: true },
            });

            for (const bu of businessUnits) {
              await this.checkAndCreateReorderOrders(bu.id);
            }
          }
        } catch (error) {
          logger.error('Reorder check failed in monitor:', error);
        }
      };

      // Run initial check
      await runCheck();

      // Set interval
      const interval = setInterval(runCheck, monitorConfig.intervalMinutes * 60 * 1000);
      this.monitorIntervals.set(monitorKey, interval);

      logger.info(`Inventory monitor started for ${monitorKey} with interval ${monitorConfig.intervalMinutes} minutes`);

      return interval;
    } catch (error) {
      logger.error('Failed to start inventory monitor:', error);
      throw new AppError('Failed to start inventory monitor', 500);
    }
  }

  /**
   * Stop inventory monitor
   */
  stopInventoryMonitor(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    this.isMonitoring = false;
    logger.info('Inventory monitor stopped');
  }

  /**
   * Stop all monitors
   */
  stopAllMonitors(): void {
    this.monitorIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.monitorIntervals.clear();
    this.monitorConfigs.clear();
    this.isMonitoring = false;
    logger.info('All inventory monitors stopped');
  }

  /**
   * Get monitor status
   */
  getMonitorStatus(): {
    isMonitoring: boolean;
    activeMonitors: Array<{
      key: string;
      config: MonitorConfig;
      startedAt?: Date;
    }>;
  } {
    return {
      isMonitoring: this.isMonitoring,
      activeMonitors: Array.from(this.monitorConfigs.entries()).map(([key, config]) => ({
        key,
        config,
      })),
    };
  }

  /**
   * Get low stock items with details
   */
  async getLowStockItems(businessUnitId: string, threshold?: number) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const where: any = {
        businessUnitId,
        quantity: {
          lte: threshold || prisma.inventory.fields.reorderPoint,
        },
        product: {
          isActive: true,
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

      return lowStockItems.map(item => {
        const product = item.product;
        return {
          id: item.id,
          productId: product?.id || null,
          productName: product?.name || 'Unknown',
          sku: product?.sku || 'N/A',
          barcode: product?.barcode || null,
          currentQuantity: item.quantity,
          reorderPoint: item.reorderPoint,
          reorderQuantity: item.reorderQuantity,
          deficit: Math.max(0, item.reorderPoint - item.quantity),
          supplier: product?.supplier || null,
          unitPrice: product?.unitPrice || 0,
          costPrice: product?.costPrice || 0,
          severity: item.quantity === 0 
            ? 'CRITICAL' 
            : item.quantity < item.reorderPoint / 2 
              ? 'HIGH' 
              : 'MEDIUM',
        };
      });
    } catch (error) {
      logger.error('Get low stock items failed:', error);
      throw new AppError('Failed to get low stock items', 500);
    }
  }

  /**
   * Get out of stock items
   */
  async getOutOfStockItems(businessUnitId: string) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const items = await prisma.inventory.findMany({
        where: {
          businessUnitId,
          quantity: 0,
          product: {
            isActive: true,
          },
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

      return items.map(item => ({
        ...item,
        productId: item.product?.id || null,
        productName: item.product?.name || 'Unknown',
        sku: item.product?.sku || 'N/A',
        supplier: item.product?.supplier || null,
      }));
    } catch (error) {
      logger.error('Get out of stock items failed:', error);
      throw new AppError('Failed to get out of stock items', 500);
    }
  }

  /**
   * Get reorder recommendations
   */
  async getReorderRecommendations(businessUnitId: string): Promise<ReorderRecommendation[]> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const lowStockItems = await prisma.inventory.findMany({
        where: {
          businessUnitId,
          quantity: { lte: prisma.inventory.fields.reorderPoint },
          product: {
            isActive: true,
          },
        },
        include: {
          product: {
            include: {
              saleItems: {
                where: {
                  sale: {
                    saleDate: {
                      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                    status: { not: 'CANCELLED' },
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

      return lowStockItems.map(item => {
        const product = item.product;
        const totalSold = product?.saleItems?.reduce((sum, si) => sum + si.quantity, 0) || 0;
        const avgDailySales = totalSold / 30;
        const recommendedQuantity = Math.max(
          item.reorderQuantity || 10,
          Math.ceil(avgDailySales * 30)
        );
        const daysOfSupply = avgDailySales > 0 ? Math.floor(item.quantity / avgDailySales) : 0;

        return {
          productId: product?.id || '',
          productName: product?.name || 'Unknown',
          sku: product?.sku || 'N/A',
          currentQuantity: item.quantity,
          reorderPoint: item.reorderPoint,
          reorderQuantity: item.reorderQuantity,
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          recommendedQuantity,
          supplierId: product?.supplier?.id,
          supplierName: product?.supplier?.name,
          urgency: item.quantity === 0 
            ? 'CRITICAL' 
            : item.quantity < item.reorderPoint / 2 
              ? 'HIGH' 
              : 'MEDIUM',
          daysOfSupply,
        };
      });
    } catch (error) {
      logger.error('Get reorder recommendations failed:', error);
      throw new AppError('Failed to get reorder recommendations', 500);
    }
  }

  /**
   * Create manual reorder order
   */
  async createReorderOrder(
    businessUnitId: string,
    userId: string,
    data: {
      productId: string;
      quantity?: number;
      supplierId?: string;
      notes?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    }
  ) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }
      if (!data.productId) {
        throw new AppError('Product ID is required', 400);
      }

      const product = await prisma.product.findUnique({
        where: { id: data.productId },
        include: {
          inventory: true,
          supplier: true,
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const inventory = product.inventory;
      if (!inventory) {
        throw new AppError('Product has no inventory record', 400);
      }

      const reorderQuantity = data.quantity || inventory.reorderQuantity || 10;
      const supplierId = data.supplierId || product.supplierId;

      if (!supplierId) {
        throw new AppError('No supplier found for this product', 400);
      }

      // Check for existing pending PO
      const existingPO = await prisma.purchaseOrder.findFirst({
        where: {
          businessUnitId,
          status: { in: ['DRAFT', 'PENDING', 'APPROVED'] },
          items: { some: { productId: data.productId } },
        },
      });

      if (existingPO) {
        throw new AppError(`Pending purchase order already exists: ${existingPO.orderNumber}`, 400);
      }

      const unitPrice = product.costPrice || product.unitPrice || 0;
      const total = reorderQuantity * unitPrice;
      const orderNumber = await this.generateUniqueOrderNumber();

      const po = await prisma.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId,
          status: 'DRAFT',
          total: total,
          notes: data.notes || `Manual reorder for ${product.name}`,
          businessUnitId,
          userId,
          expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          items: {
            create: {
              productId: data.productId,
              quantity: reorderQuantity,
              unitPrice,
              total,
              notes: `Manual reorder (Current stock: ${inventory.quantity})`,
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

      // Emit realtime event
      try {
        (realtimeService as any).emitPurchaseOrderCreated?.(po, businessUnitId);
      } catch (wsError) {
        logger.warn('Failed to emit PO created event:', wsError);
      }

      return po;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Create reorder order failed:', error);
      throw new AppError('Failed to create reorder order', 500);
    }
  }

  /**
   * Get reorder statistics
   */
  async getReorderStats(businessUnitId: string): Promise<ReorderStats> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const [lowStock, outOfStock, pendingOrders, totalInventory, totalReorderValue, lastCheck] = await Promise.all([
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
        prisma.purchaseOrder.aggregate({
          where: {
            businessUnitId,
            status: { in: ['DRAFT', 'PENDING'] },
          },
          _sum: { total: true },
        }),
        prisma.$queryRaw`
          SELECT "checkedAt" FROM "ReorderCheck" 
          WHERE "businessUnitId" = ${businessUnitId}
          LIMIT 1
        `,
      ]);

      return {
        lowStockItems: lowStock,
        outOfStockItems: outOfStock,
        pendingReorderOrders: pendingOrders,
        totalInventoryItems: totalInventory,
        reorderRate: totalInventory > 0 ? ((lowStock + outOfStock) / totalInventory) * 100 : 0,
        totalReorderValue: totalReorderValue._sum.total || 0,
        lastCheckAt: Array.isArray(lastCheck) && lastCheck.length > 0 
          ? (lastCheck[0] as any).checkedAt 
          : undefined,
      };
    } catch (error) {
      logger.error('Get reorder stats failed:', error);
      throw new AppError('Failed to get reorder statistics', 500);
    }
  }
}

export const reorderService = new ReorderService();
