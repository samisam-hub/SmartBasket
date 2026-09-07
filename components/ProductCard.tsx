import { Pressable, StyleSheet, Text, View } from "react-native";
import { Chips, SectionCard } from "@/components/ui";
import { ProductImage } from "@/components/ProductImage";
import { imageSuitable } from "@/services/catalog/images";
import { colors, spacing, ui } from "@/lib/theme";
import { categoryLabels, type Product } from "@/types/product";
import type { UserPreferences } from "@/types/preferences";
import { allergenConflicts, dietaryFields, dietaryNames, estimatedPrice, matchesPreferences } from "@/services/catalog/discovery";
export function ProductCard({ product, preferences, onPress }: { product: Product; preferences: UserPreferences | null; onPress: () => void }) {
  const risk = allergenConflicts(product, preferences);
  const thumbnail = !!product.imageThumbnailUrl && imageSuitable(product.imageThumbnailWidth,product.imageThumbnailHeight,false);
  const diet = dietaryFields.filter(f => product[f] === true && !(f === "vegetarian" && product.vegan)).map(f => dietaryNames[f]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${product.name}`} onPress={onPress}
    style={({ pressed }) => pressed && { opacity: 0.8 }}>
    <SectionCard>
      <View style={ui.row}>
        <ProductImage uri={thumbnail ? product.imageThumbnailUrl : product.displayImageUrl} name={product.name}
          width={thumbnail ? product.imageThumbnailWidth : product.imageWidth}
          height={thumbnail ? product.imageThumbnailHeight : product.imageHeight} />
        <View style={styles.details}>
          <Text style={ui.caption}>{product.brand ?? "Brand not provided"} · {categoryLabels[product.category]}</Text>
          <Text style={ui.subheading} numberOfLines={3}>{product.name}</Text>
          {product.quantityLabel && <Text style={ui.small}>{product.quantityLabel}</Text>}
          <Text style={[ui.small, { color: colors.primary }]}>{estimatedPrice(product)}</Text>
          {product.priceEstimateVersion==='synthetic-category-demo-2'&&<Text style={ui.caption}>Category demo price · quantity unverified</Text>}
        </View>
      </View>
      <Text style={ui.small}>{product.caloriesPer100g ?? "—"} kcal · {product.proteinPer100g ?? "—"} g protein / {product.nutritionBasis === "100ml" ? "100 ml" : "100 g"}</Text>
      {!!diet.length && <Chips labels={diet.slice(0, 3)} />}
      {!!risk.contains.length && <Text style={styles.warning}>Allergen warning: contains {risk.contains.join(", ").replace(/_/g, " ")}</Text>}
      {!!risk.traces.length && <Text style={styles.warning}>Allergen warning: may contain {risk.traces.join(", ").replace(/_/g, " ")}</Text>}
      {matchesPreferences(product, preferences) && <Text style={[ui.caption, { color: colors.successText }]}>Matches your preferences · check the label</Text>}
      {product.source === "demo" && <Text style={ui.caption}>Fictional demo product</Text>}
    </SectionCard>
  </Pressable>;
}
const styles = StyleSheet.create({ details: { flex: 1, gap: spacing.xs }, warning: { ...ui.small, color: colors.errorText } });
