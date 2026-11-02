import { germanLabel, formatNumber } from '../lib/german';
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Chips, SectionCard } from "@/components/ui";
import { ProductImage } from "@/components/ProductImage";
import { ProductEstimateNotice } from './ProductEstimateNotice';
import { imageSuitable } from "@/services/catalog/images";
import { colors, spacing, ui } from "@/lib/theme";
import { categoryLabels, type Product } from "@/types/product";
import type { UserPreferences } from "@/types/preferences";
import { allergenConflicts, dietaryFields, dietaryNames, estimatedPrice, matchesPreferences } from "@/services/catalog/discovery";
export function ProductCard({ product, preferences, onPress }: { product: Product; preferences: UserPreferences | null; onPress: () => void }) {
  const risk = allergenConflicts(product, preferences);
  const thumbnail = !!product.imageThumbnailUrl && imageSuitable(product.imageThumbnailWidth,product.imageThumbnailHeight,false);
  const diet = dietaryFields.filter(f => product[f] === true && !(f === "vegetarian" && product.vegan)).map(f => dietaryNames[f]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ansehen ${product.name}`} onPress={onPress}
    style={({ pressed }) => pressed && { opacity: 0.8 }}>
    <SectionCard>
      <View style={ui.row}>
        <ProductImage uri={thumbnail ? product.imageThumbnailUrl : product.displayImageUrl} name={product.name}
          width={thumbnail ? product.imageThumbnailWidth : product.imageWidth}
          height={thumbnail ? product.imageThumbnailHeight : product.imageHeight} />
        <View style={styles.details}>
          <Text style={ui.caption}>{product.brand ?? "Marke nicht angegeben"} · {categoryLabels[product.category]}</Text>
          <Text style={ui.subheading} numberOfLines={3}>{product.name}</Text>
          {product.quantityLabel && <Text style={ui.small}>{product.quantityLabel}</Text>}
          <Text style={[ui.small, { color: colors.primary }]}>{estimatedPrice(product)}</Text>
          {product.priceEstimateVersion==='synthetic-category-demo-2'&&<Text style={ui.caption}>Demo-Preis der Kategorie · Menge unbestätigt</Text>}
        </View>
      </View>
      <Text style={ui.small}>{product.caloriesPer100g === null ? "—" : formatNumber(product.caloriesPer100g, 1)} kcal · {product.proteinPer100g === null ? "—" : formatNumber(product.proteinPer100g, 1)}  g Eiweiß / {product.nutritionBasis === "100ml" ? "100 ml" : "100 g"}</Text>
      {!!diet.length && <Chips labels={diet.slice(0, 3)} />}
      <ProductEstimateNotice product={product} />
      {!!risk.contains.length && <Text style={styles.warning}>Allergenhinweis: enthält {risk.contains.map(germanLabel).join(", ").replace(/_/g, " ")}</Text>}
      {!!risk.traces.length && <Text style={styles.warning}>Allergenhinweis: kann enthalten {risk.traces.map(germanLabel).join(", ").replace(/_/g, " ")}</Text>}
      {matchesPreferences(product, preferences) && <Text style={[ui.caption, { color: colors.successText }]}>Passt zu deinen Einstellungen · Verpackung prüfen</Text>}
      {product.source === "demo" && <Text style={ui.caption}>Fiktives Demo-Produkt</Text>}
    </SectionCard>
  </Pressable>;
}
const styles = StyleSheet.create({ details: { flex: 1, gap: spacing.xs }, warning: { ...ui.small, color: colors.errorText } });
