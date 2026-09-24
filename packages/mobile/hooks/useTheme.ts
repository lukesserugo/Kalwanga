import { colors, semanticColors } from '@pos/shared/tokens';

const lightColors = {
  primary: semanticColors.primary,              // #F97316 (brand orange)
  primaryLight: colors.brand[400],              // #FB923C
  primaryDark: colors.brand[600],               // #EA580C
  secondary: colors.secondary[500],             // #8B5CF6
  background: semanticColors.background,        // #FFFFFF
  text: semanticColors.text,                    // #111827
  textSecondary: semanticColors.textMuted,      // #6B7280
  border: semanticColors.border,                // #E5E7EB
  error: semanticColors.danger,                 // #EF4444
  success: semanticColors.success,              // #22C55E
  warning: semanticColors.warning,              // #F59E0B
  info: colors.primary[500],                    // #3B82F6
  card: semanticColors.surface,                 // #FFFFFF
  cardShadow: 'rgba(0,0,0,0.1)',
  surface: semanticColors.surfaceMuted,         // #F9FAFB
  overlay: 'rgba(0,0,0,0.5)',
};

const darkColors = {
  primary: colors.brand[400],                   // #FB923C (lighter on dark)
  primaryLight: colors.brand[300],              // #FDBA74
  primaryDark: colors.brand[500],               // #F97316
  secondary: colors.secondary[400],             // #A78BFA
  background: semanticColors.backgroundDark,    // #030712
  text: semanticColors.textDark,                // #F9FAFB
  textSecondary: semanticColors.textMutedDark,  // #9CA3AF
  border: semanticColors.borderDark,            // #1F2937
  error: colors.danger[400],                    // #F87171
  success: colors.success[400],                 // #4ADE80
  warning: colors.warning[400],                 // #FBBF24
  info: colors.primary[400],                    // #60A5FA
  card: semanticColors.surfaceDark,             // #111827
  cardShadow: 'rgba(0,0,0,0.3)',
  surface: semanticColors.surfaceMutedDark,     // #1F2937
  overlay: 'rgba(0,0,0,0.7)',
};
