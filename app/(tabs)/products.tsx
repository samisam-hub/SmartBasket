import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, ScreenHeader, SearchInput } from "@/components/ui";
import { useProducts } from "@/hooks/useProducts";
import { spacing, ui } from "@/lib/theme";
export default function ProductsScreen() {
  const { query, setQuery, products } = useProducts();
  return (
    <SafeAreaView style={ui.page} edges={["top", "left", "right"]}>
      <View style={ui.content}>
        <ScreenHeader
          eyebrow="FUEL YOUR EVERYDAY"
          title="Products"
          subtitle="Explore our sample grocery catalog."
        />
        <SearchInput value={query} onChangeText={setQuery} />
        <Text style={ui.caption}>
          {products.length} products · Sample catalog · Estimated prices
        </Text>
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard product={item} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xl,
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          <EmptyState
            icon="search"
            title="No matching products"
            description="Try oats, vegan, or a different ingredient."
          />
        }
      />
    </SafeAreaView>
  );
}
