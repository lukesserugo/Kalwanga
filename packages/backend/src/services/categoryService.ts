// src/services/categoryService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';

interface CategoryResponse {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  businessUnitId: string;
  isActive: boolean;
  featured?: boolean;
  createdAt: Date;
  updatedAt: Date;
  parent?: any;
  children?: any[];
  productCount?: number;
  childCount?: number;
  recentProducts?: any[];
}

interface CreateCategoryData {
  name: string;
  description?: string | null;
  parentId?: string | null;
  businessUnitId: string;
  isActive?: boolean;
  featured?: boolean;
}

interface UpdateCategoryData {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  featured?: boolean;
}

export class CategoryService extends BaseService {
  // ============================================
  // BUSINESS UNIT RESOLUTION - IMPROVED
  // ============================================

  /**
   * Check if a string is a valid ID (CUID or UUID)
   * Prisma generates CUIDs by default (e.g., "cmta9vml9000110c99tmvwm19")
   */
  private isValidID(id: string): boolean {
    if (!id || id === 'default') return false;
    
    // CUID pattern (starts with 'c' followed by 24 alphanumeric characters)
    const cuidRegex = /^c[a-z0-9]{24}$/i;
    
    // UUID pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Simple alphanumeric IDs
    const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
    
    return cuidRegex.test(id) || uuidRegex.test(id) || simpleIdRegex.test(id);
  }

  /**
   * Ensure a valid business unit exists and return its ID
   * This resolves 'default' to a real ID and creates one if needed
   */
  private async ensureBusinessUnit(businessUnitId?: string): Promise<{ id: string; name: string }> {
    console.log(`🔍 ensureBusinessUnit called with: ${businessUnitId || 'undefined'}`);
    
    // If a valid ID is provided, verify it exists
    if (businessUnitId && businessUnitId !== 'default' && this.isValidID(businessUnitId)) {
      const existing = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
      });
      
      if (existing) {
        console.log(`✅ Using existing business unit: ${existing.id} (${existing.name})`);
        return { id: existing.id, name: existing.name };
      }
      
      console.warn(`⚠️ Business unit with ID "${businessUnitId}" not found, will find another`);
    }

    // Try to find first active business unit
    const firstBusinessUnit = await this.prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (firstBusinessUnit) {
      console.log(`✅ Using first active business unit: ${firstBusinessUnit.id} (${firstBusinessUnit.name})`);
      return { id: firstBusinessUnit.id, name: firstBusinessUnit.name };
    }

    // No business unit exists - create one
    console.log('🔧 No business unit found, creating default...');

    // First, ensure we have a company
    let company = await this.prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!company) {
      company = await this.prisma.company.create({
        data: {
          name: 'Default Company',
          email: 'default@company.com',
          phone: '+0000000000',
          isActive: true,
        },
      });
      console.log('✅ Created default company:', company.id);
    }

    // Create a business unit
    const newBusinessUnit = await this.prisma.businessUnit.create({
      data: {
        name: 'Default Business Unit',
        code: `BU-${Date.now().toString().slice(-6)}`,
        isActive: true,
        companyId: company.id,
        type: 'STORE',
      },
    });

    console.log(`✅ Created default business unit: ${newBusinessUnit.id} (${newBusinessUnit.name})`);
    return { id: newBusinessUnit.id, name: newBusinessUnit.name };
  }

  /**
   * Resolve business unit ID - handles 'default' and invalid IDs
   */
  private async resolveBusinessUnitId(businessUnitId?: string): Promise<string> {
    const result = await this.ensureBusinessUnit(businessUnitId);
    return result.id;
  }

  /**
   * Create audit log with transaction
   */
  private async createAuditLogWithTx(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    entityName: string,
    userId: string = 'system',
    severity: string = 'INFO',
    changes?: any
  ): Promise<void> {
    try {
      await tx.auditLog.create({
        data: {
          action: action as any,
          entityType: 'CATEGORY',
          entityId: entityId,
          entityName: entityName,
          userId: userId,
          severity: severity as any,
          changes: changes || {},
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.warn('Failed to create audit log:', error);
    }
  }

  /**
   * Handle errors
   */
  private handleServiceError(error: any, methodName: string): never {
    console.error(`❌ Error in ${methodName}:`, error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to ${methodName.replace('CategoryService.', '')}: ${error.message || 'Unknown error'}`, 500);
  }

  // ============================================
  // CATEGORY QUERY METHODS
  // ============================================

  /**
   * Get all categories with pagination and filtering
   */
  async getAllCategories(params: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    parentId?: string | null;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        businessUnitId, 
        parentId, 
        isActive,
        sortBy = 'name',
        sortOrder = 'asc',
      } = params;
      
      const validatedLimit = Math.min(200, Math.max(1, Number(limit) || 10));
      const validatedPage = Math.max(1, Number(page) || 1);
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      // 🔥 FIX: Don't filter by businessUnitId if it's provided as a parameter
      // Instead, we want to return ALL categories from all business units
      // This ensures the frontend can see categories even if they're in different business units
      
      // 🔥 UNCOMMENT THIS IF YOU WANT TO FILTER BY BUSINESS UNIT
      // If you want to filter, uncomment this:
      // if (businessUnitId && businessUnitId !== 'default') {
      //   const resolvedBusinessUnit = await this.ensureBusinessUnit(businessUnitId);
      //   where.businessUnitId = resolvedBusinessUnit.id;
      // }
      
      // 🔥 NEW: If businessUnitId is provided, try to find categories for it
      // If none exist, return ALL categories as fallback
      if (businessUnitId && businessUnitId !== 'default' && businessUnitId !== 'default-business-unit') {
        // First try to find categories for this business unit
        const buWhere = { ...where, businessUnitId: businessUnitId };
        const buCount = await this.prisma.category.count({ where: buWhere });
        
        if (buCount > 0) {
          where.businessUnitId = businessUnitId;
          console.log(`✅ Found ${buCount} categories for business unit ${businessUnitId}`);
        } else {
          console.log(`⚠️ No categories found for business unit ${businessUnitId}, returning ALL categories`);
          // Don't filter by business unit - return all categories
        }
      }
      
      if (parentId !== undefined) where.parentId = parentId;
      if (isActive !== undefined) where.isActive = isActive;

      console.log(`📊 Querying categories with where:`, JSON.stringify(where, null, 2));

      const [categories, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            parent: {
              select: {
                id: true,
                name: true,
              },
            },
            children: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
              },
            },
            products: {
              where: { isActive: true },
              select: { 
                id: true, 
                name: true, 
                sku: true, 
                unitPrice: true,
              },
              take: 5,
            },
            _count: {
              select: {
                products: {
                  where: { isActive: true },
                },
                children: {
                  where: { isActive: true },
                },
              },
            },
          },
        }),
        this.prisma.category.count({ where }),
      ]);

      console.log(`✅ Found ${categories.length} categories`);

      const enhancedCategories = categories.map((category: any) => ({
        ...category,
        productCount: category._count.products,
        childCount: category._count.children,
        recentProducts: category.products,
      }));

      return {
        categories: enhancedCategories,
        total,
        page: validatedPage,
        totalPages: Math.ceil(total / validatedLimit),
        limit: validatedLimit,
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getAllCategories');
    }
  }

  /**
   * Get category by ID with full details
   */
  async getCategoryById(id: string): Promise<CategoryResponse> {
    try {
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          children: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          products: {
            where: { isActive: true },
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
              children: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      return {
        ...category,
        productCount: category._count.products,
        childCount: category._count.children,
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryById');
    }
  }

  /**
   * Get category by name
   */
  async getCategoryByName(name: string, businessUnitId?: string) {
    try {
      if (!name) {
        throw new AppError('Category name is required', 400);
      }

      const where: any = { 
        name: {
          equals: name,
          mode: 'insensitive',
        },
      };
      
      if (businessUnitId) {
        const resolvedId = await this.resolveBusinessUnitId(businessUnitId);
        where.businessUnitId = resolvedId;
      }

      const category = await this.prisma.category.findFirst({
        where,
        include: {
          parent: true,
          children: {
            where: { isActive: true },
          },
          products: {
            where: { isActive: true },
            take: 5,
          },
        },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      return category;
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryByName');
    }
  }

  /**
   * Get category with full product details
   */
  async getCategoryWithProducts(id: string) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          parent: true,
          children: {
            where: { isActive: true },
          },
          products: {
            where: { isActive: true },
            include: {
              inventory: {
                include: {
                  businessUnit: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              variants: {
                where: { isActive: true },
              },
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { name: 'asc' },
          },
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      return {
        ...category,
        productCount: category._count.products,
        totalInventoryValue: category.products.reduce((sum: number, product: any) => {
          const inventory = product.inventory[0];
          return sum + (inventory ? inventory.quantity * product.unitPrice : 0);
        }, 0),
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryWithProducts');
    }
  }

  /**
   * Get subcategories for a parent category
   */
  async getSubcategories(parentId: string) {
    try {
      if (!parentId) {
        throw new AppError('Parent category ID is required', 400);
      }

      const parent = await this.prisma.category.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        throw new AppError('Parent category not found', 404);
      }

      const subcategories = await this.prisma.category.findMany({
        where: { 
          parentId,
          isActive: true,
        },
        include: {
          children: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
            },
          },
          products: {
            where: { isActive: true },
            select: { 
              id: true, 
              name: true, 
              sku: true, 
              unitPrice: true,
            },
            take: 5,
          },
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
              children: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return subcategories.map((sub: any) => ({
        ...sub,
        productCount: sub._count.products,
        childCount: sub._count.children,
      }));
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getSubcategories');
    }
  }

  // ============================================
  // CATEGORY WRITE METHODS
  // ============================================

  /**
   * Create a new category with proper business unit resolution
   */
  async createCategory(data: CreateCategoryData) {
    try {
      console.log('📦 CategoryService.createCategory called with:', JSON.stringify(data, null, 2));
      
      if (!data.name) {
        throw new AppError('Category name is required', 400);
      }

      // Resolve business unit ID
      const resolvedBusinessUnit = await this.ensureBusinessUnit(data.businessUnitId);
      const resolvedBusinessUnitId = resolvedBusinessUnit.id;
      
      console.log(`📦 Resolved business unit: ${resolvedBusinessUnitId} (${resolvedBusinessUnit.name})`);

      // Verify the business unit exists
      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id: resolvedBusinessUnitId },
      });
      
      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      // Check if parent exists
      if (data.parentId) {
        const parent = await this.prisma.category.findUnique({
          where: { id: data.parentId },
        });
        
        if (!parent) {
          throw new AppError('Parent category not found', 404);
        }
        
        if (parent.businessUnitId !== resolvedBusinessUnitId) {
          throw new AppError('Parent category must be in the same business unit', 400);
        }
      }

      // Check for duplicate name
      const existing = await this.prisma.category.findFirst({
        where: {
          name: {
            equals: data.name,
            mode: 'insensitive',
          },
          businessUnitId: resolvedBusinessUnitId,
          parentId: data.parentId || null,
        },
      });

      if (existing) {
        throw new AppError(`Category with name "${data.name}" already exists in this location`, 400);
      }

      // Create category directly (no transaction to avoid audit log issues)
      const category = await this.prisma.category.create({
        data: {
          name: data.name,
          description: data.description || null,
          parentId: data.parentId || null,
          businessUnitId: resolvedBusinessUnitId,
          isActive: data.isActive !== undefined ? data.isActive : true,
          featured: data.featured || false,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      console.log(`✅ Category created successfully: ${category.name} (${category.id}) with businessUnitId: ${category.businessUnitId}`);
      return category;
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.createCategory');
    }
  }

  /**
   * Update category
   */
  async updateCategory(id: string, data: UpdateCategoryData) {
    try {
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      const category = await this.prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      // Check if new parent exists and is valid
      if (data.parentId !== undefined) {
        if (data.parentId === id) {
          throw new AppError('Cannot set category as its own parent', 400);
        }

        if (data.parentId) {
          const parent = await this.prisma.category.findUnique({
            where: { id: data.parentId },
          });
          
          if (!parent) {
            throw new AppError('Parent category not found', 404);
          }
          
          if (parent.businessUnitId !== category.businessUnitId) {
            throw new AppError('Parent category must be in the same business unit', 400);
          }

          // Check for circular reference
          const visited = new Set<string>();
          let current = parent;
          
          while (current.parentId) {
            if (visited.has(current.id) || current.parentId === id) {
              throw new AppError('Circular reference detected in category hierarchy', 400);
            }
            visited.add(current.id);
            
            const next = await this.prisma.category.findUnique({
              where: { id: current.parentId },
            });
            
            if (!next) break;
            current = next;
          }
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.parentId !== undefined) updateData.parentId = data.parentId || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.featured !== undefined) updateData.featured = data.featured;

      // Update directly
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: updateData,
        include: {
          parent: true,
          children: true,
        },
      });

      console.log(`✅ Category updated: ${updatedCategory.name} (${updatedCategory.id})`);
      return updatedCategory;
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.updateCategory');
    }
  }

  /**
   * Delete category (soft delete preferred)
   */
  async deleteCategory(id: string) {
    try {
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          children: true,
          products: {
            where: { isActive: true },
          },
        },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      if (category.children.length > 0) {
        throw new AppError('Cannot delete category with child categories. Please delete or reassign children first.', 400);
      }
      
      if (category.products.length > 0) {
        // Soft delete
        const archived = await this.prisma.category.update({
          where: { id },
          data: {
            isActive: false,
          },
        });

        return { 
          message: 'Category archived (soft deleted) due to existing products', 
          category: archived,
          softDeleted: true,
        };
      }

      // Hard delete
      await this.prisma.category.delete({
        where: { id },
      });

      return { 
        message: 'Category deleted successfully',
        softDeleted: false,
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.deleteCategory');
    }
  }

  /**
   * Toggle category status
   */
  async toggleCategoryStatus(id: string, isActive: boolean) {
    try {
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      const category = await this.prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      const updated = await this.prisma.category.update({
        where: { id },
        data: { isActive },
        include: {
          parent: true,
          children: true,
        },
      });

      // If deactivating, also deactivate children
      if (!isActive) {
        await this.prisma.category.updateMany({
          where: { parentId: id },
          data: { isActive: false },
        });
      }

      return updated;
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.toggleCategoryStatus');
    }
  }

  /**
   * Get category tree
   */
  async getCategoryTree(businessUnitId: string) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const resolvedBusinessUnitId = await this.resolveBusinessUnitId(businessUnitId);

      const categories = await this.prisma.category.findMany({
        where: {
          businessUnitId: resolvedBusinessUnitId,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              products: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const buildTree = (items: any[], parentId: string | null = null): any[] => {
        return items
          .filter(item => item.parentId === parentId)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            parentId: item.parentId,
            businessUnitId: item.businessUnitId,
            isActive: item.isActive,
            productCount: item._count?.products || 0,
            children: buildTree(items, item.id),
          }));
      };

      return buildTree(categories);
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryTree');
    }
  }

  /**
   * Bulk delete categories
   */
  async bulkDeleteCategories(ids: string[]) {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('No category IDs provided', 400);
      }

      const categories = await this.prisma.category.findMany({
        where: {
          id: { in: ids },
        },
        include: {
          children: true,
          products: {
            where: { isActive: true },
          },
        },
      });

      const errors: string[] = [];
      const validIds: string[] = [];
      const softDeleteIds: string[] = [];

      for (const category of categories) {
        if (category.children.length > 0) {
          errors.push(`Category "${category.name}" has ${category.children.length} child categories`);
        } else if (category.products.length > 0) {
          errors.push(`Category "${category.name}" has ${category.products.length} associated products`);
          softDeleteIds.push(category.id);
        } else {
          validIds.push(category.id);
        }
      }

      let deletedCount = 0;

      // Hard delete valid categories
      if (validIds.length > 0) {
        const hardDelete = await this.prisma.category.deleteMany({
          where: { id: { in: validIds } },
        });
        deletedCount += hardDelete.count;
      }

      // Soft delete categories with products
      if (softDeleteIds.length > 0) {
        const softDelete = await this.prisma.category.updateMany({
          where: { id: { in: softDeleteIds } },
          data: {
            isActive: false,
          },
        });
        deletedCount += softDelete.count;
      }

      return {
        deletedCount,
        errors,
        message: `${deletedCount} categories processed successfully`,
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.bulkDeleteCategories');
    }
  }

  /**
   * Get category products with pagination
   */
  async getCategoryProducts(id: string, params?: { page?: number; limit?: number }) {
    try {
      if (!id) {
        throw new AppError('Category ID is required', 400);
      }

      const { page = 1, limit = 10 } = params || {};
      const skip = (page - 1) * limit;

      const category = await this.prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            categoryId: id,
            isActive: true,
          },
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            inventory: {
              select: {
                id: true,
                quantity: true,
                reserved: true,
                reorderPoint: true,
              },
            },
            variants: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        this.prisma.product.count({
          where: {
            categoryId: id,
            isActive: true,
          },
        }),
      ]);

      return {
        products,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryProducts');
    }
  }

  /**
   * Get category statistics
   */
  async getCategoryStatistics(businessUnitId: string) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const resolvedBusinessUnitId = await this.resolveBusinessUnitId(businessUnitId);

      const [total, active, inactive, withProducts, totalProducts] = await Promise.all([
        this.prisma.category.count({
          where: { businessUnitId: resolvedBusinessUnitId },
        }),
        this.prisma.category.count({
          where: { businessUnitId: resolvedBusinessUnitId, isActive: true },
        }),
        this.prisma.category.count({
          where: { businessUnitId: resolvedBusinessUnitId, isActive: false },
        }),
        this.prisma.category.count({
          where: {
            businessUnitId: resolvedBusinessUnitId,
            products: {
              some: { isActive: true },
            },
          },
        }),
        this.prisma.product.count({
          where: {
            businessUnitId: resolvedBusinessUnitId,
            isActive: true,
            categoryId: { not: null },
          },
        }),
      ]);

      return {
        total,
        active,
        inactive,
        withProducts,
        withoutProducts: total - withProducts,
        totalProducts,
        averageProductsPerCategory: withProducts > 0 ? totalProducts / withProducts : 0,
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryStatistics');
    }
  }
}

export default CategoryService;
