import { useColorScheme } from "react-native";
import { useMemo } from "react";

// Define theme colors
interface ThemeColors {
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

// Define theme spacing
interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
}

// Define theme typography
interface ThemeTypography {
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
    thin: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    light: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    normal: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    medium: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    semibold: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    bold: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  };
}

// Define theme shadows
interface ThemeShadows {
  none: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  sm: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  md: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  lg: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  xl: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
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

// Light theme colors
const lightColors: ThemeColors = {
  primary: "#007AFF",
  primaryLight: "#4DA3FF",
  primaryDark: "#0055CC",
  secondary: "#5856D6",
  background: "#F2F2F7",
  text: "#000000",
  textSecondary: "#666666",
  border: "#E5E5E5",
  error: "#FF3B30",
  success: "#34C759",
  warning: "#FF9500",
  info: "#3498DB",
  card: "#FFFFFF",
  cardShadow: "rgba(0,0,0,0.1)",
  surface: "#F8F8F8",
  overlay: "rgba(0,0,0,0.5)",
};

// Dark theme colors
const darkColors: ThemeColors = {
  primary: "#0A84FF",
  primaryLight: "#409CFF",
  primaryDark: "#0066CC",
  secondary: "#5E5CE6",
  background: "#000000",
  text: "#FFFFFF",
  textSecondary: "#999999",
  border: "#333333",
  error: "#FF453A",
  success: "#30D158",
  warning: "#FF9F0A",
  info: "#3498DB",
  card: "#1C1C1E",
  cardShadow: "rgba(0,0,0,0.3)",
  surface: "#2C2C2E",
  overlay: "rgba(0,0,0,0.7)",
};

// Spacing constants
const spacing: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
};

// Typography constants
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

// Shadow constants
const getShadows = (isDark: boolean): ThemeShadows => ({
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: isDark ? "#000" : "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: isDark ? "#000" : "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.4 : 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: isDark ? "#000" : "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.5 : 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: isDark ? "#000" : "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.6 : 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
});

// Border radius constants
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

export function useTailwind() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const theme = useMemo((): Theme => {
    const colors = isDark ? darkColors : lightColors;
    const shadows = getShadows(isDark);

    return {
      colors,
      spacing,
      typography,
      shadows,
      isDark,
      borderRadius,
    };
  }, [isDark]);

  // Destructure theme for use in helper functions
  const { colors, shadows } = theme;

  // Helper function to get color with opacity
  const getColorWithOpacity = (color: string, opacity: number): string => {
    // For hex colors
    if (color.startsWith("#")) {
      const hex = color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // For named colors or rgb/rgba
    return color;
  };

  // Helper function to get spacing value
  const getSpacing = (size: keyof ThemeSpacing): number => {
    return spacing[size] || spacing.md;
  };

  // Helper function to get font size
  const getFontSize = (size: keyof ThemeTypography["fontSize"]): number => {
    return typography.fontSize[size] || typography.fontSize.md;
  };

  // Helper function to get border radius
  const getBorderRadius = (size: keyof typeof borderRadius): number => {
    return borderRadius[size] || borderRadius.md;
  };

  // Helper to create shadow style
  const getShadow = (size: keyof ThemeShadows) => {
    return shadows[size] || shadows.md;
  };

  // Helper to create card style
  const getCardStyle = (elevated: boolean = false) => {
    return {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      ...(elevated ? shadows.md : shadows.sm),
    };
  };

  // Helper to create button style
  const getButtonStyle = (variant: "primary" | "secondary" | "outline" | "ghost" = "primary") => {
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

  // Helper to create input style
  const getInputStyle = (error: boolean = false) => {
    return {
      backgroundColor: colors.surface,
      borderColor: error ? colors.error : colors.border,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
      fontSize: typography.fontSize.md,
    };
  };

  // Helper to create badge style
  const getBadgeStyle = (type: "primary" | "success" | "error" | "warning" | "info" = "primary") => {
    const colorMap = {
      primary: colors.primary,
      success: colors.success,
      error: colors.error,
      warning: colors.warning,
      info: colors.info,
    };

    const bgColor = colorMap[type];
    return {
      backgroundColor: bgColor + "20", // 20% opacity
      borderColor: bgColor,
      borderWidth: 1,
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    };
  };

  // Helper to create responsive styles
  const getResponsive = (base: any, sm?: any, md?: any, lg?: any) => {
    // For mobile, just return base styles
    // This can be expanded for tablet/desktop support
    return {
      ...base,
      ...(sm && { ...sm }),
      ...(md && { ...md }),
      ...(lg && { ...lg }),
    };
  };

  return {
    // Theme object
    theme,
    colors: theme.colors,
    spacing: theme.spacing,
    typography: theme.typography,
    shadows: theme.shadows,
    isDark: theme.isDark,
    borderRadius: theme.borderRadius,

    // Helper functions
    getColorWithOpacity,
    getSpacing,
    getFontSize,
    getBorderRadius,
    getShadow,
    getCardStyle,
    getButtonStyle,
    getInputStyle,
    getBadgeStyle,
    getResponsive,

    // Direct access to commonly used values
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

    // Spacing shortcuts
    spacingXS: spacing.xs,
    spacingSM: spacing.sm,
    spacingMD: spacing.md,
    spacingLG: spacing.lg,
    spacingXL: spacing.xl,
    spacing2XL: spacing["2xl"],
    spacing3XL: spacing["3xl"],
  };
}

export type { Theme, ThemeColors, ThemeSpacing, ThemeTypography, ThemeShadows };
