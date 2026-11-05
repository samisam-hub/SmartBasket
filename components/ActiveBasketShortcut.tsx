import { formatMoney, t } from '../services/i18n';
import { basketDisplayName } from '../services/basket/naming';
import Feather from '@expo/vector-icons/Feather';
import { router, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, Text } from 'react-native';
import { useActiveBasket } from '../context/ActiveBasketContext';
import { basketRoute, useMerchantDemo } from '../services/merchant-demo';
import { fromDemoCatalogue, listEstimate, shoppingLines } from '../services/shopping-list';
import { colors, ui } from '../lib/theme';
export function ActiveBasketShortcut() {
  const { active } = useActiveBasket();
  const { demo } = useMerchantDemo();
  const insets = useSafeAreaInsets(), segments = useSegments();
  if (!active || (!demo && fromDemoCatalogue(active))) return null;
  const lines = shoppingLines(active.result), priced = listEstimate(lines);
  const total = lines.length ? priced.total : null;
  return <Pressable accessibilityRole="button" accessibilityLabel={t('shortcut.openBasket', { basket: basketDisplayName(active) })}
    onPress={() => router.push(basketRoute(active.id))}
    style={{ minHeight: 48, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 + (segments[0] === '(tabs)' ? insets.bottom : 0), flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.primary }}>
    <Feather name="shopping-cart" size={23} color={colors.onPrimary} />
    <Text numberOfLines={1} style={[ui.small, { flex: 1, color: colors.onPrimary, fontWeight: '700' }]}>{basketDisplayName(active)}</Text>
    <Text style={[ui.small, { color: colors.onPrimary }]}>{total === null ? '—' : `${formatMoney(total)}`}</Text>
  </Pressable>;
}
