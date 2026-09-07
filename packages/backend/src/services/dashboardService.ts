// src/services/dashboardService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { reorderService } from './reorderService.js';

interface DashboardStats {
  sales: {
    today: { total: number; count: number };
    week: { total: number; count: number };
    month: { total: number; count: number };
    year: { total: number; count: number };
  };
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStock: number;
    outOfStock: number;
    reorderNeeded: number;
  };
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  suppliers: {
    total: number;
    active: number;
  };
  registers: {
    open: number;
    total: number;
    totalCash: number;
  };
  orders: {
    pending: number;
    completed: number;
    cancelled: number;
  };
  recentActivity: any[];
  topProducts: any[];
  salesTrend: any[];
}

interface RealtimeData {
  recentSales: any[];
  lowStockInventory: any[];
  notifications: any[];
  openRegisters: any[];
  pendingOrders: any[];
  alerts: any[];
}

export class DashboardService extends BaseService {
  /**
   * Get comprehensive dashboard statistics
   */
  async getStats(businessUnitId: string): Promise<DashboardStats> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      const [
        todaySales,
        weekSales,
        monthSales,
        yearSales,
        inventory,
        customers,
        activeCustomers,
        newCustomersThisMonth,
        suppliers,
        activeSuppliers,
        lowStockItems,
        outOfStockItems,
        openRegisters,
        allRegisters,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        recentSales,
        topProducts,
      ] = await Promise.all([
        // Sales aggregates
        this.prisma.sale.aggregate({
          where: { businessUnitId, saleDate: { gte: startOfDay }, status: { not: 'CANCELLED' } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.sale.aggregate({
          where: { businessUnitId, saleDate: { gte: startOfWeek }, status: { not: 'CANCELLED' } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.sale.aggregate({
          where: { businessUnitId, saleDate: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.sale.aggregate({
          where: { businessUnitId, saleDate: { gte: startOfYear }, status: { not: 'CANCELLED' } },
          _sum: { total: true },
          _count: true,
        }),
        // Inventory
        this.prisma.inventory.findMany({
          where: { businessUnitId },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unitPrice: true,
                costPrice: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        // Customers
        this.prisma.customer.count(),
        this.prisma.customer.count({ where: { isActive: true } }),
        this.prisma.customer.count({
          where: {
            createdAt: { gte: startOfMonth },
          },
        }),
        // Suppliers
        this.prisma.supplier.count({
          where: {
            company: {
              businessUnits: {
                some: { id: businessUnitId },
              },
            },
          },
        }),
        this.prisma.supplier.count({
          where: {
            company: {
              businessUnits: {
                some: { id: businessUnitId },
              },
            },
            isActive: true,
          },
        }),
        // Low stock and out of stock
        this.prisma.inventory.findMany({
          where: {
            businessUnitId,
            quantity: { lte: 10, gt: 0 }, // FIXED: Hardcoded threshold
          },
        }),
        this.prisma.inventory.findMany({
          where: {
            businessUnitId,
            quantity: 0,
          },
        }),
        // Cash registers
        this.prisma.cashRegisterSession.findMany({
          where: { cashRegister: { businessUnitId }, status: 'OPEN' },
          include: {
            cashRegister: true,
          },
        }),
        this.prisma.cashRegister.findMany({
          where: { businessUnitId },
        }),
        // Orders
        this.prisma.order.count({
          where: { businessUnitId, status: 'PENDING' },
        }),
        this.prisma.order.count({
          where: { businessUnitId, status: 'COMPLETED' },
        }),
        this.prisma.order.count({
          where: { businessUnitId, status: 'CANCELLED' },
        }),
        // Recent sales
        this.prisma.sale.findMany({
          where: { businessUnitId },
          orderBy: { saleDate: 'desc' },
          take: 10,
          include: {
            customer: {
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
          },
        }),
        // Top products
        this.prisma.saleItem.groupBy({
          by: ['productId'],
          where: {
            sale: {
              businessUnitId,
              saleDate: { gte: startOfMonth },
              status: { not: 'CANCELLED' },
            },
          },
          _sum: {
            quantity: true,
            total: true,
          },
          orderBy: {
            _sum: {
              total: 'desc',
            },
          },
          take: 5,
        }),
      ]);

      // Calculate inventory metrics
      const totalInventoryValue = inventory.reduce((sum: number, inv: any) => {
        return sum + (inv.quantity * (inv.product.costPrice || inv.product.unitPrice || 0));
      }, 0);

      const totalCash = openRegisters.reduce((sum: number, session: any) => {
        return sum + (session.cashRegister?.cashBalance || 0); // FIXED: Use cashBalance
      }, 0);

      // Get product names for top products
      const topProductIds = topProducts.map((tp: any) => tp.productId);
      const topProductDetails = await this.prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: {
          id: true,
          name: true,
          sku: true,
        },
      });

      const topProductsWithDetails = topProducts.map((tp: any) => {
        const product = topProductDetails.find((p: any) => p.id === tp.productId);
        return {
          productId: tp.productId,
          productName: product?.name || 'Unknown',
          sku: product?.sku || '',
          quantity: tp._sum.quantity || 0,
          revenue: tp._sum.total || 0,
        };
      });

      // Get sales trend for the last 7 days
      const salesTrend = await this.getSalesTrend(businessUnitId, 7);

      return {
        sales: {
          today: { total: todaySales._sum.total || 0, count: todaySales._count },
          week: { total: weekSales._sum.total || 0, count: weekSales._count },
          month: { total: monthSales._sum.total || 0, count: monthSales._count },
          year: { total: yearSales._sum.total || 0, count: yearSales._count },
        },
        inventory: {
          totalItems: inventory.length,
          totalValue: totalInventoryValue,
          lowStock: lowStockItems.length,
          outOfStock: outOfStockItems.length,
          reorderNeeded: lowStockItems.length + outOfStockItems.length,
        },
        customers: {
          total: customers,
          active: activeCustomers,
          newThisMonth: newCustomersThisMonth,
        },
        suppliers: {
          total: suppliers,
          active: activeSuppliers,
        },
        registers: {
          open: openRegisters.length,
          total: allRegisters.length,
          totalCash,
        },
        orders: {
          pending: pendingOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
        },
        recentActivity: recentSales,
        topProducts: topProductsWithDetails,
        salesTrend,
      };
    } catch (error) {
      this.handleError(error, 'DashboardService.getStats');
    }
  }

  /**
   * Get real-time data for WebSocket clients
   */
  async getRealtimeData(businessUnitId: string): Promise<RealtimeData> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const [recentSales, lowStockInventory, notifications, openRegisters, pendingOrders] = await Promise.all([
        this.prisma.sale.findMany({
          where: { businessUnitId },
          orderBy: { saleDate: 'desc' },
          take: 20,
          include: {
            customer: {
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
          },
        }),
        this.prisma.inventory.findMany({
          where: {
            businessUnitId,
            quantity: { lte: 10 }, // FIXED: Hardcoded
          },
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
          orderBy: { quantity: 'asc' },
        }),
        this.prisma.notification.findMany({
          where: {
            businessUnitId,
            isRead: false,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.cashRegisterSession.findMany({
          where: {
            cashRegister: { businessUnitId },
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
        }),
        this.prisma.order.findMany({
          where: {
            businessUnitId,
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          // FIXED: Removed supplier include since Order model doesn't have supplier relation
          include: {
            items: true,
          },
        }),
      ]);

      // Generate alerts
      const alerts: any[] = [];

      if (lowStockInventory.length > 0) {
        alerts.push({
          type: 'LOW_STOCK',
          severity: 'WARNING',
          message: `${lowStockInventory.length} items are low on stock`,
          count: lowStockInventory.length,
        });
      }

      if (pendingOrders.length > 0) {
        alerts.push({
          type: 'PENDING_ORDERS',
          severity: 'INFO',
          message: `${pendingOrders.length} orders are pending`,
          count: pendingOrders.length,
        });
      }

      if (openRegisters.length > 0) {
        alerts.push({
          type: 'OPEN_REGISTERS',
          severity: 'INFO',
          message: `${openRegisters.length} cash registers are open`,
          count: openRegisters.length,
        });
      }

      return {
        recentSales,
        lowStockInventory,
        notifications,
        openRegisters,
        pendingOrders,
        alerts,
      };
    } catch (error) {
      this.handleError(error, 'DashboardService.getRealtimeData');
    }
  }

  /**
   * Get live dashboard data
   */
  async getLiveDashboard(businessUnitId: string) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      // Trigger reorder check
      try {
        await reorderService.checkAndCreateReorderOrders(businessUnitId);
      } catch (error) {
        console.warn('Failed to check reorder orders:', error);
      }

      // Get both stats and realtime data
      const [stats, realtimeData] = await Promise.all([
        this.getStats(businessUnitId),
        this.getRealtimeData(businessUnitId),
      ]);

      return {
        ...stats,
        ...realtimeData,
      };
    } catch (error) {
      this.handleError(error, 'DashboardService.getLiveDashboard');
    }
  }

  /**
   * Get sales trend for a period
   */
  private async getSalesTrend(businessUnitId: string, days: number): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const sales = await this.prisma.sale.findMany({
        where: {
          businessUnitId,
          saleDate: { gte: startDate },
          status: { not: 'CANCELLED' },
        },
        select: {
          saleDate: true,
          total: true,
        },
        orderBy: { saleDate: 'asc' },
      });

      // Group by date
      const dailySales = new Map<string, { total: number; count: number }>();
      
      for (const sale of sales) {
        const dateKey = sale.saleDate.toISOString().split('T')[0];
        const current = dailySales.get(dateKey) || { total: 0, count: 0 };
        current.total += sale.total;
        current.count += 1;
        dailySales.set(dateKey, current);
      }

      // Fill in all dates
      const trend: any[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= new Date()) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const data = dailySales.get(dateKey) || { total: 0, count: 0 };
        
        trend.push({
          date: dateKey,
          total: data.total,
          count: data.count,
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return trend;
    } catch (error) {
      console.error('Get sales trend error:', error);
      return [];
    }
  }

  /**
   * Get top performing products
   */
  async getTopProducts(businessUnitId: string, limit: number = 10, days: number = 30) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const topProducts = await this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: {
            businessUnitId,
            saleDate: { gte: startDate },
            status: { not: 'CANCELLED' },
          },
        },
        _sum: {
          quantity: true,
          total: true,
        },
        orderBy: {
          _sum: {
            total: 'desc',
          },
        },
        take: limit,
      });

      const productIds = topProducts.map((tp: any) => tp.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          unitPrice: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return topProducts.map((tp: any) => {
        const product = products.find((p: any) => p.id === tp.productId);
        return {
          productId: tp.productId,
          name: product?.name || 'Unknown',
          sku: product?.sku || '',
          category: product?.category?.name || 'Uncategorized',
          quantity: tp._sum.quantity || 0,
          revenue: tp._sum.total || 0,
        };
      });
    } catch (error) {
      this.handleError(error, 'DashboardService.getTopProducts');
    }
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(businessUnitId: string) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const lowStockItems = await this.prisma.inventory.findMany({
        where: {
          businessUnitId,
          quantity: { lte: 10 }, // FIXED: Hardcoded
        },
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
        orderBy: { quantity: 'asc' },
      });

      return lowStockItems.map((item: any) => ({
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        currentQuantity: item.quantity,
        reorderPoint: item.reorderPoint,
        deficit: item.reorderPoint - item.quantity,
        severity: item.quantity === 0 ? 'CRITICAL' : item.quantity < item.reorderPoint / 2 ? 'HIGH' : 'MEDIUM',
      }));
    } catch (error) {
      this.handleError(error, 'DashboardService.getLowStockAlerts');
    }
  }

  /**
   * Get sales summary for export
   */
  async getSalesSummary(businessUnitId: string, startDate: Date, endDate: Date) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const sales = await this.prisma.sale.groupBy({
        by: ['saleDate'],
        where: {
          businessUnitId,
          saleDate: { gte: startDate, lte: endDate },
          status: { not: 'CANCELLED' },
        },
        _sum: {
          total: true,
          tax: true,
          discount: true,
        },
        _count: true,
        orderBy: {
          saleDate: 'asc',
        },
      });

      return sales.map((day: any) => ({
        date: day.saleDate,
        totalSales: day._sum.total || 0,
        totalTax: day._sum.tax || 0,
        totalDiscount: day._sum.discount || 0,
        transactionCount: day._count,
      }));
    } catch (error) {
      this.handleError(error, 'DashboardService.getSalesSummary');
    }
  }
}

export const dashboardService = new DashboardService();
