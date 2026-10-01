// packages/backend/src/controllers/dashboardController.ts

import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboardService.js';
import { AppError } from '../middleware/errorHandler.js';

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================
//
// Precedence for the business unit that governs this request:
//
//   1. `businessUnitId` query param — set by the frontend when
//      the operator picks a specific BU from the dashboard's
//      selector. This is the authoritative choice for that request
//      and overrides anything the JWT carries.
//
//   2. `req.user.businessUnitId` — the user's primary BU, resolved
//      from the auth middleware. Used when the operator has not
//      picked a specific BU (the "All Business Units" selection
//      passes no query param, so the primary BU is the scope for
//      aggregate queries).
//
//   3. A 400. Never fabricate a BU. Every dashboard response that
//      contains amounts must be denominated in a real BU's currency.

function resolveBusinessUnitId(req: Request): string {
  const fromQuery = req.query.businessUnitId as string | undefined;
  const fromUser = (req as any).user?.businessUnitId as string | undefined;
  const businessUnitId = fromQuery || fromUser;

  if (!businessUnitId) {
    throw new AppError('Business unit required', 400);
  }

  return businessUnitId;
}

// ============================================
// RANGE NORMALIZATION
// ============================================
//
// Translates the frontend's `range` query param into a day count
// used by the trend and activity queries. The frontend uses
// `today | week | month | quarter | year`; anything else (including
// an absent param) falls through to the default 7-day window.

function rangeToDays(range?: string): number {
  switch ((range || 'week').toLowerCase()) {
    case 'today':
      return 1;
    case 'week':
      return 7;
    case 'month':
      return 30;
    case 'quarter':
      return 90;
    case 'year':
      return 365;
    default:
      return 7;
  }
}

// ============================================
// CONTROLLER
// ============================================

export const dashboardController = {
  // ============================================
  // GET /dashboard/stats
  // ============================================
  //
  // Returns the aggregate sales, inventory, customer, supplier,
  // register, and order stats for the resolved BU, plus the daily
  // sales trend for the last 7 days.
  //
  // ⚠ The response carries a `currency` field at the top level,
  //   resolved by `dashboardService.getStats` from the BU's own
  //   `currency` column. The frontend reads it as the first source
  //   of truth for rendering every amount on the dashboard, so this
  //   field MUST NOT be dropped or renamed. If the service ever
  //   stops populating it, the dashboard falls back to the currency
  //   registry — but that fallback is slower and can leave the UI
  //   in a transient unresolved state while it round-trips.

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const stats = await dashboardService.getStats(businessUnitId);

      // `stats.currency` is already populated by the service from
      // the BU row. Forward it as-is — the frontend reads it under
      // `data.currency`.
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // GET /dashboard/realtime
  // ============================================
  //
  // Returns the "live" slice of the dashboard: recent sales, low-
  // stock inventory, unread notifications, open registers, pending
  // orders, and the derived alert list. Used by the dashboard's
  // polling layer when the operator wants fresher data than the
  // stats endpoint provides.

  async getRealtimeData(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const realtimeData =
        await dashboardService.getRealtimeData(businessUnitId);

      res.json({ success: true, data: realtimeData });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // GET /dashboard/live
  // ============================================
  //
  // Combines `getStats` and `getRealtimeData` into a single response
  // so the dashboard can render everything from one round-trip. The
  // `currency` field from `getStats` is preserved because the two
  // payloads are merged with a shallow spread.

  async getLiveDashboard(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const liveData =
        await dashboardService.getLiveDashboard(businessUnitId);

      res.json({ success: true, data: liveData });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // GET /dashboard/top-products?limit=10&range=week
  // ============================================
  //
  // Top-selling products for the resolved BU over the given range.
  // `revenue` on each row is denominated in the BU's ledger
  // currency; the caller already knows which currency that is from
  // the `/dashboard/stats` response it fetched first.

  async getTopProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const limit = Number(req.query.limit ?? 10);
      const days = rangeToDays(req.query.range as string | undefined);

      const topProducts = await dashboardService.getTopProducts(
        businessUnitId,
        Number.isFinite(limit) ? limit : 10,
        days,
      );

      res.json({ success: true, data: topProducts });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // GET /dashboard/low-stock
  // ============================================
  //
  // The low-stock inventory rows for the resolved BU, ordered by
  // ascending quantity. Each row carries a `severity` field
  // (`CRITICAL | HIGH | MEDIUM`) derived from how far below the
  // reorder point the item has fallen.

  async getLowStockAlerts(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const alerts =
        await dashboardService.getLowStockAlerts(businessUnitId);

      res.json({ success: true, data: alerts });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // GET /dashboard/activity?limit=10&range=week
  // ============================================
  //
  // Chronologically merged feed of sales, orders, and low-stock
  // events for the resolved BU. Each event carries an `amount` in
  // the BU's ledger currency; the caller reads it under the
  // `currency` it already resolved from `/dashboard/stats`.

  async getActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const limit = Number(req.query.limit ?? 10);
      const days = rangeToDays(req.query.range as string | undefined);

      const activity = await dashboardService.getActivity(
        businessUnitId,
        Number.isFinite(limit) ? limit : 10,
        days,
      );

      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // GET /dashboard/trends?range=week
  // ============================================
  //
  // Gap-filled day-by-day series for sales and orders. Every
  // calendar day in the range appears in the response, even when no
  // sales or orders occurred. `value` on each sales point is
  // denominated in the BU's ledger currency.

  async getTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const days = rangeToDays(req.query.range as string | undefined);

      const trends = await dashboardService.getTrends(businessUnitId, days);

      res.json({ success: true, data: trends });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // GET /dashboard/sales-summary?startDate=…&endDate=…
  // ============================================
  //
  // Day-bucketed sales totals for the given date window. When
  // `startDate` and `endDate` are omitted, the window defaults to
  // month-to-date. All amounts are in the BU's ledger currency.

  async getSalesSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const start = startDate
        ? new Date(startDate as string)
        : new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          );
      const end = endDate ? new Date(endDate as string) : new Date();

      const summary = await dashboardService.getSalesSummary(
        businessUnitId,
        start,
        end,
      );

      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },
};

export default dashboardController;
