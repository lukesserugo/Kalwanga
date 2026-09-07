// D:\Projects\Kalwanga\packages\backend\src\services\companyService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import type { CreateCompanyDto, UpdateCompanyDto, CompanyQueryParams, CompanyStats } from '../types/company.types.js';

// Import the enum type from Prisma
import { BusinessUnitType } from '../generated/prisma/index.js';

// Extend CreateCompanyDto to include business unit fields
interface ExtendedCreateCompanyDto extends CreateCompanyDto {
  businessUnitName?: string;
  businessUnitCode?: string;
  businessUnitType?: string;
}

export class CompanyService extends BaseService {
  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Get all companies with pagination and filtering
   */
  async getAllCompanies(params: CompanyQueryParams) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = params;

      const skip = (page - 1) * limit;

      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { taxId: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      if (isActive !== undefined) where.isActive = isActive;

      const [companies, total] = await Promise.all([
        this.prisma.company.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            businessUnits: {
              where: { isActive: true },
              include: {
                _count: {
                  select: {
                    products: true,
                    users: true,
                    sales: true,
                  },
                },
              },
            },
            users: {
              where: { isActive: true },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
              take: 5,
            },
            _count: {
              select: {
                businessUnits: true,
                users: true,
                customers: true,
                suppliers: true,
              },
            },
          },
        }),
        this.prisma.company.count({ where }),
      ]);

      const enhancedCompanies = companies.map((company: any) => ({
        ...company,
        businessUnitCount: company._count.businessUnits,
        userCount: company._count.users,
        customerCount: company._count.customers,
        supplierCount: company._count.suppliers,
        recentUsers: company.users,
      }));

      return {
        companies: enhancedCompanies,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'CompanyService.getAllCompanies');
      throw error;
    }
  }

  /**
   * Get company by ID with full details
   */
  async getCompanyById(id: string) {
    try {
      if (!id) {
        throw new AppError('Company ID is required', 400);
      }

      const company = await this.prisma.company.findUnique({
        where: { id },
        include: {
          businessUnits: {
            where: { isActive: true },
            include: {
              _count: {
                select: {
                  products: true,
                  users: true,
                  sales: true,
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
                take: 10,
              },
            },
          },
          users: {
            where: { isActive: true },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              lastLoginAt: true,
            },
            take: 10,
          },
          settings: true,
          salesSettings: true,
          _count: {
            select: {
              businessUnits: true,
              users: true,
              customers: true,
              suppliers: true,
              invoices: true,
              giftCards: true,
              promotions: true,
            },
          },
        },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      // Get stats
      const stats = await this.getCompanyStats(id);

      return {
        ...company,
        stats,
        counts: company._count,
      };
    } catch (error) {
      this.handleError(error, 'CompanyService.getCompanyById');
      throw error;
    }
  }

  /**
   * Get company by email
   */
  async getCompanyByEmail(email: string) {
    try {
      if (!email) {
        throw new AppError('Email is required', 400);
      }

      const company = await this.prisma.company.findUnique({
        where: { email },
        include: {
          businessUnits: {
            where: { isActive: true },
          },
          users: {
            where: { isActive: true },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      return company;
    } catch (error) {
      this.handleError(error, 'CompanyService.getCompanyByEmail');
      throw error;
    }
  }

  /**
   * Create a new company with default business unit
   * Supports creating with custom business unit name and code
   */
  async createCompany(data: ExtendedCreateCompanyDto) {
    try {
      // Validate required fields
      if (!data.name || !data.email || !data.phone) {
        throw new AppError('Name, email, and phone are required', 400);
      }

      // Check if email already exists
      const existing = await this.prisma.company.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        throw new AppError('Company with this email already exists', 400);
      }

      // Create company in transaction
      const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Create the company
        const created = await tx.company.create({
          data: {
            name: data.name.trim(),
            email: data.email.trim(),
            phone: data.phone.trim(),
            address: data.address || null,
            taxId: data.taxId || null,
            currency: data.currency || 'USD',
            timezone: data.timezone || 'UTC',
            logo: data.logo || null,
            isActive: data.isActive !== undefined ? data.isActive : true,
          },
        });

        console.log(`✅ Company created: ${created.name} (${created.id})`);

        // 2. Create default business unit - use provided name or default
        const businessUnitName = data.businessUnitName || 'Main Store';
        const businessUnitCode = data.businessUnitCode || 'MAIN';
        const businessUnitType = data.businessUnitType 
          ? this.mapBusinessUnitType(data.businessUnitType) 
          : BusinessUnitType.STORE;

        const defaultBusinessUnit = await tx.businessUnit.create({
          data: {
            name: businessUnitName,
            code: businessUnitCode.toUpperCase(),
            companyId: created.id,
            isActive: true,
            type: businessUnitType,
            address: data.address || null,
            phone: data.phone || null,
            email: data.email || null,
          },
        });

        console.log(`✅ Default business unit created: ${defaultBusinessUnit.name} (${defaultBusinessUnit.id})`);

        // 3. Create default company settings
        await tx.companySettings.create({
          data: {
            companyId: created.id,
            taxRate: 0,
            taxInclusive: false,
            lowStockThreshold: 10,
            autoReorder: false,
            allowReturns: true,
            requireCustomerForReturn: false,
            maxReturnDays: 30,
            allowCash: true,
            allowCard: true,
            allowMobileMoney: true,
            allowGiftCards: true,
          },
        });

        // 4. Create default sales settings
        const currencySymbol = data.currency === 'UGX' ? 'UGX' : 
                              data.currency === 'EUR' ? '€' : 
                              data.currency === 'GBP' ? '£' : '$';
        
        await tx.salesSettings.create({
          data: {
            companyId: created.id,
            taxRate: 8,
            discountEnabled: true,
            maxDiscount: 20,
            loyaltyPointsEnabled: true,
            pointsPerDollar: 10,
            autoPrintReceipt: true,
            emailReceipts: true,
            receiptFooter: 'Thank you for your business!',
            defaultPaymentMethod: 'CASH',
            currencySymbol: currencySymbol,
            currencyCode: data.currency || 'USD',
            invoicePrefix: 'INV-',
            receiptPrefix: 'RCP-',
          },
        });

        // 5. Create audit log
        try {
          await tx.auditLog.create({
            data: {
              action: 'CREATE',
              entityType: 'COMPANY',
              entityId: created.id,
              entityName: created.name,
              userId: 'system',
              severity: 'HIGH',
              changes: {
                name: created.name,
                email: created.email,
                phone: created.phone,
                businessUnitId: defaultBusinessUnit.id,
                businessUnitName: defaultBusinessUnit.name,
              },
            },
          });
        } catch (auditError) {
          console.warn('Audit log creation skipped:', auditError);
        }

        // Return company with business units included
        return {
          ...created,
          businessUnits: [defaultBusinessUnit],
          defaultBusinessUnit: defaultBusinessUnit,
        };
      });

      console.log(`✅ Company created successfully with business unit: ${result.name} (${result.id})`);
      return result;
    } catch (error) {
      this.handleError(error, 'CompanyService.createCompany');
      throw error;
    }
  }

  /**
   * Map string business unit type to enum
   */
  private mapBusinessUnitType(type: string): BusinessUnitType {
    const normalizedType = type.toUpperCase();
    const enumValues = Object.values(BusinessUnitType);
    const matched = enumValues.find(v => v === normalizedType);
    if (matched) {
      return matched;
    }
    // Default to STORE if invalid
    return BusinessUnitType.STORE;
  }

  /**
   * Update company
   */
  async updateCompany(id: string, data: UpdateCompanyDto) {
    try {
      if (!id) {
        throw new AppError('Company ID is required', 400);
      }

      const company = await this.prisma.company.findUnique({
        where: { id },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      // Check email uniqueness if being changed
      if (data.email && data.email !== company.email) {
        const existing = await this.prisma.company.findUnique({
          where: { email: data.email },
        });
        if (existing) {
          throw new AppError('Company with this email already exists', 400);
        }
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.email !== undefined) updateData.email = data.email.trim();
      if (data.phone !== undefined) updateData.phone = data.phone.trim();
      if (data.address !== undefined) updateData.address = data.address || null;
      if (data.taxId !== undefined) updateData.taxId = data.taxId || null;
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.timezone !== undefined) updateData.timezone = data.timezone;
      if (data.logo !== undefined) updateData.logo = data.logo || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const updatedCompany = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.company.update({
          where: { id },
          data: updateData,
          include: {
            businessUnits: {
              where: { isActive: true },
            },
            users: {
              where: { isActive: true },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
              take: 10,
            },
          },
        });

        // Create audit log
        try {
          await tx.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'COMPANY',
              entityId: id,
              entityName: updated.name,
              userId: 'system',
              severity: 'INFO',
              changes: {
                updatedFields: Object.keys(updateData),
              },
            },
          });
        } catch (auditError) {
          console.warn('Audit log creation skipped:', auditError);
        }

        return updated;
      });

      console.log(`✅ Company updated: ${updatedCompany.name} (${updatedCompany.id})`);
      return updatedCompany;
    } catch (error) {
      this.handleError(error, 'CompanyService.updateCompany');
      throw error;
    }
  }

  /**
   * Delete company (soft delete preferred)
   */
  async deleteCompany(id: string) {
    try {
      if (!id) {
        throw new AppError('Company ID is required', 400);
      }

      const company = await this.prisma.company.findUnique({
        where: { id },
        include: {
          businessUnits: {
            where: { isActive: true },
          },
          users: {
            where: { isActive: true },
            take: 1,
          },
          customers: {
            take: 1,
          },
          suppliers: {
            take: 1,
          },
        },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      const hasAssociations = 
        company.businessUnits.length > 0 ||
        company.users.length > 0 ||
        company.customers.length > 0 ||
        company.suppliers.length > 0;

      if (hasAssociations) {
        // Soft delete
        const archived = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const updated = await tx.company.update({
            where: { id },
            data: { isActive: false },
          });

          // Deactivate all business units
          await tx.businessUnit.updateMany({
            where: { companyId: id, isActive: true },
            data: { isActive: false },
          });

          // Deactivate all users
          await tx.user.updateMany({
            where: { companyId: id, isActive: true },
            data: { isActive: false },
          });

          // Create audit log
          try {
            await tx.auditLog.create({
              data: {
                action: 'UPDATE',
                entityType: 'COMPANY',
                entityId: id,
                entityName: company.name,
                userId: 'system',
                severity: 'HIGH',
                changes: {
                  isActive: { old: true, new: false },
                  status: 'archived',
                },
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation skipped:', auditError);
          }

          return updated;
        });

        return {
          message: 'Company archived (soft deleted) due to associated records',
          company: archived,
          softDeleted: true,
        };
      }

      // Hard delete if no associations
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Delete related settings first
        await tx.companySettings.deleteMany({
          where: { companyId: id },
        });
        await tx.salesSettings.deleteMany({
          where: { companyId: id },
        });

        await tx.company.delete({
          where: { id },
        });

        // Create audit log
        try {
          await tx.auditLog.create({
            data: {
              action: 'DELETE',
              entityType: 'COMPANY',
              entityId: id,
              entityName: company.name,
              userId: 'system',
              severity: 'HIGH',
            },
          });
        } catch (auditError) {
          console.warn('Audit log creation skipped:', auditError);
        }
      });

      return {
        message: 'Company deleted successfully',
        softDeleted: false,
      };
    } catch (error) {
      this.handleError(error, 'CompanyService.deleteCompany');
      throw error;
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get company statistics
   */
  async getCompanyStats(id: string): Promise<CompanyStats> {
    try {
      if (!id) {
        throw new AppError('Company ID is required', 400);
      }

      const company = await this.prisma.company.findUnique({
        where: { id },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      const [
        totalUsers,
        totalBusinessUnits,
        totalProducts,
        totalSales,
        totalRevenue,
        totalCustomers,
        totalSuppliers,
      ] = await Promise.all([
        this.prisma.user.count({
          where: { companyId: id, isActive: true },
        }),
        this.prisma.businessUnit.count({
          where: { companyId: id, isActive: true },
        }),
        this.prisma.product.count({
          where: { 
            businessUnit: { companyId: id },
            isActive: true,
          },
        }),
        this.prisma.sale.count({
          where: { 
            businessUnit: { companyId: id },
            status: 'COMPLETED',
          },
        }),
        this.prisma.sale.aggregate({
          where: { 
            businessUnit: { companyId: id },
            status: 'COMPLETED',
          },
          _sum: { total: true },
        }),
        this.prisma.customer.count({
          where: { companyId: id, isActive: true },
        }),
        this.prisma.supplier.count({
          where: { companyId: id, isActive: true },
        }),
      ]);

      return {
        totalUsers,
        totalBusinessUnits,
        totalProducts,
        totalSales,
        totalRevenue: totalRevenue._sum.total || 0,
        totalCustomers,
        totalSuppliers,
      };
    } catch (error) {
      this.handleError(error, 'CompanyService.getCompanyStats');
      throw error;
    }
  }

  /**
   * Add a business unit to a company
   */
  async addBusinessUnit(companyId: string, data: { 
    name: string; 
    code: string; 
    address?: string; 
    phone?: string; 
    email?: string; 
    type?: string;
  }) {
    try {
      if (!companyId) {
        throw new AppError('Company ID is required', 400);
      }

      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      // Check if business unit code already exists
      const existing = await this.prisma.businessUnit.findFirst({
        where: {
          code: data.code.toUpperCase(),
          companyId: companyId,
        },
      });

      if (existing) {
        throw new AppError(`Business unit with code "${data.code}" already exists for this company`, 400);
      }

      const businessUnitType = data.type 
        ? this.mapBusinessUnitType(data.type) 
        : BusinessUnitType.STORE;

      const businessUnit = await this.prisma.businessUnit.create({
        data: {
          name: data.name.trim(),
          code: data.code.trim().toUpperCase(),
          companyId: companyId,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          type: businessUnitType,
          isActive: true,
        },
      });

      // Create audit log
      try {
        await this.prisma.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'BUSINESS_UNIT',
            entityId: businessUnit.id,
            entityName: businessUnit.name,
            userId: 'system',
            severity: 'INFO',
            changes: {
              name: businessUnit.name,
              code: businessUnit.code,
              type: businessUnit.type,
              companyId: companyId,
            },
          },
        });
      } catch (auditError) {
        console.warn('Audit log creation skipped:', auditError);
      }

      console.log(`✅ Business unit added: ${businessUnit.name} (${businessUnit.id}) to company ${company.name}`);
      return businessUnit;
    } catch (error) {
      this.handleError(error, 'CompanyService.addBusinessUnit');
      throw error;
    }
  }

  /**
   * Get default business unit for a company
   */
  async getDefaultBusinessUnit(companyId: string) {
    try {
      if (!companyId) {
        throw new AppError('Company ID is required', 400);
      }

      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      // Get the first active business unit (oldest)
      const defaultBusinessUnit = await this.prisma.businessUnit.findFirst({
        where: {
          companyId: companyId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
        include: {
          _count: {
            select: {
              products: true,
              users: true,
              sales: true,
            },
          },
        },
      });

      if (!defaultBusinessUnit) {
        // Create a default business unit if none exists
        return await this.prisma.businessUnit.create({
          data: {
            name: 'Main Store',
            code: 'MAIN',
            companyId: companyId,
            isActive: true,
            type: BusinessUnitType.STORE,
          },
        });
      }

      return defaultBusinessUnit;
    } catch (error) {
      this.handleError(error, 'CompanyService.getDefaultBusinessUnit');
      throw error;
    }
  }

  /**
   * Get company by business unit ID
   */
  async getCompanyByBusinessUnitId(businessUnitId: string) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        include: {
          company: {
            include: {
              businessUnits: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      // ✅ FIX: Check if company exists before returning
      if (!businessUnit.company) {
        throw new AppError('Company not found for this business unit', 404);
      }

      return businessUnit.company;
    } catch (error) {
      this.handleError(error, 'CompanyService.getCompanyByBusinessUnitId');
      throw error;
    }
  }

  // ============================================
  // DEFAULT COMPANY
  // ============================================

  /**
   * Get or create default company
   */
  async getOrCreateDefaultCompany(): Promise<any> {
    try {
      // Try to find an existing active company
      let company = await this.prisma.company.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        include: {
          businessUnits: {
            where: { isActive: true },
          },
        },
      });

      if (company) {
        return company;
      }

      // Create a default company with business unit
      company = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.company.create({
          data: {
            name: 'Default Company',
            email: 'default@company.com',
            phone: '+1234567890',
            address: 'Default Address',
            isActive: true,
            currency: 'USD',
            timezone: 'UTC',
          },
        });

        // Create default business unit
        await tx.businessUnit.create({
          data: {
            name: 'Main Store',
            code: 'MAIN',
            companyId: created.id,
            isActive: true,
            type: BusinessUnitType.STORE,
          },
        });

        // Create default company settings
        await tx.companySettings.create({
          data: {
            companyId: created.id,
            taxRate: 0,
            taxInclusive: false,
            lowStockThreshold: 10,
            autoReorder: false,
            allowReturns: true,
            requireCustomerForReturn: false,
            maxReturnDays: 30,
            allowCash: true,
            allowCard: true,
            allowMobileMoney: true,
            allowGiftCards: true,
          },
        });

        // Create default sales settings
        await tx.salesSettings.create({
          data: {
            companyId: created.id,
            taxRate: 8,
            discountEnabled: true,
            maxDiscount: 20,
            loyaltyPointsEnabled: true,
            pointsPerDollar: 10,
            autoPrintReceipt: true,
            emailReceipts: true,
            receiptFooter: 'Thank you for your business!',
            defaultPaymentMethod: 'CASH',
            currencySymbol: '$',
            currencyCode: 'USD',
            invoicePrefix: 'INV-',
            receiptPrefix: 'RCP-',
          },
        });

        // Return company with business units
        return await tx.company.findUnique({
          where: { id: created.id },
          include: {
            businessUnits: {
              where: { isActive: true },
            },
          },
        });
      });

      console.log(`✅ Created default company: ${company?.id}`);
      return company;
    } catch (error) {
      this.handleError(error, 'CompanyService.getOrCreateDefaultCompany');
      throw error;
    }
  }

  /**
   * Ensure a user has a company
   */
  async ensureUserCompany(userId: string): Promise<any> {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // If user already has a company, return it
      if (user.companyId) {
        const company = await this.prisma.company.findUnique({
          where: { id: user.companyId },
          include: {
            businessUnits: {
              where: { isActive: true },
            },
          },
        });
        if (company && company.isActive) {
          return company;
        }
      }

      // Get or create default company
      const company = await this.getOrCreateDefaultCompany();

      if (company) {
        // Assign user to company
        await this.prisma.user.update({
          where: { id: userId },
          data: { companyId: company.id },
        });
      }

      return company;
    } catch (error) {
      this.handleError(error, 'CompanyService.ensureUserCompany');
      throw error;
    }
  }

  /**
   * Search companies with advanced filters
   */
  async searchCompanies(params: {
    query: string;
    limit?: number;
    page?: number;
    isActive?: boolean;
  }) {
    try {
      const { query, limit = 10, page = 1, isActive } = params;

      if (!query || query.trim().length === 0) {
        throw new AppError('Search query is required', 400);
      }

      const skip = (page - 1) * limit;

      const where: any = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { taxId: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (isActive !== undefined) where.isActive = isActive;

      const [companies, total] = await Promise.all([
        this.prisma.company.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            businessUnits: {
              where: { isActive: true },
              take: 3,
            },
            _count: {
              select: {
                businessUnits: true,
                users: true,
              },
            },
          },
        }),
        this.prisma.company.count({ where }),
      ]);

      return {
        companies,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'CompanyService.searchCompanies');
      throw error;
    }
  }

  /**
   * Get company activity feed
   */
  async getCompanyActivity(id: string, params?: { limit?: number; offset?: number }) {
    try {
      if (!id) {
        throw new AppError('Company ID is required', 400);
      }

      const { limit = 20, offset = 0 } = params || {};

      // Check if company exists
      const company = await this.prisma.company.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      // Now we know company exists, fetch activities
      const activities = await this.prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'COMPANY', entityId: id },
            { companyId: id },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      const total = await this.prisma.auditLog.count({
        where: {
          OR: [
            { entityType: 'COMPANY', entityId: id },
            { companyId: id },
          ],
        },
      });

      return {
        activities,
        total,
        limit,
        offset,
      };
    } catch (error) {
      this.handleError(error, 'CompanyService.getCompanyActivity');
      throw error;
    }
  }
}

export const companyService = new CompanyService();
