import { t } from '../services/i18n';
import Feather from '@expo/vector-icons/Feather';
import { router, usePathname, useSegments } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../lib/theme';
import { useMerchantDemo } from '../services/merchant-demo';

/** Read per render, not once at import: a label fixed at startup would keep the locale the app
 *  began with and ignore a switch. */
const destinations = (demo: boolean) => [
  { label: t('nav.home'), path: '/' as const, icon: 'home' as const },
  { label: t('nav.basket'), path: '/basket' as const, icon: 'shopping-bag' as const },
  // The fictional catalogue is a merchant demo; the tab bar hides it too when it is off.
  ...(demo ? [{ label: t('nav.products'), path: '/products' as const, icon: 'grid' as const }] : []),
  { label: t('tab.profile'), path: '/profile' as const, icon: 'user' as const },
];
/** Setting up is a path of its own: a bar that offers tabs nobody can use yet only invites
 *  leaving it half-finished. */
const settingUp = (path: string) =>
  ['/welcome', '/intro', '/try', '/account', '/auth/callback'].includes(path) ||
  path.startsWith('/household-setup') || path.startsWith('/onboarding');

/** Stack screens share the same destinations as the existing tab navigator. */
export function ScreenNavigation() {
  const { demo } = useMerchantDemo();
  const segments = useSegments();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  if (segments[0] === '(tabs)' || settingUp(path)) return null;
  // Pantry belongs to the shopping flow; onboarding is reached from several tabs, so none is highlighted.
  const selected = path.startsWith('/product/') ? '/products' :
    ['/basket-setup', '/plan-setup', '/voice-plan', '/saved-meal-plans', '/pantry'].includes(path) ? '/basket' :
    path.startsWith('/onboarding') ? null : '/profile';
  return <View style={{ flexDirection: 'row', backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom,
    paddingLeft: insets.left, paddingRight: insets.right }}>
    {destinations(demo).map(destination => {
      const color = selected === destination.path ? colors.primary : colors.muted;
      return <Pressable key={destination.path} accessibilityRole="tab"
        accessibilityLabel={destination.label} accessibilityState={{ selected: selected === destination.path }}
        onPress={() => router.navigate(destination.path)}
        style={{ flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <Feather name={destination.icon} color={color} size={24} />
        <Text style={{ ...typography.caption, fontWeight: '600', color }}>{destination.label}</Text>
      </Pressable>;
    })}
  </View>;
}
