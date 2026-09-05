import { Feather } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import { colors, ui } from '@/lib/theme';

export default function ProductsScreen() {
  const { query, setQuery, products } = useProducts();
  return <SafeAreaView style={ui.page} edges={['top', 'left', 'right']}>
    <View style={styles.header}>
      <Text style={ui.eyebrow}>A LITTLE INSPIRATION</Text>
      <Text style={ui.title}>Fresh finds</Text>
      <Text style={ui.body}>Everyday ingredients, endless possibilities.</Text>
      <View style={styles.search}>
        <Feather name="search" size={20} color={colors.muted} />
        <TextInput accessibilityLabel="Search products" placeholder="Search foods, brands, or labels" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.input} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}><Feather name="x" size={20} color={colors.muted} /></Pressable>}
      </View>
      <Text style={styles.caption}>{products.length} {products.length === 1 ? 'product' : 'products'} · Sample catalog · Estimated prices</Text>
    </View>
    <FlatList data={products} keyExtractor={(item) => item.id} renderItem={({ item }) => <ProductCard product={item} />}
      contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      ListEmptyComponent={<View style={ui.card}><Text style={ui.heading}>No matching products</Text><Text style={ui.body}>Try “oats”, “vegan”, or a different ingredient.</Text></View>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { padding: 24, paddingBottom: 16, gap: 10 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingLeft: 16, marginTop: 10, gap: 10 },
  input: { flex: 1, minHeight: 54, fontSize: 14, color: colors.ink, paddingVertical: 12 },
  clear: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
  list: { paddingHorizontal: 24, paddingBottom: 28 },
});
