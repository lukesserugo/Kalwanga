// packages/mobile/hooks/useTheme.ts
import { useColorScheme } from "react-native";
import { useMemo } from "react";

// ============================================
// THEME TYPES
// ============================================

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  background: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  card: string;
  cardShadow: string;
  surface: string;
  overlay: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
}

export interface ThemeTypography {
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    "4xl": number;
  };
  fontWeight: {
    thin: string;
    light: string;
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
  };
}

export interface ThemeShadows {
  none: ShadowStyle;
  sm: ShadowStyle;
  md: ShadowStyle;
  lg: ShadowStyle;
  xl: ShadowStyle;
}

interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  typography: ThemeTypography;
  shadows: ThemeShadows;
  isDark: boolean;
  borderRadius: {
    none: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    full: number;
  };
}

// ============================================
// LIGHT THEME — brand orange
// ============================================
//
// Uses the brand palette from Web (via @pos/tokens). The values here
// mirror what used to be inline in this file, kept in sync manually
// so mobile doesn't need a runtime dependency on the tokens package.

const lightColors: ThemeColors = {
  primary: "#F97316",        // brand-500 (orange) — matches Web
  primaryLight: "#FB923C",   // brand-400
  primaryDark: "#EA580C",    // brand-600
  secondary: "#8B5CF6",      // secondary-500
  background: "#F9FAFB",     // gray-50
  text: "#111827",           // gray-900
  textSecondary: "#6B7280",  // gray-500
  border: "#E5E7EB",         // gray-200
  error: "#EF4444",          // danger-500
  success: "#22C55E",        // success-500
  warning: "#F59E0B",        // warning-500
  info: "#3B82F6",           // primary-500
  card: "#FFFFFF",
  cardShadow: "rgba(0,0,0,0.1)",
  surface: "#F3F4F6",
  overlay: "rgba(0,0,0,0.5)",
};

// ============================================
// DARK THEME
// ============================================

const darkColors: ThemeColors = {
  primary: "#FB923C",        // brand-400 (lighter for dark bg)
  primaryLight: "#FDBA74",   // brand-300
  primaryDark: "#F97316",    // brand-500
  secondary: "#A78BFA",      // secondary-400
  background: "#030712",     // gray-950
  text: "#F9FAFB",           // gray-50
  textSecondary: "#9CA3AF",  // gray-400
  border: "#1F2937",         // gray-800
  error: "#F87171",          // danger-400
  success: "#4ADE80",        // success-400
  warning: "#FBBF24",        // warning-400
  info: "#60A5FA",           // primary-400
  card: "#111827",           // gray-900
  cardShadow: "rgba(0,0,0,0.3)",
  surface: "#1F2937",        // gray-800
  overlay: "rgba(0,0,0,0.7)",
};

// ============================================
// SPACING / TYPOGRAPHY / RADII (static)
// ============================================

const spacing: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
};

const typography: ThemeTypography = {
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
  },
  fontWeight: {
    thin: "100",
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
};

const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  "3xl": 32,
  full: 9999,
};

// ============================================
// SHADOWS
// ============================================

function getShadows(isDark: boolean): ThemeShadows {
  return {
    none: {
      shadowColor: "transparent",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.5 : 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    xl: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.6 : 0.25,
      shadowRadius: 16,
      elevation: 16,
    },
  };
}

// ============================================
// THE HOOK
// ============================================

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const theme = useMemo((): Theme => {
    const colors = isDark ? darkColors : lightColors;
    const shadows = getShadows(isDark);
    return { colors, spacing, typography, shadows, isDark, borderRadius };
  }, [isDark]);

  const { colors, shadows } = theme;

  // ---------- Helpers ----------

  const getColorWithOpacity = (color: string, opacity: number): string => {
    if (color.startsWith("#")) {
      const hex = color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
  };

  const getSpacing = (size: keyof ThemeSpacing): number =>
    spacing[size] ?? spacing.md;

  const getFontSize = (size: keyof ThemeTypography["fontSize"]): number =>
    typography.fontSize[size] ?? typography.fontSize.md;

  const getBorderRadius = (size: keyof typeof borderRadius): number =>
    borderRadius[size] ?? borderRadius.md;

  const getShadow = (size: keyof ThemeShadows): ShadowStyle =>
    shadows[size] ?? shadows.md;

  const getCardStyle = (elevated = false) => ({
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...(elevated ? shadows.md : shadows.sm),
  });

  const getButtonStyle = (
    variant: "primary" | "secondary" | "outline" | "ghost" = "primary"
  ) => {
    const styles = {
      primary: {
        backgroundColor: colors.primary,
        color: "#FFFFFF",
        borderColor: colors.primary,
      },
      secondary: {
        backgroundColor: colors.secondary,
        color: "#FFFFFF",
        borderColor: colors.secondary,
      },
      outline: {
        backgroundColor: "transparent",
        color: colors.primary,
        borderColor: colors.primary,
        borderWidth: 1,
      },
      ghost: {
        backgroundColor: "transparent",
        color: colors.primary,
        borderColor: "transparent",
      },
    };
    return {
      ...styles[variant],
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    };
  };

  const getInputStyle = (error = false) => ({
    backgroundColor: colors.surface,
    borderColor: error ? colors.error : colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: typography.fontSize.md,
  });

  const getBadgeStyle = (
    type: "primary" | "success" | "error" | "warning" | "info" = "primary"
  ) => {
    const colorMap = {
      primary: colors.primary,
      success: colors.success,
      error: colors.error,
      warning: colors.warning,
      info: colors.info,
    };
    const bgColor = colorMap[type];
    return {
      backgroundColor: `${bgColor}20`,
      borderColor: bgColor,
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    };
  };

  // ---------- Public API ----------
  return {
    theme,
    colors: theme.colors,
    spacing: theme.spacing,
    typography: theme.typography,
    shadows: theme.shadows,
    isDark: theme.isDark,
    borderRadius: theme.borderRadius,

    getColorWithOpacity,
    getSpacing,
    getFontSize,
    getBorderRadius,
    getShadow,
    getCardStyle,
    getButtonStyle,
    getInputStyle,
    getBadgeStyle,

    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    background: theme.colors.background,
    text: theme.colors.text,
    textSecondary: theme.colors.textSecondary,
    border: theme.colors.border,
    error: theme.colors.error,
    success: theme.colors.success,
    warning: theme.colors.warning,
    card: theme.colors.card,

    spacingXS: spacing.xs,
    spacingSM: spacing.sm,
    spacingMD: spacing.md,
    spacingLG: spacing.lg,
    spacingXL: spacing.xl,
    spacing2XL: spacing["2xl"],
    spacing3XL: spacing["3xl"],
  };
}

export default useTheme;
