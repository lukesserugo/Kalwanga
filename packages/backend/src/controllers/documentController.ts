// src/controllers/documentController.ts
import { Request, Response, NextFunction } from 'express';
import { documentService } from '../services/documentService.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Validation schemas
const generateInvoiceSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
});

const generateFinancialReportSchema = z.object({
  businessUnitId: z.string().min(1, 'Business unit ID is required'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  format: z.enum(['pdf', 'html', 'excel', 'csv']).default('pdf'),
});

const generateReportSchema = z.object({
  type: z.enum(['sales', 'inventory', 'customers', 'products', 'employees', 'payments', 'financial']),
  businessUnitId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  format: z.enum(['pdf', 'html', 'excel', 'csv', 'json']).default('json'),
});

export const documentController = {
  /**
   * Generate invoice
   * POST /documents/invoice
   */
  async generateInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { saleId } = generateInvoiceSchema.parse(req.body);

      const filePath = await documentService.generateInvoice(saleId);

      // Send file for download
      res.download(filePath, path.basename(filePath), (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to download invoice', 500));
          }
        }
        
        // Clean up file after download
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.warn('Failed to cleanup invoice file:', error);
          }
        }, 5000);
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
   * Get invoice as HTML (view in browser)
   * GET /documents/invoice/:saleId
   */
  async viewInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { saleId } = req.params;

      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      const filePath = await documentService.generateInvoice(saleId);

      // Send as HTML
      res.setHeader('Content-Type', 'text/html');
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('Send file error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to load invoice', 500));
          }
        }
        
        // Clean up file after sending
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.warn('Failed to cleanup invoice file:', error);
          }
        }, 5000);
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate financial report
   * POST /documents/financial-report
   */
  async generateFinancialReport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = generateFinancialReportSchema.parse(req.body);

      const filePath = await documentService.generateFinancialReport(
        data.businessUnitId,
        new Date(data.startDate),
        new Date(data.endDate),
        data.format
      );

      // Send file for download
      res.download(filePath, path.basename(filePath), (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to download report', 500));
          }
        }
        
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.warn('Failed to cleanup report file:', error);
          }
        }, 5000);
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
   * Generate sales report
   * POST /documents/reports/sales
   */
  async generateSalesReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, startDate, endDate, format = 'json' } = req.body;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const sales = await prisma.sale.findMany({
        where: {
          ...(businessUnitId && { businessUnitId }),
          saleDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          payments: true,
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { saleDate: 'desc' },
      });

      const reportData = {
        period: `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`,
        totalSales: sales.length,
        totalRevenue: sales.reduce((sum, s) => sum + s.total, 0),
        totalTax: sales.reduce((sum, s) => sum + s.tax, 0),
        totalDiscount: sales.reduce((sum, s) => sum + s.discount, 0),
        sales,
      };

      res.json({
        success: true,
        data: reportData,
        format,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate inventory report
   * POST /documents/reports/inventory
   */
  async generateInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, format = 'json' } = req.body;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const inventory = await prisma.inventory.findMany({
        where: { businessUnitId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitPrice: true,
              costPrice: true,
              category: { select: { name: true } },
            },
          },
        },
      });

      // FIXED: Added null checks for i.product
      const totalValue = inventory.reduce((sum, i) => {
        const unitPrice = i.product?.unitPrice || 0;
        return sum + (i.quantity * unitPrice);
      }, 0);

      const totalCost = inventory.reduce((sum, i) => {
        const costPrice = i.product?.costPrice || 0;
        return sum + (i.quantity * costPrice);
      }, 0);

      const reportData = {
        totalItems: inventory.length,
        totalValue,
        totalCost,
        lowStock: inventory.filter(i => i.quantity <= i.reorderPoint).length,
        outOfStock: inventory.filter(i => i.quantity === 0).length,
        items: inventory,
      };

      res.json({
        success: true,
        data: reportData,
        format,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate customer report
   * POST /documents/reports/customers
   */
  async generateCustomerReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, format = 'json' } = req.body;

      if (!companyId) {
        throw new AppError('Company ID is required', 400);
      }

      const customers = await prisma.customer.findMany({
        where: { companyId, isActive: true },
        include: {
          _count: {
            select: { sales: true },
          },
        },
        orderBy: { totalSpent: 'desc' },
      });

      const reportData = {
        totalCustomers: customers.length,
        totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
        averageSpent: customers.length > 0 
          ? customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length 
          : 0,
        topCustomers: customers.slice(0, 50),
      };

      res.json({
        success: true,
        data: reportData,
        format,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate product report
   * POST /documents/reports/products
   */
  async generateProductReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, startDate, endDate, format = 'json' } = req.body;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const where: any = { businessUnitId, isActive: true };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const products = await prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
          inventory: { select: { quantity: true } },
          _count: {
            select: { saleItems: true },
          },
        },
      });

      const reportData = {
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        products,
      };

      res.json({
        success: true,
        data: reportData,
        format,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate employee report
   * POST /documents/reports/employees
   */
  async generateEmployeeReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, startDate, endDate, format = 'json' } = req.body;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const where: any = { businessUnitId };
      if (startDate || endDate) {
        where.saleDate = {};
        if (startDate) where.saleDate.gte = new Date(startDate);
        if (endDate) where.saleDate.lte = new Date(endDate);
      }

      const sales = await prisma.sale.groupBy({
        by: ['userId'],
        where,
        _sum: { total: true },
        _count: true,
      });

      const userIds = sales.map(s => s.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      });

      const reportData = sales.map(s => {
        const user = users.find(u => u.id === s.userId);
        return {
          user,
          totalSales: s._sum.total || 0,
          saleCount: s._count,
          averageSale: s._count > 0 ? (s._sum.total || 0) / s._count : 0,
        };
      });

      res.json({
        success: true,
        data: reportData,
        format,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate payment report
   * POST /documents/reports/payments
   */
  async generatePaymentReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, startDate, endDate, format = 'json' } = req.body;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400);
      }

      const where: any = {
        processedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: 'PAID',
      };

      if (businessUnitId) {
        where.sale = { businessUnitId };
      }

      const payments = await prisma.payment.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { amount: true },
        _count: true,
      });

      const total = payments.reduce((sum, p) => sum + (p._sum.amount || 0), 0);

      const reportData = {
        paymentMethods: payments.map(p => ({
          method: p.paymentMethod,
          total: p._sum.amount || 0,
          count: p._count,
          percentage: total > 0 ? ((p._sum.amount || 0) / total) * 100 : 0,
        })),
        total,
        totalCount: payments.reduce((sum, p) => sum + p._count, 0),
      };

      res.json({
        success: true,
        data: reportData,
        format,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate comprehensive report
   * POST /documents/reports/comprehensive
   */
  async generateComprehensiveReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, startDate, endDate, format = 'json' } = req.body;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
      const end = endDate ? new Date(endDate) : new Date();

      // Gather all data in parallel
      const [sales, inventory, customers, products, payments] = await Promise.all([
        prisma.sale.findMany({
          where: {
            businessUnitId,
            saleDate: { gte: start, lte: end },
          },
          include: {
            items: { include: { product: true } },
            customer: true,
            payments: true,
          },
        }),
        prisma.inventory.findMany({
          where: { businessUnitId },
          include: { product: true },
        }),
        prisma.customer.findMany({
          where: {
            sales: { some: { businessUnitId } },
          },
          orderBy: { totalSpent: 'desc' },
          take: 20,
        }),
        prisma.product.findMany({
          where: { businessUnitId, isActive: true },
          include: {
            category: true,
            inventory: true,
          },
        }),
        prisma.payment.findMany({
          where: {
            processedAt: { gte: start, lte: end },
            status: 'PAID',
          },
          include: { sale: true },
        }),
      ]);

      // FIXED: Added null checks for i.product
      const inventoryTotalValue = inventory.reduce((sum, i) => {
        const unitPrice = i.product?.unitPrice || 0;
        return sum + (i.quantity * unitPrice);
      }, 0);

      const inventoryTotalCost = inventory.reduce((sum, i) => {
        const costPrice = i.product?.costPrice || 0;
        return sum + (i.quantity * costPrice);
      }, 0);

      const reportData = {
        period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        sales: {
          totalSales: sales.length,
          totalRevenue: sales.reduce((sum, s) => sum + s.total, 0),
          totalTax: sales.reduce((sum, s) => sum + s.tax, 0),
          totalDiscount: sales.reduce((sum, s) => sum + s.discount, 0),
          averageOrder: sales.length > 0 
            ? sales.reduce((sum, s) => sum + s.total, 0) / sales.length 
            : 0,
        },
        inventory: {
          totalItems: inventory.length,
          totalValue: inventoryTotalValue,
          totalCost: inventoryTotalCost,
          lowStock: inventory.filter(i => i.quantity <= i.reorderPoint).length,
          outOfStock: inventory.filter(i => i.quantity === 0).length,
        },
        customers: {
          total: customers.length,
          totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
        },
        products: {
          total: products.length,
          active: products.filter(p => p.isActive).length,
        },
        payments: {
          total: payments.reduce((sum, p) => sum + p.amount, 0),
          count: payments.length,
        },
        generatedAt: new Date(),
      };

      res.json({
        success: true,
        data: reportData,
        format,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get list of generated documents
   * GET /documents
   */
  async listDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const exportDir = path.join(process.cwd(), 'exports');

      if (!fs.existsSync(exportDir)) {
        return res.json({ success: true, data: [] });
      }

      const files = fs.readdirSync(exportDir)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.html', '.csv', '.pdf', '.xlsx', '.json'].includes(ext);
        })
        .map(file => {
          const stats = fs.statSync(path.join(exportDir, file));
          return {
            fileName: file,
            size: stats.size,
            sizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
            createdAt: stats.mtime,
            type: path.extname(file).toLowerCase().replace('.', ''),
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json({
        success: true,
        data: files,
        count: files.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Download a generated document
   * GET /documents/download/:fileName
   */
  async downloadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        throw new AppError('File name is required', 400);
      }

      // Prevent path traversal
      const safeFileName = path.basename(fileName);
      const filePath = path.join(process.cwd(), 'exports', safeFileName);

      if (!fs.existsSync(filePath)) {
        throw new AppError('Document not found', 404);
      }

      res.download(filePath, safeFileName, (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to download document', 500));
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete a generated document
   * DELETE /documents/:fileName
   */
  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        throw new AppError('File name is required', 400);
      }

      const safeFileName = path.basename(fileName);
      const filePath = path.join(process.cwd(), 'exports', safeFileName);

      if (!fs.existsSync(filePath)) {
        throw new AppError('Document not found', 404);
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};
