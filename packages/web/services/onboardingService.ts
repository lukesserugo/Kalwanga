// D:\Projects\Kalwanga\packages\web\services\onboardingService.ts

import { api } from './api';

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
  /** Human-friendly script read aloud by the guide (TTS). */
  narration: string;
  blocks: string[];
  blocksRoutes: string[];
  optional: boolean;
  state: StepState;
  /** 0-based index within the currently-active step list. */
  activeIndex: number;
  /** 1-based position for display, e.g. "Step 3 of 7". */
  displayPosition: number;
  /** Total number of currently-active steps. */
  displayTotal: number;
  /** Registry position of this step (1..12). Always honest. */
  registryPosition: number;
}

export interface OnboardingStatus extends OnboardingGate {
  nextStep: NextStep | null;
  prevStep: NextStep | null;
  activeSteps: NextStep[];
  currentIndex: number;
  totalActive: number;
  /** The persisted cursor step ID, if any. Null when unset. */
  cursorStepId: number | null;
  steps: Record<number, StepState>;
  completedCount: number;
  totalCount: number;
  progress: number;
  isComplete: boolean;
  completedAt: string | null;
}

export interface MarkStepResult {
  step: StepState;
  status: OnboardingStatus;
}

export interface NextStepResponse {
  route: string;
  done: boolean;
  step?: NextStep;
  currentIndex: number;
  totalActive: number;
  prevStep: NextStep | null;
}

// ============================================
// STEP METADATA (mirrors backend STEP_REGISTRY)
// ============================================

const STEP_NAMES: Record<number, string> = {
  1: 'Create your company',
  2: 'Company settings',
  3: 'Sales settings',
  4: 'Create a business unit',
  5: 'Add a cash register',
  6: 'Invite your team',
  7: 'Create product categories',
  8: 'Add a supplier',
  9: 'Activate payment providers',
  10: 'Add your first product',
  11: 'Open a shift',
  12: 'Make a test sale',
};

export const OPTIONAL_STEP_IDS = new Set<number>([6, 7, 8, 12]);

const MIN_STEP_ID = 1;
const MAX_STEP_ID = 12;

// ============================================
// ROUTE VALIDATION
// ============================================

/**
 * Reserved words that must never appear where a company [id] would
 * belong. E.g. `/admin/companies/settings` is wrong — it should be
 * `/admin/companies/<realId>/settings`.
 */
const RESERVED_COMPANY_IDS = new Set([
  'settings',
  'default',
  'search',
  'email',
  'by-business-unit',
  'ensure-user',
  'bulk',
  'export',
  'activity',
  'stats',
  'business-units',
  'default-business-unit',
  'new',
  'edit',
]);

/**
 * Known-good step route patterns. The backend may append query
 * strings — we only validate the path.
 */
const STEP_ROUTE_PATTERNS: RegExp[] = [
  /^\/admin\/companies\/new$/,                 // 1
  /^\/admin\/companies\/[^/]+\/settings$/,     // 2
  /^\/admin\/sales\/settings$/,                // 3
  /^\/admin\/business-units\/new$/,            // 4
  /^\/admin\/shifts\/registers$/,              // 5
  /^\/admin\/users$/,                          // 6
  /^\/admin\/categories$/,                     // 7
  /^\/admin\/suppliers\/create$/,              // 8
  /^\/admin\/payments\/payment-providers$/,    // 9
  /^\/admin\/catalog\/add$/,                   // 10
  /^\/admin\/shifts\/current$/,                // 11
  /^\/admin\/sales\/pos$/,                     // 12
];

/**
 * Validate a step route.
 *
 * Rules:
 *   1. Must start with `/`.
 *   2. Must not contain unresolved `:param` tokens.
 *   3. Must match one of the known step route patterns.
 *   4. If it contains `/admin/companies/<X>/...`, `<X>` must not be
 *      a reserved word.
 */
export function isValidStepRoute(route: unknown): route is string {
  if (typeof route !== 'string' || !route.startsWith('/')) return false;

  const path = route.split('?')[0];

  if (path.includes(':')) return false;

  const segments = path.split('/').filter(Boolean);
  const companiesIdx = segments.indexOf('companies');
  if (companiesIdx >= 0 && segments.length > companiesIdx + 1) {
    const after = segments[companiesIdx + 1];
    if (after === 'new' || after === 'edit') {
      // Literal siblings of [id] — fine.
    } else if (RESERVED_COMPANY_IDS.has(after)) {
      return false;
    }
  }

  return STEP_ROUTE_PATTERNS.some((re) => re.test(path));
}

// ============================================
// SANITIZERS
// ============================================

function sanitizeStepState(raw: unknown): StepState {
  if (!raw || typeof raw !== 'object') {
    return { completed: false, skipped: false, source: 'auto' };
  }
  const r = raw as Record<string, unknown>;
  const source =
    r.source === 'manual' || r.source === 'admin' || r.source === 'auto'
      ? r.source
      : 'auto';
  return {
    completed: Boolean(r.completed),
    completedAt:
      typeof r.completedAt === 'string' ? r.completedAt : undefined,
    skipped: Boolean(r.skipped),
    skippedAt: typeof r.skippedAt === 'string' ? r.skippedAt : undefined,
    source,
    notes: typeof r.notes === 'string' ? r.notes : undefined,
  };
}

/**
 * Coerce an unknown value into a NextStep. Returns null if the
 * route is invalid — the UI should not chase a broken target.
 *
 * When pagination fields are absent, we fall back to the step's
 * registry position (`id`) rather than `0` — so "Step N of 12"
 * stays chronologically honest even if the server omitted them.
 */
function sanitizeNextStep(
  raw: unknown,
  fallbackIndex?: number,
  fallbackTotal?: number
): NextStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = Number(r.id);
  if (!Number.isInteger(id) || id < MIN_STEP_ID || id > MAX_STEP_ID) {
    return null;
  }

  const route = typeof r.route === 'string' ? r.route : '';
  if (!isValidStepRoute(route)) {
    console.warn('[onboardingService] Invalid nextStep route:', route);
    return null;
  }

  const narration =
    typeof r.narration === 'string' ? r.narration.trim() : '';
  if (!narration) {
    console.warn('[onboardingService] nextStep missing narration:', id);
  }

  const reason = typeof r.reason === 'string' ? r.reason : '';
  if (!reason) {
    console.warn('[onboardingService] nextStep missing reason:', id);
  }

  // ── Pagination: prefer server values, then positional
  // fallbacks, then the registry position (always honest).
  const activeIndex =
    Number.isInteger(r.activeIndex) && (r.activeIndex as number) >= 0
      ? (r.activeIndex as number)
      : typeof fallbackIndex === 'number' && fallbackIndex >= 0
      ? fallbackIndex
      : -1;

  const registryPosition =
    Number.isInteger(r.registryPosition) &&
    (r.registryPosition as number) >= 1
      ? (r.registryPosition as number)
      : id;

  const displayPosition =
    Number.isInteger(r.displayPosition) &&
    (r.displayPosition as number) >= 1
      ? (r.displayPosition as number)
      : activeIndex >= 0
      ? activeIndex + 1
      : registryPosition;

  const displayTotal =
    Number.isInteger(r.displayTotal) && (r.displayTotal as number) >= 1
      ? (r.displayTotal as number)
      : typeof fallbackTotal === 'number' && fallbackTotal >= 1
      ? fallbackTotal
      : MAX_STEP_ID;

  return {
    id,
    name:
      typeof r.name === 'string' && r.name
        ? r.name
        : STEP_NAMES[id] ?? `Step ${id}`,
    route,
    reason,
    narration: narration || reason,
    blocks: Array.isArray(r.blocks)
      ? r.blocks.filter((b): b is string => typeof b === 'string')
      : [],
    blocksRoutes: Array.isArray(r.blocksRoutes)
      ? r.blocksRoutes.filter((b): b is string => typeof b === 'string')
      : [],
    optional: Boolean(r.optional) || OPTIONAL_STEP_IDS.has(id),
    state: sanitizeStepState(r.state),
    activeIndex,
    displayPosition,
    displayTotal,
    registryPosition,
  };
}

/**
 * Coerce an unknown value into a full OnboardingStatus. Single
 * choke point so the rest of the app can trust the shape.
 *
 * `isComplete` is defined once: no active steps remain. Same as
 * the backend. No drift.
 */
export function sanitizeStatus(raw: unknown): OnboardingStatus {
  const empty: OnboardingStatus = {
    gate1_company: false,
    gate2_companySettings: false,
    gate3_salesSettings: false,
    gate4_businessUnit: false,
    gate5_cashRegister: false,
    gate6_users: false,
    gate7_categories: false,
    gate8_suppliers: false,
    gate9_paymentProviders: false,
    gate10_products: false,
    gate11_shift: false,
    gate12_firstSale: false,
    nextStep: null,
    prevStep: null,
    activeSteps: [],
    currentIndex: -1,
    totalActive: 0,
    cursorStepId: null,
    steps: {},
    completedCount: 0,
    totalCount: 12,
    progress: 0,
    isComplete: false,
    completedAt: null,
  };

  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Record<string, unknown>;

  // ── Steps map ──────────────────────────────────────────────
  const rawSteps =
    r.steps && typeof r.steps === 'object' && !Array.isArray(r.steps)
      ? (r.steps as Record<string, unknown>)
      : {};
  const steps: Record<number, StepState> = {};
  for (const [k, v] of Object.entries(rawSteps)) {
    const id = Number(k);
    if (Number.isInteger(id) && id >= MIN_STEP_ID && id <= MAX_STEP_ID) {
      steps[id] = sanitizeStepState(v);
    }
  }
  // Backfill missing step IDs so the UI always shows all 12 rows.
  for (let i = MIN_STEP_ID; i <= MAX_STEP_ID; i++) {
    if (!steps[i]) {
      steps[i] = { completed: false, skipped: false, source: 'auto' };
    }
  }

  // ── Active steps list ──────────────────────────────────────
  let activeSteps: NextStep[] = [];
  const rawActive = r.activeSteps;

  if (Array.isArray(rawActive) && rawActive.length > 0) {
    const total = rawActive.length;
    activeSteps = rawActive
      .map((entry, i) => sanitizeNextStep(entry, i, total))
      .filter((s): s is NextStep => s !== null);
  } else {
    // Legacy fallback: derive from nextStep only.
    const fallbackNext = sanitizeNextStep(r.nextStep, 0, 1);
    if (fallbackNext) activeSteps = [fallbackNext];
  }

  // ── nextStep and prevStep ──────────────────────────────────
  const serverNext = sanitizeNextStep(r.nextStep);
  const nextStep =
    serverNext ?? (activeSteps.length > 0 ? activeSteps[0] : null);

  const prevStep = sanitizeNextStep(r.prevStep);

  // ── currentIndex and totalActive ───────────────────────────
  const totalActive =
    Number.isInteger(r.totalActive) && (r.totalActive as number) >= 0
      ? (r.totalActive as number)
      : activeSteps.length;

  let currentIndex: number;
  if (Number.isInteger(r.currentIndex)) {
    currentIndex = r.currentIndex as number;
  } else if (nextStep) {
    const found = activeSteps.findIndex((s) => s.id === nextStep.id);
    currentIndex = found >= 0 ? found : 0;
  } else {
    currentIndex = -1;
  }

  // ── cursor ─────────────────────────────────────────────────
  const cursorStepId =
    Number.isInteger(r.cursorStepId) &&
    (r.cursorStepId as number) >= MIN_STEP_ID &&
    (r.cursorStepId as number) <= MAX_STEP_ID
      ? (r.cursorStepId as number)
      : null;

  // ── counts and progress ────────────────────────────────────
  const completedCount = Object.values(steps).filter(
    (s) => s.completed
  ).length;

  // Single source of truth for completion — same as the backend.
  const isComplete = activeSteps.length === 0;

  return {
    gate1_company: Boolean(r.gate1_company),
    gate2_companySettings: Boolean(r.gate2_companySettings),
    gate3_salesSettings: Boolean(r.gate3_salesSettings),
    gate4_businessUnit: Boolean(r.gate4_businessUnit),
    gate5_cashRegister: Boolean(r.gate5_cashRegister),
    gate6_users: Boolean(r.gate6_users),
    gate7_categories: Boolean(r.gate7_categories),
    gate8_suppliers: Boolean(r.gate8_suppliers),
    gate9_paymentProviders: Boolean(r.gate9_paymentProviders),
    gate10_products: Boolean(r.gate10_products),
    gate11_shift: Boolean(r.gate11_shift),
    gate12_firstSale: Boolean(r.gate12_firstSale),
    nextStep,
    prevStep,
    activeSteps,
    currentIndex,
    totalActive,
    cursorStepId,
    steps,
    completedCount,
    totalCount: 12,
    progress:
      typeof r.progress === 'number'
        ? Math.max(0, Math.min(100, Math.round(r.progress)))
        : Math.round((completedCount / 12) * 100),
    isComplete,
    completedAt:
      typeof r.completedAt === 'string' ? r.completedAt : null,
  };
}

// ============================================
// RESPONSE UNWRAPPING
// ============================================

function unwrap<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    const maybe = (response as { data?: unknown }).data;
    if (maybe !== undefined) return maybe as T;
  }
  return response as T;
}

// ============================================
// SERVICE
// ============================================

export const onboardingService = {
  /**
   * GET /onboarding/status
   */
  async getStatus(): Promise<OnboardingStatus> {
    const response = await api.get('/onboarding/status');
    return sanitizeStatus(unwrap<unknown>(response));
  },

  /**
   * GET /onboarding/next
   */
  async getNext(): Promise<NextStepResponse> {
    const response = await api.get('/onboarding/next');
    const raw = unwrap<Record<string, unknown>>(response);

    if (!raw || typeof raw !== 'object') {
      return {
        route: '/dashboard',
        done: true,
        currentIndex: -1,
        totalActive: 0,
        prevStep: null,
      };
    }

    const route =
      typeof raw.route === 'string' ? raw.route : '/dashboard';
    const done = Boolean(raw.done);
    const step = sanitizeNextStep(raw.step) ?? undefined;
    const prevStep = sanitizeNextStep(raw.prevStep);

    const currentIndex = Number.isInteger(raw.currentIndex)
      ? (raw.currentIndex as number)
      : step
      ? step.activeIndex
      : -1;

    const totalActive = Number.isInteger(raw.totalActive)
      ? (raw.totalActive as number)
      : step
      ? step.displayTotal
      : 0;

    // If the backend said "not done" but shipped no valid step,
    // fall back to the dashboard — better than a broken link.
    if (!done && !step) {
      return {
        route: '/dashboard',
        done: true,
        currentIndex: -1,
        totalActive: 0,
        prevStep: null,
      };
    }

    return { route, done, step, currentIndex, totalActive, prevStep };
  },

  /**
   * GET /onboarding/check?route=/admin/inventory
   */
  async checkRoute(
    route: string
  ): Promise<{ blocked: boolean; step?: NextStep }> {
    const response = await api.get('/onboarding/check', {
      params: { route },
    });
    const raw = unwrap<Record<string, unknown>>(response);

    if (!raw || typeof raw !== 'object') return { blocked: false };

    const step = sanitizeNextStep(raw.step);
    if (raw.step && !step) {
      // Backend claimed a step but the route was invalid — treat
      // the route as unblocked to avoid a redirect loop.
      return { blocked: false };
    }

    return {
      blocked: Boolean(raw.blocked),
      step: step ?? undefined,
    };
  },

  /**
   * POST /onboarding/paginate
   * Body: { stepId }
   *
   * Persists the cursor server-side and returns the refreshed
   * status. This is what actually moves the guide.
   */
  async paginate(stepId: number): Promise<OnboardingStatus> {
    if (
      !Number.isInteger(stepId) ||
      stepId < MIN_STEP_ID ||
      stepId > MAX_STEP_ID
    ) {
      throw new Error(`paginate: invalid stepId ${stepId}`);
    }

    const response = await api.post('/onboarding/paginate', { stepId });
    return sanitizeStatus(unwrap<unknown>(response));
  },

  /**
   * POST /onboarding/mark-complete
   * Body: { stepId, notes? }
   */
  async markComplete(
    stepId: number,
    notes?: string
  ): Promise<MarkStepResult> {
    if (
      !Number.isInteger(stepId) ||
      stepId < MIN_STEP_ID ||
      stepId > MAX_STEP_ID
    ) {
      throw new Error(`markComplete: invalid stepId ${stepId}`);
    }

    const response = await api.post('/onboarding/mark-complete', {
      stepId,
      notes,
    });
    const raw = unwrap<Record<string, unknown>>(response);

    return {
      step: sanitizeStepState(raw?.step),
      status: sanitizeStatus(raw?.status),
    };
  },

  /**
   * POST /onboarding/skip
   * Body: { stepId, notes? }
   * Only optional steps can be skipped — enforced client-side
   * first so we don't waste a round-trip on a guaranteed 400.
   */
  async skip(stepId: number, notes?: string): Promise<MarkStepResult> {
    if (
      !Number.isInteger(stepId) ||
      stepId < MIN_STEP_ID ||
      stepId > MAX_STEP_ID
    ) {
      throw new Error(`skip: invalid stepId ${stepId}`);
    }
    if (!OPTIONAL_STEP_IDS.has(stepId)) {
      throw new Error(`skip: step ${stepId} is mandatory`);
    }

    const response = await api.post('/onboarding/skip', {
      stepId,
      notes,
    });
    const raw = unwrap<Record<string, unknown>>(response);

    return {
      step: sanitizeStepState(raw?.step),
      status: sanitizeStatus(raw?.status),
    };
  },

  /**
   * POST /onboarding/reset
   * Body: { userId? }
   * SUPER_ADMIN or ADMIN only. Omit userId to reset your own.
   */
  async reset(userId?: string): Promise<OnboardingStatus> {
    const response = await api.post('/onboarding/reset', { userId });
    return sanitizeStatus(unwrap<unknown>(response));
  },
};

export default onboardingService;
