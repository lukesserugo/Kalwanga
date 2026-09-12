// src/services/businessUnitService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma, BusinessUnitType, UserRole } from '../generated/prisma/index.js';

interface BusinessUnitStats {
  products: number;
  inventoryTotal: number;
  sales: number;
  totalRevenue: number;
  totalCustomers: number;
  totalEmployees: number;
  lowStockItems: number;
  outOfStockItems: number;
  monthlyRevenue: number;
  monthlySales: number;
}

interface CreateBusinessUnitData {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  companyId: string;
  isActive?: boolean;
  type?: BusinessUnitType;
}

interface UpdateBusinessUnitData {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  type?: BusinessUnitType;
}

export class BusinessUnitService extends BaseService {
  // ============================================
  // ID VALIDATION (Supports CUID and UUID)
  // ============================================

  /**
   * Validate if a string is a valid ID (CUID or UUID)
   * Prisma generates CUIDs by default (e.g., "cmta9eosu000050c9wv812exa")
   * but some models might use UUIDs
   */
  private isValidID(id: string): boolean {
    // CUID pattern (starts with 'c' followed by 24 alphanumeric characters)
    const cuidRegex = /^c[a-z0-9]{24}$/i;
    
    // UUID pattern
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Also accept simple alphanumeric IDs of reasonable length
    const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
    
    return cuidRegex.test(id) || uuidRegex.test(id) || simpleIdRegex.test(id);
  }

  /**
   * Validate and ensure a business unit exists
   */
  private async validateBusinessUnit(id: string): Promise<any> {
    if (!id) {
      throw new AppError('Business unit ID is required', 400);
    }

    if (!this.isValidID(id)) {
      throw new AppError('Invalid business unit ID format. Must be a valid ID.', 400);
    }

    const businessUnit = await this.prisma.businessUnit.findUnique({
      where: { id },
    });

    if (!businessUnit) {
      throw new AppError('Business unit not found', 404);
    }

    return businessUnit;
  }

  /**
   * Validate a company ID
   * 🔥 Fixed: Removed strict ID validation that was rejecting valid CUIDs
   * Now directly checks if the company exists in the database
   */
  private async validateCompany(id: string): Promise<any> {
    if (!id) {
      throw new AppError('Company ID is required', 400);
    }

    console.log(`🔍 Validating company: ${id}`);

    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      console.error(`❌ Company not found: ${id}`);
      
      // Debug: List all companies
      const allCompanies = await this.prisma.company.findMany({
        select: { id: true, name: true },
      });
      console.log('📊 All companies in DB:', JSON.stringify(allCompanies, null, 2));
      
      throw new AppError(`Company not found with ID: ${id}`, 404);
    }

    console.log(`✅ Company found: ${company.name}`);
    return company;
  }

  // ============================================
  // BUSINESS UNIT METHODS
  // ============================================

  /**
   * Get all business units with pagination and filtering
   */
  /**
   * Get all business units with pagination and filtering
   */
  async getAllBusinessUnits(params: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeDeleted?: boolean;
  }) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        companyId,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeDeleted = false,
      } = params;
      
      const skip = (page - 1) * limit;

      const where: any = {};

      // ✅ Exclude soft-deleted units unless explicitly requested
      if (!includeDeleted) {
        where.deletedAt = null;
      }
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      if (companyId) {
        await this.validateCompany(companyId);
        where.companyId = companyId;
      }
      
      if (isActive !== undefined) where.isActive = isActive;

      const [businessUnits, total] = await Promise.all([
        this.prisma.businessUnit.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            users: {
              where: { isActive: true },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                  },
                },
              },
            },
            _count: {
              select: {
                products: true,
                inventory: true,
                sales: true,
              },
            },
          },
        }),
        this.prisma.businessUnit.count({ where }),
      ]);

      const enhancedBusinessUnits = businessUnits.map((bu: any) => ({
        ...bu,
        activeUserCount: bu.users.length,
        totalProductCount: bu._count.products,
        totalInventoryCount: bu._count.inventory,
        totalSalesCount: bu._count.sales,
      }));

      return {
        businessUnits: enhancedBusinessUnits,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getAllBusinessUnits');
    }
  }

  /**
   * Get business unit by ID with full details
   */
  async getBusinessUnitById(id: string) {
    try {
      await this.validateBusinessUnit(id);

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
            },
          },
          users: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  phoneNumber: true,
                  avatar: true,
                },
              },
            },
          },
          products: {
            where: { isActive: true },
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
          inventory: {
            take: 10,
            orderBy: { updatedAt: 'desc' },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          _count: {
            select: {
              products: true,
              inventory: true,
              sales: true,
            },
          },
        },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      const stats = await this.getBusinessUnitStats(id);

      return {
        ...businessUnit,
        stats,
        counts: businessUnit._count,
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getBusinessUnitById');
    }
  }

  /**
   * Create a new business unit
   */
  async createBusinessUnit(data: CreateBusinessUnitData) {
    try {
      console.log('📦 createBusinessUnit called with:', data);
      
      // Validate required fields
      if (!data.name) {
        throw new AppError('Business unit name is required', 400);
      }
      if (!data.code) {
        throw new AppError('Business unit code is required', 400);
      }
      if (!data.companyId) {
        throw new AppError('Company ID is required', 400);
      }

      // Check if company exists, if not, create it
      let company = await this.prisma.company.findUnique({
        where: { id: data.companyId },
      });

      if (!company) {
        console.warn(`⚠️ Company ${data.companyId} not found, attempting to create`);
        
        // Try to find by name or create new
        company = await this.prisma.company.findFirst({
          where: { name: data.name },
        });

        if (!company) {
          company = await this.prisma.company.create({
            data: {
              name: data.name,
              email: data.email || `${data.code.toLowerCase()}@company.com`,
              phone: data.phone || '',
            },
          });
          console.log(`✅ Created new company: ${company.name} (${company.id})`);
        }
      }

      // Create business unit
      const businessUnit = await this.prisma.businessUnit.create({
        data: {
          name: data.name.trim(),
          code: data.code.toUpperCase().trim(),
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          companyId: company.id,
          isActive: data.isActive ?? true,
          type: data.type || 'STORE',
        },
      });

      console.log(`✅ Business unit created: ${businessUnit.name} (${businessUnit.code})`);
      return businessUnit;
    } catch (error) {
      console.error('❌ Error in createBusinessUnit:', error);
      this.handleError(error, 'BusinessUnitService.createBusinessUnit');
    }
  }

  /**
   * Update business unit
   */
  async updateBusinessUnit(id: string, data: UpdateBusinessUnitData) {
    try {
      await this.validateBusinessUnit(id);

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      // Check if code is being changed and already exists
      if (data.code && data.code.toUpperCase() !== businessUnit.code) {
        const existing = await this.prisma.businessUnit.findFirst({
          where: {
            code: {
              equals: data.code.toUpperCase(),
              mode: 'insensitive',
            },
            id: { not: id },
          },
        });
        if (existing) {
          throw new AppError(`Business unit code "${data.code}" already exists`, 400);
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.code !== undefined) updateData.code = data.code.toUpperCase().trim();
      if (data.address !== undefined) updateData.address = data.address || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.type !== undefined) updateData.type = data.type;

      // Update in transaction with audit log
      const updatedBusinessUnit = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.businessUnit.update({
          where: { id },
          data: updateData,
          include: {
            company: true,
          },
        });

        // Log the update
        try {
          await tx.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'BUSINESS_UNIT',
              entityId: id,
              userId: 'system',
              entityName: updated.name,
              severity: 'INFO',
              changes: {
                updatedFields: Object.keys(data),
              },
            },
          });
        } catch (logError) {
          console.warn('Failed to create audit log:', logError);
        }

        return updated;
      });

      console.log(`✅ Business unit updated: ${updatedBusinessUnit.name} (${updatedBusinessUnit.code})`);
      return updatedBusinessUnit;
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.updateBusinessUnit');
    }
  }

  /**
   * Delete business unit (soft delete preferred)
   */
  async deleteBusinessUnit(id: string) {
    try {
      await this.validateBusinessUnit(id);

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id },
        include: {
          products: {
            where: { isActive: true },
          },
          inventory: true,
          users: {
            where: { isActive: true },
          },
          sales: {
            take: 1,
          },
        },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      const hasAssociations = 
        businessUnit.products.length > 0 || 
        businessUnit.inventory.length > 0 ||
        businessUnit.users.length > 0 ||
        businessUnit.sales.length > 0;

      if (hasAssociations) {
        // Soft delete
        const archived = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const updated = await tx.businessUnit.update({
            where: { id },
            data: {
              isActive: false,
            },
          });

          await tx.businessUnitUser.updateMany({
            where: { businessUnitId: id, isActive: true },
            data: { isActive: false },
          });

          await tx.product.updateMany({
            where: { businessUnitId: id, isActive: true },
            data: { isActive: false },
          });

          try {
            await tx.auditLog.create({
              data: {
                action: 'UPDATE',
                entityType: 'BUSINESS_UNIT',
                entityId: id,
                userId: 'system',
                entityName: businessUnit.name,
                severity: 'HIGH',
                changes: {
                  isActive: { old: true, new: false },
                  status: { old: 'active', new: 'archived' },
                },
              },
            });
          } catch (logError) {
            console.warn('Failed to create audit log:', logError);
          }

          return updated;
        });

        return { 
          message: 'Business unit archived (soft deleted) due to associated records',
          data: archived,
          softDeleted: true,
        };
      }

      // Hard delete if no associations
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.businessUnit.delete({
          where: { id },
        });

        try {
          await tx.auditLog.create({
            data: {
              action: 'DELETE',
              entityType: 'BUSINESS_UNIT',
              entityId: id,
              userId: 'system',
              entityName: businessUnit.name,
              severity: 'HIGH',
            },
          });
        } catch (logError) {
          console.warn('Failed to create audit log:', logError);
        }
      });

      return { 
        message: 'Business unit deleted successfully',
        softDeleted: false,
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.deleteBusinessUnit');
    }
  }

  /**
   * Bulk delete business units
   */
  async bulkDeleteBusinessUnits(ids: string[]): Promise<{ 
    deletedCount: number; 
    softDeletedCount: number;
    errors: string[];
    results: Array<{ id: string; success: boolean; message: string; softDeleted?: boolean }>;
  }> {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('No business unit IDs provided', 400);
      }

      // Validate all IDs
      for (const id of ids) {
        if (!this.isValidID(id)) {
          throw new AppError(`Invalid ID format: ${id}`, 400);
        }
      }

      const results: Array<{ id: string; success: boolean; message: string; softDeleted?: boolean }> = [];
      const errors: string[] = [];
      let deletedCount = 0;
      let softDeletedCount = 0;

      // Process each business unit deletion
      for (const id of ids) {
        try {
          const result = await this.deleteBusinessUnit(id);
          if (result && typeof result === 'object' && 'softDeleted' in result) {
            const deleteResult = result as any;
            if (deleteResult.softDeleted) {
              softDeletedCount++;
            } else {
              deletedCount++;
            }
            results.push({
              id,
              success: true,
              message: deleteResult.message,
              softDeleted: deleteResult.softDeleted,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to delete business unit ${id}: ${errorMessage}`);
          results.push({
            id,
            success: false,
            message: errorMessage,
          });
        }
      }

      return {
        deletedCount,
        softDeletedCount,
        errors,
        results,
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.bulkDeleteBusinessUnits');
    }
  }

  /**
   * Get comprehensive business unit statistics
   */
  async getBusinessUnitStats(id: string): Promise<BusinessUnitStats> {
    try {
      await this.validateBusinessUnit(id);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        products,
        inventoryAgg,
        sales,
        totalRevenue,
        totalCustomers,
        totalEmployees,
        lowStockItems,
        outOfStockItems,
        monthlyRevenue,
        monthlySales,
      ] = await Promise.all([
        this.prisma.product.count({
          where: { businessUnitId: id, isActive: true },
        }),
        this.prisma.inventory.aggregate({
          where: { businessUnitId: id },
          _sum: { quantity: true },
        }),
        this.prisma.sale.count({
          where: { businessUnitId: id },
        }),
        this.prisma.sale.aggregate({
          where: { businessUnitId: id },
          _sum: { total: true },
        }),
        this.prisma.customer.count({
          where: { company: { businessUnits: { some: { id } } } },
        }),
        this.prisma.businessUnitUser.count({
          where: { businessUnitId: id, isActive: true },
        }),
        this.prisma.inventory.count({
          where: {
            businessUnitId: id,
            quantity: { gt: 0, lte: 10 },
          },
        }),
        this.prisma.inventory.count({
          where: {
            businessUnitId: id,
            quantity: 0,
          },
        }),
        this.prisma.sale.aggregate({
          where: {
            businessUnitId: id,
            saleDate: { gte: monthStart },
          },
          _sum: { total: true },
        }),
        this.prisma.sale.count({
          where: {
            businessUnitId: id,
            saleDate: { gte: monthStart },
          },
        }),
      ]);

      return {
        products,
        inventoryTotal: inventoryAgg._sum.quantity || 0,
        sales,
        totalRevenue: totalRevenue._sum.total || 0,
        totalCustomers,
        totalEmployees,
        lowStockItems,
        outOfStockItems,
        monthlyRevenue: monthlyRevenue._sum.total || 0,
        monthlySales,
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getBusinessUnitStats');
    }
  }

  /**
   * Get business unit users
   */
  async getBusinessUnitUsers(businessUnitId: string) {
    try {
      await this.validateBusinessUnit(businessUnitId);

      const users = await this.prisma.businessUnitUser.findMany({
        where: { businessUnitId, isActive: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              phoneNumber: true,
              avatar: true,
              lastLoginAt: true,
            },
          },
        },
        orderBy: { user: { firstName: 'asc' } },
      });

      return users;
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getBusinessUnitUsers');
    }
  }

  /**
   * Add user to business unit
   */
  async addUserToBusinessUnit(businessUnitId: string, userId: string, role?: UserRole) {
    try {
      await this.validateBusinessUnit(businessUnitId);
      await this.validateUser(userId);

      const existing = await this.prisma.businessUnitUser.findFirst({
        where: {
          businessUnitId,
          userId,
        },
      });

      if (existing) {
        if (existing.isActive) {
          throw new AppError('User is already assigned to this business unit', 400);
        } else {
          return await this.prisma.businessUnitUser.update({
            where: { id: existing.id },
            data: {
              isActive: true,
              role: role || existing.role || UserRole.USER,
            },
          });
        }
      }

      return await this.prisma.businessUnitUser.create({
        data: {
          businessUnitId,
          userId,
          role: role || UserRole.USER,
          isActive: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.addUserToBusinessUnit');
    }
  }

  /**
   * Remove user from business unit
   */
  async removeUserFromBusinessUnit(businessUnitId: string, userId: string) {
    try {
      await this.validateBusinessUnit(businessUnitId);
      await this.validateUser(userId);

      const association = await this.prisma.businessUnitUser.findFirst({
        where: {
          businessUnitId,
          userId,
        },
      });

      if (!association) {
        throw new AppError('User is not assigned to this business unit', 404);
      }

      return await this.prisma.businessUnitUser.update({
        where: { id: association.id },
        data: {
          isActive: false,
        },
      });
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.removeUserFromBusinessUnit');
    }
  }

  /**
   * Get or create a default business unit for a company
   */
  async getOrCreateDefaultBusinessUnit(companyId: string): Promise<any> {
    try {
      await this.validateCompany(companyId);

      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      const existing = await this.prisma.businessUnit.findFirst({
        where: {
          companyId: companyId,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (existing) {
        console.log(`✅ Using existing business unit: ${existing.id} (${existing.name})`);
        return existing;
      }

      const newBusinessUnit = await this.prisma.businessUnit.create({
        data: {
          name: `${company.name} - Default Unit`,
          code: `BU-${Date.now().toString().slice(-6)}`,
          isActive: true,
          companyId: companyId,
          type: 'STORE',
        },
      });

      console.log(`✅ Created default business unit: ${newBusinessUnit.id} (${newBusinessUnit.name})`);
      return newBusinessUnit;
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getOrCreateDefaultBusinessUnit');
    }
  }

  /**
   * Ensure a user has at least one business unit
   */
  async ensureUserBusinessUnit(userId: string, companyId: string): Promise<any> {
    try {
      await this.validateUser(userId);
      await this.validateCompany(companyId);

      const userBusinessUnits = await this.prisma.businessUnitUser.findMany({
        where: { 
          userId,
          isActive: true,
        },
        include: {
          businessUnit: true,
        },
      });

      if (userBusinessUnits.length > 0) {
        const active = userBusinessUnits.find((ub: any) => ub.businessUnit.isActive);
        if (active) {
          console.log(`✅ User already has business unit: ${active.businessUnit.id}`);
          return active.businessUnit;
        }
      }

      const businessUnit = await this.getOrCreateDefaultBusinessUnit(companyId);

      await this.prisma.businessUnitUser.create({
        data: {
          userId: userId,
          businessUnitId: businessUnit.id,
          role: UserRole.EMPLOYEE,
          isActive: true,
        },
      });

      console.log(`✅ Assigned user ${userId} to business unit ${businessUnit.id}`);
      return businessUnit;
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.ensureUserBusinessUnit');
    }
  }

  /**
   * Get business units by company
   */
  async getBusinessUnitsByCompany(companyId: string): Promise<any[]> {
    try {
      await this.validateCompany(companyId);

      const businessUnits = await this.prisma.businessUnit.findMany({
        where: {
          companyId: companyId,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              users: true,
              products: true,
              inventory: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return businessUnits;
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getBusinessUnitsByCompany');
    }
  }

  /**
   * Get business unit by code
   */
  async getBusinessUnitByCode(code: string, companyId?: string): Promise<any> {
    try {
      if (!code) {
        throw new AppError('Business unit code is required', 400);
      }

      const where: any = {
        code: {
          equals: code.toUpperCase(),
          mode: 'insensitive',
        },
      };

      if (companyId) {
        await this.validateCompany(companyId);
        where.companyId = companyId;
      }

      const businessUnit = await this.prisma.businessUnit.findFirst({
        where,
        include: {
          company: true,
          _count: {
            select: {
              products: true,
              inventory: true,
              users: true,
            },
          },
        },
      });

      if (!businessUnit) {
        throw new AppError(`Business unit with code "${code}" not found`, 404);
      }

      return businessUnit;
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getBusinessUnitByCode');
    }
  }

  /**
   * Get business unit with full details including products and inventory
   */
  async getBusinessUnitWithDetails(id: string): Promise<any> {
    try {
      await this.validateBusinessUnit(id);

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id },
        include: {
          company: true,
          users: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  avatar: true,
                },
              },
            },
          },
          products: {
            where: { isActive: true },
            include: {
              category: true,
              variants: {
                where: { isActive: true },
              },
            },
            orderBy: { name: 'asc' },
          },
          inventory: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unitPrice: true,
                },
              },
            },
          },
          _count: {
            select: {
              products: true,
              inventory: true,
              sales: true,
              users: true,
            },
          },
        },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      return businessUnit;
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getBusinessUnitWithDetails');
    }
  }
}

export default BusinessUnitService;
