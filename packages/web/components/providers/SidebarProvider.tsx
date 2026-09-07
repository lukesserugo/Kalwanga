'use client';

import { useEffect } from 'react';
import { useSidebarStore } from '../stores/sidebarStore';

interface SidebarProviderProps {
  children: React.ReactNode;
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const { 
    isCollapsed, 
    isMobileOpen, 
    setCollapsed, 
    setMobileOpen, 
    toggleMobile,
    toggleCollapse 
  } = useSidebarStore();

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem('sidebarCollapsed');
      if (savedCollapsed !== null) {
        setCollapsed(savedCollapsed === 'true');
      }

      // On desktop, sidebar is always visible (not mobile)
      const isDesktop = window.innerWidth >= 1024;
      if (isDesktop) {
        // On desktop, ensure sidebar is not in mobile mode
        setMobileOpen(false);
      } else {
        // On mobile, sidebar starts closed
        setMobileOpen(false);
      }
    } catch (error) {
      console.error('Failed to load sidebar state:', error);
    }
  }, [setCollapsed, setMobileOpen]);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      const state = useSidebarStore.getState();
      
      if (isDesktop && state.isMobileOpen) {
        // If on desktop and mobile menu is open, close it
        state.setMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle escape key to close sidebar on mobile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = useSidebarStore.getState();
        // Only close if mobile menu is open
        if (state.isMobileOpen) {
          state.setMobileOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    const state = useSidebarStore.getState();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    
    if (isMobile && state.isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  return <>{children}</>;
}
