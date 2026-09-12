// src/controllers/businessUnitController.ts
import { Request, Response, NextFunction } from 'express';
import { BusinessUnitService } from '../services/businessUnitService.js';
import { AppError } from '../middleware/errorHandler.js';
import { createBusinessUnitSchema } from '../utils/validators.js';
import { UserRole, BusinessUnitType } from '../generated/prisma/index.js';
import { z } from 'zod';

const businessUnitService = new BusinessUnitService();

// Validation schemas
const updateBusinessUnitSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  code: z.string().min(1, 'Code is required').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
  isActive: z.boolean().optional(),
  type: z.enum(['HEADQUARTERS', 'BRANCH', 'WAREHOUSE', 'STORE']).optional(),
});

const addUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1, 'ID is required')).min(1, 'At least one ID is required'),
});

const ensureUserBusinessUnitSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  companyId: z.string().min(1, 'Company ID is required'),
});

// ID validation helper (supports CUID, UUID, and Clerk IDs)
function isValidID(id: string): boolean {
  // CUID pattern (Prisma default - starts with 'c' followed by 24 alphanumeric characters)
  const cuidRegex = /^c[a-z0-9]{24}$/i;
  
  // UUID pattern
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // Clerk ID pattern (usually starts with 'user_')
  const clerkIdRegex = /^user_[a-zA-Z0-9]{20,}$/;
  
  // Simple alphanumeric IDs (accept any reasonable ID format)
  const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
  
  return cuidRegex.test(id) || uuidRegex.test(id) || clerkIdRegex.test(id) || simpleIdRegex.test(id);
}

// Helper function to handle validation errors
function handleValidationError(error: unknown, res: Response): boolean {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
    return true;
  }
  return false;
}

// ============================================
// BUSINESS UNIT CONTROLLER
// ============================================

export const businessUnitController = {
  /**
   * Get all business units
   * GET /business-units
   */
  /**
   * Get all business units
   * GET /business-units
   */
  async getAllBusinessUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        page, 
        limit, 
        search, 
        companyId,
        isActive,
        sortBy,
        sortOrder,
        includeDeleted,
      } = req.query;

      // ✅ Whitelist sortable fields so Prisma never sees an unknown key
      const ALLOWED_SORT_FIELDS = new Set([
        'createdAt',
        'updatedAt',
        'name',
        'code',
        'type',
        'isActive',
      ]);

      const requestedSortBy = (sortBy as string) || 'createdAt';
      const safeSortBy = ALLOWED_SORT_FIELDS.has(requestedSortBy)
        ? requestedSortBy
        : 'createdAt';

      const requestedSortOrder =
        sortOrder === 'asc' || sortOrder === 'desc'
          ? (sortOrder as 'asc' | 'desc')
          : 'desc';

      const result = await businessUnitService.getAllBusinessUnits({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        companyId: companyId as string,
        isActive:
          isActive === 'true'
            ? true
            : isActive === 'false'
            ? false
            : undefined,
        sortBy: safeSortBy,
        sortOrder: requestedSortOrder,
        includeDeleted: includeDeleted === 'true',
      });

      res.json({
        success: true,
        data: result.businessUnits,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get business unit by ID
   * GET /business-units/:id
   */
  async getBusinessUnitById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      
      const businessUnit = await businessUnitService.getBusinessUnitById(id);
      res.json({ success: true, data: businessUnit });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create business unit
   * POST /business-units
   */
  async createBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      // Parse and validate input
      const data = createBusinessUnitSchema.parse(req.body);
      
      // Ensure companyId is provided
      if (!data.companyId) {
        throw new AppError('Company ID is required to create a business unit', 400);
      }
      
      // Validate companyId is a valid ID (CUID or UUID)
      if (!isValidID(data.companyId)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }

      // Create business unit with optional type field
      const businessUnit = await businessUnitService.createBusinessUnit({
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
        email: data.email,
        companyId: data.companyId,
        isActive: data.isActive,
        type: (data.type as BusinessUnitType) || BusinessUnitType.STORE,
      });
      
      res.status(201).json({ 
        success: true, 
        data: businessUnit,
        message: 'Business unit created successfully',
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Update business unit
   * PUT /business-units/:id
   */
  async updateBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      
      const data = updateBusinessUnitSchema.parse(req.body);
      
      // Convert type to enum if provided
      const updateData: any = { ...data };
      if (data.type) {
        updateData.type = data.type as BusinessUnitType;
      }
      
      const businessUnit = await businessUnitService.updateBusinessUnit(id, updateData);
      
      res.json({ 
        success: true, 
        data: businessUnit,
        message: 'Business unit updated successfully',
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Delete business unit
   * DELETE /business-units/:id
   */
  async deleteBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      
      const result = await businessUnitService.deleteBusinessUnit(id);
      
      const message = result && typeof result === 'object' && 'message' in result 
        ? (result as any).message 
        : 'Business unit deleted successfully';
      
      res.json({ 
        success: true, 
        message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Bulk delete business units
   * POST /business-units/bulk-delete
   */
  async bulkDeleteBusinessUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = bulkDeleteSchema.parse(req.body);
      
      // Validate all IDs
      for (const id of ids) {
        if (!isValidID(id)) {
          throw new AppError(`Invalid ID format: ${id}`, 400);
        }
      }
      
      const result = await businessUnitService.bulkDeleteBusinessUnits(ids);
      
      res.json({
        success: true,
        data: result,
        message: `${result.deletedCount + result.softDeletedCount} business units processed successfully`,
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Get business unit stats
   * GET /business-units/:id/stats
   */
  async getBusinessUnitStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      
      const stats = await businessUnitService.getBusinessUnitStats(id);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get business unit users
   * GET /business-units/:id/users
   */
  async getBusinessUnitUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      
      const users = await businessUnitService.getBusinessUnitUsers(id);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add user to business unit
   * POST /business-units/:id/users
   */
  async addUserToBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      
      const { userId, role } = addUserSchema.parse(req.body);
      
      // Validate userId is a valid ID
      if (!isValidID(userId)) {
        throw new AppError('Invalid user ID format. Must be a valid ID.', 400);
      }
      
      // Convert role string to UserRole enum
      const userRole = role ? (role as UserRole) : undefined;
      
      const result = await businessUnitService.addUserToBusinessUnit(id, userId, userRole);
      
      res.status(201).json({ 
        success: true, 
        data: result,
        message: 'User added to business unit successfully',
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Remove user from business unit
   * DELETE /business-units/:id/users/:userId
   */
  async removeUserFromBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, userId } = req.params;
      
      // Validate ID format
      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      
      if (!isValidID(userId)) {
        throw new AppError('Invalid user ID format. Must be a valid ID.', 400);
      }
      
      const result = await businessUnitService.removeUserFromBusinessUnit(id, userId);
      
      res.json({ 
        success: true, 
        data: result,
        message: 'User removed from business unit successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get default business unit for a company
   * GET /business-units/default/:companyId
   */
  async getOrCreateDefaultBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;
      
      // Validate companyId is a valid ID
      if (!isValidID(companyId)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }
      
      // Get existing or create new business unit
      const businessUnit = await businessUnitService.getOrCreateDefaultBusinessUnit(companyId);
      
      res.json({ 
        success: true, 
        data: businessUnit,
        message: 'Business unit retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Ensure a business unit exists for a user
   * POST /business-units/ensure
   */
  async ensureUserBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, companyId } = ensureUserBusinessUnitSchema.parse(req.body);
      
      // Validate ID format
      if (!isValidID(userId)) {
        throw new AppError('Invalid user ID format. Must be a valid ID.', 400);
      }
      
      if (!isValidID(companyId)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }
      
      const businessUnit = await businessUnitService.ensureUserBusinessUnit(userId, companyId);
      
      res.json({ 
        success: true, 
        data: businessUnit,
        message: 'Business unit ensured successfully',
      });
    } catch (error) {
      if (handleValidationError(error, res)) return;
      next(error);
    }
  },

  /**
   * Get business units by company
   * GET /business-units/company/:companyId
   */
  async getBusinessUnitsByCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;
      
      // Validate companyId is a valid ID
      if (!isValidID(companyId)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }
      
      const businessUnits = await businessUnitService.getBusinessUnitsByCompany(companyId);
      
      res.json({ 
        success: true, 
        data: businessUnits,
        count: businessUnits.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get business unit by code
   * GET /business-units/code/:code
   */
  async getBusinessUnitByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      const { companyId } = req.query;
      
      if (!code) {
        throw new AppError('Business unit code is required', 400);
      }
      
      if (companyId && !isValidID(companyId as string)) {
        throw new AppError('Invalid company ID format. Must be a valid ID.', 400);
      }
      
      const businessUnit = await businessUnitService.getBusinessUnitByCode(
        code,
        companyId as string | undefined
      );
      
      res.json({ 
        success: true, 
        data: businessUnit,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get business unit with full details
   * GET /business-units/:id/details
   */
  async getBusinessUnitWithDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!isValidID(id)) {
        throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
      }
      
      const businessUnit = await businessUnitService.getBusinessUnitWithDetails(id);
      
      res.json({ 
        success: true, 
        data: businessUnit,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default businessUnitController;
