import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Chips, SectionCard } from "@/components/ui";
import { colors, radii, spacing, ui } from "@/lib/theme";
import type { Product } from "@/types/product";
export function ProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const price =
    product.priceEstimate === null
      ? "Price unavailable"
      : new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: product.currency,
        }).format(product.priceEstimate);
  return (
    <SectionCard>
      <View style={ui.row}>
        <View style={styles.image}>
          {product.imageUrl && !imageFailed ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              accessibilityLabel={product.name}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Text
              style={styles.emoji}
              accessibilityLabel={`${product.name} illustration`}
            >
              {product.imagePlaceholder}
            </Text>
          )}
        </View>
        <View style={styles.details}>
          <Text style={ui.caption}>
            {product.brand} · {product.category}
          </Text>
          <Text style={ui.subheading}>{product.name}</Text>
          <Text style={ui.small}>{product.packageLabel}</Text>
          <Text style={[ui.subheading, { color: colors.primary }]}>
            {price} <Text style={ui.caption}>est.</Text>
          </Text>
        </View>
      </View>
      <Text style={ui.small}>
        {product.caloriesPer100g ?? "—"} kcal ·{" "}
        <Text style={{ color: colors.successText }}>
          {product.proteinPer100g ?? "—"} g protein
        </Text>{" "}
        / 100 g
      </Text>
      <Chips labels={product.labels} />
      {product.allergens.length > 0 && (
        <Text style={ui.caption}>Contains: {product.allergens.join(", ")}</Text>
      )}
    </SectionCard>
  );
}
const styles = StyleSheet.create({
  image: {
    width: 80,
    height: 96,
    borderRadius: radii.large,
    backgroundColor: colors.pale,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emoji: { fontSize: 48 },
  details: { flex: 1, gap: spacing.xs },
});
