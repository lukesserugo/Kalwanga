// packages/mobile/contexts/UserContext.tsx
import { createContext, useContext, ReactNode } from "react";
import { useUser as useClerkUser } from "@clerk/clerk-expo";

type UserValue = ReturnType<typeof useClerkUser>;

const UserCtx = createContext<UserValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const value = useClerkUser();
  return <UserCtx.Provider value={value}>{children}</UserCtx.Provider>;
}

export function useUser() {
  const ctx = useContext(UserCtx);
  if (!ctx) {
    throw new Error("useUser must be used inside <UserProvider> (which must be inside <ClerkProvider>)");
  }
  return ctx;
}
