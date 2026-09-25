// packages/mobile/app/(auth)/_layout.tsx
import { Stack } from "expo-router";

// ============================================================
// AUTH STACK
// ============================================================
//
// The root app/_layout.tsx wraps the whole app in <ClerkProvider>,
// so this file must NOT wrap in another one. Adding a second
// <ClerkProvider> here throws:
//   "You've added multiple <ClerkProvider> components"
//
// Screens inside this group can call useAuth()/useUser() directly;
// they read from the root provider.

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
