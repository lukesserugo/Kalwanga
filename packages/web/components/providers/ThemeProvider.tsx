'use client';

import { useEffect, useState } from 'react';
import { useThemeStore } from '../stores/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDark, mounted]);

  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
