// D:\Projects\Kalwanga\packages\web\utils\receiptGenerator.ts

import { formatCurrency } from './formatters';

export function generateReceiptHTML(order: any): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt #${order.receiptNumber}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            max-width: 350px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            color: #1a1a1a;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #333;
            padding-bottom: 15px;
            margin-bottom: 15px;
          }
          .header h1 {
            font-size: 24px;
            margin: 0;
          }
          .header p {
            margin: 5px 0;
            color: #666;
            font-size: 12px;
          }
          .items {
            margin: 15px 0;
          }
          .item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px dotted #eee;
            font-size: 13px;
          }
          .item .name {
            flex: 1;
          }
          .item .price {
            text-align: right;
            white-space: nowrap;
          }
          .totals {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px dashed #333;
          }
          .totals > div {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 13px;
          }
          .totals .grand-total {
            font-size: 18px;
            font-weight: bold;
            padding-top: 10px;
            border-top: 1px solid #333;
            margin-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px dashed #333;
            font-size: 11px;
            color: #666;
          }
          .payment-info {
            margin: 10px 0;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
            font-size: 12px;
          }
          .payment-info > div {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
          }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🧾 RECEIPT</h1>
          <p>#${order.receiptNumber}</p>
          <p>${new Date(order.createdAt).toLocaleString()}</p>
        </div>

        <div class="items">
          ${(order.items || []).map((item: any) => `
            <div class="item">
              <span class="name">${item.product?.name || 'Product'} × ${item.quantity}</span>
              <span class="price">${formatCurrency(item.total)}</span>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div><span>Subtotal</span><span>${formatCurrency(order.subtotal)}</span></div>
          <div><span>Tax</span><span>${formatCurrency(order.tax)}</span></div>
          ${order.discount > 0 ? `<div><span>Discount</span><span>-${formatCurrency(order.discount)}</span></div>` : ''}
          ${order.loyaltyDiscount > 0 ? `<div><span>Loyalty</span><span>-${formatCurrency(order.loyaltyDiscount)}</span></div>` : ''}
          <div class="grand-total"><span>TOTAL</span><span>${formatCurrency(order.total)}</span></div>
          <div><span>Paid</span><span>${formatCurrency(order.paidAmount || order.total)}</span></div>
          ${order.changeAmount > 0 ? `<div><span>Change</span><span>${formatCurrency(order.changeAmount)}</span></div>` : ''}
        </div>

        <div class="payment-info">
          <div><span>Payment Method</span><span>${order.paymentMethod?.toLowerCase().replace('_', ' ')}</span></div>
          ${order.customer?.name ? `<div><span>Customer</span><span>${order.customer.name}</span></div>` : ''}
          ${order.loyaltyPointsEarned > 0 ? `<div><span>Points Earned</span><span>+${order.loyaltyPointsEarned}</span></div>` : ''}
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>${new Date().toLocaleDateString()}</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">Print Receipt</button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
        </div>
      </body>
    </html>
  `;
}
