// packages/backend/src/services/customerService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js'; // Fixed import path

// Define types for customer service
interface CustomerCreateData {
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
  companyId: string;
}

interface CustomerResponse {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  address?: string | null; // Fixed: accept null
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  notes?: string | null;
  companyId: string;
  isActive: boolean;
  loyaltyPoints: number;
  totalSpent: number;
  lastPurchaseAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  salesCount?: number;
  ordersCount?: number;
  giftCardCount?: number; // Added missing property
}

export class CustomerService extends BaseService {
  /**
   * Get all customers with pagination and filtering
   */
  async getAllCustomers(params: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
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
      } = params;
      
      const skip = (page - 1) * limit;

      const where: Prisma.CustomerWhereInput = {};
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (companyId) where.companyId = companyId;
      if (isActive !== undefined) where.isActive = isActive;

      const [customers, total] = await Promise.all([
        this.prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder } as any,
          include: {
            _count: {
              select: {
                sales: true,
                orders: true,
                giftCards: {
                  where: { isActive: true },
                },
              },
            },
            sales: {
              orderBy: { saleDate: 'desc' } as any,
              take: 5,
              select: {
                id: true,
                receiptNumber: true,
                total: true,
                saleDate: true,
              },
            },
          },
        }),
        this.prisma.customer.count({ where }),
      ]);

      // Enhance customers with computed fields
      const enhancedCustomers = customers.map((customer: any) => ({
        ...customer,
        fullName: `${customer.firstName} ${customer.lastName}`.trim(),
        salesCount: customer._count?.sales || 0,
        ordersCount: customer._count?.orders || 0,
        activeGiftCards: customer._count?.giftCards || 0,
      }));

      return {
        customers: enhancedCustomers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.handleError(error, 'CustomerService.getAllCustomers');
    }
  }

  /**
   * Get customer by ID with full details
   */
  async getCustomerById(id: string): Promise<CustomerResponse> {
    try {
      if (!id) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id },
        include: {
          orders: {
            orderBy: { createdAt: 'desc' } as any,
            take: 10,
          },
          sales: {
            orderBy: { saleDate: 'desc' } as any,
            take: 10,
            include: {
              items: {
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
            },
          },
          giftCards: {
            where: { isActive: true },
          },
          loyaltyHistory: {
            orderBy: { createdAt: 'desc' } as any,
            take: 20,
          },
          _count: {
            select: {
              sales: true,
              orders: true,
              giftCards: true,
            },
          },
        },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      return {
        ...customer,
        fullName: `${customer.firstName} ${customer.lastName}`.trim(),
        salesCount: customer._count?.sales || 0,
        ordersCount: customer._count?.orders || 0,
        giftCardCount: customer._count?.giftCards || 0,
      };
    } catch (error) {
      this.handleError(error, 'CustomerService.getCustomerById');
    }
  }

  /**
   * Create a new customer
   */
  async createCustomer(data: CustomerCreateData): Promise<CustomerResponse> {
    try {
      // Validate required fields
      if (!data.email || !data.firstName || !data.lastName || !data.companyId) {
        throw new AppError('Email, first name, last name, and company ID are required', 400);
      }

      // Check if email already exists
      const existing = await this.prisma.customer.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        throw new AppError('Customer with this email already exists', 400);
      }

      // Check if phone number already exists
      if (data.phoneNumber) {
        const existingPhone = await this.prisma.customer.findFirst({
          where: { phoneNumber: data.phoneNumber },
        });

        if (existingPhone) {
          throw new AppError('Customer with this phone number already exists', 400);
        }
      }

      // Create in transaction with audit log
      const customer = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.customer.create({
          data: {
            email: data.email,
            phoneNumber: data.phoneNumber,
            firstName: data.firstName,
            lastName: data.lastName,
            address: data.address,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            country: data.country || 'Uganda',
            notes: data.notes,
            companyId: data.companyId,
            isActive: true,
            loyaltyPoints: 0,
            totalSpent: 0,
          },
        });

        // Log creation (removed metadata field)
        try {
          await tx.auditLog.create({
            data: {
              action: 'CREATE',
              entityType: 'CUSTOMER',
              entityId: created.id,
              user: { connect: { id: 'system' } },
            },
          });
        } catch (error) {
          console.warn('Failed to create audit log:', error);
        }

        return created;
      });

      return {
        ...customer,
        fullName: `${customer.firstName} ${customer.lastName}`.trim(),
      };
    } catch (error) {
      this.handleError(error, 'CustomerService.createCustomer');
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(id: string, data: Partial<CustomerCreateData>): Promise<CustomerResponse> {
    try {
      if (!id) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      // Check if email is being changed and already exists
      if (data.email && data.email !== customer.email) {
        const existing = await this.prisma.customer.findUnique({
          where: { email: data.email },
        });
        if (existing) {
          throw new AppError('Customer with this email already exists', 400);
        }
      }

      // Check if phone is being changed and already exists
      if (data.phoneNumber && data.phoneNumber !== customer.phoneNumber) {
        const existingPhone = await this.prisma.customer.findFirst({
          where: { phoneNumber: data.phoneNumber },
        });
        if (existingPhone) {
          throw new AppError('Customer with this phone number already exists', 400);
        }
      }

      // Remove undefined fields
      const updateData: any = {};
      Object.keys(data).forEach(key => {
        if (data[key as keyof CustomerCreateData] !== undefined) {
          updateData[key] = data[key as keyof CustomerCreateData];
        }
      });

      // Update in transaction with audit log
      const updatedCustomer = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.customer.update({
          where: { id },
          data: updateData,
        });

        // Log update (removed metadata field)
        try {
          await tx.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'CUSTOMER',
              entityId: id,
              user: { connect: { id: 'system' } },
            },
          });
        } catch (error) {
          console.warn('Failed to create audit log:', error);
        }

        return updated;
      });

      return {
        ...updatedCustomer,
        fullName: `${updatedCustomer.firstName} ${updatedCustomer.lastName}`.trim(),
      };
    } catch (error) {
      this.handleError(error, 'CustomerService.updateCustomer');
    }
  }

  /**
   * Delete customer (soft delete)
   */
  async deleteCustomer(id: string) {
    try {
      if (!id) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id },
        include: {
          orders: true,
          sales: true,
          giftCards: true,
        },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      // Soft delete - deactivate and mark as deleted
      const deletedCustomer = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.customer.update({
          where: { id },
          data: { 
            isActive: false,
            deletedAt: new Date(),
          },
        });

        // Deactivate gift cards
        if (customer.giftCards.length > 0) {
          await tx.giftCard.updateMany({
            where: { 
              customerId: id,
              isActive: true,
            },
            data: { isActive: false },
          });
        }

        // Log deletion (removed metadata field)
        try {
          await tx.auditLog.create({
            data: {
              action: 'DELETE',
              entityType: 'CUSTOMER',
              entityId: id,
              user: { connect: { id: 'system' } },
            },
          });
        } catch (error) {
          console.warn('Failed to create audit log:', error);
        }

        return updated;
      });

      return deletedCustomer;
    } catch (error) {
      this.handleError(error, 'CustomerService.deleteCustomer');
    }
  }

  /**
   * Add loyalty points
   */
  async addLoyaltyPoints(customerId: string, points: number, reason?: string) {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }
      if (!points || points <= 0) {
        throw new AppError('Points must be positive', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.customer.update({
          where: { id: customerId },
          data: {
            loyaltyPoints: {
              increment: points,
            },
          },
        });

        // Create loyalty history (added userId field)
        await tx.loyaltyHistory.create({
          data: {
            customerId,
            points,
            type: 'EARN',
            notes: reason || 'Manual points addition',
            userId: 'system',
          },
        });

        return updated;
      });
    } catch (error) {
      this.handleError(error, 'CustomerService.addLoyaltyPoints');
    }
  }

  /**
   * Redeem loyalty points
   */
  async redeemLoyaltyPoints(customerId: string, points: number, reason?: string) {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }
      if (!points || points <= 0) {
        throw new AppError('Points must be positive', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      if (customer.loyaltyPoints < points) {
        throw new AppError('Insufficient loyalty points', 400);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.customer.update({
          where: { id: customerId },
          data: {
            loyaltyPoints: {
              decrement: points,
            },
          },
        });

        // Create loyalty history (added userId field)
        await tx.loyaltyHistory.create({
          data: {
            customerId,
            points: -points,
            type: 'REDEEM',
            notes: reason || 'Manual points redemption',
            userId: 'system',
          },
        });

        return updated;
      });
    } catch (error) {
      this.handleError(error, 'CustomerService.redeemLoyaltyPoints');
    }
  }

  /**
   * Get comprehensive customer statistics
   */
  async getCustomerStats(id: string) {
    try {
      if (!id) {
        throw new AppError('Customer ID is required', 400);
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [
        salesAgg,
        ordersCount,
        giftCardsCount,
        loyaltyHistory,
        monthlySales,
        yearlySales,
      ] = await Promise.all([
        // Total sales aggregation
        this.prisma.sale.aggregate({
          where: { customerId: id },
          _sum: { total: true },
          _count: true,
          _avg: { total: true },
        }),
        // Total orders
        this.prisma.order.count({
          where: { customerId: id },
        }),
        // Active gift cards
        this.prisma.giftCard.count({
          where: { customerId: id, isActive: true },
        }),
        // Loyalty history
        this.prisma.loyaltyHistory.aggregate({
          where: { customerId: id },
          _sum: { points: true },
          _count: true,
        }),
        // Monthly sales
        this.prisma.sale.aggregate({
          where: { 
            customerId: id,
            saleDate: { gte: monthStart },
          },
          _sum: { total: true },
          _count: true,
        }),
        // Yearly sales
        this.prisma.sale.aggregate({
          where: { 
            customerId: id,
            saleDate: { gte: yearStart },
          },
          _sum: { total: true },
          _count: true,
        }),
      ]);

      return {
        totalSpent: salesAgg._sum.total || 0,
        totalSales: salesAgg._count,
        averageSaleValue: salesAgg._avg.total || 0,
        totalOrders: ordersCount,
        activeGiftCards: giftCardsCount,
        loyaltyPointsEarned: loyaltyHistory._sum.points || 0,
        loyaltyTransactions: loyaltyHistory._count,
        monthlySpent: monthlySales._sum.total || 0,
        monthlySales: monthlySales._count,
        yearlySpent: yearlySales._sum.total || 0,
        yearlySales: yearlySales._count,
      };
    } catch (error) {
      this.handleError(error, 'CustomerService.getCustomerStats');
    }
  }

  /**
   * Get customer purchase history
   */
  async getCustomerPurchaseHistory(customerId: string, params?: { page?: number; limit?: number }) {
    try {
      if (!customerId) {
        throw new AppError('Customer ID is required', 400);
      }

      const { page = 1, limit = 10 } = params || {};
      const skip = (page - 1) * limit;

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new AppError('Customer not found', 404);
      }

      const [sales, total] = await Promise.all([
        this.prisma.sale.findMany({
          where: { customerId },
          skip,
          take: limit,
          orderBy: { saleDate: 'desc' },
          include: {
            items: {
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
            payments: {
              select: {
                id: true,
                paymentMethod: true,
                amount: true,
                status: true,
              },
            },
          },
        }),
        this.prisma.sale.count({ where: { customerId } }),
      ]);

      return {
        sales,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'CustomerService.getCustomerPurchaseHistory');
    }
  }

  /**
   * Search customers
   */
  async searchCustomers(search: string, companyId?: string) {
    try {
      if (!search) {
        throw new AppError('Search term is required', 400);
      }

      const where: Prisma.CustomerWhereInput = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      };

      if (companyId) {
        where.companyId = companyId;
      }

      const customers = await this.prisma.customer.findMany({
        where,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          loyaltyPoints: true,
          totalSpent: true,
          isActive: true,
        },
      });

      return customers.map(customer => ({
        ...customer,
        fullName: `${customer.firstName} ${customer.lastName}`.trim(),
      }));
    } catch (error) {
      this.handleError(error, 'CustomerService.searchCustomers');
    }
  }
}
