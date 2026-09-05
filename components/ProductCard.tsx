import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/ui';
import { colors, ui } from '@/lib/theme';
import type { Product } from '@/types/product';

export function ProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const price = product.priceEstimate === null ? 'Price unavailable'
    : new Intl.NumberFormat('en-IE', { style: 'currency', currency: product.currency }).format(product.priceEstimate);
  return <View style={styles.card}>
    <View style={styles.top}>
      <View style={styles.image}>
        {product.imageUrl && !imageFailed
          ? <Image source={{ uri: product.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel={product.name} onError={() => setImageFailed(true)} />
          : <Text style={styles.emoji} accessibilityLabel={`${product.name} illustration`}>{product.imagePlaceholder}</Text>}
      </View>
      <View style={styles.details}>
        <Text style={styles.brand}>{product.brand} · {product.category}</Text>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.brand}>{product.packageLabel}</Text>
        <Text style={styles.price}>{price} <Text style={styles.estimate}>est.</Text></Text>
      </View>
    </View>
    <Text style={styles.nutrition}>{product.caloriesPer100g ?? '—'} kcal  ·  {product.proteinPer100g ?? '—'} g protein <Text style={styles.estimate}>/ 100 g</Text></Text>
    <Chips labels={product.labels} />
    {product.allergens.length > 0 && <Text style={styles.brand}>Contains: {product.allergens.join(', ')}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { ...ui.card, padding: 18, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  image: { width: 86, height: 100, borderRadius: 18, backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emoji: { fontSize: 49 },
  details: { flex: 1, gap: 4 },
  brand: { fontSize: 12, lineHeight: 18, color: colors.muted },
  name: { fontSize: 18, fontWeight: '700', color: colors.ink },
  price: { fontSize: 19, fontWeight: '700', color: colors.primary, marginTop: 4 },
  estimate: { fontSize: 12, fontWeight: '400', color: colors.muted },
  nutrition: { fontSize: 14, color: colors.ink, fontWeight: '500' },
});
