// packages/mobile/contexts/AuthContext.tsx
import React, { createContext, ReactNode, useEffect } from "react";
import { Platform } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useAuthStore } from "../stores/authStore";

// ============================================
// TYPES
// ============================================

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

// ============================================
// CONTEXT
// ============================================

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// SHARED: map Clerk user → AuthUser
// ============================================

function mapClerkUser(clerkUser: any): AuthUser | null {
  if (!clerkUser) return null;
  return {
    id: clerkUser.id,
    clerkId: clerkUser.id,
    email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
    firstName: clerkUser.firstName || "",
    lastName: clerkUser.lastName || "",
    role: (clerkUser.publicMetadata?.role as string) || "EMPLOYEE",
    isActive: true,
    createdAt: new Date(clerkUser.createdAt || Date.now()),
    updatedAt: new Date(),
  };
}

// ============================================
// NATIVE PROVIDER (Clerk available)
// ============================================
//
// Used on iOS and Android, where `_layout.tsx` mounts ClerkProvider
// and Clerk's hooks resolve to a real context.

function AuthProviderNative({ children }: { children: ReactNode }) {
  const { isSignedIn, signOut, getToken } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const { setUser, setAuthenticated, setLoading } = useAuthStore();

  useEffect(() => {
    setLoading(!isLoaded);

    if (isLoaded && clerkUser) {
      setUser(mapClerkUser(clerkUser));
      setAuthenticated(!!isSignedIn);
    } else if (isLoaded && !clerkUser) {
      setUser(null);
      setAuthenticated(false);
    }
  }, [isLoaded, clerkUser, isSignedIn, setUser, setAuthenticated, setLoading]);

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: isSignedIn || false,
        user: mapClerkUser(clerkUser),
        isLoading: !isLoaded,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================
// WEB PROVIDER (Clerk NOT available)
// ============================================
//
// `_layout.tsx` intentionally skips ClerkProvider on web to avoid
// the whatwg-url-without-unicode / TextDecoder crash. That means
// Clerk's hooks have no context to read from, so we provide a
// no-op implementation.
//
// Web is a preview-only environment; authentication happens on
// Android/iOS. This fallback reports "not signed in" and gives
// consumers a stable API.

function AuthProviderWeb({ children }: { children: ReactNode }) {
  const { setUser, setAuthenticated, setLoading } = useAuthStore();

  useEffect(() => {
    setUser(null);
    setAuthenticated(false);
    setLoading(false);
  }, [setUser, setAuthenticated, setLoading]);

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: false,
        user: null,
        isLoading: false,
        signOut: () => {
          // no-op on web
        },
        getToken: async () => null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================
// EXPORTED PROVIDER
// ============================================
//
// The choice between native/web happens ONCE at module load,
// not on every render. This keeps React's rules of hooks valid —
// each branch is its own component.

export const AuthProvider =
  Platform.OS === "web" ? AuthProviderWeb : AuthProviderNative;

export default AuthProvider;
