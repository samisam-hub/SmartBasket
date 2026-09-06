import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { CatalogAttribution } from "@/components/CatalogAttribution";
import { EmptyState, ErrorMessage, ScreenHeader, SearchInput, SelectionChip, TextButton } from "@/components/ui";
import { useProducts } from "@/hooks/useProducts";
import { categories, categoryLabels, emptyFilters } from "@/types/product";
import { dietaryFields, dietaryNames, hasDiscoveryPreferences } from "@/services/catalog/discovery";
import { colors, spacing, ui } from "@/lib/theme";
export default function ProductsScreen() {
  const catalog = useProducts();
  const [showFilters, setShowFilters] = useState(false);
  const { filters, setFilters } = catalog;
  const clear = () => { catalog.setQuery(""); setFilters(emptyFilters); };
  return <SafeAreaView style={ui.page} edges={["top", "left", "right"]}>
    <FlatList
      data={catalog.products} keyExtractor={item => item.id}
      renderItem={({ item }) => <ProductCard product={item} preferences={catalog.saved}
        onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })} />}
      initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      ListHeaderComponent={<View style={{ gap: spacing.lg, paddingVertical: spacing.xl }}>
        <ScreenHeader eyebrow="FUEL YOUR EVERYDAY" title="Products" subtitle="Discover groceries for your goals." />
        <SearchInput value={catalog.query} onChangeText={catalog.setQuery} />
        <TextButton label={`${showFilters ? "Hide" : "Show"} filters${Object.values(filters).some(Boolean) ? " · Active" : ""}`} onPress={() => setShowFilters(v => !v)} />
        {showFilters && <>
          <Text style={ui.subheading}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
            <SelectionChip label="All" selected={!filters.category} onPress={() => setFilters(f => ({ ...f, category: null }))} />
            {categories.map(category => <SelectionChip key={category} label={categoryLabels[category]} selected={filters.category === category}
              onPress={() => setFilters(f => ({ ...f, category: f.category === category ? null : category }))} />)}
          </ScrollView>
          <View style={ui.wrap}>
            <SelectionChip label="High protein" selected={filters.highProtein} onPress={() => setFilters(f => ({ ...f, highProtein: !f.highProtein }))} />
            {dietaryFields.map(field => <SelectionChip key={field} label={dietaryNames[field]} selected={filters[field]}
              onPress={() => setFilters(f => ({ ...f, [field]: !f[field] }))} />)}
            <SelectionChip label="Matches your preferences" selected={filters.matchesPreferences} disabled={!hasDiscoveryPreferences(catalog.saved)}
              onPress={() => setFilters(f => ({ ...f, matchesPreferences: !f.matchesPreferences }))} />
          </View>
          <Text style={ui.caption}>High protein: at least 20% of listed energy from protein. Dietary filters require positive source evidence.</Text>
          <TextButton label="Clear search & filters" onPress={clear} />
        </>}
        {filters.matchesPreferences && <Text style={ui.small}>Matching uses your saved diet and excludes listed allergens and traces. Unknown dietary information does not match. Missing allergen information is excluded when you have selected allergies. Always check the package label.</Text>}
        {catalog.warning && <View><Text style={ui.small}>{catalog.warning}</Text><TextButton label="Retry live catalog" onPress={catalog.retry} /></View>}
        <Text style={ui.caption} accessibilityLiveRegion="polite">{catalog.loading ? "Searching catalog…" : `${catalog.products.length} products loaded${catalog.mode === "demo" ? " · Demo fallback" : ""}`}</Text>
      </View>}
      ListEmptyComponent={catalog.loading ? <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading products" /> :
        <EmptyState icon="search" title="No matching products" description="Try another name, brand, or fewer filters."><TextButton label="Clear search & filters" onPress={clear} /></EmptyState>}
      ListFooterComponent={<View style={{ gap: spacing.md, paddingTop: spacing.lg }}>
        <ErrorMessage message={catalog.error} />
        {catalog.error && <TextButton label="Retry" onPress={catalog.products.length ? catalog.loadMore : catalog.retry} />}
        {catalog.loadingMore ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading more products" /> :
          catalog.hasMore && <TextButton label="Load more products" onPress={catalog.loadMore} />}
        <CatalogAttribution sources={catalog.products.map(p => p.source)} />
      </View>}
    />
  </SafeAreaView>;
}
