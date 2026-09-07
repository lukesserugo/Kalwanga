// src/services/documentService.ts
import { prisma } from '../lib/prisma.js';
import * as fs from 'fs';
import * as path from 'path';
import { AppError } from '../middleware/errorHandler.js';

export class DocumentService {
  private exportDir = path.join(process.cwd(), 'exports');

  constructor() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * Generate professional invoice as HTML (printable to PDF)
   */
  async generateInvoice(saleId: string): Promise<string> {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        items: { include: { product: true } },
        customer: true,
        businessUnit: { include: { company: true } },
        payments: true,
      },
    });

    if (!sale) throw new AppError('Sale not found', 404);

    const fileName = `invoice_${sale.receiptNumber}.html`;
    const filePath = path.join(this.exportDir, fileName);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${sale.receiptNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; }
          .header h2 { margin: 5px 0; color: #666; }
          .details { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .items-table th { background: #f5f5f5; }
          .totals { text-align: right; }
          .footer { text-align: center; margin-top: 40px; color: #999; font-size: 12px; }
          .total-row { font-weight: bold; font-size: 1.2em; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${sale.businessUnit.company.name}</h1>
          <h2>${sale.businessUnit.name}</h2>
          <h3>INVOICE</h3>
        </div>
        <div class="details">
          <div>
            <p><strong>Invoice #:</strong> ${sale.receiptNumber}</p>
            <p><strong>Date:</strong> ${sale.saleDate.toLocaleDateString()}</p>
          </div>
          <div>
            <p><strong>Customer:</strong> ${sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Guest'}</p>
          </div>
        </div>
        <table class="items-table">
          <thead>
            <tr><th>Item</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr>
          </thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td>${item.product.name}</td>
                <td>${item.quantity}</td>
                <td>$${item.unitPrice.toFixed(2)}</td>
                <td>$${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals">
          <p>Subtotal: $${sale.subtotal.toFixed(2)}</p>
          <p>Tax: $${sale.tax.toFixed(2)}</p>
          <p>Discount: $${sale.discount.toFixed(2)}</p>
          <p class="total-row">Total: $${sale.total.toFixed(2)}</p>
          <p>Payment Method: ${sale.payments[0]?.paymentMethod || 'N/A'}</p>
          <p>Amount Paid: $${sale.paidAmount.toFixed(2)}</p>
          <p>Change: $${sale.changeAmount.toFixed(2)}</p>
        </div>
        <div class="footer">
          <p>Thank you for your business!</p>
        </div>
      </body>
      </html>
    `;

    fs.writeFileSync(filePath, html);
    return filePath;
  }

  /**
   * Generate comprehensive financial report
   */
  async generateFinancialReport(
    businessUnitId: string,
    startDate: Date,
    endDate: Date,
    format: 'pdf' | 'html' | 'excel' | 'csv' = 'pdf'
  ) {
    const sales = await prisma.sale.findMany({
      where: { businessUnitId, saleDate: { gte: startDate, lte: endDate } },
      include: { items: { include: { product: true } }, customer: true, payments: true },
    });

    const reportData = {
      period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum: number, s) => sum + s.total, 0),
      totalTax: sales.reduce((sum: number, s) => sum + s.tax, 0),
      totalDiscount: sales.reduce((sum: number, s) => sum + s.discount, 0),
      averageOrder: sales.length > 0 ? sales.reduce((sum: number, s) => sum + s.total, 0) / sales.length : 0,
      topProducts: this.getTopProducts(sales),
      paymentBreakdown: this.getPaymentBreakdown(sales),
      dailyBreakdown: this.getDailyBreakdown(sales),
    };

    switch (format) {
      case 'pdf':
      case 'html':
        return this.generateHTMLReport(reportData, `Financial_Report_${Date.now()}.html`);
      case 'excel':
      case 'csv':
        return this.generateCSVReport(sales, `Financial_Report_${Date.now()}.csv`);
      default:
        throw new AppError('Invalid format', 400);
    }
  }

  private getTopProducts(sales: any[]) {
    const productMap = new Map<string, number>();
    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const key = item.product?.name || 'Unknown';
        productMap.set(key, (productMap.get(key) || 0) + item.total);
      });
    });
    return Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, total]) => ({ name, total }));
  }

  private getPaymentBreakdown(sales: any[]) {
    const breakdown: Record<string, number> = {};
    sales.forEach(sale => {
      const method = sale.payments[0]?.paymentMethod || 'UNKNOWN';
      breakdown[method] = (breakdown[method] || 0) + sale.total;
    });
    return breakdown;
  }

  private getDailyBreakdown(sales: any[]) {
    const daily: Record<string, number> = {};
    sales.forEach(sale => {
      const date = sale.saleDate.toLocaleDateString();
      daily[date] = (daily[date] || 0) + sale.total;
    });
    return daily;
  }

  private async generateHTMLReport(data: any, fileName: string): Promise<string> {
    const filePath = path.join(this.exportDir, fileName);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Financial Report</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
          h1 { text-align: center; }
          .section { margin-bottom: 30px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; }
          .card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
          .card p { margin: 0; font-size: 24px; font-weight: bold; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>Financial Report</h1>
        <p style="text-align: center; color: #666;">${data.period}</p>
        <div class="section">
          <div class="grid">
            <div class="card"><h3>Total Sales</h3><p>${data.totalSales}</p></div>
            <div class="card"><h3>Total Revenue</h3><p>$${data.totalRevenue.toFixed(2)}</p></div>
            <div class="card"><h3>Total Tax</h3><p>$${data.totalTax.toFixed(2)}</p></div>
            <div class="card"><h3>Total Discount</h3><p>$${data.totalDiscount.toFixed(2)}</p></div>
            <div class="card"><h3>Average Order</h3><p>$${data.averageOrder.toFixed(2)}</p></div>
          </div>
        </div>
        <div class="section">
          <h2>Top Products</h2>
          <table>
            <thead><tr><th>Product</th><th>Total Revenue</th></tr></thead>
            <tbody>
              ${data.topProducts.map((p: any) => `<tr><td>${p.name}</td><td>$${p.total.toFixed(2)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="section">
          <h2>Payment Breakdown</h2>
          <table>
            <thead><tr><th>Method</th><th>Total</th></tr></thead>
            <tbody>
              ${Object.entries(data.paymentBreakdown).map(([method, total]) => `<tr><td>${method}</td><td>$${(total as number).toFixed(2)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    fs.writeFileSync(filePath, html);
    return filePath;
  }

  private async generateCSVReport(data: any[], fileName: string): Promise<string> {
    const filePath = path.join(this.exportDir, fileName);

    if (data.length === 0) {
      fs.writeFileSync(filePath, 'No data available');
      return filePath;
    }

    const headers = ['receiptNumber', 'saleDate', 'customer', 'subtotal', 'tax', 'discount', 'total', 'paymentMethod'];
    const csvRows = [
      headers.join(','),
      ...data.map(sale => [
        sale.receiptNumber,
        sale.saleDate.toISOString(),
        sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Guest',
        sale.subtotal,
        sale.tax,
        sale.discount,
        sale.total,
        sale.payments[0]?.paymentMethod || 'N/A',
      ].join(',')),
    ];

    fs.writeFileSync(filePath, csvRows.join('\n'));
    return filePath;
  }
}

export const documentService = new DocumentService();
