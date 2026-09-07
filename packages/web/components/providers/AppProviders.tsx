// providers/AppProviders.tsx - Single provider wrapper
'use client';

import { ToastProvider } from '../../components/common/Toast';
import { ThemeProvider } from './ThemeProvider';
import { SidebarProvider } from './SidebarProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SidebarProvider>
          {children}
        </SidebarProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
