import React, { createContext, ReactNode } from "react";
import { useThemeStore } from "../stores/themeStore";

interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  card: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const lightColors: ThemeColors = {
  primary: "#007AFF",
  secondary: "#5856D6",
  background: "#F2F2F7",
  text: "#000000",
  textSecondary: "#666666",
  border: "#E5E5E5",
  error: "#FF3B30",
  success: "#34C759",
  warning: "#FF9500",
  card: "#FFFFFF",
};

const darkColors: ThemeColors = {
  primary: "#0A84FF",
  secondary: "#5E5CE6",
  background: "#000000",
  text: "#FFFFFF",
  textSecondary: "#999999",
  border: "#333333",
  error: "#FF453A",
  success: "#30D158",
  warning: "#FF9F0A",
  card: "#1C1C1E",
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { isDark, toggleTheme } = useThemeStore();
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
