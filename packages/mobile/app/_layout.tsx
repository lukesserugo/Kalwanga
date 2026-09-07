// packages/mobile/app/_layout.tsx
import { Stack } from "expo-router";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { SocketProvider } from "../contexts/SocketContext";
import { AuthProvider } from "../contexts/AuthContext";
import Constants from "expo-constants";

// Import global styles
import "./global.css";

// Token cache for Clerk
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return await SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

// Get environment variables from Constants
const getEnvVar = (key: string): string => {
  try {
    const extra = (Constants as any).expoConfig?.extra || 
                  (Constants as any).manifest?.extra || 
                  (Constants as any).extra || {};
    return extra[key] || '';
  } catch (e) {
    return '';
  }
};

export default function RootLayout() {
  const clerkPublishableKey = getEnvVar('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY') || '';

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <ThemeProvider>
          <SafeAreaProvider>
            <StatusBar style="auto" />
            <ToastProvider>
              <AuthProvider>
                <SocketProvider>
                  <Stack
                    screenOptions={{
                      headerStyle: {
                        backgroundColor: '#fff',
                      },
                      headerTitleStyle: {
                        fontWeight: '600',
                      },
                      headerTintColor: '#000',
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(modals)" options={{ presentation: 'modal', headerShown: false }} />
                    <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
                  </Stack>
                </SocketProvider>
              </AuthProvider>
            </ToastProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
