import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { colors } from "@/lib/theme";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
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
        </Stack>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
