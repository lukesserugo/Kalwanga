// packages/backend/src/schemas/payment.ts (or wherever this file lives)

import { z } from 'zod';
import { paymentMethodSchema } from '../helpers.js';

/**
 * Body accepted by `POST /payments`.
 *
 * Mirrors `paymentController.processPaymentSchema` field-for-field.
 * A value that passes here must also pass there — the two schemas
 * validate the same request at two different layers, and a mismatch
 * produces a confusing 400 that names the wrong boundary.
 *
 * ⚠ The backend's `paymentService.processPayment` reads:
 *     - `currency`         — caller wins; else resolved from
 *                            `businessUnitId` → env → registry
 *                            default. Do NOT default to `'USD'`.
 *     - `businessUnitId`   — currency resolution hint.
 *     - `idempotencyKey`   — written to the `@unique`
 *                            `Payment.idempotencyKey` column; a
 *                            retry with the same key returns the
 *                            original Payment row.
 *     - `metadata`         — opaque; read by the mobile-money and
 *                            Square handlers (`provider`,
 *                            `phoneNumber`, `saleId`).
 *     - `tipAmount`        — added to the charged amount.
 *     - `savePaymentMethod`— attach the Stripe PM to the customer
 *                            after a successful card charge.
 */
export const createPaymentSchema = z
  .object({
    amount: z.number().finite().positive(),

    paymentMethod: paymentMethodSchema,

    saleId: z.string().max(64).optional(),
    orderId: z.string().max(64).optional(),

    /**
     * Free-form reference string recorded on the Payment row.
     * Capped because it lands in a `String` column and, in the
     * audit path, in a JSON blob.
     */
    reference: z.string().max(255).optional(),

    notes: z.string().max(2000).optional(),

    cashRegisterId: z.string().max(64).optional(),
    cashRegisterSessionId: z.string().max(64).optional(),

    /**
     * Stripe PaymentMethod id (`pm_xxx`) or an equivalent
     * gateway-side token. For Square, this is not used — send
     * `cardNonce` instead.
     */
    gatewayId: z.string().max(255).optional(),

    customerId: z.string().max(64).optional(),

    /**
     * Stripe token (`tok_xxx`) for a card charge without a saved
     * PaymentMethod. Historically used by the checkout page.
     */
    source: z.string().max(255).optional(),

    /**
     * Currency override.
     *
     * ⚠ When omitted, the backend resolves the currency from
     *   `businessUnitId` → `process.env.DEFAULT_CURRENCY` → the
     *   currency registry default (`'UGX'`). Do NOT default this
     *   to `'USD'` on the client or the schema — that bypasses the
     *   resolver and silently charges USD on a UGX deployment.
     *
     * Send a value only when the caller has a stronger source of
     * truth than the backend (e.g. the user explicitly picked a
     * currency in a multi-currency UI).
     */
    currency: z.string().max(8).optional(),

    tipAmount: z.number().finite().min(0).optional(),

    description: z.string().max(500).optional(),

    /**
     * Square Web SDK card nonce. Required by
     * `processPaymentSchema` when `paymentMethod === 'SQUARE'`.
     * Ignored for every other method.
     */
    cardNonce: z.string().max(500).optional(),

    /**
     * Business unit the payment belongs to.
     *
     * The backend reads this to resolve the currency when
     * `currency` is omitted. Omitting both is legal — the
     * resolver falls through to the platform default — but
     * supplying one is recommended on any deployment where the
     * business unit's own currency should win.
     */
    businessUnitId: z.string().max(64).optional(),

    /**
     * Idempotency key.
     *
     * The `Payment.idempotencyKey` column is `@unique`. Two
     * concurrent requests with the same key produce one Payment,
     * not two. Omit to have the backend derive a deterministic
     * key from the payment's salient fields.
     */
    idempotencyKey: z.string().max(128).optional(),

    /**
     * Whether to persist the card as a saved PaymentMethod on the
     * customer after a successful charge. Only meaningful for
     * Stripe card charges with a `gatewayId`.
     */
    savePaymentMethod: z.boolean().optional(),

    /**
     * Opaque metadata recorded on the Payment row.
     *
     * Keys the backend reads:
     *   - `provider`      — mobile-money network (MTN, AIRTEL,
     *                        TIGO, VODAFONE) for MOBILE_MONEY
     *                        requests. Required by the controller's
     *                        `.superRefine` when `paymentMethod`
     *                        is `MOBILE_MONEY`.
     *   - `phoneNumber`   — MSISDN for mobile-money requests.
     *                        Required by the controller's
     *                        `.superRefine` when `paymentMethod`
     *                        is `MOBILE_MONEY` or a direct network.
     *   - `saleId`        — Square webhook reads this when the
     *                        top-level `saleId` is absent.
     */
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
