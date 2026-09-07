'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  expandedMenus: string[];
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleMobile: () => void;
  setMobileOpen: (open: boolean) => void;
  toggleMenu: (menuId: string) => void;
  expandMenu: (menuId: string) => void;
  collapseMenu: (menuId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  isMenuExpanded: (menuId: string) => boolean;
  reset: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      isCollapsed: false,
      isMobileOpen: false,
      expandedMenus: ['dashboard', 'catalog', 'inventory', 'sales'],

      toggleCollapse: () => {
        set((state) => {
          const newCollapsed = !state.isCollapsed;
          // When collapsing, collapse all submenus
          if (newCollapsed) {
            return { isCollapsed: newCollapsed, expandedMenus: [] };
          }
          return { isCollapsed: newCollapsed };
        });
      },

      setCollapsed: (collapsed: boolean) => {
        set((state) => {
          if (collapsed) {
            return { isCollapsed: collapsed, expandedMenus: [] };
          }
          return { isCollapsed: collapsed };
        });
      },

      toggleMobile: () => {
        set((state) => ({ isMobileOpen: !state.isMobileOpen }));
      },

      setMobileOpen: (open: boolean) => {
        set({ isMobileOpen: open });
      },

      toggleMenu: (menuId: string) => {
        set((state) => {
          const isExpanded = state.expandedMenus.includes(menuId);
          return {
            expandedMenus: isExpanded
              ? state.expandedMenus.filter(id => id !== menuId)
              : [...state.expandedMenus, menuId],
          };
        });
      },

      expandMenu: (menuId: string) => {
        set((state) => ({
          expandedMenus: state.expandedMenus.includes(menuId)
            ? state.expandedMenus
            : [...state.expandedMenus, menuId],
        }));
      },

      collapseMenu: (menuId: string) => {
        set((state) => ({
          expandedMenus: state.expandedMenus.filter(id => id !== menuId),
        }));
      },

      expandAll: () => {
        const defaultMenus = ['dashboard', 'catalog', 'inventory', 'sales'];
        set({ expandedMenus: defaultMenus });
      },

      collapseAll: () => {
        set({ expandedMenus: [] });
      },

      isMenuExpanded: (menuId: string) => {
        return get().expandedMenus.includes(menuId);
      },

      reset: () => {
        set({
          isCollapsed: false,
          isMobileOpen: false,
          expandedMenus: ['dashboard', 'catalog', 'inventory', 'sales'],
        });
      },
    }),
    {
      name: 'sidebar-storage',
    }
  )
);
