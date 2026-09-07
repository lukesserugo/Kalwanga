// D:\Projects\Kalwanga\packages\backend\src\routes\webhooks.ts

import { Router, Request, Response } from 'express';
import express from 'express';
import { stripeService } from '../services/stripeService.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ============================================
// WEBHOOK EVENT HANDLERS
// ============================================

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  logger.info(`Payment intent succeeded: ${paymentIntent.id}`);
  
  try {
    // Find payment by transaction ID
    const existingPayment = await prisma.payment.findFirst({
      where: { transactionId: paymentIntent.id },
      include: {
        sale: {
          include: {
            customer: true,
          },
        },
        order: true,
        user: true,
      },
    });

    if (existingPayment) {
      // Update payment status
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: 'PAID',
          processedAt: new Date(),
          gatewayId: paymentIntent.payment_method || undefined,
        },
      });

      // Update sale if exists
      if (existingPayment.saleId) {
        await updateSalePaymentStatus(existingPayment.saleId);
      }

      // Update order if exists
      if (existingPayment.orderId) {
        await updateOrderPaymentStatus(existingPayment.orderId);
      }

      // Create notification
      await createPaymentNotification(existingPayment, 'succeeded');

      // Update loyalty points if customer exists on sale
      if (existingPayment.sale?.customerId) {
        await updateCustomerLoyaltyPoints(
          existingPayment.sale.customerId, 
          existingPayment.amount
        );
      }
    } else {
      // Create new payment record if it doesn't exist
      await prisma.payment.create({
        data: {
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          paymentMethod: 'CREDIT_CARD',
          status: 'PAID',
          transactionId: paymentIntent.id,
          reference: paymentIntent.client_secret?.slice(0, 8) || paymentIntent.id,
          gatewayId: 'STRIPE',
          userId: paymentIntent.metadata?.userId || 'system',
          processedAt: new Date(),
          notes: `Stripe payment: ${paymentIntent.id}`,
        },
      });
    }

    // Update inventory if sale exists
    if (existingPayment?.saleId) {
      await updateInventoryAfterSale(existingPayment.saleId);
    }

  } catch (error) {
    logger.error('Error handling payment intent succeeded:', error);
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  logger.info(`Payment intent failed: ${paymentIntent.id}`);
  
  try {
    const payment = await prisma.payment.findFirst({
      where: { transactionId: paymentIntent.id },
      include: { user: true },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          notes: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
        },
      });

      await createPaymentNotification(payment, 'failed');
    }
  } catch (error) {
    logger.error('Error handling payment failed:', error);
  }
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(charge: any) {
  logger.info(`Charge refunded: ${charge.id}`);
  
  try {
    const payment = await prisma.payment.findFirst({
      where: { transactionId: charge.payment_intent },
      include: { sale: true },
    });

    if (payment) {
      const refundedAmount = charge.amount_refunded / 100;
      
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          notes: `Refunded via Stripe: ${charge.id}\nRefund amount: ${refundedAmount}`,
        },
      });

      if (payment.sale) {
        const newPaidAmount = Math.max(0, payment.sale.paidAmount - refundedAmount);
        await prisma.sale.update({
          where: { id: payment.sale.id },
          data: {
            paidAmount: newPaidAmount,
            status: newPaidAmount <= 0 ? 'REFUNDED' : 'PROCESSING',
          },
        });
      }

      await createPaymentNotification(payment, 'refunded');
    }
  } catch (error) {
    logger.error('Error handling charge refunded:', error);
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(session: any) {
  logger.info(`Checkout session completed: ${session.id}`);
  
  try {
    if (session.payment_intent) {
      const paymentIntent = await stripeService.getPaymentIntent(session.payment_intent);
      
      const existingPayment = await prisma.payment.findFirst({
        where: { transactionId: paymentIntent.id },
      });

      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            paymentMethod: 'CREDIT_CARD',
            status: 'PAID',
            transactionId: paymentIntent.id,
            reference: paymentIntent.client_secret?.slice(0, 8) || paymentIntent.id,
            gatewayId: 'STRIPE',
            userId: session.metadata?.userId || 'system',
            processedAt: new Date(),
            notes: `Checkout session: ${session.id}`,
          },
        });
      }
    }
  } catch (error) {
    logger.error('Error handling checkout session completed:', error);
  }
}

/**
 * Handle payment_method.attached event
 */
async function handlePaymentMethodAttached(paymentMethod: any) {
  logger.info(`Payment method attached: ${paymentMethod.id}`);
  
  try {
    if (paymentMethod.customer) {
      await prisma.$executeRaw`
        UPDATE "users" 
        SET "stripePaymentMethodId" = ${paymentMethod.id} 
        WHERE "stripeCustomerId" = ${paymentMethod.customer}
      `;
    }
  } catch (error) {
    logger.error('Error handling payment method attached:', error);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function updateSalePaymentStatus(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { payments: true },
  });

  if (!sale) return;

  const totalPaid = sale.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
  const status = totalPaid >= sale.total ? 'COMPLETED' : 'PROCESSING';

  await prisma.sale.update({
    where: { id: saleId },
    data: {
      paidAmount: totalPaid,
      paymentStatus: totalPaid >= sale.total ? 'PAID' : 'PARTIAL',
      status: status as any,
      updatedAt: new Date(),
    },
  });
}

async function updateOrderPaymentStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });

  if (!order) return;

  const totalPaid = order.payment?.amount || 0;
  const status = totalPaid >= order.total ? 'COMPLETED' : 'PROCESSING';

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: totalPaid >= order.total ? 'PAID' : 'PARTIAL',
      status: status as any,
      updatedAt: new Date(),
    },
  });
}

async function updateInventoryAfterSale(saleId: string) {
  try {
    const saleItems = await prisma.saleItem.findMany({
      where: { saleId },
    });

    for (const item of saleItems) {
      await prisma.inventory.updateMany({
        where: {
          product: { id: item.productId },
          variantId: item.variantId || null,
        },
        data: {
          quantity: { decrement: item.quantity },
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    logger.error('Error updating inventory after sale:', error);
  }
}

async function updateCustomerLoyaltyPoints(customerId: string, amount: number) {
  try {
    const pointsEarned = Math.floor(amount / 10);
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: { increment: pointsEarned },
        totalSpent: { increment: amount },
        lastPurchaseAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error updating loyalty points:', error);
  }
}

async function createPaymentNotification(payment: any, status: string) {
  try {
    const titles: Record<string, string> = {
      succeeded: '✅ Payment Successful',
      failed: '❌ Payment Failed',
      refunded: '🔄 Payment Refunded',
    };

    const messages: Record<string, string> = {
      succeeded: `Your payment of ${payment.amount} has been successfully processed.`,
      failed: `Your payment of ${payment.amount} failed. Please try again.`,
      refunded: `Your payment of ${payment.amount} has been refunded.`,
    };

    await prisma.notification.create({
      data: {
        title: titles[status] || `Payment ${status}`,
        message: messages[status] || `Payment status: ${status}`,
        type: 'PAYMENT',
        priority: status === 'failed' ? 'HIGH' : 'MEDIUM',
        userId: payment.userId,
        link: `/payments/${payment.id}`,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error creating payment notification:', error);
  }
}

// ============================================
// ROUTES
// ============================================

/**
 * Stripe webhook endpoint
 * POST /webhooks/stripe
 * This endpoint receives events from Stripe
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        logger.error('STRIPE_WEBHOOK_SECRET is not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
      }

      // Verify the webhook signature
      let event;
      try {
        event = stripeService.verifyWebhookSignature(
          req.body,
          signature,
          webhookSecret
        );
      } catch (err: any) {
        logger.error(`Webhook signature verification failed: ${err.message}`);
        return res.status(400).json({ error: 'Invalid signature' });
      }

      logger.info(`Stripe webhook received: ${event.type} (${event.id})`);

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object);
          break;
        case 'charge.refunded':
          await handleChargeRefunded(event.data.object);
          break;
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'payment_method.attached':
          await handlePaymentMethodAttached(event.data.object);
          break;
        default:
          logger.info(`Unhandled Stripe event: ${event.type}`);
      }

      // Acknowledge receipt of the event
      res.status(200).json({ received: true, event: event.type });
    } catch (error: any) {
      logger.error('Webhook error:', error);
      res.status(500).json({ error: error.message || 'Webhook processing failed' });
    }
  }
);

export default router;
