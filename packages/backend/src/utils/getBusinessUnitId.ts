// D:\Projects\Kalwanga\packages\backend\src\utils\getBusinessUnitId.ts

import type { Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Resolve the business unit ID for the current request.
 *
 * ⚠ MUST be identical between `cartController` and `orderController`.
 * The cart and order endpoints have to resolve the same BU for a
 * given request, otherwise inventory created against one is
 * invisible to the other and the POS flow throws
 * "No inventory found for <product>".
 *
 * Priority:
 *   1. Explicit override (x-business-unit-id header > body > query)
 *   2. User's own businessUnitId / businessUnits[0]
 *   3. Most recent active business unit
 *   4. Bootstrap a default company + business unit (dev-only path)
 */
export async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  // ── 1. Explicit override ─────────────────────────────────────
  const explicit =
    (req.headers['x-business-unit-id'] as string | undefined) ||
    (req.body?.businessUnitId as string | undefined) ||
    (req.query?.businessUnitId as string | undefined);

  if (
    explicit &&
    explicit !== 'default' &&
    explicit !== 'default-business-unit'
  ) {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: explicit },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) return exists.id;
    console.warn(
      `⚠️ Explicit businessUnitId "${explicit}" not found or inactive, falling back`,
    );
  }

  // ── 2. User's own unit ───────────────────────────────────────
  const userBu =
    user?.businessUnitId ||
    user?.businessUnits?.[0]?.businessUnitId ||
    user?.businessUnits?.[0]?.id;

  if (userBu && userBu !== 'default') {
    const exists = await prisma.businessUnit.findUnique({
      where: { id: userBu },
      select: { id: true, isActive: true },
    });
    if (exists && exists.isActive) return exists.id;
  }

  // ── 3. Most recent active unit ───────────────────────────────
  try {
    const businessUnit = await prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (businessUnit) {
      console.log(
        `✅ getBusinessUnitId: falling back to "${businessUnit.name}" (${businessUnit.id})`,
      );
      return businessUnit.id;
    }

    // ── 4. Bootstrap (dev-only path) ───────────────────────────
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Default Company',
          email: 'default@company.com',
          phone: '+0000000000',
          isActive: true,
        },
      });
    }

    const companyId = company.id;

    // Retry on unique-constraint collision. The previous
    // `Date.now().slice(-6)` had a real chance of colliding twice
    // in the same second and would 500 the request.
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = `${Date.now().toString().slice(-6)}${attempt}`;
      const code = `BU-${suffix}`;

      const existing = await prisma.businessUnit.findUnique({
        where: { code },
        select: { id: true },
      });
      if (existing) continue;

      const newBusinessUnit = await prisma.businessUnit.create({
        data: {
          name: 'Default Business Unit',
          code,
          isActive: true,
          companyId,
        },
      });
      return newBusinessUnit.id;
    }

    throw new AppError(
      'Failed to bootstrap business unit after multiple attempts',
      500,
    );
  } catch (error) {
    console.error('❌ Failed to resolve business unit:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to resolve business unit ID', 500);
  }
}
