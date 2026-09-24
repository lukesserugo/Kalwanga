// D:\Projects\Kalwanga\packages\backend\src\services\stripeService.ts

import Stripe from 'stripe';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';

// ============================================
// TYPES
// ============================================

interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  metadata?: Record<string, string>;
  description?: string;
  confirm?: boolean;
  /** Forwarded to Stripe so retries don't double-charge. */
  idempotencyKey?: string;
  /** Pass `true` to omit `automatic_payment_methods`. Rarely needed. */
  skipAutomaticPaymentMethods?: boolean;
}

interface CreateRefundParams {
  amount?: number;
  reason?: string;
  /** Forwarded to Stripe so retries don't double-refund. */
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

interface GetOrCreateCustomerParams {
  /** Existing Stripe customer id, if any. Verified before use. */
  storedCustomerId?: string | null;
  email: string;
  name: string;
  metadata?: Record<string, string>;
  /** Called with the fresh id when we create a new customer. */
  onCustomerCreated?: (customerId: string) => Promise<void>;
  /** Called when the stored id was stale and has been replaced. */
  onStaleCustomerCleared?: () => Promise<void>;
}

// Placeholder keys that must be rejected, even though they "look"
// like real keys.
const PLACEHOLDER_KEYS = new Set<string>([
  '',
  'your_stripe_secret_key_here',
  'sk_test_dummy_key_for_development',
  'sk_test_xxx',
  'sk_live_xxx',
]);

// ============================================
// SERVICE
// ============================================

export class StripeService {
  private stripe: Stripe | null = null;
  private static instance: StripeService;
  private isConfigured: boolean = false;

  private constructor() {
    const secretKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();

    // Reject missing keys and known placeholders.
    if (!secretKey || PLACEHOLDER_KEYS.has(secretKey)) {
      logger.warn(
        '⚠️ STRIPE_SECRET_KEY is not properly set. Stripe features will be disabled.',
      );
      logger.info(
        'ℹ️ To enable Stripe, add a valid STRIPE_SECRET_KEY (sk_test_... or sk_live_...) to packages/backend/.env',
      );
      this.isConfigured = false;
      this.stripe = null;
      return;
    }

    // Reject obviously-wrong prefixes. Stripe secret keys always
    // start with `sk_test_` or `sk_live_`. Catching this early
    // avoids a confusing `authentication_error` later.
    //
    // Only the first 8 characters are logged, which for a valid
    // key is exactly the prefix `sk_test_` or `sk_live_` — never
    // enough to reconstruct the key. We log it only on the error
    // path so a valid run produces no key material in the logs.
    if (
      !secretKey.startsWith('sk_test_') &&
      !secretKey.startsWith('sk_live_')
    ) {
      logger.error(
        `❌ STRIPE_SECRET_KEY has an unexpected prefix (${secretKey.slice(
          0,
          8,
        )}...). Expected sk_test_... or sk_live_.... Stripe features will be disabled.`,
      );
      this.isConfigured = false;
      this.stripe = null;
      return;
    }

    try {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2023-10-16',
        // Identify our app to Stripe. Helps with rate-limit triage.
        appInfo: {
          name: 'Kalwanga POS',
          version: '1.0.0',
        },
      });
      this.isConfigured = true;
      logger.info('✅ Stripe configured successfully');

      // Verify the key works. Fire-and-forget — the constructor
      // should not block on a network call.
      void this.verifyStripeConnection();
    } catch (error) {
      logger.error('❌ Failed to initialize Stripe:', error);
      this.isConfigured = false;
      this.stripe = null;
    }
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  // ============================================
  // CONNECTION & CONFIGURATION
  // ============================================

  /**
   * Verify the key works by fetching the account balance.
   *
   * Runs once at boot. Warns on failure — does not throw, since
   * restricted keys may fail this endpoint while still working for
   * payment intents.
   */
  private async verifyStripeConnection(): Promise<void> {
    try {
      if (!this.stripe) return;
      await this.stripe.balance.retrieve();
      logger.info('✅ Stripe connection verified successfully');
    } catch (error: any) {
      logger.warn(
        '⚠️ Stripe connection verification failed:',
        error?.message || error,
      );
    }
  }

  isStripeConfigured(): boolean {
    return this.isConfigured && this.stripe !== null;
  }

  /**
   * Get the underlying Stripe client. Returns `null` when Stripe
   * isn't configured. Callers that need to throw should call
   * `requireClient()` instead.
   */
  getClient(): Stripe | null {
    return this.stripe;
  }

  /**
   * Get the Stripe client, throwing a clear 503 if not configured.
   */
  private getStripeClient(): Stripe {
    if (!this.isConfigured || !this.stripe) {
      throw new AppError(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY in packages/backend/.env.',
        503,
      );
    }
    return this.stripe;
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  /**
   * Translate a Stripe SDK error into an AppError with the correct
   * status code and message.
   *
   *   400  invalid_request_error        (bad params)
   *   401  authentication_error         (bad key)
   *   402  card_error                   (declined)
   *   404  resource_missing             (stale id)
   *   409  resource_missing on customer (stale customer — retry)
   *   429  rate_limit_error
   *   5xx  api_error                    (Stripe outage)
   *   502  anything else
   */
  private wrapStripeError(
    error: any,
    context: string,
    fallbackMessage: string,
  ): AppError {
    const message =
      error?.raw?.message || error?.message || fallbackMessage;

    const code = error?.code || error?.raw?.code;
    const type = error?.type || error?.rawType || error?.raw?.type;
    const param = error?.param || error?.raw?.param;
    const statusCode = error?.statusCode || error?.raw?.statusCode;

    logger.error(`Stripe error in ${context}:`, {
      message,
      code,
      type,
      param,
      statusCode,
      requestId: error?.requestId || error?.raw?.requestId,
    });

    // Special case: stale customer id. Return a 409 so the caller
    // (or the frontend) knows a retry with a fresh customer is the
    // right next step.
    if (code === 'resource_missing' && param === 'customer') {
      return new AppError(
        'Your saved payment profile is out of date. Please try again.',
        409,
      );
    }

    if (statusCode && statusCode >= 400 && statusCode < 600) {
      return new AppError(message, statusCode);
    }

    if (type === 'authentication_error') {
      return new AppError(
        'Payment provider is misconfigured. Please contact support.',
        503,
      );
    }

    if (type === 'card_error') {
      return new AppError(message, 400);
    }

    return new AppError(message, 502);
  }

  // ============================================
  // CUSTOMER OPERATIONS
  // ============================================

  /**
   * Check whether a Stripe customer id still exists.
   *
   * Returns `true` when the id is valid, `false` when Stripe reports
   * `resource_missing`. Any other error is re-thrown so we don't
   * accidentally mask a real network problem.
   */
  async customerExists(customerId: string): Promise<boolean> {
    const stripe = this.getStripeClient();
    if (!customerId) return false;

    try {
      await stripe.customers.retrieve(customerId);
      return true;
    } catch (error: any) {
      const code = error?.code || error?.raw?.code;
      const statusCode = error?.statusCode || error?.raw?.statusCode;

      if (code === 'resource_missing' || statusCode === 404) {
        return false;
      }

      logger.warn(
        `Unexpected error while verifying Stripe customer ${customerId}:`,
        error?.message || error,
      );
      throw error;
    }
  }

  /**
   * Get an existing Stripe customer, or create one.
   *
   * The `storedCustomerId` is verified against Stripe before use.
   * If it's stale (deleted, or from a different Stripe account),
   * it's discarded and a fresh customer is created. The caller is
   * notified via `onCustomerCreated` / `onStaleCustomerCleared` so
   * it can persist the new id.
   *
   * This is the pattern every caller should use. Passing a stored
   * id directly to `createPaymentIntent({ customerId })` is what
   * produces the `resource_missing` error.
   */
  async getOrCreateCustomer(
    params: GetOrCreateCustomerParams,
  ): Promise<Stripe.Customer> {
    const stripe = this.getStripeClient();
    const {
      storedCustomerId,
      email,
      name,
      metadata,
      onCustomerCreated,
      onStaleCustomerCleared,
    } = params;

    // ── Path A: verify a stored id ─────────────────────────────
    if (storedCustomerId) {
      const stillExists = await this.customerExists(storedCustomerId);
      if (stillExists) {
        try {
          const customer = (await stripe.customers.retrieve(
            storedCustomerId,
          )) as Stripe.Customer;
          return customer;
        } catch (error: any) {
          // Race condition: customer was deleted between the check
          // and the retrieve. Fall through to the create path.
          logger.warn(
            `Customer ${storedCustomerId} deleted mid-flight — recreating`,
          );
        }
      }

      logger.warn(
        `Stale Stripe customer ${storedCustomerId} — creating a fresh one`,
      );
      if (onStaleCustomerCleared) {
        try {
          await onStaleCustomerCleared();
        } catch (err) {
          logger.warn('onStaleCustomerCleared callback failed:', err);
        }
      }
    }

    // ── Path B: create a new customer ─────────────────────────
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        ...metadata,
        createdBy: 'kalwanga-pos',
      },
    });

    logger.info(`Stripe customer created: ${customer.id}`);

    if (onCustomerCreated) {
      try {
        await onCustomerCreated(customer.id);
      } catch (err) {
        logger.warn('onCustomerCreated callback failed:', err);
      }
    }

    return customer;
  }

  /**
   * Create a Stripe customer.
   *
   * For the checkout flow, prefer `getOrCreateCustomer`, which also
   * verifies and replaces a stale stored id.
   */
  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
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
      throw this.wrapStripeError(
        error,
        'createCustomer',
        'Failed to create Stripe customer',
      );
    }
  }

  /**
   * Retrieve a Stripe customer.
   */
  async retrieveCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const stripe = this.getStripeClient();
      return (await stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'retrieveCustomer',
        'Failed to retrieve Stripe customer',
      );
    }
  }

  // ============================================
  // PAYMENT INTENTS
  // ============================================

  /**
   * Create a payment intent.
   *
   * ⚠ If you pass a `customerId`, make sure it exists in Stripe. The
   *   recommended way is to resolve the customer via
   *   `getOrCreateCustomer()` first, which verifies it. Passing a
   *   stale id produces `resource_missing` from Stripe.
   *
   * ⚠ The Stripe SDK treats the second argument to
   *   `paymentIntents.create` as an options object only when it's
   *   present AND has at least one recognized key. Passing `{}`
   *   throws `Stripe: Unknown arguments ([object Object])`. We
   *   pass `undefined` when there are no options.
   */
  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = this.getStripeClient();
      const {
        amount,
        currency,
        customerId,
        paymentMethodId,
        metadata,
        description,
        confirm = false,
        idempotencyKey,
        skipAutomaticPaymentMethods = false,
      } = params;

      if (!amount || amount <= 0) {
        throw new AppError('Amount must be positive', 400);
      }

      const amountInCents = Math.round(amount * 100);
      if (amountInCents < 50) {
        throw new AppError(
          `Amount is too small. Minimum is 0.50 ${currency.toUpperCase()}.`,
          400,
        );
      }

      const createParams: Stripe.PaymentIntentCreateParams = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        customer: customerId,
        payment_method: paymentMethodId,
        metadata: {
          ...metadata,
          platform: 'kalwanga-pos',
        },
        description,
        confirm,
      };

      // When confirming with a specific payment method, restrict
      // the available payment methods. Otherwise Stripe refuses to
      // confirm server-side with automatic methods enabled.
      if (paymentMethodId) {
        createParams.payment_method_types = ['card'];
        createParams.confirm = true;
      } else if (!skipAutomaticPaymentMethods) {
        createParams.automatic_payment_methods = {
          enabled: true,
          allow_redirects: 'never',
        };
      }

      // ⚠ Pass `undefined` rather than `{}` when there are no
      //   options. An empty object triggers "Unknown arguments".
      const paymentIntent = await stripe.paymentIntents.create(
        createParams,
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      logger.info(
        `Payment intent created: ${paymentIntent.id} (${paymentIntent.status})`,
      );
      return paymentIntent;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw this.wrapStripeError(
        error,
        'createPaymentIntent',
        'Failed to create payment intent',
      );
    }
  }

  /**
   * Confirm a payment intent.
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = this.getStripeClient();
      const paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntentId,
      );
      logger.info(`Payment intent confirmed: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'confirmPaymentIntent',
        'Failed to confirm payment intent',
      );
    }
  }

  /**
   * Cancel a payment intent.
   */
  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = this.getStripeClient();
      const paymentIntent = await stripe.paymentIntents.cancel(
        paymentIntentId,
      );
      logger.info(`Payment intent cancelled: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'cancelPaymentIntent',
        'Failed to cancel payment intent',
      );
    }
  }

  /**
   * Retrieve a payment intent.
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = this.getStripeClient();
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'getPaymentIntent',
        'Failed to retrieve payment intent',
      );
    }
  }

  // ============================================
  // REFUNDS
  // ============================================

  /**
   * Create a refund.
   *
   * Supports both the legacy signature `(paymentIntentId, amount,
   * reason)` and the newer signature `(paymentIntentId, { ... })`.
   *
   * ⚠ Pass `undefined` rather than `{}` as the options argument
   *   when there's no idempotency key.
   */
  async createRefund(
    paymentIntentId: string,
    amountOrParams?: number | CreateRefundParams,
    reason?: string,
  ): Promise<Stripe.Refund> {
    try {
      const stripe = this.getStripeClient();

      // Normalize the two signatures into one shape.
      let params: CreateRefundParams;
      if (typeof amountOrParams === 'object' && amountOrParams !== null) {
        params = amountOrParams;
      } else {
        params = {
          amount: amountOrParams,
          reason,
        };
      }

      const createParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        amount: params.amount
          ? Math.round(params.amount * 100)
          : undefined,
        reason:
          (params.reason as Stripe.RefundCreateParams.Reason) ||
          'requested_by_customer',
        metadata: params.metadata,
      };

      const refund = await stripe.refunds.create(
        createParams,
        params.idempotencyKey
          ? { idempotencyKey: params.idempotencyKey }
          : undefined,
      );

      logger.info(`Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'createRefund',
        'Failed to create refund',
      );
    }
  }

  // ============================================
  // CHECKOUT SESSIONS
  // ============================================

  /**
   * Create a hosted Checkout session.
   *
   * ⚠ Pass `undefined` rather than `{}` as the options argument
   *   when there's no idempotency key.
   */
  async createCheckoutSession(params: {
    lineItems: Array<{
      name: string;
      price: number;
      quantity: number;
      currency?: string;
      description?: string;
      images?: string[];
    }>;
    customerId?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<Stripe.Checkout.Session> {
    try {
      const stripe = this.getStripeClient();
      const {
        lineItems,
        customerId,
        successUrl,
        cancelUrl,
        metadata,
        idempotencyKey,
      } = params;

      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ['card'],
          customer: customerId,
          line_items: lineItems.map((item) => ({
            price_data: {
              currency: (item.currency || 'usd').toLowerCase(),
              product_data: {
                name: item.name,
                description: item.description || '',
                images: item.images,
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
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      logger.info(`Checkout session created: ${session.id}`);
      return session;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'createCheckoutSession',
        'Failed to create checkout session',
      );
    }
  }

  // ============================================
  // PAYMENT METHODS
  // ============================================

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const stripe = this.getStripeClient();
      const paymentMethod = await stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: customerId },
      );
      logger.info(`Payment method attached: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'attachPaymentMethod',
        'Failed to attach payment method',
      );
    }
  }

  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const stripe = this.getStripeClient();
      const paymentMethod = await stripe.paymentMethods.detach(
        paymentMethodId,
      );
      logger.info(`Payment method detached: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'detachPaymentMethod',
        'Failed to detach payment method',
      );
    }
  }

  async listCustomerPaymentMethods(
    customerId: string,
    type: 'card' | 'us_bank_account' = 'card',
  ): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    try {
      const stripe = this.getStripeClient();
      return await stripe.paymentMethods.list({
        customer: customerId,
        type,
      });
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'listCustomerPaymentMethods',
        'Failed to list payment methods',
      );
    }
  }

  async getPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const stripe = this.getStripeClient();
      return await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'getPaymentMethod',
        'Failed to retrieve payment method',
      );
    }
  }

  async updatePaymentMethod(
    paymentMethodId: string,
    params: Stripe.PaymentMethodUpdateParams,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const stripe = this.getStripeClient();
      const paymentMethod = await stripe.paymentMethods.update(
        paymentMethodId,
        params,
      );
      logger.info(`Payment method updated: ${paymentMethodId}`);
      return paymentMethod;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'updatePaymentMethod',
        'Failed to update payment method',
      );
    }
  }

  async createPaymentMethod(
    params: Stripe.PaymentMethodCreateParams,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const stripe = this.getStripeClient();
      const paymentMethod = await stripe.paymentMethods.create(params);
      logger.info(`Payment method created: ${paymentMethod.id}`);
      return paymentMethod;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'createPaymentMethod',
        'Failed to create payment method',
      );
    }
  }

  // ============================================
  // SETUP INTENTS
  // ============================================

  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const stripe = this.getStripeClient();
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });
      logger.info(`Setup intent created: ${setupIntent.id}`);
      return setupIntent;
    } catch (error) {
      throw this.wrapStripeError(
        error,
        'createSetupIntent',
        'Failed to create setup intent',
      );
    }
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Verify a webhook signature.
   *
   * ⚠ The `payload` MUST be the raw request body buffer, not a
   *   parsed JSON object. If Express's JSON body parser runs first,
   *   this will always fail with "No signatures found matching the
   *   expected signature". See `app.ts` for the raw-body mount.
   */
  verifyWebhookSignature(
    payload: Buffer | string,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    try {
      const stripe = this.getStripeClient();

      if (!webhookSecret) {
        throw new AppError(
          'Stripe webhook secret is not configured.',
          500,
        );
      }

      return stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error('Webhook signature verification failed:', {
        message: error?.message,
      });
      throw new AppError('Invalid webhook signature', 400);
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const stripeService = StripeService.getInstance();
export default stripeService;
