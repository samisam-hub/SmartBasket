import {StateIllustration,failureIllustration} from '@/components/BrandAssets';
import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { AddProductButton } from '@/components/AddProductButton';
import { CategoryButton } from '@/components/CategoryButton';
import { CatalogAttribution } from "@/components/CatalogAttribution";
import { EmptyState, ErrorMessage, ScreenHeader, SearchInput, SelectionChip, TextButton } from "@/components/ui";
import { useProducts } from "@/hooks/useProducts";
import { categories, emptyFilters } from "@/types/product";
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
      renderItem={({ item }) => <View style={{ gap: 8 }}><ProductCard product={item} preferences={catalog.saved}
        onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })} /><AddProductButton product={item} /></View>}
      initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      ListHeaderComponent={<View style={{ gap: spacing.lg, paddingVertical: spacing.xl }}>
        <ScreenHeader eyebrow="FÜR DEINEN ALLTAG" title="Produkte" subtitle="Entdecke Lebensmittel, die zu dir passen." />
        <SearchInput value={catalog.query} onChangeText={catalog.setQuery} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Produktkategorien" contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }} keyboardShouldPersistTaps="handled">
            <CategoryButton category="all" selected={!filters.category} onPress={() => setFilters(f => ({ ...f, category: null }))} />
            <CategoryButton category="fruit" label="Obst und Gemüse" selected={filters.category === 'fruit-vegetables'} onPress={() => setFilters(f => ({ ...f, category: 'fruit-vegetables' }))} />
            <CategoryButton category="meat" label="Fleisch und Fisch" selected={filters.category === 'meat-fish'} onPress={() => setFilters(f => ({ ...f, category: 'meat-fish' }))} />
            <CategoryButton category="dairy" label="Milchprodukte und Alternativen" selected={filters.category === 'dairy-alternatives-group'} onPress={() => setFilters(f => ({ ...f, category: 'dairy-alternatives-group' }))} />
            <CategoryButton category="grains" label="Vorräte" selected={filters.category === 'pantry'} onPress={() => setFilters(f => ({ ...f, category: 'pantry' }))} />
            {categories.filter(category => !['fruit', 'vegetables', 'meat', 'fish', 'dairy', 'dairy-alternatives', 'grains', 'pasta', 'potatoes', 'legumes'].includes(category)).map(category => <CategoryButton key={category} category={category} selected={filters.category === category}
              onPress={() => setFilters(f => ({ ...f, category }))} />)}
          </ScrollView>
        <TextButton label={`${showFilters ? "Ausblenden" : "Anzeigen"} Filter${Object.entries(filters).some(([key,value]) => key !== 'category' && Boolean(value)) ? " · Aktiv" : ""}`} onPress={() => setShowFilters(v => !v)} />
        {showFilters && <>
          <View style={ui.wrap}>
            <SelectionChip label="Eiweißreich" selected={filters.highProtein} onPress={() => setFilters(f => ({ ...f, highProtein: !f.highProtein }))} />
            {dietaryFields.map(field => <SelectionChip key={field} label={dietaryNames[field]} selected={filters[field]}
              onPress={() => setFilters(f => ({ ...f, [field]: !f[field] }))} />)}
            <SelectionChip label="Passt zu deinen Einstellungen" selected={filters.matchesPreferences} disabled={!hasDiscoveryPreferences(catalog.saved)}
              onPress={() => setFilters(f => ({ ...f, matchesPreferences: !f.matchesPreferences }))} />
          </View>
          <Text style={ui.caption}>Eiweißreich: Mindestens 20 % der angegebenen Energie stammen aus Eiweiß. Ernährungsfilter benötigen bestätigende Quellenangaben.</Text>
          <TextButton label="Suche und Filter zurücksetzen" onPress={clear} />
        </>}
        {filters.matchesPreferences && <Text style={ui.small}>Die Auswahl berücksichtigt deine Ernährungsweise und schließt aufgeführte Allergene und Spuren aus. Unbekannte Ernährungsangaben gelten nicht als passend. Bei ausgewählten Allergien werden Produkte ohne Allergenangaben ausgeschlossen. Prüfe immer die Verpackung.</Text>}
        {catalog.warning && <View><StateIllustration kind={catalog.failureKind??failureIllustration(catalog.warning)} size={120} /><Text style={ui.small}>{catalog.warning}</Text><TextButton label="Online-Katalog erneut laden" onPress={catalog.retry} /></View>}
        <Text style={ui.caption} accessibilityLiveRegion="polite">{catalog.loading ? "Katalog wird durchsucht …" : `${catalog.products.length} Produkte geladen${catalog.mode === "demo" ? " · Demo-Ersatzdaten" : ""}`}</Text>
      </View>}
      ListEmptyComponent={catalog.loading ? <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Produkte werden geladen" /> : catalog.error ? null :
        <EmptyState illustration="noSearchResults" icon="search" title="Keine passenden Produkte" description="Versuche einen anderen Namen, eine andere Marke oder weniger Filter."><TextButton label="Suche und Filter zurücksetzen" onPress={clear} /></EmptyState>}
      ListFooterComponent={<View style={{ gap: spacing.md, paddingTop: spacing.lg }}>
        {catalog.error&&<StateIllustration kind={catalog.failureKind??failureIllustration(catalog.error)} size={120} />}<ErrorMessage message={catalog.error} />
        {catalog.error && <TextButton label="Erneut versuchen" onPress={catalog.products.length ? catalog.loadMore : catalog.retry} />}
        {catalog.loadingMore ? <ActivityIndicator color={colors.primary} accessibilityLabel="Weitere Produkte werden geladen" /> :
          catalog.hasMore && <TextButton label="Weitere Produkte laden" onPress={catalog.loadMore} />}
        <CatalogAttribution sources={catalog.products.map(p => p.source)} />
      </View>}
    />
  </SafeAreaView>;
}
