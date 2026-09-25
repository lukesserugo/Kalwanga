// packages/mobile/app/_layout.tsx
import "../polyfills";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/clerk-expo";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { SocketProvider } from "../contexts/SocketContext";
import { AuthProvider } from "../contexts/AuthContext";
import { apiService } from "../services/api";

// ============================================================
// TOKEN CACHE
// ============================================================
//
// expo-secure-store is native-only. On web it exists as a stub
// whose methods throw when called. Clerk manages web sessions
// via localStorage on its own, so `tokenCache` is only needed
// on native.

const tokenCache =
  Platform.OS === "web"
    ? undefined
    : {
        async getToken(key: string) {
          try {
            return await SecureStore.getItemAsync(key);
          } catch {
            return null;
          }
        },
        async saveToken(key: string, value: string) {
          try {
            await SecureStore.setItemAsync(key, value);
          } catch {
            // no-op
          }
        },
      };

// ============================================================
// API TOKEN BRIDGE
// ============================================================
//
// Hand Clerk's `getToken` to the API service, which uses it to
// sign every axios request with a fresh bearer token.
//
// Runs inside ClerkProvider + ClerkLoaded, so useAuth() is
// always populated here. On sign-out we clear the provider so
// requests don't try to fetch a token for an anonymous session.

function ApiTokenBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      apiService.setTokenProvider(null);
      return;
    }

    apiService.setTokenProvider(() => getToken());
    return () => apiService.setTokenProvider(null);
  }, [getToken, isSignedIn]);

  return null;
}

// ============================================================
// NAVIGATION SHELL
// ============================================================

function AppShell() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#fff" },
          headerTitleStyle: { fontWeight: "600" },
          headerTintColor: "#000",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="(modals)"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

// ============================================================
// KEY RESOLUTION
// ============================================================
//
// Both channels are checked *inside* the component, not at module
// scope. Expo 50's web bootstrap loads route modules (including
// this one) before it finishes populating `Constants.expoConfig`,
// so a top-level read sees `undefined`. A read from inside the
// React render sees the populated value.

function resolvePublishableKey(): string {
  const fromExtra = Constants.expoConfig?.extra?.[
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"
  ] as string | undefined;

  const fromProcess = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const candidate = fromExtra ?? fromProcess;

  if (!candidate || candidate === "undefined" || !candidate.startsWith("pk_")) {
    throw new Error(
      "[clerk] Publishable key not found.\n" +
        `  Constants.expoConfig.extra: ${JSON.stringify(fromExtra)}\n` +
        `  process.env: ${JSON.stringify(fromProcess)}\n` +
        "  Verify D:\\Projects\\Kalwanga\\.env contains:\n" +
        "    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...\n" +
        "  Then restart: npx expo start --web --clear"
    );
  }

  return candidate;
}

// ============================================================
// ROOT LAYOUT
// ============================================================

export default function RootLayout() {
  const publishableKey = resolvePublishableKey();

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <ApiTokenBridge />
        <ThemeProvider>
          <SafeAreaProvider>
            <ToastProvider>
              <AuthProvider>
                <SocketProvider>
                  <AppShell />
                </SocketProvider>
              </AuthProvider>
            </ToastProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
