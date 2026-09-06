import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { colors } from "@/lib/theme";
export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PreferencesProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.ink,
            contentStyle: { backgroundColor: colors.background },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding/[step]"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="basket-setup"
            options={{ title: "Create my basket" }}
          />
          <Stack.Screen name="product/[id]" options={{ title: "Product details" }} />
        </Stack>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
