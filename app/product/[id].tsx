import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { CatalogAttribution, openCatalogLink } from "@/components/CatalogAttribution";
import { ProductImage } from "@/components/ProductImage";
import { EmptyState, ErrorMessage, InfoCard, PreferenceRow, Screen, SectionCard, TextButton } from "@/components/ui";
import { getProductRepository } from "@/services/products";
import { allergenConflicts, dietaryFields, dietaryNames, estimatedPrice, hasDiscoveryPreferences, matchesPreferences } from "@/services/catalog/discovery";
import { usePreferences } from "@/context/PreferencesContext";
import { categoryLabels, type Product } from "@/types/product";
import { colors, ui } from "@/lib/theme";
const displayList = (values: string[]) => values.join(", ").replace(/_/g, " ");
export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { saved } = usePreferences();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setProduct(null);
    void getProductRepository().get(id, controller.signal).then(p => {
      if (!controller.signal.aborted) setProduct(p);
    }).catch(() => {
      if (!controller.signal.aborted) setError("Product could not be loaded. Check your connection and retry.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  const risk = product ? allergenConflicts(product, saved) : null;
  return <Screen top={false} bottom>
    {loading ? <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading product details" /> : error ? <>
      <ErrorMessage message={error} /><TextButton label="Retry" onPress={() => setRevision(v => v + 1)} />
    </> : !product ? <EmptyState title="Product not found" description="This item may no longer be in the catalog. Go back to browse other products." /> : <>
      <ProductImage uri={product.imageUrl ?? product.imageThumbnailUrl} name={product.name} large />
      <View style={ui.stack}>
        <Text style={ui.caption}>{product.brand ?? "Brand not provided"} · {categoryLabels[product.category]}</Text>
        <Text style={ui.heading}>{product.name}</Text>
        <Text style={ui.body}>{product.quantityLabel ?? (product.packageSize && product.packageUnit ? `${product.packageSize} ${product.packageUnit}` : "Package size not provided")}</Text>
        <Text style={[ui.subheading, { color: colors.primary }]}>{estimatedPrice(product)}</Text>
        {product.priceEstimate !== null && <Text style={ui.caption}>Estimated package price, not a current supermarket offer.</Text>}
      </View>
      {product.source === "demo" && <InfoCard title="Fictional demo product">This fallback item uses illustrative nutrition and pricing, not imported product data.</InfoCard>}
      {risk && (!!risk.contains.length || !!risk.traces.length) && <InfoCard title="Allergen warning">
        {risk.contains.length ? `Contains allergens you selected: ${displayList(risk.contains)}. ` : ""}
        {risk.traces.length ? `May contain allergens you selected: ${displayList(risk.traces)}.` : ""}
      </InfoCard>}
      {hasDiscoveryPreferences(saved) && <Text style={ui.small}>
        {matchesPreferences(product, saved) ? "Matches your saved dietary preferences with no listed allergen conflicts. This is not a guarantee of allergy suitability." : "A match to all your saved preferences is not established: source information may conflict or be incomplete."}
      </Text>}
      <SectionCard title={`Nutrition per ${product.nutritionBasis === "100ml" ? "100 ml" : "100 g"} · as sold`}>
        {([
          ["Calories", product.caloriesPer100g, "kcal"], ["Protein", product.proteinPer100g, "g"],
          ["Carbohydrates", product.carbohydratesPer100g, "g"], ["Fat", product.fatPer100g, "g"],
          ["Fiber", product.fiberPer100g, "g"], ["Sugars", product.sugarsPer100g, "g"], ["Salt", product.saltPer100g, "g"],
        ] as const).map(([label, value, unit]) => <PreferenceRow key={label} label={label} value={value === null ? "Not provided" : `${value} ${unit}`} />)}
        {product.nutritionGrade && <PreferenceRow label="Nutrition grade (Nutri-Score)" value={product.nutritionGrade.toUpperCase()} />}
      </SectionCard>
      <SectionCard title="Ingredients"><Text style={ui.body}>{product.ingredientsText ?? "Ingredients not provided by the source."}</Text></SectionCard>
      <SectionCard title="Allergens">
        <PreferenceRow label="Contains (reported)" value={product.allergens.length ? displayList(product.allergens) : "None listed; not verified allergen-free"} />
        <PreferenceRow label="May contain (reported)" value={product.mayContainAllergens.length ? displayList(product.mayContainAllergens) : "No trace information listed"} />
        <Text style={ui.small}>Source data may be incomplete. Always check ingredients and cross-contact information on the current package. Lactose-free does not mean milk-free.</Text>
      </SectionCard>
      <SectionCard title="Dietary information">
        {dietaryFields.map(field => <PreferenceRow key={field} label={dietaryNames[field]}
          value={product[field] === null ? "Unknown" : product[field] ? "Reported by source" : "Not indicated as suitable"} />)}
        {!!product.labels.length && <Text style={ui.small}>Source labels: {product.labels.join(", ")}</Text>}
      </SectionCard>
      <CatalogAttribution sources={[product.source]} />
      {product.sourceUrl && <TextButton label="View product on source website" onPress={() => openCatalogLink(product.sourceUrl!)} />}
      <Text style={ui.caption}>Catalog updated {new Date(product.updatedAt).toLocaleDateString()}{product.barcode ? ` · Barcode ${product.barcode}` : ""}</Text>
    </>}
  </Screen>;
}
