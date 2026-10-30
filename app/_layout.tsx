import { Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initLocale, t } from "@/services/i18n";
import { useLocale } from "@/hooks/useLocale";
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
import {useEffect, useRef, useState} from 'react';
import { View } from 'react-native';
import { ScreenNavigation } from '@/components/ScreenNavigation';
import { ActiveBasketProvider } from '@/context/ActiveBasketContext';
import { ActiveBasketShortcut } from '@/components/ActiveBasketShortcut';
export default function RootLayout() {
 return <AuthProvider><AuthenticatedLayout /></AuthProvider>;
}
function AuthenticatedLayout(){
 const {session,ready}=useAuth();
 // The device's language, and the viewer's own choice over it. One storage read, before the first
 // screen, so nobody sees a German screen turn English under them.
 useLocale();
 const [localeReady,setLocaleReady]=useState(false);
 useEffect(()=>{void initLocale(AsyncStorage).finally(()=>setLocaleReady(true));},[]);
 // Keep the navigator mounted while the initial session restores so deep links survive.
 // Only an actual account switch resets screens that may contain another owner's data.
 const identity=useRef<{owner:string|null;generation:number}>({owner:null,generation:0});
 const owner=session?.user.id??'local';
 if(identity.current.owner&&identity.current.owner!==owner){identity.current.generation++;identity.current.owner=owner;}
 else if(ready)identity.current.owner=owner;
  if(!localeReady) return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <View style={{ flex: 1, backgroundColor: colors.background }} />
    </SafeAreaProvider>
  );
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
            options={{ title: t('route.basketSetup') }}
          />
          <Stack.Screen name="product/[id]" options={{ title: t('route.product') }} />
          {/* Bringen ihre eigene Kopfzeile mit, wie der Entwurf es verlangt. */}
          <Stack.Screen name="household" options={{ headerShown: false }} />
          <Stack.Screen name="try" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="intro" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="household-setup" options={{ headerShown: false }} />
          <Stack.Screen name="household-setup/person" options={{ headerShown: false }} />
          <Stack.Screen name="saved-lists" options={{ title: t('route.savedLists') }} />
          <Stack.Screen name="pantry" options={{ title: t('route.pantry') }} />
          <Stack.Screen name="account" options={{ title: t('route.account') }} />
          <Stack.Screen name="auth/callback" options={{ title: t('route.confirm') }} />
          <Stack.Screen name="personal-profile" options={{ title: t('route.personalProfile') }} />
          <Stack.Screen name="plan-setup" options={{ title: t('route.planPeople') }} />
          <Stack.Screen name="plan/taste" options={{ title: t('route.taste') }} />
          <Stack.Screen name="plan/overview" options={{ title: t('route.overview') }} />
          <Stack.Screen name="plan/week" options={{ title: t('route.week') }} />
          <Stack.Screen name="plan/[date]" options={{ title: t('route.day') }} />
          <Stack.Screen name="plan/[date]/[slot]" options={{ title: t('route.slot') }} />
          <Stack.Screen name="plan/day-done" options={{ title: t('route.dayDone') }} />
          <Stack.Screen name="voice-plan" options={{ title: t('route.voice') }} />
          <Stack.Screen name="saved-meal-plans" options={{ title: t('route.savedPlans') }} />
        </Stack>
        <ActiveBasketShortcut />
        <ScreenNavigation />
        </View>
      </ActiveBasketProvider></WeekPlanProvider></ProfileProvider></PreferencesProvider>
    </SafeAreaProvider>
  );
}
