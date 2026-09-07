// src/services/analyticsService.ts
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

interface SalesTrend {
  date: string;
  total: number;
  orderCount: number;
  averageOrderValue: number;
}

interface TopProduct {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  revenue: number;
  profit: number;
  margin: number;
}

interface CustomerInsight {
  totalCustomers: number;
  totalRevenue: number;
  avgSpend: number;
  segments: {
    highValue: number;
    mediumValue: number;
    lowValue: number;
  };
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    loyaltyPoints: number;
    lastPurchase: Date | null;
    purchaseCount: number;
  }>;
}

interface InventoryAnalytics {
  totalValue: number;
  totalItems: number;
  lowStock: number;
  outOfStock: number;
  turnoverRate: number;
  stockValueByCategory: Array<{
    category: string;
    value: number;
    itemCount: number;
  }>;
}

interface AnalyticsCache {
  id: string;
  type: string;
  businessUnitId: string;
  params: any;
  result: any;
  createdAt: Date;
  expiresAt: Date;
}

export class AnalyticsService {
  /**
   * Get sales trends for a business unit
   */
  async getSalesTrends(businessUnitId: string, days: number = 30): Promise<SalesTrend[]> {
    try {
      // Validate inputs
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (days <= 0 || days > 365) {
        throw new AppError('Days must be between 1 and 365', 400);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const sales = await prisma.sale.findMany({
        where: { 
          businessUnitId, 
          saleDate: { gte: startDate },
          status: { not: 'CANCELLED' },
        },
        orderBy: { saleDate: 'asc' },
        select: {
          id: true,
          saleDate: true,
          total: true,
          status: true,
        },
      });

      // Group by date with more details
      const dailySales: Record<string, { total: number; orderCount: number; sales: any[] }> = {};
      
      sales.forEach(sale => {
        const date = sale.saleDate.toISOString().split('T')[0];
        if (!dailySales[date]) {
          dailySales[date] = { total: 0, orderCount: 0, sales: [] };
        }
        dailySales[date].total += sale.total;
        dailySales[date].orderCount += 1;
        dailySales[date].sales.push(sale);
      });

      // Ensure all dates are represented (fill gaps with zeros)
      const result: SalesTrend[] = [];
      const currentDate = new Date(startDate);
      const endDate = new Date();
      
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayData = dailySales[dateKey];
        
        result.push({
          date: dateKey,
          total: dayData?.total || 0,
          orderCount: dayData?.orderCount || 0,
          averageOrderValue: dayData && dayData.orderCount > 0 
            ? dayData.total / dayData.orderCount 
            : 0,
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Try to persist analytics cache
      await this.cacheAnalyticsResult('sales_trends', businessUnitId, { days }, result);

      return result;
    } catch (error) {
      console.error('Get sales trends error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve sales trends', 500);
    }
  }

  /**
   * Get top products for a business unit
   */
  async getTopProducts(businessUnitId: string, limit: number = 10, days: number = 30): Promise<TopProduct[]> {
    try {
      // Validate inputs
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (limit <= 0 || limit > 100) {
        throw new AppError('Limit must be between 1 and 100', 400);
      }
      if (days <= 0 || days > 365) {
        throw new AppError('Days must be between 1 and 365', 400);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const saleItems = await prisma.saleItem.findMany({
        where: {
          sale: { 
            businessUnitId, 
            saleDate: { gte: startDate },
            status: { not: 'CANCELLED' },
          },
        },
        include: { 
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitPrice: true,
              costPrice: true,
            },
          },
        },
      });

      const productMap = new Map<string, TopProduct>();
      
      saleItems.forEach(item => {
        // Safe navigation with null checks
        if (!item.product) return;
        
        const productId = item.product.id;
        const current = productMap.get(productId) || {
          id: productId,
          name: item.product.name || 'Unknown Product',
          sku: item.product.sku || '',
          quantity: 0,
          revenue: 0,
          profit: 0,
          margin: 0,
        };
        
        current.quantity += item.quantity;
        current.revenue += item.total;
        
        // Calculate profit with null safety
        const costPrice = item.product.costPrice ?? item.product.unitPrice ?? 0;
        current.profit += (item.total - (costPrice * item.quantity));
        
        productMap.set(productId, current);
      });

      // Calculate margins and sort
      const products = Array.from(productMap.values())
        .map(product => ({
          ...product,
          margin: product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);

      // Try to persist analytics cache
      await this.cacheAnalyticsResult('top_products', businessUnitId, { limit, days }, products);

      return products;
    } catch (error) {
      console.error('Get top products error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve top products', 500);
    }
  }

  /**
   * Get customer insights for a business unit
   */
  async getCustomerInsights(businessUnitId: string): Promise<CustomerInsight> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const customers = await prisma.customer.findMany({
        include: { 
          sales: { 
            where: { 
              businessUnitId,
              status: { not: 'CANCELLED' },
            },
            select: {
              id: true,
              total: true,
              saleDate: true,
            },
          },
        },
      });

      const totalCustomers = customers.length;
      const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
      const avgSpend = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
      
      // Segment customers by value
      const highValueThreshold = 1000;
      const mediumValueThreshold = 100;
      
      const highValue = customers.filter(c => (c.totalSpent || 0) > highValueThreshold).length;
      const mediumValue = customers.filter(c => 
        (c.totalSpent || 0) > mediumValueThreshold && 
        (c.totalSpent || 0) <= highValueThreshold
      ).length;
      const lowValue = customers.filter(c => (c.totalSpent || 0) <= mediumValueThreshold).length;

      // Get top customers with purchase counts
      const topCustomers = customers
        .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
        .slice(0, 10)
        .map(c => ({
          id: c.id,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
          email: c.email || '',
          totalSpent: c.totalSpent || 0,
          loyaltyPoints: c.loyaltyPoints || 0,
          lastPurchase: c.lastPurchaseAt || null,
          purchaseCount: c.sales?.length || 0,
        }));

      const insights: CustomerInsight = {
        totalCustomers,
        totalRevenue,
        avgSpend,
        segments: { highValue, mediumValue, lowValue },
        topCustomers,
      };

      // Try to persist analytics cache
      await this.cacheAnalyticsResult('customer_insights', businessUnitId, {}, insights);

      return insights;
    } catch (error) {
      console.error('Get customer insights error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve customer insights', 500);
    }
  }

  /**
   * Get inventory analytics for a business unit
   */
  async getInventoryAnalytics(businessUnitId: string): Promise<InventoryAnalytics> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const inventory = await prisma.inventory.findMany({
        where: { businessUnitId },
        include: { 
          product: {
            include: {
              category: true,
            },
          },
        },
      });

      // Filter out inventory items with null product
      const validInventory = inventory.filter(inv => inv.product !== null);

      // Calculate total value with null safety
      const totalValue = validInventory.reduce((sum, inv) => {
        const product = inv.product;
        if (!product) return sum;
        const price = product.costPrice ?? product.unitPrice ?? 0;
        return sum + (inv.quantity * price);
      }, 0);
      
      const totalItems = validInventory.reduce((sum, inv) => sum + inv.quantity, 0);
      
      const lowStock = validInventory.filter(inv => {
        const reorderPoint = (inv as any).reorderPoint || 5;
        return inv.quantity <= reorderPoint;
      }).length;
      
      const outOfStock = validInventory.filter(inv => inv.quantity === 0).length;

      // Calculate stock value by category with null safety
      const categoryMap = new Map<string, { value: number; itemCount: number }>();
      
      validInventory.forEach(inv => {
        const product = inv.product;
        if (!product) return;
        
        const categoryName = product.category?.name || 'Uncategorized';
        const price = product.costPrice ?? product.unitPrice ?? 0;
        const itemValue = inv.quantity * price;
        
        const current = categoryMap.get(categoryName) || { value: 0, itemCount: 0 };
        current.value += itemValue;
        current.itemCount += inv.quantity;
        categoryMap.set(categoryName, current);
      });

      const stockValueByCategory = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          value: data.value,
          itemCount: data.itemCount,
        }))
        .sort((a, b) => b.value - a.value);

      const analytics: InventoryAnalytics = {
        totalValue,
        totalItems,
        lowStock,
        outOfStock,
        turnoverRate: validInventory.length > 0 ? (totalItems / validInventory.length) : 0,
        stockValueByCategory,
      };

      // Try to persist analytics cache
      await this.cacheAnalyticsResult('inventory_analytics', businessUnitId, {}, analytics);

      return analytics;
    } catch (error) {
      console.error('Get inventory analytics error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve inventory analytics', 500);
    }
  }

  /**
   * Get sales by category
   */
  async getSalesByCategory(businessUnitId: string, days: number = 30): Promise<any[]> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (days <= 0 || days > 365) {
        throw new AppError('Days must be between 1 and 365', 400);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const saleItems = await prisma.saleItem.findMany({
        where: {
          sale: { 
            businessUnitId, 
            saleDate: { gte: startDate },
            status: { not: 'CANCELLED' },
          },
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });

      const categoryMap = new Map<string, { revenue: number; quantity: number; orders: number }>();
      
      saleItems.forEach(item => {
        // Safe navigation with null check
        if (!item.product) return;
        
        const categoryName = item.product.category?.name || 'Uncategorized';
        const current = categoryMap.get(categoryName) || { revenue: 0, quantity: 0, orders: 0 };
        
        current.revenue += item.total || 0;
        current.quantity += item.quantity || 0;
        current.orders += 1;
        
        categoryMap.set(categoryName, current);
      });

      return Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          ...data,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    } catch (error) {
      console.error('Get sales by category error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve sales by category', 500);
    }
  }

  /**
   * Get sales by payment method
   */
  async getSalesByPaymentMethod(businessUnitId: string, days: number = 30): Promise<any[]> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (days <= 0 || days > 365) {
        throw new AppError('Days must be between 1 and 365', 400);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const sales = await prisma.sale.findMany({
        where: { 
          businessUnitId, 
          saleDate: { gte: startDate },
          status: { not: 'CANCELLED' },
        },
        select: {
          paymentMethod: true,
          total: true,
        },
      });

      const paymentMap = new Map<string, { revenue: number; count: number }>();
      
      sales.forEach(sale => {
        const method = sale.paymentMethod || 'Unknown';
        const current = paymentMap.get(method) || { revenue: 0, count: 0 };
        current.revenue += sale.total || 0;
        current.count += 1;
        paymentMap.set(method, current);
      });

      return Array.from(paymentMap.entries())
        .map(([method, data]) => ({
          method,
          ...data,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    } catch (error) {
      console.error('Get sales by payment method error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve sales by payment method', 500);
    }
  }

  /**
   * Get revenue by period (daily, weekly, monthly)
   */
  async getRevenueByPeriod(
    businessUnitId: string, 
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    days: number = 30
  ): Promise<any[]> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (days <= 0 || days > 365) {
        throw new AppError('Days must be between 1 and 365', 400);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const sales = await prisma.sale.findMany({
        where: { 
          businessUnitId, 
          saleDate: { gte: startDate },
          status: { not: 'CANCELLED' },
        },
        select: {
          saleDate: true,
          total: true,
        },
      });

      // Group by period
      const periodMap = new Map<string, { revenue: number; count: number }>();
      
      sales.forEach(sale => {
        let key: string;
        const date = new Date(sale.saleDate);
        
        switch (period) {
          case 'daily':
            key = date.toISOString().split('T')[0];
            break;
          case 'weekly':
            const weekNumber = this.getWeekNumber(date);
            key = `${date.getFullYear()}-W${weekNumber}`;
            break;
          case 'monthly':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            key = date.toISOString().split('T')[0];
        }
        
        const current = periodMap.get(key) || { revenue: 0, count: 0 };
        current.revenue += sale.total || 0;
        current.count += 1;
        periodMap.set(key, current);
      });

      return Array.from(periodMap.entries())
        .map(([periodKey, data]) => ({
          period: periodKey,
          revenue: data.revenue,
          orderCount: data.count,
          averageOrderValue: data.count > 0 ? data.revenue / data.count : 0,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
    } catch (error) {
      console.error('Get revenue by period error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve revenue by period', 500);
    }
  }

  /**
   * Get week number from date
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Cache analytics results in database for performance
   */
  private async cacheAnalyticsResult(
    type: string, 
    businessUnitId: string, 
    params: any, 
    result: any
  ): Promise<void> {
    try {
      // Check if cache table exists and use it
      // Using a safer approach with try-catch for each operation
      try {
        // Try to delete existing cache for this type and business unit
        await prisma.$executeRawUnsafe(
          `DELETE FROM "AnalyticsCache" WHERE "type" = $1 AND "businessUnitId" = $2`,
          type,
          businessUnitId
        );
      } catch (deleteError) {
        // Table might not exist, ignore
        console.debug('Cache table may not exist:', deleteError);
        return;
      }

      // Try to insert new cache entry
      const id = this.generateId();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3600000); // 1 hour from now
      
      await prisma.$executeRawUnsafe(
        `INSERT INTO "AnalyticsCache" ("id", "type", "businessUnitId", "params", "result", "createdAt", "expiresAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        id,
        type,
        businessUnitId,
        JSON.stringify(params),
        JSON.stringify(result),
        now,
        expiresAt
      );
    } catch (error) {
      // Don't fail if cache operation fails
      console.debug('Analytics caching not available:', error);
    }
  }

  /**
   * Get cached analytics result if available and not expired
   */
  async getCachedAnalyticsResult(
    type: string,
    businessUnitId: string,
    params: any
  ): Promise<any | null> {
    try {
      const result = await prisma.$queryRawUnsafe(
        `SELECT "result" FROM "AnalyticsCache" 
         WHERE "type" = $1 AND "businessUnitId" = $2 
         AND "params" = $3 AND "expiresAt" > NOW()
         LIMIT 1`,
        type,
        businessUnitId,
        JSON.stringify(params)
      );

      if (result && (result as any[]).length > 0) {
        return (result as any[])[0].result;
      }
      return null;
    } catch (error) {
      console.debug('Failed to get cached analytics:', error);
      return null;
    }
  }

  /**
   * Clear analytics cache for a business unit
   */
  async clearCache(businessUnitId: string): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "AnalyticsCache" WHERE "businessUnitId" = $1`,
        businessUnitId
      );
    } catch (error) {
      console.debug('Failed to clear analytics cache:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `analytics_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const analyticsService = new AnalyticsService();
