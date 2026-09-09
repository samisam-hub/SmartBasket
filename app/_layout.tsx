import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { colors } from "@/lib/theme";
import {AuthProvider,useAuth} from '@/context/AuthContext';
import {ProfileProvider} from '@/context/ProfileContext';
import {useRef} from 'react';
import { View } from 'react-native';
import { ScreenNavigation } from '@/components/ScreenNavigation';
import { ActiveBasketProvider } from '@/context/ActiveBasketContext';
import { ActiveBasketShortcut } from '@/components/ActiveBasketShortcut';
export default function RootLayout() {
 return <AuthProvider><AuthenticatedLayout /></AuthProvider>;
}
function AuthenticatedLayout(){
 const {session,ready}=useAuth();
 // Keep the navigator mounted while the initial session restores so deep links survive.
 // Only an actual account switch resets screens that may contain another owner's data.
 const identity=useRef<{owner:string|null;generation:number}>({owner:null,generation:0});
 const owner=session?.user.id??'local';
 if(identity.current.owner&&identity.current.owner!==owner){identity.current.generation++;identity.current.owner=owner;}
 else if(ready)identity.current.owner=owner;
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PreferencesProvider><ProfileProvider><ActiveBasketProvider key={identity.current.generation}>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
        <Stack
          key={identity.current.generation}
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
          <Stack.Screen name="pantry" options={{ title: "Pantry & purchases" }} />
          <Stack.Screen name="account" options={{ title: "Account" }} />
          <Stack.Screen name="auth/callback" options={{ title: "Verify account" }} />
          <Stack.Screen name="personal-profile" options={{ title: "Personal profile" }} />
          <Stack.Screen name="plan-setup" options={{ title: "Plan participants" }} />
          <Stack.Screen name="saved-meal-plans" options={{ title: "Saved meal plans" }} />
        </Stack>
        <ActiveBasketShortcut />
        <ScreenNavigation />
        </View>
      </ActiveBasketProvider></ProfileProvider></PreferencesProvider>
    </SafeAreaProvider>
  );
}
