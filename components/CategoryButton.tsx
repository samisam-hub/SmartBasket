import { Image, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { categories, categoryLabels, type ProductCategory } from '../types/product';
import { colors, ui } from '../lib/theme';

const photos = require('../assets/categories/grocery-categories.png');
const photoSize = 68;
// One bundled 4×4 photo sheet; row-major order matches the catalog categories.
export function CategoryButton({ category, selected, onPress, label }: { category: ProductCategory | 'all'; selected: boolean; onPress: () => void; label?: string }) {
  const index = category === 'all' ? 0 : categories.indexOf(category);
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? (category === 'all' ? 'All products' : categoryLabels[category])}
    accessibilityState={{ selected }} onPress={onPress}
    style={({ pressed }) => ({ width: 104, minHeight: 114, borderRadius: 16, borderWidth: 1,
      borderColor: selected ? colors.primary : colors.border, backgroundColor: selected && category !== 'all' ? colors.primary : colors.surface,
      alignItems: 'center', justifyContent: 'center', padding: 8, gap: 8, opacity: pressed ? .75 : 1 })}>
    <View accessible={false} style={{ width: photoSize, height: photoSize, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: category === 'all' ? colors.surface : colors.background }}>
      {category === 'all' && <Feather name="shopping-cart" size={34} color={colors.primary} />}
      {category !== 'all' && <Image source={photos} accessible={false} resizeMode="stretch" style={
        { position: 'absolute', width: photoSize * 4, height: photoSize * 4, left: -(index % 4) * photoSize, top: -Math.floor(index / 4) * photoSize }} />
      }
    </View>
    <Text style={[ui.caption, { color: selected && category !== 'all' ? colors.onPrimary : colors.primary, textAlign: 'center', fontWeight: '600' }]}>{label ?? (category === 'all' ? 'All' : categoryLabels[category])}</Text>
  </Pressable>;
}
