// src/services/exportService.ts
import { prisma } from '../lib/prisma.js';
import * as fs from 'fs';
import * as path from 'path';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { realtimeService } from './realtimeService.js';
import * as crypto from 'crypto';
import { Prisma } from '../generated/prisma/index.js';

// Enhanced types
interface ExportResult {
  filePath: string;
  fileName: string;
  format: string;
  totalRecords: number;
  fileSize: number;
  exportedAt: Date;
}

export class ExportService {
  private exportDir = path.join(process.cwd(), 'exports');

  constructor() {
    this.ensureExportDirectory();
  }

  /**
   * Ensure export directory exists
   */
  private ensureExportDirectory(): void {
    try {
      if (!fs.existsSync(this.exportDir)) {
        fs.mkdirSync(this.exportDir, { recursive: true });
      }
      logger.info('Export directory initialized');
    } catch (error) {
      logger.error('Failed to create export directory:', error);
      throw new AppError('Failed to initialize export directory', 500);
    }
  }

  /**
   * Generate unique file name
   */
  private generateFileName(type: string, format: string, identifier?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    const idPart = identifier ? `${identifier}_` : '';
    const extension = this.getFileExtension(format);
    return `${type}_${idPart}${timestamp}_${random}${extension}`;
  }

  /**
   * Get file extension based on format
   */
  private getFileExtension(format: string): string {
    switch (format.toLowerCase()) {
      case 'csv': return '.csv';
      case 'excel': return '.xlsx';
      case 'json': return '.json';
      case 'pdf': return '.html'; // Using HTML for PDF-like output
      case 'html': return '.html';
      default: return '.csv';
    }
  }

  /**
   * Write CSV manually without external library
   */
  private writeCSV(data: any[], filePath: string): void {
    if (data.length === 0) {
      fs.writeFileSync(filePath, 'No data available');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          const stringValue = value === null || value === undefined ? '' : String(value);
          // Escape quotes and wrap in quotes if contains comma
          return `"${stringValue.replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ];
    
    fs.writeFileSync(filePath, csvRows.join('\n'));
  }

  /**
   * Write Excel-like XML manually without external library
   */
  private writeExcelXML(data: any[], filePath: string, sheetName: string): void {
    const headers = data.length > 0 ? Object.keys(data[0]) : ['No data'];
    const rows = data.length > 0 ? data : [{ 'No data': 'No data available' }];

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${sheetName}">
  <Table>
   <Row>
    ${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
   </Row>
   ${rows.map(row => `
   <Row>
    ${headers.map(h => {
      const value = row[h];
      const stringValue = value === null || value === undefined ? '' : String(value);
      return `<Cell><Data ss:Type="String">${stringValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
    }).join('')}
   </Row>`).join('')}
  </Table>
 </Worksheet>
</Workbook>`;

    fs.writeFileSync(filePath, xmlContent);
  }

  /**
   * Export sales data
   */
  async exportSales(
    businessUnitId: string,
    startDate: Date,
    endDate: Date,
    format: string = 'csv'
  ): Promise<ExportResult> {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);
      if (startDate > endDate) throw new AppError('Start date must be before end date', 400);

      const where: Prisma.SaleWhereInput = {
        businessUnitId,
        saleDate: { gte: startDate, lte: endDate },
      };

      const sales = await prisma.sale.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
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
          },
          payments: {
            select: {
              paymentMethod: true,
              amount: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          businessUnit: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      });

      const exportData = sales.map((sale: any) => ({
        'Receipt Number': sale.receiptNumber,
        'Date': sale.saleDate.toISOString(),
        'Customer': sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim() : 'Guest',
        'Customer Email': sale.customer?.email || '',
        'Customer Phone': sale.customer?.phoneNumber || '',
        'Business Unit': sale.businessUnit?.name || '',
        'Item Count': sale.items.length,
        'Subtotal': sale.subtotal,
        'Tax': sale.tax,
        'Discount': sale.discount,
        'Total': sale.total,
        'Paid Amount': sale.paidAmount,
        'Change Amount': sale.changeAmount,
        'Payment Method': sale.payments[0]?.paymentMethod || 'N/A',
        'Payment Status': sale.payments[0]?.status || 'N/A',
        'Cashier': sale.user ? `${sale.user.firstName} ${sale.user.lastName}`.trim() : 'N/A',
        'Status': sale.status,
        'Notes': sale.notes || '',
      }));

      const fileName = this.generateFileName('sales', format, businessUnitId);
      const filePath = path.join(this.exportDir, fileName);

      await this.writeFile(exportData, filePath, format, 'Sales');

      const stats = fs.statSync(filePath);

      try {
        (realtimeService as any).emitExportCompleted?.(
          { type: 'sales', count: sales.length, format },
          businessUnitId
        );
      } catch (wsError) {
        logger.warn('Failed to emit export event:', wsError);
      }

      return {
        filePath,
        fileName,
        format,
        totalRecords: sales.length,
        fileSize: stats.size,
        exportedAt: new Date(),
      };
    } catch (error) {
      logger.error('Export sales error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to export sales data', 500);
    }
  }

  /**
   * Export inventory data
   */
  async exportInventory(
    businessUnitId: string,
    format: string = 'csv'
  ): Promise<ExportResult> {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const inventory = await prisma.inventory.findMany({
        where: { businessUnitId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unitPrice: true,
              costPrice: true,
              category: {
                select: { id: true, name: true },
              },
              supplier: {
                select: { id: true, name: true },
              },
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
      });

      const exportData = inventory.map((item: any) => ({
        'Product Name': item.product?.name || 'N/A',
        'SKU': item.product?.sku || item.variant?.sku || 'N/A',
        'Barcode': item.product?.barcode || 'N/A',
        'Category': item.product?.category?.name || 'Uncategorized',
        'Variant': item.variant?.name || '',
        'Supplier': item.product?.supplier?.name || 'N/A',
        'Quantity': item.quantity,
        'Reserved': item.reserved,
        'Available': item.quantity - item.reserved,
        'Reorder Point': item.reorderPoint,
        'Reorder Quantity': item.reorderQuantity,
        'Location': item.location || 'Warehouse',
        'Unit Price': item.product?.unitPrice || 0,
        'Cost Price': item.product?.costPrice || 0,
        'Total Value': (item.product?.unitPrice || 0) * item.quantity,
        'Total Cost': (item.product?.costPrice || 0) * item.quantity,
        'Last Updated': item.updatedAt.toISOString(),
      }));

      const fileName = this.generateFileName('inventory', format, businessUnitId);
      const filePath = path.join(this.exportDir, fileName);

      await this.writeFile(exportData, filePath, format, 'Inventory');

      const stats = fs.statSync(filePath);

      return {
        filePath,
        fileName,
        format,
        totalRecords: inventory.length,
        fileSize: stats.size,
        exportedAt: new Date(),
      };
    } catch (error) {
      logger.error('Export inventory error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to export inventory data', 500);
    }
  }

  /**
   * Export customers data
   */
  async exportCustomers(
    companyId: string,
    format: string = 'csv'
  ): Promise<ExportResult> {
    try {
      if (!companyId) throw new AppError('Company ID is required', 400);

      const customers = await prisma.customer.findMany({
        where: { companyId },
        include: {
          _count: {
            select: {
              sales: true,
              orders: true,
              giftCards: true,
            },
          },
        },
        orderBy: { totalSpent: 'desc' },
      });

      const exportData = customers.map((customer: any) => ({
        'First Name': customer.firstName,
        'Last Name': customer.lastName,
        'Full Name': `${customer.firstName} ${customer.lastName}`.trim(),
        'Email': customer.email,
        'Phone': customer.phoneNumber || '',
        'Address': customer.address || '',
        'City': customer.city || '',
        'State': customer.state || '',
        'Zip Code': customer.zipCode || '',
        'Country': customer.country || '',
        'Total Spent': customer.totalSpent,
        'Loyalty Points': customer.loyaltyPoints,
        'Sales Count': customer._count.sales,
        'Orders Count': customer._count.orders,
        'Gift Cards': customer._count.giftCards,
        'Last Purchase': customer.lastPurchaseAt?.toISOString() || '',
        'Status': customer.isActive ? 'Active' : 'Inactive',
        'Created At': customer.createdAt.toISOString(),
      }));

      const fileName = this.generateFileName('customers', format, companyId);
      const filePath = path.join(this.exportDir, fileName);

      await this.writeFile(exportData, filePath, format, 'Customers');

      const stats = fs.statSync(filePath);

      return {
        filePath,
        fileName,
        format,
        totalRecords: customers.length,
        fileSize: stats.size,
        exportedAt: new Date(),
      };
    } catch (error) {
      logger.error('Export customers error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to export customers data', 500);
    }
  }

  /**
   * Export products data
   */
  async exportProducts(
    businessUnitId: string,
    format: string = 'csv'
  ): Promise<ExportResult> {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const products = await prisma.product.findMany({
        where: { businessUnitId },
        include: {
          category: {
            select: { id: true, name: true },
          },
          supplier: {
            select: { id: true, name: true },
          },
          inventory: {
            select: {
              quantity: true,
              reserved: true,
              reorderPoint: true,
              reorderQuantity: true,
              location: true,
            },
          },
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
            },
          },
          _count: {
            select: {
              saleItems: true,
              orderItems: true,
              reviews: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const exportData = products.map((product: any) => ({
        'Product Name': product.name,
        'SKU': product.sku,
        'Barcode': product.barcode || '',
        'Description': product.description || '',
        'Category': product.category?.name || 'Uncategorized',
        'Supplier': product.supplier?.name || 'N/A',
        'Unit Price': product.unitPrice,
        'Cost Price': product.costPrice || 0,
        'Tax Rate': product.taxRate || 0,
        'Stock': product.inventory[0]?.quantity || 0,
        'Reserved': product.inventory[0]?.reserved || 0,
        'Available': (product.inventory[0]?.quantity || 0) - (product.inventory[0]?.reserved || 0),
        'Reorder Point': product.inventory[0]?.reorderPoint || 0,
        'Location': product.inventory[0]?.location || 'Warehouse',
        'Variants': product.variants.length,
        'Sales Count': product._count.saleItems,
        'Order Count': product._count.orderItems,
        'Review Count': product._count.reviews,
        'Status': product.isActive ? 'Active' : 'Inactive',
        'Created At': product.createdAt.toISOString(),
      }));

      const fileName = this.generateFileName('products', format, businessUnitId);
      const filePath = path.join(this.exportDir, fileName);

      await this.writeFile(exportData, filePath, format, 'Products');

      const stats = fs.statSync(filePath);

      return {
        filePath,
        fileName,
        format,
        totalRecords: products.length,
        fileSize: stats.size,
        exportedAt: new Date(),
      };
    } catch (error) {
      logger.error('Export products error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to export products data', 500);
    }
  }

  /**
   * Export suppliers data
   */
  async exportSuppliers(
    companyId: string,
    format: string = 'csv'
  ): Promise<ExportResult> {
    try {
      if (!companyId) throw new AppError('Company ID is required', 400);

      const suppliers = await prisma.supplier.findMany({
        where: { companyId },
        include: {
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const exportData = suppliers.map((supplier: any) => ({
        'Supplier Name': supplier.name,
        'Contact Person': supplier.contactPerson || '',
        'Email': supplier.email || '',
        'Phone': supplier.phone || '',
        'Address': supplier.address || '',
        'Tax ID': supplier.taxId || '',
        'Products': supplier._count.products,
        'Purchase Orders': supplier._count.purchaseOrders,
        'Status': supplier.isActive ? 'Active' : 'Inactive',
        'Created At': supplier.createdAt.toISOString(),
        'Notes': supplier.notes || '',
      }));

      const fileName = this.generateFileName('suppliers', format, companyId);
      const filePath = path.join(this.exportDir, fileName);

      await this.writeFile(exportData, filePath, format, 'Suppliers');

      const stats = fs.statSync(filePath);

      return {
        filePath,
        fileName,
        format,
        totalRecords: suppliers.length,
        fileSize: stats.size,
        exportedAt: new Date(),
      };
    } catch (error) {
      logger.error('Export suppliers error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to export suppliers data', 500);
    }
  }

  /**
   * Export payments data
   */
  async exportPayments(
    businessUnitId: string | undefined,
    startDate: Date,
    endDate: Date,
    format: string = 'csv'
  ): Promise<ExportResult> {
    try {
      if (startDate > endDate) throw new AppError('Start date must be before end date', 400);

      const where: Prisma.PaymentWhereInput = {
        processedAt: { gte: startDate, lte: endDate },
      };

      if (businessUnitId) {
        where.OR = [
          { sale: { businessUnitId } },
          { order: { businessUnitId } },
        ];
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          sale: {
            select: {
              receiptNumber: true,
              businessUnitId: true,
              businessUnit: { select: { name: true } },
            },
          },
          order: {
            select: {
              orderNumber: true,
              businessUnitId: true,
            },
          },
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
          refunds: {
            select: { amount: true, reason: true },
          },
        },
        orderBy: { processedAt: 'desc' },
      });

      const exportData = payments.map((payment: any) => ({
        'Transaction ID': payment.transactionId || payment.id,
        'Reference': payment.reference || '',
        'Receipt Number': payment.sale?.receiptNumber || 'N/A',
        'Order Number': payment.order?.orderNumber || 'N/A',
        'Business Unit': payment.sale?.businessUnit?.name || '',
        'Amount': payment.amount,
        'Payment Method': payment.paymentMethod,
        'Status': payment.status,
        'Processed At': payment.processedAt.toISOString(),
        'Cashier': payment.user ? `${payment.user.firstName} ${payment.user.lastName}`.trim() : 'N/A',
        'Notes': payment.notes || '',
      }));

      const fileName = this.generateFileName('payments', format, businessUnitId);
      const filePath = path.join(this.exportDir, fileName);

      await this.writeFile(exportData, filePath, format, 'Payments');

      const stats = fs.statSync(filePath);

      return {
        filePath,
        fileName,
        format,
        totalRecords: payments.length,
        fileSize: stats.size,
        exportedAt: new Date(),
      };
    } catch (error) {
      logger.error('Export payments error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to export payments data', 500);
    }
  }

  /**
   * Export purchase orders
   */
  async exportPurchaseOrders(
    businessUnitId: string | undefined,
    startDate: Date | undefined,
    endDate: Date | undefined,
    status: string | undefined,
    format: string = 'csv'
  ): Promise<ExportResult> {
    try {
      const where: Prisma.PurchaseOrderWhereInput = {};

      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (status) where.status = status as any;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const purchaseOrders = await prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
          businessUnit: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const exportData = purchaseOrders.map((po: any) => ({
        'Order Number': po.orderNumber,
        'Supplier': po.supplier?.name || 'N/A',
        'Supplier Email': po.supplier?.email || '',
        'Supplier Phone': po.supplier?.phone || '',
        'Business Unit': po.businessUnit?.name || '',
        'Status': po.status,
        'Item Count': po.items.length,
        'Total': po.total,
        'Created By': po.user ? `${po.user.firstName} ${po.user.lastName}`.trim() : 'N/A',
        'Created At': po.createdAt.toISOString(),
        'Expected Delivery': po.expectedDelivery?.toISOString() || '',
        'Received At': po.receivedAt?.toISOString() || '',
        'Notes': po.notes || '',
      }));

      const fileName = this.generateFileName('purchase_orders', format, businessUnitId);
      const filePath = path.join(this.exportDir, fileName);

      await this.writeFile(exportData, filePath, format, 'Purchase Orders');

      const stats = fs.statSync(filePath);

      return {
        filePath,
        fileName,
        format,
        totalRecords: purchaseOrders.length,
        fileSize: stats.size,
        exportedAt: new Date(),
      };
    } catch (error) {
      logger.error('Export purchase orders error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to export purchase orders', 500);
    }
  }

  /**
   * Write data to file based on format
   */
  private async writeFile(
    data: any[],
    filePath: string,
    format: string,
    sheetName: string
  ): Promise<void> {
    try {
      switch (format.toLowerCase()) {
        case 'csv':
          this.writeCSV(data, filePath);
          break;

        case 'excel':
          this.writeExcelXML(data, filePath, sheetName);
          break;

        case 'json':
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          break;

        case 'html':
        case 'pdf':
          fs.writeFileSync(filePath, this.generateHTMLContent(sheetName, data));
          break;

        default:
          throw new AppError(`Unsupported format: ${format}`, 400);
      }
    } catch (error) {
      logger.error('Write file error:', error);
      throw new AppError('Failed to write export file', 500);
    }
  }

  /**
   * Generate HTML content for report
   */
  private generateHTMLContent(title: string, data: any[]): string {
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const rows = data.slice(0, 500);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; font-weight: bold; position: sticky; top: 0; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 12px; }
    .count { text-align: center; color: #666; margin-bottom: 10px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="count">Total Records: ${data.length}${data.length > 500 ? ' (showing first 500)' : ''}</p>
  <p style="text-align: center; color: #666;">Generated on ${new Date().toLocaleString()}</p>
  ${data.length > 0 ? `
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows.map(row => `
        <tr>${headers.map(h => `<td>${this.formatCell(row[h])}</td>`).join('')}</tr>
      `).join('')}
    </tbody>
  </table>` : '<p style="text-align: center;">No data available</p>'}
  <div class="footer">
    <p>This document was generated electronically and is valid without signature.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Format cell value for HTML
   */
  private formatCell(value: any): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Get export history
   */
  async getExportHistory(): Promise<any[]> {
    try {
      if (!fs.existsSync(this.exportDir)) return [];

      const files = fs.readdirSync(this.exportDir)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.csv', '.json', '.html', '.xlsx', '.pdf'].includes(ext);
        })
        .map(file => {
          const stats = fs.statSync(path.join(this.exportDir, file));
          const parts = file.split('_');
          
          return {
            fileName: file,
            type: parts[0] || 'unknown',
            size: stats.size,
            sizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
            createdAt: stats.mtime,
            format: path.extname(file).toLowerCase().replace('.', ''),
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return files;
    } catch (error) {
      logger.error('Get export history error:', error);
      throw new AppError('Failed to get export history', 500);
    }
  }

  /**
   * Delete export file
   */
  async deleteExportFile(fileName: string): Promise<void> {
    try {
      const safeFileName = path.basename(fileName);
      const filePath = path.join(this.exportDir, safeFileName);

      if (!fs.existsSync(filePath)) {
        throw new AppError('Export file not found', 404);
      }

      fs.unlinkSync(filePath);
      logger.info(`Export file deleted: ${safeFileName}`);
    } catch (error) {
      logger.error('Delete export file error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete export file', 500);
    }
  }
}

export const exportService = new ExportService();
