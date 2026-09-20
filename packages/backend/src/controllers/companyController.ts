// D:\Projects\Kalwanga\packages\backend\src\controllers\companyController.ts

import { Request, Response, NextFunction } from 'express';
import { companyService } from '../services/companyService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(1, 'Phone number is required'),
  address: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  logo: z.string().optional(),
  isActive: z.boolean().optional(),
  // Business unit fields for creation
  businessUnitName: z.string().optional(),
  businessUnitCode: z.string().optional(),
  businessUnitType: z.string().optional(),
});

const updateCompanySchema = createCompanySchema.partial();

const companyQuerySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  search: z.string().optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const businessUnitSchema = z.object({
  name: z.string().min(1, 'Business unit name is required'),
  code: z.string().min(1, 'Business unit code is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  type: z.string().optional(),
});

const searchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
});

const activityQuerySchema = z.object({
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// ============================================
// AUTH HELPERS
// ============================================

/**
 * Extract the authenticated user's ID from the request.
 *
 * The auth middleware augments `req.user` globally, but
 * different deployments populate `id` vs `userId`. We accept
 * both, plus a raw `req.userId` fallback, so this controller
 * works regardless of how the middleware is wired.
 *
 * Returns `undefined` if the route is unauthenticated (which
 * shouldn't happen on POST /companies — the route is behind
 * requireAuth — but we don't want to crash if it is).
 */
function getAuthUserId(req: Request): string | undefined {
  const r = req as any;
  return r.user?.id ?? r.user?.userId ?? r.userId ?? undefined;
}

// ============================================
// CONTROLLER
// ============================================

export const companyController = {
  /**
   * GET /companies
   * Get all companies with pagination and filtering
   */
  async getAllCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const params = companyQuerySchema.parse(req.query);

      console.log('📤 GET /companies - Query params:', params);

      const result = await companyService.getAllCompanies({
        page: params.page,
        limit: params.limit,
        search: params.search,
        isActive: params.isActive,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      });

      res.json({
        success: true,
        data: result.companies,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Validation error:', error.errors);
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/:id
   * Get company by ID with full details
   */
  async getCompanyById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      console.log(`📤 GET /companies/${id}`);

      const company = await companyService.getCompanyById(id);

      res.json({
        success: true,
        data: company
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/email/:email
   * Get company by email
   */
  async getCompanyByEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;
      console.log(`📤 GET /companies/email/${email}`);

      const company = await companyService.getCompanyByEmail(email);

      res.json({
        success: true,
        data: company
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/default
   * Get or create default company
   */
  async getOrCreateDefaultCompany(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📤 GET /companies/default');

      const company = await companyService.getOrCreateDefaultCompany();

      res.json({
        success: true,
        data: company,
        message: 'Default company retrieved successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 500;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/:id/default-business-unit
   * Get the default business unit for a company
   */
  async getDefaultBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Company ID is required', 400);
      }

      console.log(`📤 GET /companies/${id}/default-business-unit`);

      const defaultBusinessUnit = await companyService.getDefaultBusinessUnit(id);

      res.json({
        success: true,
        data: defaultBusinessUnit,
        message: defaultBusinessUnit ? 'Default business unit found' : 'No active business units found',
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/:id/stats
   * Get company statistics
   */
  async getCompanyStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      console.log(`📤 GET /companies/${id}/stats`);

      const stats = await companyService.getCompanyStats(id);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/:id/activity
   * Get company activity feed
   */
  async getCompanyActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const params = activityQuerySchema.parse(req.query);

      console.log(`📤 GET /companies/${id}/activity`);

      const activity = await companyService.getCompanyActivity(id, {
        limit: params.limit,
        offset: params.offset,
      });

      res.json({
        success: true,
        data: activity.activities,
        pagination: {
          total: activity.total,
          limit: activity.limit,
          offset: activity.offset,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/search
   * Search companies
   */
  async searchCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const params = searchQuerySchema.parse(req.query);

      console.log('📤 GET /companies/search - Query:', params);

      const result = await companyService.searchCompanies({
        query: params.query,
        page: params.page,
        limit: params.limit,
        isActive: params.isActive,
      });

      res.json({
        success: true,
        data: result.companies,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 400;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /companies
   * Create a new company with optional business unit.
   *
   * ⭐ CRITICAL FOR ONBOARDING:
   * We pass the authenticated user's ID to the service so it
   * can set `user.companyId = company.id` after creating the
   * company. Without this linkage, `resolveContext` in the
   * onboarding controller can never resolve a companyId for
   * this user, and every downstream step probe (settings,
   * sales settings, business unit, etc.) will short-circuit
   * to false. This is what makes step 2+ auto-advance work.
   */
  async createCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCompanySchema.parse(req.body);

      // ⭐ Extract the caller's user ID. The onboarding pipeline
      // depends on this being passed through to the service so
      // that user.companyId gets linked.
      const userId = getAuthUserId(req);

      console.log('📤 POST /companies - Body:', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        businessUnitName: data.businessUnitName,
        createdByUserId: userId ?? '(unauthenticated)',
      });

      // ⭐ Pass userId as the second argument. The service will
      // create the company AND link it to the user in a single
      // transaction.
      const company = await companyService.createCompany(data, userId);

      // Ensure the response includes business unit info
      const responseData = {
        ...company,
        businessUnits: company.businessUnits || [],
        defaultBusinessUnit: company.businessUnits?.[0] || null,
      };

      res.status(201).json({
        success: true,
        data: responseData,
        message: 'Company created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Validation error:', error.errors);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      if (error instanceof AppError) {
        const status = (error as any).status || 400;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * PUT /companies/:id
   * Update a company
   */
  async updateCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateCompanySchema.parse(req.body);

      console.log(`📤 PUT /companies/${id} - Body:`, data);

      const company = await companyService.updateCompany(id, data);

      res.json({
        success: true,
        data: company,
        message: 'Company updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      if (error instanceof AppError) {
        const status = (error as any).status || 400;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * DELETE /companies/:id
   * Delete a company (soft delete if has associations)
   */
  async deleteCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      console.log(`📤 DELETE /companies/${id}`);

      const result = await companyService.deleteCompany(id);

      res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * POST /companies/:id/business-units
   * Add a business unit to a company
   */
  async addBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = businessUnitSchema.parse(req.body);

      console.log(`📤 POST /companies/${id}/business-units - Body:`, data);

      const businessUnit = await companyService.addBusinessUnit(id, data);

      res.status(201).json({
        success: true,
        data: businessUnit,
        message: 'Business unit added successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      if (error instanceof AppError) {
        const status = (error as any).status || 400;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * POST /companies/ensure-user
   * Ensure a user has a company
   */
  async ensureUserCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.body;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      console.log(`📤 POST /companies/ensure-user - UserId: ${userId}`);

      const company = await companyService.ensureUserCompany(userId);

      res.json({
        success: true,
        data: company,
        message: 'Company ensured successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 400;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/by-business-unit/:businessUnitId
   * Get company by business unit ID
   */
  async getCompanyByBusinessUnitId(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.params;

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      console.log(`📤 GET /companies/by-business-unit/${businessUnitId}`);

      const company = await companyService.getCompanyByBusinessUnitId(businessUnitId);

      res.json({
        success: true,
        data: company,
        message: 'Company found for business unit',
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/:id/export
   * Export company data
   */
  async exportCompanyData(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { format } = req.query;

      console.log(`📤 GET /companies/${id}/export - Format: ${format}`);

      const company = await companyService.getCompanyById(id);

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      // Prepare data for export
      const exportData = {
        company: {
          id: company.id,
          name: company.name,
          email: company.email,
          phone: company.phone,
          address: company.address,
          taxId: company.taxId,
          currency: company.currency,
          timezone: company.timezone,
          isActive: company.isActive,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        },
        stats: company.stats,
        businessUnits: company.businessUnits,
        counts: company._count,
      };

      // Set response headers based on format
      const formatType = format === 'csv' ? 'text/csv' : 'application/json';
      const fileExtension = format === 'csv' ? 'csv' : 'json';

      res.setHeader('Content-Type', formatType);
      res.setHeader('Content-Disposition', `attachment; filename=company-${company.id}.${fileExtension}`);

      if (format === 'csv') {
        // Simple CSV export
        const rows = [
          ['Field', 'Value'],
          ['ID', company.id],
          ['Name', company.name],
          ['Email', company.email],
          ['Phone', company.phone],
          ['Address', company.address || ''],
          ['Tax ID', company.taxId || ''],
          ['Currency', company.currency],
          ['Timezone', company.timezone],
          ['Status', company.isActive ? 'Active' : 'Inactive'],
          ['Created', company.createdAt],
          ['Updated', company.updatedAt],
          ['Business Units', company._count?.businessUnits || 0],
          ['Users', company._count?.users || 0],
          ['Customers', company._count?.customers || 0],
          ['Suppliers', company._count?.suppliers || 0],
        ];

        const csvContent = rows.map(row => row.join(',')).join('\n');
        return res.send(csvContent);
      }

      // Default: JSON
      res.json(exportData);
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * POST /companies/bulk
   * Bulk create companies (admin only)
   */
  async bulkCreateCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const companies = z.array(createCompanySchema).parse(req.body);

      console.log(`📤 POST /companies/bulk - Creating ${companies.length} companies`);

      // ⭐ For bulk creation, the caller is an admin creating
      // companies for others — we do NOT auto-link the caller's
      // user.companyId to the first bulk-created company. The
      // linkage only happens on the single-company creation path
      // (the normal onboarding flow).
      const results = [];
      const errors = [];

      for (const companyData of companies) {
        try {
          // Pass `undefined` for userId — no auto-link.
          const company = await companyService.createCompany(companyData);
          results.push(company);
        } catch (error) {
          errors.push({
            data: companyData,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      res.status(201).json({
        success: true,
        data: {
          created: results,
          errors: errors,
          total: companies.length,
          successCount: results.length,
          failureCount: errors.length,
        },
        message: `Created ${results.length} of ${companies.length} companies`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      if (error instanceof AppError) {
        const status = (error as any).status || 400;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * GET /companies/:id/settings
   * Get company settings
   */
  async getCompanySettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Company ID is required', 400);
      }

      console.log(`📤 GET /companies/${id}/settings`);

      const settings = await companyService.getCompanySettings(id);

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 404;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

  /**
   * PUT /companies/:id/settings
   * Update company settings
   */
  async updateCompanySettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      if (!id) {
        throw new AppError('Company ID is required', 400);
      }

      console.log(`📤 PUT /companies/${id}/settings`);

      const settings = await companyService.updateCompanySettings(id, data);

      res.json({
        success: true,
        data: settings,
        message: 'Company settings updated successfully',
      });
    } catch (error) {
      if (error instanceof AppError) {
        const status = (error as any).status || 400;
        return res.status(status).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  },

    /**
   * GET /companies/reports
   * Aggregate reports across companies.
   * Optional query params:
   *   - companyId      (scope to a single company)
   *   - startDate      (ISO date)
   *   - endDate        (ISO date)
   *   - includeInactive (boolean)
   */
  async getCompanyReports(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, startDate, endDate, includeInactive } = req.query;

      const params: {
        companyId?: string;
        startDate?: Date;
        endDate?: Date;
        includeInactive?: boolean;
      } = {};

      if (typeof companyId === 'string' && companyId.length > 0) {
        params.companyId = companyId;
      }
      if (typeof startDate === 'string' && startDate.length > 0) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) params.startDate = d;
      }
      if (typeof endDate === 'string' && endDate.length > 0) {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) params.endDate = d;
      }
      if (
        typeof includeInactive === 'string' &&
        includeInactive.toLowerCase() === 'true'
      ) {
        params.includeInactive = true;
      }

      const reports = await companyService.getCompanyReports(params);

      res.json({
        success: true,
        data: reports,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default companyController;
