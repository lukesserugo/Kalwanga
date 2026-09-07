// D:\Projects\Kalwanga\packages\backend\src\controllers\categoryController.ts

import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/categoryService.js';
import { AppError } from '../middleware/errorHandler.js';
import { createCategorySchema } from '../utils/validators.js';
import { z } from 'zod';

const categoryService = new CategoryService();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  featured: z.boolean().optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, 'At least one ID is required'),
});

// Extend the createCategorySchema to include isActive and featured
const extendedCreateCategorySchema = createCategorySchema.extend({
  isActive: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
});

// ============================================
// HELPERS
// ============================================

function handleZodError(error: z.ZodError, res: Response) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  });
}

// 🔥 FIXED: Proper error handling with AppError
function handleGeneralError(error: any, res: Response) {
  console.error('❌ Category controller error:', error);
  
  if (error instanceof AppError) {
    // 🔥 FIXED: AppError uses 'status', not 'statusCode'
    const status = (error as any).status || (error as any).statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message,
    });
  }
  
  if (error instanceof z.ZodError) {
    return handleZodError(error, res);
  }
  
  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any;
    if (prismaError.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }
    if (prismaError.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A record with this value already exists',
      });
    }
    if (prismaError.code === 'P2003') {
      return res.status(400).json({
        success: false,
        message: 'Foreign key constraint failed',
      });
    }
  }
  
  // Handle standard Error objects
  if (error instanceof Error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
  
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

// ============================================
// CATEGORY CONTROLLER
// ============================================

export const categoryController = {
  /**
   * Get all categories
   * GET /categories
   */
  async getAllCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        page, 
        limit, 
        search, 
        businessUnitId, 
        parentId, 
        isActive,
        sortBy,
        sortOrder,
      } = req.query;

      console.log(`🔍 GET /categories - Params:`, { page, limit, search, businessUnitId, parentId, isActive });

      const result = await categoryService.getAllCategories({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        businessUnitId: businessUnitId as string,
        parentId: parentId === 'null' ? null : (parentId as string),
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      console.log(`✅ GET /categories - Found ${result.categories.length} categories`);

      return res.status(200).json({
        success: true,
        data: result.categories,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      console.error('❌ Error in getAllCategories:', error);
      return handleGeneralError(error, res);
    }
  },

  /**
   * Get category by ID
   * GET /categories/:id
   */
  async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      const category = await categoryService.getCategoryById(id);
      
      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * Get category by name
   * GET /categories/by-name
   */
  async getCategoryByName(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, businessUnitId } = req.query;
      
      if (!name) {
        throw new AppError('Category name is required', 400);
      }

      const category = await categoryService.getCategoryByName(
        name as string, 
        businessUnitId as string
      );
      
      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * Get category with products
   * GET /categories/:id/with-products
   */
  async getCategoryWithProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      const result = await categoryService.getCategoryWithProducts(id);
      
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * Get category products with pagination
   * GET /categories/:id/products
   */
  async getCategoryProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;
      
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      const result = await categoryService.getCategoryProducts(id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      
      return res.status(200).json({
        success: true,
        data: result.products,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * Get subcategories
   * GET /categories/:parentId/subcategories
   */
  async getSubcategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { parentId } = req.params;
      
      if (!parentId) {
        throw new AppError('Parent category ID is required', 400);
      }

      const subcategories = await categoryService.getSubcategories(parentId);
      
      return res.status(200).json({
        success: true,
        data: subcategories,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * Get category tree (hierarchical)
   * GET /categories/tree/:businessUnitId
   */
  async getCategoryTree(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.params;
      
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const tree = await categoryService.getCategoryTree(businessUnitId);
      
      return res.status(200).json({
        success: true,
        data: tree,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * Get category statistics
   * GET /categories/stats/:businessUnitId
   */
  async getCategoryStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.params;
      
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const stats = await categoryService.getCategoryStatistics(businessUnitId);
      
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create category
   * POST /categories
   */
  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📝 Creating category with body:', req.body);
      
      let data;
      try {
        data = extendedCreateCategorySchema.parse(req.body);
        console.log('✅ Validation passed:', data);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error('❌ Validation error:', validationError.errors);
          return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: validationError.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          });
        }
        throw validationError;
      }

      if (!data.businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const categoryData = {
        name: data.name,
        description: data.description || null,
        parentId: data.parentId || null,
        businessUnitId: data.businessUnitId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        featured: data.featured || false,
      };

      console.log('📤 Sending to categoryService:', categoryData);

      const category = await categoryService.createCategory(categoryData);
      
      console.log('✅ Category created successfully:', category.id);
      
      return res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully',
      });
    } catch (error) {
      console.error('❌ Error creating category:', error);
      
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  /**
   * Update category
   * PUT /categories/:id
   */
  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      console.log(`📝 Updating category ${id} with body:`, req.body);
      
      let data;
      try {
        data = updateCategorySchema.parse(req.body);
        console.log('✅ Validation passed:', data);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          console.error('❌ Validation error:', validationError.errors);
          return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: validationError.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          });
        }
        throw validationError;
      }

      const category = await categoryService.updateCategory(id, data);
      
      console.log(`✅ Category ${id} updated successfully`);
      
      return res.status(200).json({
        success: true,
        data: category,
        message: 'Category updated successfully',
      });
    } catch (error) {
      console.error(`❌ Error updating category:`, error);
      
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },

  /**
   * Delete category
   * DELETE /categories/:id
   */
  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      console.log(`📝 Deleting category ${id}`);
      
      const result = await categoryService.deleteCategory(id);
      
      console.log(`✅ Category ${id} deleted successfully`);
      
      return res.status(200).json({
        success: true,
        message: result?.message || 'Category deleted successfully',
        data: result,
      });
    } catch (error) {
      console.error(`❌ Error deleting category:`, error);
      return handleGeneralError(error, res);
    }
  },

  /**
   * Toggle category status
   * PATCH /categories/:id/status
   */
  async toggleCategoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }
      
      if (isActive === undefined) {
        throw new AppError('isActive is required', 400);
      }

      console.log(`📝 Toggling category ${id} status to ${isActive}`);
      
      const category = await categoryService.toggleCategoryStatus(id, isActive);
      
      console.log(`✅ Category ${id} status toggled successfully`);
      
      return res.status(200).json({
        success: true,
        data: category,
        message: `Category ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      console.error(`❌ Error toggling category status:`, error);
      return handleGeneralError(error, res);
    }
  },

  /**
   * Bulk delete categories
   * POST /categories/bulk-delete
   */
  async bulkDeleteCategories(req: Request, res: Response, next: NextFunction) {
    try {
      let data;
      try {
        data = bulkDeleteSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: validationError.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          });
        }
        throw validationError;
      }

      console.log(`📝 Bulk deleting ${data.ids.length} categories`);
      
      const result = await categoryService.bulkDeleteCategories(data.ids);
      
      console.log(`✅ Bulk delete completed: ${result.deletedCount} deleted`);
      
      return res.status(200).json({
        success: true,
        data: result,
        message: `${result.deletedCount} categories deleted successfully`,
        errors: result.errors || [],
      });
    } catch (error) {
      console.error(`❌ Error bulk deleting categories:`, error);
      
      if (error instanceof z.ZodError) {
        return handleZodError(error, res);
      }
      return handleGeneralError(error, res);
    }
  },
};

export default categoryController;
