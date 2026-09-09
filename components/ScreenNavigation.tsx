import Feather from '@expo/vector-icons/Feather';
import { router, usePathname, useSegments } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../lib/theme';

const destinations = [
  { label: 'Home', path: '/', icon: 'home' },
  { label: 'Basket', path: '/basket', icon: 'shopping-bag' },
  { label: 'Products', path: '/products', icon: 'grid' },
  { label: 'Profile', path: '/profile', icon: 'user' },
] as const;

/** Stack screens share the same destinations as the existing tab navigator. */
export function ScreenNavigation() {
  const segments = useSegments();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  if (segments[0] === '(tabs)') return null;
  const selected = path.startsWith('/product/') ? '/products' :
    ['/basket-setup', '/plan-setup', '/saved-meal-plans'].includes(path) ? '/basket' : '/profile';
  return <View style={{ flexDirection: 'row', backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom,
    paddingLeft: insets.left, paddingRight: insets.right }}>
    {destinations.map(destination => {
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
