// packages/web/components/companies/CompanyCurrencyBreakdown.tsx
'use client';

import { useMemo } from 'react';

// ============================================
// TYPES
// ============================================

interface CompanyCurrencyBreakdownProps {
  /**
   * Currency distribution as returned by
   * `companyService.getReports().companiesByCurrency`.
   *
   * Optional so a parent can render the component before the
   * reports fetch resolves, without a `?? []` at every call site.
   */
  data?: Array<{ currency: string; count: number }> | null;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Palette for the bar segments and legend swatches.
 *
 * Six distinct tokens — the previous version listed `bg-secondary-500`
 * twice, which made slots 1 and 5 render identically when the
 * breakdown had 5 or 6 rows.
 *
 * `bg-brand-accent-500` slots in between `bg-warning-500` and
 * `bg-secondary-500` to keep adjacent segments visually distinct.
 * If your design system doesn't have `brand-accent`, swap it for
 * another distinct token (e.g. `bg-info-500`); the important thing
 * is that no two entries are equal.
 */
const COLORS = [
  'bg-brand-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-brand-accent-500',
  'bg-secondary-500',
  'bg-danger-500',
] as const;

// ============================================
// HELPERS
// ============================================

/**
 * Coerce a raw count into a non-negative finite integer.
 *
 * The backend always emits `count: number`, but this component is
 * rendered by several parents, some of which synthesize data in
 * loading / error states. A defensive coerce costs nothing and
 * prevents `NaN` percentages in the legend.
 */
function safeCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Best-effort display label for a currency code.
 *
 * Falls back to `'—'` when the row has no usable code, so the legend
 * never renders an empty string that looks like a layout bug.
 */
function displayCurrency(raw: unknown): string {
  if (typeof raw !== 'string') return '—';
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : '—';
}

// ============================================
// COMPONENT
// ============================================

export default function CompanyCurrencyBreakdown({
  data,
}: CompanyCurrencyBreakdownProps) {
  /**
   * Normalize once, then derive everything from the normalized list.
   *
   * This:
   *   • drops rows with a `count` of 0 (they'd add empty bar segments
   *     and confusing "0 (0%)" legend rows)
   *   • coerces each count to a finite non-negative integer
   *   • sorts descending so the bar reads largest-first
   *   • memoizes so the derived array is stable across re-renders
   *     (React reconciliation on the segments is cheaper when the
   *     array identity doesn't churn)
   */
  const rows = useMemo(() => {
    const raw = Array.isArray(data) ? data : [];
    return raw
      .map((row) => ({
        currency: displayCurrency(row?.currency),
        count: safeCount(row?.count),
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.count, 0),
    [rows],
  );

  // ── Empty state ─────────────────────────────────────────────

  if (rows.length === 0 || total === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No data in range
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/*
        Bar.

        `aria-hidden` because the segments are purely decorative —
        the legend below carries the actual numbers, and making
        assistive tech read 6 unlabelled divs adds no information.
      */}
      <div
        className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800"
        aria-hidden="true"
      >
        {rows.map((row, i) => {
          // Guard against float rounding producing a percentage
          // slightly over 100, which would overflow the flex
          // container and clip the last segment.
          const pct = Math.min(100, (row.count / total) * 100);

          return (
            <div
              key={`${row.currency}-${i}`}
              className={`${COLORS[i % COLORS.length]} transition-all`}
              style={{
                width: `${pct}%`,
                // Give any non-trivial segment a minimum pixel width
                // so a 0.4% sliver is still visible.
                minWidth: pct > 0 ? '2px' : undefined,
              }}
              title={`${row.currency}: ${row.count}`}
            />
          );
        })}
      </div>

      {/*
        Legend.

        The `<ul>` is the accessible representation of the bar above.
        Each row announces currency, count, and percentage.
      */}
      <ul className="space-y-1.5" aria-label="Currency distribution">
        {rows.map((row, i) => {
          const pct = Math.round((row.count / total) * 100);

          return (
            <li
              key={`${row.currency}-${i}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    COLORS[i % COLORS.length]
                  }`}
                  aria-hidden="true"
                />
                <span className="text-gray-700 dark:text-gray-300 font-mono text-xs truncate">
                  {row.currency}
                </span>
              </span>
              <span className="text-gray-900 dark:text-white font-medium tabular-nums flex-shrink-0">
                {row.count}
                <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs tabular-nums">
                  ({pct}%)
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
