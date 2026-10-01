// src/services/businessUnitService.ts
import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  Prisma,
  BusinessUnitType,
  UserRole,
} from '../generated/prisma/index.js';
import { currencyService } from './currencyService.js';
import { currencyMigrationService } from './currencyMigrationService.js';
import { findCurrency } from '../lib/currencies.js';

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
  /**
   * ISO 4217 settlement currency for this BU's ledger.
   *
   * When omitted, the platform default is applied via
   * `currencyService.getDefault()` — never a hardcoded literal.
   * Must be a `settlementAllowed: true` currency, or the call is
   * rejected with 400.
   */
  currency?: string;
}

interface UpdateBusinessUnitData {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
  type?: BusinessUnitType;
  /**
   * ISO 4217 settlement currency.
   *
   * ⚠ Changing this via `updateBusinessUnit` is BLOCKED when the BU
   *   has any dirty records (open carts, pending sales, pending
   *   payments, pending orders, draft invoices). Use
   *   `changeBusinessUnitCurrency()` instead, which runs the dirty
   *   check and offers the conversion path.
   *
   * This field is accepted on update ONLY when the BU is clean
   * (dirty counts all zero). Otherwise 409.
   */
  currency?: string;
}

interface ChangeCurrencyParams {
  businessUnitId: string;
  targetCurrency: string;
  /**
   * When the BU has dirty records, the admin must pass `true` to
   * acknowledge that a conversion will run. The service refuses the
   * change without it.
   */
  acknowledgeDirtyRecords?: boolean;
  /**
   * Rate to apply for the conversion (`from → to`). Required when
   * dirty records exist. Ignored when the BU is clean.
   */
  conversionRate?: number;
  reason?: string | null;
  userId: string;
}

interface ChangeCurrencyResult {
  businessUnit: any;
  mode: 'simple' | 'migrated';
  fromCurrency: string;
  toCurrency: string;
  dirtyCounts?: {
    carts: number;
    sales: number;
    payments: number;
    orders: number;
    invoices: number;
  };
  conversionRate?: number;
  convertedRecords?: {
    carts: number;
    sales: number;
    payments: number;
    orders: number;
    invoices: number;
  };
}

export class BusinessUnitService extends BaseService {
  // ============================================
  // ID VALIDATION (Supports CUID and UUID)
  // ============================================

  /**
   * Validate if a string is a valid ID (CUID or UUID).
   * Prisma generates CUIDs by default (e.g. "cmta9eosu000050c9wv812exa")
   * but some models use UUIDs.
   */
  private isValidID(id: string): boolean {
    const cuidRegex = /^c[a-z0-9]{24}$/i;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;

    return (
      cuidRegex.test(id) ||
      uuidRegex.test(id) ||
      simpleIdRegex.test(id)
    );
  }

  /**
   * Validate and ensure a business unit exists.
   */
  private async validateBusinessUnit(id: string): Promise<any> {
    if (!id) {
      throw new AppError('Business unit ID is required', 400);
    }

    if (!this.isValidID(id)) {
      throw new AppError(
        'Invalid business unit ID format. Must be a valid ID.',
        400,
      );
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
   * Validate a company ID.
   */
  private async validateCompany(id: string): Promise<any> {
    if (!id) {
      throw new AppError('Company ID is required', 400);
    }

    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new AppError(`Company not found with ID: ${id}`, 404);
    }

    return company;
  }

  // NOTE: `validateUser` is inherited from `BaseService`. Do NOT
  // redeclare it here — a private redeclaration would narrow the
  // inherited signature and TypeScript would reject the class
  // (error 2415: property is private in subtype but not in base).

  // ============================================
  // CURRENCY HELPERS
  // ============================================

  /**
   * Validate a candidate settlement currency code.
   *
   * A BU's ledger currency must be:
   *   • a known currency in the registry
   *   • `settlementAllowed: true` (has an FX market and at least one
   *     gateway that settles in it)
   *
   * Returns the canonical uppercase code. Throws 400 otherwise.
   * Never hardcodes a currency — the registry is the only source.
   */
  private assertSettlementCurrency(code: string): string {
    const upper = code.trim().toUpperCase();
    const meta = findCurrency(upper);

    if (!meta) {
      throw new AppError(`Unknown currency: ${upper}`, 400);
    }

    if (!meta.settlementAllowed) {
      throw new AppError(
        `${upper} cannot be used as a settlement currency. ` +
          `It is display-only or has no gateway settlement support.`,
        400,
      );
    }

    return upper;
  }

  /**
   * Read the current ledger currency of a BU, resolved through the
   * registry. Used by the dirty-check path and by every audit log
   * entry that records a currency change.
   */
  private async readBusinessUnitCurrency(
    businessUnitId: string,
  ): Promise<string> {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { currency: true },
    });
    if (!bu) throw new AppError('Business unit not found', 404);
    return currencyService.resolveForBusiness(bu.currency);
  }

  // ============================================
  // BUSINESS UNIT METHODS
  // ============================================

  /**
   * Get all business units with pagination and filtering.
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
        // Resolve the display symbol at read time from the registry.
        // Never persisted — the registry is the single source.
        currencySymbol:
          currencyService.tryGetCurrency(bu.currency)?.symbol ??
          bu.currency,
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
      throw error;
    }
  }

  /**
   * Get business unit by ID with full details.
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
        // Derived symbol — never stored.
        currencySymbol:
          currencyService.tryGetCurrency(businessUnit.currency)?.symbol ??
          businessUnit.currency,
        stats,
        counts: businessUnit._count,
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.getBusinessUnitById');
      throw error;
    }
  }

  /**
   * Create a new business unit.
   *
   * When `currency` is supplied, it must be a valid settlement
   * currency. When omitted, the platform default applies (from the
   * registry, never a hardcoded literal).
   */
  async createBusinessUnit(data: CreateBusinessUnitData) {
    try {
      if (!data.name) {
        throw new AppError('Business unit name is required', 400);
      }
      if (!data.code) {
        throw new AppError('Business unit code is required', 400);
      }
      if (!data.companyId) {
        throw new AppError('Company ID is required', 400);
      }

      // ── Resolve the settlement currency ────────────────────
      // Explicit value → validate as settlement currency.
      // Omitted → registry default (UGX unless overridden by env).
      const resolvedCurrency = data.currency
        ? this.assertSettlementCurrency(data.currency)
        : currencyService.getDefault();

      // Ensure the company exists; create a stub if not.
      let company = await this.prisma.company.findUnique({
        where: { id: data.companyId },
      });

      if (!company) {
        company = await this.prisma.company.findFirst({
          where: { name: data.name },
        });

        if (!company) {
          company = await this.prisma.company.create({
            data: {
              name: data.name,
              email:
                data.email ||
                `${data.code.toLowerCase()}@company.com`,
              phone: data.phone || '',
              // Company-level default also resolved from the
              // registry, never hardcoded.
              currency: resolvedCurrency,
            },
          });
        }
      }

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
          currency: resolvedCurrency,
        },
      });

      return {
        ...businessUnit,
        currencySymbol:
          currencyService.tryGetCurrency(businessUnit.currency)?.symbol ??
          businessUnit.currency,
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.createBusinessUnit');
      throw error;
    }
  }

  /**
   * Update business unit non-currency fields.
   *
   * ⚠ Currency changes via this method are BLOCKED when the BU has
   *   dirty records. Use `changeBusinessUnitCurrency()` instead —
   *   it runs the dirty check and offers the conversion path.
   *
   * When the BU is clean (all dirty counts zero), a `currency` field
   * in `data` is accepted and applied directly.
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
          throw new AppError(
            `Business unit code "${data.code}" already exists`,
            400,
          );
        }
      }

      // ── Currency change gate ──────────────────────────────
      // If the caller sent a currency different from the current
      // one, run the dirty check. Clean BUs get a simple swap;
      // dirty BUs are refused here (the admin must use the
      // dedicated changeCurrency endpoint which handles the
      // conversion).
      let currencyChange: string | null = null;
      if (data.currency !== undefined) {
        const target = this.assertSettlementCurrency(data.currency);
        const current = currencyService.resolveForBusiness(
          businessUnit.currency,
        );
        if (target !== current) {
          const dirty =
            await currencyMigrationService.countDirtyRecords(id);
          const totalDirty =
            dirty.carts +
            dirty.sales +
            dirty.payments +
            dirty.orders +
            dirty.invoices;

          if (totalDirty > 0) {
            await currencyMigrationService.logBlockedChange({
              businessUnitId: id,
              attemptedCurrency: target,
              currentCurrency: current,
              dirtyCounts: dirty,
              userId: 'system',
            });
            throw new AppError(
              `Cannot change currency from ${current} to ${target}: ` +
                `the business unit has ${totalDirty} dirty record(s). ` +
                `Use the dedicated currency-change endpoint to run a ` +
                `conversion first.`,
              409,
            );
          }

          currencyChange = target;
        }
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.code !== undefined)
        updateData.code = data.code.toUpperCase().trim();
      if (data.address !== undefined)
        updateData.address = data.address || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.isActive !== undefined)
        updateData.isActive = data.isActive;
      if (data.type !== undefined) updateData.type = data.type;
      if (currencyChange !== null)
        updateData.currency = currencyChange;

      const updatedBusinessUnit = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updated = await tx.businessUnit.update({
            where: { id },
            data: updateData,
            include: { company: true },
          });

          await tx.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'BUSINESS_UNIT',
              entityId: id,
              userId: 'system',
              entityName: updated.name,
              businessUnitId: id,
              severity: currencyChange ? 'HIGH' : 'INFO',
              changes: {
                updatedFields: Object.keys(data),
                currencyChange: currencyChange
                  ? {
                      from: currencyService.resolveForBusiness(
                        businessUnit.currency,
                      ),
                      to: currencyChange,
                    }
                  : undefined,
              },
            },
          });

          return updated;
        },
      );

      return {
        ...updatedBusinessUnit,
        currencySymbol:
          currencyService.tryGetCurrency(
            updatedBusinessUnit.currency,
          )?.symbol ?? updatedBusinessUnit.currency,
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.updateBusinessUnit');
      throw error;
    }
  }

  /**
   * Change the settlement currency of a business unit.
   *
   * THE single entry point for admin currency changes. Behaviour:
   *
   *   1. Validate the target is a `settlementAllowed` currency.
   *   2. Count dirty records (open carts, pending sales/payments/
   *      orders, draft invoices).
   *   3. If dirty and `acknowledgeDirtyRecords !== true`:
   *        • log the blocked attempt
   *        • throw 409 with the counts, so the UI can prompt
   *   4. If dirty and acknowledged:
   *        • require `conversionRate` (finite, positive)
   *        • run `currencyMigrationService.convertBusinessUnitCurrency`
   *        • return `mode: 'migrated'`
   *   5. If clean:
   *        • simple `businessUnit.update({ currency })`
   *        • return `mode: 'simple'`
   *
   * The BU's currency is never mutated without an audit entry.
   * Every path writes one.
   */
  async changeBusinessUnitCurrency(
    params: ChangeCurrencyParams,
  ): Promise<ChangeCurrencyResult> {
    try {
      const {
        businessUnitId,
        targetCurrency,
        acknowledgeDirtyRecords = false,
        conversionRate,
        reason = null,
        userId,
      } = params;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      await this.validateBusinessUnit(businessUnitId);

      const target = this.assertSettlementCurrency(targetCurrency);
      const current = await this.readBusinessUnitCurrency(
        businessUnitId,
      );

      if (target === current) {
        throw new AppError(
          `Business unit already uses ${target}`,
          400,
        );
      }

      const dirty =
        await currencyMigrationService.countDirtyRecords(businessUnitId);
      const totalDirty =
        dirty.carts +
        dirty.sales +
        dirty.payments +
        dirty.orders +
        dirty.invoices;

      // ── Path A: dirty, not acknowledged → block + audit ──
      if (totalDirty > 0 && !acknowledgeDirtyRecords) {
        await currencyMigrationService.logBlockedChange({
          businessUnitId,
          attemptedCurrency: target,
          currentCurrency: current,
          dirtyCounts: dirty,
          userId,
        });
        throw new AppError(
          `Cannot change currency from ${current} to ${target}: ` +
            `the business unit has ${totalDirty} dirty record(s) ` +
            `(carts: ${dirty.carts}, sales: ${dirty.sales}, ` +
            `payments: ${dirty.payments}, orders: ${dirty.orders}, ` +
            `invoices: ${dirty.invoices}). ` +
            `Re-send the request with ` +
            `acknowledgeDirtyRecords=true and a conversionRate to ` +
            `run the conversion.`,
          409,
        );
      }

      // ── Path B: dirty, acknowledged → convert ────────────
      if (totalDirty > 0 && acknowledgeDirtyRecords) {
        if (
          typeof conversionRate !== 'number' ||
          !Number.isFinite(conversionRate) ||
          conversionRate <= 0
        ) {
          throw new AppError(
            'conversionRate must be a positive finite number when ' +
              'converting a business unit with dirty records',
            400,
          );
        }

        const result =
          await currencyMigrationService.convertBusinessUnitCurrency({
            businessUnitId,
            targetCurrency: target,
            rate: conversionRate,
            reason,
            userId,
          });

        const refreshed = await this.prisma.businessUnit.findUnique({
          where: { id: businessUnitId },
          include: { company: true },
        });

        return {
          businessUnit: refreshed
            ? {
                ...refreshed,
                currencySymbol:
                  currencyService.tryGetCurrency(refreshed.currency)
                    ?.symbol ?? refreshed.currency,
              }
            : null,
          mode: 'migrated',
          fromCurrency: result.fromCurrency,
          toCurrency: result.toCurrency,
          dirtyCounts: dirty,
          conversionRate: result.conversionRate,
          convertedRecords: result.convertedRecords,
        };
      }

      // ── Path C: clean → simple swap + audit ──────────────
      const updated = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const bu = await tx.businessUnit.update({
            where: { id: businessUnitId },
            data: { currency: target },
            include: { company: true },
          });

          await tx.auditLog.create({
            data: {
              action: 'UPDATE',
              entityType: 'BUSINESS_UNIT',
              entityId: businessUnitId,
              entityName: 'BU currency change',
              userId,
              businessUnitId,
              severity: 'HIGH',
              changes: {
                kind: 'CURRENCY_CHANGE',
                fromCurrency: current,
                toCurrency: target,
                mode: 'simple',
                reason,
              },
            },
          });

          return bu;
        },
      );

      return {
        businessUnit: {
          ...updated,
          currencySymbol:
            currencyService.tryGetCurrency(updated.currency)?.symbol ??
            updated.currency,
        },
        mode: 'simple',
        fromCurrency: current,
        toCurrency: target,
        dirtyCounts: dirty,
      };
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.changeBusinessUnitCurrency',
      );
      throw error;
    }
  }

  /**
   * Delete business unit (soft delete preferred).
   */
  async deleteBusinessUnit(id: string) {
    try {
      await this.validateBusinessUnit(id);

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id },
        include: {
          products: { where: { isActive: true } },
          inventory: true,
          users: { where: { isActive: true } },
          sales: { take: 1 },
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
        const archived = await this.prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            const updated = await tx.businessUnit.update({
              where: { id },
              data: { isActive: false },
            });

            await tx.businessUnitUser.updateMany({
              where: { businessUnitId: id, isActive: true },
              data: { isActive: false },
            });

            await tx.product.updateMany({
              where: { businessUnitId: id, isActive: true },
              data: { isActive: false },
            });

            await tx.auditLog.create({
              data: {
                action: 'UPDATE',
                entityType: 'BUSINESS_UNIT',
                entityId: id,
                userId: 'system',
                entityName: businessUnit.name,
                businessUnitId: id,
                severity: 'HIGH',
                changes: {
                  isActive: { old: true, new: false },
                  status: { old: 'active', new: 'archived' },
                },
              },
            });

            return updated;
          },
        );

        return {
          message:
            'Business unit archived (soft deleted) due to associated records',
          data: archived,
          softDeleted: true,
        };
      }

      await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          await tx.businessUnit.delete({ where: { id } });

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
        },
      );

      return {
        message: 'Business unit deleted successfully',
        softDeleted: false,
      };
    } catch (error) {
      this.handleError(error, 'BusinessUnitService.deleteBusinessUnit');
      throw error;
    }
  }

  /**
   * Bulk delete business units.
   */
  async bulkDeleteBusinessUnits(ids: string[]): Promise<{
    deletedCount: number;
    softDeletedCount: number;
    errors: string[];
    results: Array<{
      id: string;
      success: boolean;
      message: string;
      softDeleted?: boolean;
    }>;
  }> {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('No business unit IDs provided', 400);
      }

      for (const id of ids) {
        if (!this.isValidID(id)) {
          throw new AppError(`Invalid ID format: ${id}`, 400);
        }
      }

      const results: Array<{
        id: string;
        success: boolean;
        message: string;
        softDeleted?: boolean;
      }> = [];
      const errors: string[] = [];
      let deletedCount = 0;
      let softDeletedCount = 0;

      for (const id of ids) {
        try {
          const result = await this.deleteBusinessUnit(id);
          if (
            result &&
            typeof result === 'object' &&
            'softDeleted' in result
          ) {
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
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(
            `Failed to delete business unit ${id}: ${errorMessage}`,
          );
          results.push({
            id,
            success: false,
            message: errorMessage,
          });
        }
      }

      return { deletedCount, softDeletedCount, errors, results };
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.bulkDeleteBusinessUnits',
      );
      throw error;
    }
  }

  /**
   * Get comprehensive business unit statistics.
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
        this.prisma.sale.count({ where: { businessUnitId: id } }),
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
          where: { businessUnitId: id, quantity: 0 },
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
      throw error;
    }
  }

  /**
   * Get business unit users.
   */
  async getBusinessUnitUsers(businessUnitId: string) {
    try {
      await this.validateBusinessUnit(businessUnitId);

      return await this.prisma.businessUnitUser.findMany({
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
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.getBusinessUnitUsers',
      );
      throw error;
    }
  }

  /**
   * Add user to business unit.
   */
  async addUserToBusinessUnit(
    businessUnitId: string,
    userId: string,
    role?: UserRole,
  ) {
    try {
      await this.validateBusinessUnit(businessUnitId);
      await this.validateUser(userId);

      const existing = await this.prisma.businessUnitUser.findFirst({
        where: { businessUnitId, userId },
      });

      if (existing) {
        if (existing.isActive) {
          throw new AppError(
            'User is already assigned to this business unit',
            400,
          );
        }
        return await this.prisma.businessUnitUser.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            role: role || existing.role || UserRole.USER,
          },
        });
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
      this.handleError(
        error,
        'BusinessUnitService.addUserToBusinessUnit',
      );
      throw error;
    }
  }

  /**
   * Remove user from business unit.
   */
  async removeUserFromBusinessUnit(
    businessUnitId: string,
    userId: string,
  ) {
    try {
      await this.validateBusinessUnit(businessUnitId);
      await this.validateUser(userId);

      const association = await this.prisma.businessUnitUser.findFirst({
        where: { businessUnitId, userId },
      });

      if (!association) {
        throw new AppError(
          'User is not assigned to this business unit',
          404,
        );
      }

      return await this.prisma.businessUnitUser.update({
        where: { id: association.id },
        data: { isActive: false },
      });
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.removeUserFromBusinessUnit',
      );
      throw error;
    }
  }

  /**
   * Get or create a default business unit for a company.
   */
  async getOrCreateDefaultBusinessUnit(companyId: string): Promise<any> {
    try {
      const company = await this.validateCompany(companyId);

      const existing = await this.prisma.businessUnit.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (existing) {
        return existing;
      }

      // Inherit the company's currency when it has one, else fall
      // through to the registry default. Never hardcoded.
      const inheritedCurrency = currencyService.resolveForBusiness(
        company.currency ?? null,
      );

      return await this.prisma.businessUnit.create({
        data: {
          name: `${company.name} - Default Unit`,
          code: `BU-${Date.now().toString().slice(-6)}`,
          isActive: true,
          companyId,
          type: 'STORE',
          currency: inheritedCurrency,
        },
      });
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.getOrCreateDefaultBusinessUnit',
      );
      throw error;
    }
  }

  /**
   * Ensure a user has at least one business unit.
   */
  async ensureUserBusinessUnit(
    userId: string,
    companyId: string,
  ): Promise<any> {
    try {
      await this.validateUser(userId);
      await this.validateCompany(companyId);

      const userBusinessUnits =
        await this.prisma.businessUnitUser.findMany({
          where: { userId, isActive: true },
          include: { businessUnit: true },
        });

      if (userBusinessUnits.length > 0) {
        const active = userBusinessUnits.find(
          (ub: any) => ub.businessUnit.isActive,
        );
        if (active) {
          return active.businessUnit;
        }
      }

      const businessUnit =
        await this.getOrCreateDefaultBusinessUnit(companyId);

      await this.prisma.businessUnitUser.create({
        data: {
          userId,
          businessUnitId: businessUnit.id,
          role: UserRole.EMPLOYEE,
          isActive: true,
        },
      });

      return businessUnit;
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.ensureUserBusinessUnit',
      );
      throw error;
    }
  }

  /**
   * Get business units by company.
   */
  async getBusinessUnitsByCompany(companyId: string): Promise<any[]> {
    try {
      await this.validateCompany(companyId);

      const businessUnits = await this.prisma.businessUnit.findMany({
        where: { companyId, isActive: true },
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

      return businessUnits.map((bu: any) => ({
        ...bu,
        currencySymbol:
          currencyService.tryGetCurrency(bu.currency)?.symbol ??
          bu.currency,
      }));
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.getBusinessUnitsByCompany',
      );
      throw error;
    }
  }

  /**
   * Get business unit by code.
   */
  async getBusinessUnitByCode(
    code: string,
    companyId?: string,
  ): Promise<any> {
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
        throw new AppError(
          `Business unit with code "${code}" not found`,
          404,
        );
      }

      return {
        ...businessUnit,
        currencySymbol:
          currencyService.tryGetCurrency(businessUnit.currency)?.symbol ??
          businessUnit.currency,
      };
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.getBusinessUnitByCode',
      );
      throw error;
    }
  }

  /**
   * Get business unit with full details including products and
   * inventory.
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
              variants: { where: { isActive: true } },
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

      return {
        ...businessUnit,
        currencySymbol:
          currencyService.tryGetCurrency(businessUnit.currency)?.symbol ??
          businessUnit.currency,
      };
    } catch (error) {
      this.handleError(
        error,
        'BusinessUnitService.getBusinessUnitWithDetails',
      );
      throw error;
    }
  }
}

export default BusinessUnitService;
