// D:\Projects\Kalwanga\packages\backend\src\controllers\auditController.ts

import { Request, Response } from 'express';
import { auditService, AuditAction, AuditEntityType } from '../services/auditService.js';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const auditQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  businessUnitId: z.string().optional(),
  companyId: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  severity: z.string().optional(),
  search: z.string().optional(),
  hasBarcode: z.string().optional().transform(val => {
    if (val === 'true' || val === 'false') {
      return val === 'true';
    }
    return undefined;
  }),
});

const auditLogSchema = z.object({
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  entityName: z.string().optional(),
  changes: z.record(z.any()).optional(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  metadata: z.record(z.any()).optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractBarcodeFromChanges(changes: any): string | null {
  if (!changes) return null;
  if (typeof changes !== 'object') return null;
  
  if (changes.barcode && changes.barcode.new) {
    return changes.barcode.new;
  }
  if (changes.barcode && changes.barcode.value) {
    return changes.barcode.value;
  }
  
  for (const key of Object.keys(changes)) {
    const value = changes[key];
    if (value && typeof value === 'object') {
      if (value.new && typeof value.new === 'string' && /^\d{8,13}$/.test(value.new)) {
        return value.new;
      }
      if (value.value && typeof value.value === 'string' && /^\d{8,13}$/.test(value.value)) {
        return value.value;
      }
    }
  }
  return null;
}

function formatAuditEntry(entry: any): any {
  return {
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityName: entry.entityName,
    changes: entry.changes || {},
    userId: entry.userId,
    user: entry.user ? {
      id: entry.user.id,
      firstName: entry.user.firstName,
      lastName: entry.user.lastName,
      email: entry.user.email,
    } : null,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    severity: entry.severity,
    metadata: entry.metadata || {},
    createdAt: entry.createdAt,
    businessUnit: entry.businessUnit,
    company: entry.company,
    barcode: extractBarcodeFromChanges(entry.changes),
  };
}

// ============================================
// CONTROLLER
// ============================================

export const auditController = {
  /**
   * GET /audit
   * Get audit logs with pagination and filters
   */
  async getAuditLogs(req: Request, res: Response) {
    try {
      console.log('📤 GET /audit - Query params:', req.query);

      const validatedParams = auditQuerySchema.parse({
        ...req.query,
        businessUnitId: (req as any).user?.businessUnitId || req.query.businessUnitId,
        companyId: (req as any).user?.companyId || req.query.companyId,
      });

      const result = await auditService.getAuditLogs({
        page: validatedParams.page,
        limit: validatedParams.limit,
        action: validatedParams.action,
        entityType: validatedParams.entityType,
        entityId: validatedParams.entityId,
        userId: validatedParams.userId,
        businessUnitId: validatedParams.businessUnitId,
        companyId: validatedParams.companyId,
        startDate: validatedParams.startDate,
        endDate: validatedParams.endDate,
        severity: validatedParams.severity,
        search: validatedParams.search,
        hasBarcode: validatedParams.hasBarcode,
      });

      const formattedData = result.logs.map(formatAuditEntry);

      res.status(200).json({
        success: true,
        data: formattedData,
        total: result.total,
        page: validatedParams.page || 1,
        totalPages: Math.ceil(result.total / (validatedParams.limit || 20)),
        limit: validatedParams.limit || 20,
      });
    } catch (error) {
      console.error('❌ Error in getAuditLogs:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit logs',
        error: process.env.NODE_ENV === 'development' ? error : undefined,
      });
    }
  },

  /**
   * GET /audit/:id
   * Get a single audit log entry
   */
  async getAuditLogById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Audit log ID is required',
        });
      }

      const entry = await auditService.getAuditLogById(id);

      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Audit log entry not found',
        });
      }

      res.status(200).json({
        success: true,
        data: formatAuditEntry(entry),
      });
    } catch (error) {
      console.error('❌ Error in getAuditLogById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit log entry',
      });
    }
  },

  /**
   * GET /audit/stats
   * Get audit statistics
   */
  async getAuditStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const companyId = (req as any).user?.companyId || req.query.companyId as string;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      const stats = await auditService.getAuditStats(
        companyId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('❌ Error in getAuditStats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit statistics',
      });
    }
  },

  /**
   * GET /audit/export
   * Export audit logs
   */
  async exportAuditLogs(req: Request, res: Response) {
    try {
      const { format = 'csv', ...filters } = req.query;
      const businessUnitId = (req as any).user?.businessUnitId || req.query.businessUnitId as string;

      const validatedParams = auditQuerySchema.parse({
        ...filters,
        businessUnitId,
        companyId: (req as any).user?.companyId,
      });

      // Get all data
      const result = await auditService.getAuditLogs({
        ...validatedParams,
        limit: 10000,
      });

      const exportData = result.logs.map((entry: any) => ({
        'Date': new Date(entry.createdAt).toLocaleString(),
        'Action': entry.action,
        'Entity Type': entry.entityType,
        'Entity Name': entry.entityName || '',
        'User': entry.user ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() : 'System',
        'Severity': entry.severity || 'INFO',
        'Changes': JSON.stringify(entry.changes || {}),
        'Barcode': extractBarcodeFromChanges(entry.changes) || '',
        'IP Address': entry.ipAddress || '',
        'User Agent': entry.userAgent || '',
      }));

      if (format === 'csv') {
        const headers = Object.keys(exportData[0] || {});
        let csv = headers.join(',') + '\n';
        
        exportData.forEach((row: any) => {
          const values = headers.map(header => {
            const value = row[header] || '';
            const escaped = String(value).replace(/"/g, '""');
            return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
          });
          csv += values.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
        return res.send(csv);
      }

      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().slice(0, 10)}.json`);
      res.json({
        success: true,
        data: exportData,
        total: exportData.length,
        exportedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Error in exportAuditLogs:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to export audit logs',
      });
    }
  },

  /**
   * POST /audit
   * Create an audit log entry (internal)
   */
  async createAuditLog(req: Request, res: Response) {
    try {
      const validatedData = auditLogSchema.parse(req.body);

      // Get user from request (set by auth middleware)
      const user = (req as any).user;
      
      // FIX: Use userId from the authenticated user, not from validatedData
      // The userId should come from the authenticated user, not from the request body
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      // Use the auditService.logAction method with the authenticated user
      // Pass the request object to capture IP and user agent
      await auditService.logAction(
        req,
        validatedData.action,
        validatedData.entityType,
        validatedData.entityId,
        validatedData.changes || null,
        {
          ...validatedData.metadata,
          entityName: validatedData.entityName,
          severity: validatedData.severity,
        }
      );

      res.status(201).json({
        success: true,
        message: 'Audit log created successfully',
      });
    } catch (error) {
      console.error('❌ Error in createAuditLog:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create audit log',
        error: process.env.NODE_ENV === 'development' ? error : undefined,
      });
    }
  },

  /**
   * GET /audit/entity/:entityType/:entityId
   * Get audit logs for a specific entity
   */
  async getAuditLogsByEntity(req: Request, res: Response) {
    try {
      const { entityType, entityId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      if (!entityType || !entityId) {
        return res.status(400).json({
          success: false,
          message: 'Entity type and ID are required',
        });
      }

      const logs = await auditService.getAuditLogsByEntity(entityType, entityId, limit);

      res.status(200).json({
        success: true,
        data: logs.map(formatAuditEntry),
        count: logs.length,
      });
    } catch (error) {
      console.error('❌ Error in getAuditLogsByEntity:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit logs for entity',
      });
    }
  },

  /**
   * GET /audit/recent
   * Get recent audit logs for dashboard
   */
  async getRecentAuditLogs(req: Request, res: Response) {
    try {
      const companyId = (req as any).user?.companyId || req.query.companyId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: 'Company ID is required',
        });
      }

      const logs = await auditService.getRecentAuditLogs(companyId, limit);

      res.status(200).json({
        success: true,
        data: logs.map(formatAuditEntry),
        count: logs.length,
      });
    } catch (error) {
      console.error('❌ Error in getRecentAuditLogs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent audit logs',
      });
    }
  },
};

export default auditController;
