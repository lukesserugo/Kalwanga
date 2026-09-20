// D:\Projects\Kalwanga\packages\backend\src\middleware\validateRequest.ts

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

// ============================================
// REQUEST VALIDATION MIDDLEWARE
// ============================================
//
// Accepts either:
//   1. A "wrapper" schema whose top-level keys are `body`, `query`,
//      `params` — e.g. `z.object({ body: ..., query: ..., params: ... })`.
//      In that case the request is validated as a whole and each part
//      is parsed together.
//
//   2. A plain schema that describes the request body directly —
//      e.g. `z.object({ cartId: ..., paymentMethod: ... })`.
//      In that case only `req.body` is validated.
//
// The distinction is made by inspecting the schema's top-level shape.
// If it contains any of the three reserved keys, we treat it as a
// wrapper; otherwise we assume it describes the body.
//
// ⚠ DIAGNOSTIC LOGGING
//
// Every invocation logs the method, URL, content-type, and the actual
// keys present on `req.body`. This is the single most useful signal
// when a downstream 400 reports "Required" on a field the client
// swears it sent — either the body was never parsed (bodyKeys is null
// or []) or the schema being parsed isn't the one the route thinks it
// is (bodyKeys populated but Zod still fails).
//
// The logs are cheap, only run on requests that reach a validated
// route, and are safe to keep on in production. If they become too
// noisy, gate them behind `process.env.DEBUG_VALIDATION === '1'`.

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // ── Diagnostic entry log ──────────────────────────────────────
    //
    // Reads `req.body` without mutating it. The `typeof` check
    // distinguishes "body parser ran and gave us an object" from
    // "body parser never ran and req.body is undefined" — the two
    // produce identical Zod failures but have completely different
    // root causes.
    //
    // `Object.keys(req.body)` on an object that has a null prototype
    // (which `express.json()` never produces, but a custom parser
    // might) throws. The try/catch guards against that so the log
    // itself can never crash a request.
    try {
      const contentType = req.headers['content-type'] ?? '<none>';
      const contentLength = req.headers['content-length'] ?? '<none>';

      let bodyType: string = typeof req.body;
      let bodyKeys: string[] | null = null;
      let bodyPreview = '<unavailable>';

      if (req.body !== null && req.body !== undefined) {
        if (typeof req.body === 'object') {
          bodyKeys = Object.keys(req.body);
          try {
            bodyPreview = JSON.stringify(req.body).slice(0, 500);
          } catch {
            bodyPreview = '<unserializable>';
          }
        } else {
          bodyPreview = String(req.body).slice(0, 200);
        }
      }

      console.log(
        `[validateRequest] ${req.method} ${req.originalUrl} ` +
          `ct=${contentType} cl=${contentLength} ` +
          `bodyType=${bodyType} ` +
          `bodyKeys=${bodyKeys === null ? 'null' : `[${bodyKeys.join(',')}]`}`,
      );

      if (bodyType !== 'object' || bodyKeys === null || bodyKeys.length === 0) {
        // This is the exact condition that produces
        // `- cartId: Required (undefined)` and its siblings. Emit a
        // loud, unambiguous line so the source is obvious in the log.
        console.warn(
          `[validateRequest] ⚠ EMPTY OR MISSING BODY on ${req.method} ${req.originalUrl}. ` +
            `preview=${bodyPreview}`,
        );
      }
    } catch (logErr) {
      // Never let a logging failure break the request.
      console.warn('[validateRequest] failed to log request body:', logErr);
    }

    // ── Validation ───────────────────────────────────────────────
    try {
      // Check if schema expects wrapper (body, query, params) or
      // just the body.
      const schemaShape = (schema as any).shape || {};
      const expectsWrapper =
        'body' in schemaShape ||
        'query' in schemaShape ||
        'params' in schemaShape;

      if (expectsWrapper) {
        // Schema expects { body, query, params } structure.
        await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
      } else {
        // Schema expects just the body.
        await schema.parseAsync(req.body);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
