// src/controllers/reportController.ts
import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/reportService.js';
import { bookkeepingService } from '../services/bookkeepingService.js';
import { taxService } from '../services/taxService.js';
import { documentService } from '../services/documentService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

export const reportController = {
  // ============================================
  // LIST & GET OPERATIONS
  // ============================================

  /**
   * List all reports
   * GET /reports
   */
  async listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, type, status } = req.query;
      
      const reports = await reportService.listReports({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        type: type as string,
        status: status as string,
      });

      res.json({ 
        success: true, 
        data: reports.reports,
        pagination: {
          total: reports.total,
          page: reports.page,
          totalPages: reports.totalPages,
          limit: reports.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get report by ID
   * GET /reports/:id
   */
  async getReportById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const report = await reportService.getReportById(id);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // REPORT GENERATION (POST)
  // ============================================

  /**
   * Generate report (POST)
   * POST /reports/generate
   */
  async generateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        type, 
        format, 
        startDate, 
        endDate, 
        businessUnitId,
        companyId,
        userId,
        ...extraParams 
      } = req.body;
      
      if (!type || !format || !startDate || !endDate) {
        throw new AppError('Type, format, start date, and end date are required', 400);
      }

      const report = await reportService.generateReport({
        type,
        format,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        businessUnitId: businessUnitId || (req as any).user?.businessUnitId,
        companyId: companyId || (req as any).user?.companyId,
        userId: userId || (req as any).user?.id,
        ...extraParams,
      });

      res.status(201).json({ 
        success: true, 
        data: report,
        message: 'Report generated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // COMPREHENSIVE REPORT
  // ============================================

  /**
   * Generate comprehensive business report
   * GET /reports/comprehensive
   */
  async generateComprehensiveReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { startDate, endDate, format = 'pdf' } = req.query;

      if (!businessUnitId) throw new AppError('Business unit required', 400);

      const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(1));
      const end = endDate ? new Date(endDate as string) : new Date();

      const [financials, taxes, balanceSheet] = await Promise.all([
        bookkeepingService.generateFinancialReport(businessUnitId, start, end),
        taxService.generateTaxSummary(businessUnitId, `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`),
        bookkeepingService.generateBalanceSheet(businessUnitId),
      ]);

      const reportData = {
        financials,
        taxes,
        balanceSheet,
        generatedAt: new Date(),
      };

      const filePath = await documentService.generateFinancialReport(
        businessUnitId, start, end, format as 'pdf' | 'html' | 'excel' | 'csv'
      );

      res.json({
        success: true,
        data: reportData,
        filePath,
        message: 'Report generated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // TAX FILING
  // ============================================

  /**
   * Generate tax filing document
   * GET /reports/tax-filing
   */
  async generateTaxFiling(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { period } = req.query;

      if (!businessUnitId || !period) {
        throw new AppError('Business unit and period required', 400);
      }

      const taxSummary = await taxService.generateTaxSummary(businessUnitId, period as string);

      res.json({
        success: true,
        data: taxSummary,
        message: 'Tax filing document generated',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // SALES REPORT
  // ============================================

  /**
   * Generate sales report
   * GET /reports/sales
   */
  async generateSalesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId, startDate, endDate, groupBy, userId, customerId, paymentMethod } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const report = await reportService.generateSalesReport({
        businessUnitId: businessUnitId as string,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
        groupBy: groupBy as 'day' | 'week' | 'month' | 'year' | 'hour' | undefined,
        userId: userId as string,
        customerId: customerId as string,
        paymentMethod: paymentMethod as string,
      });

      res.json({ 
        success: true, 
        data: report,
        meta: {
          period: { startDate, endDate },
          groupBy: groupBy || 'day',
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // INVENTORY REPORT
  // ============================================

  /**
   * Generate inventory report
   * GET /reports/inventory
   */
  async generateInventoryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId, includeVariants, lowStockOnly, categoryId, location } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const report = await reportService.generateInventoryReport({
        businessUnitId: businessUnitId as string,
        includeVariants: includeVariants === 'true',
        lowStockOnly: lowStockOnly === 'true',
        categoryId: categoryId as string,
        location: location as string,
      });

      res.json({ 
        success: true, 
        data: report,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CUSTOMER REPORT
  // ============================================

  /**
   * Generate customer report
   * GET /reports/customers
   */
  async generateCustomerReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, startDate, endDate, minSpent, limit } = req.query;

      if (!companyId) {
        throw new AppError('Company ID is required', 400);
      }

      const report = await reportService.generateCustomerReport({
        companyId: companyId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        minSpent: minSpent ? parseFloat(minSpent as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({ 
        success: true, 
        data: report,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // PRODUCT REPORT
  // ============================================

  /**
   * Generate product report
   * GET /reports/products
   */
  async generateProductReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId, startDate, endDate, limit } = req.query;

      if (!businessUnitId || !startDate || !endDate) {
        throw new AppError('Business unit ID, start date, and end date are required', 400);
      }

      const report = await reportService.generateProductReport({
        businessUnitId: businessUnitId as string,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({ 
        success: true, 
        data: report,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // EMPLOYEE REPORT
  // ============================================

  /**
   * Generate employee report
   * GET /reports/employees
   */
  async generateEmployeeReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId, startDate, endDate, userId } = req.query;

      if (!businessUnitId || !startDate || !endDate) {
        throw new AppError('Business unit ID, start date, and end date are required', 400);
      }

      const report = await reportService.generateEmployeeReport({
        businessUnitId: businessUnitId as string,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
        userId: userId as string,
      });

      res.json({ 
        success: true, 
        data: report,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // PAYMENT REPORT
  // ============================================

  /**
   * Generate payment report
   * GET /reports/payments
   */
  async generatePaymentReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId, startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const report = await reportService.generatePaymentReport({
        businessUnitId: businessUnitId as string,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      });

      res.json({ 
        success: true, 
        data: report,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // DOWNLOAD & DELETE OPERATIONS
  // ============================================

  /**
   * Download report
   * GET /reports/download/:id
   */
  async downloadReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const report = await reportService.getReportById(id);
      
      if (!report) {
        throw new AppError('Report not found', 404);
      }

      // FIXED: Cast to any to access filePath if it exists
      const reportAny = report as any;
      
      if (reportAny.filePath && typeof reportAny.filePath === 'string') {
        res.download(reportAny.filePath, `${reportAny.name || 'report'}.${reportAny.format || 'json'}`);
      } else {
        // Fallback: Generate JSON content from report data
        const reportData = report.data || {};
        const fileName = `${report.name || 'report'}_${Date.now()}.json`;
        const fileContent = JSON.stringify(reportData, null, 2);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(fileContent);
      }
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete report
   * DELETE /reports/:id
   */
  async deleteReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await reportService.deleteReport(id);
      res.json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // EXPORT OPERATIONS
  // ============================================

  /**
   * Export sales report to CSV
   * GET /reports/export/sales
   */
  async exportSalesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId, startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const report = await reportService.generateSalesReport({
        businessUnitId: businessUnitId as string,
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
      });

      res.json({
        success: true,
        data: report,
        message: 'Sales report exported',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export inventory report to CSV
   * GET /reports/export/inventory
   */
  async exportInventoryReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const report = await reportService.generateInventoryReport({
        businessUnitId: businessUnitId as string,
      });

      res.json({
        success: true,
        data: report,
        message: 'Inventory report exported',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export customer report to CSV
   * GET /reports/export/customers
   */
  async exportCustomerReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.query;

      if (!companyId) {
        throw new AppError('Company ID is required', 400);
      }

      const report = await reportService.generateCustomerReport({
        companyId: companyId as string,
      });

      res.json({
        success: true,
        data: report,
        message: 'Customer report exported',
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // SUMMARY & ANALYTICS OPERATIONS
  // ============================================

  /**
   * Get report summary
   * GET /reports/summary
   */
  async getReportSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      const [monthSales, weekSales, inventorySummary, customerSummary] = await Promise.all([
        reportService.generateSalesReport({
          businessUnitId,
          startDate: startOfMonth,
          endDate: today,
        }),
        reportService.generateSalesReport({
          businessUnitId,
          startDate: startOfWeek,
          endDate: today,
        }),
        reportService.generateInventoryReport({
          businessUnitId,
        }),
        prisma.customer.count({ where: { isActive: true } }),
      ]);

      res.json({
        success: true,
        data: {
          monthSales: {
            totalSales: monthSales.totalSales,
            totalRevenue: monthSales.totalRevenue,
            averageTicket: monthSales.averageTicket,
          },
          weekSales: {
            totalSales: weekSales.totalSales,
            totalRevenue: weekSales.totalRevenue,
            averageTicket: weekSales.averageTicket,
          },
          inventory: {
            totalItems: inventorySummary.totalItems,
            totalValue: inventorySummary.totalValue,
            lowStock: inventorySummary.lowStockItems,
            outOfStock: inventorySummary.outOfStockItems,
          },
          customers: {
            total: customerSummary,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get dashboard analytics summary
   * GET /reports/dashboard-summary
   */
  async getDashboardSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const [todaySales, inventoryCount, lowStockCount, pendingOrders, totalCustomers, totalSuppliers] = await Promise.all([
        prisma.sale.aggregate({
          where: { businessUnitId, saleDate: { gte: startOfDay } },
          _sum: { total: true },
          _count: true,
        }),
        prisma.inventory.count({ where: { businessUnitId } }),
        prisma.inventory.count({
          where: { businessUnitId, quantity: { lte: prisma.inventory.fields.reorderPoint } },
        }),
        prisma.order.count({ where: { businessUnitId, status: 'PENDING' } }),
        prisma.customer.count({ where: { isActive: true } }),
        prisma.supplier.count(),
      ]);

      res.json({
        success: true,
        data: {
          todayRevenue: todaySales._sum.total || 0,
          todaySales: todaySales._count,
          totalInventory: inventoryCount,
          lowStockItems: lowStockCount,
          pendingOrders,
          totalCustomers,
          totalSuppliers,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // FINANCIAL REPORT OPERATIONS
  // ============================================

  /**
   * Generate financial report
   * GET /reports/financial
   */
  async generateFinancialReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { startDate, endDate } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(1));
      const end = endDate ? new Date(endDate as string) : new Date();

      const financialReport = await bookkeepingService.generateFinancialReport(
        businessUnitId,
        start,
        end
      );

      res.json({
        success: true,
        data: financialReport,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate balance sheet
   * GET /reports/balance-sheet
   */
  async generateBalanceSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = (req as any).user || {};

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const balanceSheet = await bookkeepingService.generateBalanceSheet(businessUnitId);

      res.json({
        success: true,
        data: balanceSheet,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate trial balance
   * GET /reports/trial-balance
   */
  async generateTrialBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = (req as any).user || {};

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const accounts = await prisma.account.findMany({
        where: { businessUnitId },
        include: { lines: true },
      });

      const trialBalance = accounts.map((account: any) => ({
        code: account.code,
        name: account.name,
        type: account.type,
        debit: account.lines.reduce((sum: number, line: any) => sum + line.debit, 0),
        credit: account.lines.reduce((sum: number, line: any) => sum + line.credit, 0),
      }));

      const totalDebits = trialBalance.reduce((sum: number, account: any) => sum + account.debit, 0);
      const totalCredits = trialBalance.reduce((sum: number, account: any) => sum + account.credit, 0);

      res.json({
        success: true,
        data: trialBalance,
        summary: {
          totalDebits,
          totalCredits,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
          difference: totalDebits - totalCredits,
        },
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },
};
