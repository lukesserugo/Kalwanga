// packages/backend/src/middleware/auditMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/auditService.js';
import { logger } from '../lib/logger.js';

export const auditMiddleware = (action: string, entityType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Capture the original response json method
    const originalJson = res.json;
    const originalSend = res.send;

    // Helper to log audit
    const logAudit = async (body: any, statusCode: number) => {
      try {
        const entityId = req.params.id || body?.data?.id || body?.id || req.body?.id;
        
        // Only log successful operations
        if (statusCode >= 200 && statusCode < 300) {
          await auditService.logAction(req, action, entityType, entityId, body?.data || body);
        }
      } catch (error) {
        logger.error('Audit middleware failed to log action:', error);
        // Don't block the response if audit logging fails
      }
    };

    // Override res.json
    res.json = function(body: any) {
      const statusCode = res.statusCode;
      logAudit(body, statusCode);
      return originalJson.call(this, body);
    };

    // Override res.send (for CSV exports and other non-JSON responses)
    res.send = function(body: any) {
      const statusCode = res.statusCode;
      if (typeof body === 'string') {
        // For CSV or string responses, just log a simple entry
        const entityId = req.params.id || req.body?.id;
        auditService.logAction(req, action, entityType, entityId, { exported: true })
          .catch(err => logger.error('Audit log failed:', err));
      } else {
        logAudit(body, statusCode);
      }
      return originalSend.call(this, body);
    };

    next();
  };
};

// Specific audit middleware helpers
export const auditCreate = (entityType: string) => auditMiddleware('CREATE', entityType);
export const auditUpdate = (entityType: string) => auditMiddleware('UPDATE', entityType);
export const auditDelete = (entityType: string) => auditMiddleware('DELETE', entityType);
export const auditView = (entityType: string) => auditMiddleware('VIEW', entityType);
export const auditExport = (entityType: string) => auditMiddleware('EXPORT', entityType);
