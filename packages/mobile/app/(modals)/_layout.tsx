import { Stack } from "expo-router";
import { useTheme } from "../../hooks/useTheme";

export default function ModalsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
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
        name="payment" 
        options={{ 
          title: "Payment",
          headerBackTitle: "Cancel",
        }} 
      />
      <Stack.Screen 
        name="customer" 
        options={{ 
          title: "Customer",
          headerBackTitle: "Cancel",
        }} 
      />
      <Stack.Screen 
        name="barcode-scanner" 
        options={{ 
          title: "Scan Barcode",
          headerBackTitle: "Cancel",
        }} 
      />
    </Stack>
  );
}
