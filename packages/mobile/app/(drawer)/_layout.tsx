import { Stack } from "expo-router";
import { useTheme } from "../../hooks/useTheme";

export default function DrawerLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600',
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="reports" 
        options={{ 
          title: "Reports",
          headerBackTitle: "Back",
        }} 
      />
      <Stack.Screen 
        name="settings" 
        options={{ 
          title: "Settings",
          headerBackTitle: "Back",
        }} 
      />
      <Stack.Screen 
        name="profile" 
        options={{ 
          title: "Profile",
          headerBackTitle: "Back",
        }} 
      />
    </Stack>
  );
}
