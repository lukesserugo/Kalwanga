import React, { createContext, ReactNode, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useAuthStore } from "../stores/authStore";

// Define the user type that matches what we store
interface AuthUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthContextType {
  isSignedIn: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  signOut: () => void;
  getToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, signOut, getToken } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const { setUser, setAuthenticated, setLoading } = useAuthStore();

  useEffect(() => {
    setLoading(!isLoaded);
    
    if (isLoaded && clerkUser) {
      // Map Clerk user to our User type
      const mappedUser: AuthUser = {
        id: clerkUser.id,
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        role: (clerkUser.publicMetadata?.role as string) || 'EMPLOYEE',
        isActive: true,
        createdAt: new Date(clerkUser.createdAt || Date.now()),
        updatedAt: new Date(),
      };
      setUser(mappedUser);
      setAuthenticated(!!isSignedIn);
    } else if (isLoaded && !clerkUser) {
      setUser(null);
      setAuthenticated(false);
    }
  }, [isLoaded, clerkUser, isSignedIn, setUser, setAuthenticated, setLoading]);

  // Map Clerk user to our user type for the context value
  const getMappedUser = (): AuthUser | null => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      clerkId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      role: (clerkUser.publicMetadata?.role as string) || 'EMPLOYEE',
      isActive: true,
      createdAt: new Date(clerkUser.createdAt || Date.now()),
      updatedAt: new Date(),
    };
  };

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: isSignedIn || false,
        user: getMappedUser(),
        isLoading: !isLoaded,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
