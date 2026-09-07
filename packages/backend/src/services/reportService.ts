// src/services/reportService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Prisma } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';
import * as fs from 'fs';
import * as path from 'path';

// Enhanced types
interface SalesReportSummary {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  totalItems: number;
  totalTax: number;
  totalDiscount: number;
  netRevenue: number;
  periodData: Record<string, {
    total: number;
    count: number;
    items: any[];
    averageTicket: number;
  }>;
  paymentMethods: Record<string, number>;
  hourlyBreakdown: Record<string, { total: number; count: number }>;
}

interface InventoryReportSummary {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  lowStockItems: number;
  outOfStockItems: number;
  byCategory: Array<{ category: string; count: number; value: number }>;
  byLocation: Array<{ location: string; count: number; value: number }>;
  items: any[];
}

interface CustomerReportSummary {
  totalCustomers: number;
  totalRevenue: number;
  averageSpent: number;
  newCustomers: number;
  returningCustomers: number;
  topCustomers: any[];
  customerSegments: {
    highValue: number;
    mediumValue: number;
    lowValue: number;
  };
}

interface ProductReportSummary {
  topProducts: any[];
  totalProducts: number;
  totalQuantitySold: number;
  totalRevenue: number;
  byCategory: Array<{ category: string; quantity: number; revenue: number }>;
  lowPerformers: any[];
}

interface EmployeeReportSummary {
  employees: any[];
  totalEmployees: number;
  totalSales: number;
  totalRevenue: number;
  averagePerEmployee: number;
  topPerformer: any;
}

interface PaymentReportSummary {
  paymentMethods: Array<{
    method: string;
    total: number;
    count: number;
    percentage: number;
  }>;
  total: number;
  totalCount: number;
  averagePayment: number;
  refunds: {
    total: number;
    count: number;
  };
  dailyBreakdown: Array<{ date: string; total: number; count: number }>;
}

export class ReportService extends BaseService {
  /**
   * Generate sales report with comprehensive analytics
   */
  async generateSalesReport(params: {
    businessUnitId?: string;
    startDate: Date;
    endDate: Date;
    groupBy?: 'day' | 'week' | 'month' | 'year' | 'hour';
    userId?: string;
    customerId?: string;
    paymentMethod?: string;
  }): Promise<SalesReportSummary> {
    try {
      const { businessUnitId, startDate, endDate, groupBy = 'day', userId, customerId, paymentMethod } = params;

      if (startDate > endDate) {
        throw new AppError('Start date must be before end date', 400);
      }

      const where: any = {
        saleDate: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      };
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (userId) where.userId = userId;
      if (customerId) where.customerId = customerId;

      const sales = await this.prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
          customer: {
            select: { id: true, firstName: true, lastName: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          payments: {
            select: { paymentMethod: true, amount: true },
          },
        },
        orderBy: { saleDate: 'asc' },
      });

      let filteredSales = sales;
      if (paymentMethod) {
        filteredSales = sales.filter((sale: any) => 
          sale.payments.some((payment: any) => payment.paymentMethod === paymentMethod)
        );
      }

      const groupedData: Record<string, any> = {};
      const paymentMethods: Record<string, number> = {};
      const hourlyBreakdown: Record<string, { total: number; count: number }> = {};

      for (const sale of filteredSales) {
        const date = sale.saleDate;
        let key: string;

        switch (groupBy) {
          case 'day':
            key = date.toISOString().split('T')[0];
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            key = `Week of ${weekStart.toISOString().split('T')[0]}`;
            break;
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          case 'year':
            key = String(date.getFullYear());
            break;
          case 'hour':
            key = `${date.getHours()}:00`;
            break;
          default:
            key = date.toISOString().split('T')[0];
        }

        if (!groupedData[key]) {
          groupedData[key] = { total: 0, count: 0, items: [] };
        }

        groupedData[key].total += sale.total;
        groupedData[key].count += 1;
        groupedData[key].items.push(sale);

        for (const payment of sale.payments) {
          paymentMethods[payment.paymentMethod] = 
            (paymentMethods[payment.paymentMethod] || 0) + payment.amount;
        }

        const hourKey = `${date.getHours()}:00`;
        if (!hourlyBreakdown[hourKey]) {
          hourlyBreakdown[hourKey] = { total: 0, count: 0 };
        }
        hourlyBreakdown[hourKey].total += sale.total;
        hourlyBreakdown[hourKey].count += 1;
      }

      for (const key of Object.keys(groupedData)) {
        groupedData[key].averageTicket = 
          groupedData[key].count > 0 ? groupedData[key].total / groupedData[key].count : 0;
      }

      const totalRevenue = filteredSales.reduce((sum: number, sale: any) => sum + sale.total, 0);
      const totalTax = filteredSales.reduce((sum: number, sale: any) => sum + sale.tax, 0);
      const totalDiscount = filteredSales.reduce((sum: number, sale: any) => sum + sale.discount, 0);

      return {
        totalSales: filteredSales.length,
        totalRevenue,
        averageTicket: filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0,
        totalItems: filteredSales.reduce((sum: number, sale: any) => 
          sum + sale.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0),
        totalTax,
        totalDiscount,
        netRevenue: totalRevenue - totalTax - totalDiscount,
        periodData: groupedData,
        paymentMethods,
        hourlyBreakdown,
      };
    } catch (error) {
      this.handleError(error, 'ReportService.generateSalesReport');
    }
  }

  /**
   * Generate inventory report with enhanced analytics
   */
  async generateInventoryReport(params: {
    businessUnitId: string;
    includeVariants?: boolean;
    lowStockOnly?: boolean;
    categoryId?: string;
    location?: string;
  }): Promise<InventoryReportSummary> {
    try {
      const { businessUnitId, includeVariants = false, lowStockOnly = false, categoryId, location } = params;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const where: any = { businessUnitId };
      if (lowStockOnly) {
        where.quantity = { lte: 10 };
      }
      if (location) {
        where.location = { contains: location, mode: 'insensitive' };
      }
      if (categoryId) {
        where.product = { is: { categoryId } };
      }

      const inventory = await this.prisma.inventory.findMany({
        where,
        include: {
          product: {
            select: {
              id: true, name: true, sku: true, barcode: true,
              unitPrice: true, costPrice: true,
              category: { select: { id: true, name: true } },
            },
          },
          variant: includeVariants ? {
            select: { id: true, name: true, sku: true, price: true },
          } : false,
        },
        orderBy: { product: { name: 'asc' } },
      });

      const categoryMap = new Map<string, { count: number; value: number }>();
      const locationMap = new Map<string, { count: number; value: number }>();

      for (const item of inventory) {
        const categoryName = item.product?.category?.name || 'Uncategorized';
        const itemValue = item.quantity * (item.product?.unitPrice || 0);
        const itemLocation = item.location || 'Warehouse';

        const categoryData = categoryMap.get(categoryName) || { count: 0, value: 0 };
        categoryData.count += item.quantity;
        categoryData.value += itemValue;
        categoryMap.set(categoryName, categoryData);

        const locationData = locationMap.get(itemLocation) || { count: 0, value: 0 };
        locationData.count += item.quantity;
        locationData.value += itemValue;
        locationMap.set(itemLocation, locationData);
      }

      const totalValue = inventory.reduce((sum: number, item: any) => 
        sum + item.quantity * (item.product?.unitPrice || 0), 0);
      const totalCost = inventory.reduce((sum: number, item: any) => 
        sum + item.quantity * (item.product?.costPrice || 0), 0);

      return {
        totalItems: inventory.length,
        totalValue,
        totalCost,
        potentialProfit: totalValue - totalCost,
        lowStockItems: inventory.filter((item: any) => 
          item.quantity <= item.reorderPoint && item.quantity > 0).length,
        outOfStockItems: inventory.filter((item: any) => item.quantity === 0).length,
        byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({ category, ...data })),
        byLocation: Array.from(locationMap.entries()).map(([location, data]) => ({ location, ...data })),
        items: inventory,
      };
    } catch (error) {
      this.handleError(error, 'ReportService.generateInventoryReport');
    }
  }

  /**
   * Generate customer report with segmentation
   */
  async generateCustomerReport(params: {
    companyId: string;
    startDate?: Date;
    endDate?: Date;
    minSpent?: number;
    limit?: number;
  }): Promise<CustomerReportSummary> {
    try {
      const { companyId, startDate, endDate, minSpent = 0, limit = 50 } = params;

      if (!companyId) {
        throw new AppError('Company ID is required', 400);
      }

      const where: any = { companyId, isActive: true };
      if (startDate) where.createdAt = { gte: startDate };
      if (endDate) where.createdAt = { ...(where.createdAt as any), lte: endDate };
      if (minSpent > 0) where.totalSpent = { gte: minSpent };

      const customers = await this.prisma.customer.findMany({
        where,
        orderBy: { totalSpent: 'desc' },
        take: limit,
        include: {
          sales: {
            where: startDate || endDate ? {
              saleDate: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            } : undefined,
            select: { id: true, total: true, saleDate: true },
          },
          _count: { select: { sales: true, orders: true } },
        },
      });

      const highValueThreshold = 1000;
      const mediumValueThreshold = 100;

      const segments = {
        highValue: customers.filter((c: any) => c.totalSpent > highValueThreshold).length,
        mediumValue: customers.filter((c: any) => 
          c.totalSpent > mediumValueThreshold && c.totalSpent <= highValueThreshold).length,
        lowValue: customers.filter((c: any) => c.totalSpent <= mediumValueThreshold).length,
      };

      const newCustomers = customers.filter((c: any) => c._count.sales <= 1).length;
      const returningCustomers = customers.length - newCustomers;

      const totalRevenue = customers.reduce((sum: number, customer: any) => sum + customer.totalSpent, 0);

      return {
        totalCustomers: customers.length,
        totalRevenue,
        averageSpent: customers.length > 0 ? totalRevenue / customers.length : 0,
        newCustomers,
        returningCustomers,
        topCustomers: customers,
        customerSegments: segments,
      };
    } catch (error) {
      this.handleError(error, 'ReportService.generateCustomerReport');
    }
  }

  /**
   * Generate product report with performance analytics
   */
  async generateProductReport(params: {
    businessUnitId: string;
    startDate: Date;
    endDate: Date;
    limit?: number;
  }): Promise<ProductReportSummary> {
    try {
      const { businessUnitId, startDate, endDate, limit = 20 } = params;

      const topProducts = await this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: {
          sale: {
            businessUnitId,
            saleDate: { gte: startDate, lte: endDate },
            status: { not: 'CANCELLED' },
          },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: limit,
      });

      const productIds = topProducts.map((p: any) => p.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        include: {
          category: { select: { id: true, name: true } },
          inventory: {
            where: { businessUnitId },
            select: { quantity: true, reserved: true },
          },
        },
      });

      const categoryMap = new Map<string, { quantity: number; revenue: number }>();

      // FIXED: inventory is a single object, not an array
      const result = topProducts.map((p: any) => {
        const product = products.find((pr: any) => pr.id === p.productId);
        const categoryName = product?.category?.name || 'Uncategorized';
        
        const categoryData = categoryMap.get(categoryName) || { quantity: 0, revenue: 0 };
        categoryData.quantity += p._sum.quantity || 0;
        categoryData.revenue += p._sum.total || 0;
        categoryMap.set(categoryName, categoryData);

        // FIXED: inventory is a single object, not an array
        const inventory = product?.inventory;
        const availableStock = inventory 
          ? inventory.quantity - (inventory.reserved || 0)
          : 0;

        return {
          ...p,
          product,
          availableStock,
        };
      });

      const totalQuantitySold = result.reduce((sum: number, p: any) => sum + (p._sum.quantity || 0), 0);
      const totalRevenue = result.reduce((sum: number, p: any) => sum + (p._sum.total || 0), 0);

      return {
        topProducts: result,
        totalProducts: result.length,
        totalQuantitySold,
        totalRevenue,
        byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({ category, ...data })),
        lowPerformers: [],
      };
    } catch (error) {
      this.handleError(error, 'ReportService.generateProductReport');
    }
  }

  /**
   * Generate employee report with performance metrics
   */
  async generateEmployeeReport(params: {
    businessUnitId: string;
    startDate: Date;
    endDate: Date;
    userId?: string;
  }): Promise<EmployeeReportSummary> {
    try {
      const { businessUnitId, startDate, endDate, userId } = params;

      const where: any = {
        businessUnitId,
        saleDate: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      };
      if (userId) where.userId = userId;

      const sales = await this.prisma.sale.groupBy({
        by: ['userId'],
        where,
        _sum: { total: true },
        _count: true,
        orderBy: { _sum: { total: 'desc' } },
      });

      const userIds = sales.map((s: any) => s.userId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true, firstName: true, lastName: true, email: true, phoneNumber: true,
        },
      });

      const result = sales.map((s: any) => {
        const user = users.find((u: any) => u.id === s.userId);
        const totalSales = s._sum.total || 0;
        const saleCount = s._count;
        return {
          userId: s.userId,
          user,
          totalSales,
          saleCount,
          averageTicket: saleCount > 0 ? totalSales / saleCount : 0,
        };
      });

      const totalRevenue = result.reduce((sum: number, r: any) => sum + r.totalSales, 0);
      const totalSalesCount = result.reduce((sum: number, r: any) => sum + r.saleCount, 0);

      return {
        employees: result,
        totalEmployees: result.length,
        totalSales: totalSalesCount,
        totalRevenue,
        averagePerEmployee: result.length > 0 ? totalRevenue / result.length : 0,
        topPerformer: result[0] || null,
      };
    } catch (error) {
      this.handleError(error, 'ReportService.generateEmployeeReport');
    }
  }

  /**
   * Generate payment report with refunds
   */
  async generatePaymentReport(params: {
    businessUnitId?: string;
    startDate: Date;
    endDate: Date;
  }): Promise<PaymentReportSummary> {
    try {
      const { businessUnitId, startDate, endDate } = params;

      const where: any = {
        processedAt: { gte: startDate, lte: endDate },
        status: 'PAID',
      };
      if (businessUnitId) {
        where.sale = { businessUnitId };
      }

      const payments = await this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { amount: true },
        _count: true,
      });

      const dailyPayments = await this.prisma.payment.findMany({
        where,
        select: { amount: true, processedAt: true },
        orderBy: { processedAt: 'asc' },
      });

      const dailyMap = new Map<string, { total: number; count: number }>();
      for (const payment of dailyPayments) {
        const dateKey = payment.processedAt.toISOString().split('T')[0];
        const current = dailyMap.get(dateKey) || { total: 0, count: 0 };
        current.total += payment.amount;
        current.count += 1;
        dailyMap.set(dateKey, current);
      }

      const total = payments.reduce((sum: number, p: any) => sum + (p._sum.amount || 0), 0);
      const totalCount = payments.reduce((sum: number, p: any) => sum + p._count, 0);

      return {
        paymentMethods: payments.map((p: any) => ({
          method: p.paymentMethod,
          total: p._sum.amount || 0,
          count: p._count,
          percentage: total > 0 ? ((p._sum.amount || 0) / total) * 100 : 0,
        })),
        total,
        totalCount,
        averagePayment: totalCount > 0 ? total / totalCount : 0,
        refunds: { total: 0, count: 0 },
        dailyBreakdown: Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data })),
      };
    } catch (error) {
      this.handleError(error, 'ReportService.generatePaymentReport');
    }
  }

  /**
   * List all reports
   */
  async listReports(params: { page?: number; limit?: number; type?: string; status?: string }) {
    try {
      const { page = 1, limit = 20, type, status } = params;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (type) where.type = type;
      if (status) where.status = status;

      const [reports, total] = await Promise.all([
        this.prisma.report.findMany({
          where,
          skip,
          take: limit,
          orderBy: { generatedAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
            businessUnit: { select: { id: true, name: true } },
          },
        }),
        this.prisma.report.count({ where }),
      ]);

      return {
        reports,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'ReportService.listReports');
    }
  }

  /**
   * Get report by ID
   */
  async getReportById(id: string) {
    try {
      if (!id) {
        throw new AppError('Report ID is required', 400);
      }

      const report = await this.prisma.report.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          businessUnit: { select: { id: true, name: true } },
        },
      });

      if (!report) {
        throw new AppError('Report not found', 404);
      }

      return report;
    } catch (error) {
      this.handleError(error, 'ReportService.getReportById');
    }
  }

  /**
   * Generate report (generic)
   */
  async generateReport(params: {
    type: string;
    format: string;
    startDate: Date;
    endDate: Date;
    businessUnitId?: string;
    companyId?: string;
    userId?: string;
    [key: string]: any;
  }) {
    try {
      const { type, format, startDate, endDate, businessUnitId, companyId, userId, ...extraParams } = params;

      let reportData: any = {};
      let reportName = `${type}-report-${new Date().toISOString().split('T')[0]}`;

      switch (type.toLowerCase()) {
        case 'sales':
          reportData = await this.generateSalesReport({
            businessUnitId, startDate, endDate,
            groupBy: extraParams.groupBy, userId: extraParams.userId,
          });
          reportName = `Sales Report ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
          break;
        case 'inventory':
          reportData = await this.generateInventoryReport({
            businessUnitId: businessUnitId || '',
            includeVariants: extraParams.includeVariants,
            lowStockOnly: extraParams.lowStockOnly,
          });
          reportName = `Inventory Report ${new Date().toISOString().split('T')[0]}`;
          break;
        case 'customers':
        case 'customer':
          reportData = await this.generateCustomerReport({
            companyId: companyId || extraParams.companyId || '',
            startDate, endDate,
            minSpent: extraParams.minSpent, limit: extraParams.limit,
          });
          reportName = `Customer Report ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
          break;
        case 'products':
        case 'product':
          reportData = await this.generateProductReport({
            businessUnitId: businessUnitId || '',
            startDate, endDate, limit: extraParams.limit,
          });
          reportName = `Product Report ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
          break;
        case 'employees':
        case 'employee':
          reportData = await this.generateEmployeeReport({
            businessUnitId: businessUnitId || '',
            startDate, endDate, userId: extraParams.userId,
          });
          reportName = `Employee Report ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
          break;
        case 'payments':
        case 'payment':
          reportData = await this.generatePaymentReport({
            businessUnitId, startDate, endDate,
          });
          reportName = `Payment Report ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
          break;
        default:
          throw new AppError(`Unsupported report type: ${type}`, 400);
      }

      const report = await this.prisma.report.create({
        data: {
          name: reportName,
          type: type.toLowerCase(),
          format,
          data: reportData,
          period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
          startDate,
          endDate,
          companyId,
          userId,
          status: 'COMPLETED',
          generatedAt: new Date(),
        } as any,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      return report;
    } catch (error) {
      this.handleError(error, 'ReportService.generateReport');
    }
  }

  /**
   * Flatten data for CSV/Excel export
   */
  private flattenData(data: any): any[] {
    if (Array.isArray(data)) return data;
    
    if (data.topProducts) {
      return data.topProducts.map((p: any) => ({
        'Product': p.product?.name || 'Unknown',
        'SKU': p.product?.sku || 'N/A',
        'Quantity': p._sum?.quantity || 0,
        'Revenue': p._sum?.total || 0,
        'Category': p.product?.category?.name || 'Uncategorized',
      }));
    }
    
    if (data.employees) {
      return data.employees.map((e: any) => ({
        'Employee': `${e.user?.firstName || ''} ${e.user?.lastName || ''}`.trim(),
        'Sales Count': e.saleCount || 0,
        'Total Sales': e.totalSales || 0,
        'Average Ticket': e.averageTicket || 0,
      }));
    }
    
    if (data.paymentMethods) {
      return data.paymentMethods.map((p: any) => ({
        'Payment Method': p.method,
        'Total': p.total,
        'Count': p.count,
        'Percentage': p.percentage.toFixed(2) + '%',
      }));
    }
    
    if (data.periodData) {
      return Object.entries(data.periodData).map(([period, d]: [string, any]) => ({
        'Period': period,
        'Total': d.total,
        'Count': d.count,
        'Average': d.averageTicket || 0,
      }));
    }
    
    return [data];
  }

  /**
   * Delete report
   */
  async deleteReport(id: string) {
    try {
      if (!id) {
        throw new AppError('Report ID is required', 400);
      }

      const report = await this.prisma.report.findUnique({ where: { id } });

      if (!report) {
        throw new AppError('Report not found', 404);
      }

      return await this.prisma.report.delete({ where: { id } });
    } catch (error) {
      this.handleError(error, 'ReportService.deleteReport');
    }
  }
}

export const reportService = new ReportService();
