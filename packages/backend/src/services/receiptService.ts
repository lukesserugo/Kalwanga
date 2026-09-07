// src/services/receiptService.ts
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { barcodeService } from './barcodeService.js';
import { realtimeService } from './realtimeService.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Enhanced types
interface ReceiptData {
  id: string;
  receiptNumber: string;
  saleId: string;
  date: Date;
  cashier: string;
  customer: string;
  customerEmail?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    sku: string;
    barcode?: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
    taxRate?: number;
    discount?: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  paymentReference?: string | null;
  qrCode: string;
  barcode?: string;
  businessName: string;
  businessUnit: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  notes?: string | null;
  printedAt?: Date;
  printCount: number;
}

interface ReceiptStats {
  totalReceipts: number;
  totalPrinted: number;
  totalEmailed: number;
  totalRevenue: number;
  averageReceiptValue: number;
  todayReceipts: number;
  todayRevenue: number;
}

export class ReceiptService {
  /**
   * Handle errors
   */
  private handleError(error: any, context: string): never {
    logger.error(`${context} error:`, error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to ${context.replace('ReceiptService.', '').replace(/([A-Z])/g, ' $1').toLowerCase()}`, 500);
  }

  /**
   * Generate printable receipt with comprehensive details
   */
  async generateReceipt(saleId: string): Promise<ReceiptData> {
    try {
      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  unitPrice: true,
                  taxRate: true,
                  images: true,
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
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
          businessUnit: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  address: true,
                  logo: true,
                },
              },
            },
          },
          payments: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
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
        },
      });

      if (!sale) {
        throw new AppError('Sale not found', 404);
      }

      // Generate QR code
      const qrCodeResult = await barcodeService.generateReceiptQRCode(sale.receiptNumber);
      const qrCode = typeof qrCodeResult === 'string' 
        ? qrCodeResult 
        : ((qrCodeResult as any).qrCodeUrl || (qrCodeResult as any).qrData || JSON.stringify(qrCodeResult));

      // Generate barcode - extract barcode string from returned object
      const barcodeResult = await barcodeService.generateBarcode(sale.id);
      const barcode = typeof barcodeResult === 'string' 
        ? barcodeResult 
        : ((barcodeResult as any).barcode || '');

      // Build receipt data
      const receiptData: ReceiptData = {
        id: sale.id,
        receiptNumber: sale.receiptNumber,
        saleId: sale.id,
        date: sale.saleDate,
        cashier: `${sale.user?.firstName || ''} ${sale.user?.lastName || ''}`.trim() || 'Unknown',
        customer: sale.customer 
          ? `${sale.customer.firstName} ${sale.customer.lastName}`.trim() 
          : 'Guest',
        customerEmail: sale.customer?.email || undefined,
        customerPhone: sale.customer?.phoneNumber || undefined,
        items: sale.items.map((item: any) => ({
          name: item.product.name,
          sku: item.product.sku,
          barcode: item.product.barcode || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          taxRate: item.product.taxRate || 0,
          discount: item.discount || 0,
        })),
        subtotal: sale.subtotal,
        tax: sale.tax,
        discount: sale.discount,
        total: sale.total,
        paidAmount: sale.paidAmount,
        changeAmount: sale.changeAmount,
        paymentMethod: sale.payments[0]?.paymentMethod || 'UNKNOWN',
        paymentReference: sale.payments[0]?.reference || undefined,
        qrCode,
        barcode,
        businessName: sale.businessUnit.company.name,
        businessUnit: sale.businessUnit.name,
        businessAddress: sale.businessUnit.address || undefined,
        businessPhone: sale.businessUnit.phone || undefined,
        businessEmail: sale.businessUnit.company.email || undefined,
        notes: sale.notes || undefined,
        printCount: 0,
      };

      // Check if receipt record exists
      const existingReceipt = await prisma.receipt.findFirst({
        where: { saleId: sale.id },
      });

      if (!existingReceipt) {
        // Create receipt record
        await prisma.receipt.create({
          data: {
            receiptNumber: sale.receiptNumber,
            saleId: sale.id,
            companyId: sale.businessUnit.companyId,
            format: 'STANDARD',
            content: JSON.stringify(receiptData),
          } as any,
        });
      }

      // Emit realtime event
      try {
        (realtimeService as any).emitReceiptIssued?.(receiptData, sale.businessUnitId);
      } catch (wsError) {
        logger.warn('Failed to emit receipt event:', wsError);
      }

      return receiptData;
    } catch (error) {
      return this.handleError(error, 'ReceiptService.generateReceipt');
    }
  }

  /**
   * Get receipt by ID
   */
  async getReceiptById(id: string) {
    try {
      if (!id) {
        throw new AppError('Receipt ID is required', 400);
      }

      const receipt = await prisma.receipt.findUnique({
        where: { id },
        include: {
          sale: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
              customer: true,
              payments: true,
            },
          },
          businessUnit: {
            include: {
              company: true,
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
      });

      if (!receipt) {
        throw new AppError('Receipt not found', 404);
      }

      return receipt;
    } catch (error) {
      return this.handleError(error, 'ReceiptService.getReceiptById');
    }
  }

  /**
   * Get receipt by receipt number
   */
  async getReceiptByNumber(receiptNumber: string) {
    try {
      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const receipt = await prisma.receipt.findFirst({
        where: { receiptNumber },
        include: {
          sale: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
              customer: true,
              payments: true,
            },
          },
          businessUnit: {
            include: {
              company: true,
            },
          },
        },
      });

      if (!receipt) {
        throw new AppError('Receipt not found', 404);
      }

      return receipt;
    } catch (error) {
      return this.handleError(error, 'ReceiptService.getReceiptByNumber');
    }
  }

  /**
   * Record receipt print
   */
  async recordPrint(receiptId: string, userId: string) {
    try {
      if (!receiptId) {
        throw new AppError('Receipt ID is required', 400);
      }

      return await prisma.$transaction(async (tx) => {
        const receipt = await tx.receipt.findUnique({
          where: { id: receiptId },
        });

        if (!receipt) {
          throw new AppError('Receipt not found', 404);
        }

        const updatedReceipt = await tx.receipt.update({
          where: { id: receiptId },
          data: {
            printedAt: new Date(),
            printCount: { increment: 1 },
            lastPrintedBy: userId,
          } as any,
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'RECEIPT',
            entityId: receiptId,
            entityName: `Receipt ${receipt.receiptNumber}`,
            userId: userId,
            changes: {
              action: 'PRINT',
              printedAt: new Date(),
              printCount: (receipt.printCount || 0) + 1,
            },
          } as any,
        });

        return updatedReceipt;
      });
    } catch (error) {
      return this.handleError(error, 'ReceiptService.recordPrint');
    }
  }

  /**
   * Send receipt via email
   */
  async sendReceiptEmail(receiptId: string, email: string) {
    try {
      if (!receiptId) {
        throw new AppError('Receipt ID is required', 400);
      }
      if (!email || !this.isValidEmail(email)) {
        throw new AppError('Valid email address is required', 400);
      }

      const receipt = await this.getReceiptById(receiptId);
      
      if (!receipt) {
        throw new AppError('Receipt not found', 404);
      }

      const htmlContent = this.generateReceiptHTML(receipt);

      // FIXED: sendEmail expects a single options object with to, subject, html
      const notificationService = (await import('./notificationService.js')).notificationService;
      await notificationService.sendEmail({
        to: email,
        subject: `Receipt #${receipt.receiptNumber}`,
        html: htmlContent,
      });

      // Update receipt status
      await prisma.receipt.update({
        where: { id: receiptId },
        data: {
          sentAt: new Date(),
        } as any,
      });

      return { success: true, message: 'Receipt sent via email' };
    } catch (error) {
      return this.handleError(error, 'ReceiptService.sendReceiptEmail');
    }
  }

  /**
   * Generate receipt HTML for email
   */
  private generateReceiptHTML(receipt: any): string {
    const items = receipt.sale.items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product.name}</td>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2c3e50; padding-bottom: 20px; }
          .header h1 { color: #2c3e50; margin: 0; }
          .info { margin-bottom: 20px; }
          .total { text-align: right; font-size: 18px; margin-top: 20px; }
          .footer { margin-top: 30px; text-align: center; color: #7f8c8d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${receipt.businessUnit?.company?.name || 'Receipt'}</h1>
            <p>${receipt.businessUnit?.name || ''}</p>
            <p>${receipt.businessUnit?.address || ''}</p>
          </div>
          <div class="info">
            <p><strong>Receipt #:</strong> ${receipt.receiptNumber}</p>
            <p><strong>Date:</strong> ${receipt.sale.saleDate.toLocaleString()}</p>
            <p><strong>Customer:</strong> ${receipt.sale.customer ? `${receipt.sale.customer.firstName} ${receipt.sale.customer.lastName}` : 'Guest'}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left;">Item</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${items}</tbody>
          </table>
          <div style="margin-top: 20px; text-align: right;">
            <p><strong>Subtotal:</strong> $${receipt.sale.subtotal.toFixed(2)}</p>
            <p><strong>Tax:</strong> $${receipt.sale.tax.toFixed(2)}</p>
            <div class="total"><strong>Total: $${receipt.sale.total.toFixed(2)}</strong></div>
            <p><strong>Payment Method:</strong> ${receipt.sale.payments[0]?.paymentMethod || 'N/A'}</p>
          </div>
          <div class="footer">
            <p>Thank you for your purchase!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Validate email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get receipt statistics
   */
  async getReceiptStats(businessUnitId?: string): Promise<ReceiptStats> {
    try {
      const where: any = {};
      const saleWhere: any = {};
      if (businessUnitId) saleWhere.businessUnitId = businessUnitId;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [totalReceipts, totalPrinted, totalEmailed, salesAgg, todayReceipts, todaySales] = await Promise.all([
        prisma.receipt.count({ where }),
        prisma.receipt.count({ where: { ...where, printedAt: { not: null } } }),
        prisma.receipt.count({ where: { ...where, sentAt: { not: null } } }),
        prisma.sale.aggregate({
          where: saleWhere,
          _sum: { total: true },
        }),
        prisma.receipt.count({
          where: { ...where, createdAt: { gte: today, lt: tomorrow } },
        }),
        prisma.sale.aggregate({
          where: { ...saleWhere, saleDate: { gte: today, lt: tomorrow } },
          _sum: { total: true },
        }),
      ]);

      return {
        totalReceipts,
        totalPrinted,
        totalEmailed,
        totalRevenue: salesAgg._sum.total || 0,
        averageReceiptValue: totalReceipts > 0 ? (salesAgg._sum.total || 0) / totalReceipts : 0,
        todayReceipts,
        todayRevenue: todaySales._sum.total || 0,
      };
    } catch (error) {
      return this.handleError(error, 'ReceiptService.getReceiptStats');
    }
  }

  /**
   * Export receipts (simplified - no external libraries)
   */
  async exportReceipts(businessUnitId: string, format: 'csv' | 'excel' | 'json' = 'csv') {
    try {
      const receipts = await prisma.receipt.findMany({
        where: { 
          ...(businessUnitId ? { sale: { businessUnitId } } : {}),
        } as any,
        include: {
          sale: {
            include: {
              customer: true,
              items: true,
              payments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const exportData = receipts.map((receipt: any) => ({
        'Receipt Number': receipt.receiptNumber,
        'Date': receipt.sale?.saleDate?.toISOString() || '',
        'Customer': receipt.sale?.customer 
          ? `${receipt.sale.customer.firstName} ${receipt.sale.customer.lastName}` 
          : 'Guest',
        'Items': receipt.sale?.items?.length || 0,
        'Total': receipt.sale?.total || 0,
        'Printed': receipt.printedAt ? 'Yes' : 'No',
        'Emailed': receipt.sentAt ? 'Yes' : 'No',
      }));

      const exportDir = path.join(process.cwd(), 'exports', 'receipts');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let filePath: string;
      let fileName: string;

      if (format === 'csv') {
        fileName = `receipts_${timestamp}.csv`;
        filePath = path.join(exportDir, fileName);
        
        const headers = Object.keys(exportData[0] || {});
        const csvRows = [
          headers.join(','),
          ...exportData.map(row => {
            const rowData = row as any;
            return headers.map(h => `"${String(rowData[h] || '').replace(/"/g, '""')}"`).join(',');
          }),
        ];
        fs.writeFileSync(filePath, csvRows.join('\n'));
      } else if (format === 'json') {
        fileName = `receipts_${timestamp}.json`;
        filePath = path.join(exportDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      } else {
        // Excel XML format
        fileName = `receipts_${timestamp}.xlsx`;
        filePath = path.join(exportDir, fileName);
        
        const headers = Object.keys(exportData[0] || {});
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Receipts">
  <Table>
   <Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
   ${exportData.map(row => {
     const rowData = row as any;
     return `
   <Row>${headers.map(h => `<Cell><Data ss:Type="String">${String(rowData[h] || '')}</Data></Cell>`).join('')}</Row>`;
   }).join('')}
  </Table>
 </Worksheet>
</Workbook>`;
        fs.writeFileSync(filePath, xmlContent);
      }

      return {
        filePath,
        fileName,
        format,
        totalRecords: exportData.length,
        exportedAt: new Date(),
      };
    } catch (error) {
      return this.handleError(error, 'ReceiptService.exportReceipts');
    }
  }
}

export const receiptService = new ReceiptService();
