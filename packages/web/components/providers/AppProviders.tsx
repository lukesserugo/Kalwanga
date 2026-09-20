'use client';

import { useEffect } from 'react';
import { toast, ToastContainer } from '../../utils/toast-manager';
import { ThemeProvider } from './ThemeProvider';
import { SidebarProvider } from './SidebarProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    toast.setDefaultDuration(5000);
    toast.setMaxToasts(5);
    // toast.setDefaultPosition('top-right');
  }, []);

  return (
    <ThemeProvider>
      <SidebarProvider>
        {children}
        <ToastContainer position="top-right" />
      </SidebarProvider>
    </ThemeProvider>
  );
}
