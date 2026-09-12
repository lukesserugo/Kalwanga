// packages/backend/src/middleware/auditMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/auditService.js';
import { logger } from '../lib/logger.js';

export const auditMiddleware = (action: string, entityType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Guard so we only log ONCE per response, even though res.json
    // internally calls res.send.
    let logged = false;

    const logAudit = async (body: any, statusCode: number) => {
      if (logged) return;
      logged = true;

      // Only log successful operations
      if (statusCode < 200 || statusCode >= 300) return;

      try {
        const entityId =
          req.params?.id ||
          (body && typeof body === 'object' && body.data?.id) ||
          (body && typeof body === 'object' && body.id) ||
          req.body?.id;

        const payload =
          body && typeof body === 'object' && 'data' in body
            ? (body as any).data
            : body;

        await auditService.logAction(req, action, entityType, entityId, payload);
      } catch (error) {
        logger.error('Audit middleware failed to log action:', error);
        // Never block the response because of audit logging
      }
    };

    // Capture originals
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override res.json — this is the primary path for API responses
    res.json = function (body: any) {
      void logAudit(body, res.statusCode);
      return originalJson(body);
    };

    // Override res.send — handles CSV/string exports and any
    // response that bypasses res.json. The `logged` guard prevents
    // double-logging when res.json calls res.send internally.
    res.send = function (body: any) {
      if (typeof body === 'string') {
        // String body (CSV, HTML, plain text) — log a lightweight entry
        if (!logged) {
          logged = true;
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const entityId = req.params?.id || req.body?.id;
            auditService
              .logAction(req, action, entityType, entityId, { exported: true })
              .catch((err) => logger.error('Audit log failed:', err));
          }
        }
      } else {
        void logAudit(body, res.statusCode);
      }
      return originalSend(body);
    };

    next();
  };
};

export const auditCreate = (entityType: string) =>
  auditMiddleware('CREATE', entityType);
export const auditUpdate = (entityType: string) =>
  auditMiddleware('UPDATE', entityType);
export const auditDelete = (entityType: string) =>
  auditMiddleware('DELETE', entityType);
export const auditView = (entityType: string) =>
  auditMiddleware('VIEW', entityType);
export const auditExport = (entityType: string) =>
  auditMiddleware('EXPORT', entityType);
