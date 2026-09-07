// providers/AuthProvider.tsx
'use client';

import React, { useState, useEffect, useContext, createContext, ReactNode, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { authService } from '../../services/authService';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId?: string;
  businessUnits: Array<{ businessUnitId: string; role: string }>;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (roles: string[]) => boolean;
  hasBusinessUnitAccess: (businessUnitId: string) => boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to map authService User to local User
const mapAuthUser = (authUser: any): User => {
  return {
    id: authUser.id || '',
    email: authUser.email || '',
    firstName: authUser.firstName || '',
    lastName: authUser.lastName || '',
    role: authUser.role || 'EMPLOYEE',
    companyId: authUser.companyId,
    businessUnits: authUser.businessUnits || [],
    isActive: authUser.isActive !== undefined ? authUser.isActive : true,
    createdAt: authUser.createdAt,
    updatedAt: authUser.updatedAt,
  };
};

export function AuthProvider({ children }: AuthProviderProps) {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);

      if (clerkLoaded && isSignedIn && clerkUser) {
        const token = localStorage.getItem('auth_token');
        
        if (token) {
          try {
            const userData = await authService.getCurrentUser();
            if (userData) {
              setUser(mapAuthUser(userData));
              setIsAuthenticated(true);
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('Failed to get user from backend:', error);
          }
        }

        // If no user found, create one with a random password
        try {
          const randomPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
          
          const userData = await authService.register({
            email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
            firstName: clerkUser.firstName || '',
            lastName: clerkUser.lastName || '',
            phoneNumber: clerkUser.phoneNumbers?.[0]?.phoneNumber || '',
            password: randomPassword,
          });
          setUser(mapAuthUser(userData));
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Failed to create user in backend:', error);
          setUser({
            id: clerkUser.id,
            email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
            firstName: clerkUser.firstName || '',
            lastName: clerkUser.lastName || '',
            role: 'EMPLOYEE',
            businessUnits: [],
            isActive: true,
          });
          setIsAuthenticated(true);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [clerkLoaded, isSignedIn, clerkUser]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const userData = await authService.getCurrentUser();
      if (userData) {
        setUser(mapAuthUser(userData));
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  // Login function
  const login = async (email: string, password: string, remember?: boolean) => {
    try {
      setLoading(true);
      const response = await authService.login({ email, password, remember });
      localStorage.setItem('auth_token', response.token);
      setUser(mapAuthUser(response.user));
      setIsAuthenticated(true);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      
      try {
        await signOut();
      } catch (error) {
        console.error('Clerk sign out error:', error);
      }
    }
  };

  // Register function
  const register = async (data: any) => {
    try {
      setLoading(true);
      const response = await authService.register(data);
      localStorage.setItem('auth_token', response.token);
      setUser(mapAuthUser(response.user));
      setIsAuthenticated(true);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Verify 2FA
  const verify2FA = async (code: string) => {
    try {
      const response = await authService.verify2FA(code);
      localStorage.setItem('auth_token', response.token);
      setUser(mapAuthUser(response.user));
      setIsAuthenticated(true);
    } catch (error) {
      throw error;
    }
  };

  // Check if user has permission
  const hasPermission = useCallback((roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  // Check if user has access to a business unit
  const hasBusinessUnitAccess = useCallback((businessUnitId: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return user.businessUnits.some(bu => bu.businessUnitId === businessUnitId);
  }, [user]);

  // Run auth check on mount and when Clerk state changes
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for auth token changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        if (e.newValue) {
          refreshUser();
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshUser]);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    register,
    verify2FA,
    refreshUser,
    hasPermission,
    hasBusinessUnitAccess,
  };

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}