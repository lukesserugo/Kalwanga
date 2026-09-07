// D:\Projects\Kalwanga\packages\backend\src\services\webhookService.ts

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { stripeService } from './stripeService.js';

export class WebhookService {
  /**
   * Handle payment_intent.succeeded
   */
  async handlePaymentIntentSucceeded(paymentIntent: any) {
    logger.info(`Payment intent succeeded: ${paymentIntent.id}`);
    
    // Update payment in database
    await prisma.payment.updateMany({
      where: {
        transactionId: paymentIntent.id,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      data: {
        status: 'PAID',
        processedAt: new Date(),
        customerId: paymentIntent.customer || undefined,
        gatewayId: paymentIntent.payment_method || undefined,
      },
    });

    // Find and update associated sale
    const payment = await prisma.payment.findFirst({
      where: { transactionId: paymentIntent.id },
      include: { sale: true },
    });

    if (payment?.sale) {
      await this.updateSalePaymentStatus(payment.sale.id);
    }
  }

  /**
   * Handle charge.refunded
   */
  async handleChargeRefunded(charge: any) {
    logger.info(`Charge refunded: ${charge.id}`);
    
    const payment = await prisma.payment.findFirst({
      where: { transactionId: charge.payment_intent },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          notes: `Refunded via Stripe: ${charge.id}`,
        },
      });
    }
  }

  /**
   * Update sale payment status
   */
  private async updateSalePaymentStatus(saleId: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true },
    });

    if (!sale) return;

    const totalPaid = sale.payments.reduce((acc, p) => acc + p.amount, 0);
    
    await prisma.sale.update({
      where: { id: saleId },
      data: {
        paidAmount: totalPaid,
        paymentStatus: totalPaid >= sale.total ? 'PAID' : 'PARTIAL',
        status: totalPaid >= sale.total ? 'COMPLETED' : 'PROCESSING',
      },
    });
  }
}

export const webhookService = new WebhookService();
