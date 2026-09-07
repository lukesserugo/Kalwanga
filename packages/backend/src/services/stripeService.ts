// D:\Projects\Kalwanga\packages\backend\src\services\stripeService.ts

import Stripe from 'stripe';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

export class StripeService {
  private stripe: Stripe | null = null;
  private static instance: StripeService;
  private isConfigured: boolean = false;

  private constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    
    // Log environment variable status (without exposing the key)
    console.log('🔍 Stripe Configuration Check:');
    console.log(`   STRIPE_SECRET_KEY exists: ${!!secretKey}`);
    console.log(`   STRIPE_SECRET_KEY length: ${secretKey?.length || 0}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    
    if (!secretKey || secretKey === 'your_stripe_secret_key_here' || secretKey === 'sk_test_dummy_key_for_development') {
      logger.warn('⚠️ STRIPE_SECRET_KEY is not properly set. Stripe features will be disabled.');
      logger.info('ℹ️ To enable Stripe, add a valid STRIPE_SECRET_KEY to your .env file');
      this.isConfigured = false;
      this.stripe = null;
    } else {
      try {
        this.stripe = new Stripe(secretKey, {
          apiVersion: '2023-10-16',
        });
        this.isConfigured = true;
        logger.info('✅ Stripe configured successfully');
        
        // Verify the key works (don't await in constructor, fire and forget)
        this.verifyStripeConnection();
      } catch (error) {
        logger.error('❌ Failed to initialize Stripe:', error);
        this.isConfigured = false;
        this.stripe = null;
      }
    }
  }

  /**
   * Verify Stripe connection by retrieving balance
   */
  private async verifyStripeConnection(): Promise<void> {
    try {
      if (this.stripe) {
        await this.stripe.balance.retrieve();
        logger.info('✅ Stripe connection verified successfully');
      }
    } catch (error) {
      logger.warn('⚠️ Stripe connection verification failed:', error);
      // Don't throw, just warn - the key might still work for some operations
    }
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  /**
   * Check if Stripe is configured
   */
  isStripeConfigured(): boolean {
    return this.isConfigured && this.stripe !== null;
  }

  /**
   * Get the Stripe client
   * @throws Error if Stripe is not configured
   */
  private getStripeClient(): Stripe {
    if (!this.isConfigured || !this.stripe) {
      throw new AppError('Stripe is not configured. Please set STRIPE_SECRET_KEY.', 503);
    }
    return this.stripe;
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(email: string, name: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          ...metadata,
          createdBy: 'kalwanga-pos',
        },
      });
      logger.info(`Stripe customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer:', error);
      throw new AppError('Failed to create Stripe customer', 500);
    }
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    customerId?: string;
    paymentMethodId?: string;
    metadata?: Record<string, string>;
    description?: string;
    confirm?: boolean;
  }): Promise<Stripe.PaymentIntent> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const { amount, currency, customerId, paymentMethodId, metadata, description, confirm = false } = params;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        customer: customerId,
        payment_method: paymentMethodId,
        metadata: {
          ...metadata,
          platform: 'kalwanga-pos',
        },
        description,
        confirm,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      });

      logger.info(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create payment intent:', error);
      throw new AppError('Failed to create payment intent', 500);
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);
      logger.info(`Payment intent confirmed: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to confirm payment intent:', error);
      throw new AppError('Failed to confirm payment intent', 500);
    }
  }

  /**
   * Create a refund
   */
  async createRefund(paymentIntentId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer',
      });
      logger.info(`Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      logger.error('Failed to create refund:', error);
      throw new AppError('Failed to create refund', 500);
    }
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Failed to retrieve payment intent:', error);
      throw new AppError('Failed to retrieve payment intent', 500);
    }
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(params: {
    lineItems: Array<{
      name: string;
      price: number;
      quantity: number;
      currency?: string;
      description?: string;
    }>;
    customerId?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const { lineItems, customerId, successUrl, cancelUrl, metadata } = params;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer: customerId,
        line_items: lineItems.map(item => ({
          price_data: {
            currency: (item.currency || 'usd').toLowerCase(),
            product_data: {
              name: item.name,
              description: item.description || '',
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          ...metadata,
          platform: 'kalwanga-pos',
        },
      });

      logger.info(`Checkout session created: ${session.id}`);
      return session;
    } catch (error) {
      logger.error('Failed to create checkout session:', error);
      throw new AppError('Failed to create checkout session', 500);
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      logger.info(`Payment method attached: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to attach payment method:', error);
      throw new AppError('Failed to attach payment method', 500);
    }
  }

  /**
   * Detach payment method from customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
      logger.info(`Payment method detached: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to detach payment method:', error);
      throw new AppError('Failed to detach payment method', 500);
    }
  }

  /**
   * List customer payment methods
   */
  async listCustomerPaymentMethods(
    customerId: string, 
    type: 'card' | 'us_bank_account' = 'card'
  ): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      return await stripe.paymentMethods.list({
        customer: customerId,
        type: type,
      });
    } catch (error) {
      logger.error('Failed to list payment methods:', error);
      throw new AppError('Failed to list payment methods', 500);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: Buffer, signature: string, webhookSecret: string): Stripe.Event {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  /**
   * Get the Stripe client instance
   */
  getClient(): Stripe | null {
    return this.stripe;
  }

  /**
   * Create a Setup Intent for saving payment methods
   */
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });
      logger.info(`Setup intent created: ${setupIntent.id}`);
      return setupIntent;
    } catch (error) {
      logger.error('Failed to create setup intent:', error);
      throw new AppError('Failed to create setup intent', 500);
    }
  }

  /**
   * Retrieve a payment method
   */
  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      return await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      logger.error('Failed to retrieve payment method:', error);
      throw new AppError('Failed to retrieve payment method', 500);
    }
  }

  /**
   * Update a payment method
   */
  async updatePaymentMethod(
    paymentMethodId: string, 
    params: Stripe.PaymentMethodUpdateParams
  ): Promise<Stripe.PaymentMethod> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const paymentMethod = await stripe.paymentMethods.update(paymentMethodId, params);
      logger.info(`Payment method updated: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to update payment method:', error);
      throw new AppError('Failed to update payment method', 500);
    }
  }

  /**
   * Create a payment method (for testing or specific use cases)
   */
  async createPaymentMethod(params: Stripe.PaymentMethodCreateParams): Promise<Stripe.PaymentMethod> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const paymentMethod = await stripe.paymentMethods.create(params);
      logger.info(`Payment method created: ${paymentMethod.id}`);
      return paymentMethod;
    } catch (error) {
      logger.error('Failed to create payment method:', error);
      throw new AppError('Failed to create payment method', 500);
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    if (!this.isStripeConfigured()) {
      throw new AppError('Stripe is not configured. Please add STRIPE_SECRET_KEY to .env', 503);
    }
    try {
      const stripe = this.getStripeClient();
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
      logger.info(`Payment intent cancelled: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to cancel payment intent:', error);
      throw new AppError('Failed to cancel payment intent', 500);
    }
  }
}

export const stripeService = StripeService.getInstance();
export default stripeService;
