// src/services/onboardingService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { Prisma } from '../generated/prisma/index.js';

// ============================================
// TYPES
// ============================================

export interface OnboardingGate {
  gate1_company: boolean;
  gate2_companySettings: boolean;
  gate3_salesSettings: boolean;
  gate4_businessUnit: boolean;
  gate5_cashRegister: boolean;
  gate6_users: boolean;
  gate7_categories: boolean;
  gate8_suppliers: boolean;
  gate9_paymentProviders: boolean;
  gate10_products: boolean;
  gate11_shift: boolean;
  gate12_firstSale: boolean;
}

export interface StepState {
  completed: boolean;
  completedAt?: string;
  skipped: boolean;
  skippedAt?: string;
  source: 'auto' | 'manual' | 'admin';
  notes?: string;
}

export interface NextStep {
  id: number;
  name: string;
  route: string;
  reason: string;
  narration: string;
  blocks: string[];
  blocksRoutes: string[];
  optional: boolean;
  state: StepState;
  activeIndex: number;
  displayPosition: number;
  displayTotal: number;
  registryPosition: number;
}

export interface OnboardingStatus extends OnboardingGate {
  nextStep: NextStep | null;
  prevStep: NextStep | null;
  activeSteps: NextStep[];
  currentIndex: number;
  totalActive: number;
  cursorStepId: number | null;
  steps: Record<number, StepState>;
  completedCount: number;
  totalCount: number;
  progress: number;
  isComplete: boolean;
  completedAt: string | null;
}

export interface MarkStepResult {
  success: true;
  step: StepState;
  status: OnboardingStatus;
}

// ============================================
// STEP REGISTRY
// ============================================

interface ProbeContext {
  userId: string;
  businessUnitId: string;
  companyId: string | null;
  prisma: PrismaClientLike;
}

interface PrismaClientLike {
  company: {
    count(args: { where: { id: string } }): Promise<number>;
  };
  companySettings: {
    count(args: { where: { companyId: string } }): Promise<number>;
  };
  salesSettings: {
    count(args: { where: { companyId: string } }): Promise<number>;
  };
  businessUnit: {
    count(args: {
      where: { id?: string; deletedAt: null };
    }): Promise<number>;
    findUnique(args: {
      where: { id: string };
      select: { companyId: true };
    }): Promise<{ companyId: string } | null>;
  };
  cashRegister: {
    count(args: {
      where: { businessUnitId: string; isActive: boolean };
    }): Promise<number>;
  };
  businessUnitUser: {
    count(args: {
      where: {
        businessUnitId: string;
        userId: { not: string };
        isActive: boolean;
      };
    }): Promise<number>;
  };
  category: {
    count(args: {
      where: { businessUnitId: string; isActive: boolean };
    }): Promise<number>;
  };
  supplier: {
    count(args: {
      where: { companyId: string; isActive: boolean };
    }): Promise<number>;
  };
  paymentProvider: {
    count(args: {
      where: {
        isActive: boolean;
        deletedAt: null;
        OR: Array<{ businessUnitId: string } | { businessUnitId: null }>;
      };
    }): Promise<number>;
  };
  product: {
    count(args: {
      where: {
        businessUnitId: string;
        deletedAt: null;
        isActive: boolean;
      };
    }): Promise<number>;
  };
  shiftLog: {
    count(args: {
      where: { userId: string; businessUnitId: string; status: string };
    }): Promise<number>;
  };
  sale: {
    count(args: {
      where: { businessUnitId: string; status: string };
    }): Promise<number>;
  };
}

interface StepDefinition {
  id: number;
  name: string;
  routeTemplate: string;
  reason: string;
  narration: string;
  blocks: string[];
  blocksRoutes: string[];
  optional: boolean;
  probe: (ctx: ProbeContext) => Promise<boolean | null>;
}

const STEP_REGISTRY: StepDefinition[] = [
  {
    id: 1,
    name: 'Create your company',
    routeTemplate: '/admin/companies/new',
    reason:
      'Every record in Kalwanga — business units, products, sales, receipts — belongs to a company. Let’s create yours first.',
    narration:
      'Welcome to Kalwanga! Let’s set up your company. This is the foundation for everything else — your products, sales, and reports will all live here. Tap the button below to add your company details.',
    blocks: ['All admin navigation', 'Every downstream record'],
    blocksRoutes: ['/admin'],
    optional: false,
    probe: async ({ companyId, prisma }) => {
      if (!companyId) return false;
      return (await prisma.company.count({ where: { id: companyId } })) > 0;
    },
  },
  {
    id: 2,
    name: 'Company settings',
    routeTemplate: '/admin/companies/:companyId/settings',
    reason:
      'Set your tax rate, receipt header and footer, currency, and default payment method. These flow into every sale and receipt.',
    narration:
      'Great — your company exists. Now let’s configure how it operates. Set your tax rate, what appears on receipts, and your default currency. You can always change these later.',
    blocks: ['Sales creation', 'Receipt printing', 'Tax calculation'],
    blocksRoutes: ['/admin/sales', '/admin/shifts'],
    optional: false,
    probe: async ({ companyId, prisma }) => {
      if (!companyId) return false;
      return (
        (await prisma.companySettings.count({ where: { companyId } })) > 0
      );
    },
  },
  {
    id: 3,
    name: 'Sales settings',
    routeTemplate: '/admin/sales/settings',
    reason:
      'Receipt and invoice number prefixes live here. Without them a sale can’t generate a unique receipt number.',
    narration:
      'Next, let’s set up your sales preferences. This controls how receipts and invoices are numbered, plus discount limits and loyalty points.',
    blocks: ['Receipt generation', 'Invoice numbering', 'POS checkout'],
    blocksRoutes: ['/admin/sales', '/admin/shifts'],
    optional: false,
    probe: async ({ companyId, prisma }) => {
      if (!companyId) return false;
      return (
        (await prisma.salesSettings.count({ where: { companyId } })) > 0
      );
    },
  },
  {
    id: 4,
    name: 'Create a business unit',
    routeTemplate: '/admin/business-units/new',
    reason:
      'A business unit is a store, branch, or warehouse. Products, inventory, carts, cash registers, and sales all belong to one.',
    narration:
      'Now create your first business unit. Think of it as a store, a branch, or a warehouse. If you only have one location, just name it after your shop.',
    blocks: ['Catalog', 'Inventory', 'Shifts', 'Cart', 'Sales'],
    blocksRoutes: [
      '/admin/catalog',
      '/admin/inventory',
      '/admin/shifts',
      '/admin/cart',
      '/admin/sales',
    ],
    optional: false,
    probe: async ({ businessUnitId, prisma }) => {
      if (!businessUnitId) return false;
      return (
        (await prisma.businessUnit.count({
          where: { id: businessUnitId, deletedAt: null },
        })) > 0
      );
    },
  },
  {
    id: 5,
    name: 'Add a cash register',
    routeTemplate: '/admin/shifts/registers',
    reason:
      'A cash register is required before you can open a shift and take cash payments.',
    narration:
      'Let’s add a cash register. This is the physical till your cashiers will use. You’ll need at least one before opening a shift.',
    blocks: ['Opening a shift', 'Cash sales'],
    blocksRoutes: ['/admin/shifts'],
    optional: false,
    probe: async ({ businessUnitId, prisma }) => {
      if (!businessUnitId) return false;
      return (
        (await prisma.cashRegister.count({
          where: { businessUnitId, isActive: true },
        })) > 0
      );
    },
  },
  {
    id: 6,
    name: 'Invite your team',
    routeTemplate: '/admin/users',
    reason:
      'Optional — invite cashiers and managers so they can log in and take sales.',
    narration:
      'Optional step. You can invite cashiers and managers now, or skip and add them later from the Users page.',
    blocks: [],
    blocksRoutes: [],
    optional: true,
    probe: async ({ userId, businessUnitId, prisma }) => {
      if (!businessUnitId) return false;
      return (
        (await prisma.businessUnitUser.count({
          where: {
            businessUnitId,
            userId: { not: userId },
            isActive: true,
          },
        })) > 0
      );
    },
  },
  {
    id: 7,
    name: 'Create product categories',
    routeTemplate: '/admin/categories',
    reason:
      'Recommended — products land as “Uncategorized” without at least one category, which makes reports harder to read.',
    narration:
      'Optional but recommended. Categories group your products — like “Drinks”, “Snacks”, or “Electronics”. They make reports and search much easier.',
    blocks: [],
    blocksRoutes: [],
    optional: true,
    probe: async ({ businessUnitId, prisma }) => {
      if (!businessUnitId) return false;
      return (
        (await prisma.category.count({
          where: { businessUnitId, isActive: true },
        })) > 0
      );
    },
  },
  {
    id: 8,
    name: 'Add a supplier',
    routeTemplate: '/admin/suppliers/create',
    reason:
      'Optional — only needed if you plan to raise purchase orders and track restocking.',
    narration:
      'Optional step. Add a supplier if you want to track where your stock comes from and raise purchase orders.',
    blocks: [],
    blocksRoutes: [],
    optional: true,
    probe: async ({ companyId, prisma }) => {
      if (!companyId) return false;
      return (
        (await prisma.supplier.count({
          where: { companyId, isActive: true },
        })) > 0
      );
    },
  },
  {
    id: 9,
    name: 'Activate payment providers',
    routeTemplate: '/admin/payments/payment-providers',
    reason:
      'The POS only shows payment methods whose provider is active — card, mobile money, bank transfer, and so on.',
    narration:
      'Choose how you want to accept payments. Enable cash, card, mobile money, or bank transfer. You can add more providers later.',
    blocks: ['POS checkout (non-cash payments)'],
    blocksRoutes: [],
    optional: false,
    probe: async ({ businessUnitId, prisma }) => {
      if (!businessUnitId) return false;
      return (
        (await prisma.paymentProvider.count({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [{ businessUnitId }, { businessUnitId: null }],
          },
        })) > 0
      );
    },
  },
  {
    id: 10,
    name: 'Add your first product',
    routeTemplate: '/admin/catalog/add',
    reason:
      'The POS, cart, inventory, promotions, and reports all need at least one product to work with.',
    narration:
      'Time to add your first product! Give it a name, a price, and an initial stock count. Everything downstream — sales, inventory, reports — depends on this.',
    blocks: ['Cart', 'POS checkout', 'Sales', 'Returns', 'Refunds'],
    blocksRoutes: ['/admin/sales', '/admin/cart', '/admin/checkout'],
    optional: false,
    probe: async ({ businessUnitId, prisma }) => {
      if (!businessUnitId) return false;
      return (
        (await prisma.product.count({
          where: { businessUnitId, deletedAt: null, isActive: true },
        })) > 0
      );
    },
  },
  {
    id: 11,
    name: 'Open a shift',
    routeTemplate: '/admin/shifts/current',
    reason: 'Cash sales are gated on an open shift. Open one to start selling.',
    narration:
      'Almost there! Open a shift to start accepting cash. Enter your starting cash float and you’re ready to sell.',
    blocks: ['Cash sales', 'Shift reporting'],
    blocksRoutes: ['/admin/sales'],
    optional: false,
    probe: async ({ userId, businessUnitId, prisma }) => {
      if (!businessUnitId) return false;
      return (
        (await prisma.shiftLog.count({
          where: { userId, businessUnitId, status: 'OPEN' },
        })) > 0
      );
    },
  },
  {
    id: 12,
    name: 'Make a test sale',
    routeTemplate: '/admin/sales/pos',
    reason: 'A quick test sale confirms every step above is wired correctly.',
    narration:
      'Congratulations — you’re at the final step! Make a small test sale to confirm everything works. You can void it afterwards.',
    blocks: [],
    blocksRoutes: [],
    optional: true,
    probe: async ({ businessUnitId, prisma }) => {
      if (!businessUnitId) return false;
      return (
        (await prisma.sale.count({
          where: { businessUnitId, status: 'COMPLETED' },
        })) > 0
      );
    },
  },
];

const STEP_BY_ID = new Map(STEP_REGISTRY.map((s) => [s.id, s]));
const TOTAL_STEPS = STEP_REGISTRY.length;

export const OPTIONAL_STEP_IDS = new Set<number>(
  STEP_REGISTRY.filter((s) => s.optional).map((s) => s.id)
);

export const STEP_NAMES: Record<number, string> = Object.fromEntries(
  STEP_REGISTRY.map((s) => [s.id, s.name])
);

// ============================================
// HELPERS
// ============================================

const CURSOR_KEY = '__cursor';

function readStepsBlob(raw: unknown): Record<string, StepState> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, StepState>;
}

function readCursor(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>)[CURSOR_KEY];
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  if (!STEP_BY_ID.has(v)) return null;
  return v;
}

function writeCursor(
  steps: Record<string, StepState>,
  stepId: number | null
): Record<string, StepState> {
  const next: Record<string, StepState> = { ...steps };
  if (stepId === null) {
    delete (next as Record<string, unknown>)[CURSOR_KEY];
  } else {
    (next as Record<string, unknown>)[CURSOR_KEY] = stepId;
  }
  return next;
}

function stripCursor(
  steps: Record<string, StepState>
): Record<string, StepState> {
  const out: Record<string, StepState> = {};
  for (const [k, v] of Object.entries(steps)) {
    if (k === CURSOR_KEY) continue;
    out[k] = v;
  }
  return out;
}

function writeStepsBlob(
  steps: Record<string, StepState>
): Prisma.InputJsonValue {
  return steps as unknown as Prisma.InputJsonValue;
}

function writeNullableJson(
  value: unknown | null
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as unknown as Prisma.InputJsonValue;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

// ============================================
// SERVICE
// ============================================

interface ResolvedSteps {
  states: Record<number, StepState>;
  activeIds: number[];
  doneIds: number[];
  degraded: number[];
}

export class OnboardingService extends BaseService {
  /**
   * Expand a route template like `/admin/companies/:companyId/settings`
   * into a real path using the caller's resolved context.
   *
   * Returns `null` when a required context value is missing — the
   * caller must then HIDE the step rather than redirect the user
   * to the wrong page (which is what caused the step-1/step-2 loop).
   */
  private resolveRoute(
    template: string,
    ctx: { companyId?: string | null; businessUnitId?: string | null }
  ): string | null {
    let route = template;

    if (route.includes(':companyId')) {
      if (!ctx.companyId) {
        logger.warn(
          `[onboarding] Cannot resolve route template ${template}: missing companyId`
        );
        return null;
      }
      route = route.replace(':companyId', ctx.companyId);
    }

    if (route.includes(':businessUnitId')) {
      if (!ctx.businessUnitId) {
        logger.warn(
          `[onboarding] Cannot resolve route template ${template}: missing businessUnitId`
        );
        return null;
      }
      route = route.replace(':businessUnitId', ctx.businessUnitId);
    }

    return route;
  }

  /**
   * Build a `NextStep` payload with the pagination metadata
   * attached. Returns `null` if the route cannot be resolved —
   * callers must skip such steps to avoid dead links.
   */
  private buildNextStep(
    def: StepDefinition,
    state: StepState,
    activeIndex: number,
    displayTotal: number,
    ctx: { companyId?: string | null; businessUnitId?: string | null }
  ): NextStep | null {
    const route = this.resolveRoute(def.routeTemplate, ctx);
    if (!route) return null;

    return {
      id: def.id,
      name: def.name,
      route,
      reason: def.reason,
      narration: def.narration,
      blocks: def.blocks,
      blocksRoutes: def.blocksRoutes,
      optional: def.optional,
      state,
      activeIndex,
      displayPosition: activeIndex + 1,
      displayTotal,
      registryPosition: def.id,
    };
  }

  /**
   * Run all step probes in parallel and merge with persisted state.
   * Returns the full per-step state plus the ordered list of step
   * IDs still "active" (not complete, not skipped).
   *
   * This is the single source of truth for pagination.
   */
  private async resolveActiveSteps(
    userId: string,
    businessUnitId: string,
    companyId: string | null,
    persistedSteps: Record<string, StepState>
  ): Promise<ResolvedSteps> {
    const ctx: ProbeContext = {
      userId,
      businessUnitId,
      companyId,
      prisma: this.prisma as unknown as PrismaClientLike,
    };

    const probeResults = await Promise.all(
      STEP_REGISTRY.map(async (def) => {
        try {
          const result = await def.probe(ctx);
          return { id: def.id, result };
        } catch (err) {
          logger.error(
            `[onboarding] probe FAILED for step ${def.id} (${def.name}) — ` +
              `step will remain active until manually completed`,
            err
          );
          return { id: def.id, result: null as boolean | null };
        }
      })
    );

    const probeMap = new Map(probeResults.map((p) => [p.id, p.result]));

    const now = new Date().toISOString();
    const states: Record<number, StepState> = {};
    const activeIds: number[] = [];
    const doneIds: number[] = [];
    const degraded: number[] = [];

    for (const def of STEP_REGISTRY) {
      const prev: StepState = persistedSteps[String(def.id)] ?? {
        completed: false,
        skipped: false,
        source: 'auto',
      };
      const live = probeMap.get(def.id) ?? null;

      if (live === null) degraded.push(def.id);

      let next: StepState;

      if (prev.completed) {
        next = prev;
      } else if (live === true) {
        next = {
          completed: true,
          completedAt: prev.completedAt ?? now,
          skipped: false,
          source: 'auto',
        };
      } else if (prev.skipped) {
        next = prev;
      } else {
        next = { ...prev, completed: false };
      }

      states[def.id] = next;

      if (next.completed || next.skipped) {
        doneIds.push(def.id);
      } else {
        activeIds.push(def.id);
      }
    }

    return { states, activeIds, doneIds, degraded };
  }

  /**
   * Compute `completedCount`, `isComplete`, and `completedAt` from
   * a merged state map. Centralized so every write path persists
   * the SAME derived values — no drift between mark/skip/reset.
   */
  private deriveProgress(
    states: Record<number, StepState>
  ): { completedCount: number; isComplete: boolean } {
    const completedCount = Object.values(states).filter(
      (s) => s.completed
    ).length;
    const remaining = STEP_REGISTRY.filter((def) => {
      const s = states[def.id];
      return !(s?.completed || s?.skipped);
    });
    return { completedCount, isComplete: remaining.length === 0 };
  }

  /**
   * Get the current onboarding status for a user.
   *
   * The cursor (persisted under `__cursor` in the steps blob)
   * determines which step the guide highlights. If the cursor
   * points at a step that has since been completed or skipped,
   * the service advances to the first unmet mandatory step.
   *
   * ✅ FIX: The service no longer persists `businessUnitId` into
   *    `onboardingProgress`. That column was a stale cache: it
   *    stored whichever BU was resolved on a previous request, so
   *    if the user's real BU changed (or the frontend switched
   *    BUs), the next `getStatus` would reuse the stale value and
   *    probe against the wrong BU. Leaving it `null` forces every
   *    request to use the caller-supplied BU, which is the one the
   *    controller resolved for THIS request.
   */
  async getStatus(
    userId: string,
    businessUnitId: string,
    companyId?: string | null
  ): Promise<OnboardingStatus> {
    if (!userId) throw new AppError('User ID is required', 400);

    const hasBu = Boolean(businessUnitId);

    // ── Resolve companyId if not supplied ──────────────────────
    let resolvedCompanyId: string | null = companyId ?? null;
    if (!resolvedCompanyId && hasBu) {
      const bu = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        select: { companyId: true },
      });
      resolvedCompanyId = bu?.companyId ?? null;
    }

    // ── 1. Load or create persisted progress ───────────────────
    let progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      progress = await this.prisma.onboardingProgress.create({
        data: {
          userId,
          companyId: resolvedCompanyId,
          businessUnitId: hasBu ? businessUnitId : null,
          steps: {},
          totalSteps: TOTAL_STEPS,
        },
      });
    }

    const rawBlob = readStepsBlob(progress.steps);
    const persistedSteps = stripCursor(rawBlob);
    const cursorId = readCursor(rawBlob);

    // ── 2. Dynamic step resolution ─────────────────────────────
    const { states, activeIds, doneIds, degraded } =
      await this.resolveActiveSteps(
        userId,
        businessUnitId,
        resolvedCompanyId,
        persistedSteps
      );

    // ── 3. Build the active step list (with resolved routes) ───
    const routeCtx = {
      companyId: resolvedCompanyId,
      businessUnitId: hasBu ? businessUnitId : null,
    };

    const activeSteps: NextStep[] = [];
    for (const id of activeIds) {
      const def = STEP_BY_ID.get(id)!;
      const built = this.buildNextStep(
        def,
        states[id],
        activeSteps.length,
        activeIds.length,
        routeCtx
      );
      if (built) activeSteps.push(built);
    }

    for (let i = 0; i < activeSteps.length; i++) {
      activeSteps[i].activeIndex = i;
      activeSteps[i].displayPosition = i + 1;
      activeSteps[i].displayTotal = activeSteps.length;
    }

    // ── 4. Determine nextStep / prevStep / currentIndex ────────
    let currentIndex = -1;
    if (cursorId !== null) {
      currentIndex = activeSteps.findIndex((s) => s.id === cursorId);
    }

    if (currentIndex < 0) {
      const firstMandatoryIndex = activeSteps.findIndex((s) => !s.optional);
      currentIndex =
        firstMandatoryIndex >= 0
          ? firstMandatoryIndex
          : activeSteps.length > 0
          ? 0
          : -1;
    }

    const nextStep = currentIndex >= 0 ? activeSteps[currentIndex] : null;
    const prevStep = currentIndex > 0 ? activeSteps[currentIndex - 1] : null;

    // ── 5. Persist merged state ────────────────────────────────
    //
    // ✅ FIX: `businessUnitId` is intentionally NOT written back.
    //    It stays whatever it was (or null). Persisting the
    //    caller-supplied BU made it a stale cache that could
    //    disagree with the BU the controller resolved for the
    //    current request.
    const { completedCount, isComplete } = this.deriveProgress(states);

    const updatedProgress = await this.prisma.onboardingProgress.update({
      where: { userId },
      data: {
        steps: writeStepsBlob(
          cursorId !== null ? writeCursor(states, cursorId) : states
        ),
        completedCount,
        totalSteps: TOTAL_STEPS,
        isComplete,
        completedAt: isComplete
          ? progress.completedAt ?? new Date()
          : null,
        companyId: resolvedCompanyId,
        // ✅ businessUnitId is deliberately omitted here.
      },
    });

    // ── 6. Build gates ─────────────────────────────────────────
    const gates: OnboardingGate = {
      gate1_company: !!states[1]?.completed,
      gate2_companySettings: !!states[2]?.completed,
      gate3_salesSettings: !!states[3]?.completed,
      gate4_businessUnit: !!states[4]?.completed,
      gate5_cashRegister: !!states[5]?.completed,
      gate6_users: !!states[6]?.completed,
      gate7_categories: !!states[7]?.completed,
      gate8_suppliers: !!states[8]?.completed,
      gate9_paymentProviders: !!states[9]?.completed,
      gate10_products: !!states[10]?.completed,
      gate11_shift: !!states[11]?.completed,
      gate12_firstSale: !!states[12]?.completed,
    };

    if (degraded.length > 0) {
      logger.warn(
        `[onboarding] degraded probes for user=${userId}: ${degraded.join(', ')}`
      );
    }

    return {
      ...gates,
      nextStep,
      prevStep,
      activeSteps,
      currentIndex,
      totalActive: activeSteps.length,
      cursorStepId: cursorId,
      steps: states,
      completedCount,
      totalCount: TOTAL_STEPS,
      progress: Math.round((completedCount / TOTAL_STEPS) * 100),
      isComplete,
      completedAt: isComplete
        ? toIsoString(updatedProgress.completedAt)
        : null,
    };
  }

  /**
   * Move the user's cursor to a specific step. The service
   * persists the cursor, records an audit event, and returns the
   * refreshed status so the guide can re-render in one round-trip.
   *
   * ✅ FIX: The recursive `getStatus` call passes `''` for
   *    `businessUnitId`. The service has no business remembering
   *    which BU was used before; the controller re-resolves it
   *    from the current request.
   */
  async paginate(userId: string, stepId: number): Promise<OnboardingStatus> {
    if (!userId) throw new AppError('User ID is required', 400);
    if (!STEP_BY_ID.has(stepId)) {
      throw new AppError(`Unknown onboarding step: ${stepId}`, 400);
    }

    const progress = await this.prisma.onboardingProgress.upsert({
      where: { userId },
      create: { userId, steps: {}, totalSteps: TOTAL_STEPS },
      update: {},
    });

    const steps = readStepsBlob(progress.steps);
    const prevState: StepState = steps[String(stepId)] ?? {
      completed: false,
      skipped: false,
      source: 'auto',
    };

    const targetDone = prevState.completed || prevState.skipped;
    const nextBlob = targetDone
      ? writeCursor(stripCursor(steps), null)
      : writeCursor(stripCursor(steps), stepId);

    await this.prisma.onboardingProgress.update({
      where: { userId },
      data: { steps: writeStepsBlob(nextBlob) },
    });

    await this.prisma.onboardingEvent.create({
      data: {
        userId,
        stepId,
        stepKey: `step_${stepId}`,
        event: targetDone ? 'ADVANCED_PAST' : 'VIEWED',
        previousState: writeNullableJson({
          cursorStepId: readCursor(steps),
        }),
        newState: writeNullableJson({
          cursorStepId: targetDone ? null : stepId,
        }),
        source: 'manual',
      },
    });

    // ✅ FIX: do not pass a stale BU; let the caller re-resolve.
    return this.getStatus(
      userId,
      '',
      progress.companyId ?? null
    );
  }

  /**
   * Manually mark a step as completed. Returns the updated step
   * AND the full refreshed status so callers don't need a second
   * round-trip.
   *
   * ✅ FIX: The recursive `getStatus` call passes `''` for
   *    `businessUnitId`.
   */
  async markStepCompleted(
    userId: string,
    stepId: number,
    source: 'manual' | 'admin' = 'manual',
    notes?: string
  ): Promise<MarkStepResult> {
    if (!userId) throw new AppError('User ID is required', 400);
    if (!STEP_BY_ID.has(stepId)) {
      throw new AppError(`Unknown onboarding step: ${stepId}`, 400);
    }

    const progress = await this.prisma.onboardingProgress.upsert({
      where: { userId },
      create: { userId, steps: {}, totalSteps: TOTAL_STEPS },
      update: {},
    });

    const raw = readStepsBlob(progress.steps);
    const steps = stripCursor(raw);
    const cursorId = readCursor(raw);

    const prev: StepState = steps[String(stepId)] ?? {
      completed: false,
      skipped: false,
      source: 'auto',
    };

    const now = new Date().toISOString();
    const updated: StepState = {
      ...prev,
      completed: true,
      completedAt: prev.completedAt ?? now,
      skipped: false,
      source,
      notes,
    };
    steps[String(stepId)] = updated;

    const { completedCount, isComplete } = this.deriveProgress(
      this.toNumericStates(steps)
    );

    const nextCursor = cursorId === stepId ? null : cursorId;

    await this.prisma.onboardingProgress.update({
      where: { userId },
      data: {
        steps: writeStepsBlob(writeCursor(steps, nextCursor)),
        completedCount,
        totalSteps: TOTAL_STEPS,
        isComplete,
        completedAt: isComplete ? new Date() : null,
      },
    });

    await this.prisma.onboardingEvent.create({
      data: {
        userId,
        stepId,
        stepKey: `step_${stepId}`,
        event: 'COMPLETED',
        previousState: writeNullableJson(prev),
        newState: writeNullableJson(updated),
        source,
        notes,
      },
    });

    // ✅ FIX: do not pass a stale BU.
    return {
      success: true,
      step: updated,
      status: await this.getStatus(
        userId,
        '',
        progress.companyId ?? null
      ),
    };
  }

  /**
   * Mark an optional step as skipped. Mandatory steps throw 400.
   *
   * ✅ FIX: The recursive `getStatus` call passes `''` for
   *    `businessUnitId`.
   */
  async skipStep(
    userId: string,
    stepId: number,
    source: 'manual' | 'admin' = 'manual',
    notes?: string
  ): Promise<MarkStepResult> {
    if (!userId) throw new AppError('User ID is required', 400);
    if (!STEP_BY_ID.has(stepId)) {
      throw new AppError(`Unknown onboarding step: ${stepId}`, 400);
    }
    if (!OPTIONAL_STEP_IDS.has(stepId)) {
      throw new AppError(
        `Step ${stepId} is mandatory and cannot be skipped`,
        400
      );
    }

    const progress = await this.prisma.onboardingProgress.upsert({
      where: { userId },
      create: { userId, steps: {}, totalSteps: TOTAL_STEPS },
      update: {},
    });

    const raw = readStepsBlob(progress.steps);
    const steps = stripCursor(raw);
    const cursorId = readCursor(raw);

    const prev: StepState = steps[String(stepId)] ?? {
      completed: false,
      skipped: false,
      source: 'auto',
    };

    const now = new Date().toISOString();
    const updated: StepState = {
      ...prev,
      skipped: true,
      skippedAt: prev.skippedAt ?? now,
      source,
      notes,
    };
    steps[String(stepId)] = updated;

    const { completedCount, isComplete } = this.deriveProgress(
      this.toNumericStates(steps)
    );

    const nextCursor = cursorId === stepId ? null : cursorId;

    await this.prisma.onboardingProgress.update({
      where: { userId },
      data: {
        steps: writeStepsBlob(writeCursor(steps, nextCursor)),
        completedCount,
        totalSteps: TOTAL_STEPS,
        isComplete,
        completedAt: isComplete ? new Date() : null,
      },
    });

    await this.prisma.onboardingEvent.create({
      data: {
        userId,
        stepId,
        stepKey: `step_${stepId}`,
        event: 'SKIPPED',
        previousState: writeNullableJson(prev),
        newState: writeNullableJson(updated),
        source,
        notes,
      },
    });

    // ✅ FIX: do not pass a stale BU.
    return {
      success: true,
      step: updated,
      status: await this.getStatus(
        userId,
        '',
        progress.companyId ?? null
      ),
    };
  }

  /**
   * Reset onboarding progress for a user. Records an audit event.
   * Clears the cursor too, so the guide starts fresh at step 1.
   *
   * ✅ FIX: The recursive `getStatus` call passes `''` for
   *    `businessUnitId`.
   */
  async reset(
    userId: string,
    performedBy: string
  ): Promise<{ success: true; status: OnboardingStatus }> {
    const prev = await this.prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    await this.prisma.onboardingProgress.upsert({
      where: { userId },
      create: {
        userId,
        steps: {},
        totalSteps: TOTAL_STEPS,
        completedCount: 0,
        isComplete: false,
      },
      update: {
        steps: {},
        completedCount: 0,
        isComplete: false,
        completedAt: null,
      },
    });

    await this.prisma.onboardingEvent.create({
      data: {
        userId,
        stepId: 0,
        stepKey: 'reset',
        event: 'RESET',
        previousState: writeNullableJson(prev),
        newState: Prisma.JsonNull,
        source: 'admin',
        notes: `Reset by ${performedBy}`,
      },
    });

    // ✅ FIX: do not pass a stale BU.
    return {
      success: true,
      status: await this.getStatus(
        userId,
        '',
        prev?.companyId ?? null
      ),
    };
  }

  /**
   * Convenience: is a specific route blocked by the current next
   * step's `blocksRoutes`?
   */
  async isRouteBlocked(
    route: string,
    userId: string,
    businessUnitId: string,
    companyId?: string | null
  ): Promise<{ blocked: boolean; step?: NextStep }> {
    const status = await this.getStatus(userId, businessUnitId, companyId);
    if (!status.nextStep) return { blocked: false };

    const blocked = status.nextStep.blocksRoutes.some((base) =>
      route.startsWith(base)
    );

    return blocked
      ? { blocked: true, step: status.nextStep }
      : { blocked: false };
  }

  private toNumericStates(
    steps: Record<string, StepState>
  ): Record<number, StepState> {
    const out: Record<number, StepState> = {};
    for (const [k, v] of Object.entries(steps)) {
      const id = Number(k);
      if (!Number.isInteger(id) || !STEP_BY_ID.has(id)) continue;
      out[id] = v;
    }
    return out;
  }
}

export const onboardingService = new OnboardingService();
export default onboardingService;
