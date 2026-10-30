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
import {WeekPlanProvider} from '@/context/WeekPlanContext';
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
      <PreferencesProvider><ProfileProvider><WeekPlanProvider><ActiveBasketProvider key={identity.current.generation}>
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
            options={{ title: "Warenkorb erstellen" }}
          />
          <Stack.Screen name="product/[id]" options={{ title: "Produktdetails" }} />
          {/* Bringen ihre eigene Kopfzeile mit, wie der Entwurf es verlangt. */}
          <Stack.Screen name="household" options={{ headerShown: false }} />
          <Stack.Screen name="try" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="intro" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="household-setup" options={{ headerShown: false }} />
          <Stack.Screen name="household-setup/person" options={{ headerShown: false }} />
          <Stack.Screen name="saved-lists" options={{ title: "Alle meine Listen" }} />
          <Stack.Screen name="pantry" options={{ title: "Vorräte und Einkäufe" }} />
          <Stack.Screen name="account" options={{ title: "Konto" }} />
          <Stack.Screen name="auth/callback" options={{ title: "Konto bestätigen" }} />
          <Stack.Screen name="personal-profile" options={{ title: "Persönliches Profil" }} />
          <Stack.Screen name="plan-setup" options={{ title: "Personen im Plan" }} />
          <Stack.Screen name="plan/taste" options={{ title: "Was mögt ihr?" }} />
          <Stack.Screen name="plan/overview" options={{ title: "Dein Wochenplan" }} />
          <Stack.Screen name="plan/week" options={{ title: "Deine Woche" }} />
          <Stack.Screen name="plan/[date]" options={{ title: "Dein Tag" }} />
          <Stack.Screen name="plan/[date]/[slot]" options={{ title: "Gericht auswählen" }} />
          <Stack.Screen name="plan/day-done" options={{ title: "Tag geplant" }} />
          <Stack.Screen name="voice-plan" options={{ title: "Per Sprache planen" }} />
          <Stack.Screen name="saved-meal-plans" options={{ title: "Gespeicherte Speisepläne" }} />
        </Stack>
        <ActiveBasketShortcut />
        <ScreenNavigation />
        </View>
      </ActiveBasketProvider></WeekPlanProvider></ProfileProvider></PreferencesProvider>
    </SafeAreaProvider>
  );
}
