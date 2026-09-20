// packages/backend/src/services/locationService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';

type Tx = Prisma.TransactionClient;

// ============================================
// INPUT TYPES
// ============================================

export interface CreateLocationInput {
  name: string;
  code?: string;
  type?: string;
  description?: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateLocationInput {
  name?: string;
  code?: string;
  type?: string;
  description?: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateSettingsInput {
  defaultLocationId?: string | null;
  enabledTypes?: string[];
  allowNegativeStock?: boolean;
  reserveStockOnAdd?: boolean;
  defaultReorderPoint?: number;
  defaultReorderQuantity?: number;
  requireTransferReference?: boolean;
  autoReceiveTransfers?: boolean;
  allowCrossBusinessUnitTransfers?: boolean;
  showCodeOnCards?: boolean;
  showInactiveInLists?: boolean;
}

export interface ImportLocationRow {
  name: string;
  code?: string;
  type?: string;
  description?: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
}

export interface ImportResult {
  created: number;
  failed: number;
  errors: string[];
}

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  includeInactive: boolean;
  includeInventory: boolean;
}

export interface ExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

// ============================================
// CONSTANTS
// ============================================

const VALID_TYPES = new Set([
  'WAREHOUSE',
  'STORE',
  'BACKROOM',
  'DISTRIBUTION_CENTER',
  'STORE_FRONT',
  'IN_TRANSIT',
  'SUPPLIER',
  'OTHER',
]);

// ============================================
// SERVICE
// ============================================

export class LocationService extends BaseService {
  // ─────────────────────────────────────────
  // CRUD (unchanged)
  // ─────────────────────────────────────────

  /**
   * List active locations for a business unit.
   * Soft-deleted rows are excluded.
   */
  async list(businessUnitId: string) {
    if (!businessUnitId) {
      throw new AppError('Business unit ID is required', 400);
    }

    return this.prisma.location.findMany({
      where: { businessUnitId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Create a Location. If `isDefault: true`, unsets the flag on
   * every other location in the same BU first (one default per BU).
   */
  async create(businessUnitId: string, input: CreateLocationInput) {
    if (!businessUnitId) {
      throw new AppError('Business unit ID is required', 400);
    }

    const name = input.name?.trim();
    if (!name) throw new AppError('Location name is required', 400);

    const type = (input.type || 'OTHER').toUpperCase();
    if (!VALID_TYPES.has(type)) {
      throw new AppError(`Invalid location type: ${type}`, 400);
    }

    return this.prisma.$transaction(async (tx) => {
      // Reject duplicate name within BU (matches @@unique([businessUnitId, name]))
      const existing = await tx.location.findFirst({
        where: { businessUnitId, name, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        throw new AppError(
          `A location named "${name}" already exists in this business unit`,
          409
        );
      }

      if (input.isDefault) {
        await tx.location.updateMany({
          where: { businessUnitId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.location.create({
        data: {
          name,
          code: input.code?.trim() || null,
          type: type as any,
          description: input.description ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          isDefault: !!input.isDefault,
          isActive: true,
          businessUnitId,
          metadata: input.metadata
            ? (input.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    });
  }

  async update(
    id: string,
    businessUnitId: string,
    input: UpdateLocationInput
  ) {
    if (!id || !businessUnitId) {
      throw new AppError('Location ID and business unit ID are required', 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.location.findFirst({
        where: { id, businessUnitId, deletedAt: null },
      });
      if (!existing) throw new AppError('Location not found', 404);

      // Duplicate name check on rename
      if (input.name && input.name.trim() !== existing.name) {
        const clash = await tx.location.findFirst({
          where: {
            businessUnitId,
            name: input.name.trim(),
            deletedAt: null,
            NOT: { id },
          },
          select: { id: true },
        });
        if (clash) {
          throw new AppError(
            `A location named "${input.name.trim()}" already exists in this business unit`,
            409
          );
        }
      }

      if (input.isDefault) {
        await tx.location.updateMany({
          where: { businessUnitId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      let type: string | undefined;
      if (input.type) {
        type = input.type.toUpperCase();
        if (!VALID_TYPES.has(type)) {
          throw new AppError(`Invalid location type: ${type}`, 400);
        }
      }

      return tx.location.update({
        where: { id },
        data: {
          name: input.name?.trim() ?? undefined,
          code:
            input.code === undefined
              ? undefined
              : input.code?.trim() || null,
          type: type as any,
          description: input.description ?? undefined,
          address: input.address ?? undefined,
          phone: input.phone ?? undefined,
          isDefault: input.isDefault,
          isActive: input.isActive,
          metadata:
            input.metadata === undefined
              ? undefined
              : input.metadata
              ? (input.metadata as Prisma.InputJsonValue)
              : Prisma.JsonNull,
        },
      });
    });
  }

  /**
   * Soft delete. Refuses if any Inventory row still references
   * this location.
   */
  async softDelete(id: string, businessUnitId: string, userId: string) {
    if (!id || !businessUnitId) {
      throw new AppError('Location ID and business unit ID are required', 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.location.findFirst({
        where: { id, businessUnitId, deletedAt: null },
      });
      if (!existing) throw new AppError('Location not found', 404);

      const attached = await tx.inventory.count({
        where: { locationId: id },
      });
      if (attached > 0) {
        throw new AppError(
          `Cannot delete: ${attached} inventory row(s) still reference this location. Move or delete them first.`,
          409
        );
      }

      return tx.location.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedBy: userId,
          isActive: false,
          isDefault: false,
        },
      });
    });
  }

  /**
   * Lookup-or-create by name. Called by the inventory service when a
   * user types a new location name inline in the add/edit forms.
   * Idempotent — repeated calls return the same row.
   */
  async resolveOrCreate(
    tx: Tx,
    businessUnitId: string,
    name: string
  ): Promise<{ id: string; name: string }> {
    const cleanName = (name || 'Warehouse').trim();
    if (!cleanName) {
      throw new AppError('Location name is required', 400);
    }

    const existing = await tx.location.findFirst({
      where: { businessUnitId, name: cleanName, deletedAt: null },
      select: { id: true, name: true },
    });
    if (existing) return existing;

    const created = await tx.location.create({
      data: {
        name: cleanName,
        businessUnitId,
        type: 'OTHER',
        isActive: true,
        isDefault: false,
      },
      select: { id: true, name: true },
    });
    return created;
  }

  // ─────────────────────────────────────────
  // SETTINGS
  // ─────────────────────────────────────────

  /**
   * Fetch the settings row for a BU. Returns `null` when no row
   * exists yet — the client applies defaults in that case.
   */
  async getSettings(businessUnitId: string) {
    if (!businessUnitId) {
      throw new AppError('Business unit ID is required', 400);
    }

    return this.prisma.locationSettings.findUnique({
      where: { businessUnitId },
    });
  }

  /**
   * Upsert the settings row for a BU. `businessUnitId` is the unique
   * key, so a single `upsert` handles both create and update.
   */
  async updateSettings(
    businessUnitId: string,
    input: UpdateSettingsInput
  ) {
    if (!businessUnitId) {
      throw new AppError('Business unit ID is required', 400);
    }

    // Validate enabledTypes against the known enum values. Any
    // unrecognized strings are dropped rather than rejected, so a
    // client that sends a stale type doesn't 400 the whole save.
    let enabledTypes: string[] | undefined;
    if (input.enabledTypes !== undefined) {
      if (!Array.isArray(input.enabledTypes)) {
        throw new AppError('enabledTypes must be an array', 400);
      }
      enabledTypes = input.enabledTypes
        .map((t) => String(t).toUpperCase())
        .filter((t) => VALID_TYPES.has(t));
      if (enabledTypes.length === 0) {
        throw new AppError(
          'At least one valid location type must remain enabled',
          400
        );
      }
    }

    // If a default location is being set, verify it belongs to this
    // BU and isn't soft-deleted. Passing `null` clears the default.
    if (input.defaultLocationId !== undefined && input.defaultLocationId !== null) {
      const location = await this.prisma.location.findFirst({
        where: {
          id: input.defaultLocationId,
          businessUnitId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!location) {
        throw new AppError(
          'Default location not found in this business unit',
          404
        );
      }
    }

    // Reject nonsensical numeric values before they hit the DB.
    if (
      input.defaultReorderPoint !== undefined &&
      (!Number.isFinite(input.defaultReorderPoint) ||
        input.defaultReorderPoint < 0)
    ) {
      throw new AppError('defaultReorderPoint must be >= 0', 400);
    }
    if (
      input.defaultReorderQuantity !== undefined &&
      (!Number.isFinite(input.defaultReorderQuantity) ||
        input.defaultReorderQuantity < 1)
    ) {
      throw new AppError('defaultReorderQuantity must be >= 1', 400);
    }

    return this.prisma.locationSettings.upsert({
      where: { businessUnitId },
      create: {
        businessUnitId,
        defaultLocationId: input.defaultLocationId ?? null,
        enabledTypes: enabledTypes ?? [],
        allowNegativeStock: input.allowNegativeStock ?? false,
        reserveStockOnAdd: input.reserveStockOnAdd ?? true,
        defaultReorderPoint: input.defaultReorderPoint ?? 5,
        defaultReorderQuantity: input.defaultReorderQuantity ?? 10,
        requireTransferReference: input.requireTransferReference ?? false,
        autoReceiveTransfers: input.autoReceiveTransfers ?? false,
        allowCrossBusinessUnitTransfers:
          input.allowCrossBusinessUnitTransfers ?? false,
        showCodeOnCards: input.showCodeOnCards ?? true,
        showInactiveInLists: input.showInactiveInLists ?? false,
      },
      update: {
        ...(input.defaultLocationId !== undefined && {
          defaultLocationId: input.defaultLocationId,
        }),
        ...(enabledTypes !== undefined && { enabledTypes }),
        ...(input.allowNegativeStock !== undefined && {
          allowNegativeStock: input.allowNegativeStock,
        }),
        ...(input.reserveStockOnAdd !== undefined && {
          reserveStockOnAdd: input.reserveStockOnAdd,
        }),
        ...(input.defaultReorderPoint !== undefined && {
          defaultReorderPoint: input.defaultReorderPoint,
        }),
        ...(input.defaultReorderQuantity !== undefined && {
          defaultReorderQuantity: input.defaultReorderQuantity,
        }),
        ...(input.requireTransferReference !== undefined && {
          requireTransferReference: input.requireTransferReference,
        }),
        ...(input.autoReceiveTransfers !== undefined && {
          autoReceiveTransfers: input.autoReceiveTransfers,
        }),
        ...(input.allowCrossBusinessUnitTransfers !== undefined && {
          allowCrossBusinessUnitTransfers:
            input.allowCrossBusinessUnitTransfers,
        }),
        ...(input.showCodeOnCards !== undefined && {
          showCodeOnCards: input.showCodeOnCards,
        }),
        ...(input.showInactiveInLists !== undefined && {
          showInactiveInLists: input.showInactiveInLists,
        }),
      },
    });
  }

  // ─────────────────────────────────────────
  // REPORTS
  // ─────────────────────────────────────────

  /**
   * Per-location aggregates: item count, total quantity, total value,
   * low-stock count, out-of-stock count.
   *
   * One query with a nested select, then reduce in JS. For very large
   * catalogs this could move to a raw aggregate query, but for the
   * expected scale it's fine.
   */
  async getReports(businessUnitId: string) {
    if (!businessUnitId) {
      throw new AppError('Business unit ID is required', 400);
    }

    const locations = await this.prisma.location.findMany({
      where: { businessUnitId, deletedAt: null },
      include: {
        inventories: {
          select: {
            quantity: true,
            reorderPoint: true,
            product: { select: { unitPrice: true } },
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return locations.map((loc) => {
      const itemCount = loc.inventories.length;
      const totalQuantity = loc.inventories.reduce(
        (sum, i) => sum + (i.quantity ?? 0),
        0
      );
      const totalValue = loc.inventories.reduce(
        (sum, i) => sum + (i.quantity ?? 0) * (i.product?.unitPrice ?? 0),
        0
      );
      const lowStockCount = loc.inventories.filter(
        (i) => i.quantity > 0 && i.quantity <= i.reorderPoint
      ).length;
      const outOfStockCount = loc.inventories.filter(
        (i) => i.quantity === 0
      ).length;

      return {
        locationId: loc.id,
        locationName: loc.name,
        type: loc.type,
        code: loc.code,
        itemCount,
        totalQuantity,
        totalValue,
        lowStockCount,
        outOfStockCount,
      };
    });
  }

  // ─────────────────────────────────────────
  // IMPORT
  // ─────────────────────────────────────────

  /**
   * Bulk-create locations. Validates each row independently so a
   * single bad row doesn't fail the whole batch. Returns a summary
   * the client uses to render the result screen.
   */
  async importMany(
    businessUnitId: string,
    userId: string,
    rows: ImportLocationRow[]
  ): Promise<ImportResult> {
    if (!businessUnitId) {
      throw new AppError('Business unit ID is required', 400);
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return { created: 0, failed: 0, errors: [] };
    }

    const errors: string[] = [];
    let created = 0;
    let failed = 0;

    // Pre-load existing names/codes so we can detect duplicates in
    // memory rather than firing one query per row.
    const existing = await this.prisma.location.findMany({
      where: { businessUnitId, deletedAt: null },
      select: { name: true, code: true },
    });
    const existingNames = new Set(existing.map((l) => l.name.toLowerCase()));
    const existingCodes = new Set(
      existing.map((l) => (l.code ?? '').toLowerCase()).filter(Boolean)
    );

    // Track a "default already assigned this batch" flag so we don't
    // repeatedly unset the flag mid-loop.
    let defaultAssigned = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowLabel = `Row ${i + 2}`; // +2 = header + 1-indexed

      const name = (row.name ?? '').trim();
      if (!name) {
        errors.push(`${rowLabel}: Name is required`);
        failed++;
        continue;
      }
      if (existingNames.has(name.toLowerCase())) {
        errors.push(`${rowLabel}: A location named "${name}" already exists`);
        failed++;
        continue;
      }

      const code = (row.code ?? '').trim() || null;
      if (code && existingCodes.has(code.toLowerCase())) {
        errors.push(`${rowLabel}: Code "${code}" is already in use`);
        failed++;
        continue;
      }

      const type = (row.type ?? 'STORE').toUpperCase();
      if (!VALID_TYPES.has(type)) {
        errors.push(`${rowLabel}: Unknown type "${row.type}"`);
        failed++;
        continue;
      }

      const shouldBeDefault = !!row.isDefault && !defaultAssigned;

      try {
        await this.prisma.$transaction(async (tx) => {
          if (shouldBeDefault) {
            await tx.location.updateMany({
              where: { businessUnitId, isDefault: true },
              data: { isDefault: false },
            });
          }

          await tx.location.create({
            data: {
              name,
              code,
              type: type as any,
              description: row.description?.trim() || null,
              address: row.address?.trim() || null,
              phone: row.phone?.trim() || null,
              isDefault: shouldBeDefault,
              isActive: true,
              businessUnitId,
            },
          });
        });

        if (shouldBeDefault) defaultAssigned = true;

        created++;
        existingNames.add(name.toLowerCase());
        if (code) existingCodes.add(code.toLowerCase());
      } catch (err: any) {
        errors.push(`${rowLabel}: ${err?.message ?? 'Unknown error'}`);
        failed++;
      }
    }

    return { created, failed, errors };
  }

  // ─────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────

  /**
   * Produce a downloadable file for locations. Returns a buffer plus
   * the content-type and filename so the controller can stream it
   * without knowing the format-specific details.
   *
   * `csv` and `json` are implemented natively. `xlsx` and `pdf` need
   * external libraries (`exceljs`, `pdfkit`) and are stubbed with a
   * 501 until those are installed.
   */
  async exportAll(
    businessUnitId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    if (!businessUnitId) {
      throw new AppError('Business unit ID is required', 400);
    }

    const locations = await this.prisma.location.findMany({
      where: {
        businessUnitId,
        deletedAt: null,
        ...(options.includeInactive ? {} : { isActive: true }),
      },
      include: options.includeInventory
        ? {
            inventories: {
              select: { quantity: true, reserved: true, available: true },
            },
          }
        : undefined,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    const rows = locations.map((loc: any) => {
      const base: Record<string, any> = {
        id: loc.id,
        name: loc.name,
        code: loc.code ?? '',
        type: loc.type,
        description: loc.description ?? '',
        address: loc.address ?? '',
        phone: loc.phone ?? '',
        isDefault: loc.isDefault,
        isActive: loc.isActive,
        createdAt: loc.createdAt.toISOString(),
      };

      if (options.includeInventory && loc.inventories) {
        base.itemCount = loc.inventories.length;
        base.totalQuantity = loc.inventories.reduce(
          (s: number, i: any) => s + (i.quantity ?? 0),
          0
        );
        base.totalReserved = loc.inventories.reduce(
          (s: number, i: any) => s + (i.reserved ?? 0),
          0
        );
        base.totalAvailable = loc.inventories.reduce(
          (s: number, i: any) => s + (i.available ?? 0),
          0
        );
      }

      return base;
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = `locations-${businessUnitId}-${timestamp}`;

    switch (options.format) {
      case 'json':
        return {
          buffer: Buffer.from(JSON.stringify(rows, null, 2), 'utf-8'),
          contentType: 'application/json',
          filename: `${baseName}.json`,
        };

      case 'csv': {
        const headers = Object.keys(rows[0] ?? { id: '', name: '' });
        const escape = (v: any) => {
          const s = String(v ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [
          headers.join(','),
          ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
        ];
        return {
          buffer: Buffer.from(lines.join('\n'), 'utf-8'),
          contentType: 'text/csv; charset=utf-8',
          filename: `${baseName}.csv`,
        };
      }

      case 'xlsx':
      case 'pdf':
        // These formats need a library (exceljs, pdfkit). Add the
        // dependency and generate the buffer here. Until then, throw
        // a clear 501 so the client knows it's unimplemented rather
        // than receiving a corrupted file.
        throw new AppError(
          `Export format "${options.format}" is not yet implemented`,
          501
        );

      default:
        throw new AppError(
          `Unknown export format: ${String(options.format)}`,
          400
        );
    }
  }
}

export default LocationService;
