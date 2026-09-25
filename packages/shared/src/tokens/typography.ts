// packages/shared/src/tokens/typography.ts

export const fontSizes = {
  '3xs': 11,   // 0.6875rem ≈ 11px
  '2xs': 10,   // 0.625rem  = 10px
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

// ⚠️ Do NOT rename this back to `spacing`. It collides with the
// `spacing` export in ./spacing.ts, which causes Metro to throw
// "Cannot redefine property: spacing" at runtime. The two exports
// are conceptually different anyway:
//
//   ./spacing.ts        → layout scale (px integer values)
//   ./typography.ts     → typography-relative scale
//
// If you need the layout spacing, import from './spacing' instead.
export const typographySpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export type FontSizeKey = keyof typeof fontSizes;
export type TypographySpacingKey = keyof typeof typographySpacing;
export type RadiusKey = keyof typeof radii;
