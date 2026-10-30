import { categoryLabel, dietaryFieldLabel, formatDate, formatNumber, t, term } from '@/services/i18n';
import { StateIllustration, failureIllustration } from '@/components/BrandAssets';
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { CatalogAttribution, openCatalogLink } from "@/components/CatalogAttribution";
import { ProductImage } from "@/components/ProductImage";
import { ProductEstimateNotice } from '@/components/ProductEstimateNotice';
import { AddProductButton } from '@/components/AddProductButton';
import { EmptyState, ErrorMessage, InfoCard, PreferenceRow, Screen, SectionCard, TextButton } from "@/components/ui";
import { getProductRepository } from "@/services/products";
import { allergenConflicts, dietaryFields, estimatedPrice, hasDiscoveryPreferences, matchesPreferences } from "@/services/catalog/discovery";
import { usePreferences } from "@/context/PreferencesContext";
import type { Product } from "@/types/product";
import { colors, ui } from "@/lib/theme";
const displayList = (values: string[]) => values.map(term).join(", ").replace(/_/g, " ");
export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { saved } = usePreferences();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [failureKind,setFailureKind]=useState<'offline'|'dataError'>('dataError');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setProduct(null);
    void getProductRepository().get(id, controller.signal).then(p => {
      if (!controller.signal.aborted) setProduct(p);
    }).catch(cause => {
      if (!controller.signal.aborted) { setFailureKind(failureIllustration(cause)); setError(t('product.loadFailed')); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  const risk = product ? allergenConflicts(product, saved) : null;
  return <Screen top={false} bottom>
    {loading ? <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={t('product.loading')} /> : error ? <>
      <StateIllustration kind={failureKind} /><ErrorMessage message={error} /><TextButton label={t('product.retry')} onPress={() => setRevision(v => v + 1)} />
    </> : !product ? <EmptyState illustration="dataError" title={t('product.notFoundTitle')} description={t('product.notFoundBody')} /> : <>
      <ProductImage uri={product.displayImageUrl} width={product.imageWidth} height={product.imageHeight} name={product.name} large />
      <View style={ui.stack}>
        <Text style={ui.caption}>{product.brand ?? t('product.noBrand')} · {categoryLabel(product.category)}</Text>
        <Text style={ui.heading}>{product.name}</Text>
        <Text style={ui.body}>{product.quantityLabel ?? (product.packageSize && product.packageUnit ? `${product.packageSize} ${product.packageUnit}` : t('product.noPackageSize'))}</Text>
        <Text style={[ui.subheading, { color: colors.primary }]}>{estimatedPrice(product)}</Text>
        {product.priceEstimate !== null && <Text style={ui.caption}>{product.priceEstimateVersion==='synthetic-category-demo-2'?t('product.demoPrice'):product.priceEstimateSource==='synthetic_mvp'?t('product.devPrice'):t('product.estimatedPrice')}  Kein aktuelles Supermarktangebot.</Text>}
      </View>
      {product.source === "demo" && <InfoCard title="Fiktives Demo-Produkt">{t('product.sampleNote')}</InfoCard>}
      <AddProductButton product={product} />
      {risk && (!!risk.contains.length || !!risk.traces.length) && <InfoCard title="Allergenhinweis">
        {risk.contains.length ? `Enthält von dir ausgewählte Allergene: ${displayList(risk.contains)}. ` : ""}
        {risk.traces.length ? `Kann von dir ausgewählte Allergene enthalten: ${displayList(risk.traces)}.` : ""}
      </InfoCard>}
      {hasDiscoveryPreferences(saved) && <Text style={ui.small}>
        {matchesPreferences(product, saved) ? t('product.fits') : t('product.unconfirmed')}
      </Text>}
      <SectionCard title={`Nährwerte je ${product.nutritionBasis === "100ml" ? "100 ml" : "100 g"} · im Verkaufszustand`}>
        <ProductEstimateNotice product={product} />
        {([
          ["Kalorien", product.caloriesPer100g, "kcal"], [t('product.protein'), product.proteinPer100g, "g"],
          ["Kohlenhydrate", product.carbohydratesPer100g, "g"], ["Fett", product.fatPer100g, "g"],
          ["Ballaststoffe", product.fiberPer100g, "g"], ["Zucker", product.sugarsPer100g, "g"], ["Salz", product.saltPer100g, "g"],
        ] as const).map(([label, value, unit]) => <PreferenceRow key={label} label={label} value={value === null ? t('product.notGiven') : `${formatNumber(value, 3)} ${unit}`} />)}
        {product.nutritionGrade && <PreferenceRow label={t('product.nutriScore')} value={product.nutritionGrade.toUpperCase()} />}
      </SectionCard>
      <SectionCard title="Zutaten"><Text style={ui.body}>{product.ingredientsText ?? t('product.noIngredients')}</Text></SectionCard>
      <SectionCard title="Allergene">
        <PreferenceRow label={t('product.contains')} value={product.allergens.length ? displayList(product.allergens) : t('product.noneListed')} />
        <PreferenceRow label={t('product.mayContain')} value={product.mayContainAllergens.length ? displayList(product.mayContainAllergens) : t('product.noTraces')} />
        <Text style={ui.small}>{t('product.sourceNote')}</Text>
      </SectionCard>
      <SectionCard title={t('product.dietary')}>
        {dietaryFields.map(field => <PreferenceRow key={field} label={dietaryFieldLabel(field)}
          value={product[field] === null ? "Unbekannt" : product[field] ? "Laut Quellenangabe" : t('product.notSuitable')} />)}
        {!!product.labels.filter(l => !l.startsWith('smartbasket:demo:')).length && <Text style={ui.small}>Kennzeichnungen der Quelle: {product.labels.filter(l => !l.startsWith('smartbasket:demo:')).join(", ")}</Text>}
      </SectionCard>
      <CatalogAttribution sources={[product.source]} />
      {product.sourceUrl && <TextButton label={t('product.viewSource')} onPress={() => openCatalogLink(product.sourceUrl!)} />}
      <Text style={ui.caption}>Katalog aktualisiert {formatDate(product.updatedAt)}{product.barcode ? ` · Strichcode ${product.barcode}` : ""}</Text>
    </>}
  </Screen>;
}
