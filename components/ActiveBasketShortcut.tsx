import Feather from '@expo/vector-icons/Feather';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, Text } from 'react-native';
import { useActiveBasket } from '../context/ActiveBasketContext';
import { colors, ui } from '../lib/theme';
export function ActiveBasketShortcut() {
  const { active } = useActiveBasket();
  const insets = useSafeAreaInsets(), segments = useSegments();
  if (!active) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open active basket: ${active.name}`}
    onPress={() => router.push({ pathname: '/basket-setup', params: { savedId: active.id } })}
    style={{ minHeight: 48, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 + (segments[0] === '(tabs)' ? insets.bottom : 0), flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.primary }}>
    <Feather name="shopping-cart" size={23} color={colors.onPrimary} />
    <Text numberOfLines={1} style={[ui.small, { flex: 1, color: colors.onPrimary, fontWeight: '700' }]}>{active.name}</Text>
    <Text style={[ui.small, { color: colors.onPrimary }]}>{active.result.estimatedTotalPrice === null ? '—' : `€${active.result.estimatedTotalPrice.toFixed(2)}`}</Text>
  </Pressable>;
}
